import { Link, Navigate, useLocation } from 'react-router-dom'
import { CircleCheckIcon } from 'lucide-react'
import { api } from '@/data/api'
import { useResource } from '@/lib/hooks'
import { rupiah, tenorLabel } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { ErrorPanel, PageSkeleton, SummaryRows } from '@/components/shared/ui'
import { productName } from './meta'

export function SubmitSuccess({ app, trackerLabel = 'Pantau Pengajuan' }) {
  const s = app.selection
  return (
    <section className="mx-auto flex w-full max-w-[640px] flex-col items-center gap-4 rounded-card bg-card px-6 py-12 text-center shadow-card sm:px-10">
      <span className="flex size-[72px] items-center justify-center rounded-full bg-success-bg text-success-strong" aria-hidden>
        <CircleCheckIcon className="size-9" />
      </span>
      <h1 className="text-[28px] font-extrabold">Pengajuan berhasil dikirim</h1>
      <p className="text-[15px] text-ink-3">
        {productName(app)} ke {s.bankName}. Tahap berikutnya: <b>verifikasi dokumen</b>. Kami kabari lewat Activity dan email.
      </p>
      <SummaryRows
        className="w-full text-left"
        rows={[
          { k: 'ID pengajuan', v: app.id },
          { k: 'Bank / program', v: `${s.bankName} · ${s.productName}` },
          { k: 'Plafon', v: rupiah(s.loanAmount) },
          { k: 'Tenor', v: tenorLabel(s.tenorMonths) },
          { k: 'Cicilan estimasi', v: `${rupiah(s.estimatedPayment)}/bln` },
        ]}
      />
      <p className="text-xs text-muted-foreground">Data pengajuan sekarang read-only. Perubahan hanya lewat CS atau permintaan dokumen dari bank.</p>
      <Button asChild className="mt-2">
        <Link to="/my-kpr/application" replace>
          {trackerLabel}
        </Link>
      </Button>
    </section>
  )
}

export function PrimarySuccess() {
  const { state } = useLocation()
  const { data, error, reload } = useResource(() => api.dashboard.getSnapshot())
  if (error) return <ErrorPanel onRetry={reload} />
  if (!data) return <PageSkeleton />
  const app = data.applications.find((a) => a.id === state?.id) ?? data.applications.find((a) => a.status === 'submitted')
  if (!app || app.status === 'draft') return <Navigate to="/my-kpr" replace />
  return <SubmitSuccess app={app} />
}
