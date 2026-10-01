import { dayMonth } from '@/lib/format'

export const PRIMARY_STEPS = ['Data Diri', 'Pekerjaan & Penghasilan', 'Properti', 'Pinjaman', 'Upload Dokumen', 'Bandingkan Program Bank', 'Review & Submit']
export const TAKEOVER_STEPS = ['Profil & pekerjaan', 'KPR lama', 'Kemampuan bayar', 'Properti', 'Tujuan', 'Dokumen', 'Review']

// The 7 Primary screens grouped into 3 phases. The percent runs fast early so the form feels far along.
export const PRIMARY_PHASES = [
  { label: 'Tentang Kamu', screens: [1, 2] },
  { label: 'Rumah & Pinjaman', screens: [3, 4] },
  { label: 'Pilih Bank & Kirim', screens: [5, 6, 7] },
]
export const PRIMARY_PERCENT = [10, 30, 45, 60, 75, 85, 95]

// `screen` is the 1-based progress screen; `position` the fractional bar position (2nd of 2 screens → 1.5)
// that WizardProgress takes as `reached`.
function phaseProgress(phases, percents, screen) {
  const i = phases.findIndex((p) => p.screens.includes(screen))
  const { label, screens } = phases[i]
  return { phase: i + 1, label, position: i + 1 + screens.indexOf(screen) / screens.length, percent: percents[screen - 1] }
}
export const primaryProgress = (screen) => phaseProgress(PRIMARY_PHASES, PRIMARY_PERCENT, screen)

// Take Over has 9 progress screens: 1 Data pribadi, 2 Pekerjaan, 3 KPR lama, 4 Kemampuan bayar, 5 Properti,
// 6 Tujuan, 7 Baseline & program, 8 Dokumen, 9 Review. Phase ends land on the same 45% / 75% as Primary.
export const TAKEOVER_PHASES = [
  { label: 'Kamu & KPR Lama', screens: [1, 2, 3] },
  { label: 'Kondisi & Tujuan', screens: [4, 5, 6] },
  { label: 'Pilih Bank & Kirim', screens: [7, 8, 9] },
]
export const TAKEOVER_PERCENT = [10, 20, 30, 45, 55, 65, 75, 85, 95]
export const takeoverProgress = (screen) => phaseProgress(TAKEOVER_PHASES, TAKEOVER_PERCENT, screen)

// Furthest saved Take Over screen. currentStep 6 is the compare phase until a program is picked.
export function takeoverScreenOf(app) {
  const s = app.currentStep
  if (s <= 1) return 1
  if (s === 2) return 3
  if (s <= 5) return s + 1
  if (s === 6) return app.selection ? 8 : 7
  return 9
}

// Home "Lanjutkan pengajuan" card: the same phase, label and percent the wizard shows.
export const draftProgress = (app) =>
  app.productType === 'primary' ? primaryProgress(Math.min(app.currentStep, PRIMARY_STEPS.length)) : takeoverProgress(takeoverScreenOf(app))

export const productName = (app) => (app.productType === 'primary' ? 'KPR Primary' : app.optimizationMode === 'topup' ? 'Take Over + Top-up' : 'Take Over')
export const stepsOf = (app) => (app.productType === 'primary' ? PRIMARY_STEPS : TAKEOVER_STEPS)

export function resumePath(app) {
  if (app.productType === 'primary') return `/apply/primary/${Math.min(app.currentStep, PRIMARY_STEPS.length)}`
  if (app.currentStep >= 6 && app.selection) return `/optimize/${Math.min(app.currentStep, 7)}`
  if (app.currentStep >= 6) return '/optimize/baseline'
  return `/optimize/${app.currentStep}`
}

const PRIMARY_STAGES = [
  { label: 'Diajukan', statuses: ['submitted'] },
  { label: 'Verifikasi', statuses: ['docs_verification', 'additional_docs_requested'] },
  { label: 'Proses Bank', statuses: ['bank_processing'] },
  { label: 'Appraisal', statuses: ['appraisal'] },
  { label: 'Disetujui', statuses: ['approved'] },
  { label: 'Akad', statuses: ['akad', 'disbursed'] },
]
const TAKEOVER_STAGES = [
  { label: 'Diajukan', statuses: ['submitted'] },
  { label: 'Verifikasi Dokumen', statuses: ['docs_verification', 'additional_docs_requested'] },
  { label: 'Proses Bank', statuses: ['bank_processing'] },
  { label: 'Appraisal', statuses: ['appraisal'] },
  { label: 'Disetujui', statuses: ['approved'] },
  { label: 'Pelunasan KPR Lama', statuses: ['old_mortgage_settlement'] },
  { label: 'Akad KPR Baru', statuses: ['akad'] },
  { label: 'Selesai', statuses: ['disbursed'] },
]

// Tracker reflects the stored status history — never a local timer.
export function trackerSteps(app) {
  const stages = app.productType === 'primary' ? PRIMARY_STAGES : TAKEOVER_STAGES
  const history = app.statusHistory ?? []
  const dateOf = (stage) => {
    const h = history.find((x) => stage.statuses.includes(x.status))
    return h ? dayMonth(h.at) : ''
  }
  const stageIndex = (status) => stages.findIndex((s) => s.statuses.includes(status))
  if (app.status === 'rejected') {
    const reached = history.filter((h) => h.status !== 'rejected' && h.status !== 'draft').map((h) => stageIndex(h.status))
    const last = Math.max(0, ...reached)
    return [
      ...stages.slice(0, last + 1).map((s) => ({ label: s.label, date: dateOf(s), state: 'done' })),
      { label: 'Ditolak', date: dayMonth(app.rejection?.rejectedAt), state: 'rejected' },
    ]
  }
  const current = stageIndex(app.status)
  const completed = app.status === 'disbursed'
  return stages.map((s, i) => ({
    label: s.label,
    date: i < current || completed ? dateOf(s) : i === current ? 'Berjalan' : 'Menunggu',
    state: completed || i < current ? 'done' : i === current ? 'current' : 'todo',
  }))
}

export const STATUS_LABEL = {
  draft: 'Draft',
  submitted: 'Diajukan',
  docs_verification: 'Verifikasi Dokumen',
  additional_docs_requested: 'Perlu Dokumen Tambahan',
  bank_processing: 'Proses Bank',
  appraisal: 'Appraisal',
  approved: 'Disetujui',
  old_mortgage_settlement: 'Pelunasan KPR Lama',
  akad: 'Akad',
  disbursed: 'Selesai',
  rejected: 'Ditolak',
}

export const hasPendingAction = (app) => (app.pendingActions ?? []).length > 0
