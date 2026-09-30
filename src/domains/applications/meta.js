import { dayMonth } from '@/lib/format'

export const PRIMARY_STEPS = ['Data Diri', 'Pekerjaan & Penghasilan', 'Properti', 'Pinjaman', 'Upload Dokumen', 'Bandingkan Program Bank', 'Review & Submit']
export const TAKEOVER_STEPS = ['Profil & pekerjaan', 'KPR lama', 'Kemampuan bayar', 'Properti', 'Tujuan', 'Dokumen', 'Review']

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
