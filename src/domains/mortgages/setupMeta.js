export const SETUP_STEPS = ['Data KPR', 'Data pendukung', 'Reminder']
export const SETUP_TITLES = ['Data KPR kamu', 'Data pendukung (opsional)', 'Reminder & aktivasi']
// Same front-loaded curve as the application wizards: each step ends a phase (45% / 75%), 100% once active.
export const SETUP_PERCENT = [10, 45, 75]

// Drafts from older setups resume on the last step, unless they lack the KPR data step 1 now requires.
export const setupStepOf = (m) => (m.originalPrincipal > 0 && m.startDate ? Math.min(m.setupStep ?? 1, SETUP_STEPS.length) : 1)

export const rateTypeLabel = (type) => (type === 'fixed' ? 'Fixed' : type === 'floating' ? 'Floating' : 'Belum diketahui')

// Where to fill in what the pelunasan progress needs: pinjaman awal or bunga & sisa tenor, both on step 1.
export const progressGap = (m, edit) => ({ label: m.originalPrincipal > 0 ? 'Isi bunga & sisa tenor' : 'Isi pinjaman awal', to: `/monitoring/setup/1?edit=${edit}` })
