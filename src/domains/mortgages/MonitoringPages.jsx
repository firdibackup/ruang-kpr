import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { CheckIcon, CircleCheckIcon, ClockIcon, FileXIcon, ShieldCheckIcon } from 'lucide-react'
import { api } from '@/data/api'
import { useResource } from '@/lib/hooks'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/layout/AppShell'
import { ErrorPanel, Notice, PageSkeleton, Spinner } from '@/components/shared/ui'

export function MonitoringIntro() {
  const navigate = useNavigate()
  const { data: snap, error, reload } = useResource(() => api.dashboard.getSnapshot())
  const [pending, setPending] = useState(false)
  const [apiError, setApiError] = useState('')
  if (!snap) return error ? <ErrorPanel onRetry={reload} /> : <PageSkeleton />
  const active = snap.mortgages.find((m) => m.status === 'active')
  if (active) return <Navigate to="/my-kpr/overview" replace />
  const draft = snap.mortgages.find((m) => m.status === 'draft')

  const start = async () => {
    setPending(true)
    setApiError('')
    try {
      const m = await api.mortgages.createSetup()
      navigate(`/monitoring/setup/${Math.min(m.setupStep, 6)}`)
    } catch (e) {
      setApiError(e.message)
      setPending(false)
    }
  }

  return (
    <>
      <PageHeader title="Pantau KPR" subtitle="Untuk KPR yang sudah berjalan" back="/" />
      <section className="grid grid-cols-1 gap-7 rounded-card bg-card p-6 shadow-card md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] sm:p-9">
        <div className="flex flex-col gap-5">
          <h2 className="text-[28px] font-extrabold tracking-[-0.4px]">Pantau KPR kamu</h2>
          <p className="text-[15px] text-ink-3">Tambahkan data KPR untuk:</p>
          <ul className="flex flex-col gap-3">
            {['Mendapat reminder pembayaran', 'Diingatkan sebelum bunga floating', 'Melihat progres dan sisa KPR', 'Melihat jadwal amortisasi', 'Menjalankan simulasi produk lain'].map((t) => (
              <li key={t} className="flex items-center gap-3 text-[15px] font-semibold">
                <span className="flex size-[26px] items-center justify-center rounded-full bg-success-bg text-success" aria-hidden>
                  <CheckIcon className="size-[15px]" strokeWidth={3} />
                </span>
                {t}
              </li>
            ))}
          </ul>
          {apiError && <Notice tone="bad" role="alert">{apiError}</Notice>}
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <Button onClick={start} disabled={pending} aria-busy={pending}>
              {pending && <Spinner />}
              {draft ? 'Lanjutkan Pengaturan' : 'Mulai Tambahkan KPR'}
            </Button>
            <Button variant="ghost" onClick={() => navigate('/')}>
              Kembali
            </Button>
          </div>
        </div>
        <div className="flex flex-col gap-3.5 self-start rounded-3xl bg-muted p-6">
          {[
            [ShieldCheckIcon, 'Data yang kamu masukkan tidak akan dikirim ke bank sampai kamu memilih “Ajukan Sekarang”.'],
            [ClockIcon, 'Estimasi waktu isi: 5–8 menit'],
            [FileXIcon, 'Tidak perlu upload dokumen'],
          ].map(([Icon, text]) => (
            <div key={text} className="flex items-start gap-3">
              <Icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
              <span className="text-sm leading-[21px] text-ink-2">{text}</span>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}

export function MonitoringSuccess() {
  const { state } = useLocation()
  return (
    <section className="flex flex-col items-center gap-4 rounded-card bg-card px-8 py-16 text-center shadow-card">
      <span className="flex size-[72px] items-center justify-center rounded-full bg-success-bg text-success-strong" aria-hidden>
        <CircleCheckIcon className="size-9" />
      </span>
      <h1 className="text-[28px] font-extrabold">Pemantauan KPR aktif</h1>
      <p className="text-[15px] text-ink-3">{state?.scheduled ? `Reminder pertama sudah dijadwalkan (${state.scheduled} pengingat terjadwal).` : 'Data KPR kamu tersimpan. Atur reminder kapan saja di Profil.'}</p>
      <p className="text-xs text-muted-foreground">Tidak ada pengajuan yang dibuat dan tidak ada data yang dikirim ke bank.</p>
      <Button asChild className="mt-2">
        <Link to="/" replace>
          Lihat Dashboard
        </Link>
      </Button>
    </section>
  )
}

