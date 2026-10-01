// Deterministic mock scenarios (doc 04 §22). Stable IDs and a fixed clock keep screenshots/tests stable.
// Mortgage numbers are derived with the calculation engine so every screen agrees with the schedule.
import { countDueDatesBetween } from '@/calculations/dates'
import { calculateAnnuityPayment, calculateOutstanding } from '@/calculations/finance'
import { simulateLoan } from '@/calculations/programs'
import { BANK_PRODUCTS } from './catalog'
import { requiredDocuments } from './documentRules'

export const CLOCK = '2026-09-28'
export const SCHEMA_VERSION = 2 // v2: KPR Primary wizard has 7 steps

export const SCENARIOS = [
  { id: 'guest', label: 'Belum daftar (registrasi)' },
  { id: 'fresh', label: 'Home fresh — belum ada KPR' },
  { id: 'application_primary_draft_step_3', label: 'Draft KPR Primary · step 3 (properti)' },
  { id: 'upload_failure', label: 'Draft · step 5 (upload gagal sekali)' },
  { id: 'no_bank_matches', label: 'Draft · step 6 tanpa program cocok' },
  { id: 'stale_catalog', label: 'Draft · step 6 data produk usang' },
  { id: 'application_in_process', label: 'Pengajuan diproses bank' },
  { id: 'application_additional_docs', label: 'Pengajuan · bank minta dokumen' },
  { id: 'application_rejected_dti', label: 'Pengajuan ditolak (DTI)' },
  { id: 'mortgage_setup_step_3', label: 'Draft Pantau KPR · step 3' },
  { id: 'mortgage_active_normal', label: 'KPR aktif normal' },
  { id: 'mortgage_active_h90', label: 'KPR aktif · fixed ≤ 90 hari' },
  { id: 'mortgage_active_floating', label: 'KPR aktif · sudah floating' },
  { id: 'mortgage_partial_property', label: 'KPR aktif · nilai properti kosong' },
  { id: 'mortgage_partial_rate', label: 'KPR aktif · estimasi floating kosong' },
  { id: 'takeover_no_break_even', label: 'KPR aktif bunga rendah (Take Over tanpa break-even)' },
  { id: 'takeover_in_process', label: 'Take Over diproses bank' },
]

const USER = { id: 'usr_01J8Z0Y5MA6W2Q9T4P7K3R1CDE', name: 'Firdi Audi', contact: '081234567890', contactType: 'phone' }

export const PROFILE_FULL = {
  fullName: 'Firdi Audi',
  nik: '3174012345678901',
  birthPlace: 'Bekasi',
  birthDate: '1996-04-12',
  gender: 'male',
  maritalStatus: 'single',
  address: 'Jl. Melati No. 12, Jaka Setia, Bekasi Selatan, Kota Bekasi',
  phone: '081234567890',
  email: 'firdi.audi@email.com',
  occupation: 'private_employee',
  companyName: 'PT Nusantara Digital',
  jobTitle: 'Product Designer',
  workYears: 4,
  workMonths: 6,
}

const FINANCE = { monthlyIncome: 15_000_000, jointIncome: false, partnerIncome: null, vehicleDebt: 1_000_000, cardDebt: 500_000, otherDebt: 0, routineExpenses: 5_000_000, emergencyFund: 30_000_000 }

const PROPERTY = {
  type: 'landed_house',
  address: 'Griya Asri Blok C2, Bekasi',
  city: 'Kota Bekasi',
  landArea: 72,
  buildingArea: 45,
  certificateType: 'shm',
  certificateOwner: 'Firdi Audi',
  estimatedValue: 850_000_000,
  valueAsOf: '2026-09-01',
  disputed: false,
  valueLater: false,
}

export const DEFAULT_REMINDERS = { payment: [7, 3, 1], fixedExpiry: [90, 60, 30, 14, 7], channels: { inApp: true, email: true, whatsapp: false } }

function base(scenario, extra = {}) {
  return {
    schemaVersion: SCHEMA_VERSION,
    scenario,
    clock: CLOCK,
    seq: 1000,
    session: { status: 'authenticated', verification: null },
    user: USER,
    profile: { ...PROFILE_FULL },
    finance: { ...FINANCE },
    applications: [],
    mortgages: [],
    simulation: null,
    activities: [],
    flags: {},
    meta: { seededAt: CLOCK, catalogVersion: 'catalog-2026-09' },
    ...extra,
  }
}

const activity = (id, type, category, title, body, occurredAt, action = null, read = true) => ({
  id,
  type,
  category,
  title,
  body,
  occurredAt,
  readAt: read ? occurredAt : null,
  action,
})

// ---- mortgages ----

function mortgageBase({ id = 'mtg_01J8Z1Q6XWF7NE4M2A9K3D5PVT', startDate, productName = 'KPR Fixed 5 Tahun' }) {
  const originalPrincipal = 600_000_000
  const originalTenorMonths = 240
  const dueDay = 22
  const paidMonths = countDueDatesBetween({ startDate, today: CLOCK, dueDay })
  return { id, status: 'active', setupStep: 6, source: 'monitoring', bankName: 'Bank ABC', productName, scheme: 'conventional', originalPrincipal, originalTenorMonths, startDate, dueDay, paidMonths }
}

function fixedMortgage({ startDate, fixedUntil, rateBps = 550, floatingBps = 900, withValue = true, productName }) {
  const b = mortgageBase({ startDate, productName })
  const payment = calculateAnnuityPayment({ principal: b.originalPrincipal, annualRateBps: rateBps, termMonths: b.originalTenorMonths }).payment
  const { outstanding, remainingMonths } = calculateOutstanding({ originalPrincipal: b.originalPrincipal, annualRateBps: rateBps, originalTermMonths: b.originalTenorMonths, paidMonths: b.paidMonths })
  const { paidMonths: _paid, ...rest } = b
  return {
    ...rest,
    currentPayment: payment,
    knowsOutstanding: true,
    outstandingPrincipal: outstanding,
    remainingTenorMonths: remainingMonths,
    outstandingEstimated: false,
    paymentEverChanged: false,
    currentRateBps: rateBps,
    currentRateType: 'fixed',
    fixedUntil,
    estimatedFloatingRateBps: floatingBps,
    rateHistory: [],
    property: withValue ? { ...PROPERTY } : { ...PROPERTY, estimatedValue: null, valueAsOf: null, valueLater: true },
    finance: { ...FINANCE },
    reminders: structuredClone(DEFAULT_REMINDERS),
    payments: [{ id: 'pay_01J8Z28N4H2F6K7Q9M3C5VTWAE', dueDate: '2026-09-22', amount: payment, status: 'paid', paidAt: '2026-09-21', source: 'manual_user_recorded', bankConfirmed: false }],
    version: 7,
    activatedAt: '2026-09-15',
  }
}

// Fixed 5,50% for 60 payments since 2020-07-22, then floating 9,00% (payment reset at the rate change).
function floatingMortgage() {
  const b = mortgageBase({ startDate: '2020-07-22' })
  const fixedPayment = calculateAnnuityPayment({ principal: b.originalPrincipal, annualRateBps: 550, termMonths: 240 }).payment
  const atReset = calculateOutstanding({ originalPrincipal: b.originalPrincipal, annualRateBps: 550, originalTermMonths: 240, paidMonths: 60 }).outstanding
  const floatingPayment = calculateAnnuityPayment({ principal: atReset, annualRateBps: 900, termMonths: 180 }).payment
  const now = calculateOutstanding({ originalPrincipal: atReset, annualRateBps: 900, originalTermMonths: 180, paidMonths: b.paidMonths - 60 })
  const { paidMonths: _paid, ...rest } = b
  return {
    ...rest,
    currentPayment: floatingPayment,
    previousFixedPayment: fixedPayment,
    knowsOutstanding: true,
    outstandingPrincipal: now.outstanding,
    remainingTenorMonths: now.remainingMonths,
    outstandingEstimated: false,
    paymentEverChanged: true,
    currentRateBps: 900,
    currentRateType: 'floating',
    fixedUntil: '2025-07-22',
    estimatedFloatingRateBps: null,
    rateHistory: [
      { id: 'rtp_1', type: 'fixed', rateBps: 550, startDate: '2020-07-22', endDate: '2025-07-22' },
      { id: 'rtp_2', type: 'floating', rateBps: 900, startDate: '2025-07-23', endDate: null },
    ],
    property: { ...PROPERTY },
    finance: { ...FINANCE },
    reminders: { ...structuredClone(DEFAULT_REMINDERS), fixedExpiry: [] },
    payments: [{ id: 'pay_01J8Z28N4H2F6K7Q9M3C5VTWAE', dueDate: '2026-09-22', amount: floatingPayment, status: 'paid', paidAt: '2026-09-21', source: 'manual_user_recorded', bankConfirmed: false }],
    version: 7,
    activatedAt: '2026-09-15',
  }
}

function mortgageActivities(m, withWarning) {
  return [
    activity('act_0003', 'payment_reminder_scheduled', 'reminder', 'Reminder pembayaran dijadwalkan', 'Kami akan mengingatkan pembayaran H-7 pada 15 Oktober 2026.', '2026-09-28T02:00:00.000Z', { label: 'Lihat pembayaran', route: '/my-kpr/payment' }, false),
    ...(withWarning
      ? [activity('act_0002', 'fixed_expiry_warning', 'warning', 'Fixed rate berakhir dalam 90 hari', 'Lihat estimasi dampak ke cicilan kamu.', '2026-09-23T02:00:00.000Z', { label: 'Lihat dampak', route: '/my-kpr/rate' }, false)]
      : []),
    activity('act_0001', 'mortgage_monitoring_activated', 'mortgage', 'Pemantauan KPR diaktifkan', `${m.bankName} · ${m.productName}`, '2026-09-15T03:00:00.000Z'),
  ]
}

// ---- applications ----

const PRIMARY_DATA = {
  personal: {
    fullName: PROFILE_FULL.fullName,
    nik: PROFILE_FULL.nik,
    birthPlace: PROFILE_FULL.birthPlace,
    birthDate: PROFILE_FULL.birthDate,
    gender: PROFILE_FULL.gender,
    maritalStatus: PROFILE_FULL.maritalStatus,
    address: PROFILE_FULL.address,
    phone: PROFILE_FULL.phone,
    email: PROFILE_FULL.email,
  },
  employment: {
    occupation: 'private_employee',
    companyName: 'PT Nusantara Digital',
    jobTitle: 'Product Designer',
    workYears: 4,
    workMonths: 6,
    monthlyIncome: 15_000_000,
    jointIncome: false,
    partnerIncome: null,
    vehicleDebt: 1_000_000,
    cardDebt: 500_000,
    otherDebt: 0,
  },
  property: {
    purchaseType: 'new_from_developer',
    developerName: 'PT Griya Asri Sejahtera',
    sellerName: null,
    propertyType: 'landed_house',
    address: 'Rumah Griya Asri Blok C2 No. 8, Bekasi',
    city: 'Kota Bekasi',
    price: 500_000_000,
  },
  loan: { downPayment: 100_000_000, amount: 400_000_000, amountEdited: false, tenorMonths: 240, savings: null },
}

const uploadedDoc = (type, fileName, status = 'uploaded') => ({ status, fileName, sizeBytes: 842_115, contentType: fileName.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg', uploadedAt: '2026-09-18', invalidReason: null })

const PRIMARY_DOCS = (status = 'uploaded') => ({
  ktp: uploadedDoc('ktp', 'ktp-firdi-audi.jpg', status),
  npwp: uploadedDoc('npwp', 'npwp-firdi-audi.pdf', status),
  income_proof: uploadedDoc('income_proof', 'slip-gaji-jul-sep-2026.pdf', status),
  property_document: uploadedDoc('property_document', 'ppjb-griya-asri-c2.pdf', status),
})

function selectionFor(productId, loanAmount, tenorMonths) {
  const product = BANK_PRODUCTS.find((p) => p.id === productId)
  const sim = simulateLoan({ product, principal: loanAmount, termMonths: tenorMonths })
  return {
    bankProductId: product.id,
    productVersion: product.version,
    bankName: product.bank.name,
    bankMark: product.bank.mark,
    productName: product.name,
    fixedRateBps: sim.fixedRateBps,
    fixedMonths: sim.fixedMonths,
    floatingRateBps: sim.floatingRateBps,
    loanAmount,
    tenorMonths,
    estimatedPayment: sim.payment,
    paymentAfterFixed: sim.paymentAfterFixed,
    totalPayment: sim.totalPayment,
  }
}

function primaryApplication({ id = 'app_01J8Z19RZ4VE4Q2AB7M5N8XKCF', status, currentStep, data = PRIMARY_DATA, documents = {}, selection = null, history = [], extra = {} }) {
  const app = {
    id,
    productType: 'primary',
    optimizationMode: null,
    source: 'cold',
    mortgageId: null,
    status,
    currentStep,
    stepCount: 7,
    data: structuredClone(data),
    documents,
    selection,
    consents: null,
    snapshot: null,
    statusHistory: history,
    pendingActions: [],
    rejection: null,
    excludedProductIds: [],
    superseded: false,
    version: 3,
    createdAt: '2026-09-16T08:00:00.000Z',
    updatedAt: '2026-09-28T07:30:00.000Z',
    submittedAt: null,
    ...extra,
  }
  app.requiredDocuments = requiredDocuments(app)
  return app
}

function submittedPrimary(status, extra = {}) {
  const selection = selectionFor('bpr_abc_primary_fix5_v4', 400_000_000, 240)
  const history = [
    { status: 'submitted', at: '2026-09-20T09:00:00.000Z' },
    { status: 'docs_verification', at: '2026-09-22T03:00:00.000Z' },
    ...(status === 'bank_processing' || status === 'rejected' ? [{ status: 'bank_processing', at: '2026-09-25T02:00:00.000Z' }] : []),
    ...(status === 'additional_docs_requested' ? [{ status: 'additional_docs_requested', at: '2026-09-26T02:00:00.000Z' }] : []),
    ...(status === 'rejected' ? [{ status: 'rejected', at: '2026-09-27T04:00:00.000Z' }] : []),
  ]
  return primaryApplication({
    status,
    currentStep: 7,
    documents: PRIMARY_DOCS('verified'),
    selection,
    history,
    extra: {
      submittedAt: '2026-09-20T09:00:00.000Z',
      consents: { dataAccuracy: true, sendToBank: true, acceptedAt: '2026-09-20T09:00:00.000Z' },
      snapshot: { data: structuredClone(PRIMARY_DATA), selection, calculationVersion: 'calc-1.0.0', capturedAt: '2026-09-20T09:00:00.000Z' },
      ...extra,
    },
  })
}

function takeoverInProcess(mortgage) {
  const product = BANK_PRODUCTS.find((p) => p.id === 'bpr_xyz_takeover_fix5_v3')
  const sim = simulateLoan({ product, principal: mortgage.outstandingPrincipal, termMonths: 180 })
  const app = {
    id: 'app_01J8Z7TK0VER4Q2AB7M5N8XKCF',
    productType: 'takeover',
    optimizationMode: 'takeover',
    source: 'mortgage',
    mortgageId: mortgage.id,
    status: 'bank_processing',
    currentStep: 7,
    stepCount: 7,
    data: {
      personal: { ...PRIMARY_DATA.personal },
      employment: { ...PRIMARY_DATA.employment },
      oldLoan: {
        bankName: mortgage.bankName,
        productName: mortgage.productName,
        originalPrincipal: mortgage.originalPrincipal,
        currentPayment: mortgage.currentPayment,
        originalTenorMonths: mortgage.originalTenorMonths,
        startDate: mortgage.startDate,
        dueDay: mortgage.dueDay,
        paymentEverChanged: true,
        outstanding: mortgage.outstandingPrincipal,
        rateBps: mortgage.currentRateBps,
        rateType: mortgage.currentRateType,
        fixedUntil: null,
        floatingRateBps: null,
        remainingMonths: mortgage.remainingTenorMonths,
        penaltyBps: null,
        source: 'official',
      },
      goal: { mode: 'takeover', goal: 'lower_payment', tenorMonths: 180, maxPayment: null, requestedTopup: 0, purpose: null },
      property: { propertyType: 'landed_house', city: PROPERTY.city, address: PROPERTY.address, landArea: 72, buildingArea: 45, certificateType: 'shm', certificateOwner: 'Firdi Audi', estimatedValue: PROPERTY.estimatedValue, disputed: false },
      finance: { vehicleDebt: 1_000_000, cardDebt: 500_000, otherDebt: 0, fundsForCosts: 25_000_000 },
    },
    documents: {},
    selection: {
      bankProductId: product.id,
      productVersion: product.version,
      bankName: product.bank.name,
      bankMark: product.bank.mark,
      productName: product.name,
      fixedRateBps: sim.fixedRateBps,
      fixedMonths: sim.fixedMonths,
      floatingRateBps: sim.floatingRateBps,
      loanAmount: mortgage.outstandingPrincipal,
      tenorMonths: 180,
      estimatedPayment: sim.payment,
      paymentAfterFixed: sim.paymentAfterFixed,
      totalPayment: sim.totalPayment,
    },
    consents: { dataAccuracy: true, sendToBank: true, acceptedAt: '2026-09-24T09:00:00.000Z' },
    snapshot: null,
    statusHistory: [
      { status: 'submitted', at: '2026-09-24T09:00:00.000Z' },
      { status: 'docs_verification', at: '2026-09-25T03:00:00.000Z' },
      { status: 'bank_processing', at: '2026-09-27T02:00:00.000Z' },
    ],
    pendingActions: [],
    rejection: null,
    excludedProductIds: [],
    superseded: false,
    version: 6,
    createdAt: '2026-09-22T08:00:00.000Z',
    updatedAt: '2026-09-27T02:00:00.000Z',
    submittedAt: '2026-09-24T09:00:00.000Z',
  }
  app.requiredDocuments = requiredDocuments(app)
  app.documents = Object.fromEntries(app.requiredDocuments.filter((d) => d.required).map((d) => [d.type, uploadedDoc(d.type, `${d.type.replaceAll('_', '-')}.pdf`, 'verified')]))
  app.snapshot = { data: structuredClone(app.data), selection: app.selection, calculationVersion: 'calc-1.0.0', capturedAt: app.submittedAt }
  return app
}

const warningMortgage = () => fixedMortgage({ startDate: '2021-12-22', fixedUntil: '2026-12-22' })
const normalMortgage = (opts = {}) => fixedMortgage({ startDate: '2022-04-22', fixedUntil: '2027-04-22', ...opts })

export function createSeed(scenario = 'guest') {
  switch (scenario) {
    case 'guest':
      return base(scenario, { session: { status: 'guest', verification: null }, user: null, profile: {}, finance: {} })
    case 'fresh':
      // A new account: only what registration collected. No finance until the user types it.
      return base(scenario, { profile: { fullName: USER.name, phone: USER.contact }, finance: {} })
    case 'application_primary_draft_step_3':
      return base(scenario, {
        applications: [primaryApplication({ status: 'draft', currentStep: 3, data: { ...PRIMARY_DATA, property: { purchaseType: 'new_from_developer' }, loan: {} } })],
      })
    case 'upload_failure':
      return base(scenario, { flags: { uploadFailOnce: true, failedUploads: [] }, applications: [primaryApplication({ status: 'draft', currentStep: 5 })] })
    case 'no_bank_matches':
      return base(scenario, {
        applications: [primaryApplication({ status: 'draft', currentStep: 6, documents: PRIMARY_DOCS(), data: { ...PRIMARY_DATA, employment: { ...PRIMARY_DATA.employment, monthlyIncome: 3_000_000, vehicleDebt: 0, cardDebt: 0 } } })],
      })
    case 'stale_catalog':
      return base(scenario, { flags: { staleProducts: { bpr_abc_primary_fix5_v4: '2026-07-15' } }, applications: [primaryApplication({ status: 'draft', currentStep: 6, documents: PRIMARY_DOCS() })] })
    case 'application_in_process':
      return base(scenario, {
        applications: [submittedPrimary('bank_processing')],
        activities: [
          activity('act_0102', 'application_status_changed', 'application', 'Pengajuan masuk proses bank', 'Bank ABC sedang menganalisis pengajuan kamu.', '2026-09-25T02:00:00.000Z', { label: 'Lihat status', route: '/my-kpr/application' }, false),
          activity('act_0101', 'application_submitted', 'application', 'Pengajuan terkirim ke Bank ABC', 'KPR Primary · KPR Fixed 5 Tahun', '2026-09-20T09:00:00.000Z', { label: 'Lihat status', route: '/my-kpr/application' }),
        ],
      })
    case 'application_additional_docs': {
      const app = submittedPrimary('additional_docs_requested', {
        pendingActions: [{ id: 'pa_1', type: 'document_update', documentType: 'income_proof', message: 'Slip gaji 3 bulan terakhir belum lengkap.', requestedAt: '2026-09-26T02:00:00.000Z' }],
      })
      app.documents.income_proof = { ...app.documents.income_proof, status: 'needs_update', invalidReason: 'Slip gaji Agustus belum ada.' }
      return base(scenario, {
        applications: [app],
        activities: [activity('act_0103', 'additional_document_requested', 'application', 'Bank minta dokumen tambahan', 'Slip gaji 3 bulan terakhir belum lengkap.', '2026-09-26T02:00:00.000Z', { label: 'Upload sekarang', route: '/my-kpr/application' }, false)],
      })
    }
    case 'application_rejected_dti':
      return base(scenario, {
        applications: [
          submittedPrimary('rejected', {
            rejection: { code: 'DTI_ABOVE_BANK_POLICY', displayReason: 'Rasio cicilan melebihi batas bank (cicilan > 35% penghasilan).', relevantStep: 2, rejectedAt: '2026-09-27T04:00:00.000Z' },
          }),
        ],
        activities: [activity('act_0104', 'application_rejected', 'application', 'Pengajuan ke Bank ABC belum disetujui', 'Rasio cicilan melebihi batas bank.', '2026-09-27T04:00:00.000Z', { label: 'Lihat pilihan', route: '/my-kpr/application' }, false)],
      })
    case 'mortgage_setup_step_3': {
      const m = warningMortgage()
      return base(scenario, {
        mortgages: [{ ...m, status: 'draft', setupStep: 3, property: null, finance: null, reminders: null, payments: [], activatedAt: null, version: 3 }],
      })
    }
    case 'mortgage_active_normal':
    case 'mortgage_partial_property':
    case 'takeover_no_break_even': {
      const m =
        scenario === 'takeover_no_break_even'
          ? normalMortgage({ rateBps: 450, productName: 'KPR Fixed 5 Tahun (promo)' })
          : normalMortgage({ withValue: scenario !== 'mortgage_partial_property' })
      return base(scenario, { mortgages: [m], activities: mortgageActivities(m, false) })
    }
    case 'mortgage_partial_rate': {
      const m = { ...warningMortgage(), estimatedFloatingRateBps: null }
      return base(scenario, { mortgages: [m], activities: mortgageActivities(m, true) })
    }
    case 'mortgage_active_h90': {
      const m = warningMortgage()
      return base(scenario, { mortgages: [m], activities: mortgageActivities(m, true) })
    }
    case 'mortgage_active_floating': {
      const m = floatingMortgage()
      return base(scenario, { mortgages: [m], activities: mortgageActivities(m, false) })
    }
    case 'takeover_in_process': {
      const m = floatingMortgage()
      return base(scenario, {
        mortgages: [m],
        applications: [takeoverInProcess(m)],
        activities: [
          activity('act_0201', 'application_submitted', 'application', 'Pengajuan Take Over terkirim ke Bank XYZ', 'Take Over Fixed 5 Tahun', '2026-09-24T09:00:00.000Z', { label: 'Lihat status', route: '/my-kpr/application' }),
          ...mortgageActivities(m, false),
        ],
      })
    }
    default:
      return createSeed('guest')
  }
}
