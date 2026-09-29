// Pure validators for the Take Over + Top-up flow (doc 02 OPT-01…OPT-05).
import { toBps, toInt, toMoney } from '@/lib/format'
import { validateEmployment } from '@/domains/applications/validation'

const minLen = (v, n) => String(v ?? '').trim().length >= n

// Step 1 reuses the Primary employment rules; debts are collected in step 5 for this flow.
export function validateEmploymentBasic(v) {
  const { vehicleDebt: _a, cardDebt: _b, otherDebt: _c, ...rest } = validateEmployment({ ...v, vehicleDebt: '0', cardDebt: '0', otherDebt: '0' })
  return rest
}

export function validateOldLoanBase(v, { today }) {
  const e = {}
  if (!v.bankName) e.bankName = 'Pilih bank asal.'
  const p0 = toMoney(v.originalPrincipal)
  const pay = toMoney(v.currentPayment)
  if (!(p0 > 0)) e.originalPrincipal = 'Isi pinjaman KPR awal.'
  if (!(pay > 0)) e.currentPayment = 'Isi cicilan bulanan saat ini.'
  else if (p0 > 0 && pay >= p0) e.currentPayment = 'Cicilan harus lebih kecil dari pinjaman awal.'
  const n = toInt(v.originalTenorMonths)
  if (!(n >= 12 && n <= 360)) e.originalTenorMonths = 'Tenor harus 12–360 bulan.'
  if (!v.startDate) e.startDate = 'Pilih tanggal akad.'
  else if (v.startDate > today) e.startDate = 'Tanggal akad tidak boleh di masa depan.'
  const due = toInt(v.dueDay)
  if (!(due >= 1 && due <= 31)) e.dueDay = 'Isi tanggal 1–31.'
  if (!v.paymentEverChanged) e.paymentEverChanged = 'Pilih salah satu.'
  return e
}

export function validateOfficial(v, { originalPrincipal, changed }) {
  const e = {}
  const out = toMoney(v.outstanding)
  if (!(out > 0)) e.outstanding = 'Isi sisa pokok saat ini.'
  else if (!changed && originalPrincipal && out > originalPrincipal) e.outstanding = 'Sisa pokok tidak boleh lebih besar dari pinjaman awal.'
  const r = toBps(v.rate)
  if (!(r > 0 && r <= 3000)) e.rate = 'Isi bunga 0,01–30%.'
  if (!v.rateType) e.rateType = 'Pilih jenis bunga.'
  if (v.rateType === 'fixed') {
    if (!v.fixedUntil) e.fixedUntil = 'Pilih tanggal fixed berakhir.'
    if (String(v.floatingRate ?? '').trim() && !(toBps(v.floatingRate) > 0)) e.floatingRate = 'Isi bunga 0,01–30%.'
  }
  const rem = toInt(v.remainingMonths)
  if (!(rem >= 1 && rem <= 360)) e.remainingMonths = 'Isi sisa tenor 1–360 bulan.'
  if (String(v.penalty ?? '').trim()) {
    const p = toBps(v.penalty)
    if (p === null || p > 1000) e.penalty = 'Maksimal 10%.'
  }
  return e
}

export function validateGoal(v) {
  const e = {}
  if (!v.mode) {
    e.mode = 'Pilih tujuan pengajuan.'
    return e
  }
  if (v.mode === 'takeover' && !v.goal) e.goal = 'Pilih tujuan utama.'
  if (!v.tenorMonths) e.tenorMonths = 'Pilih tenor baru.'
  if (v.mode === 'topup') {
    if (!(toMoney(v.requestedTopup) > 0)) e.requestedTopup = 'Isi dana tambahan yang dibutuhkan.'
    if (!v.purpose) e.purpose = 'Pilih tujuan penggunaan dana.'
    if (v.purpose === 'other' && !minLen(v.purposeOther, 3)) e.purposeOther = 'Jelaskan kebutuhan dana.'
  }
  if (String(v.maxPayment ?? '').trim() && !(toMoney(v.maxPayment) > 0)) e.maxPayment = 'Nominal tidak valid.'
  return e
}

export function validateTakeoverProperty(v, { mode }) {
  const e = {}
  if (!v.propertyType) e.propertyType = 'Pilih jenis properti.'
  if (!v.city) e.city = 'Pilih kota/kabupaten.'
  if (!minLen(v.address, 5)) e.address = 'Isi alamat properti.'
  if (v.propertyType !== 'apartment' && !(toInt(v.landArea) > 0)) e.landArea = 'Isi luas tanah.'
  if (!(toInt(v.buildingArea) > 0)) e.buildingArea = 'Isi luas bangunan.'
  if (!v.certificateType) e.certificateType = 'Pilih status sertifikat.'
  if (!minLen(v.certificateOwner, 2)) e.certificateOwner = 'Isi nama pemilik sertifikat.'
  if (mode === 'topup' && !(toMoney(v.estimatedValue) > 0)) e.estimatedValue = 'Nilai properti wajib untuk menghitung Top-up.'
  if (!v.disputed) e.disputed = 'Pilih salah satu.'
  return e
}

export function validateCapacity(v) {
  const e = {}
  for (const k of ['vehicleDebt', 'cardDebt', 'otherDebt', 'fundsForCosts']) if (toMoney(v[k]) === null) e[k] = 'Wajib diisi, isi 0 jika tidak ada.'
  return e
}
