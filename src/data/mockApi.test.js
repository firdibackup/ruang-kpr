import { describe, expect, it } from 'vitest'
import { selectHomeState } from '@/domains/home/selectHomeState'
import { createMockApi, mockControls } from './mockApi'
import { SCENARIOS, createSeed } from './seed'

const api = createMockApi({ latencyMs: 0 })
const file = (name, size = 200_000, type = 'image/jpeg') => ({ name, size, type })
const expectCode = async (promise, code) => {
  await expect(promise).rejects.toMatchObject({ name: 'ApiError', code })
}

describe('auth', () => {
  it('register → OTP fixtures (000000 invalid, 999999 expired, 148260 ok)', async () => {
    mockControls.reset('guest')
    await expectCode(api.auth.register({ name: 'Fi', contact: 'x', acceptTerms: true, acceptPrivacy: false }), 'VALIDATION_FAILED')
    const r = await api.auth.register({ name: 'Firdi Audi', contact: '0812 3456 7890', acceptTerms: true, acceptPrivacy: true })
    expect(r.maskedDestination).toBe('+62 812 **** 7890')
    await expectCode(api.auth.verifyOtp({ otp: '000000' }), 'OTP_INVALID')
    await expectCode(api.auth.verifyOtp({ otp: '999999' }), 'OTP_EXPIRED')
    await expectCode(api.dashboard.getSnapshot(), 'AUTH_REQUIRED')
    await api.auth.verifyOtp({ otp: '148260' })
    const snap = await api.dashboard.getSnapshot()
    expect(snap.user.name).toBe('Firdi Audi')
    expect(snap.applications).toHaveLength(0) // registration never creates an application
  })
})

describe('primary application', () => {
  it('one active application; submit requires docs, program, and consent', async () => {
    mockControls.reset('fresh')
    const app = await api.applications.create({ productType: 'primary', purchaseType: 'new_from_developer' })
    await expectCode(api.applications.create({ productType: 'primary', purchaseType: 'used_from_owner' }), 'ACTIVE_DRAFT_EXISTS')
    await api.applications.saveStep(app.id, {
      step: 2,
      values: {
        personal: { fullName: 'Firdi Audi', nik: '3174012345678901', birthDate: '1996-04-12' },
        employment: { occupation: 'private_employee', monthlyIncome: 15_000_000, vehicleDebt: 1_000_000, cardDebt: 500_000, otherDebt: 0 },
        property: { propertyType: 'landed_house', price: 500_000_000, developerName: 'PT Griya' },
        loan: { downPayment: 100_000_000, amount: 400_000_000, tenorMonths: 240 },
      },
    })
    await expectCode(api.applications.submit(app.id, { consents: { dataAccuracy: true, sendToBank: true } }), 'DOCUMENTS_INCOMPLETE')
    for (const t of ['ktp', 'npwp', 'income_proof', 'property_document']) await api.applications.uploadDocument(app.id, { documentType: t, file: file(`${t}.jpg`) })
    await expectCode(api.applications.uploadDocument(app.id, { documentType: 'additional', file: file('a.exe') }), 'FILE_TYPE_UNSUPPORTED')
    await expectCode(api.applications.uploadDocument(app.id, { documentType: 'additional', file: file('a.pdf', 6 * 1024 * 1024) }), 'FILE_TOO_LARGE')
    const compare = await api.bankProducts.compare({ applicationId: app.id })
    expect(JSON.stringify(compare)).not.toMatch(/secondary/i)
    const chosen = compare.items[0]
    await api.applications.selectProgram(app.id, { bankProductId: chosen.productId, loanAmount: 400_000_000, tenorMonths: 240 })
    await expectCode(api.applications.submit(app.id, { consents: { dataAccuracy: true, sendToBank: false } }), 'CONSENT_REQUIRED')
    const submitted = await api.applications.submit(app.id, { consents: { dataAccuracy: true, sendToBank: true } })
    expect(submitted.status).toBe('submitted')
    expect(submitted.snapshot.selection.bankProductId).toBe(chosen.productId)
    await expectCode(api.applications.submit(app.id, { consents: { dataAccuracy: true, sendToBank: true } }), 'APPLICATION_ALREADY_SUBMITTED')
    await expectCode(api.applications.saveStep(app.id, { step: 2, values: { loan: { amount: 1 } } }), 'INVALID_STATE_TRANSITION')
  })

  it('upload failure scenario fails once, retry succeeds without touching other data', async () => {
    mockControls.reset('upload_failure')
    const { applications } = await api.dashboard.getSnapshot()
    const id = applications[0].id
    await expectCode(api.applications.uploadDocument(id, { documentType: 'ktp', file: file('ktp.jpg') }), 'SERVICE_UNAVAILABLE')
    const ok = await api.applications.uploadDocument(id, { documentType: 'ktp', file: file('ktp.jpg') })
    expect(ok.documents.ktp.status).toBe('uploaded')
    expect(ok.data.loan.amount).toBe(400_000_000)
  })

  it('rejected: clone keeps history row, retry returns the same row to draft', async () => {
    mockControls.reset('application_rejected_dti')
    const [rejected] = (await api.dashboard.getSnapshot()).applications
    const clone = await api.applications.cloneToBank(rejected.id)
    const snap = await api.dashboard.getSnapshot()
    expect(snap.applications).toHaveLength(2)
    expect(snap.applications.find((a) => a.id === rejected.id)).toMatchObject({ status: 'rejected', superseded: true })
    expect(clone).toMatchObject({ status: 'draft', currentStep: 6 })
    expect(clone.excludedProductIds).toContain(rejected.selection.bankProductId)

    mockControls.reset('application_rejected_dti')
    const retried = await api.applications.retrySameBank(rejected.id)
    expect(retried).toMatchObject({ id: rejected.id, status: 'draft', currentStep: 2 })
  })

  it('status can advance to disbursed and creates an active mortgage from final terms', async () => {
    mockControls.reset('application_in_process')
    const [app] = (await api.dashboard.getSnapshot()).applications
    for (let i = 0; i < 6; i++) mockControls.advanceApplication(app.id)
    const snap = await api.dashboard.getSnapshot()
    expect(snap.applications[0].status).toBe('disbursed')
    const m = snap.mortgages.find((x) => x.status === 'active')
    expect(m.originalPrincipal).toBe(app.selection.loanAmount)
    expect(m.currentPayment).toBe(app.selection.estimatedPayment)
  })
})

describe('monitoring', () => {
  it('changed payment requires official outstanding; activation creates no application', async () => {
    mockControls.reset('fresh')
    const m = await api.mortgages.createSetup()
    await expectCode(api.mortgages.saveSetupStep(m.id, { step: 2, values: { paymentEverChanged: true, outstandingPrincipal: null } }), 'OFFICIAL_OUTSTANDING_REQUIRED')
    await expectCode(api.mortgages.estimate({ originalPrincipal: 600_000_000, currentPayment: 4_127_324, originalTenorMonths: 240, startDate: '2021-12-22', dueDay: 22, paymentEverChanged: true }), 'OFFICIAL_OUTSTANDING_REQUIRED')
    const est = await api.mortgages.estimate({ originalPrincipal: 600_000_000, currentPayment: 4_127_324, originalTenorMonths: 240, startDate: '2021-12-22', dueDay: 22, paymentEverChanged: false })
    expect(est).toMatchObject({ effectiveRateBps: 550, paidMonths: 57, remainingMonths: 183, estimated: true })
    expect(Math.abs(est.outstanding - 510_515_794)).toBeLessThan(5)
    await api.mortgages.saveSetupStep(m.id, {
      step: 5,
      values: {
        bankName: 'Bank ABC', originalPrincipal: 600_000_000, currentPayment: 4_127_324, originalTenorMonths: 240, startDate: '2021-12-22', dueDay: 22,
        outstandingPrincipal: est.outstanding, remainingTenorMonths: 183, paymentEverChanged: false, currentRateBps: 550, currentRateType: 'fixed', fixedUntil: '2026-12-22', estimatedFloatingRateBps: 900,
        finance: { monthlyIncome: 15_000_000, vehicleDebt: 0, cardDebt: 0, otherDebt: 0 },
      },
    })
    const r = await api.mortgages.activate(m.id, { confirmDataCorrect: true })
    expect(r.applicationCreated).toBe(false)
    const snap = await api.dashboard.getSnapshot()
    expect(snap.applications).toHaveLength(0)
    expect(selectHomeState(snap, snap.clock).state).toBe('mortgage_active_warning')
  })

  it('manual payment is user-recorded and never bank-confirmed; duplicates rejected', async () => {
    mockControls.reset('mortgage_active_normal')
    const [m] = (await api.dashboard.getSnapshot()).mortgages
    const p = await api.mortgages.markPaid(m.id, { dueDate: '2026-10-22', amount: m.currentPayment, paidAt: '2026-09-28' })
    expect(p).toMatchObject({ source: 'manual_user_recorded', bankConfirmed: false })
    await expectCode(api.mortgages.markPaid(m.id, { dueDate: '2026-10-22', amount: m.currentPayment, paidAt: '2026-09-28' }), 'DUPLICATE_PAYMENT_RECORD')
  })

  it('payment proof keeps metadata only and rejects unsupported files', async () => {
    mockControls.reset('mortgage_active_normal')
    const [m] = (await api.dashboard.getSnapshot()).mortgages
    await expectCode(api.mortgages.markPaid(m.id, { dueDate: '2026-10-22', amount: m.currentPayment, paidAt: '2026-09-28', proof: { name: 'bukti.docx', size: 1000, type: 'application/msword' } }), 'FILE_TYPE_UNSUPPORTED')
    await expectCode(api.mortgages.markPaid(m.id, { dueDate: '2026-10-22', amount: m.currentPayment, paidAt: '2026-09-28', proof: { name: 'bukti.pdf', size: 6 * 1024 * 1024, type: 'application/pdf' } }), 'FILE_TOO_LARGE')
    const p = await api.mortgages.markPaid(m.id, { dueDate: '2026-10-22', amount: m.currentPayment, paidAt: '2026-09-28', proof: { name: 'bukti.pdf', size: 120_000, type: 'application/pdf' } })
    expect(p.proof).toEqual({ fileName: 'bukti.pdf', sizeBytes: 120_000, contentType: 'application/pdf' })
  })
})

describe('take over simulation', () => {
  it('save creates no application; apply creates exactly one draft at documents step', async () => {
    mockControls.reset('mortgage_active_floating')
    const [m] = (await api.dashboard.getSnapshot()).mortgages
    const sim = await api.simulations.run({ source: { type: 'mortgage', id: m.id }, input: { mode: 'takeover', goal: 'lower_payment', tenorMonths: 180 } })
    expect(sim.items.length).toBeGreaterThan(0)
    expect(await api.simulations.save(sim.id)).toEqual({ saved: false, reason: 'history_not_enabled' })
    expect((await api.dashboard.getSnapshot()).applications).toHaveLength(0)
    const app = await api.simulations.apply({ bankProductId: sim.items[0].productId, tenorMonths: 180 })
    expect(app).toMatchObject({ productType: 'takeover', status: 'draft', currentStep: 6, mortgageId: m.id })
    expect((await api.dashboard.getSnapshot()).applications).toHaveLength(1)
  })
})

describe('fixtures', () => {
  it('home priority is consistent for every named scenario and no fixture mentions secondary', () => {
    const expected = {
      fresh: 'fresh',
      application_primary_draft_step_3: 'application_draft',
      application_in_process: 'application_in_process',
      application_additional_docs: 'application_in_process',
      application_rejected_dti: 'application_rejected',
      mortgage_setup_step_3: 'mortgage_setup_draft',
      mortgage_active_normal: 'mortgage_active_normal',
      mortgage_active_h90: 'mortgage_active_warning',
      mortgage_active_floating: 'mortgage_active_floating',
      mortgage_partial_property: 'mortgage_active_partial',
      takeover_in_process: 'application_in_process',
    }
    for (const { id } of SCENARIOS) {
      const db = createSeed(id)
      expect(JSON.stringify(db)).not.toMatch(/secondary/i)
      if (expected[id]) expect(selectHomeState(db, db.clock).state, id).toBe(expected[id])
    }
  })
})
