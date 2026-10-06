// Mock implementation of the API contract (doc 04). Async like a real backend, persists through mockDb,
// throws ApiError for expected failures. Financial math comes from src/calculations — never inline here.
import { addMonths, daysUntil, nextDueDate, parseIsoDate } from '@/calculations/dates'
import { CalculationError, calculateMaxPrincipal } from '@/calculations/finance'
import { comparePrimaryPrograms, compareTakeoverPrograms, evaluateTakeoverProduct, isAvailable, primaryAffordability, simulateLoan, takeoverBaseline } from '@/calculations/programs'
import { normalizeLayout } from '@/domains/home/dashboardLayout'
import { IN_PROCESS, activeApplication } from '@/domains/home/selectHomeState'
import { nextMilestone, rateMode } from '@/domains/mortgages/derive'
import { defaultTakeoverGoal, takeoverDataFromMortgage, takeoverGaps } from '@/domains/optimize/validation'
import { ApiError } from './apiError'
import { ARTICLES } from './articles'
import { BANK_PRODUCTS } from './catalog'
import { ACCEPTED_EXTENSIONS, DOC_LABELS, MAX_FILE_BYTES, requiredDocuments } from './documentRules'
import { loadDb, resetDb, saveDb } from './mockDb'
import { DEFAULT_REMINDERS, SCENARIOS, createSeed } from './seed'
import { TOURS } from './tours'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const clone = (x) => (x === undefined ? x : structuredClone(x))
const fail = (code, message, status = 400, extra = {}) => {
  throw new ApiError({ code, message, ...extra }, { status })
}
const nowIso = (db) => `${db.clock}T${new Date().toISOString().slice(11)}`
const nextId = (db, prefix) => `${prefix}_${String((db.seq += 1)).padStart(6, '0')}`

const OTP_OK = '148260'
const OTP_WRONG = '000000'
const OTP_EXPIRED = '999999'
const OTP_COOLDOWN_MS = 60_000

const PRIMARY_FLOW = ['submitted', 'docs_verification', 'bank_processing', 'appraisal', 'approved', 'akad', 'disbursed']
const TAKEOVER_FLOW = ['submitted', 'docs_verification', 'bank_processing', 'appraisal', 'approved', 'old_mortgage_settlement', 'akad', 'disbursed']
const CANCELLABLE = ['draft', 'submitted', 'docs_verification', 'additional_docs_requested', 'bank_processing', 'appraisal']

const STATUS_COPY = {
  docs_verification: ['Dokumen sedang diverifikasi', 'Tim kami memeriksa kelengkapan dokumen kamu.'],
  bank_processing: ['Pengajuan masuk proses bank', 'Bank sedang menganalisis pengajuan kamu.'],
  appraisal: ['Appraisal properti dijadwalkan', 'Penilai dari bank akan menghubungi kamu.'],
  approved: ['Pengajuan disetujui', 'Angka final mengikuti offering letter dari bank.'],
  old_mortgage_settlement: ['Pelunasan KPR lama berjalan', 'Tetap bayar cicilan bank lama sampai ada konfirmasi pelunasan resmi.'],
  akad: ['Jadwal akad tersedia', 'Tanda tangani akad sesuai jadwal dari bank.'],
  disbursed: ['Pengajuan selesai', 'KPR baru kamu sudah aktif.'],
}

// ---------- dev-only failure injection (doc 04 §22.4) ----------
const failures = new Map()
function maybeFail(name) {
  const f = failures.get(name)
  if (!f) return
  failures.delete(name)
  fail(f.code, f.message, f.status, { retryable: f.retryable })
}

// ---------- helpers ----------
const isPhone = (v) => /^(\+62|62|0)8\d{7,12}$/.test(String(v).replace(/[\s-]/g, ''))
const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v).trim())
function maskContact(contact, type) {
  if (type === 'email') {
    const [name, domain] = contact.split('@')
    return `${name.slice(0, 2)}***@${domain}`
  }
  const d = contact.replace(/\D/g, '').replace(/^(62|0)/, '')
  return `+62 ${d.slice(0, 3)} **** ${d.slice(-4)}`
}

function productsOf(db) {
  const stale = db.flags?.staleProducts ?? {}
  return BANK_PRODUCTS.map((p) => (stale[p.id] ? { ...p, lastVerifiedAt: stale[p.id] } : p))
}

function pushActivity(db, { type, category, title, body, action = null }) {
  db.activities.unshift({ id: nextId(db, 'act'), type, category, title, body, occurredAt: nowIso(db), readAt: null, action })
}

// null until the user customises the Home board; until then the board follows the default for their data.
const savedLayout = (db) => (Array.isArray(db.dashboardLayout) ? normalizeLayout(db.dashboardLayout) : null)

function decorate(app) {
  app.requiredDocuments = requiredDocuments(app)
  return app
}

function findApp(db, id) {
  const app = db.applications.find((a) => a.id === id)
  if (!app) fail('RESOURCE_NOT_FOUND', 'Pengajuan tidak ditemukan.', 404)
  return app
}

function findMortgage(db, id) {
  const m = db.mortgages.find((x) => x.id === id)
  if (!m) fail('RESOURCE_NOT_FOUND', 'Data KPR tidak ditemukan.', 404)
  return m
}

const activeMortgageOf = (db) => db.mortgages.find((m) => m.status === 'active') ?? null
const touch = (db, entity) => {
  entity.version = (entity.version ?? 0) + 1
  entity.updatedAt = nowIso(db)
}

// Profile part of the Primary input (steps 1–2): enough for the affordability milestone.
function profileInput(app) {
  const { employment: e = {}, personal = {} } = app.data
  if (!(e.monthlyIncome > 0)) fail('CALCULATION_INPUT_INCOMPLETE', 'Penghasilan bulanan belum diisi.', 400)
  return {
    occupation: e.occupation,
    birthDate: personal.birthDate,
    monthlyIncome: e.monthlyIncome + (e.jointIncome ? e.partnerIncome ?? 0 : 0),
    existingDebt: (e.vehicleDebt ?? 0) + (e.cardDebt ?? 0) + (e.otherDebt ?? 0),
  }
}

function primaryInput(app) {
  const { employment: e = {}, property: p = {}, loan: l = {} } = app.data
  if (!(e.monthlyIncome > 0) || !(p.price > 0) || !(l.amount > 0) || !(l.tenorMonths > 0)) {
    fail('CALCULATION_INPUT_INCOMPLETE', 'Lengkapi data pinjaman dan penghasilan dulu.', 400)
  }
  return { loanAmount: l.amount, tenorMonths: l.tenorMonths, propertyPrice: p.price, propertyType: p.propertyType, ...profileInput(app) }
}

// What prices or qualifies a program (profileInput, primaryInput, simulationSource): a change drops the chosen program.
// KTP data, company and job title keep it.
function pricingInputs(app) {
  const { employment: e = {}, finance: f = {}, property: p = {} } = app.data
  return JSON.stringify([
    app.data.loan,
    p.price,
    p.estimatedValue,
    p.disputed,
    app.data.oldLoan,
    app.data.goal,
    app.productType === 'primary' ? e.occupation : null,
    (e.monthlyIncome ?? 0) + (e.jointIncome ? e.partnerIncome ?? 0 : 0),
    (e.vehicleDebt ?? 0) + (e.cardDebt ?? 0) + (e.otherDebt ?? 0),
    (f.vehicleDebt ?? 0) + (f.cardDebt ?? 0) + (f.otherDebt ?? 0),
  ])
}

function selectionFrom(product, fields) {
  return { bankProductId: product.id, productVersion: product.version, bankName: product.bank.name, bankMark: product.bank.mark, productName: product.name, ...fields }
}

function prefilledPersonal(db) {
  const p = db.profile ?? {}
  return { fullName: p.fullName ?? db.user?.name ?? '', nik: p.nik ?? '', birthPlace: p.birthPlace ?? '', birthDate: p.birthDate ?? '', gender: p.gender ?? '', maritalStatus: p.maritalStatus ?? '', address: p.address ?? '', phone: p.phone ?? '', email: p.email ?? '' }
}

function prefilledEmployment(db) {
  const p = db.profile ?? {}
  const f = db.finance ?? {}
  return {
    occupation: p.occupation ?? '',
    companyName: p.companyName ?? '',
    jobTitle: p.jobTitle ?? '',
    workYears: p.workYears ?? null,
    workMonths: p.workMonths ?? null,
    monthlyIncome: f.monthlyIncome ?? null,
    jointIncome: f.jointIncome ?? false,
    partnerIncome: f.partnerIncome ?? null,
    vehicleDebt: f.vehicleDebt ?? null,
    cardDebt: f.cardDebt ?? null,
    otherDebt: f.otherDebt ?? null,
  }
}

// Reusable profile data is kept on the profile; applications keep their own snapshot on submit.
// The setup asks cicilan, bunga and sisa tenor, never sisa pokok. The estimate lives here, the one place every
// writer goes through, and is redone only when one of its inputs changed, so older estimates stay stable.
// An official figure (outstandingEstimated === false) wins until the user clears it.
const OUTSTANDING_INPUTS = ['currentPayment', 'currentRateBps', 'remainingTenorMonths']
function applyMortgageRules(m, before) {
  if (m.currentRateType !== 'fixed') {
    m.fixedUntil = null
    m.estimatedFloatingRateBps = null
  }
  if (m.outstandingEstimated === false && m.outstandingPrincipal > 0) return
  if (!OUTSTANDING_INPUTS.some((k) => before[k] !== m[k]) && m.outstandingPrincipal != null) return
  const ready = m.currentPayment > 0 && m.currentRateBps > 0 && m.remainingTenorMonths > 0 && m.scheme !== 'sharia'
  m.outstandingPrincipal = ready ? calculateMaxPrincipal({ payment: m.currentPayment, annualRateBps: m.currentRateBps, termMonths: m.remainingTenorMonths }) : null
  m.outstandingEstimated = ready ? true : null
}

function syncProfile(db, values) {
  const { personal, employment } = values
  if (personal) db.profile = { ...db.profile, ...personal }
  if (employment) {
    const { occupation, companyName, jobTitle, workYears, workMonths, ...money } = employment
    db.profile = { ...db.profile, ...Object.fromEntries(Object.entries({ occupation, companyName, jobTitle, workYears, workMonths }).filter(([, v]) => v !== undefined)) }
    db.finance = { ...db.finance, ...Object.fromEntries(Object.entries(money).filter(([, v]) => v !== undefined)) }
  }
}

function newApplication(db, { productType, mode = null, source = 'cold', mortgageId = null, data }) {
  const app = {
    id: nextId(db, 'app'),
    productType,
    optimizationMode: productType === 'takeover' ? mode ?? 'takeover' : null,
    source,
    mortgageId,
    status: 'draft',
    currentStep: 1,
    stepCount: 7,
    data,
    documents: {},
    selection: null,
    consents: null,
    snapshot: null,
    statusHistory: [],
    pendingActions: [],
    rejection: null,
    excludedProductIds: [],
    superseded: false,
    version: 1,
    createdAt: nowIso(db),
    updatedAt: nowIso(db),
    submittedAt: null,
  }
  db.applications.unshift(app)
  return decorate(app)
}

function mortgageFromApplication(db, app, base = {}) {
  const s = app.selection
  const start = db.clock
  const dueDay = parseIsoDate(start).day
  const d = app.data
  const e = d.employment ?? {}
  const f = d.finance ?? {}
  return {
    id: nextId(db, 'mtg'),
    status: 'active',
    setupStep: 6,
    source: 'application',
    applicationId: app.id,
    bankName: s.bankName,
    productName: s.productName,
    scheme: 'conventional',
    originalPrincipal: s.loanAmount,
    originalTenorMonths: s.tenorMonths,
    startDate: start,
    dueDay,
    currentPayment: s.estimatedPayment,
    knowsOutstanding: true,
    outstandingPrincipal: s.loanAmount,
    remainingTenorMonths: s.tenorMonths,
    outstandingEstimated: false,
    paymentEverChanged: false,
    currentRateBps: s.fixedRateBps,
    currentRateType: 'fixed',
    fixedUntil: addMonths(start, s.fixedMonths, dueDay),
    estimatedFloatingRateBps: s.floatingRateBps,
    rateHistory: [],
    property: base.property ?? {
      type: d.property?.propertyType ?? 'landed_house',
      address: d.property?.address ?? '',
      city: d.property?.city ?? '',
      landArea: d.property?.landArea ?? null,
      buildingArea: d.property?.buildingArea ?? null,
      certificateType: d.property?.certificateType ?? null,
      certificateOwner: d.property?.certificateOwner ?? d.personal?.fullName ?? '',
      estimatedValue: d.property?.price ?? d.property?.estimatedValue ?? null,
      valueAsOf: db.clock,
      disputed: false,
      valueLater: false,
    },
    finance: base.finance ?? {
      monthlyIncome: e.monthlyIncome ?? db.finance?.monthlyIncome ?? null,
      jointIncome: e.jointIncome ?? false,
      partnerIncome: e.partnerIncome ?? null,
      vehicleDebt: e.vehicleDebt ?? f.vehicleDebt ?? 0,
      cardDebt: e.cardDebt ?? f.cardDebt ?? 0,
      otherDebt: e.otherDebt ?? f.otherDebt ?? 0,
      routineExpenses: null,
      emergencyFund: null,
    },
    reminders: base.reminders ?? structuredClone(DEFAULT_REMINDERS),
    payments: [],
    version: 1,
    activatedAt: nowIso(db),
  }
}

// Disbursement converts final akad terms into an active mortgage (doc 04 §23), never simulation values.
function completeApplication(db, app) {
  if (app.productType === 'takeover') {
    const old = app.mortgageId ? db.mortgages.find((m) => m.id === app.mortgageId) : activeMortgageOf(db)
    if (old) old.status = 'replaced'
    db.mortgages.unshift(mortgageFromApplication(db, app, old ? { property: old.property, finance: old.finance, reminders: old.reminders } : {}))
    pushActivity(db, { type: 'application_completed', category: 'application', title: 'Take Over selesai', body: `KPR baru di ${app.selection.bankName} aktif. Pemantauan memakai data final akad.`, action: { label: 'Lihat KPR', route: '/my-kpr/overview' } })
    return
  }
  if (activeMortgageOf(db)) {
    pushActivity(db, { type: 'application_completed', category: 'application', title: 'Pengajuan selesai', body: 'KPR baru belum dipantau otomatis karena MVP mendukung satu KPR aktif per akun.' })
    return
  }
  db.mortgages.unshift(mortgageFromApplication(db, app))
  pushActivity(db, { type: 'application_completed', category: 'application', title: 'KPR kamu sudah aktif', body: `${app.selection.bankName} · ${app.selection.productName}. Reminder pembayaran otomatis aktif.`, action: { label: 'Lihat KPR', route: '/my-kpr/overview' } })
}

function simulationSource(db, source) {
  if (source.type === 'application') {
    const app = findApp(db, source.id)
    const o = app.data.oldLoan ?? {}
    const g = app.data.goal ?? {}
    const p = app.data.property ?? {}
    const f = app.data.finance ?? {}
    const e = app.data.employment ?? {}
    return {
      oldBank: { name: o.bankName, productName: o.productName, estimated: o.source === 'estimate' },
      loan: { outstanding: o.outstanding, rateBps: o.rateBps, rateType: o.rateType, fixedUntil: o.fixedUntil, floatingRateBps: o.floatingRateBps, remainingMonths: o.remainingMonths, currentPayment: o.currentPayment, penaltyBps: o.penaltyBps, dueDay: o.dueDay },
      goal: g,
      propertyValue: p.estimatedValue ?? null,
      disputed: p.disputed === true,
      monthlyIncome: (e.monthlyIncome ?? 0) + (e.jointIncome ? e.partnerIncome ?? 0 : 0),
      otherDebt: (f.vehicleDebt ?? 0) + (f.cardDebt ?? 0) + (f.otherDebt ?? 0),
      excludedProductIds: app.excludedProductIds ?? [],
    }
  }
  const m = findMortgage(db, source.id)
  const f = m.finance ?? {}
  return {
    oldBank: { name: m.bankName, productName: m.productName, estimated: m.outstandingEstimated },
    loan: { outstanding: m.outstandingPrincipal, rateBps: m.currentRateBps, rateType: m.currentRateType, fixedUntil: m.fixedUntil, floatingRateBps: m.estimatedFloatingRateBps, remainingMonths: m.remainingTenorMonths, currentPayment: m.currentPayment, penaltyBps: null, dueDay: m.dueDay },
    propertyValue: m.property?.estimatedValue ?? null,
    disputed: m.property?.disputed === true,
    monthlyIncome: (f.monthlyIncome ?? 0) + (f.jointIncome ? f.partnerIncome ?? 0 : 0),
    otherDebt: (f.vehicleDebt ?? 0) + (f.cardDebt ?? 0) + (f.otherDebt ?? 0),
    excludedProductIds: [],
  }
}

function runSimulation(db, sim, sort) {
  const src = simulationSource(db, sim.source)
  const l = src.loan
  if (!(l.outstanding > 0) || !(l.remainingMonths > 0) || !(l.rateBps > 0) || !(l.currentPayment > 0)) {
    fail('CALCULATION_INPUT_INCOMPLETE', 'Data KPR lama belum lengkap untuk simulasi.', 400)
  }
  if (!(src.monthlyIncome > 0)) fail('CALCULATION_INPUT_INCOMPLETE', 'Penghasilan bulanan belum diisi.', 400)
  const input = {
    mode: sim.input.mode,
    goal: sim.input.goal,
    tenorMonths: sim.input.tenorMonths,
    requestedTopup: sim.input.mode === 'topup' ? sim.input.requestedTopup ?? 0 : 0,
    purpose: sim.input.purpose ?? null,
    maxPayment: sim.input.maxPayment ?? null,
    propertyValue: src.propertyValue,
    disputed: src.disputed,
    monthlyIncome: src.monthlyIncome,
    otherDebt: src.otherDebt,
  }
  try {
    const baseline = takeoverBaseline({ ...l, asOf: db.clock })
    const comparison = compareTakeoverPrograms({ products: productsOf(db), baseline, input, asOf: db.clock, sort })
    return { id: sim.id, source: sim.source, oldBank: src.oldBank, input, baseline, excludedProductIds: src.excludedProductIds, ...comparison }
  } catch (e) {
    if (e instanceof CalculationError) fail('CALCULATION_FAILED', e.message, 400)
    throw e
  }
}

// ---------- adapter ----------
export function createMockApi({ latencyMs = 300 } = {}) {
  const call =
    (name, fn, { auth = true } = {}) =>
    async (...args) => {
      if (latencyMs) await sleep(latencyMs)
      maybeFail(name)
      const db = loadDb()
      if (auth && db.session.status !== 'authenticated') fail('AUTH_REQUIRED', 'Sesi berakhir. Silakan masuk lagi.', 401)
      const result = fn(db, ...args)
      saveDb(db)
      return clone(result)
    }

  return {
    auth: {
      getSession: call(
        'auth.getSession',
        (db) => ({ status: db.session.status, user: db.user, verification: db.session.verification ? { maskedDestination: db.session.verification.maskedDestination, resendAvailableAt: db.session.verification.resendAvailableAt } : null }),
        { auth: false },
      ),
      register: call(
        'auth.register',
        (db, { name, contact, acceptTerms, acceptPrivacy }) => {
          const fieldErrors = []
          if (String(name ?? '').trim().length < 3) fieldErrors.push({ field: 'name', message: 'Nama minimal 3 huruf.' })
          if (!isPhone(contact) && !isEmail(contact)) fieldErrors.push({ field: 'contact', message: 'Masukkan nomor WhatsApp (08…) atau email yang valid.' })
          if (!acceptTerms || !acceptPrivacy) fieldErrors.push({ field: 'consent', message: 'Setujui Syarat & Ketentuan dan Kebijakan Privasi.' })
          if (fieldErrors.length) fail('VALIDATION_FAILED', 'Periksa kembali data kamu.', 400, { fieldErrors })
          const contactType = isEmail(contact) ? 'email' : 'phone'
          const value = contactType === 'email' ? contact.trim().toLowerCase() : contact.replace(/[\s-]/g, '')
          db.session = {
            status: 'pending',
            verification: {
              id: nextId(db, 'ver'),
              name: name.trim(),
              contact: value,
              contactType,
              maskedDestination: maskContact(value, contactType),
              resendAvailableAt: Date.now() + OTP_COOLDOWN_MS,
              attemptsRemaining: 5,
              consents: [
                { type: 'terms', version: '2026-09-01', acceptedAt: nowIso(db) },
                { type: 'privacy', version: '2026-09-01', acceptedAt: nowIso(db) },
              ],
            },
          }
          return { maskedDestination: db.session.verification.maskedDestination, resendAvailableAt: db.session.verification.resendAvailableAt }
        },
        { auth: false },
      ),
      verifyOtp: call(
        'auth.verifyOtp',
        (db, { otp }) => {
          const v = db.session.verification
          if (db.session.status !== 'pending' || !v) fail('INVALID_STATE_TRANSITION', 'Daftar dulu untuk menerima kode.', 400)
          if (!/^\d{6}$/.test(String(otp))) fail('VALIDATION_FAILED', 'Kode harus 6 angka.', 400)
          if (otp === OTP_EXPIRED || v.attemptsRemaining <= 0) fail('OTP_EXPIRED', 'Kode kedaluwarsa. Kirim ulang kode baru.', 401)
          if (otp !== OTP_OK) {
            v.attemptsRemaining -= 1
            saveDb(db)
            fail('OTP_INVALID', otp === OTP_WRONG ? 'Kode salah. Coba lagi.' : 'Kode salah atau kedaluwarsa. Coba lagi.', 401)
          }
          db.user = { id: db.user?.id ?? 'usr_01J8Z0Y5MA6W2Q9T4P7K3R1CDE', name: v.name, contact: v.contact, contactType: v.contactType }
          db.profile = { ...db.profile, fullName: db.profile?.fullName || v.name, [v.contactType === 'email' ? 'email' : 'phone']: v.contact, consents: v.consents }
          db.session = { status: 'authenticated', verification: null }
          return { user: db.user }
        },
        { auth: false },
      ),
      resendOtp: call(
        'auth.resendOtp',
        (db) => {
          const v = db.session.verification
          if (db.session.status !== 'pending' || !v) fail('INVALID_STATE_TRANSITION', 'Daftar dulu untuk menerima kode.', 400)
          const wait = Math.ceil((v.resendAvailableAt - Date.now()) / 1000)
          if (wait > 0) fail('RATE_LIMITED', `Tunggu ${wait} detik untuk kirim ulang.`, 429, { retryable: true, details: { retryAfterSeconds: wait } })
          v.resendAvailableAt = Date.now() + OTP_COOLDOWN_MS
          v.attemptsRemaining = 5
          return { resendAvailableAt: v.resendAvailableAt }
        },
        { auth: false },
      ),
      logout: call(
        'auth.logout',
        (db) => {
          db.session = { status: 'guest', verification: null }
          return { loggedOut: true }
        },
        { auth: false },
      ),
      deleteAccount: call('auth.deleteAccount', (db) => {
        if (db.applications.some((a) => IN_PROCESS.includes(a.status))) fail('INVALID_STATE_TRANSITION', 'Masih ada pengajuan yang sedang diproses bank. Batalkan atau tunggu sampai selesai sebelum menghapus akun.', 400)
        // In place: `call` saves this same object afterwards. Clear first so keys outside the seed (takeoverKept) go too.
        Object.keys(db).forEach((k) => delete db[k])
        Object.assign(db, createSeed('guest'))
        return { deleted: true }
      }),
    },

    dashboard: {
      getSnapshot: call('dashboard.getSnapshot', (db) => ({
        clock: db.clock,
        user: db.user,
        profile: db.profile,
        finance: db.finance,
        applications: db.applications.map(decorate),
        mortgages: db.mortgages,
        simulation: db.simulation,
        unreadActivities: db.activities.filter((a) => !a.readAt).length,
        dashboardLayout: savedLayout(db),
        toursSeen: db.toursSeen ?? [],
      })),
      // null restores the default board; a missing field means the user never customised it.
      saveLayout: call('dashboard.saveLayout', (db, layout) => {
        if (layout !== null && !Array.isArray(layout)) fail('VALIDATION_FAILED', 'Susunan dashboard tidak valid.', 400)
        if (layout === null) delete db.dashboardLayout
        else db.dashboardLayout = normalizeLayout(layout)
        return savedLayout(db)
      }),
      // Page tours auto-run once; the "Panduan" button replays them without touching this list.
      markTourSeen: call('dashboard.markTourSeen', (db, id) => {
        if (!Object.hasOwn(TOURS, id)) fail('VALIDATION_FAILED', 'Panduan tidak dikenal.', 400)
        db.toursSeen = [...new Set([...(db.toursSeen ?? []), id])]
        return db.toursSeen
      }),
    },

    profile: {
      get: call('profile.get', (db) => ({ ...db.profile, finance: db.finance })),
      update: call('profile.update', (db, values) => {
        const { finance, ...profile } = values
        db.profile = { ...db.profile, ...profile }
        if (finance) {
          db.finance = { ...db.finance, ...finance }
          // One source: KPR Health reads the mortgage copy, so keep it in step with the profile.
          for (const m of db.mortgages) if (m.status === 'draft' || m.status === 'active') m.finance = { ...m.finance, ...finance }
        }
        return { ...db.profile, finance: db.finance }
      }),
    },

    applications: {
      get: call('applications.get', (db, id) => decorate(findApp(db, id))),
      create: call('applications.create', (db, { productType, purchaseType, mode, mortgageId }) => {
        const current = activeApplication(db.applications)
        if (current) fail('ACTIVE_DRAFT_EXISTS', 'Kamu masih punya pengajuan aktif. Lanjutkan atau hapus dulu.', 409, { details: { applicationId: current.id } })
        if (productType === 'primary' && activeMortgageOf(db)) {
          fail('ACTIVE_MORTGAGE_EXISTS', 'Versi ini mendukung satu KPR aktif per akun.', 409)
        }
        if (productType === 'takeover' && mortgageId) {
          // Take Over from a monitored KPR with skipped data: prefilled, so it opens the missing forms and then Tujuan.
          const m = findMortgage(db, mortgageId)
          const app = newApplication(db, { productType, mode, source: 'mortgage', mortgageId: m.id, data: takeoverDataFromMortgage(m, { personal: prefilledPersonal(db), employment: prefilledEmployment(db), goal: { mode: mode ?? null } }) })
          app.currentStep = 5
          return app
        }
        // A cancelled Take Over left its old loan, property and finance behind (see cancel): start from them.
        const kept = structuredClone(db.takeoverKept ?? {})
        const data =
          productType === 'primary'
            ? { personal: prefilledPersonal(db), employment: prefilledEmployment(db), property: { purchaseType }, loan: {} }
            : { personal: prefilledPersonal(db), employment: prefilledEmployment(db), oldLoan: kept.oldLoan ?? {}, goal: { mode: mode ?? null }, property: kept.property ?? {}, finance: kept.finance ?? {} }
        return newApplication(db, { productType, mode, data })
      }),
      saveStep: call('applications.saveStep', (db, id, { step, values }) => {
        const app = findApp(db, id)
        if (app.status !== 'draft') fail('INVALID_STATE_TRANSITION', 'Pengajuan sudah dikirim dan hanya bisa dilihat.', 400)
        const before = pricingInputs(app)
        const previousPurchase = app.data.property?.purchaseType
        for (const [section, patch] of Object.entries(values)) app.data[section] = { ...(app.data[section] ?? {}), ...patch }
        if (values.goal?.mode) app.optimizationMode = values.goal.mode
        if (app.productType === 'primary' && previousPurchase && app.data.property.purchaseType !== previousPurchase) {
          app.data.property.developerName = null
          app.data.property.sellerName = null
          delete app.documents.property_document
        }
        if (app.selection && before !== pricingInputs(app)) {
          app.selection = null
          if (app.productType === 'primary') app.currentStep = Math.min(app.currentStep, 6)
        }
        syncProfile(db, values)
        app.currentStep = Math.min(app.stepCount, Math.max(app.currentStep, step + 1))
        touch(db, app)
        return decorate(app)
      }),
      removeDocument: call('applications.removeDocument', (db, id, documentType) => {
        const app = findApp(db, id)
        if (app.status !== 'draft') fail('INVALID_STATE_TRANSITION', 'Dokumen terkirim tidak bisa dihapus.', 400)
        delete app.documents[documentType]
        touch(db, app)
        return decorate(app)
      }),
      // Upload progress happens before the transaction so parallel uploads never overwrite each other.
      uploadDocument: async (id, { documentType, file }, { onProgress } = {}) => {
        if (latencyMs) await sleep(latencyMs / 2)
        if (!ACCEPTED_EXTENSIONS.test(file.name)) fail('FILE_TYPE_UNSUPPORTED', 'Format tidak didukung. Gunakan JPG, PNG, atau PDF.', 415)
        if (file.size > MAX_FILE_BYTES) fail('FILE_TOO_LARGE', 'Ukuran file lebih dari 5MB. Kompres dulu, lalu coba lagi.', 413)
        for (const pct of [20, 45, 70, 90]) {
          if (latencyMs) await sleep(Math.max(80, latencyMs / 2))
          onProgress?.(pct)
        }
        maybeFail('applications.uploadDocument')
        const db = loadDb()
        if (db.session.status !== 'authenticated') fail('AUTH_REQUIRED', 'Sesi berakhir. Silakan masuk lagi.', 401)
        const app = findApp(db, id)
        const current = app.documents[documentType]
        const replacing = current?.status === 'needs_update'
        if (app.status !== 'draft' && !replacing) fail('INVALID_STATE_TRANSITION', 'Dokumen hanya bisa diganti jika diminta bank.', 400)
        if (db.flags?.uploadFailOnce && !db.flags.failedUploads.includes(documentType)) {
          db.flags.failedUploads.push(documentType)
          saveDb(db)
          fail('SERVICE_UNAVAILABLE', 'Upload gagal. Periksa koneksi lalu coba lagi.', 503, { retryable: true })
        }
        app.documents[documentType] = { status: 'uploaded', fileName: file.name, sizeBytes: file.size, contentType: file.type, uploadedAt: nowIso(db), invalidReason: null }
        if (replacing) {
          app.pendingActions = app.pendingActions.filter((a) => a.documentType !== documentType)
          pushActivity(db, { type: 'document_replaced', category: 'application', title: `${DOC_LABELS[documentType]} terbaru terkirim`, body: 'Menunggu verifikasi dari bank.', action: { label: 'Lihat status', route: '/my-kpr/application' } })
          if (!app.pendingActions.length && app.status === 'additional_docs_requested') {
            app.status = 'docs_verification'
            app.statusHistory.push({ status: 'docs_verification', at: nowIso(db) })
          }
        }
        touch(db, app)
        saveDb(db)
        onProgress?.(100)
        return clone(decorate(app))
      },
      selectProgram: call('applications.selectProgram', (db, id, { bankProductId, loanAmount, tenorMonths }) => {
        const app = findApp(db, id)
        if (app.status !== 'draft') fail('INVALID_STATE_TRANSITION', 'Pengajuan sudah dikirim.', 400)
        const product = productsOf(db).find((p) => p.id === bankProductId)
        if (!product || !isAvailable(product, db.clock)) fail('BANK_PRODUCT_EXPIRED', 'Program ini sudah tidak tersedia. Pilih program lain.', 410)
        const { price } = app.data.property
        const dp = app.data.loan.downPayment ?? 0
        if (!(loanAmount > 0) || loanAmount > price - dp) fail('VALIDATION_FAILED', 'Jumlah pinjaman tidak boleh melebihi Harga − DP.', 400)
        if (loanAmount !== app.data.loan.amount || tenorMonths !== app.data.loan.tenorMonths) {
          app.data.loan = { ...app.data.loan, amount: loanAmount, tenorMonths, amountEdited: loanAmount !== price - dp }
        }
        const sim = simulateLoan({ product, principal: loanAmount, termMonths: tenorMonths })
        app.selection = selectionFrom(product, {
          fixedRateBps: sim.fixedRateBps,
          fixedMonths: sim.fixedMonths,
          floatingRateBps: sim.floatingRateBps,
          loanAmount,
          tenorMonths,
          estimatedPayment: sim.payment,
          paymentAfterFixed: sim.paymentAfterFixed,
          totalPayment: sim.totalPayment,
          lastVerifiedAt: product.lastVerifiedAt,
        })
        app.currentStep = Math.max(app.currentStep, app.productType === 'primary' ? 7 : 5)
        touch(db, app)
        return decorate(app)
      }),
      submit: call('applications.submit', (db, id, { consents }) => {
        const app = decorate(findApp(db, id))
        if (app.status !== 'draft') fail('APPLICATION_ALREADY_SUBMITTED', 'Pengajuan ini sudah dikirim.', 409)
        const missing = app.requiredDocuments.filter((d) => d.required && !['uploaded', 'verified'].includes(app.documents[d.type]?.status))
        if (missing.length) fail('DOCUMENTS_INCOMPLETE', `Lengkapi dokumen wajib: ${missing.map((d) => d.label).join(', ')}.`, 422)
        if (!app.selection) fail('VALIDATION_FAILED', 'Pilih satu program bank dulu.', 400)
        const product = productsOf(db).find((p) => p.id === app.selection.bankProductId)
        if (!product || !isAvailable(product, db.clock) || product.version !== app.selection.productVersion) {
          fail('BANK_PRODUCT_EXPIRED', 'Program yang dipilih sudah berubah. Bandingkan ulang sebelum submit.', 410)
        }
        if (!consents?.dataAccuracy || !consents?.sendToBank) fail('CONSENT_REQUIRED', 'Centang kedua persetujuan untuk submit.', 422)
        const p = app.data.personal ?? {}
        if (!p.fullName || !/^\d{16}$/.test(p.nik ?? '')) fail('VALIDATION_FAILED', 'Data pribadi belum lengkap.', 400)
        if (app.productType === 'takeover' && takeoverGaps(app.data, { today: db.clock, mode: app.optimizationMode }).length) {
          fail('VALIDATION_FAILED', 'Lengkapi data pengajuan dulu.', 400)
        }
        app.status = 'submitted'
        app.submittedAt = nowIso(db)
        app.consents = { ...consents, acceptedAt: app.submittedAt, version: '2026-09-01' }
        app.statusHistory = [{ status: 'submitted', at: app.submittedAt }]
        app.snapshot = { data: structuredClone(app.data), selection: structuredClone(app.selection), productVersion: product.version, calculationVersion: 'calc-1.0.0', capturedAt: app.submittedAt }
        app.lastRejection = null
        touch(db, app)
        pushActivity(db, {
          type: 'application_submitted',
          category: 'application',
          title: `Pengajuan terkirim ke ${app.selection.bankName}`,
          body: `${app.productType === 'primary' ? 'KPR Primary' : app.optimizationMode === 'topup' ? 'Take Over + Top-up' : 'Take Over'} · ${app.selection.productName}`,
          action: { label: 'Lihat status', route: '/my-kpr/application' },
        })
        return app
      }),
      // Mock hard delete per current product decision. Production must confirm retention/compliance first.
      // Take Over keeps what the user typed for the next draft; personal and job data already live on the profile.
      cancel: call('applications.cancel', (db, id) => {
        const app = findApp(db, id)
        if (!CANCELLABLE.includes(app.status)) fail('INVALID_STATE_TRANSITION', 'Pengajuan pada tahap ini tidak bisa dibatalkan.', 400)
        const keeps = app.productType === 'takeover'
        if (keeps) db.takeoverKept = structuredClone({ oldLoan: app.data.oldLoan, property: app.data.property, finance: app.data.finance })
        db.applications = db.applications.filter((a) => a.id !== id)
        if (db.simulation?.source?.id === id) db.simulation = null
        if (app.status !== 'draft') pushActivity(db, { type: 'application_cancelled', category: 'application', title: 'Pengajuan dibatalkan', body: keeps ? 'Pengajuan dan dokumen terkait sudah dihapus. Data yang kamu isi tetap tersimpan untuk pengajuan berikutnya.' : 'Data pengajuan dan dokumen terkait sudah dihapus.' })
        return { deleted: true, wasDraft: app.status === 'draft' }
      }),
      retrySameBank: call('applications.retrySameBank', (db, id) => {
        const app = findApp(db, id)
        if (app.status !== 'rejected' || app.superseded) fail('INVALID_STATE_TRANSITION', 'Pengajuan ini tidak bisa diajukan ulang.', 400)
        app.lastRejection = app.rejection
        app.rejection = null
        app.status = 'draft'
        app.currentStep = app.lastRejection?.relevantStep ?? 2
        app.consents = null
        app.snapshot = null
        app.submittedAt = null
        app.statusHistory.push({ status: 'draft', at: nowIso(db) })
        touch(db, app)
        return decorate(app)
      }),
      cloneToBank: call('applications.cloneToBank', (db, id) => {
        const old = findApp(db, id)
        if (old.status !== 'rejected' || old.superseded) fail('INVALID_STATE_TRANSITION', 'Pengajuan ini tidak bisa disalin.', 400)
        old.superseded = true
        const docs = Object.fromEntries(Object.entries(old.documents).filter(([, d]) => d.status === 'verified' || d.status === 'uploaded').map(([k, d]) => [k, { ...d, status: 'uploaded' }]))
        const app = newApplication(db, { productType: old.productType, mode: old.optimizationMode, source: old.source, mortgageId: old.mortgageId, data: structuredClone(old.data) })
        app.documents = docs
        app.excludedProductIds = [...(old.excludedProductIds ?? []), old.selection?.bankProductId].filter(Boolean)
        app.currentStep = old.productType === 'primary' ? 6 : 5
        pushActivity(db, { type: 'application_cloned', category: 'application', title: 'Data disalin ke pengajuan baru', body: `Pengajuan ke ${old.selection?.bankName ?? 'bank sebelumnya'} tetap tersimpan sebagai riwayat.` })
        return decorate(app)
      }),
    },

    bankProducts: {
      compare: call('bankProducts.compare', (db, { applicationId, sort = 'total' }) => {
        const app = findApp(db, applicationId)
        const result = comparePrimaryPrograms({ products: productsOf(db), input: primaryInput(app), asOf: db.clock, sort })
        return { ...result, previouslyRejectedProductIds: app.excludedProductIds ?? [] }
      }),
      affordability: call('bankProducts.affordability', (db, { applicationId }) =>
        primaryAffordability({ products: productsOf(db), input: profileInput(findApp(db, applicationId)), asOf: db.clock }),
      ),
    },

    mortgages: {
      createSetup: call('mortgages.createSetup', (db) => {
        if (activeMortgageOf(db)) fail('ACTIVE_MORTGAGE_EXISTS', 'KPR kamu sudah dipantau. Versi ini mendukung satu KPR aktif.', 409)
        const draft = db.mortgages.find((m) => m.status === 'draft')
        if (draft) return draft
        const m = { id: nextId(db, 'mtg'), status: 'draft', setupStep: 1, source: 'monitoring', finance: { ...db.finance }, reminders: structuredClone(DEFAULT_REMINDERS), payments: [], rateHistory: [], version: 1, createdAt: nowIso(db) }
        db.mortgages.unshift(m)
        return m
      }),
      saveSetupStep: call('mortgages.saveSetupStep', (db, id, { step, values }) => {
        const m = findMortgage(db, id)
        if (m.status !== 'draft' && m.status !== 'active') fail('INVALID_STATE_TRANSITION', 'Data KPR ini tidak bisa diubah.', 400)
        if (values.reminders && (!values.reminders.payment.length || !(values.reminders.channels.inApp || values.reminders.channels.email))) {
          fail('VALIDATION_FAILED', 'Pilih minimal satu jadwal pembayaran dan satu kanal.', 400)
        }
        const before = { ...m }
        Object.assign(m, values)
        applyMortgageRules(m, before)
        if (m.status === 'draft') m.setupStep = Math.min(2, Math.max(m.setupStep, step + 1))
        touch(db, m)
        return m
      }),
      activate: call('mortgages.activate', (db, id, { confirmDataCorrect }) => {
        const m = findMortgage(db, id)
        if (m.status !== 'draft') fail('INVALID_STATE_TRANSITION', 'Pemantauan sudah aktif.', 400)
        if (!confirmDataCorrect) fail('VALIDATION_FAILED', 'Centang konfirmasi data dulu.', 400)
        // Step 1 data (reminder + amortization) is required; profile and property data can come later.
        const required = ['bankName', 'originalPrincipal', 'currentPayment', 'originalTenorMonths', 'startDate', 'dueDay', 'remainingTenorMonths', 'currentRateBps', 'currentRateType']
        const missing = required.filter((k) => m[k] == null || m[k] === '')
        if (m.scheme !== 'sharia' && !(m.outstandingPrincipal > 0)) missing.push('outstandingPrincipal')
        if (m.currentRateType === 'fixed' && !m.fixedUntil) missing.push('fixedUntil')
        if (!m.reminders?.payment?.length || !(m.reminders.channels.inApp || m.reminders.channels.email)) missing.push('reminders')
        if (missing.length) fail('VALIDATION_FAILED', 'Data KPR belum lengkap.', 400, { details: { missing } })
        m.status = 'active'
        m.setupStep = 2
        m.activatedAt = nowIso(db)
        touch(db, m)
        const due = nextDueDate({ today: db.clock, dueDay: m.dueDay })
        const channels = ['inApp', 'email'].filter((c) => m.reminders.channels[c]).length
        const fixedLeft = m.currentRateType === 'fixed' && m.fixedUntil > db.clock ? m.reminders.fixedExpiry.filter((h) => daysUntil({ fromDate: db.clock, targetDate: m.fixedUntil }) >= h) : []
        pushActivity(db, { type: 'mortgage_monitoring_activated', category: 'mortgage', title: 'Pemantauan KPR diaktifkan', body: `${m.bankName}${m.productName ? ` · ${m.productName}` : ''}` })
        if (m.reminders.payment.length) {
          const h = Math.max(...m.reminders.payment)
          pushActivity(db, { type: 'payment_reminder_scheduled', category: 'reminder', title: 'Reminder pembayaran dijadwalkan', body: `Kami akan mengingatkan pembayaran H-${h} sebelum jatuh tempo ${due}.`, action: { label: 'Lihat pembayaran', route: '/my-kpr/payment' } })
        }
        const days = m.currentRateType === 'fixed' && m.fixedUntil ? daysUntil({ fromDate: db.clock, targetDate: m.fixedUntil }) : null
        if (days !== null && days > 0 && days <= 90) {
          pushActivity(db, { type: 'fixed_expiry_warning', category: 'warning', title: `Fixed rate berakhir dalam ${days} hari`, body: 'Lihat estimasi dampak ke cicilan kamu.', action: { label: 'Lihat dampak', route: '/my-kpr/rate' } })
        }
        return { mortgage: m, scheduledReminderCount: m.reminders.payment.length * channels + fixedLeft.length * channels, applicationCreated: false }
      }),
      update: call('mortgages.update', (db, id, values) => {
        const m = findMortgage(db, id)
        if (m.status !== 'active') fail('INVALID_STATE_TRANSITION', 'Hanya KPR aktif yang bisa diubah di sini.', 400)
        const before = { ...m }
        if (values.property) m.property = { ...m.property, ...values.property }
        if (values.finance) {
          m.finance = { ...m.finance, ...values.finance }
          db.finance = { ...db.finance, ...values.finance }
        }
        if (values.reminders) m.reminders = values.reminders
        const { property: _p, finance: _f, reminders: _r, ...core } = values
        Object.assign(m, core)
        applyMortgageRules(m, before)
        touch(db, m)
        if (!values.reminders || Object.keys(values).length > 1) {
          pushActivity(db, { type: 'mortgage_data_updated', category: 'mortgage', title: 'Data KPR diperbarui', body: 'Proyeksi pembayaran dan KPR Health dihitung ulang.' })
        }
        return m
      }),
      // "Tetap di bank sekarang": hides the Home fixed-rate warning until the next milestone (H-60/30/14/7).
      dismissRateWarning: call('mortgages.dismissRateWarning', (db, id) => {
        const m = findMortgage(db, id)
        const { mode, daysUntilFixedEnd } = rateMode(m, db.clock)
        if (m.status !== 'active' || mode !== 'warning') fail('INVALID_STATE_TRANSITION', 'Tidak ada peringatan bunga yang aktif.', 400)
        m.rateWarningDismissedMilestone = nextMilestone(daysUntilFixedEnd)
        touch(db, m)
        return m
      }),
      deleteDraft: call('mortgages.deleteDraft', (db, id) => {
        const m = findMortgage(db, id)
        if (m.status !== 'draft') fail('INVALID_STATE_TRANSITION', 'Hanya data pengaturan yang belum aktif yang bisa dihapus.', 400)
        db.mortgages = db.mortgages.filter((x) => x.id !== id)
        return { deleted: true }
      }),
      // `proof` is optional file metadata ({ name, size, type }); file bytes are never stored.
      markPaid: call('mortgages.markPaid', (db, id, { dueDate, amount, paidAt, proof }) => {
        const m = findMortgage(db, id)
        if (!(amount > 0)) fail('VALIDATION_FAILED', 'Nominal harus lebih dari 0.', 400, { fieldErrors: [{ field: 'amount', message: 'Nominal harus lebih dari 0.' }] })
        if (!parseIsoDate(paidAt) || paidAt > db.clock) fail('VALIDATION_FAILED', 'Tanggal bayar tidak valid.', 400, { fieldErrors: [{ field: 'paidAt', message: 'Tanggal bayar tidak boleh di masa depan.' }] })
        if (proof && !ACCEPTED_EXTENSIONS.test(proof.name)) fail('FILE_TYPE_UNSUPPORTED', 'Format tidak didukung. Gunakan JPG, PNG, atau PDF.', 415)
        if (proof && proof.size > MAX_FILE_BYTES) fail('FILE_TOO_LARGE', 'Ukuran file lebih dari 5MB. Kompres dulu, lalu coba lagi.', 413)
        if (m.payments.some((p) => p.dueDate === dueDate && p.status === 'paid')) fail('DUPLICATE_PAYMENT_RECORD', 'Pembayaran bulan ini sudah ditandai.', 409)
        const payment = { id: nextId(db, 'pay'), dueDate, amount, status: 'paid', paidAt, source: 'manual_user_recorded', bankConfirmed: false, proof: proof ? { fileName: proof.name, sizeBytes: proof.size, contentType: proof.type } : null }
        m.payments.push(payment)
        pushActivity(db, { type: 'payment_marked_paid', category: 'payment', title: 'Pembayaran ditandai dibayar', body: `Jatuh tempo ${dueDate} · dicatat manual, tidak tersinkron dengan bank.`, action: { label: 'Lihat pembayaran', route: '/my-kpr/payment' } })
        touch(db, m)
        return payment
      }),
      removePayment: call('mortgages.removePayment', (db, id, paymentId) => {
        const m = findMortgage(db, id)
        m.payments = m.payments.filter((p) => p.id !== paymentId)
        touch(db, m)
        return m
      }),
    },

    simulations: {
      run: call('simulations.run', (db, { source, input }) => {
        const sim = { id: nextId(db, 'sim'), source, input, createdAt: nowIso(db) }
        const result = runSimulation(db, sim)
        db.simulation = sim
        return result
      }),
      getCurrent: call('simulations.getCurrent', (db, { sort } = {}) => {
        if (!db.simulation) fail('RESOURCE_NOT_FOUND', 'Belum ada simulasi. Mulai dari Explore atau pengajuan Take Over.', 404)
        return runSimulation(db, db.simulation, sort)
      }),
      // Simulation history is not in MVP scope: say so instead of pretending it was stored.
      save: call('simulations.save', () => ({ saved: false, reason: 'history_not_enabled' })),
      apply: call('simulations.apply', (db, { bankProductId, tenorMonths, plafon }) => {
        const sim = db.simulation
        if (!sim) fail('RESOURCE_NOT_FOUND', 'Simulasi tidak ditemukan.', 404)
        const result = runSimulation(db, sim)
        const product = productsOf(db).find((p) => p.id === bankProductId)
        if (!product || !isAvailable(product, db.clock)) fail('BANK_PRODUCT_EXPIRED', 'Program ini sudah tidak tersedia.', 410)
        const x = evaluateTakeoverProduct({ product, baseline: result.baseline, input: result.input, asOf: db.clock, plafonOverride: plafon ?? null, tenorMonthsOverride: tenorMonths })
        const selection = selectionFrom(product, {
          fixedRateBps: x.fixedRateBps,
          fixedMonths: x.fixedMonths,
          floatingRateBps: x.floatingRateBps,
          loanAmount: x.principal,
          tenorMonths: x.tenorMonths,
          estimatedPayment: x.payment,
          paymentAfterFixed: x.paymentAfterFixed,
          totalPayment: x.totalPayment,
          feesTotal: x.feesTotal,
          netTopup: x.topup?.netTopup ?? null,
          breakEvenMonth: x.breakEven.month,
          lastVerifiedAt: product.lastVerifiedAt,
        })
        let app
        if (sim.source.type === 'application') {
          app = findApp(db, sim.source.id)
          if (app.status !== 'draft') fail('INVALID_STATE_TRANSITION', 'Pengajuan sudah dikirim.', 400)
          app.data.goal = { ...app.data.goal, tenorMonths: x.tenorMonths }
        } else {
          const current = activeApplication(db.applications)
          if (current) fail('ACTIVE_DRAFT_EXISTS', 'Kamu masih punya pengajuan aktif. Lanjutkan atau hapus dulu.', 409, { details: { applicationId: current.id } })
          const m = findMortgage(db, sim.source.id)
          app = newApplication(db, {
            productType: 'takeover',
            mode: sim.input.mode,
            source: 'mortgage',
            mortgageId: m.id,
            data: takeoverDataFromMortgage(m, { personal: prefilledPersonal(db), employment: prefilledEmployment(db), goal: { ...sim.input, tenorMonths: x.tenorMonths } }),
          })
          db.simulation = { ...sim, source: { type: 'application', id: app.id } }
        }
        app.selection = selection
        app.currentStep = Math.max(app.currentStep, 6)
        touch(db, app)
        return decorate(app)
      }),
    },

    explore: {
      // Signals are computed with the same engine as the simulation; never design placeholder numbers.
      get: call('explore.get', (db) => {
        const m = activeMortgageOf(db)
        const education = ARTICLES.map(({ body: _b, ...a }) => a)
        if (!m) return { hasActiveMortgage: false, signals: null, education, message: 'Take Over, Refinancing, dan Multiguna aktif setelah KPR disetujui dan akad.' }
        const days = m.currentRateType === 'fixed' && m.fixedUntil && m.fixedUntil >= db.clock ? daysUntil({ fromDate: db.clock, targetDate: m.fixedUntil }) : null
        let opportunity = { available: false }
        try {
          const sim = runSimulation(db, { id: 'explore', source: { type: 'mortgage', id: m.id }, input: defaultTakeoverGoal(m) })
          // Near/after the fixed end the fair reference is the (estimated) floating installment, not today's fixed one.
          const fixedLeft = sim.baseline.fixedMonthsLeft
          const reference = fixedLeft != null ? sim.baseline.payments[fixedLeft] : sim.baseline.currentPayment
          const cheaper = sim.items.filter((x) => reference - x.payment > 0 && x.netSaving > 0 && x.eligibility !== 'not_eligible' && !x.stale)
          const best = [...cheaper].sort((a, b) => a.payment - b.payment)[0]
          const maxLtvBps = Math.max(...productsOf(db).filter((p) => p.productTypes.includes('takeover')).map((p) => p.eligibility.maximumLtvBps))
          const value = m.property?.estimatedValue
          opportunity = {
            available: true,
            cheaperProgramCount: cheaper.length,
            bestMonthlySaving: best ? reference - best.payment : null,
            comparedTo: fixedLeft != null ? 'floating_estimate' : 'current',
            bestBankName: best?.bank.name ?? null,
            bestFixedRateBps: best?.fixedRateBps ?? null,
            bestFixedMonths: best?.fixedMonths ?? null,
            bestBreakEvenMonth: best?.breakEven.month ?? null,
            maxGrossTopup: value > 0 ? Math.max(0, Math.floor((value * maxLtvBps) / 10_000) - m.outstandingPrincipal) : null,
            maxLtvBps,
          }
        } catch {
          opportunity = { available: false }
        }
        return {
          hasActiveMortgage: true,
          signals: { floating: days !== null && days <= 90, alreadyFloating: days === null, daysUntilFixedEnd: days, opportunity: opportunity.cheaperProgramCount > 0 },
          opportunity,
          education,
        }
      }),
      article: call('explore.article', (db, slug) => {
        const a = ARTICLES.find((x) => x.slug === slug)
        if (!a) fail('RESOURCE_NOT_FOUND', 'Artikel tidak ditemukan.', 404)
        return a
      }),
    },

    activities: {
      list: call('activities.list', (db) => [...db.activities].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))),
      markRead: call('activities.markRead', (db, id) => {
        const a = db.activities.find((x) => x.id === id)
        if (a && !a.readAt) a.readAt = nowIso(db)
        return a
      }),
      markAllRead: call('activities.markAllRead', (db) => {
        db.activities.forEach((a) => {
          a.readAt ??= nowIso(db)
        })
        return { ok: true }
      }),
    },
  }
}

// ---------- development controls (never imported by app runtime outside DEV) ----------
export const mockControls = {
  scenarios: SCENARIOS,
  currentScenario: () => loadDb().scenario,
  reset: (scenario) => resetDb(scenario),
  // E2E journeys run with tours already seen so the overlay never blocks them.
  seeAllTours() {
    const db = loadDb()
    db.toursSeen = Object.keys(TOURS)
    saveDb(db)
  },
  failNext: (name, error = { code: 'SERVICE_UNAVAILABLE', message: 'Koneksi bermasalah. Periksa koneksi lalu coba lagi.', status: 503, retryable: true }) => failures.set(name, error),
  advanceApplication(id) {
    const db = loadDb()
    const app = findApp(db, id)
    const flow = app.productType === 'takeover' ? TAKEOVER_FLOW : PRIMARY_FLOW
    const at = flow.indexOf(app.status === 'additional_docs_requested' ? 'docs_verification' : app.status)
    if (at < 0 || at === flow.length - 1) return
    const next = flow[at + 1]
    app.status = next
    app.pendingActions = []
    app.statusHistory.push({ status: next, at: nowIso(db) })
    const [title, body] = STATUS_COPY[next]
    pushActivity(db, { type: 'application_status_changed', category: 'application', title, body, action: { label: 'Lihat status', route: '/my-kpr/application' } })
    if (next === 'disbursed') completeApplication(db, app)
    touch(db, app)
    saveDb(db)
  },
  rejectApplication(id) {
    const db = loadDb()
    const app = findApp(db, id)
    if (!IN_PROCESS.includes(app.status)) return
    app.status = 'rejected'
    app.rejection = { code: 'DTI_ABOVE_BANK_POLICY', displayReason: `Rasio cicilan melebihi kebijakan ${app.selection?.bankName ?? 'bank'}.`, relevantStep: app.productType === 'primary' ? 2 : 3, rejectedAt: nowIso(db) }
    app.statusHistory.push({ status: 'rejected', at: nowIso(db) })
    pushActivity(db, { type: 'application_rejected', category: 'application', title: `Pengajuan ke ${app.selection?.bankName} belum disetujui`, body: app.rejection.displayReason, action: { label: 'Lihat pilihan', route: '/my-kpr/application' } })
    saveDb(db)
  },
  requestDocument(id, documentType = 'bank_statement') {
    const db = loadDb()
    const app = findApp(db, id)
    if (!IN_PROCESS.includes(app.status)) return
    const type = app.documents[documentType] ? documentType : Object.keys(app.documents)[0]
    app.documents[type] = { ...app.documents[type], status: 'needs_update', invalidReason: 'Bank meminta versi terbaru.' }
    app.pendingActions.push({ id: nextId(db, 'pa'), type: 'document_update', documentType: type, message: `${DOC_LABELS[type]} terbaru dibutuhkan bank.`, requestedAt: nowIso(db) })
    app.status = 'additional_docs_requested'
    app.statusHistory.push({ status: 'additional_docs_requested', at: nowIso(db) })
    pushActivity(db, { type: 'additional_document_requested', category: 'application', title: 'Bank minta dokumen tambahan', body: `${DOC_LABELS[type]} terbaru dibutuhkan.`, action: { label: 'Upload sekarang', route: '/my-kpr/application' } })
    saveDb(db)
  },
}
