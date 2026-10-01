import { useCallback, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { CalculatorIcon, FileCheckIcon, InfoIcon, SearchIcon } from 'lucide-react'
import { api } from '@/data/api'
import { useForm, useResource } from '@/lib/hooks'
import { bpsInput, intInput, moneyInput, percentBps, rupiah, toBps, toInt, toMoney } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { DateField, ErrorSummary, FormGrid, MoneyField, NumberField, RadioCards, RateField } from '@/components/shared/fields'
import { Chip, ErrorPanel, IconBox, Notice, Panel, PageSkeleton, Spinner, StatTile } from '@/components/shared/ui'
import { takeoverScreenOf } from '@/domains/applications/meta'
import { Aside, OptimizeHeader, modeName, useOptimize } from './shared'
import { validateOfficial } from './validation'

function useOldLoanApp() {
  const opt = useOptimize()
  const o = opt.app?.data.oldLoan
  const ready = !!(o?.originalPrincipal && o?.currentPayment && o?.originalTenorMonths && o?.startDate && o?.dueDay)
  return { ...opt, o, ready }
}

export function OldLoanEstimatePage() {
  const navigate = useNavigate()
  const { snap, app, o, ready, error, reload, setApp } = useOldLoanApp()
  const est = useResource(async () => (ready && !o.paymentEverChanged ? api.mortgages.estimate({ originalPrincipal: o.originalPrincipal, currentPayment: o.currentPayment, originalTenorMonths: o.originalTenorMonths, startDate: o.startDate, dueDay: o.dueDay, paymentEverChanged: false }) : null), [app?.id, ready])
  const [saving, setSaving] = useState(false)
  if (!snap) return error ? <ErrorPanel onRetry={reload} /> : <PageSkeleton />
  if (!app || app.status !== 'draft') return <Navigate to="/optimize/intro" replace />
  if (!ready) return <Navigate to="/optimize/2" replace />
  if (o.paymentEverChanged) return <Navigate to="/optimize/2/resmi" replace />
  const e = est.data

  const use = async () => {
    setSaving(true)
    try {
      setApp(
        await api.applications.saveStep(app.id, {
          step: 2,
          values: { oldLoan: { outstanding: e.outstanding, rateBps: e.effectiveRateBps, rateType: null, fixedUntil: null, floatingRateBps: null, remainingMonths: e.remainingMonths, penaltyBps: null, source: 'estimate' } },
        }),
      )
      toast('Estimasi dipakai sebagai pembanding.')
      navigate('/optimize/3', { state: { milestone: 1 } })
    } catch (err) {
      toast.error(err.message)
      setSaving(false)
    }
  }

  return (
    <>
      <OptimizeHeader screen={3} reached={takeoverScreenOf(app)} title={`Pengajuan ${modeName(app.optimizationMode)}`} subtitle="KPR lama" back="/optimize/2" />
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {est.loading && !e ? (
          <Panel aria-busy="true" className="min-h-60 items-center justify-center">
            <Spinner className="size-6 text-primary" />
            <span className="text-sm text-ink-3">Menghitung kondisi KPR…</span>
          </Panel>
        ) : e ? (
          <Panel className="gap-5 sm:p-7">
            <Chip tone="info">Estimasi</Chip>
            <div className="flex flex-col gap-1.5">
              <h2 className="text-[22px] font-extrabold">Estimasi kondisi KPR</h2>
              <p className="text-sm leading-[21px] text-ink-3">Dihitung dari pinjaman awal, cicilan, dan tenor karena cicilan kamu belum pernah berubah.</p>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatTile label="Bunga efektif" value={percentBps(e.effectiveRateBps)} />
              <StatTile label="Sisa pokok" value={rupiah(e.outstanding)} />
              <StatTile label="Sisa tenor" value={`${e.remainingMonths} bulan`} />
              <StatTile label="Bulan berjalan" value={`${e.paidMonths} bulan`} />
            </div>
            <Notice tone="warn" icon={InfoIcon}>
              Ini estimasi, bukan saldo resmi dari bank.
            </Notice>
            <div className="flex flex-wrap gap-3">
              <Button onClick={use} disabled={saving} aria-busy={saving}>
                {saving && <Spinner />}
                Gunakan Estimasi
              </Button>
              <Button variant="outline" onClick={() => navigate('/optimize/2/resmi')}>
                Masukkan Angka Resmi
              </Button>
            </div>
          </Panel>
        ) : (
          <Panel className="gap-[18px] sm:p-7">
            <IconBox icon={CalculatorIcon} tone="bad" size="xl" />
            <div className="flex flex-col gap-1.5">
              <h2 className="text-[22px] font-extrabold">Estimasi tidak dapat dihitung</h2>
              <p className="text-sm leading-[21px] text-ink-3">{est.error?.message} Masukkan sisa pokok resmi dari bank agar perbandingan tetap akurat.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => navigate('/optimize/2/resmi')}>Masukkan Angka Resmi</Button>
              <Button variant="outline" onClick={() => navigate('/optimize/2')}>
                Periksa data KPR
              </Button>
            </div>
          </Panel>
        )}
        <aside className="flex flex-col gap-3 rounded-card bg-card p-6 shadow-card">
          <h2 className="text-base font-extrabold">Cara kami menghitung</h2>
          {['Pinjaman awal, cicilan, dan tenor', 'Hitung bunga efektif (bisection terbatas)', 'Kurangi cicilan yang sudah dibayar', 'Dapat sisa pokok & sisa tenor'].map((t, i) => (
            <span key={t} className="flex items-center gap-2.5 text-[13px] text-ink-2">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-extrabold text-primary">{i + 1}</span>
              {t}
            </span>
          ))}
          <p className="text-xs leading-[18px] text-muted-foreground">Metode ini hanya dipakai jika cicilan tidak pernah berubah sejak akad.</p>
        </aside>
      </div>
    </>
  )
}

export function OldLoanOfficialPage() {
  const navigate = useNavigate()
  const { snap, app, o, ready, error, reload, setApp } = useOldLoanApp()
  const changed = !!o?.paymentEverChanged
  const validate = useCallback((v) => validateOfficial(v, { originalPrincipal: o?.originalPrincipal, changed }), [o?.originalPrincipal, changed])
  const official = o?.source === 'official'
  const form = useForm(
    {
      outstanding: official ? moneyInput(o.outstanding) : '',
      rate: official ? bpsInput(o.rateBps) : '',
      rateType: official ? o.rateType ?? '' : changed ? 'floating' : '',
      fixedUntil: official ? o.fixedUntil ?? '' : '',
      floatingRate: official ? bpsInput(o.floatingRateBps) : '',
      remainingMonths: official ? intInput(o.remainingMonths) : '',
      penalty: official ? bpsInput(o.penaltyBps) : '',
    },
    validate,
  )
  const [saving, setSaving] = useState(false)
  const [apiError, setApiError] = useState('')
  if (!snap) return error ? <ErrorPanel onRetry={reload} /> : <PageSkeleton />
  if (!app || app.status !== 'draft') return <Navigate to="/optimize/intro" replace />
  if (!ready) return <Navigate to="/optimize/2" replace />
  const v = form.values
  const onSubmit = form.submit(async (x) => {
    setSaving(true)
    setApiError('')
    try {
      setApp(
        await api.applications.saveStep(app.id, {
          step: 2,
          values: {
            oldLoan: {
              outstanding: toMoney(x.outstanding),
              rateBps: toBps(x.rate),
              rateType: x.rateType,
              fixedUntil: x.rateType === 'fixed' ? x.fixedUntil : null,
              floatingRateBps: x.rateType === 'fixed' ? toBps(x.floatingRate) : null,
              remainingMonths: toInt(x.remainingMonths),
              penaltyBps: String(x.penalty).trim() ? toBps(x.penalty) : null,
              source: 'official',
            },
          },
        }),
      )
      toast('Tersimpan.')
      navigate('/optimize/3', { state: { milestone: 1 } })
    } catch (e) {
      setApiError(e.message)
      setSaving(false)
    }
  })
  return (
    <>
      <OptimizeHeader screen={3} reached={takeoverScreenOf(app)} title={`Pengajuan ${modeName(app.optimizationMode)}`} subtitle="KPR lama" back={changed ? '/optimize/2' : '/optimize/2/estimasi'} />
      <form onSubmit={onSubmit} noValidate className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-5">
          <ErrorSummary show={form.showSummary} count={Object.keys(form.errors).length} />
          <Panel className="gap-5 sm:p-7">
            <div className="flex items-start gap-3">
              <IconBox icon={FileCheckIcon} />
              <div className="flex flex-col gap-1">
                <h2 className="text-lg font-extrabold">Data KPR terbaru</h2>
                <p className="text-[13px] leading-5 text-ink-3">{changed ? 'Karena cicilan pernah berubah, masukkan data terbaru dari bank. Kami tidak menghitung balik bunga dari satu cicilan.' : 'Masukkan angka resmi dari bank untuk hasil yang lebih akurat.'}</p>
              </div>
            </div>
            <FormGrid>
              <MoneyField label="Sisa pokok saat ini" span {...form.bind('outstanding')} />
              <RateField label="Bunga saat ini" suffix="%" {...form.bind('rate')} />
              <RadioCards label="Jenis bunga" variant="pill" options={[{ value: 'fixed', label: 'Fixed' }, { value: 'floating', label: 'Floating' }]} {...form.bind('rateType')} />
              {v.rateType === 'fixed' && (
                <>
                  <DateField label="Fixed sampai" {...form.bind('fixedUntil')} />
                  <RateField label="Estimasi floating setelahnya" optional suffix="%" {...form.bind('floatingRate')} />
                </>
              )}
              <NumberField label="Sisa tenor" suffix="bulan" {...form.bind('remainingMonths')} />
              <RateField label="Penalti pelunasan dipercepat" optional suffix="%" placeholder="2,00" hint="Kosongkan jika belum tahu. Kami pakai perkiraan kebijakan bank (2%) dan menandainya estimasi." {...form.bind('penalty')} />
            </FormGrid>
          </Panel>
          {apiError && <Notice tone="bad" role="alert">{apiError}</Notice>}
          <div className="flex justify-end">
            <Button type="submit" disabled={saving} aria-busy={saving}>
              {saving && <Spinner />}
              Simpan &amp; Lanjutkan
            </Button>
          </div>
        </div>
        <Aside icon={SearchIcon} title="Di mana mencari angka ini?" note="Aplikasi atau internet banking bank lama, surat keterangan sisa pinjaman, atau rekening koran cicilan terakhir." />
      </form>
    </>
  )
}
