import { daysLabel, monthYear, percentRatio, rupiahApprox } from '@/lib/format'
import { InsightGrid, MilestonePanel } from '@/components/shared/milestone'
import { Chip } from '@/components/shared/ui'
import { applicationHealth, goalConditions } from './insights'

// Short value + caption: the 30px tile fits one word; the detail goes underneath.
function rateInsight(r) {
  if (r.mode == null) return { v: 'Belum diketahui', sub: 'jenis bunga belum diisi' }
  if (r.mode === 'floating') return { v: 'Floating', sub: 'bunga bisa naik mengikuti bank' }
  return { v: 'Fixed', sub: r.daysUntilFixedEnd != null ? `berakhir ${daysLabel(r.daysUntilFixedEnd)}` : 'masa fixed masih berjalan' }
}

// Closes phase 1 (profile + old loan): what staying with the old bank looks like. Pure client-side math, no loading state.
export function TakeoverMilestone({ app, clock, onBack, onNext }) {
  const c = goalConditions(app.data, clock)
  const { paidRatio } = applicationHealth(app.data, clock, null)
  return (
    <MilestonePanel
      title="Gambaran KPR lama kamu"
      sub="Dihitung dari data KPR lama yang kamu isi."
      disclaimer="Estimasi dari data KPR lama yang kamu isi, bukan angka resmi bank."
      onBack={onBack}
      onNext={onNext}
      nextLabel="Lanjut ke Tahap 2"
    >
      {c.payoffDate && <Chip tone="info">Perkiraan lunas {monthYear(c.payoffDate)}</Chip>}
      <InsightGrid
        items={[
          c.totalInterest != null && { k: 'Sisa bunga jika tetap', v: rupiahApprox(c.totalInterest), sub: 'kalau tidak pindah bank' },
          { k: 'Pokok sudah lunas', v: percentRatio(paidRatio, 0), sub: 'dari pinjaman awal' },
          { k: 'Status bunga', ...rateInsight(c.rate) },
        ].filter(Boolean)}
      />
    </MilestonePanel>
  )
}
