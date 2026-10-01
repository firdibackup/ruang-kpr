import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeftRightIcon, ArrowRightIcon, CalendarClockIcon, CalendarIcon, ChevronRightIcon, CircleCheckIcon, ClockIcon, HouseIcon, LandmarkIcon, PercentIcon, RefreshCwIcon, SparklesIcon, TriangleAlertIcon, WalletIcon } from 'lucide-react'
import { api } from '@/data/api'
import { useResource } from '@/lib/hooks'
import { daysLabel, monthName, percentBps, rupiah, rupiahShort, signedRupiah, tenorLabel, dateLong, dateShort, labelOf, CITIES } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { FormDialog } from '@/components/shared/dialogs'
import { MarkPaidDialog } from '@/domains/mortgages/MyKprTabs'
import { Chip, Disclaimer, EstimateTag, HeroCard, IconBox, Notice, Panel, ProgressBar, Skeleton, SummaryRows } from '@/components/shared/ui'
import { progressGap, rateTypeLabel } from '@/domains/mortgages/setupMeta'

export const HEALTH_SENTENCE = {
  dti: 'Rasio cicilan kamu agak tinggi.',
  ltv: 'Porsi pinjaman terhadap nilai rumah masih tinggi.',
  rate: 'Masa fixed segera berakhir.',
  progress: 'Pokok yang sudah lunas masih sedikit.',
}
const TONE_COLOR = { ok: '#1B8A5A', warn: '#E0A100', bad: '#DC1C2E' }

export function HealthRing({ health, size = 112 }) {
  const color = TONE_COLOR[health.tone]
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full"
      style={{ width: size, height: size, background: `conic-gradient(${color} 0 ${health.score}%, #EEF1F6 ${health.score}% 100%)` }}
      role="img"
      aria-label={`KPR Health ${health.score} dari 100${health.partial ? ', skor parsial' : ''}`}
    >
      <div className="flex size-[78%] flex-col items-center justify-center rounded-full bg-card">
        <span className="text-[30px] leading-none font-extrabold">{health.score}</span>
        <span className="text-xs font-semibold text-muted-foreground">/100</span>
      </div>
    </div>
  )
}

export function MonitoringDashboard({ mortgage: m, derived: d, clock, onChanged }) {
  const navigate = useNavigate()
  const { data: explore, loading: exploreLoading } = useResource(() => api.explore.get(), [m.id, m.version])
  const [repricing, setRepricing] = useState(false)
  const [marking, setMarking] = useState(false)
  const fi = d.floatingImpact
  const weakest = [...d.health.components].filter((c) => c.score !== null).sort((a, b) => a.score - b.score)[0]
  const opp = explore?.opportunity
  const isFloating = d.mode === 'floating'

  const agenda = [
    { icon: WalletIcon, tone: 'primary', t: `Siapkan cicilan ${monthName(d.nextDue)}`, s: `${dateShort(d.nextDue)} · Reminder aktif`, to: '/my-kpr/payment' },
    isFloating
      ? { icon: RefreshCwIcon, tone: 'warn', t: 'Cek opsi repricing atau Take Over', s: 'Bunga floating aktif · bandingkan opsi', to: '/explore' }
      : d.daysUntilFixedEnd != null && { icon: ClockIcon, tone: 'warn', t: 'Evaluasi sebelum floating', s: `${d.daysUntilFixedEnd} hari menuju akhir fixed`, to: '/my-kpr/rate' },
    d.partialProperty && { icon: HouseIcon, tone: 'warn', t: 'Lengkapi nilai properti', s: 'Untuk hitung equity dan refinancing', to: '/my-kpr/property' },
  ].filter(Boolean)

  return (
    <div className="flex flex-col gap-5">
      {d.mode === 'warning' && (
        <section className="grid grid-cols-1 gap-7 rounded-card border-2 border-warning-accent bg-card p-6 shadow-card md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] sm:p-7" aria-labelledby="warn-title">
          <div className="flex min-w-0 flex-col gap-4">
            <Chip tone="warn" icon={TriangleAlertIcon}>
              Peringatan bunga · H-{d.milestone}
            </Chip>
            <h2 id="warn-title" className="text-2xl leading-8 font-extrabold text-pretty sm:text-[26px]">
              Fixed rate berakhir {daysLabel(d.daysUntilFixedEnd)}
            </h2>
            {fi ? (
              <SummaryRows
                rows={[
                  { k: 'Bunga saat ini', v: percentBps(m.currentRateBps) },
                  { k: 'Estimasi floating', v: percentBps(m.estimatedFloatingRateBps), tone: 'warn', tag: <EstimateTag /> },
                  { k: 'Cicilan sekarang', v: rupiah(fi.currentPayment) },
                  { k: `Estimasi mulai ${dateShort(fi.resetDate)}`, v: rupiah(fi.estimatedNextPayment), tone: 'warn', tag: <EstimateTag /> },
                  { k: 'Potensi perubahan', v: `${signedRupiah(fi.monthlyDelta)}/bln`, tone: fi.monthlyDelta > 0 ? 'bad' : 'ok' },
                ]}
              />
            ) : (
              <Notice tone="warn" title="Estimasi floating belum diisi" action={<Link to="/monitoring/setup/2?edit=home" className="text-[13px] font-bold text-primary underline">Lengkapi Data Bunga</Link>}>
                Isi estimasi bunga floating agar kami bisa menghitung dampak ke cicilan kamu.
              </Notice>
            )}
            <Button className="w-fit" onClick={() => navigate('/my-kpr/rate')}>
              Lihat Pilihan
              <ArrowRightIcon aria-hidden />
            </Button>
          </div>
          <div className="flex flex-col gap-3 rounded-[18px] bg-muted p-[22px]">
            <span className="text-[13px] font-extrabold text-ink-3">Opsi</span>
            {[
              { label: 'Tetap di bank sekarang', icon: LandmarkIcon, go: () => toast('Kami tetap mengingatkan jadwal pembayaran dan perubahan bunga.') },
              { label: 'Bandingkan Take Over', icon: ArrowLeftRightIcon, go: () => navigate('/explore') },
              { label: 'Minta repricing', icon: PercentIcon, go: () => setRepricing(true) },
            ].map((o) => (
              <button key={o.label} type="button" onClick={o.go} className="flex min-h-14 items-center gap-3 rounded-xl border border-border bg-card px-4 text-left text-sm font-bold hover:border-primary">
                <o.icon className="size-[18px]" aria-hidden />
                <span className="flex-1">{o.label}</span>
                <ChevronRightIcon className="size-4" aria-hidden />
              </button>
            ))}
            <Disclaimer>Bunga floating adalah estimasi dan dapat berubah mengikuti kebijakan bank.</Disclaimer>
          </div>
        </section>
      )}

      {d.mode === null && (
        <Notice tone="warn" title="Jenis bunga belum diketahui" action={<Link to="/monitoring/setup/2?edit=home" className="text-[13px] font-bold text-primary underline">Isi jenis bunga</Link>}>
          Cek di aplikasi bank supaya kami bisa mengingatkan sebelum floating.
        </Notice>
      )}

      {/* Opportunity leads the dashboard; only the fixed-rate warning sits above it. */}
      <section className="grid grid-cols-1 gap-4 rounded-card border border-[#cfdcf3] bg-[#f3f7fe] p-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] md:gap-x-7" aria-labelledby="opp-title">
        <div className="flex flex-col gap-4">
          <IconBox icon={SparklesIcon} tone="white" size="lg" />
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-extrabold text-ink-3">Peluang</span>
            <h2 id="opp-title" className="text-xl leading-[27px] font-extrabold text-pretty">
              {opp?.cheaperProgramCount ? 'Ada ruang untuk cicilan lebih ringan.' : 'Pantau peluang untuk KPR kamu.'}
            </h2>
            <p className="text-sm leading-[21px] text-ink-3">Potensi dari KPR kamu saat ini. Lihat biaya pindah dan break-even, bukan hanya bunga promo.</p>
          </div>
        </div>
        {exploreLoading && !explore ? (
          <div className="flex flex-col gap-2 md:row-span-2" aria-busy="true">
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
          </div>
        ) : (
          <div className="flex flex-col gap-2 md:row-span-2">
            <OpportunityTile
              to="/explore"
              label="POTENSI TAKE OVER"
              edge="var(--color-primary), var(--color-chart-interest)"
              value={opp?.cheaperProgramCount ? `−${rupiahShort(opp.bestMonthlySaving)}` : 'Belum ada'}
              unit={opp?.cheaperProgramCount ? '/ bulan' : ''}
              tone={opp?.cheaperProgramCount ? 'ok' : 'mute'}
              note={
                opp?.cheaperProgramCount
                  ? `${opp.comparedTo === 'floating_estimate' ? 'Dibanding estimasi cicilan floating' : 'Dibanding cicilan sekarang'} · ${opp.bestBankName} ${percentBps(opp.bestFixedRateBps)} fixed ${opp.bestFixedMonths / 12} th${opp.bestBreakEvenMonth ? ` · break-even ${opp.bestBreakEvenMonth} bulan` : ''}`
                  : 'Belum ada program yang lebih hemat setelah biaya pindah, berdasarkan katalog terbaru.'
              }
            />
            <OpportunityTile
              to={opp?.maxGrossTopup != null ? '/explore' : '/my-kpr/property?edit=1'}
              label="POTENSI REFINANCING"
              edge="var(--color-success-strong), color-mix(in srgb, var(--color-success-strong) 30%, white)"
              value={opp?.maxGrossTopup != null ? rupiahShort(opp.maxGrossTopup) : 'Belum dapat dihitung'}
              unit={opp?.maxGrossTopup != null ? 'dana kotor maksimum' : ''}
              tone={opp?.maxGrossTopup != null ? 'default' : 'warn'}
              note={opp?.maxGrossTopup != null ? `Nilai properti est. ${rupiahShort(m.property.estimatedValue)} × LTV ${opp.maxLtvBps / 100}% − sisa pokok ${rupiahShort(m.outstandingPrincipal)}` : 'Lengkapi nilai properti untuk melihat potensi dana cair.'}
            />
          </div>
        )}
        <div className="flex flex-col gap-3 md:self-end">
          <Button className="w-full md:w-fit" onClick={() => navigate('/explore')}>
            Eksplorasi Pilihan
            <ArrowRightIcon aria-hidden />
          </Button>
          <Disclaimer>Estimasi, bukan penawaran bank. Simulasi dulu, tidak langsung mengajukan.</Disclaimer>
        </div>
      </section>

      {isFloating && (
        <HeroCard className="grid grid-cols-1 items-center gap-7 md:grid-cols-2">
          <div className="flex flex-col gap-3.5">
            <Chip tone="glass">Bunga floating aktif</Chip>
            <h2 className="text-2xl leading-8 font-extrabold sm:text-[26px]">KPR kamu sekarang menggunakan bunga floating</h2>
            <Button variant="inverse" className="w-fit" onClick={() => navigate('/explore')}>
              Bandingkan Pilihan
            </Button>
          </div>
          <dl className="flex flex-col rounded-[18px] bg-white/12 px-5 py-2">
            {[
              ['Bunga saat ini', percentBps(m.currentRateBps)],
              ['Cicilan saat ini', rupiah(m.currentPayment)],
              ...(m.previousFixedPayment ? [['Perubahan dari fixed', `${signedRupiah(m.currentPayment - m.previousFixedPayment)}/bln`]] : []),
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 border-b border-white/15 py-3 text-sm last:border-b-0">
                <dt className="text-white/80">{k}</dt>
                <dd className="font-extrabold">{v}</dd>
              </div>
            ))}
          </dl>
        </HeroCard>
      )}

      {d.partialProperty && (
        <section className="flex flex-wrap items-center gap-[18px] rounded-3xl border border-warning-border bg-warning-soft px-6 py-[22px]">
          <IconBox icon={HouseIcon} tone="white" size="lg" className="text-warning-text" />
          <div className="flex min-w-[240px] flex-1 flex-col gap-1">
            <h2 className="text-[15px] font-extrabold">Lengkapi nilai properti</h2>
            <p className="text-[13px] leading-[19px] text-[#5c4a1f]">Equity, LTV, Refinancing + Top-up, dan Multiguna belum dapat dihitung lengkap. Reminder pembayaran dan fixed tetap aktif.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate('/my-kpr/property?edit=1')}>
            Lengkapi Data Properti
          </Button>
        </section>
      )}

      {/* Health → Next Payment → KPR → Agenda on one column; two columns on desktop. */}
      <div className="flex flex-col gap-5 xl:grid xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] xl:items-start">
        <div className="flex min-w-0 flex-col gap-5 max-xl:contents">
          {d.health.score == null ? (
            <Panel className="order-1 xl:order-none">
              <span className="text-[13px] font-extrabold text-ink-3">KPR Health</span>
              <p className="text-sm leading-[21px] text-ink-2">Lengkapi data untuk melihat KPR Health.</p>
              <Link to="/my-kpr/health" className="flex min-h-11 w-fit items-center gap-1.5 text-sm font-bold text-primary">
                Lihat yang perlu dilengkapi
                <ArrowRightIcon className="size-[15px]" aria-hidden />
              </Link>
            </Panel>
          ) : (
            <Panel className="order-1 flex-row items-center gap-6 xl:order-none">
              <HealthRing health={d.health} size={d.mode === 'normal' ? 112 : 92} />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <span className="text-[13px] font-extrabold text-ink-3">KPR Health</span>
                <Chip tone={d.health.tone}>{d.health.label}</Chip>
                <p className="text-sm leading-[21px] text-ink-2">{d.health.score >= 80 ? 'Kondisi KPR kamu sehat.' : HEALTH_SENTENCE[weakest?.key]}</p>
                {d.health.partial && <p className="text-xs text-warning-text">Skor parsial — sebagian komponen belum dapat dihitung.</p>}
                <Link to="/my-kpr/health" className="flex min-h-11 w-fit items-center gap-1.5 text-sm font-bold text-primary">
                  Lihat penyebab
                  <ArrowRightIcon className="size-[15px]" aria-hidden />
                </Link>
              </div>
            </Panel>
          )}

          <Panel className="order-3 xl:order-none">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-extrabold">KPR Saya</h2>
              <Chip tone="ok">Aktif</Chip>
            </div>
            <div className="flex items-center gap-3.5">
              <span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-secondary text-base font-extrabold tracking-[-0.3px] text-primary italic" aria-hidden>
                {m.bankName.replace(/^Bank\s+/i, '').slice(0, 4)}
              </span>
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-base font-extrabold">{m.productName || 'KPR Rumah Tinggal'}</span>
                <span className="text-[13px] text-muted-foreground">
                  {m.bankName} · {m.scheme === 'sharia' ? 'Syariah' : 'Konvensional'}
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-2.5 rounded-2xl bg-muted p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2.5">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[13px] text-ink-3">Sisa pokok{m.outstandingEstimated && ' (estimasi)'}</span>
                  <span className="text-2xl font-extrabold tracking-[-0.3px] tabular">{rupiah(m.outstandingPrincipal)}</span>
                </div>
                {m.originalPrincipal > 0 && <span className="text-[13px] text-muted-foreground">dari {rupiah(m.originalPrincipal)}</span>}
              </div>
              {d.paidRatio == null ? (
                <span className="flex flex-wrap items-center gap-x-2 text-[13px] text-ink-3">
                  Progres pelunasan belum diketahui.
                  <Link to={progressGap(m, 'home').to} className="flex min-h-11 items-center font-bold text-primary underline">
                    {progressGap(m, 'home').label}
                  </Link>
                </span>
              ) : (
                <>
                  <ProgressBar value={d.paidRatio * 100} label="Pokok lunas" />
                  <span className="text-[13px] font-bold text-primary">{Math.round(d.paidRatio * 100)}% pokok lunas</span>
                </>
              )}
            </div>
            <SummaryRows
              rows={[
                { k: 'Bunga saat ini', v: <span className="flex items-center gap-2">{percentBps(m.currentRateBps)}<span className={cn('rounded-full px-2.5 py-1 text-xs font-extrabold', isFloating ? 'bg-warning-bg text-warning' : 'bg-secondary text-primary')}>{isFloating ? 'Floating' : rateTypeLabel(m.currentRateType)}</span></span> },
                { k: 'Masa fixed berakhir', v: isFloating ? 'Sudah berakhir' : m.currentRateType === 'fixed' ? dateShort(m.fixedUntil) : 'Belum diketahui' },
                { k: 'Sisa tenor', v: m.remainingTenorMonths ? `${tenorLabel(m.remainingTenorMonths)} lagi` : 'Belum diisi' },
                { k: 'Lokasi properti', v: m.property?.city ? labelOf(CITIES, m.property.city) : 'Belum diisi' },
              ]}
            />
            <Button variant="outline" size="sm" className="w-fit" onClick={() => navigate('/my-kpr/overview')}>
              Lihat perjalanan KPR
            </Button>
          </Panel>
        </div>

        <div className="flex min-w-0 flex-col gap-5 max-xl:contents">
          <Panel className="order-2 gap-2.5 xl:order-none">
            <span className="text-[13px] font-extrabold text-ink-3">Pembayaran Berikutnya</span>
            <span className="text-[28px] font-extrabold tracking-[-0.4px] tabular">{rupiah(m.currentPayment)}</span>
            <span className="flex items-center gap-2 text-sm text-ink-3">
              <CalendarClockIcon className="size-4" aria-hidden />
              {dateLong(d.nextDue)} · {daysLabel(d.daysToNextDue)}
            </span>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-5 gap-y-1">
              {d.payableDues.includes(d.nextDue) && (
                <Button size="md" onClick={() => setMarking(true)}>
                  <CircleCheckIcon aria-hidden />
                  Tandai Sudah Dibayar
                </Button>
              )}
              <Link to="/my-kpr/payment" className="flex min-h-11 w-fit items-center text-sm font-bold text-primary">
                Lihat detail
              </Link>
            </div>
          </Panel>

          <Panel className="order-4 gap-3.5 xl:order-none">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-extrabold">Agenda terdekat</h2>
              <CalendarIcon className="size-5" aria-hidden />
            </div>
            <ul className="flex flex-col gap-0.5">
              {agenda.map((a) => (
                <li key={a.t}>
                  <Link to={a.to} className="-mx-2 flex min-h-14 items-center gap-3.5 rounded-xl p-2 hover:bg-muted">
                    <IconBox icon={a.icon} tone={a.tone} />
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-[15px] font-extrabold">{a.t}</span>
                      <span className="text-[13px] text-muted-foreground">{a.s}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>

      {marking && <MarkPaidDialog onOpenChange={() => setMarking(false)} m={m} dueOptions={d.payableDues} initialDue={d.nextDue} clock={clock} onDone={onChanged} />}

      <FormDialog open={repricing} onOpenChange={setRepricing} title="Minta repricing" description="Repricing adalah penyesuaian bunga di bank yang sama.">
        <p className="text-sm leading-[21px] text-ink-3">Hubungi bank kamu untuk menanyakan opsi repricing sebelum masa fixed berakhir. Pengajuan repricing lewat RuangKPR belum tersedia pada versi ini.</p>
        <Button variant="neutral" size="md" onClick={() => setRepricing(false)}>
          Mengerti
        </Button>
      </FormDialog>
    </div>
  )
}

function OpportunityTile({ to, label, value, unit, note, tone, edge }) {
  // Gradient ring: card fill paints the padding box, the edge gradient shows through the transparent border.
  return (
    <Link
      to={to}
      className="flex flex-col gap-1.5 rounded-xl border-[1.5px] border-transparent px-4 py-3.5 transition-shadow hover:shadow-card"
      style={{ background: `linear-gradient(var(--color-card) 0 0) padding-box, linear-gradient(135deg, ${edge}) border-box` }}
    >
      <span className="flex w-full items-center justify-between gap-2">
        <span className="text-xs font-extrabold tracking-[0.4px] text-primary">{label}</span>
        <ChevronRightIcon className="size-4" aria-hidden />
      </span>
      <span className="flex flex-wrap items-baseline gap-1.5">
        <span className={cn('text-[22px] font-extrabold tracking-[-0.3px]', tone === 'ok' && 'text-success-strong', tone === 'warn' && 'text-warning-text', tone === 'mute' && 'text-ink-3')}>{value}</span>
        {unit && <span className="text-[13px] text-ink-3">{unit}</span>}
      </span>
      <span className="text-[13px] leading-[19px] text-ink-3">{note}</span>
    </Link>
  )
}
