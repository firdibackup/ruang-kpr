import { describe, expect, it } from 'vitest'
import { deriveMortgage, healthScore, nextMilestone, rateMode } from './derive'
import { validateLoanStep, validateRatePeriods, validateRateStep, validateReminders } from './validation'
import { createSeed } from '@/data/seed'

const today = '2026-09-28'

describe('mortgage setup validation', () => {
  const loan = { bankName: 'Bank ABC', scheme: 'conventional', originalPrincipal: '600000000', currentPayment: '4127324', originalTenorMonths: '240', startDate: '2021-12-22', dueDay: '22', knowsOutstanding: 'no' }
  it('tenor 12–360, akad not in the future, due day 1–31, outstanding ≤ principal', () => {
    expect(validateLoanStep(loan, { today })).toEqual({})
    expect(validateLoanStep({ ...loan, originalTenorMonths: '400' }, { today }).originalTenorMonths).toBeTruthy()
    expect(validateLoanStep({ ...loan, startDate: '2027-01-01' }, { today }).startDate).toBeTruthy()
    expect(validateLoanStep({ ...loan, dueDay: '32' }, { today }).dueDay).toBeTruthy()
    expect(validateLoanStep({ ...loan, knowsOutstanding: 'yes', outstandingPrincipal: '700000000', remainingTenorMonths: '183' }, { today }).outstandingPrincipal).toBeTruthy()
  })
  it('changed payment requires official outstanding (no reverse engineering)', () => {
    const v = { paymentEverChanged: 'yes', currentRate: '9,00', currentRateType: 'floating', outstandingPrincipal: '', remainingTenorMonths: '', currentPayment: '5000000' }
    const e = validateRateStep(v, { mortgage: { startDate: '2021-12-22' } })
    expect(e.outstandingPrincipal).toMatch(/resmi/)
    expect(e.remainingTenorMonths).toBeTruthy()
  })
  it('fixed rate needs a fixed-until date after akad', () => {
    const e = validateRateStep({ paymentEverChanged: 'no', currentRate: '5,50', currentRateType: 'fixed', fixedUntil: '2020-01-01' }, { mortgage: { startDate: '2021-12-22' } })
    expect(e.fixedUntil).toBe('Harus setelah tanggal akad.')
  })
  it('rate period overlap blocks continue', () => {
    const errs = validateRatePeriods([
      { rate: '5,00', startDate: '2021-07-22', endDate: '2024-07-21' },
      { rate: '5,50', startDate: '2024-07-01', endDate: '2026-12-22' },
    ])
    expect(errs[1]).toMatch(/overlap/)
  })
  it('reminders need one payment offset and one channel', () => {
    expect(validateReminders({ payment: [], channels: { inApp: false, email: false } })).toMatchObject({ payment: expect.any(String), channels: expect.any(String) })
  })
})

describe('mortgage derivations', () => {
  it('H-90 window and milestones', () => {
    expect(rateMode({ currentRateType: 'fixed', fixedUntil: '2026-12-22' }, today)).toEqual({ mode: 'warning', daysUntilFixedEnd: 85 })
    expect(rateMode({ currentRateType: 'fixed', fixedUntil: '2026-12-27' }, today).mode).toBe('warning') // exactly 90 days
    expect(rateMode({ currentRateType: 'fixed', fixedUntil: '2026-12-28' }, today).mode).toBe('normal') // 91 days
    expect(rateMode({ currentRateType: 'fixed', fixedUntil: '2026-09-01' }, today).mode).toBe('floating') // fixed already ended
    expect([nextMilestone(85), nextMilestone(60), nextMilestone(7)]).toEqual([90, 60, 7])
  })
  it('active warning fixture reconciles schedule and flags the floating transition as estimate', () => {
    const [m] = createSeed('mortgage_active_h90').mortgages
    const d = deriveMortgage(m, today)
    const rows = d.schedule.rows
    expect(rows[0].dueDate).toBe('2026-10-22')
    expect(d.schedule.totals.principal).toBe(m.outstandingPrincipal)
    expect(rows.at(-1).closingBalance).toBe(0)
    const transition = rows.find((r) => r.periodChanged)
    expect(transition).toMatchObject({ dueDate: '2027-01-22', rateType: 'floating', estimatedRate: true })
    expect(d.floatingImpact.direction).toBe('increase')
  })
  it('missing floating estimate gives partial state instead of a fake table', () => {
    const [m] = createSeed('mortgage_partial_rate').mortgages
    const d = deriveMortgage(m, today)
    expect(d.schedule).toBeNull()
    expect(d.scheduleMissing).toContain('Estimasi bunga floating setelah fixed')
  })
  it('health is partial (not zero) when property value is missing', () => {
    const h = healthScore({ dtiRatio: 0.38, ltvRatio: null, mode: 'normal', daysUntilFixedEnd: 200, paidRatio: 0.2 })
    expect(h.partial).toBe(true)
    expect(h.components.find((c) => c.key === 'ltv').score).toBeNull()
    expect(h.score).toBeGreaterThan(0)
  })
})
