import { useCallback, useState } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { CheckIcon, ChevronDownIcon, LockIcon, PencilIcon } from 'lucide-react'
import { api } from '@/data/api'
import { DEFAULT_REMINDERS } from '@/data/seed'
import { daysUntil } from '@/calculations/dates'
import { calculateMaxPrincipal } from '@/calculations/finance'
import { useForm, useResource } from '@/lib/hooks'
import { BANKS, bpsInput, dateShort, daysLabel, intInput, moneyInput, rupiahShort, toBps, toInt, toMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/layout/AppShell'
import { CheckboxField, DateField, ErrorSummary, FormGrid, MoneyField, NumberField, RadioCards, RateField, SelectField, TextField } from '@/components/shared/fields'
import { UnsavedChangesGuard } from '@/components/shared/dialogs'
import { InsightGrid } from '@/components/shared/milestone'
import { WizardProgress } from '@/components/shared/progress'
import { ErrorPanel, Notice, PageSkeleton, Spinner } from '@/components/shared/ui'
import { deriveMortgage } from './derive'
import { ReminderSettingsForm } from './ReminderSettingsForm'
import { SETUP_PERCENT, SETUP_STEPS, SETUP_TITLES, setupStepOf } from './setupMeta'
import { FIXED_PASSED, validateLoanStep, validateRateStep, validateReminders } from './validation'

const RETURN = { mykpr: '/my-kpr/overview', home: '/', profile: '/profile', rate: '/my-kpr/rate', property: '/my-kpr/property', explore: '/explore', review: '/monitoring/setup/3' }
const SCHEMES = [
  { value: 'conventional', label: 'Konvensional' },
  { value: 'sharia', label: 'Syariah' },
]
const RATE_STATUS = [
  { value: 'fixed', label: 'Masih fixed', description: 'Bunga dan cicilan tetap sampai tanggal tertentu.' },
  { value: 'floating', label: 'Sudah floating', description: 'Bunga mengikuti bank dan bisa berubah.' },
  { value: 'unknown', label: 'Belum tahu', description: 'Tidak apa-apa. Reminder bayar tetap jalan.' },
]
const PAY_LABEL = { 7: 'H-7', 3: 'H-3', 1: 'H-1', 0: 'Hari-H' }

export function MortgageSetupWizard() {
  const { step } = useParams()
  const n = Number(step)
  const [params] = useSearchParams()
  const edit = params.get('edit')
  const navigate = useNavigate()
  const { data: snap, error, reload, setData } = useResource(() => api.dashboard.getSnapshot())

  // Links from the old 6-step setup (e.g. setup/6?edit=review) land on the Reminder step.
  if (n > 3 && n <= 6) return <Navigate to="/monitoring/setup/3" replace />
  if (!(n >= 1 && n <= 3)) return <Navigate to="/monitoring/intro" replace />
  if (!snap) return error ? <ErrorPanel onRetry={reload} /> : <PageSkeleton />
  const draft = snap.mortgages.find((m) => m.status === 'draft')
  const active = snap.mortgages.find((m) => m.status === 'active')
  const editingActive = !!edit && edit !== 'review' && !draft && !!active
  const m = editingActive ? active : draft
  if (!m) return <Navigate to={active ? '/my-kpr/overview' : '/monitoring/intro'} replace />
  // Reminders of an active KPR are managed in Profile → Reminder.
  if (editingActive && n === 3) return <Navigate to="/profile/reminders" replace />
  const reached = setupStepOf(m)
  if (m.status === 'draft' && n > reached) return <Navigate to={`/monitoring/setup/${reached}`} replace />

  const returnTo = edit ? RETURN[edit] ?? '/my-kpr/overview' : null
  const backTo = returnTo ?? (n === 1 ? '/monitoring/intro' : `/monitoring/setup/${n - 1}`)
  const onSaved = (saved) => {
    setData((s) => ({ ...s, mortgages: s.mortgages.map((x) => (x.id === saved.id ? saved : x)) }))
    toast(edit ? 'Perubahan tersimpan.' : 'Tersimpan.')
    navigate(returnTo ?? `/monitoring/setup/${n + 1}`)
  }
  const common = { m, clock: snap.clock, onSaved, editing: !!edit, backTo, navigate }

  return (
    <>
      <PageHeader title={edit ? 'Edit Data KPR' : 'Tambahkan KPR'} subtitle={SETUP_TITLES[n - 1]} back={backTo} />
      {!editingActive && (
        <WizardProgress
          label={`Bagian ${n} dari 3 · ${SETUP_STEPS[n - 1]}`}
          steps={SETUP_STEPS}
          current={n}
          reached={reached}
          percent={SETUP_PERCENT[Math.max(n, reached) - 1]}
          savedLabel="Tersimpan setiap klik Simpan & Lanjutkan"
        />
      )}
      {editingActive && (
        <Notice tone="info" title="Kamu sedang mengubah KPR aktif">
          Perubahan cicilan, bunga, atau sisa tenor akan menghitung ulang perkiraan sisa pinjaman, reminder, dan KPR Health.
        </Notice>
      )}
      {n === 1 && <LoanStep {...common} />}
      {n === 2 && <RateStep {...common} />}
      {n === 3 && <ReminderStep {...common} />}
    </>
  )
}

function SetupLayout({ children, footer, onSubmit }) {
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-wrap items-start gap-6">
      <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-7 rounded-card bg-card p-5 shadow-card sm:p-7">
        {children}
        <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4">{footer}</div>
      </div>
      <aside className="flex flex-[1_1_280px] flex-col gap-4 lg:sticky lg:top-6">
        <div className="flex flex-col gap-3 rounded-3xl border border-border bg-card p-[22px]">
          <LockIcon className="size-5 text-primary" aria-hidden />
          <p className="text-sm leading-[21px] text-ink-2">Data yang kamu masukkan tidak dikirim ke bank. Kami hanya memakainya untuk reminder dan perkiraan.</p>
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

function Footer({ editing, backTo, navigate, saving }) {
  return (
    <>
      <Button variant="neutral" onClick={() => navigate(backTo)}>
        {editing ? 'Batal' : 'Kembali'}
      </Button>
      <Button type="submit" disabled={saving} aria-busy={saving}>
        {saving && <Spinner />}
        {saving ? 'Menyimpan…' : editing ? 'Simpan Perubahan' : 'Simpan & Lanjutkan'}
      </Button>
    </>
  )
}

function useSave(m, step, onSaved) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const save = async (values) => {
    setSaving(true)
    setError('')
    try {
      onSaved(await api.mortgages.saveSetupStep(m.id, { step, values }))
    } catch (e) {
      setError(e.message)
      setSaving(false)
    }
  }
  return { saving, error, save }
}

// ---------- Step 1 · KPR kamu ----------
function LoanStep({ m, onSaved, editing, backTo, navigate }) {
  const full = m.status === 'active' // My KPR edit: the optional fields the setup skips
  const known = BANKS.some((b) => b.value === m.bankName)
  const validate = useCallback((v) => validateLoanStep(v, { editing: full, outstanding: m.outstandingPrincipal }), [full, m.outstandingPrincipal])
  const form = useForm(
    {
      bankName: !m.bankName ? '' : known ? m.bankName : 'Bank lainnya',
      bankOther: known ? '' : m.bankName ?? '',
      currentPayment: moneyInput(m.currentPayment),
      dueDay: intInput(m.dueDay),
      productName: m.productName ?? '',
      scheme: m.scheme ?? 'conventional',
      originalPrincipal: moneyInput(m.originalPrincipal),
    },
    validate,
  )
  const { saving, error, save } = useSave(m, 1, onSaved)
  const v = form.values
  const onSubmit = form.submit((x) =>
    save({
      bankName: x.bankName === 'Bank lainnya' ? x.bankOther.trim() : x.bankName,
      currentPayment: toMoney(x.currentPayment),
      dueDay: toInt(x.dueDay),
      ...(full ? { productName: x.productName.trim() || null, scheme: x.scheme, originalPrincipal: toMoney(x.originalPrincipal) } : {}),
    }),
  )
  return (
    <SetupLayout onSubmit={onSubmit} footer={<Footer editing={editing} backTo={backTo} navigate={navigate} saving={saving} />}>
      <UnsavedChangesGuard when={form.dirty && !saving} />
      <ErrorSummary show={form.showSummary} count={Object.keys(form.errors).length} />
      <Section title="Data KPR kamu" desc={full ? undefined : 'Cukup 3 data untuk mulai mendapat reminder.'}>
        <FormGrid>
          <SelectField label="Bank" options={BANKS} {...form.bind('bankName')} />
          {v.bankName === 'Bank lainnya' && <TextField label="Nama bank" placeholder="Nama bank kamu" {...form.bind('bankOther')} />}
          <MoneyField label="Cicilan per bulan" placeholder="4.250.000" {...form.bind('currentPayment')} />
          <NumberField label="Jatuh tempo setiap tanggal" placeholder="22" maxLength={2} hint={toInt(v.dueDay) > 28 ? 'Di bulan tanpa tanggal ini, jatuh tempo pada hari terakhir bulan.' : ''} {...form.bind('dueDay')} />
          {full && (
            <>
              <TextField label="Nama produk KPR" optional placeholder="KPR Fixed 5 Tahun" maxLength={100} {...form.bind('productName')} />
              <MoneyField label="Pinjaman awal" optional placeholder="600.000.000" hint="Untuk menghitung progres pelunasan." {...form.bind('originalPrincipal')} />
              <RadioCards label="Jenis KPR" options={SCHEMES} span {...form.bind('scheme')} />
            </>
          )}
        </FormGrid>
        {full && v.scheme === 'sharia' && <Notice tone="warn">KPR syariah: reminder tetap aktif, tetapi amortisasi dan perkiraan floating belum tersedia.</Notice>}
      </Section>
      {error && <Notice tone="bad" role="alert">{error}</Notice>}
    </SetupLayout>
  )
}

// ---------- Step 2 · Bunga ----------
// A saved draft past step 2 with no rate type answered "Belum tahu"; an untouched draft has no answer yet.
const statusOf = (m) => m.currentRateType ?? (m.status === 'active' || m.setupStep > 2 ? 'unknown' : '')

// Same math as the dashboard: derive the mortgage as if these numbers were saved. Sisa pinjaman comes from the
// cicilan unless an official figure is typed. Null until every input is valid.
function floatingPreview(m, v, clock) {
  const rateBps = toBps(v.currentRate)
  const floatingBps = toBps(v.floatingRate)
  const termMonths = (toInt(v.tenorYears) ?? 0) * 12 + (toInt(v.tenorMonths) ?? 0)
  const rateOk = (bps) => bps > 0 && bps <= 3000
  if (v.rateStatus !== 'fixed' || !(v.fixedUntil > clock) || !(m.currentPayment > 0) || !rateOk(rateBps) || !rateOk(floatingBps) || !(termMonths >= 1 && termMonths <= 360)) return null
  const outstandingPrincipal = toMoney(v.outstanding) || calculateMaxPrincipal({ payment: m.currentPayment, annualRateBps: rateBps, termMonths })
  return deriveMortgage({ ...m, scheme: 'conventional', currentRateType: 'fixed', fixedUntil: v.fixedUntil, currentRateBps: rateBps, remainingTenorMonths: termMonths, estimatedFloatingRateBps: floatingBps, outstandingPrincipal }, clock).floatingImpact
}

function RateStep({ m, clock, onSaved, editing, backTo, navigate }) {
  const full = m.status === 'active'
  const validate = useCallback((v) => validateRateStep(v, { today: clock }), [clock])
  const form = useForm(
    {
      rateStatus: statusOf(m),
      fixedUntil: m.fixedUntil ?? '',
      currentRate: bpsInput(m.currentRateBps),
      tenorYears: m.remainingTenorMonths ? String(Math.floor(m.remainingTenorMonths / 12)) : '',
      tenorMonths: m.remainingTenorMonths ? String(m.remainingTenorMonths % 12) : '',
      floatingRate: bpsInput(m.estimatedFloatingRateBps),
      outstanding: m.outstandingEstimated === false ? moneyInput(m.outstandingPrincipal) : '',
    },
    validate,
  )
  const [open, setOpen] = useState(!!(m.currentRateBps || m.remainingTenorMonths || m.estimatedFloatingRateBps))
  const { saving, error, save } = useSave(m, 2, onSaved)
  const v = form.values
  const fixed = v.rateStatus === 'fixed'
  const canEstimate = fixed && m.scheme !== 'sharia'
  const showFields = full || (canEstimate && open)
  const passed = fixed && !!v.fixedUntil && v.fixedUntil <= clock
  // The Notice below carries the past-date error with its one-tap fix. Repeating it under the field would push that
  // button down as the field blurs on tap, so the tap would miss it.
  const fixedUntil = form.bind('fixedUntil')
  const impact = canEstimate ? floatingPreview(m, v, clock) : null

  const onSubmit = form.submit((x) => {
    const type = x.rateStatus === 'unknown' ? null : x.rateStatus
    const years = toInt(x.tenorYears)
    const months = toInt(x.tenorMonths)
    const official = toMoney(x.outstanding)
    return save({
      currentRateType: type,
      fixedUntil: type === 'fixed' ? x.fixedUntil : null,
      currentRateBps: toBps(x.currentRate),
      remainingTenorMonths: years === null && months === null ? null : (years ?? 0) * 12 + (months ?? 0),
      estimatedFloatingRateBps: type === 'fixed' ? toBps(x.floatingRate) : null,
      // Official sisa pinjaman (edit only): typed → it wins; cleared → back to the estimate.
      ...(full && official ? { outstandingPrincipal: official, outstandingEstimated: false } : {}),
      ...(full && !official && m.outstandingEstimated === false ? { outstandingPrincipal: null, outstandingEstimated: null } : {}),
    })
  })

  return (
    <SetupLayout onSubmit={onSubmit} footer={<Footer editing={editing} backTo={backTo} navigate={navigate} saving={saving} />}>
      <UnsavedChangesGuard when={form.dirty && !saving} />
      <ErrorSummary show={form.showSummary} count={Object.keys(form.errors).length} />
      <Section title="Bunga KPR kamu">
        <RadioCards label="Bunga KPR kamu sekarang?" layout="column" options={RATE_STATUS} {...form.bind('rateStatus')} />
        {fixed && (
          <DateField label="Fixed berakhir" hint="Lihat di surat akad atau aplikasi bank. Kalau hanya tahu bulannya, pilih tanggal 1." {...fixedUntil} error={passed ? undefined : fixedUntil.error} />
        )}
        {passed && (
          <Notice
            tone="warn"
            role="status"
            action={
              <Button variant="outline" size="sm" onClick={() => form.setValues({ ...v, rateStatus: 'floating', fixedUntil: '' })}>
                Pilih Sudah floating
              </Button>
            }
          >
            {FIXED_PASSED}
          </Notice>
        )}
        {v.rateStatus === 'unknown' && <Notice tone="muted">Cek di aplikasi bank atau surat akad nanti. Kamu bisa mengisinya kapan saja dari My KPR.</Notice>}
      </Section>

      {!full && canEstimate && (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="flex min-h-11 w-full items-center justify-between gap-3 rounded-2xl border border-dashed border-[#c9d3e3] px-[18px] py-3 text-left text-sm font-bold text-ink-2"
        >
          Mau tahu perkiraan cicilan setelah fixed? (opsional)
          <ChevronDownIcon className={cn('size-4 shrink-0', open && 'rotate-180')} aria-hidden />
        </button>
      )}
      {showFields && (
        <Section title={full ? 'Bunga & sisa tenor' : 'Perkiraan cicilan setelah fixed'} desc={full ? 'Dipakai untuk amortisasi, perkiraan floating, dan simulasi Take Over.' : undefined}>
          <FormGrid>
            <RateField label="Bunga sekarang" optional {...form.bind('currentRate')} />
            {fixed && <RateField label="Perkiraan bunga floating" optional placeholder="10,50" hint="Belum tahu? Tanyakan ke bank, atau isi perkiraan dulu. Bisa diubah kapan saja." {...form.bind('floatingRate')} />}
            <NumberField label="Sisa tenor" optional suffix="tahun" placeholder="15" maxLength={2} {...form.bind('tenorYears')} />
            <NumberField label="Tambahan bulan" optional suffix="bulan" placeholder="0" maxLength={2} {...form.bind('tenorMonths')} />
            {full && (
              <MoneyField
                label="Sisa pinjaman dari bank"
                optional
                span
                hint={m.outstandingEstimated && m.outstandingPrincipal ? `Perkiraan saat ini ± ${rupiahShort(m.outstandingPrincipal)}. Isi angka dari bank kalau ada.` : 'Kosongkan untuk memakai perkiraan dari cicilan, bunga, dan sisa tenor.'}
                {...form.bind('outstanding')}
              />
            )}
          </FormGrid>
          {canEstimate &&
            (impact ? (
              <p role="status" className="rounded-2xl bg-secondary px-[18px] py-4 text-sm leading-[21px] font-semibold text-ink-2">
                {impact.direction === 'increase'
                  ? `Cicilan bisa naik jadi ± ${rupiahShort(impact.estimatedNextPayment)}/bln (+${rupiahShort(impact.monthlyDelta)}) mulai ${dateShort(impact.resetDate)}.`
                  : impact.direction === 'decrease'
                    ? `Cicilan diperkirakan turun jadi ± ${rupiahShort(impact.estimatedNextPayment)}/bln mulai ${dateShort(impact.resetDate)}.`
                    : 'Cicilan diperkirakan tidak berubah setelah fixed.'}
              </p>
            ) : (
              <p className="text-[13px] text-muted-foreground">Isi bunga sekarang, sisa tenor, dan perkiraan bunga floating untuk melihat perkiraan.</p>
            ))}
        </Section>
      )}
      {error && <Notice tone="bad" role="alert">{error}</Notice>}
    </SetupLayout>
  )
}

// ---------- Step 3 · Reminder ----------
function ReminderStep({ m, clock, navigate }) {
  const isFixed = m.currentRateType === 'fixed' && !!m.fixedUntil && m.fixedUntil > clock
  const [reminders, setReminders] = useState(() => {
    const r = structuredClone(m.reminders ?? DEFAULT_REMINDERS)
    return isFixed ? r : { ...r, fixedExpiry: [] }
  })
  const [agree, setAgree] = useState(false)
  const [tried, setTried] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const errors = validateReminders(reminders)
  const days = isFixed ? daysUntil({ fromDate: clock, targetDate: m.fixedUntil }) : null
  const upcoming = isFixed ? reminders.fixedExpiry.filter((h) => days >= h) : []
  const fi = deriveMortgage(m, clock).floatingImpact
  const edit = (step) => () => navigate(`/monitoring/setup/${step}?edit=review`)
  // The reward for the two short steps: what the app will actually do with them.
  const items = [
    isFixed && { k: 'Fixed berakhir', v: dateShort(m.fixedUntil), sub: daysLabel(days) },
    isFixed && { k: 'Pengingat floating', v: `${upcoming.length} kali`, sub: upcoming.length ? upcoming.map((h) => `H-${h}`).join(' · ') : 'Tidak ada jadwal tersisa' },
    { k: 'Bayar cicilan', v: `Tiap tgl ${m.dueDay}`, sub: reminders.payment.length ? reminders.payment.map((h) => PAY_LABEL[h]).join(' · ') : 'Belum dipilih' },
    fi?.direction === 'increase' && { k: 'Cicilan setelah fixed', v: `± ${rupiahShort(fi.estimatedNextPayment)}`, sub: `+${rupiahShort(fi.monthlyDelta)}/bln (perkiraan)` },
  ].filter(Boolean)

  const activate = async (e) => {
    e.preventDefault()
    setTried(true)
    if (Object.keys(errors).length || !agree || pending) return
    setPending(true)
    setError('')
    try {
      await api.mortgages.saveSetupStep(m.id, { step: 3, values: { reminders } })
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
          <Button variant="neutral" onClick={() => navigate('/monitoring/setup/2')}>
            Kembali
          </Button>
          <Button type="submit" disabled={pending} aria-busy={pending} className={!agree ? 'bg-border text-ink-3 hover:bg-border' : ''}>
            {pending && <Spinner />}
            {pending ? 'Mengaktifkan…' : 'Aktifkan Reminder'}
          </Button>
        </>
      }
    >
      <Section title="Yang akan kami ingatkan">
        <InsightGrid items={items} />
        {m.currentRateType === 'floating' && <Notice tone="info">Bunga kamu sudah floating. Kami ingatkan pembayaran tiap bulan. Bandingkan program bank lain di Explore.</Notice>}
        {!m.currentRateType && (
          <Notice
            tone="warn"
            action={
              <button type="button" onClick={edit(2)} className="min-h-11 text-[13px] font-bold text-primary underline">
                Isi sekarang
              </button>
            }
          >
            Jenis bunga belum diketahui. Reminder floating aktif setelah kamu mengisinya.
          </Notice>
        )}
        <div className="flex flex-wrap gap-x-5">
          <button type="button" onClick={edit(1)} className="flex min-h-11 items-center gap-1.5 text-[13px] font-bold text-primary">
            <PencilIcon className="size-3.5" aria-hidden />
            Ubah data KPR
          </button>
          <button type="button" onClick={edit(2)} className="flex min-h-11 items-center gap-1.5 text-[13px] font-bold text-primary">
            <PencilIcon className="size-3.5" aria-hidden />
            Ubah bunga
          </button>
        </div>
      </Section>
      <Section title="Atur reminder" desc="Pengaturan default sudah dipilih. Ubah bila perlu.">
        <ReminderSettingsForm value={reminders} onChange={setReminders} dueDay={m.dueDay} isFixed={isFixed} fixedUntil={m.fixedUntil} errors={tried ? errors : {}} />
      </Section>
      <CheckboxField label="Data yang saya masukkan benar" checked={agree} onChange={setAgree} error={tried && !agree ? 'Centang konfirmasi data dulu.' : undefined} />
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <CheckIcon className="size-3.5 text-success" aria-hidden />
        Aktivasi tidak membuat pengajuan ke bank.
      </p>
      {error && <Notice tone="bad" role="alert">{error} Draft dan pilihanmu tetap tersimpan.</Notice>}
    </SetupLayout>
  )
}
