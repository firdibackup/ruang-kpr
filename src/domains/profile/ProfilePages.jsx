import { useCallback, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { BellIcon, BriefcaseIcon, LogOutIcon, PencilIcon, ShieldCheckIcon, UserIcon } from 'lucide-react'
import { api } from '@/data/api'
import { useForm, useResource } from '@/lib/hooks'
import { GENDERS, MARITAL, OCCUPATIONS, dateLong, initials, intInput, labelOf, maskNik, moneyInput, rupiah, toMoney } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/layout/AppShell'
import { CheckboxField, DateField, ErrorSummary, FormGrid, MoneyField, NumberField, RadioCards, SelectField, TextAreaField, TextField } from '@/components/shared/fields'
import { ConfirmDialog, UnsavedChangesGuard } from '@/components/shared/dialogs'
import { Disclaimer, ErrorPanel, IconBox, Notice, Panel, PageSkeleton, Spinner, SummaryRows } from '@/components/shared/ui'
import { useSession } from '@/domains/session/SessionProvider'
import { ReminderSettingsForm, reminderSummary } from '@/domains/mortgages/ReminderSettingsForm'
import { validateReminders } from '@/domains/mortgages/validation'
import { validateEmploymentBasic } from '@/domains/optimize/validation'
import { validatePersonal } from '@/domains/applications/validation'

export function ProfilePage() {
  const navigate = useNavigate()
  const { logout } = useSession()
  const { data: snap, error, reload } = useResource(() => api.dashboard.getSnapshot())
  const [confirm, setConfirm] = useState(false)
  if (!snap) return error ? <ErrorPanel onRetry={reload} /> : <PageSkeleton />
  const p = snap.profile ?? {}
  const f = snap.finance ?? {}
  const m = snap.mortgages.find((x) => x.status === 'active')
  const r = m ? reminderSummary(m.reminders, m.currentRateType === 'fixed' && m.fixedUntil > snap.clock) : null
  const incomplete = !p.nik || !p.birthDate || !p.occupation

  return (
    <>
      <PageHeader title="Profile" subtitle="Akun dan data pribadi kamu." />
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-5">
          <Panel className="gap-1.5 sm:p-7">
            <div className="mb-2.5 flex items-center gap-3.5">
              <span className="flex size-14 items-center justify-center rounded-full bg-primary text-[22px] font-extrabold text-white" aria-hidden>
                {initials(snap.user?.name)}
              </span>
              <div className="flex flex-col gap-0.5">
                <h2 className="text-lg font-extrabold">{p.fullName || snap.user?.name}</h2>
                <span className="text-[13px] text-muted-foreground">Akun terverifikasi</span>
              </div>
            </div>
            <SummaryRows
              rows={[
                { k: 'No. HP', v: p.phone || 'Belum diisi', tone: p.phone ? undefined : 'mute' },
                { k: 'Email', v: p.email || 'Belum diisi', tone: p.email ? undefined : 'mute' },
                { k: 'NIK', v: p.nik ? maskNik(p.nik) : 'Belum diisi' },
                { k: 'Tanggal lahir', v: p.birthDate ? dateLong(p.birthDate) : 'Belum diisi', tone: p.birthDate ? undefined : 'mute' },
                { k: 'Status', v: p.maritalStatus ? labelOf(MARITAL, p.maritalStatus) : 'Belum diisi' },
              ]}
            />
            <Button variant="outline" size="md" className="mt-3 w-fit" onClick={() => navigate('/profile/edit')}>
              <PencilIcon aria-hidden />
              {incomplete ? 'Lengkapi Profil' : 'Edit Profil'}
            </Button>
          </Panel>
          <Panel className="gap-1.5 sm:p-7">
            <div className="mb-1.5 flex items-center gap-3">
              <IconBox icon={BriefcaseIcon} />
              <h2 className="text-[17px] font-extrabold">Pekerjaan & penghasilan</h2>
            </div>
            <SummaryRows
              rows={[
                { k: 'Pekerjaan', v: p.occupation ? labelOf(OCCUPATIONS, p.occupation) : 'Belum diisi' },
                { k: 'Perusahaan', v: p.companyName || 'Belum diisi', tone: p.companyName ? undefined : 'mute' },
                { k: 'Penghasilan bulanan', v: f.monthlyIncome ? rupiah(f.monthlyIncome) : 'Belum diisi', tone: f.monthlyIncome ? undefined : 'mute' },
              ]}
            />
            <Disclaimer className="pt-2">Mengubah profil tidak mengubah data pengajuan yang sudah dikirim ke bank.</Disclaimer>
          </Panel>
        </div>
        <div className="flex min-w-0 flex-col gap-5">
          <Panel className="gap-1.5 sm:p-7">
            <div className="mb-1.5 flex items-center gap-3">
              <IconBox icon={BellIcon} />
              <h2 className="text-[17px] font-extrabold">Pengaturan Reminder</h2>
            </div>
            {m ? (
              <>
                <SummaryRows
                  rows={[
                    { k: 'Pembayaran', v: r.pay },
                    { k: 'Fixed', v: r.fixed },
                    { k: 'Kanal', v: r.ch },
                  ]}
                />
                <Button variant="outline" size="md" className="mt-3 w-fit" onClick={() => navigate('/profile/reminders')}>
                  Ubah Pengaturan
                </Button>
              </>
            ) : (
              <p className="text-sm text-ink-3">Reminder aktif setelah kamu menambahkan KPR untuk dipantau.</p>
            )}
          </Panel>
          <Panel className="gap-2.5 sm:p-7">
            <div className="flex items-center gap-3">
              <IconBox icon={ShieldCheckIcon} />
              <h2 className="text-[17px] font-extrabold">Privasi & persetujuan</h2>
            </div>
            <p className="text-sm leading-[21px] text-ink-3">Data kamu tidak dikirim ke bank tanpa persetujuan dan klik Submit. RuangKPR tidak pernah meminta password, PIN, atau OTP perbankan.</p>
            {(p.consents ?? []).map((c) => (
              <span key={c.type} className="text-[13px] text-muted-foreground">
                {c.type === 'terms' ? 'Syarat & Ketentuan' : 'Kebijakan Privasi'} v{c.version} · disetujui {dateLong(c.acceptedAt)}
              </span>
            ))}
            <Button variant="neutral" size="md" className="mt-2 w-fit text-danger" onClick={() => setConfirm(true)}>
              <LogOutIcon aria-hidden />
              Keluar
            </Button>
          </Panel>
        </div>
      </div>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        destructive={false}
        title="Keluar dari RuangKPR?"
        body="Draft dan data KPR yang sudah tersimpan tidak dihapus. Kamu bisa masuk lagi dengan kontak yang sama."
        confirmLabel="Keluar"
        onConfirm={async () => {
          await logout()
          navigate('/register', { replace: true })
        }}
      />
    </>
  )
}

export function ProfileEditPage() {
  const { data: snap, error, reload } = useResource(() => api.dashboard.getSnapshot())
  if (!snap) return error ? <ErrorPanel onRetry={reload} /> : <PageSkeleton />
  return <ProfileForm snap={snap} />
}

function ProfileForm({ snap }) {
  const navigate = useNavigate()
  const p = snap.profile ?? {}
  const f = snap.finance ?? {}
  const validate = useCallback((v) => ({ ...validatePersonal(v, { today: snap.clock }), ...validateEmploymentBasic(v) }), [snap.clock])
  const form = useForm(
    {
      fullName: p.fullName ?? '', nik: p.nik ?? '', birthPlace: p.birthPlace ?? '', birthDate: p.birthDate ?? '', gender: p.gender ?? '', maritalStatus: p.maritalStatus ?? '', address: p.address ?? '', phone: p.phone ?? '', email: p.email ?? '',
      occupation: p.occupation ?? '', companyName: p.companyName ?? '', jobTitle: p.jobTitle ?? '', workYears: intInput(p.workYears), workMonths: intInput(p.workMonths), monthlyIncome: moneyInput(f.monthlyIncome), jointIncome: f.jointIncome ?? false, partnerIncome: moneyInput(f.partnerIncome),
      vehicleDebt: moneyInput(f.vehicleDebt), cardDebt: moneyInput(f.cardDebt), otherDebt: moneyInput(f.otherDebt),
    },
    validate,
  )
  const [saving, setSaving] = useState(false)
  const [apiError, setApiError] = useState('')
  const v = form.values
  const contactField = snap.user?.contactType === 'email' ? 'email' : 'phone'
  const onSubmit = form.submit(async (x) => {
    setSaving(true)
    setApiError('')
    try {
      await api.profile.update({
        fullName: x.fullName.trim(), nik: x.nik, birthPlace: x.birthPlace.trim(), birthDate: x.birthDate, gender: x.gender, maritalStatus: x.maritalStatus, address: x.address.trim(), phone: x.phone.replace(/[\s-]/g, ''), email: x.email.trim(),
        occupation: x.occupation, companyName: x.companyName.trim(), jobTitle: x.jobTitle.trim(), workYears: Number(x.workYears), workMonths: Number(x.workMonths),
        finance: {
          monthlyIncome: toMoney(x.monthlyIncome), jointIncome: x.jointIncome, partnerIncome: x.jointIncome ? toMoney(x.partnerIncome) : null,
          vehicleDebt: toMoney(x.vehicleDebt), cardDebt: toMoney(x.cardDebt), otherDebt: toMoney(x.otherDebt),
        },
      })
      form.markClean()
      toast('Profil tersimpan.')
      navigate('/profile')
    } catch (e) {
      setApiError(e.message)
      setSaving(false)
    }
  })
  return (
    <>
      <PageHeader title="Edit profil" subtitle="Dipakai untuk mengisi otomatis pengajuan berikutnya." back="/profile" />
      <form onSubmit={onSubmit} noValidate className="flex max-w-[860px] flex-col gap-5">
        <UnsavedChangesGuard when={form.dirty && !saving} />
        <ErrorSummary show={form.showSummary} count={Object.keys(form.errors).length} />
        <Notice tone="info">Perubahan tidak memengaruhi snapshot pengajuan yang sudah dikirim. Kontak terverifikasi ({contactField === 'email' ? 'email' : 'nomor ponsel'}) belum bisa diubah pada versi ini karena butuh verifikasi OTP ulang.</Notice>
        <Panel className="gap-5 sm:p-7">
          <div className="flex items-center gap-3">
            <IconBox icon={UserIcon} />
            <h2 className="text-lg font-extrabold">Data pribadi</h2>
          </div>
          <FormGrid>
            <TextField label="Nama sesuai KTP" span {...form.bind('fullName')} />
            <TextField label="NIK" inputMode="numeric" maxLength={16} {...form.bind('nik')} onChange={(x) => form.set('nik', x.replace(/\D/g, '').slice(0, 16))} />
            <TextField label="Tempat lahir" {...form.bind('birthPlace')} />
            <DateField label="Tanggal lahir" max={snap.clock} {...form.bind('birthDate')} />
            <RadioCards label="Jenis kelamin" options={GENDERS} {...form.bind('gender')} />
            <SelectField label="Status perkawinan" options={MARITAL} {...form.bind('maritalStatus')} />
            <TextAreaField label="Alamat KTP" span {...form.bind('address')} />
            <TextField label="Nomor ponsel" inputMode="tel" disabled={contactField === 'phone'} hint={contactField === 'phone' ? 'Kontak terverifikasi.' : ''} {...form.bind('phone')} />
            <TextField label="Email" type="email" disabled={contactField === 'email'} hint={contactField === 'email' ? 'Kontak terverifikasi.' : ''} {...form.bind('email')} />
          </FormGrid>
        </Panel>
        <Panel className="gap-5 sm:p-7">
          <div className="flex items-center gap-3">
            <IconBox icon={BriefcaseIcon} />
            <h2 className="text-lg font-extrabold">Pekerjaan & penghasilan</h2>
          </div>
          <FormGrid>
            <SelectField label="Jenis pekerjaan" options={OCCUPATIONS} span {...form.bind('occupation')} />
            <TextField label="Nama perusahaan / usaha" {...form.bind('companyName')} />
            <TextField label="Jabatan / bidang usaha" {...form.bind('jobTitle')} />
            <NumberField label="Lama bekerja" suffix="tahun" {...form.bind('workYears')} />
            <NumberField label="Tambahan bulan" suffix="bulan" {...form.bind('workMonths')} />
            <MoneyField label="Penghasilan bulanan" span {...form.bind('monthlyIncome')} />
            <CheckboxField label="Gabungkan pendapatan pasangan" span checked={v.jointIncome} onChange={(x) => form.setValues({ ...v, jointIncome: x, partnerIncome: x ? v.partnerIncome : '' })} />
            {v.jointIncome && <MoneyField label="Penghasilan pasangan" span {...form.bind('partnerIncome')} />}
            <MoneyField label="Cicilan kendaraan" optional placeholder="0" {...form.bind('vehicleDebt')} />
            <MoneyField label="Kartu kredit / paylater" optional placeholder="0" {...form.bind('cardDebt')} />
            <MoneyField label="Pinjaman lain" optional placeholder="0" span hint="Dipakai untuk rasio cicilan di KPR Health." {...form.bind('otherDebt')} />
          </FormGrid>
        </Panel>
        {apiError && <Notice tone="bad" role="alert">{apiError}</Notice>}
        <div className="flex justify-between gap-3">
          <Button variant="neutral" onClick={() => navigate('/profile')}>
            Batal
          </Button>
          <Button type="submit" disabled={saving} aria-busy={saving}>
            {saving && <Spinner />}
            Simpan Profil
          </Button>
        </div>
      </form>
    </>
  )
}

export function ReminderSettingsPage() {
  const { data: snap, error, reload } = useResource(() => api.dashboard.getSnapshot())
  if (!snap) return error ? <ErrorPanel onRetry={reload} /> : <PageSkeleton />
  const m = snap.mortgages.find((x) => x.status === 'active')
  if (!m) return <Navigate to="/profile" replace />
  return <ReminderEditor m={m} clock={snap.clock} />
}

function ReminderEditor({ m, clock }) {
  const navigate = useNavigate()
  const isFixed = m.currentRateType === 'fixed' && m.fixedUntil > clock
  const [value, setValue] = useState(() => structuredClone(m.reminders))
  const [tried, setTried] = useState(false)
  const [saving, setSaving] = useState(false)
  const [apiError, setApiError] = useState('')
  const errors = validateReminders(value)
  const save = async (e) => {
    e.preventDefault()
    setTried(true)
    if (Object.keys(errors).length) return
    setSaving(true)
    setApiError('')
    try {
      await api.mortgages.update(m.id, { reminders: value })
      toast('Pengaturan reminder tersimpan.')
      navigate('/profile')
    } catch (err) {
      setApiError(err.message)
      setSaving(false)
    }
  }
  return (
    <>
      <PageHeader title="Pengaturan reminder" subtitle={`${m.bankName} · jatuh tempo tanggal ${m.dueDay}`} back="/profile" />
      <form onSubmit={save} className="flex max-w-[760px] flex-col gap-5">
        <Panel className="sm:p-7">
          <ReminderSettingsForm value={value} onChange={setValue} dueDay={m.dueDay} isFixed={isFixed} fixedUntil={m.fixedUntil} errors={tried ? errors : {}} />
        </Panel>
        <Notice tone="muted">Jika izin notifikasi perangkat ditolak, reminder email tetap aktif dan semua reminder tetap tercatat di Activity.</Notice>
        {apiError && <Notice tone="bad" role="alert">{apiError} Pilihan kamu tetap tersimpan di halaman ini.</Notice>}
        <div className="flex justify-between gap-3">
          <Button variant="neutral" onClick={() => navigate('/profile')}>
            Batal
          </Button>
          <Button type="submit" disabled={saving} aria-busy={saving}>
            {saving && <Spinner />}
            Simpan
          </Button>
        </div>
        <Link to="/activity" className="text-[13px] font-bold text-primary underline">
          Lihat riwayat reminder di Activity
        </Link>
      </form>
    </>
  )
}
