import { describe, expect, it } from 'vitest'
import { deriveMortgage, healthScore, nextMilestone, rateMode } from './derive'
import { FIXED_PASSED, validateLoanStep, validateRateStep, validateReminders } from './validation'
import { createSeed } from '@/data/seed'

const today = '2026-09-28'

describe('mortgage setup validation', () => {
  const loan = { bankName: 'Bank ABC', bankOther: '', currentPayment: '4127324', dueDay: '22' }

  it('step 1 needs only bank, cicilan and due day', () => {
    expect(validateLoanStep(loan)).toEqual({})
    expect(Object.keys(validateLoanStep({ bankName: '', bankOther: '', currentPayment: '', dueDay: '' }))).toEqual(['bankName', 'currentPayment', 'dueDay'])
    expect(validateLoanStep({ ...loan, dueDay: '32' }).dueDay).toBeTruthy()
    expect(validateLoanStep({ ...loan, bankName: 'Bank lainnya', bankOther: 'B' }).bankOther).toBeTruthy()
  })

  it('edit mode: pinjaman awal is optional but cannot be below the remaining loan', () => {
    expect(validateLoanStep({ ...loan, originalPrincipal: '' }, { editing: true })).toEqual({})
    expect(validateLoanStep({ ...loan, originalPrincipal: '400000000' }, { editing: true, outstanding: 450_000_000 }).originalPrincipal).toBeTruthy()
    expect(validateLoanStep({ ...loan, originalPrincipal: '600000000' }, { editing: true, outstanding: 450_000_000 })).toEqual({})
  })

  it('step 2: the rate status is required; fixed needs a future end date', () => {
    expect(validateRateStep({ rateStatus: '' }, { today }).rateStatus).toBeTruthy()
    expect(validateRateStep({ rateStatus: 'unknown' }, { today })).toEqual({})
    expect(validateRateStep({ rateStatus: 'floating' }, { today })).toEqual({})
    expect(validateRateStep({ rateStatus: 'fixed', fixedUntil: '' }, { today }).fixedUntil).toBeTruthy()
    expect(validateRateStep({ rateStatus: 'fixed', fixedUntil: '2026-09-01' }, { today }).fixedUntil).toBe(FIXED_PASSED)
    expect(validateRateStep({ rateStatus: 'fixed', fixedUntil: '2026-12-22' }, { today })).toEqual({})
  })

  it('step 2 estimate fields are optional and checked only when filled', () => {
    const base = { rateStatus: 'fixed', fixedUntil: '2026-12-22' }
    expect(validateRateStep({ ...base, currentRate: '', floatingRate: '', tenorYears: '', tenorMonths: '', outstanding: '' }, { today })).toEqual({})
    expect(validateRateStep({ ...base, currentRate: '45' }, { today }).currentRate).toBeTruthy()
    expect(validateRateStep({ ...base, floatingRate: '45' }, { today }).floatingRate).toBeTruthy()
    expect(validateRateStep({ ...base, tenorYears: '31' }, { today }).tenorYears).toBeTruthy()
    expect(validateRateStep({ ...base, tenorYears: '15', tenorMonths: '12' }, { today }).tenorMonths).toBeTruthy()
    expect(validateRateStep({ ...base, tenorYears: '15', tenorMonths: '3' }, { today })).toEqual({})
    expect(validateRateStep({ ...base, outstanding: '0' }, { today }).outstanding).toBeTruthy()
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
