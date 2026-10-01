export const SETUP_STEPS = ['KPR kamu', 'Bunga', 'Reminder']
export const SETUP_TITLES = ['Data KPR kamu', 'Bunga KPR kamu', 'Atur reminder']
// Same front-loaded curve as the application wizards: each step ends a phase (45% / 75%), 100% once active.
export const SETUP_PERCENT = [10, 45, 75]

// Drafts saved by the old 6-step setup resume on the last (Reminder) step.
export const setupStepOf = (m) => Math.min(m.setupStep ?? 1, SETUP_STEPS.length)

export const rateTypeLabel = (type) => (type === 'fixed' ? 'Fixed' : type === 'floating' ? 'Floating' : 'Belum diketahui')

// Where to fill in what the pelunasan progress needs: pinjaman awal (step 1) or bunga & sisa tenor (step 2).
export const progressGap = (m, edit) =>
  m.originalPrincipal > 0 ? { label: 'Isi bunga & sisa tenor', to: `/monitoring/setup/2?edit=${edit}` } : { label: 'Isi pinjaman awal', to: `/monitoring/setup/1?edit=${edit}` }
