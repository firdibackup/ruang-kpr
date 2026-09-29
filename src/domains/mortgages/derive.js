// Pure derivations for an active mortgage (no storage, caller passes `asOf`).
import { addMonths, daysUntil, nextDueDate } from '@/calculations/dates'
import { calculateDti, calculateFloatingImpact, calculatePropertyMetrics, generateAmortizationSchedule } from '@/calculations/finance'

export const WARNING_WINDOW_DAYS = 90

// Forward-looking schedule from today's outstanding. Returns { missing } instead of a fake table.
export function buildScheduleInput(m, asOf) {
  // Sharia products are not annuity interest loans; never force them into this formula (doc 05 §11.2).
  if (m.scheme === 'sharia') return { missing: ['Metode perhitungan KPR syariah belum didukung'] }
  const missing = []
  if (!(m.outstandingPrincipal > 0)) missing.push('Sisa pokok')
  if (!(m.remainingTenorMonths > 0)) missing.push('Sisa tenor')
  if (!(m.currentRateBps > 0)) missing.push('Bunga saat ini')
  if (missing.length) return { missing }

  const startDate = nextDueDate({ today: asOf, dueDay: m.dueDay })
  const termMonths = m.remainingTenorMonths
  const fixedEndsInTerm = m.currentRateType === 'fixed' && m.fixedUntil && m.fixedUntil < addMonths(startDate, termMonths - 1, m.dueDay)
  if (!fixedEndsInTerm) {
    return { startDate, termMonths, ratePeriods: [{ startMonth: 0, endMonth: termMonths - 1, annualRateBps: m.currentRateBps, rateType: m.currentRateType, estimated: false }] }
  }
  if (!(m.estimatedFloatingRateBps > 0)) return { missing: ['Estimasi bunga floating setelah fixed'] }
  let fixedMonths = 0
  while (addMonths(startDate, fixedMonths, m.dueDay) <= m.fixedUntil) fixedMonths++
  const ratePeriods = []
  if (fixedMonths > 0) ratePeriods.push({ startMonth: 0, endMonth: fixedMonths - 1, annualRateBps: m.currentRateBps, rateType: 'fixed', estimated: false })
  ratePeriods.push({ startMonth: fixedMonths, endMonth: termMonths - 1, annualRateBps: m.estimatedFloatingRateBps, rateType: 'floating', estimated: true })
  return { startDate, termMonths, ratePeriods, fixedMonths }
}

export function buildSchedule(m, asOf) {
  const input = buildScheduleInput(m, asOf)
  if (input.missing) return { schedule: null, missing: input.missing, error: null }
  try {
    const schedule = generateAmortizationSchedule({ principal: m.outstandingPrincipal, termMonths: input.termMonths, ratePeriods: input.ratePeriods, startDate: input.startDate, dueDay: m.dueDay })
    return { schedule, missing: [], error: null, fixedMonths: input.fixedMonths ?? null }
  } catch (error) {
    return { schedule: null, missing: [], error }
  }
}

export function rateMode(m, asOf) {
  if (m.currentRateType === 'floating' || (m.fixedUntil && m.fixedUntil < asOf)) return { mode: 'floating', daysUntilFixedEnd: null }
  if (!m.fixedUntil) return { mode: 'normal', daysUntilFixedEnd: null }
  const days = daysUntil({ fromDate: asOf, targetDate: m.fixedUntil })
  return { mode: days > 0 && days <= WARNING_WINDOW_DAYS ? 'warning' : 'normal', daysUntilFixedEnd: days }
}

export function nextMilestone(days) {
  return [90, 60, 30, 14, 7].filter((h) => days <= h).at(-1) ?? null
}

// Provisional KPR Health (PRD §11.2, open question #7): documented thresholds, not a bank credit score.
// Missing components are reported as null and the overall score is marked partial — never a fake zero.
export function healthScore({ dtiRatio, ltvRatio, mode, daysUntilFixedEnd, paidRatio }) {
  const band = (value, steps) => steps.find(([limit]) => value <= limit)[1]
  const components = [
    { key: 'dti', name: 'Beban cicilan', score: dtiRatio == null ? null : band(dtiRatio, [[0.3, 90], [0.35, 75], [0.4, 62], [0.5, 40], [Infinity, 20]]) },
    { key: 'ltv', name: 'Nilai properti', score: ltvRatio == null ? null : band(ltvRatio, [[0.5, 90], [0.7, 75], [0.8, 60], [1, 40], [Infinity, 20]]) },
    { key: 'rate', name: 'Risiko bunga', score: mode === 'floating' ? 50 : band(daysUntilFixedEnd ?? Infinity, [[90, 58], [365, 75], [Infinity, 90]]) },
    { key: 'progress', name: 'Progres pinjaman', score: Math.min(100, Math.round(50 + 70 * paidRatio)) },
  ]
  const known = components.filter((c) => c.score !== null)
  const score = Math.round(known.reduce((s, c) => s + c.score, 0) / known.length)
  return {
    score,
    partial: known.length < components.length,
    label: score >= 80 ? 'Sehat' : score >= 60 ? 'Perlu perhatian' : 'Berisiko',
    tone: score >= 80 ? 'ok' : score >= 60 ? 'warn' : 'bad',
    components,
  }
}

// First due date on/after today that the user has not marked as paid.
export function nextUnpaidDue(m, asOf) {
  const paid = new Set((m.payments ?? []).filter((p) => p.status === 'paid').map((p) => p.dueDate))
  let due = nextDueDate({ today: asOf, dueDay: m.dueDay })
  while (paid.has(due)) due = addMonths(due, 1, m.dueDay)
  return due
}

export function deriveMortgage(m, asOf) {
  const { mode, daysUntilFixedEnd } = rateMode(m, asOf)
  const nextDue = nextUnpaidDue(m, asOf)
  const { schedule, missing, error, fixedMonths } = buildSchedule(m, asOf)
  const f = m.finance ?? {}
  const income = (f.monthlyIncome ?? 0) + (f.jointIncome ? f.partnerIncome ?? 0 : 0)
  const otherDebt = (f.vehicleDebt ?? 0) + (f.cardDebt ?? 0) + (f.otherDebt ?? 0)
  const dti = income > 0 ? calculateDti({ monthlyIncome: income, mortgagePayment: m.currentPayment, otherMonthlyDebt: otherDebt }) : null
  const value = m.property?.estimatedValue ?? null
  const property = value > 0 && m.outstandingPrincipal >= 0 ? calculatePropertyMetrics({ propertyValue: value, outstanding: m.outstandingPrincipal ?? 0 }) : null
  const paidRatio = m.originalPrincipal > 0 ? Math.min(1, Math.max(0, (m.originalPrincipal - (m.outstandingPrincipal ?? m.originalPrincipal)) / m.originalPrincipal)) : 0

  let floatingImpact = null
  if (mode !== 'floating' && schedule && fixedMonths != null && fixedMonths < schedule.rows.length) {
    const resetRow = schedule.rows[fixedMonths]
    floatingImpact = {
      ...calculateFloatingImpact({ outstanding: resetRow.openingBalance, remainingMonths: schedule.rows.length - fixedMonths, currentAnnualRateBps: m.currentRateBps, nextAnnualRateBps: m.estimatedFloatingRateBps }),
      resetDate: resetRow.dueDate,
    }
  }
  return {
    mode,
    daysUntilFixedEnd,
    milestone: mode === 'warning' ? nextMilestone(daysUntilFixedEnd) : null,
    nextDue,
    daysToNextDue: daysUntil({ fromDate: asOf, targetDate: nextDue }),
    schedule,
    scheduleMissing: missing,
    scheduleError: error,
    firstRow: schedule?.rows[0] ?? null,
    estimatedEndDate: schedule?.rows.at(-1).dueDate ?? null,
    dti,
    income,
    otherDebt,
    property,
    partialProperty: !(value > 0),
    paidRatio,
    floatingImpact,
    health: healthScore({ dtiRatio: dti?.dtiRatio ?? null, ltvRatio: property?.ltvRatio ?? null, mode, daysUntilFixedEnd, paidRatio }),
  }
}
