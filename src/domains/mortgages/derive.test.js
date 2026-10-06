import { describe, expect, it } from 'vitest'
import { deriveMortgage, healthScore, rateMode } from './derive'

const today = '2026-09-28'
// What the 3-step setup can leave behind: bank, cicilan, jatuh tempo, and "Belum tahu" for the rate type.
const minimal = { id: 'mtg_min', status: 'active', bankName: 'Bank ABC', currentPayment: 4_127_324, dueDay: 22, currentRateType: null, payments: [] }

describe('derive with reminder-only data', () => {
  it('an unknown rate type is not read as a healthy normal rate', () => {
    expect(rateMode({ currentRateType: null }, today)).toEqual({ mode: null, daysUntilFixedEnd: null })
  })

  it('pelunasan progress is unknown without the original principal, not 0%', () => {
    expect(deriveMortgage(minimal, today).paidRatio).toBeNull()
    expect(deriveMortgage({ ...minimal, originalPrincipal: 600_000_000, outstandingPrincipal: 450_000_000 }, today).paidRatio).toBe(0.25)
  })

  it('KPR Health has no score (not NaN) when no component is known', () => {
    expect(healthScore({ dtiRatio: null, ltvRatio: null, mode: null, daysUntilFixedEnd: null, paidRatio: null })).toMatchObject({ score: null, partial: true, label: 'Belum lengkap', tone: 'mute' })
    expect(deriveMortgage(minimal, today).health.score).toBeNull()
  })

  it('payment history still lists due dates without an akad date', () => {
    expect(deriveMortgage(minimal, today).dueWindow).toEqual(['2026-09-22', '2026-10-22', '2026-11-22'])
  })

  it('the akad day is not the next installment', () => {
    const fresh = { ...minimal, startDate: today, dueDay: 28 }
    expect(deriveMortgage(fresh, today)).toMatchObject({ nextDue: '2026-10-28', paymentAlert: null })
  })

  it('Home nudges from H-7 (warn), turns red on the due day and for a due missed since activation', () => {
    const tracked = { ...minimal, activatedAt: '2026-09-15T08:00:00.000Z', payments: [{ dueDate: '2026-09-22', status: 'paid' }] }
    expect(deriveMortgage(tracked, '2026-10-14').paymentAlert).toBeNull()
    expect(deriveMortgage(tracked, '2026-10-15').paymentAlert).toEqual({ due: '2026-10-22', days: 7, tone: 'warn' })
    expect(deriveMortgage(tracked, '2026-10-22').paymentAlert).toEqual({ due: '2026-10-22', days: 0, tone: 'bad' })
    expect(deriveMortgage(tracked, '2026-10-25').paymentAlert).toEqual({ due: '2026-10-22', days: -3, tone: 'bad' })
    // A due before activation could not be recorded here, so it is not flagged as late.
    expect(deriveMortgage({ ...tracked, activatedAt: '2026-09-28T08:00:00.000Z', payments: [] }, today).paymentAlert).toBeNull()
  })
})
