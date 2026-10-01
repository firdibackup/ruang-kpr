// Pure validators for the monitoring setup (doc 02 MON-01…MON-05). Values are form strings.
import { toBps, toInt, toMoney } from '@/lib/format'

const minLen = (v, n) => String(v ?? '').trim().length >= n

const rateError = (v, required = true) => {
  const bps = toBps(v)
  if (bps === null) return required || String(v ?? '').trim() ? 'Isi bunga 0,01–30%.' : ''
  return bps > 0 && bps <= 3000 ? '' : 'Isi bunga 0,01–30%.'
}

export const FIXED_PASSED = 'Tanggal ini sudah lewat, berarti bunga kamu sudah floating.'

// Setup step 1 (reminder-only). `editing` = active KPR edited from My KPR, which also shows pinjaman awal.
export function validateLoanStep(v, { editing = false, outstanding = null } = {}) {
  const e = {}
  if (!v.bankName) e.bankName = 'Pilih bank.'
  if (v.bankName === 'Bank lainnya' && !minLen(v.bankOther, 2)) e.bankOther = 'Isi nama bank.'
  if (!(toMoney(v.currentPayment) > 0)) e.currentPayment = 'Isi cicilan per bulan.'
  const due = toInt(v.dueDay)
  if (!(due >= 1 && due <= 31)) e.dueDay = 'Isi tanggal 1–31.'
  if (editing) {
    const principal = toMoney(v.originalPrincipal)
    if (principal !== null && !(principal > 0)) e.originalPrincipal = 'Isi pinjaman awal lebih dari 0, atau kosongkan.'
    else if (principal > 0 && outstanding > principal) e.originalPrincipal = 'Pinjaman awal tidak boleh lebih kecil dari sisa pinjaman.'
  }
  return e
}

// Setup step 2. rateStatus: 'fixed' | 'floating' | 'unknown'. The estimate fields are optional: checked only when filled.
export function validateRateStep(v, { today }) {
  const e = {}
  if (!v.rateStatus) e.rateStatus = 'Pilih salah satu.'
  if (v.rateStatus === 'fixed') {
    if (!v.fixedUntil) e.fixedUntil = 'Pilih tanggal fixed berakhir.'
    else if (v.fixedUntil <= today) e.fixedUntil = FIXED_PASSED
    const f = rateError(v.floatingRate, false)
    if (f) e.floatingRate = f
  }
  const r = rateError(v.currentRate, false)
  if (r) e.currentRate = r
  const years = toInt(v.tenorYears)
  const months = toInt(v.tenorMonths)
  if (months !== null && months > 11) e.tenorMonths = 'Isi 0–11 bulan.'
  else if (years !== null || months !== null) {
    const total = (years ?? 0) * 12 + (months ?? 0)
    if (!(total >= 1 && total <= 360)) e.tenorYears = 'Sisa tenor harus 1 bulan sampai 30 tahun.'
  }
  const out = toMoney(v.outstanding)
  if (out !== null && !(out > 0)) e.outstanding = 'Isi sisa pinjaman lebih dari 0, atau kosongkan.'
  return e
}

export function validateReminders(r) {
  const e = {}
  if (!r.payment.length) e.payment = 'Pilih minimal satu jadwal pengingat pembayaran.'
  if (!r.channels.inApp && !r.channels.email) e.channels = 'Pilih minimal satu kanal.'
  return e
}
