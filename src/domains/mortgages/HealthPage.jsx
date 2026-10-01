import { Link, Navigate, useNavigate } from 'react-router-dom'
import { CircleDotIcon } from 'lucide-react'
import { api } from '@/data/api'
import { useResource } from '@/lib/hooks'
import { percentRatio, rupiah } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/layout/AppShell'
import { Chip, Disclaimer, ErrorPanel, Panel, PageSkeleton, ProgressBar } from '@/components/shared/ui'
import { HEALTH_SENTENCE, HealthRing } from '@/domains/home/MonitoringDashboard'
import { deriveMortgage } from './derive'
import { progressGap } from './setupMeta'

const BAR = { ok: 'bg-success-strong', warn: 'bg-warning-accent', bad: 'bg-brand-red' }
const toneOf = (score) => (score >= 80 ? 'ok' : score >= 60 ? 'warn' : 'bad')

export function HealthPage() {
  const navigate = useNavigate()
  const { data, error, reload } = useResource(() => api.dashboard.getSnapshot())
  if (!data) return error ? <ErrorPanel onRetry={reload} /> : <PageSkeleton />
  const m = data.mortgages.find((x) => x.status === 'active')
  if (!m) return <Navigate to="/my-kpr" replace />
  const d = deriveMortgage(m, data.clock)
  const h = d.health
  const weakest = h.components.filter((c) => c.score !== null).sort((a, b) => a.score - b.score)[0]
  // One "Lengkapi" link per component that cannot be scored yet, each to the single place that field is asked.
  const complete = {
    dti: { label: 'Isi penghasilan', to: '/profile/edit' },
    ltv: { label: 'Isi nilai properti', to: '/my-kpr/property?edit=1' },
    rate: { label: 'Isi jenis bunga', to: '/monitoring/setup/1?edit=mykpr' },
    progress: progressGap(m, 'mykpr'),
  }
  const evidence = {
    dti: d.dti ? `Rasio cicilan ${percentRatio(d.dti.dtiRatio)} dari penghasilan` : 'Penghasilan belum diisi',
    ltv: d.property ? `LTV ${percentRatio(d.property.ltvRatio)} (sisa pokok ÷ estimasi nilai rumah)` : 'Nilai properti belum diisi',
    rate: d.mode == null ? 'Jenis bunga belum diketahui' : d.mode === 'floating' ? 'Sudah menggunakan bunga floating' : d.daysUntilFixedEnd != null ? `Fixed berakhir ${d.daysUntilFixedEnd} hari lagi` : 'Tanggal akhir fixed belum diisi',
    progress: d.paidRatio == null ? 'Progres pelunasan belum diketahui' : `${Math.round(d.paidRatio * 100)}% pokok sudah lunas`,
  }
  const todo = [
    d.mode === 'warning' && d.floatingImpact && `Siapkan kenaikan cicilan sekitar ${rupiah(d.floatingImpact.monthlyDelta)}/bln setelah fixed berakhir (estimasi).`,
    (d.mode === 'warning' || d.mode === 'floating') && 'Bandingkan opsi Take Over atau repricing sebelum/selama floating.',
    d.dti && d.dti.dtiRatio > 0.35 && 'Rasio cicilan di atas 35%: hindari utang baru dan pertimbangkan tenor atau opsi lain.',
    !d.property && 'Lengkapi nilai properti untuk menghitung equity dan LTV.',
  ].filter(Boolean)

  return (
    <>
      <PageHeader title="KPR Health" subtitle={h.score == null ? 'Belum lengkap · lengkapi data di bawah' : `${h.score}/100 · ${h.label}${h.partial ? ' · skor parsial' : ''}`} back="/" />
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Panel className="gap-1.5 sm:p-7">
          {h.score == null ? (
            <p className="mb-2.5 text-[15px] leading-[22px] font-semibold text-ink-2">Lengkapi data di bawah untuk melihat KPR Health.</p>
          ) : (
            <div className="mb-2.5 flex items-center gap-4">
              <HealthRing health={h} size={96} />
              <div className="flex min-w-0 flex-col items-start gap-2">
                <Chip tone={h.tone}>{h.label}</Chip>
                <p className="text-[15px] leading-[22px] font-semibold text-ink-2">{h.score >= 80 ? 'Kondisi KPR kamu sehat.' : HEALTH_SENTENCE[weakest?.key]}</p>
              </div>
            </div>
          )}
          <ul className="flex flex-col">
            {h.components.map((c) => (
              <li key={c.key} className="flex flex-col gap-2 border-b border-line py-3.5 last:border-b-0">
                <div className="flex justify-between text-[15px] font-extrabold">
                  <span>{c.name}</span>
                  <span className={c.score === null ? 'text-muted-foreground' : c.score >= 80 ? 'text-success' : c.score >= 60 ? 'text-warning-text' : 'text-danger'}>{c.score === null ? 'Belum dapat dihitung' : `${c.score}/100`}</span>
                </div>
                {c.score !== null && <ProgressBar value={c.score} label={`${c.name} ${c.score} dari 100`} barClassName={BAR[toneOf(c.score)]} />}
                <span className="text-[13px] text-ink-3">{evidence[c.key]}</span>
                {c.score === null && (
                  <Link to={complete[c.key].to} className="flex min-h-11 w-fit items-center text-[13px] font-bold text-primary underline">
                    {complete[c.key].label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
          <Disclaimer>Skor sementara = rata-rata komponen yang tersedia dengan ambang tetap (mis. rasio cicilan ≤30% = 90). Bobot final menunggu validasi produk.</Disclaimer>
        </Panel>
        <section className="flex flex-col gap-3.5 rounded-card border border-border bg-card p-7">
          <h2 className="text-[17px] font-extrabold">Yang perlu diperhatikan</h2>
          {todo.length ? (
            <ul className="flex flex-col gap-2.5">
              {todo.map((t) => (
                <li key={t} className="flex gap-2.5 text-sm leading-[21px]">
                  <CircleDotIcon className="mt-0.5 size-4 shrink-0 text-warning-accent" aria-hidden />
                  {t}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-3">Tidak ada hal mendesak. Tetap bayar tepat waktu.</p>
          )}
          <Button className="w-fit" onClick={() => navigate('/explore')}>
            Lihat Pilihan
          </Button>
          <Disclaimer>KPR Health bukan skor kredit dan tidak menentukan persetujuan bank.</Disclaimer>
        </section>
      </div>
    </>
  )
}
