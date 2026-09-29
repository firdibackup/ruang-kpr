import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeftRightIcon, BookOpenIcon, ChevronRightIcon, HandCoinsIcon, LightbulbIcon, RefreshCwIcon, SearchXIcon, TriangleAlertIcon } from 'lucide-react'
import { api } from '@/data/api'
import { useResource } from '@/lib/hooks'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/layout/AppShell'
import { FormDialog } from '@/components/shared/dialogs'
import { Disclaimer, EmptyState, ErrorPanel, IconBox, LoadingCards, PageSkeleton } from '@/components/shared/ui'
import { ArticleCard } from '@/domains/home/HomePage'

export function ExplorePage() {
  const { data, error, loading, reload } = useResource(() => api.explore.get())
  const snap = useResource(() => api.dashboard.getSnapshot())
  const hasDraft = snap.data?.mortgages.some((m) => m.status === 'draft')
  return (
    <>
      <PageHeader title="Explore" subtitle={data?.hasActiveMortgage ? 'Cari pilihan untuk KPR kamu' : 'Pelajari dulu sebelum memutuskan.'} />
      {!data && loading && <LoadingCards count={3} />}
      {!data && error && <ErrorPanel onRetry={reload} />}
      {data && !data.hasActiveMortgage && (
        <>
          <section className="flex flex-col gap-3.5">
            <h2 className="flex items-center gap-2.5 text-lg font-extrabold">
              <BookOpenIcon className="size-5 text-primary" aria-hidden />
              Edukasi
            </h2>
            {data.education.length ? (
              <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {data.education.map((a) => (
                  <li key={a.slug} className="flex">
                    <ArticleCard article={a} cta="Baca artikel" />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Belum ada artikel.</p>
            )}
          </section>
          <div className="flex items-start gap-3.5 rounded-3xl bg-secondary px-[22px] py-5">
            <LightbulbIcon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
            <p className="text-sm leading-[22px] font-semibold">{data.message}</p>
          </div>
          <section className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-border bg-card px-6 py-[22px]">
            <div className="flex min-w-[240px] flex-1 flex-col gap-1">
              <h2 className="text-[15px] font-extrabold">Sudah punya KPR yang berjalan?</h2>
              <p className="text-[13px] leading-[19px] text-muted-foreground">Tambahkan KPR untuk melihat opsi Take Over, Refinancing + Top-up, dan Multiguna.</p>
            </div>
            <Button asChild size="sm">
              <Link to={hasDraft ? '/my-kpr' : '/monitoring/intro'}>{hasDraft ? 'Lanjutkan Pengaturan' : 'Pantau KPR Saya'}</Link>
            </Button>
          </section>
        </>
      )}
      {data?.hasActiveMortgage && <ActiveExplore data={data} />}
    </>
  )
}

function ActiveExplore({ data }) {
  const navigate = useNavigate()
  const [multiguna, setMultiguna] = useState(false)
  const s = data.signals
  const o = data.opportunity
  const badges = [s?.floating && `Fixed berakhir ${s.daysUntilFixedEnd} hari lagi`, s?.opportunity && `${o.cheaperProgramCount} program lebih murah ditemukan`].filter(Boolean)
  const products = [
    { key: 'takeover', name: 'Take Over', desc: 'Bandingkan pindah KPR ke bank lain: cicilan, biaya pindah, dan break-even.', icon: ArrowLeftRightIcon, go: () => navigate('/optimize/start?mode=takeover'), badge: badges.join(' · '), warn: s?.floating },
    { key: 'topup', name: 'Refinancing + Top-up', desc: 'Pindah KPR sekaligus simulasikan dana tambahan dari nilai rumah.', icon: RefreshCwIcon, go: () => navigate('/optimize/start?mode=topup') },
    { key: 'multiguna', name: 'Multiguna', desc: 'Pinjaman baru dengan agunan rumah.', icon: HandCoinsIcon, go: () => setMultiguna(true) },
  ]
  return (
    <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-3.5">
        {products.map((p) => (
          <button key={p.key} type="button" onClick={p.go} className={cn('flex items-center gap-[18px] rounded-3xl bg-card px-6 py-[22px] text-left shadow-card transition-colors hover:border-primary', p.warn ? 'border-2 border-warning-accent' : 'border border-border')}>
            <IconBox icon={p.warn ? TriangleAlertIcon : p.icon} tone={p.warn ? 'warn' : 'primary'} size="xl" />
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="flex flex-wrap items-center gap-2 text-[17px] font-extrabold">
                {p.name}
                {p.warn && <span className="rounded-full bg-warning-bg px-2.5 py-0.5 text-[11px] font-extrabold text-warning">Prioritas</span>}
              </span>
              <span className="text-sm leading-5 text-ink-3">{p.desc}</span>
              {p.badge && <span className={cn('text-[13px] font-bold', p.warn ? 'text-warning' : 'text-success')}>{p.badge}</span>}
            </span>
            <ChevronRightIcon className="size-5 shrink-0" aria-hidden />
          </button>
        ))}
        {!o?.available && <p className="text-xs text-muted-foreground">Peluang belum dapat diperbarui. Kamu tetap bisa menjalankan simulasi manual.</p>}
        <Disclaimer>Simulasi tidak membuat pengajuan dan tidak mengirim data ke bank sampai kamu memilih “Ajukan”.</Disclaimer>
      </div>
      <section className="flex flex-col gap-1.5 rounded-3xl border border-border bg-card p-6">
        <h2 className="mb-1.5 text-[17px] font-extrabold">Pelajari</h2>
        {data.education.map((a) => (
          <Link key={a.slug} to={`/education/${a.slug}`} className="flex min-h-[52px] items-center gap-3 border-b border-line px-1 text-sm font-bold last:border-b-0 hover:text-primary">
            <BookOpenIcon className="size-[17px] text-primary" aria-hidden />
            <span className="flex-1">{a.title}</span>
          </Link>
        ))}
      </section>
      <FormDialog open={multiguna} onOpenChange={setMultiguna} title="Multiguna" description="Flow Multiguna belum tersedia pada versi ini.">
        <p className="text-sm leading-[21px] text-ink-3">Simulasi Multiguna akan memakai mesin kalkulasi yang sama setelah kebijakan mitra bank tervalidasi. Untuk dana tambahan saat ini, coba Refinancing + Top-up.</p>
        <Button variant="neutral" size="md" onClick={() => setMultiguna(false)}>
          Mengerti
        </Button>
      </FormDialog>
    </div>
  )
}

export function EducationPage() {
  const { slug } = useParams()
  const { data, error, reload } = useResource(() => api.explore.article(slug), [slug])
  if (error?.code === 'RESOURCE_NOT_FOUND') {
    return (
      <EmptyState
        icon={SearchXIcon}
        title="Artikel tidak ditemukan"
        action={
          <Button asChild size="md">
            <Link to="/explore">Kembali ke Explore</Link>
          </Button>
        }
      />
    )
  }
  if (error) return <ErrorPanel onRetry={reload} />
  if (!data) return <PageSkeleton />
  return (
    <>
      <PageHeader title={data.title} subtitle={`${data.tag} · ${data.minutes} menit baca`} back="/explore" />
      <article className="flex max-w-[720px] flex-col gap-4 rounded-card bg-card p-6 text-[15px] leading-[26px] text-ink-2 shadow-card sm:p-8">
        {data.body.map((p) => (
          <p key={p.slice(0, 24)}>{p}</p>
        ))}
        <Disclaimer>Konten edukasi umum, bukan saran keuangan personal.</Disclaimer>
      </article>
    </>
  )
}

