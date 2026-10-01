import { useCallback, useState } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { CheckIcon, LockIcon, PencilIcon } from 'lucide-react'
import { api } from '@/data/api'
import { DEFAULT_REMINDERS } from '@/data/seed'
import { calculateMaxPrincipal } from '@/calculations/finance'
import { useForm, useResource } from '@/lib/hooks'
import { BANKS, CERTIFICATES, CITIES, OCCUPATIONS, PROPERTY_TYPES, bpsInput, dateShort, intInput, labelOf, maskNik, moneyInput, percentBps, rupiah, rupiahShort, tenorLabel, toBps, toInt, toMoney } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/layout/AppShell'
import { CheckboxField, DateField, ErrorSummary, FormGrid, MoneyField, NumberField, RadioCards, RateField, SelectField, TextField } from '@/components/shared/fields'
import { UnsavedChangesGuard } from '@/components/shared/dialogs'
import { WizardProgress } from '@/components/shared/progress'
import { ErrorPanel, Notice, PageSkeleton, Spinner } from '@/components/shared/ui'
import { profileFormValues, toEmployment, toPersonal, validatePersonal } from '@/domains/applications/validation'
import { validateEmploymentBasic } from '@/domains/optimize/validation'
import { IncomeFields, JobFields, PersonalFields } from '@/domains/profile/ProfilePages'
import { deriveMortgage } from './derive'
import { ReminderSettingsForm } from './ReminderSettingsForm'
import { SETUP_PERCENT, SETUP_STEPS, SETUP_TITLES, setupStepOf } from './setupMeta'
import { FIXED_PASSED, filledOnly, remainingFromStart, validateLoanStep, validatePropertyStep, validateReminders } from './validation'

const RETURN = { mykpr: '/my-kpr/overview', home: '/', profile: '/profile', rate: '/my-kpr/rate', property: '/my-kpr/property', explore: '/explore', review: '/monitoring/setup/3' }
const SCHEMES = [
  { value: 'conventional', label: 'Konvensional' },
  { value: 'sharia', label: 'Syariah' },
]
const RATE_TYPES = [
  { value: 'fixed', label: 'Masih fixed', description: 'Bunga dan cicilan tetap sampai tanggal tertentu.' },
  { value: 'floating', label: 'Sudah floating', description: 'Bunga mengikuti bank dan bisa berubah.' },
]
const KNOWS = [
  { value: 'yes', label: 'Ya, ada angka dari bank' },
  { value: 'no', label: 'Tidak, hitungkan perkiraan' },
]
const NO_YES = [
  { value: 'no', label: 'Tidak' },
  { value: 'yes', label: 'Ya' },
]
// Step 2 is three short optional forms, like Take Over's Data pribadi → Pekerjaan screens. `required`: the only
// fields a form needs to be saved (this setup's rule; Profile and Take Over keep theirs). The rest can come later.
const PARTS = [
  { slug: '', title: 'Data pribadi', desc: 'Sesuai KTP. Disimpan di profil kamu.', required: ['fullName'] },
  { slug: 'pekerjaan', title: 'Pekerjaan & penghasilan', desc: 'Untuk rasio cicilan di KPR Health dan pengajuan Take Over.', required: ['monthlyIncome', 'partnerIncome'] },
  { slug: 'properti', title: 'Data properti', desc: 'Untuk nilai properti, LTV, dan pengajuan Take Over atau Top-up.', required: [] },
]
const partPath = (i) => `/monitoring/setup/2${PARTS[i].slug ? `/${PARTS[i].slug}` : ''}`

export function MortgageSetupWizard() {
  const { step, part } = useParams()
  const n = Number(step)
  const [params] = useSearchParams()
  const edit = params.get('edit')
  const navigate = useNavigate()
  const { data: snap, error, reload, setData } = useResource(() => api.dashboard.getSnapshot())

  // Links from the old 6-step setup (e.g. setup/6?edit=review) land on the last step.
  if (n > 3 && n <= 6) return <Navigate to="/monitoring/setup/3" replace />
  if (!(n >= 1 && n <= 3)) return <Navigate to="/monitoring/intro" replace />
  const i = n === 2 ? PARTS.findIndex((x) => x.slug === (part ?? '')) : part ? -1 : 0
  if (i < 0) return <Navigate to={`/monitoring/setup/${n}`} replace />
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
  const backTo = returnTo ?? (n === 1 ? '/monitoring/intro' : n === 3 ? partPath(PARTS.length - 1) : i ? partPath(i - 1) : '/monitoring/setup/1')
  // `profile`: what a step 2 form wrote to the profile, so the next form and the summary show it without a refetch.
  const onSaved = (saved, { profile, to, quiet } = {}) => {
    setData((s) => ({ ...s, mortgages: s.mortgages.map((x) => (x.id === saved.id ? saved : x)), ...(profile && { profile: { ...s.profile, ...profile }, finance: saved.finance }) }))
    if (!quiet) toast(edit ? 'Perubahan tersimpan.' : 'Tersimpan.')
    navigate(returnTo ?? to ?? `/monitoring/setup/${n + 1}`)
  }
  const common = { m, snap, clock: snap.clock, onSaved, editing: !!edit, backTo, navigate }
  // Each step 2 form moves the bar a third of a step (45 → 55 → 65%).
  const percent = Math.max(n === 2 ? SETUP_PERCENT[1] + 10 * i : SETUP_PERCENT[n - 1], SETUP_PERCENT[reached - 1])

  return (
    <>
      <PageHeader title={edit ? 'Edit Data KPR' : 'Tambahkan KPR'} subtitle={SETUP_TITLES[n - 1]} back={backTo} />
      {!editingActive && (
        <WizardProgress
          label={`Bagian ${n} dari 3 · ${SETUP_STEPS[n - 1]}`}
          steps={SETUP_STEPS}
          current={n}
          reached={Math.max(n === 2 ? 2 + i / PARTS.length : n, reached)}
          percent={percent}
          savedLabel="Tersimpan setiap klik Simpan & Lanjutkan"
        />
      )}
      {editingActive && (
        <Notice tone="info" title="Kamu sedang mengubah KPR aktif">
          Perubahan cicilan, bunga, atau sisa tenor akan menghitung ulang sisa pinjaman, reminder, dan KPR Health.
        </Notice>
      )}
      {n === 1 && <LoanStep {...common} />}
      {n === 2 && (i < 2 ? <ProfilePart key={i} i={i} {...common} /> : <PropertyPart i={i} {...common} />)}
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
          <p className="text-sm leading-[21px] text-ink-2">Data yang kamu masukkan tidak dikirim ke bank sampai kamu sendiri memilih untuk mengajukan.</p>
        </div>
      </aside>
    </form>
  )
}

function Section({ title, desc, action, children }) {
  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <h2 className="text-xl font-extrabold">{title}</h2>
          {desc && <p className="text-sm leading-[21px] text-muted-foreground">{desc}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

function Footer({ editing, backTo, navigate, saving, extra }) {
  return (
    <>
      <Button variant="neutral" onClick={() => navigate(backTo)}>
        {editing ? 'Batal' : 'Kembali'}
      </Button>
      <div className="flex flex-col-reverse gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-[18px]">
        {extra}
        <Button type="submit" disabled={saving} aria-busy={saving}>
          {saving && <Spinner />}
          {saving ? 'Menyimpan…' : editing ? 'Simpan Perubahan' : 'Simpan & Lanjutkan'}
        </Button>
      </div>
    </>
  )
}

function useSave(m, step, onSaved) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const save = async (values, opts = {}) => {
    setSaving(true)
    setError('')
    try {
      onSaved(await api.mortgages.saveSetupStep(m.id, { step: opts.step ?? step, values }), opts)
    } catch (e) {
      setError(e.message)
      setSaving(false)
    }
  }
  return { saving, error, save }
}

// ---------- Step 1 · Data KPR (wajib) ----------
// Sisa pokok & tenor as they will be saved: the bank's figures, or the estimate the API makes from cicilan, bunga
// and sisa tenor (tenor awal minus cicilan since akad). `outstanding` stays null until every input is valid.
function loanPreview(v, clock) {
  const official = v.knowsOutstanding === 'yes'
  const remaining = official ? toInt(v.remainingTenorMonths) : remainingFromStart(v, clock)
  const payment = toMoney(v.currentPayment)
  const rateBps = toBps(v.currentRate)
  if (!(remaining >= 1 && remaining <= 360) || !(payment > 0) || !(rateBps > 0 && rateBps <= 3000)) return { remaining, outstanding: null }
  const outstanding = official ? toMoney(v.outstandingPrincipal) : v.scheme === 'sharia' ? null : calculateMaxPrincipal({ payment, annualRateBps: rateBps, termMonths: remaining })
  return { remaining, outstanding, payment, rateBps }
}

function floatingPreview(m, v, clock, loan) {
  const floatingBps = toBps(v.floatingRate)
  if (v.rateStatus !== 'fixed' || v.scheme === 'sharia' || !(v.fixedUntil > clock) || !(loan.outstanding > 0) || !(floatingBps > 0 && floatingBps <= 3000)) return null
  const preview = { ...m, scheme: 'conventional', currentRateType: 'fixed', fixedUntil: v.fixedUntil, currentRateBps: loan.rateBps, currentPayment: loan.payment, dueDay: toInt(v.dueDay), remainingTenorMonths: loan.remaining, estimatedFloatingRateBps: floatingBps, outstandingPrincipal: loan.outstanding }
  return deriveMortgage(preview, clock).floatingImpact
}

function LoanStep({ m, clock, onSaved, editing, backTo, navigate }) {
  const known = BANKS.some((b) => b.value === m.bankName)
  const official = m.outstandingEstimated === false && m.outstandingPrincipal > 0
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
      rateStatus: m.currentRateType ?? '',
      currentRate: bpsInput(m.currentRateBps),
      fixedUntil: m.fixedUntil ?? '',
      floatingRate: bpsInput(m.estimatedFloatingRateBps),
      knowsOutstanding: official ? 'yes' : m.outstandingEstimated ? 'no' : '',
      outstandingPrincipal: official ? moneyInput(m.outstandingPrincipal) : '',
      remainingTenorMonths: official ? intInput(m.remainingTenorMonths) : '',
    },
    validate,
  )
  const { saving, error, save } = useSave(m, 1, onSaved)
  const v = form.values
  const tenor = toInt(v.originalTenorMonths)
  const fixed = v.rateStatus === 'fixed'
  const passed = fixed && !!v.fixedUntil && v.fixedUntil <= clock
  // The Notice below carries the past-date error with its one-tap fix; repeating it under the field would push
  // that button down as the field blurs on tap.
  const fixedUntil = form.bind('fixedUntil')
  const loan = loanPreview(v, clock)
  const impact = floatingPreview(m, v, clock, loan)

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
      currentRateType: x.rateStatus,
      currentRateBps: toBps(x.currentRate),
      fixedUntil: x.rateStatus === 'fixed' ? x.fixedUntil : null,
      estimatedFloatingRateBps: x.rateStatus === 'fixed' ? toBps(x.floatingRate) : null,
      // Official figures win; otherwise the API estimates sisa pokok from cicilan, bunga and this sisa tenor.
      ...(x.knowsOutstanding === 'yes'
        ? { outstandingPrincipal: toMoney(x.outstandingPrincipal), remainingTenorMonths: toInt(x.remainingTenorMonths), outstandingEstimated: false }
        : { outstandingPrincipal: null, remainingTenorMonths: remainingFromStart(x, clock), outstandingEstimated: null }),
    }),
  )

  return (
    <SetupLayout onSubmit={onSubmit} footer={<Footer editing={editing} backTo={backTo} navigate={navigate} saving={saving} />}>
      <UnsavedChangesGuard when={form.dirty && !saving} />
      <ErrorSummary show={form.showSummary} count={Object.keys(form.errors).length} />
      <Section title="Data KPR kamu" desc="Tanda * wajib diisi. Dipakai untuk reminder, jadwal amortisasi, dan simulasi.">
        <FormGrid>
          <SelectField label="Bank" required options={BANKS} {...form.bind('bankName')} />
          {v.bankName === 'Bank lainnya' ? <TextField label="Nama bank" required placeholder="Nama bank kamu" {...form.bind('bankOther')} /> : <TextField label="Nama produk KPR" optional placeholder="KPR Fixed 5 Tahun" maxLength={100} {...form.bind('productName')} />}
          {v.bankName === 'Bank lainnya' && <TextField label="Nama produk KPR" optional placeholder="KPR Fixed 5 Tahun" maxLength={100} span {...form.bind('productName')} />}
          <RadioCards label="Jenis KPR" required options={SCHEMES} span {...form.bind('scheme')} />
          {v.scheme === 'sharia' && (
            <Notice tone="warn" className="sm:col-span-2">
              KPR syariah: reminder tetap aktif, tetapi amortisasi dan perkiraan sisa pokok belum tersedia.
            </Notice>
          )}
          <MoneyField label="Jumlah pinjaman awal" required placeholder="600.000.000" {...form.bind('originalPrincipal')} />
          <MoneyField label="Cicilan bulanan saat ini" required placeholder="4.250.000" {...form.bind('currentPayment')} />
          <NumberField label="Tenor awal" required placeholder="240" suffix="bulan" hint={tenor ? `${tenor} bulan = ${tenorLabel(tenor)}` : ''} {...form.bind('originalTenorMonths')} />
          <DateField label="Tanggal akad" required max={clock} {...form.bind('startDate')} />
          <NumberField label="Jatuh tempo setiap tanggal" required placeholder="22" maxLength={2} hint={toInt(v.dueDay) > 28 ? 'Di bulan tanpa tanggal ini, jatuh tempo pada hari terakhir bulan.' : ''} {...form.bind('dueDay')} />
        </FormGrid>
      </Section>

      <Section title="Bunga">
        <FormGrid>
          <RadioCards label="Bunga KPR kamu sekarang?" required options={RATE_TYPES} span {...form.bind('rateStatus')} />
          <RateField label="Bunga saat ini" required {...form.bind('currentRate')} />
          {fixed && <DateField label="Fixed berakhir" required hint="Lihat di surat akad atau aplikasi bank. Kalau hanya tahu bulannya, pilih tanggal 1." {...fixedUntil} error={passed ? undefined : fixedUntil.error} />}
          {fixed && <RateField label="Estimasi bunga floating" required placeholder="10,50" hint="Untuk amortisasi setelah fixed. Belum tahu? Tanyakan ke bank atau isi perkiraan dulu." {...form.bind('floatingRate')} />}
        </FormGrid>
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
      </Section>

      <Section title="Sisa pinjaman">
        <FormGrid>
          <RadioCards label="Kamu tahu sisa pokok terbaru dari bank?" required hint="Lihat di aplikasi bank atau rekening koran KPR." options={KNOWS} span {...form.bind('knowsOutstanding')} />
          {v.knowsOutstanding === 'yes' && (
            <>
              <MoneyField label="Sisa pokok saat ini" required placeholder="415.000.000" {...form.bind('outstandingPrincipal')} />
              <NumberField label="Sisa tenor" required placeholder="183" suffix="bulan" {...form.bind('remainingTenorMonths')} />
            </>
          )}
        </FormGrid>
        {v.knowsOutstanding === 'no' &&
          v.scheme !== 'sharia' &&
          (loan.outstanding ? (
            <p role="status" className="rounded-2xl bg-secondary px-[18px] py-4 text-sm leading-[21px] font-semibold text-ink-2">
              Perkiraan sisa pokok ± {rupiahShort(loan.outstanding)}, sisa tenor {loan.remaining} bulan ({tenorLabel(loan.remaining)}). Dihitung dari cicilan dan bunga, bukan saldo resmi bank.
            </p>
          ) : (
            <p className="text-[13px] text-muted-foreground">Isi cicilan, bunga, tenor awal, dan tanggal akad untuk melihat perkiraan.</p>
          ))}
        {impact && (
          <p role="status" className="rounded-2xl bg-secondary px-[18px] py-4 text-sm leading-[21px] font-semibold text-ink-2">
            {impact.direction === 'increase'
              ? `Setelah fixed, cicilan bisa naik jadi ± ${rupiahShort(impact.estimatedNextPayment)}/bln (+${rupiahShort(impact.monthlyDelta)}) mulai ${dateShort(impact.resetDate)}.`
              : impact.direction === 'decrease'
                ? `Setelah fixed, cicilan diperkirakan turun jadi ± ${rupiahShort(impact.estimatedNextPayment)}/bln mulai ${dateShort(impact.resetDate)}.`
                : 'Cicilan diperkirakan tidak berubah setelah fixed.'}
          </p>
        )}
      </Section>
      {error && <Notice tone="bad" role="alert">{error}</Notice>}
    </SetupLayout>
  )
}

// ---------- Step 2 · Data pendukung (opsional, 3 form) ----------
// Like Take Over's sub-steps, only the last form moves the draft on to step 3; "Lewati" never saves the form.
function SupportPart({ i, m, form, toValues, onSaved, editing, backTo, navigate, children }) {
  const last = i === PARTS.length - 1
  const next = last ? undefined : partPath(i + 1)
  const { saving, error, save } = useSave(m, last ? 2 : 1, onSaved)
  const toReminder = () => save({}, { step: 2, quiet: true, to: '/monitoring/setup/3' })
  const onSubmit = form.submit((x) => {
    const { values, profile } = toValues(x)
    return save(values, { profile, to: next })
  })
  const skip = (
    <button type="button" disabled={saving} onClick={() => (last ? toReminder() : navigate(next))} className="min-h-11 text-sm font-bold text-primary">
      Lewati
    </button>
  )
  return (
    <SetupLayout onSubmit={onSubmit} footer={<Footer editing={editing} backTo={backTo} navigate={navigate} saving={saving} extra={!editing && skip} />}>
      <UnsavedChangesGuard when={form.dirty && !saving} />
      <ErrorSummary show={form.showSummary} count={Object.keys(form.errors).length} />
      {!editing && (
        <Notice
          tone="info"
          action={
            !last && (
              <button type="button" disabled={saving} onClick={toReminder} className="min-h-11 text-[13px] font-bold text-primary underline">
                Lewati semua ke Reminder
              </button>
            )
          }
        >
          3 form opsional. Yang kamu isi tersimpan sekali dan otomatis terpakai saat Take Over atau Refinancing, jadi tidak perlu input ulang.
        </Notice>
      )}
      <Section title={PARTS[i].title} desc={`${PARTS[i].desc} ${PARTS[i].required.length ? 'Untuk menyimpan, cukup isi kolom bertanda *. Sisanya bisa menyusul.' : 'Semua kolom boleh kosong, isi yang kamu tahu.'}`} action={<span className="shrink-0 text-xs font-bold text-muted-foreground">Form {i + 1} dari {PARTS.length}</span>}>
        {children}
      </Section>
      {error && <Notice tone="bad" role="alert">{error}</Notice>}
    </SetupLayout>
  )
}

function ProfilePart({ i, snap, clock, ...rest }) {
  const personal = i === 0
  const { required } = PARTS[i]
  const validate = useCallback((v) => filledOnly(personal ? validatePersonal(v, { today: clock }) : validateEmploymentBasic(v), v, required), [personal, clock, required])
  const form = useForm(profileFormValues(snap.profile ?? {}, snap.finance ?? {}), validate)
  const toValues = (x) => {
    const data = personal ? toPersonal(x) : toEmployment(x)
    return { values: { [personal ? 'personal' : 'employment']: data }, profile: data }
  }
  return (
    <SupportPart i={i} form={form} toValues={toValues} {...rest}>
      {personal ? (
        <PersonalFields form={form} clock={clock} contactField={snap.user?.contactType === 'email' ? 'email' : 'phone'} required={required} />
      ) : (
        // Income first: it is what KPR Health needs; the job details can come later.
        <FormGrid>
          <IncomeFields form={form} required={required} />
          <JobFields form={form} />
        </FormGrid>
      )}
    </SupportPart>
  )
}

const PROPERTY_TEXT = ['type', 'city', 'address', 'landArea', 'buildingArea', 'certificateType', 'certificateOwner', 'estimatedValue']
const validateProperty = (v) => filledOnly(validatePropertyStep(v), v)

function PropertyPart({ i, m, clock, ...rest }) {
  const p = m.property ?? {}
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
      disputed: p.disputed ? 'yes' : 'no',
    },
    validateProperty,
  )
  const v = form.values
  const toValues = (y) => {
    if (y.disputed === 'no' && PROPERTY_TEXT.every((k) => !y[k].trim())) return { values: {} }
    const value = toMoney(y.estimatedValue)
    return {
      values: {
        property: {
          type: y.type || null,
          city: y.city || null,
          address: y.address.trim() || null,
          landArea: toInt(y.landArea),
          buildingArea: toInt(y.buildingArea),
          certificateType: y.certificateType || null,
          certificateOwner: y.certificateOwner.trim() || null,
          estimatedValue: value,
          valueAsOf: value ? (value === p.estimatedValue ? p.valueAsOf : clock) : null,
          disputed: y.disputed === 'yes',
        },
      },
    }
  }
  return (
    <SupportPart i={i} m={m} form={form} toValues={toValues} {...rest}>
      <FormGrid>
        <SelectField label="Jenis properti" options={PROPERTY_TYPES} {...form.bind('type')} />
        <SelectField label="Kota/Kabupaten" options={CITIES} {...form.bind('city')} />
        <TextField label="Alamat properti" placeholder="Griya Asri Blok C2, Bekasi" span {...form.bind('address')} />
        <NumberField label="Luas tanah" suffix="m²" placeholder="72" {...form.bind('landArea')} />
        <NumberField label="Luas bangunan" suffix="m²" placeholder="45" {...form.bind('buildingArea')} />
        <SelectField label="Status sertifikat" options={CERTIFICATES} {...form.bind('certificateType')} />
        <TextField label="Nama pemilik sertifikat" placeholder="Firdi Audi" {...form.bind('certificateOwner')} />
        <MoneyField label="Estimasi nilai properti sekarang" placeholder="850.000.000" hint="Bukan appraisal resmi." span {...form.bind('estimatedValue')} />
        <RadioCards label="Apakah properti sedang bersengketa?" options={NO_YES} span {...form.bind('disputed')} />
      </FormGrid>
      {v.disputed === 'yes' && <Notice tone="warn" role="note">Beberapa produk pinjaman mungkin memerlukan pemeriksaan manual. Pemantauan KPR tetap bisa diaktifkan.</Notice>}
    </SupportPart>
  )
}

// ---------- Step 3 · Reminder & aktivasi ----------
function ReminderStep({ m, snap, clock, navigate }) {
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
  const p = snap.profile ?? {}
  const f = m.finance ?? {}
  const pr = m.property ?? {}
  const empty = ['Belum diisi (opsional)']
  const sections = [
    { title: 'KPR', to: '/monitoring/setup/1', lines: [`${m.bankName}${m.productName ? ` · ${m.productName}` : ''}`, `Pinjaman awal ${rupiah(m.originalPrincipal)} · ${tenorLabel(m.originalTenorMonths)}`, `Cicilan ${rupiah(m.currentPayment)}/bulan · jatuh tempo tgl ${m.dueDay}`, `Sisa pokok ${m.outstandingPrincipal ? `${rupiah(m.outstandingPrincipal)}${m.outstandingEstimated ? ' (perkiraan)' : ''}` : 'belum dihitung'} · sisa ${m.remainingTenorMonths} bulan`] },
    { title: 'Bunga', to: '/monitoring/setup/1', lines: m.currentRateType === 'fixed' ? [`Fixed ${percentBps(m.currentRateBps)} sampai ${dateShort(m.fixedUntil)}`, `Estimasi floating ${percentBps(m.estimatedFloatingRateBps)}`] : [`Floating ${percentBps(m.currentRateBps)}`] },
    { title: 'Data pribadi', to: partPath(0), filled: !!p.fullName, lines: p.fullName ? [p.fullName, p.nik ? `NIK ${maskNik(p.nik)}` : 'Data KTP bisa menyusul'] : empty },
    { title: 'Pekerjaan & penghasilan', to: partPath(1), filled: f.monthlyIncome > 0, lines: f.monthlyIncome > 0 ? [`Penghasilan ${rupiah(f.monthlyIncome)}/bulan`, p.occupation ? `${labelOf(OCCUPATIONS, p.occupation)} · ${p.companyName}` : 'Pekerjaan bisa menyusul'] : empty },
    { title: 'Properti', to: partPath(2), filled: !!(pr.type || pr.address), lines: pr.type || pr.address ? [pr.address || labelOf(PROPERTY_TYPES, pr.type), pr.estimatedValue ? `Estimasi nilai ${rupiah(pr.estimatedValue)}` : 'Nilai properti belum diisi'] : empty },
  ]

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
          <Button variant="neutral" onClick={() => navigate(partPath(PARTS.length - 1))}>
            Kembali
          </Button>
          <Button type="submit" disabled={pending} aria-busy={pending} className={!agree ? 'bg-border text-ink-3 hover:bg-border' : ''}>
            {pending && <Spinner />}
            {pending ? 'Mengaktifkan…' : 'Aktifkan Pemantauan KPR'}
          </Button>
        </>
      }
    >
      <Section title="Atur reminder" desc="Pengaturan default sudah dipilih. Ubah bila perlu.">
        <ReminderSettingsForm value={reminders} onChange={setReminders} dueDay={m.dueDay} isFixed={isFixed} fixedUntil={m.fixedUntil} errors={tried ? errors : {}} />
      </Section>
      <Section title="Ringkasan data">
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
          {sections.map((s) => (
            <div key={s.title} className="flex flex-col gap-2.5 rounded-[18px] border border-border px-5 py-[18px]">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-[15px] font-extrabold">{s.title}</h3>
                <button type="button" onClick={() => navigate(`${s.to}?edit=review`)} className="flex min-h-11 items-center gap-1.5 text-[13px] font-bold text-primary">
                  <PencilIcon className="size-3.5" aria-hidden />
                  {s.filled === false ? 'Isi' : 'Edit'}
                </button>
              </div>
              {s.lines.map((l) => (
                <span key={l} className={s.filled === false ? 'text-sm leading-5 text-muted-foreground' : 'text-sm leading-5 text-ink-2'}>
                  {l}
                </span>
              ))}
            </div>
          ))}
        </div>
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
