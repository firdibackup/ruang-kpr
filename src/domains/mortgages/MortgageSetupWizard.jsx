import { useCallback, useState } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { CheckIcon, LockIcon, PencilIcon, PlusIcon } from 'lucide-react'
import { api } from '@/data/api'
import { addDays } from '@/calculations/dates'
import { calculateDti } from '@/calculations/finance'
import { useForm, useResource } from '@/lib/hooks'
import { BANKS, CERTIFICATES, CITIES, PROPERTY_TYPES, bpsInput, dateShort, intInput, labelOf, moneyInput, percentBps, percentRatio, rupiah, tenorLabel, toBps, toInt, toMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/layout/AppShell'
import { CheckboxField, DateField, ErrorSummary, FieldError, FormGrid, MoneyField, NumberField, RadioCards, RateField, ReadonlyField, SelectField, TextField } from '@/components/shared/fields'
import { ConfirmDialog, UnsavedChangesGuard } from '@/components/shared/dialogs'
import { WizardProgress } from '@/components/shared/progress'
import { Chip, ErrorPanel, Notice, PageSkeleton, ProgressBar, Spinner, SummaryRows } from '@/components/shared/ui'
import { ReminderSettingsForm, reminderSummary } from './ReminderSettingsForm'
import { SETUP_STEPS, SETUP_TITLES } from './setupMeta'
import { validateFinanceStep, validateLoanStep, validatePropertyStep, validateRatePeriods, validateRateStep, validateReminders } from './validation'
import { DEFAULT_REMINDERS } from '@/data/seed'

const RETURN = { mykpr: '/my-kpr/overview', home: '/', profile: '/profile', rate: '/my-kpr/rate', property: '/my-kpr/property', review: '/monitoring/setup/6' }
const YES_NO = [
  { value: 'yes', label: 'Ya' },
  { value: 'no', label: 'Tidak' },
]
const CHANGED = [
  { value: 'no', label: 'Belum pernah berubah' },
  { value: 'yes', label: 'Pernah berubah' },
]
const RATE_TYPES = [
  { value: 'fixed', label: 'Fixed' },
  { value: 'floating', label: 'Floating' },
]
const SCHEMES = [
  { value: 'conventional', label: 'Konvensional' },
  { value: 'sharia', label: 'Syariah' },
]

export function MortgageSetupWizard() {
  const { step } = useParams()
  const n = Number(step)
  const [params] = useSearchParams()
  const edit = params.get('edit')
  const navigate = useNavigate()
  const { data: snap, error, reload, setData } = useResource(() => api.dashboard.getSnapshot())

  if (!(n >= 1 && n <= 6)) return <Navigate to="/monitoring/intro" replace />
  if (!snap) return error ? <ErrorPanel onRetry={reload} /> : <PageSkeleton />
  const draft = snap.mortgages.find((m) => m.status === 'draft')
  const active = snap.mortgages.find((m) => m.status === 'active')
  const editingActive = !!edit && edit !== 'review' && !draft && !!active
  const m = editingActive ? active : draft
  if (!m) return <Navigate to={active ? '/my-kpr/overview' : '/monitoring/intro'} replace />
  if (editingActive && n === 6) return <Navigate to="/my-kpr/overview" replace />
  if (m.status === 'draft' && n > m.setupStep) return <Navigate to={`/monitoring/setup/${m.setupStep}`} replace />

  const returnTo = edit ? RETURN[edit] ?? '/my-kpr/overview' : null
  const backTo = returnTo ?? (n === 1 ? '/monitoring/intro' : `/monitoring/setup/${n - 1}`)
  const onSaved = (saved, { toStep } = {}) => {
    setData((s) => ({ ...s, mortgages: s.mortgages.map((x) => (x.id === saved.id ? saved : x)) }))
    toast(edit ? 'Perubahan tersimpan.' : 'Tersimpan.')
    navigate(toStep ? `/monitoring/setup/${toStep}` : returnTo ?? `/monitoring/setup/${n + 1}`)
  }
  const common = { m, clock: snap.clock, onSaved, editing: !!edit, backTo, navigate }

  return (
    <>
      <PageHeader title={edit ? 'Edit Data KPR' : 'Tambahkan KPR'} subtitle={SETUP_TITLES[n - 1]} back={backTo} />
      {!editingActive && <WizardProgress label={`Step ${n}/6 — ${SETUP_STEPS[n - 1]}`} steps={SETUP_STEPS} current={n} reached={m.setupStep} savedLabel="Tersimpan setiap klik Simpan & Lanjutkan" />}
      {editingActive && (
        <Notice tone="info" title="Kamu sedang mengubah KPR aktif">
          Perubahan sisa pokok, bunga, atau tenor akan menghitung ulang proyeksi pembayaran, reminder, dan KPR Health.
        </Notice>
      )}
      {n === 1 && <LoanStep {...common} />}
      {n === 2 && <RateStep {...common} />}
      {n === 3 && <PropertyStep {...common} />}
      {n === 4 && <FinanceStep {...common} />}
      {n === 5 && <ReminderStep {...common} />}
      {n === 6 && <ReviewStep {...common} />}
    </>
  )
}

function SetupLayout({ children, aside, footer, onSubmit }) {
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-wrap items-start gap-6">
      <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-7 rounded-card bg-card p-5 shadow-card sm:p-7">
        {children}
        <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4">{footer}</div>
      </div>
      <aside className="flex flex-[1_1_280px] flex-col gap-4 lg:sticky lg:top-6">
        {aside}
        <div className="flex flex-col gap-3 rounded-3xl border border-border bg-card p-[22px]">
          <LockIcon className="size-5 text-primary" aria-hidden />
          <p className="text-sm leading-[21px] text-ink-2">Data yang kamu masukkan tidak akan dikirim ke bank sampai kamu memilih “Ajukan Sekarang”.</p>
        </div>
      </aside>
    </form>
  )
}

function Section({ title, desc, children }) {
  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex flex-col gap-1.5">
        <h2 className="text-xl font-extrabold">{title}</h2>
        {desc && <p className="text-sm leading-[21px] text-muted-foreground">{desc}</p>}
      </div>
      {children}
    </div>
  )
}

function Footer({ editing, backTo, navigate, saving, label, disabled, extra }) {
  return (
    <>
      <Button variant="neutral" onClick={() => navigate(backTo)}>
        {editing ? 'Batal' : 'Kembali'}
      </Button>
      <div className="flex flex-col-reverse gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-[18px]">
        {extra}
        <Button type="submit" disabled={saving} aria-busy={saving} className={disabled ? 'bg-border text-ink-3 hover:bg-border' : ''}>
          {saving && <Spinner />}
          {saving ? 'Menyimpan…' : label ?? (editing ? 'Simpan Perubahan' : 'Simpan & Lanjutkan')}
        </Button>
      </div>
    </>
  )
}

function useSave(m, step, onSaved) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const save = async (values, opts) => {
    setSaving(true)
    setError('')
    try {
      const saved = await api.mortgages.saveSetupStep(m.id, { step, values })
      onSaved(saved, opts)
    } catch (e) {
      setError(e.message)
      setSaving(false)
    }
  }
  return { saving, error, save }
}

// ---------- Step 1 ----------
function LoanStep({ m, clock, onSaved, editing, backTo, navigate }) {
  const known = BANKS.some((b) => b.value === m.bankName)
  const validate = useCallback((v) => validateLoanStep(v, { today: clock }), [clock])
  const form = useForm(
    {
      bankName: !m.bankName ? '' : known ? m.bankName : 'Bank lainnya',
      bankOther: known ? '' : m.bankName ?? '',
      productName: m.productName ?? '',
      scheme: m.scheme ?? 'conventional',
      originalPrincipal: moneyInput(m.originalPrincipal),
      currentPayment: moneyInput(m.currentPayment),
      originalTenorMonths: intInput(m.originalTenorMonths),
      startDate: m.startDate ?? '',
      dueDay: intInput(m.dueDay),
      knowsOutstanding: m.status === 'active' ? 'yes' : m.knowsOutstanding == null ? '' : m.knowsOutstanding ? 'yes' : 'no',
      outstandingPrincipal: moneyInput(m.outstandingPrincipal),
      remainingTenorMonths: intInput(m.remainingTenorMonths),
    },
    validate,
  )
  const { saving, error, save } = useSave(m, 1, onSaved)
  const v = form.values
  const tenor = toInt(v.originalTenorMonths)
  const onSubmit = form.submit((x) =>
    save({
      bankName: x.bankName === 'Bank lainnya' ? x.bankOther.trim() : x.bankName,
      productName: x.productName.trim() || null,
      scheme: x.scheme,
      originalPrincipal: toMoney(x.originalPrincipal),
      currentPayment: toMoney(x.currentPayment),
      originalTenorMonths: toInt(x.originalTenorMonths),
      startDate: x.startDate,
      dueDay: toInt(x.dueDay),
      knowsOutstanding: x.knowsOutstanding === 'yes',
      outstandingPrincipal: x.knowsOutstanding === 'yes' ? toMoney(x.outstandingPrincipal) : null,
      remainingTenorMonths: x.knowsOutstanding === 'yes' ? toInt(x.remainingTenorMonths) : null,
      outstandingEstimated: x.knowsOutstanding === 'yes' ? false : m.outstandingEstimated ?? false,
    }),
  )
  return (
    <SetupLayout onSubmit={onSubmit} footer={<Footer editing={editing} backTo={backTo} navigate={navigate} saving={saving} />}>
      <UnsavedChangesGuard when={form.dirty && !saving} />
      <ErrorSummary show={form.showSummary} count={Object.keys(form.errors).length} />
      <Section title="Data KPR kamu">
        <FormGrid>
          <SelectField label="Bank" options={BANKS} {...form.bind('bankName')} />
          {v.bankName === 'Bank lainnya' ? <TextField label="Nama bank" placeholder="Nama bank kamu" {...form.bind('bankOther')} /> : <TextField label="Nama produk KPR" optional placeholder="KPR Fixed 5 Tahun" maxLength={100} {...form.bind('productName')} />}
          {v.bankName === 'Bank lainnya' && <TextField label="Nama produk KPR" optional placeholder="KPR Fixed 5 Tahun" maxLength={100} span {...form.bind('productName')} />}
          <RadioCards label="Jenis KPR" options={SCHEMES} span {...form.bind('scheme')} />
          {v.scheme === 'sharia' && (
            <Notice tone="warn" className="sm:col-span-2">
              Versi ini menghitung jadwal dengan metode anuitas konvensional. Untuk KPR syariah, reminder tetap aktif tetapi amortisasi dan simulasi belum tersedia.
            </Notice>
          )}
          <MoneyField label="Jumlah pinjaman awal" placeholder="600.000.000" {...form.bind('originalPrincipal')} />
          <MoneyField label="Cicilan bulanan saat ini" placeholder="4.250.000" {...form.bind('currentPayment')} />
          <NumberField label="Tenor awal" placeholder="240" suffix="bulan" hint={tenor ? `${tenor} bulan = ${tenorLabel(tenor)}` : ''} {...form.bind('originalTenorMonths')} />
          <DateField label="Tanggal akad" max={clock} {...form.bind('startDate')} />
          <NumberField label="Jatuh tempo setiap tanggal" placeholder="22" maxLength={2} hint={toInt(v.dueDay) > 28 ? 'Di bulan tanpa tanggal ini, jatuh tempo pada hari terakhir bulan.' : ''} {...form.bind('dueDay')} />
          {m.status !== 'active' && <RadioCards label="Apakah kamu tahu sisa pokok terbaru?" options={YES_NO} span {...form.bind('knowsOutstanding')} />}
          {v.knowsOutstanding === 'yes' && (
            <>
              <MoneyField label="Sisa pokok saat ini" placeholder="415.000.000" {...form.bind('outstandingPrincipal')} />
              <NumberField label="Sisa tenor" placeholder="183" suffix="bulan" {...form.bind('remainingTenorMonths')} />
            </>
          )}
        </FormGrid>
        {v.knowsOutstanding === 'no' && <Notice tone="muted">Tidak apa-apa. Di step berikutnya kami coba estimasi sisa pokok dan sisa tenor.</Notice>}
      </Section>
      {error && <Notice tone="bad" role="alert">{error}</Notice>}
    </SetupLayout>
  )
}

// ---------- Step 2 ----------
function RateStep({ m, onSaved, editing, backTo, navigate }) {
  const [estimate, setEstimate] = useState(null)
  const [estimating, setEstimating] = useState(false)
  const [estimateError, setEstimateError] = useState('')
  const [periodsOpen, setPeriodsOpen] = useState((m.rateHistory ?? []).length > 0)
  const [periods, setPeriods] = useState(() => (m.rateHistory ?? []).filter((p) => p.endDate).map((p) => ({ id: p.id, type: p.type, rate: bpsInput(p.rateBps), startDate: p.startDate, endDate: p.endDate, editing: false })))
  const validate = useCallback((v) => validateRateStep(v, { mortgage: m }), [m])
  const form = useForm(
    {
      paymentEverChanged: m.paymentEverChanged == null ? '' : m.paymentEverChanged ? 'yes' : 'no',
      currentRate: bpsInput(m.currentRateBps),
      currentRateType: m.currentRateType ?? '',
      fixedUntil: m.fixedUntil ?? '',
      estimatedFloatingRate: bpsInput(m.estimatedFloatingRateBps),
      outstandingPrincipal: moneyInput(m.outstandingPrincipal),
      remainingTenorMonths: intInput(m.remainingTenorMonths),
      currentPayment: moneyInput(m.currentPayment),
      official: false,
    },
    validate,
  )
  const { saving, error, save } = useSave(m, 2, onSaved)
  const v = form.values
  const changed = v.paymentEverChanged === 'yes'
  const needsEstimate = v.paymentEverChanged === 'no' && !m.knowsOutstanding && !v.official
  const periodErrors = validateRatePeriods(periods)
  const periodsInvalid = periodsOpen && periodErrors.some(Boolean)

  const buildValues = (x, est) => ({
    paymentEverChanged: x.paymentEverChanged === 'yes',
    currentRateBps: toBps(x.currentRate),
    currentRateType: x.currentRateType,
    fixedUntil: x.currentRateType === 'fixed' ? x.fixedUntil : null,
    estimatedFloatingRateBps: x.currentRateType === 'fixed' ? toBps(x.estimatedFloatingRate) : null,
    ...(est
      ? { outstandingPrincipal: est.outstanding, remainingTenorMonths: est.remainingMonths, outstandingEstimated: true, knowsOutstanding: true }
      : changed || x.official
        ? { outstandingPrincipal: toMoney(x.outstandingPrincipal), remainingTenorMonths: toInt(x.remainingTenorMonths), outstandingEstimated: false, knowsOutstanding: true }
        : {}),
    ...(changed ? { currentPayment: toMoney(x.currentPayment) } : {}),
    rateHistory: periodsOpen ? [...periods].sort((a, b) => a.startDate.localeCompare(b.startDate)).map((p, i) => ({ id: p.id ?? `rtp_${i + 1}`, type: p.type, rateBps: toBps(p.rate), startDate: p.startDate, endDate: p.endDate })) : [],
  })

  const runEstimate = async () => {
    setEstimating(true)
    setEstimateError('')
    try {
      setEstimate(await api.mortgages.estimate({ originalPrincipal: m.originalPrincipal, currentPayment: m.currentPayment, originalTenorMonths: m.originalTenorMonths, startDate: m.startDate, dueDay: m.dueDay, paymentEverChanged: false }))
    } catch (e) {
      setEstimateError(e.message)
    } finally {
      setEstimating(false)
    }
  }
  const onSubmit = form.submit(async (x) => {
    if (periodsInvalid) return toast.error('Periksa riwayat bunga yang ditandai.')
    if (needsEstimate && !estimate) return runEstimate()
    if (needsEstimate && estimate) return // choose an action on the estimate card
    await save(buildValues(x))
  })
  const addPeriod = () => {
    const last = periods.at(-1)
    setPeriods([...periods, { id: `new_${periods.length + 1}`, type: 'fixed', rate: '', startDate: last?.endDate ? addDays(last.endDate, 1) : m.startDate ?? '', endDate: '', editing: true }])
  }
  const setPeriod = (id, patch) => setPeriods((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)))
  const floating = toBps(v.estimatedFloatingRate)

  return (
    <SetupLayout
      onSubmit={onSubmit}
      footer={<Footer editing={editing} backTo={backTo} navigate={navigate} saving={saving || estimating} label={needsEstimate && !estimate ? 'Hitung Kondisi KPR' : undefined} disabled={!v.paymentEverChanged} />}
    >
      <UnsavedChangesGuard when={form.dirty && !saving} />
      <ErrorSummary show={form.showSummary} count={Object.keys(form.errors).length} />
      <Section title="Bunga dan cicilan">
        <RadioCards label="Apakah cicilan kamu pernah naik atau berubah sejak akad?" hint="Contoh perubahan: masa fixed berakhir, bunga naik, atau cicilan berubah." options={CHANGED} {...form.bind('paymentEverChanged')} onChange={(x) => { form.setValues({ ...v, paymentEverChanged: x, currentRateType: x === 'yes' && !v.currentRateType ? 'floating' : v.currentRateType, official: false }); setEstimate(null) }} />
      </Section>

      {v.paymentEverChanged === 'no' && (
        <Section title="Bunga KPR kamu">
          <FormGrid>
            <RateField label="Bunga saat ini" {...form.bind('currentRate')} />
            <RadioCards label="Jenis bunga saat ini" options={RATE_TYPES} {...form.bind('currentRateType')} />
            {v.currentRateType === 'fixed' && (
              <>
                <DateField label="Masa fixed berakhir" {...form.bind('fixedUntil')} />
                <RateField label="Estimasi bunga floating" optional placeholder="9,00" hint="Dipakai untuk peringatan & amortisasi. Selalu ditandai estimasi." {...form.bind('estimatedFloatingRate')} />
              </>
            )}
          </FormGrid>
        </Section>
      )}

      {(changed || (v.paymentEverChanged === 'no' && v.official)) && (
        <Section title={changed ? 'Data KPR terbaru' : 'Angka resmi dari bank'} desc={changed ? 'Karena cicilan pernah berubah, gunakan angka terbaru dari bank (aplikasi bank atau rekening koran KPR) agar simulasi akurat.' : 'Lihat di aplikasi bank atau rekening koran KPR kamu.'}>
          <FormGrid>
            <MoneyField label="Sisa pokok saat ini" placeholder="415.000.000" {...form.bind('outstandingPrincipal')} />
            <NumberField label="Sisa tenor" placeholder="166" suffix="bulan" {...form.bind('remainingTenorMonths')} />
            {changed && (
              <>
                <MoneyField label="Cicilan saat ini" placeholder="5.050.000" {...form.bind('currentPayment')} />
                <RateField label="Bunga saat ini" {...form.bind('currentRate')} />
                <RadioCards label="Jenis bunga saat ini" options={RATE_TYPES} span {...form.bind('currentRateType')} />
                {v.currentRateType === 'fixed' && (
                  <>
                    <DateField label="Masa fixed berakhir" {...form.bind('fixedUntil')} />
                    <RateField label="Estimasi bunga floating" optional placeholder="9,00" {...form.bind('estimatedFloatingRate')} />
                  </>
                )}
              </>
            )}
          </FormGrid>
        </Section>
      )}

      {needsEstimate && estimateError && (
        <Notice tone="bad" role="alert" title="Estimasi tidak dapat dihitung" action={<button type="button" className="text-[13px] font-bold text-primary underline" onClick={() => form.set('official', true)}>Masukkan angka resmi</button>}>
          {estimateError} Periksa data di step 1 atau masukkan sisa pokok resmi dari bank.
        </Notice>
      )}
      {needsEstimate && estimate && (
        <div className="flex flex-col gap-3.5 rounded-3xl border border-[#cfdcf3] bg-[#f3f7fe] p-[22px]" role="status">
          <h3 className="text-[17px] font-extrabold">Estimasi kondisi KPR</h3>
          <SummaryRows
            rows={[
              { k: 'Estimasi bunga efektif', v: percentBps(estimate.effectiveRateBps) },
              { k: 'Estimasi sisa pokok', v: rupiah(estimate.outstanding) },
              { k: 'Estimasi sisa tenor', v: `${estimate.remainingMonths} bulan` },
              { k: 'Cicilan sudah dibayar', v: `${estimate.paidMonths} kali` },
            ]}
          />
          {toBps(v.currentRate) && Math.abs(toBps(v.currentRate) - estimate.effectiveRateBps) > 25 && <Notice tone="warn">Bunga yang kamu isi ({v.currentRate}%) berbeda dari bunga efektif hasil hitung. Bila ragu, gunakan angka resmi dari bank.</Notice>}
          <p className="text-[13px] leading-5 text-ink-3">Ini estimasi berdasarkan pinjaman awal, cicilan, dan tenor yang kamu masukkan — bukan saldo resmi bank.</p>
          <div className="flex flex-wrap gap-2.5">
            <Button size="md" type="button" disabled={saving} onClick={form.submit((x) => save(buildValues(x, estimate)))}>
              {saving && <Spinner />}
              Gunakan Estimasi
            </Button>
            <Button size="md" type="button" variant="outline" onClick={() => { form.set('official', true); setEstimate(null) }}>
              Saya Punya Angka Resmi
            </Button>
          </div>
        </div>
      )}

      {v.paymentEverChanged && !periodsOpen && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-dashed border-[#c9d3e3] px-[18px] py-4">
          <span className="text-sm text-ink-2">KPR kamu punya lebih dari satu periode fixed?</span>
          <Button variant="outline" size="xs" onClick={() => { setPeriodsOpen(true); if (!periods.length) addPeriod() }}>
            Tambahkan riwayat bunga
          </Button>
        </div>
      )}
      {periodsOpen && (
        <div className="flex flex-col gap-3.5">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-xl font-extrabold">Riwayat bunga</h2>
            <button type="button" onClick={() => setPeriodsOpen(false)} className="min-h-11 text-[13px] font-bold text-muted-foreground">
              Lewati riwayat
            </button>
          </div>
          {periods.map((p, i) => (
            <div key={p.id} className={cn('flex flex-col gap-3 rounded-2xl border bg-card px-[18px] py-4', periodErrors[i] ? 'border-brand-red' : 'border-border')}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-bold text-muted-foreground">Periode {i + 1}</span>
                  <span className="text-[15px] font-extrabold">
                    {p.type === 'fixed' ? 'Fixed' : 'Floating'} · {p.rate ? `${p.rate}%` : '–'}
                  </span>
                  <span className="text-[13px] text-ink-3">
                    {dateShort(p.startDate)} – {dateShort(p.endDate)}
                  </span>
                </div>
                <div className="flex gap-3.5">
                  <button type="button" onClick={() => setPeriod(p.id, { editing: !p.editing })} className="min-h-11 text-[13px] font-bold text-primary">
                    {p.editing ? 'Selesai' : 'Ubah'}
                  </button>
                  <button type="button" onClick={() => setPeriods((ps) => ps.filter((x) => x.id !== p.id))} className="min-h-11 text-[13px] font-bold text-danger">
                    Hapus
                  </button>
                </div>
              </div>
              {p.editing && (
                <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
                  <label className="flex flex-col gap-1.5 text-xs font-semibold text-ink-3">
                    Jenis
                    <select value={p.type} onChange={(e) => setPeriod(p.id, { type: e.target.value })} className="h-11 rounded-md border border-input bg-field px-3 text-sm text-foreground">
                      <option value="fixed">Fixed</option>
                      <option value="floating">Floating</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1.5 text-xs font-semibold text-ink-3">
                    Rate (%)
                    <input value={p.rate} inputMode="decimal" onChange={(e) => setPeriod(p.id, { rate: e.target.value.replace(/[^\d,]/g, '') })} className="h-11 rounded-md border border-input bg-field px-3 text-sm text-foreground" />
                  </label>
                  <label className="flex flex-col gap-1.5 text-xs font-semibold text-ink-3">
                    Mulai
                    <input type="date" value={p.startDate} onChange={(e) => setPeriod(p.id, { startDate: e.target.value })} className="h-11 rounded-md border border-input bg-field px-3 text-sm text-foreground" />
                  </label>
                  <label className="flex flex-col gap-1.5 text-xs font-semibold text-ink-3">
                    Berakhir
                    <input type="date" value={p.endDate} onChange={(e) => setPeriod(p.id, { endDate: e.target.value })} className="h-11 rounded-md border border-input bg-field px-3 text-sm text-foreground" />
                  </label>
                </div>
              )}
              {periodErrors[i] && <FieldError>{periodErrors[i]}</FieldError>}
            </div>
          ))}
          {v.currentRateType === 'fixed' && v.fixedUntil && (
            <div className="flex flex-col gap-0.5 rounded-2xl border border-dashed border-warning-accent bg-[#fffcf3] px-[18px] py-4">
              <span className="text-xs font-bold text-warning">Periode berikutnya</span>
              <span className="text-[15px] font-extrabold">Floating · {floating ? `estimasi ${percentBps(floating)}` : 'estimasi belum diisi'}</span>
              <span className="text-[13px] text-ink-3">Mulai {dateShort(addDays(v.fixedUntil, 1))}</span>
            </div>
          )}
          <Button variant="outline" size="xs" className="w-fit" onClick={addPeriod}>
            <PlusIcon aria-hidden />
            Tambah Periode Bunga
          </Button>
        </div>
      )}
      {error && <Notice tone="bad" role="alert">{error}</Notice>}
    </SetupLayout>
  )
}

// ---------- Step 3 ----------
function PropertyStep({ m, clock, onSaved, editing, backTo, navigate }) {
  const p = m.property ?? {}
  const [later, setLater] = useState(!!p.valueLater && !p.estimatedValue)
  const [confirmLater, setConfirmLater] = useState(false)
  const validate = useCallback((v) => validatePropertyStep(v, { today: clock, later }), [clock, later])
  const form = useForm(
    {
      type: p.type ?? '',
      city: p.city ?? '',
      address: p.address ?? '',
      landArea: intInput(p.landArea),
      buildingArea: intInput(p.buildingArea),
      certificateType: p.certificateType ?? '',
      certificateOwner: p.certificateOwner ?? '',
      estimatedValue: moneyInput(p.estimatedValue),
      valueAsOf: p.valueAsOf ?? clock,
      disputed: p.disputed == null ? 'no' : p.disputed ? 'yes' : 'no',
    },
    validate,
  )
  const { saving, error, save } = useSave(m, 3, onSaved)
  const v = form.values
  const toValues = (x, valueLater) => ({
    property: {
      type: x.type,
      city: x.city,
      address: x.address.trim(),
      landArea: toInt(x.landArea),
      buildingArea: toInt(x.buildingArea),
      certificateType: x.certificateType,
      certificateOwner: x.certificateOwner.trim(),
      estimatedValue: valueLater ? null : toMoney(x.estimatedValue),
      valueAsOf: valueLater ? null : x.valueAsOf,
      disputed: x.disputed === 'yes',
      valueLater,
    },
  })
  const onSubmit = form.submit((x) => save(toValues(x, later)))

  return (
    <SetupLayout
      onSubmit={onSubmit}
      footer={
        <Footer
          editing={editing}
          backTo={backTo}
          navigate={navigate}
          saving={saving}
          extra={
            !later && !editing && (
              <button type="button" onClick={() => setConfirmLater(true)} className="min-h-11 text-sm font-bold text-primary">
                Isi nilai properti nanti
              </button>
            )
          }
        />
      }
    >
      <UnsavedChangesGuard when={form.dirty && !saving} />
      <ErrorSummary show={form.showSummary} count={Object.keys(form.errors).length} />
      <Section title="Data properti">
        <FormGrid>
          <SelectField label="Jenis properti" options={PROPERTY_TYPES} {...form.bind('type')} />
          <SelectField label="Kota/Kabupaten" options={CITIES} {...form.bind('city')} />
          <TextField label="Alamat properti" placeholder="Griya Asri Blok C2, Bekasi" span {...form.bind('address')} />
          <NumberField label="Luas tanah" optional={v.type === 'apartment'} suffix="m²" placeholder="72" {...form.bind('landArea')} />
          <NumberField label="Luas bangunan" suffix="m²" placeholder="45" {...form.bind('buildingArea')} />
          <SelectField label="Status sertifikat" options={CERTIFICATES} {...form.bind('certificateType')} />
          <TextField label="Nama pemilik sertifikat" placeholder="Firdi Audi" {...form.bind('certificateOwner')} />
          {!later && (
            <>
              <MoneyField label="Estimasi nilai properti sekarang" placeholder="850.000.000" hint="Nilai ini bukan appraisal resmi." {...form.bind('estimatedValue')} />
              <DateField label="Nilai terakhir diperbarui" max={clock} {...form.bind('valueAsOf')} />
            </>
          )}
          <RadioCards label="Apakah properti sedang bersengketa?" options={[{ value: 'no', label: 'Tidak' }, { value: 'yes', label: 'Ya' }]} span {...form.bind('disputed')} />
        </FormGrid>
        {v.disputed === 'yes' && <Notice tone="warn" role="note">Beberapa produk pinjaman mungkin memerlukan pemeriksaan manual. Pemantauan KPR tetap bisa diaktifkan.</Notice>}
        {later && (
          <Notice tone="muted" action={<button type="button" className="text-[13px] font-bold text-primary underline" onClick={() => setLater(false)}>Isi sekarang</button>}>
            Nilai properti akan diisi nanti. Reminder KPR tetap bisa digunakan.
          </Notice>
        )}
      </Section>
      {error && <Notice tone="bad" role="alert">{error}</Notice>}
      <ConfirmDialog
        open={confirmLater}
        onOpenChange={setConfirmLater}
        destructive={false}
        title="Isi nilai properti nanti?"
        body="Tanpa nilai properti, equity, LTV, Refinancing + Top-up, dan Multiguna belum dapat dihitung lengkap."
        note="Reminder KPR tetap bisa digunakan."
        cancelLabel="Kembali Isi Nilai"
        confirmLabel="Tetap Isi Nanti"
        onConfirm={async () => {
          const errs = validatePropertyStep(form.values, { today: clock, later: true })
          if (Object.keys(errs).length) {
            setLater(true)
            toast('Lengkapi data properti lain dulu, lalu simpan.')
            return
          }
          setLater(true)
          await save(toValues(form.values, true))
        }}
      />
    </SetupLayout>
  )
}

// ---------- Step 4 ----------
function FinanceStep({ m, onSaved, editing, backTo, navigate }) {
  const f = m.finance ?? {}
  const form = useForm(
    {
      monthlyIncome: moneyInput(f.monthlyIncome),
      jointIncome: f.jointIncome ?? false,
      partnerIncome: moneyInput(f.partnerIncome),
      vehicleDebt: moneyInput(f.vehicleDebt),
      cardDebt: moneyInput(f.cardDebt),
      otherDebt: moneyInput(f.otherDebt),
      routineExpenses: moneyInput(f.routineExpenses),
      emergencyFund: moneyInput(f.emergencyFund),
    },
    validateFinanceStep,
  )
  const { saving, error, save } = useSave(m, 4, onSaved)
  const v = form.values
  const income = (toMoney(v.monthlyIncome) ?? 0) + (v.jointIncome ? toMoney(v.partnerIncome) ?? 0 : 0)
  const other = (toMoney(v.vehicleDebt) ?? 0) + (toMoney(v.cardDebt) ?? 0) + (toMoney(v.otherDebt) ?? 0)
  const dti = income > 0 ? calculateDti({ monthlyIncome: income, mortgagePayment: m.currentPayment ?? 0, otherMonthlyDebt: other }) : null
  const status = !dti ? null : dti.dtiRatio < 0.3 ? ['Sehat', 'ok', 'bg-success-strong'] : dti.dtiRatio <= 0.4 ? ['Perlu diperhatikan', 'warn', 'bg-warning-accent'] : ['Tinggi', 'bad', 'bg-brand-red']
  const onSubmit = form.submit((x) =>
    save({
      finance: {
        monthlyIncome: toMoney(x.monthlyIncome),
        jointIncome: x.jointIncome,
        partnerIncome: x.jointIncome ? toMoney(x.partnerIncome) : null,
        vehicleDebt: toMoney(x.vehicleDebt) ?? 0,
        cardDebt: toMoney(x.cardDebt) ?? 0,
        otherDebt: toMoney(x.otherDebt) ?? 0,
        routineExpenses: toMoney(x.routineExpenses),
        emergencyFund: toMoney(x.emergencyFund),
      },
    }),
  )
  return (
    <SetupLayout
      onSubmit={onSubmit}
      footer={<Footer editing={editing} backTo={backTo} navigate={navigate} saving={saving} />}
      aside={
        <section className="flex flex-col gap-3 rounded-3xl bg-card p-[22px] shadow-card" aria-live="polite">
          <span className="text-[13px] font-extrabold text-ink-3">Ringkasan realtime</span>
          <div className="flex justify-between text-sm">
            <span className="text-ink-3">Total cicilan</span>
            <span className="font-extrabold">{rupiah((m.currentPayment ?? 0) + other)}/bulan</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-ink-3">Rasio cicilan (DTI)</span>
            <span className="font-extrabold">{dti ? percentRatio(dti.dtiRatio) : 'Belum tersedia'}</span>
          </div>
          <ProgressBar value={dti ? Math.min(100, dti.dtiRatio * 100) : 0} label="Rasio cicilan terhadap penghasilan" barClassName={status?.[2]} />
          {status && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink-3">Status sementara</span>
              <Chip tone={status[1]}>{status[0]}</Chip>
            </div>
          )}
          <p className="text-xs leading-[18px] text-muted-foreground">Ini bukan keputusan kelayakan dari bank. Data hanya untuk analisis dan simulasi KPR kamu.</p>
        </section>
      }
    >
      <UnsavedChangesGuard when={form.dirty && !saving} />
      <ErrorSummary show={form.showSummary} count={Object.keys(form.errors).length} />
      <Section title="Kondisi keuangan">
        <FormGrid>
          <MoneyField label="Penghasilan bulanan" placeholder="15.000.000" {...form.bind('monthlyIncome')} />
          <ReadonlyField label="Cicilan KPR saat ini" value={rupiah(m.currentPayment)} onEdit={() => navigate(`/monitoring/setup/1${editing ? '?edit=mykpr' : ''}`)} />
          <CheckboxField label="Gabungkan pendapatan pasangan" span checked={v.jointIncome} onChange={(x) => form.setValues({ ...v, jointIncome: x, partnerIncome: x ? v.partnerIncome : '' })} />
          {v.jointIncome && <MoneyField label="Penghasilan pasangan" placeholder="8.000.000" span {...form.bind('partnerIncome')} />}
          <MoneyField label="Cicilan kendaraan" placeholder="0" {...form.bind('vehicleDebt')} />
          <MoneyField label="Kartu kredit / paylater" placeholder="0" {...form.bind('cardDebt')} />
          <MoneyField label="Pinjaman lainnya" placeholder="0" {...form.bind('otherDebt')} />
          <MoneyField label="Pengeluaran rutin" optional placeholder="5.000.000" {...form.bind('routineExpenses')} />
          <MoneyField label="Dana darurat" optional placeholder="30.000.000" span {...form.bind('emergencyFund')} />
        </FormGrid>
      </Section>
      {error && <Notice tone="bad" role="alert">{error}</Notice>}
    </SetupLayout>
  )
}

// ---------- Step 5 ----------
function ReminderStep({ m, clock, onSaved, editing, backTo, navigate }) {
  const isFixed = m.currentRateType === 'fixed' && !!m.fixedUntil && m.fixedUntil > clock
  const [reminders, setReminders] = useState(() => {
    const r = structuredClone(m.reminders ?? DEFAULT_REMINDERS)
    return isFixed ? r : { ...r, fixedExpiry: [] }
  })
  const [tried, setTried] = useState(false)
  const errors = validateReminders(reminders)
  const { saving, error, save } = useSave(m, 5, onSaved)
  const onSubmit = (e) => {
    e.preventDefault()
    setTried(true)
    if (Object.keys(errors).length) return
    save({ reminders })
  }
  return (
    <SetupLayout onSubmit={onSubmit} footer={<Footer editing={editing} backTo={backTo} navigate={navigate} saving={saving} />}>
      <Section title="Atur reminder" desc="Pengaturan default sudah dipilih. Ubah bila perlu.">
        <ReminderSettingsForm value={reminders} onChange={setReminders} dueDay={m.dueDay} isFixed={isFixed} fixedUntil={m.fixedUntil} errors={tried ? errors : {}} />
      </Section>
      {error && <Notice tone="bad" role="alert">{error}</Notice>}
    </SetupLayout>
  )
}

// ---------- Step 6 ----------
function ReviewStep({ m, clock, navigate }) {
  const [agree, setAgree] = useState(false)
  const [tried, setTried] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const isFixed = m.currentRateType === 'fixed' && m.fixedUntil > clock
  const r = reminderSummary(m.reminders ?? DEFAULT_REMINDERS, isFixed)
  const f = m.finance ?? {}
  const income = (f.monthlyIncome ?? 0) + (f.jointIncome ? f.partnerIncome ?? 0 : 0)
  const dti = income > 0 ? calculateDti({ monthlyIncome: income, mortgagePayment: m.currentPayment ?? 0, otherMonthlyDebt: (f.vehicleDebt ?? 0) + (f.cardDebt ?? 0) + (f.otherDebt ?? 0) }) : null
  const edit = (step) => () => navigate(`/monitoring/setup/${step}?edit=review`)
  const sections = [
    { title: 'KPR Saat Ini', step: 1, lines: [`${m.bankName}${m.productName ? ` · ${m.productName}` : ''}`, `Pinjaman awal ${rupiah(m.originalPrincipal)}`, `Sisa pokok ${rupiah(m.outstandingPrincipal)}${m.outstandingEstimated ? ' (estimasi)' : ''}`, `Cicilan ${rupiah(m.currentPayment)}/bulan`, `Sisa tenor ${m.remainingTenorMonths ?? '–'} bulan`] },
    { title: 'Bunga', step: 2, lines: m.currentRateType === 'floating' ? [`Floating ${percentBps(m.currentRateBps)}`, `${(m.rateHistory ?? []).length ? `Riwayat: ${m.rateHistory.length} periode` : 'Tanpa riwayat periode'}`] : [`Fixed ${percentBps(m.currentRateBps)} sampai ${dateShort(m.fixedUntil)}`, m.estimatedFloatingRateBps ? `Estimasi floating ${percentBps(m.estimatedFloatingRateBps)}` : 'Estimasi floating belum diisi'] },
    { title: 'Properti', step: 3, lines: [`${labelOf(PROPERTY_TYPES, m.property?.type)} · ${labelOf(CERTIFICATES, m.property?.certificateType)}`, m.property?.estimatedValue ? `Estimasi nilai ${rupiah(m.property.estimatedValue)}` : 'Nilai properti: Belum diisi'] },
    { title: 'Kondisi Keuangan', step: 4, lines: [`Penghasilan ${rupiah(income)}`, `Rasio cicilan ${dti ? percentRatio(dti.dtiRatio) : 'Belum tersedia'}`] },
    { title: 'Reminder', step: 5, lines: [`Bayar: ${r.pay}`, `Fixed: ${r.fixed}`, `Kanal: ${r.ch}`] },
  ]
  const activate = async (e) => {
    e.preventDefault()
    setTried(true)
    if (!agree || pending) return
    setPending(true)
    setError('')
    try {
      const res = await api.mortgages.activate(m.id, { confirmDataCorrect: true })
      navigate('/monitoring/success', { replace: true, state: { scheduled: res.scheduledReminderCount } })
    } catch (err) {
      setError(err.message)
      setPending(false)
    }
  }
  return (
    <SetupLayout
      onSubmit={activate}
      footer={
        <>
          <Button variant="neutral" onClick={() => navigate('/monitoring/setup/5')}>
            Kembali
          </Button>
          <Button type="submit" disabled={pending} aria-busy={pending} className={!agree ? 'bg-border text-ink-3 hover:bg-border' : ''}>
            {pending && <Spinner />}
            {pending ? 'Mengaktifkan…' : 'Aktifkan Pemantauan KPR'}
          </Button>
        </>
      }
    >
      <Section title="Periksa data KPR kamu">
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
          {sections.map((s) => (
            <div key={s.title} className="flex flex-col gap-2.5 rounded-[18px] border border-border px-5 py-[18px]">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-[15px] font-extrabold">{s.title}</h3>
                <button type="button" onClick={edit(s.step)} className="flex min-h-11 items-center gap-1.5 text-[13px] font-bold text-primary">
                  <PencilIcon className="size-3.5" aria-hidden />
                  Edit
                </button>
              </div>
              {s.lines.map((l) => (
                <span key={l} className="text-sm leading-5 text-ink-2">
                  {l}
                </span>
              ))}
            </div>
          ))}
        </div>
        <CheckboxField label="Data yang saya masukkan benar" checked={agree} onChange={setAgree} error={tried && !agree ? 'Centang konfirmasi data dulu.' : undefined} />
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <CheckIcon className="size-3.5 text-success" aria-hidden />
          Aktivasi tidak membuat pengajuan ke bank.
        </p>
      </Section>
      {error && <Notice tone="bad" role="alert">{error} Draft dan pilihanmu tetap tersimpan.</Notice>}
    </SetupLayout>
  )
}
