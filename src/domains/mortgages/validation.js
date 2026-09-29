// Pure validators for the monitoring setup (doc 02 MON-01…MON-05). Values are form strings.
import { toBps, toInt, toMoney } from '@/lib/format'

const minLen = (v, n) => String(v ?? '').trim().length >= n

export function validateLoanStep(v, { today }) {
  const e = {}
  if (!v.bankName) e.bankName = 'Pilih bank.'
  if (v.bankName === 'Bank lainnya' && !minLen(v.bankOther, 2)) e.bankOther = 'Isi nama bank.'
  if (!v.scheme) e.scheme = 'Pilih jenis KPR.'
  const principal = toMoney(v.originalPrincipal)
  if (!(principal > 0)) e.originalPrincipal = 'Isi jumlah pinjaman awal.'
  if (!(toMoney(v.currentPayment) > 0)) e.currentPayment = 'Isi cicilan bulanan.'
  const tenor = toInt(v.originalTenorMonths)
  if (!(tenor >= 12 && tenor <= 360)) e.originalTenorMonths = 'Tenor harus 12–360 bulan.'
  if (!v.startDate) e.startDate = 'Pilih tanggal akad.'
  else if (v.startDate > today) e.startDate = 'Tanggal akad tidak boleh di masa depan.'
  const due = toInt(v.dueDay)
  if (!(due >= 1 && due <= 31)) e.dueDay = 'Isi tanggal 1–31.'
  if (!v.knowsOutstanding) e.knowsOutstanding = 'Pilih salah satu.'
  if (v.knowsOutstanding === 'yes') {
    const out = toMoney(v.outstandingPrincipal)
    if (!(out > 0)) e.outstandingPrincipal = 'Isi sisa pokok saat ini.'
    else if (principal > 0 && out > principal) e.outstandingPrincipal = 'Sisa pokok tidak boleh lebih besar dari pinjaman awal.'
    const rem = toInt(v.remainingTenorMonths)
    if (!(rem >= 1 && rem <= (tenor || 360))) e.remainingTenorMonths = `Sisa tenor harus 1–${tenor || 360} bulan.`
  }
  return e
}

const rateError = (v, required = true) => {
  const bps = toBps(v)
  if (bps === null) return required || String(v ?? '').trim() ? 'Isi bunga 0,01–30%.' : ''
  return bps > 0 && bps <= 3000 ? '' : 'Isi bunga 0,01–30%.'
}

// `mortgage` carries step-1 data (original principal/tenor, start date) for cross-field checks.
export function validateRateStep(v, { mortgage, estimateRequired }) {
  const e = {}
  if (!v.paymentEverChanged) {
    e.paymentEverChanged = 'Pilih salah satu kondisi cicilan.'
    return e
  }
  const changed = v.paymentEverChanged === 'yes'
  const r = rateError(v.currentRate)
  if (r) e.currentRate = r
  if (!v.currentRateType) e.currentRateType = 'Pilih jenis bunga.'
  if (v.currentRateType === 'fixed') {
    if (!v.fixedUntil) e.fixedUntil = 'Pilih tanggal fixed berakhir.'
    else if (mortgage.startDate && v.fixedUntil <= mortgage.startDate) e.fixedUntil = 'Harus setelah tanggal akad.'
    const f = rateError(v.estimatedFloatingRate, false)
    if (f) e.estimatedFloatingRate = f
  }
  const official = changed || v.official
  if (official) {
    const out = toMoney(v.outstandingPrincipal)
    if (!(out > 0)) e.outstandingPrincipal = changed ? 'Cicilan pernah berubah: isi sisa pokok resmi dari bank.' : 'Isi sisa pokok resmi.'
    else if (!changed && mortgage.originalPrincipal && out > mortgage.originalPrincipal) e.outstandingPrincipal = 'Sisa pokok tidak boleh lebih besar dari pinjaman awal.'
    const rem = toInt(v.remainingTenorMonths)
    if (!(rem >= 1 && rem <= 360)) e.remainingTenorMonths = 'Isi sisa tenor 1–360 bulan.'
  }
  if (changed && !(toMoney(v.currentPayment) > 0)) e.currentPayment = 'Isi cicilan terbaru.'
  if (estimateRequired) e.estimate = 'Hitung estimasi atau masukkan angka resmi.'
  return e
}

// Rate history: ordered, rate > 0, end after start, no overlap (doc 02 MON-02).
export function validateRatePeriods(periods) {
  return periods.map((p, i) => {
    const bps = toBps(p.rate)
    if (!(bps > 0)) return 'Rate harus positif.'
    if (!p.startDate || !p.endDate) return 'Isi tanggal mulai dan berakhir.'
    if (p.endDate <= p.startDate) return 'Tanggal berakhir harus setelah tanggal mulai.'
    const prev = periods[i - 1]
    if (prev?.endDate && p.startDate <= prev.endDate) return 'Periode overlap. Tanggal mulai harus setelah periode sebelumnya berakhir.'
    return ''
  })
}

export function validatePropertyStep(v, { today, later }) {
  const e = {}
  if (!v.type) e.type = 'Pilih jenis properti.'
  if (!v.city) e.city = 'Pilih kota/kabupaten.'
  if (!minLen(v.address, 5)) e.address = 'Isi alamat properti.'
  if (v.type !== 'apartment' && !(toInt(v.landArea) > 0)) e.landArea = 'Isi luas tanah.'
  if (!(toInt(v.buildingArea) > 0)) e.buildingArea = 'Isi luas bangunan.'
  if (!v.certificateType) e.certificateType = 'Pilih status sertifikat.'
  if (!minLen(v.certificateOwner, 2)) e.certificateOwner = 'Isi nama pemilik sertifikat.'
  if (!later) {
    if (!(toMoney(v.estimatedValue) > 0)) e.estimatedValue = 'Isi estimasi nilai atau pilih isi nanti.'
    if (!v.valueAsOf) e.valueAsOf = 'Pilih tanggal.'
    else if (v.valueAsOf > today) e.valueAsOf = 'Tanggal tidak boleh di masa depan.'
  }
  if (!v.disputed) e.disputed = 'Pilih salah satu.'
  return e
}

export function validateFinanceStep(v) {
  const e = {}
  if (!(toMoney(v.monthlyIncome) > 0)) e.monthlyIncome = 'Isi penghasilan bulanan.'
  if (v.jointIncome && !(toMoney(v.partnerIncome) > 0)) e.partnerIncome = 'Isi penghasilan pasangan.'
  return e
}

export function validateReminders(r) {
  const e = {}
  if (!r.payment.length) e.payment = 'Pilih minimal satu jadwal pengingat pembayaran.'
  if (!r.channels.inApp && !r.channels.email) e.channels = 'Pilih minimal satu kanal.'
  return e
}
