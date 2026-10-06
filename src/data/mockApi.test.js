import { describe, expect, it } from 'vitest'
import { calculateMaxPrincipal } from '@/calculations/finance'
import { selectHomeState } from '@/domains/home/selectHomeState'
import { takeoverGaps } from '@/domains/optimize/validation'
import { createMockApi, mockControls } from './mockApi'
import { DEFAULT_REMINDERS, SCENARIOS, createSeed } from './seed'

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

  it('deleteAccount wipes everything; registering again starts empty', async () => {
    mockControls.reset('mortgage_active_normal')
    await api.auth.deleteAccount()
    expect((await api.auth.getSession()).status).toBe('guest')
    await expectCode(api.dashboard.getSnapshot(), 'AUTH_REQUIRED')
    await api.auth.register({ name: 'Firdi Audi', contact: '0812 3456 7890', acceptTerms: true, acceptPrivacy: true })
    await api.auth.verifyOtp({ otp: '148260' })
    const snap = await api.dashboard.getSnapshot()
    expect(snap.profile.nik).toBeUndefined()
    expect(snap.mortgages).toHaveLength(0)
    expect(snap.applications).toHaveLength(0)
  })

  it('deleteAccount is blocked while an application is at the bank', async () => {
    mockControls.reset('application_in_process')
    await expectCode(api.auth.deleteAccount(), 'INVALID_STATE_TRANSITION')
    expect((await api.dashboard.getSnapshot()).user).toBeTruthy()
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
    expect(await api.bankProducts.affordability({ applicationId: app.id })).toMatchObject({ openCount: 3, capacity: { remainingCapacity: 3_750_000 } })
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
  const step1 = { bankName: 'Bank ABC', scheme: 'conventional', originalPrincipal: 600_000_000, currentPayment: 4_127_324, originalTenorMonths: 240, startDate: '2021-12-22', dueDay: 22 }
  const fixedRate = { currentRateType: 'fixed', fixedUntil: '2026-12-22', currentRateBps: 550, remainingTenorMonths: 183, estimatedFloatingRateBps: 900, outstandingPrincipal: null, outstandingEstimated: null }

  it('step 1 KPR data is all activation needs; sisa pokok is estimated when not known', async () => {
    mockControls.reset('fresh')
    const m = await api.mortgages.createSetup()
    const saved = await api.mortgages.saveSetupStep(m.id, { step: 1, values: { ...step1, ...fixedRate } })
    expect(saved.outstandingPrincipal).toBe(calculateMaxPrincipal({ payment: 4_127_324, annualRateBps: 550, termMonths: 183 }))
    expect(saved.outstandingEstimated).toBe(true)
    expect(saved.setupStep).toBe(2) // straight to Reminder
    await api.mortgages.saveSetupStep(m.id, { step: 2, values: { reminders: structuredClone(DEFAULT_REMINDERS) } })
    const r = await api.mortgages.activate(m.id, { confirmDataCorrect: true })
    expect(r.applicationCreated).toBe(false)
    const snap = await api.dashboard.getSnapshot()
    expect(snap.applications).toHaveLength(0)
    expect(selectHomeState(snap, snap.clock).state).toBe('mortgage_active_warning')
  })

  it('reminder-only data no longer activates: amortization data is required', async () => {
    mockControls.reset('fresh')
    const m = await api.mortgages.createSetup()
    await api.mortgages.saveSetupStep(m.id, { step: 1, values: { bankName: 'Bank ABC', currentPayment: 4_127_324, dueDay: 22, currentRateType: 'floating' } })
    await expect(api.mortgages.activate(m.id, { confirmDataCorrect: true })).rejects.toMatchObject({ code: 'VALIDATION_FAILED', details: { missing: expect.arrayContaining(['originalPrincipal', 'currentRateBps', 'outstandingPrincipal']) } })
  })

  it('official sisa pinjaman wins until cleared; floating clears the fixed-only fields', async () => {
    mockControls.reset('fresh')
    const m = await api.mortgages.createSetup()
    await api.mortgages.saveSetupStep(m.id, { step: 1, values: { ...step1, ...fixedRate, outstandingPrincipal: 500_000_000, outstandingEstimated: false } })
    let saved = await api.mortgages.saveSetupStep(m.id, { step: 1, values: { currentRateBps: 600 } })
    expect(saved).toMatchObject({ outstandingPrincipal: 500_000_000, outstandingEstimated: false })
    saved = await api.mortgages.saveSetupStep(m.id, { step: 1, values: { outstandingPrincipal: null, outstandingEstimated: null } })
    expect(saved.outstandingPrincipal).toBe(calculateMaxPrincipal({ payment: 4_127_324, annualRateBps: 600, termMonths: 183 }))
    expect(saved.outstandingEstimated).toBe(true)
    saved = await api.mortgages.saveSetupStep(m.id, { step: 1, values: { currentRateType: 'floating' } })
    expect(saved).toMatchObject({ fixedUntil: null, estimatedFloatingRateBps: null })
  })

  it('Data properti filled after activation is saved on the KPR', async () => {
    mockControls.reset('mortgage_active_normal')
    const [m] = (await api.dashboard.getSnapshot()).mortgages
    const saved = await api.mortgages.saveSetupStep(m.id, { step: 1, values: { property: { type: 'landed_house', address: 'Griya Asri Blok C2' } } })
    expect(saved.property).toMatchObject({ type: 'landed_house', address: 'Griya Asri Blok C2' })
    expect(saved.status).toBe('active')
  })

  it('"Tetap di bank" hides the fixed-rate warning for the current milestone only', async () => {
    mockControls.reset('mortgage_active_h90')
    const [m] = (await api.dashboard.getSnapshot()).mortgages
    expect((await api.mortgages.dismissRateWarning(m.id)).rateWarningDismissedMilestone).toBe(90)
    mockControls.reset('mortgage_active_normal')
    const [normal] = (await api.dashboard.getSnapshot()).mortgages
    await expectCode(api.mortgages.dismissRateWarning(normal.id), 'INVALID_STATE_TRANSITION')
  })

  it('saving unrelated fields keeps an existing sisa pinjaman stable', async () => {
    mockControls.reset('mortgage_active_normal')
    const [m] = (await api.dashboard.getSnapshot()).mortgages
    const saved = await api.mortgages.saveSetupStep(m.id, { step: 1, values: { bankName: m.bankName, currentPayment: m.currentPayment, dueDay: m.dueDay } })
    expect(saved.outstandingPrincipal).toBe(m.outstandingPrincipal)
  })

  it('profile finance edits reach the active mortgage (KPR Health reads that copy)', async () => {
    mockControls.reset('mortgage_active_normal')
    await api.profile.update({ finance: { monthlyIncome: 20_000_000, vehicleDebt: 1_000_000 } })
    const [m] = (await api.dashboard.getSnapshot()).mortgages
    expect(m.finance).toMatchObject({ monthlyIncome: 20_000_000, vehicleDebt: 1_000_000 })
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

describe('dashboard layout', () => {
  it('is null until customised (the board picks the default for the data); saves a validated layout; null restores it', async () => {
    mockControls.reset('mortgage_active_normal')
    expect((await api.dashboard.getSnapshot()).dashboardLayout).toBeNull()
    await expectCode(api.dashboard.saveLayout('rusak'), 'VALIDATION_FAILED')
    const saved = await api.dashboard.saveLayout([{ i: 'outstanding', x: 0, y: 3, w: 99, h: 4 }, { i: 'chart', x: 0, y: 0, w: 4, h: 4 }])
    expect(saved).toEqual([{ i: 'outstanding', x: 0, y: 0, w: 12, h: 4 }])
    expect((await api.dashboard.getSnapshot()).dashboardLayout).toEqual(saved)
    expect(await api.dashboard.saveLayout(null)).toBeNull()
  })
})

describe('page tours', () => {
  it('none seen after a reset; marks known tours once; rejects unknown ids', async () => {
    mockControls.reset('fresh')
    expect((await api.dashboard.getSnapshot()).toursSeen).toEqual([])
    await api.dashboard.markTourSeen('home-fresh')
    await api.dashboard.markTourSeen('home-fresh')
    await expectCode(api.dashboard.markTourSeen('toString'), 'VALIDATION_FAILED')
    expect((await api.dashboard.getSnapshot()).toursSeen).toEqual(['home-fresh'])
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

  it('a draft from a monitored KPR submits only once its forms pass; non-pricing data keeps the program', async () => {
    const applyFirst = async () => {
      mockControls.reset('mortgage_active_floating')
      const [m] = (await api.dashboard.getSnapshot()).mortgages
      const sim = await api.simulations.run({ source: { type: 'mortgage', id: m.id }, input: { mode: 'takeover', goal: 'lower_payment', tenorMonths: 180 } })
      return api.simulations.apply({ bankProductId: sim.items[0].productId, tenorMonths: 180 })
    }
    let app = await applyFirst()
    for (const d of app.requiredDocuments.filter((x) => x.required)) await api.applications.uploadDocument(app.id, { documentType: d.type, file: file(`${d.type}.jpg`) })
    const consents = { dataAccuracy: true, sendToBank: true }
    app = await api.applications.saveStep(app.id, { step: 1, values: { employment: { companyName: '' } } })
    await expectCode(api.applications.submit(app.id, { consents }), 'VALIDATION_FAILED') // Pekerjaan no longer passes its form
    app = await api.applications.saveStep(app.id, { step: 1, values: { employment: { companyName: 'PT Lain', jobTitle: 'Manager' } } })
    expect(app.selection).not.toBeNull()
    expect((await api.applications.submit(app.id, { consents })).status).toBe('submitted')

    app = await applyFirst()
    app = await api.applications.saveStep(app.id, { step: 1, values: { employment: { monthlyIncome: app.data.employment.monthlyIncome + 1_000_000 } } })
    expect(app.selection).toBeNull() // income prices the program
  })

  it('a cancelled Take Over keeps what was typed, so the next draft starts filled in', async () => {
    mockControls.reset('fresh')
    let app = await api.applications.create({ productType: 'takeover', mode: 'takeover' })
    const oldLoan = { bankName: 'Bank ABC', originalPrincipal: 500_000_000, currentPayment: 5_000_000, rateBps: 1050, rateType: 'floating', outstanding: 421_500_000, remainingMonths: 181, source: 'official' }
    const property = { propertyType: 'landed_house', city: 'Kota Bekasi', estimatedValue: 850_000_000 }
    const finance = { vehicleDebt: 1_000_000, cardDebt: 0, otherDebt: 0 }
    app = await api.applications.saveStep(app.id, { step: 1, values: { employment: { monthlyIncome: 15_000_000 } } })
    app = await api.applications.saveStep(app.id, { step: 2, values: { oldLoan, property, finance } })
    await api.applications.cancel(app.id)

    const next = await api.applications.create({ productType: 'takeover', mode: 'takeover' })
    expect(next.id).not.toBe(app.id)
    expect(next.data).toMatchObject({ oldLoan, property, finance, employment: { monthlyIncome: 15_000_000 } }) // gaji via the profile
    expect(next).toMatchObject({ currentStep: 1, documents: {} })
  })

  it('a draft created from a monitored KPR is prefilled and opens on Tujuan with only the missing forms left', async () => {
    mockControls.reset('mortgage_active_floating')
    const { mortgages: [m], clock } = await api.dashboard.getSnapshot()
    const app = await api.applications.create({ productType: 'takeover', mode: 'takeover', mortgageId: m.id })
    expect(app).toMatchObject({ source: 'mortgage', mortgageId: m.id, currentStep: 5, selection: null, data: { oldLoan: { bankName: m.bankName, outstanding: m.outstandingPrincipal } } })
    expect(takeoverGaps(app.data, { today: clock, mode: 'takeover' })).toEqual([]) // nothing left to ask
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
