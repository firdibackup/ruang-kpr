import { useCallback, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeftIcon, CircleAlertIcon, HouseIcon } from 'lucide-react'
import { api } from '@/data/api'
import { useCountdown, useForm } from '@/lib/hooks'
import { Button } from '@/components/ui/button'
import { Brand } from '@/components/layout/AppShell'
import { CheckboxField, TextField } from '@/components/shared/fields'
import { FormDialog } from '@/components/shared/dialogs'
import { HouseIllustration } from '@/components/shared/HouseIllustration'
import { Spinner } from '@/components/shared/ui'
import { useSession } from './SessionProvider'
import { validateRegister } from './validation'

function AuthLayout({ children }) {
  return (
    <div className="flex min-h-dvh bg-[linear-gradient(-136deg,#003DA5_16%,#00266B_53%,#DC1C2E_84%)] p-2 sm:p-4">
      <div className="flex min-w-0 flex-1 flex-col gap-6 rounded-[26px] bg-card px-5 py-5 sm:px-10 sm:pt-7 sm:pb-6">
        <div className="flex items-center justify-between gap-4">
          <Brand />
          <span className="text-[13px] font-semibold text-ink-3">Butuh bantuan? cs@ruangkpr.id</span>
        </div>
        <div className="grid flex-1 grid-cols-1 items-stretch gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="hidden flex-col justify-between gap-5 overflow-hidden rounded-[22px] bg-muted bg-[radial-gradient(ellipse_85%_52%_at_100%_100%,#003DA5D9_0%,#003DA500_100%),radial-gradient(ellipse_80%_52%_at_0%_100%,#DC1C2EA6_0%,#DC1C2E00_100%)] p-9 lg:flex">
            <div className="flex flex-col gap-[18px]">
              <span className="text-[11px] font-extrabold tracking-[0.6px] text-primary">KPR COMMAND CENTER</span>
              <p className="text-[46px] leading-[52px] font-extrabold tracking-[-1.4px] text-[#0b1528]">
                Semua tentang
                <br />
                KPR kamu.
                <br />
                Satu tempat.
              </p>
              <p className="max-w-[440px] text-[15px] leading-[23px] text-ink-3">Dari rencana rumah pertama sampai mengelola cicilan, lanjutkan perjalananmu di sini.</p>
            </div>
            <div className="h-[260px] overflow-hidden rounded-[18px]">
              <HouseIllustration className="size-full" />
            </div>
            <div className="flex items-center gap-3 rounded-xl bg-white/95 px-[18px] py-3.5 text-primary">
              <HouseIcon className="size-[22px]" aria-hidden />
              <span className="text-[13px] leading-5 font-semibold text-ink-2">Mulai dengan memahami, bukan menebak.</span>
            </div>
          </div>
          <div className="flex min-w-0 flex-col items-center justify-center py-6">
            <main className="flex w-full max-w-[440px] flex-col gap-6">{children}</main>
          </div>
        </div>
        <div className="flex flex-wrap justify-between gap-6 text-[11px] leading-[17px] text-muted-foreground">
          <span>© 2026 RuangKPR · Data demo</span>
          <span>Kebijakan Privasi · Syarat &amp; Ketentuan</span>
        </div>
      </div>
    </div>
  )
}

const LEGAL = {
  terms: { title: 'Syarat & Ketentuan', body: 'RuangKPR membantu kamu memahami, mengajukan, dan memantau KPR. Semua hasil simulasi adalah estimasi dan bukan persetujuan kredit. Data hanya dikirim ke bank setelah kamu memilih satu program dan menekan Submit. Dokumen legal final masih menunggu review sebelum produksi.' },
  privacy: { title: 'Kebijakan Privasi', body: 'Data pribadi, penghasilan, dan dokumen hanya dipakai untuk analisis dan pengajuan yang kamu setujui. Kami tidak pernah meminta password, PIN, atau OTP perbankan kamu. Pada versi prototipe ini data disimpan di browser kamu saja.' },
}

export function RegisterPage() {
  const navigate = useNavigate()
  const { refresh } = useSession()
  const [legal, setLegal] = useState(null)
  const [apiError, setApiError] = useState('')
  const [pending, setPending] = useState(false)
  const form = useForm({ name: '', contact: '', acceptTerms: false, acceptPrivacy: false }, validateRegister)

  const onSubmit = form.submit(async (v) => {
    setPending(true)
    setApiError('')
    try {
      await api.auth.register({ name: v.name.trim(), contact: v.contact.trim(), acceptTerms: v.acceptTerms, acceptPrivacy: v.acceptPrivacy })
      await refresh()
      navigate('/verify')
    } catch (e) {
      setApiError(e.message)
    } finally {
      setPending(false)
    }
  })

  return (
    <AuthLayout>
      <div className="flex flex-col gap-2.5">
        <span className="w-fit rounded-full bg-secondary px-3 py-1.5 text-xs font-bold text-primary">Registrasi Akun</span>
        <h1 className="text-[32px] leading-[38px] font-extrabold tracking-[-0.7px]">Buat akun</h1>
        <p className="text-sm leading-[21px] text-ink-3">Daftar untuk mulai mengajukan dan memantau KPR kamu.</p>
      </div>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-[18px]">
        <TextField label="Nama Lengkap" placeholder="Firdi Audi" autoComplete="name" {...form.bind('name')} />
        <TextField label="No. WhatsApp / Email" placeholder="0812 3456 7890 atau nama@email.com" hint="Kode OTP dikirim ke kontak ini." autoComplete="username" {...form.bind('contact')} />
        <div className="flex flex-col gap-1">
          <CheckboxField label="Saya setuju dengan Syarat & Ketentuan RuangKPR." checked={form.values.acceptTerms} onChange={(v) => form.set('acceptTerms', v)} error={form.error('acceptTerms')} name="acceptTerms" />
          <button type="button" onClick={() => setLegal('terms')} className="ml-[34px] w-fit text-[13px] font-bold text-primary hover:underline">
            Baca Syarat & Ketentuan
          </button>
        </div>
        <div className="flex flex-col gap-1">
          <CheckboxField label="Saya setuju dengan Kebijakan Privasi RuangKPR." checked={form.values.acceptPrivacy} onChange={(v) => form.set('acceptPrivacy', v)} error={form.error('acceptPrivacy')} name="acceptPrivacy" />
          <button type="button" onClick={() => setLegal('privacy')} className="ml-[34px] w-fit text-[13px] font-bold text-primary hover:underline">
            Baca Kebijakan Privasi
          </button>
        </div>
        {apiError && (
          <p role="alert" className="flex items-center gap-2 text-[13px] font-semibold text-danger">
            <CircleAlertIcon className="size-4" aria-hidden />
            {apiError}
          </p>
        )}
        <div className="flex flex-col gap-2.5">
          <Button type="submit" className={form.hasErrors ? 'bg-border text-ink-3 hover:bg-border' : ''} aria-disabled={form.hasErrors || pending} aria-busy={pending}>
            {pending && <Spinner />}
            {pending ? 'Mengirim kode…' : 'Daftar'}
          </Button>
          {form.hasErrors && <span className="text-center text-xs text-muted-foreground">Lengkapi semua field dan centang kedua persetujuan untuk lanjut.</span>}
        </div>
        <p className="text-center text-xs leading-[18px] text-ink-3">Tanpa password. Kode verifikasi dikirim ke kontak kamu.</p>
      </form>
      <FormDialog open={!!legal} onOpenChange={(o) => !o && setLegal(null)} title={legal ? LEGAL[legal].title : ''}>
        <p className="text-sm leading-[22px] text-ink-3">{legal && LEGAL[legal].body}</p>
      </FormDialog>
    </AuthLayout>
  )
}

export function VerifyPage() {
  const navigate = useNavigate()
  const { session, refresh } = useSession()
  const [digits, setDigits] = useState(['', '', '', '', '', ''])
  const [error, setError] = useState('')
  const [expired, setExpired] = useState(false)
  const [pending, setPending] = useState(false)
  const [resendAt, setResendAt] = useState(session.verification?.resendAvailableAt ?? 0)
  const wait = useCountdown(resendAt)
  const refs = useRef([])
  const code = digits.join('')

  const focusAt = (i) => refs.current[Math.max(0, Math.min(5, i))]?.focus()
  const fill = (text) => {
    const d = text.replace(/\D/g, '').slice(0, 6).split('')
    setDigits([...d, ...Array(6 - d.length).fill('')])
    setError('')
    focusAt(d.length)
  }
  const onInput = (i, value) => {
    const d = value.replace(/\D/g, '')
    if (d.length > 1) return fill(d)
    setDigits((prev) => prev.map((x, j) => (j === i ? d : x)))
    setError('')
    if (d && i < 5) focusAt(i + 1)
  }

  const verify = useCallback(async () => {
    if (code.length < 6 || pending) return
    setPending(true)
    try {
      await api.auth.verifyOtp({ otp: code })
      await refresh()
      toast.success('Akun terverifikasi. Selamat datang di RuangKPR!')
      navigate('/', { replace: true })
    } catch (e) {
      setError(e.message)
      setExpired(e.code === 'OTP_EXPIRED')
      setDigits(['', '', '', '', '', ''])
      focusAt(0)
    } finally {
      setPending(false)
    }
  }, [code, pending, refresh, navigate])

  const resend = async () => {
    if (wait > 0) return
    try {
      const r = await api.auth.resendOtp()
      setResendAt(r.resendAvailableAt)
      setError('')
      setExpired(false)
      toast('Kode OTP baru sudah dikirim.')
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <AuthLayout>
      <button type="button" onClick={() => navigate('/register')} className="flex min-h-11 w-fit items-center gap-1.5 text-[13px] font-bold text-primary">
        <ArrowLeftIcon className="size-4" aria-hidden />
        Ubah kontak
      </button>
      <div className="flex flex-col gap-2.5">
        <span className="w-fit rounded-full bg-secondary px-3 py-1.5 text-xs font-bold text-primary">Verifikasi Akun</span>
        <h1 className="text-[32px] leading-[38px] font-extrabold tracking-[-0.7px]">Masukkan kode OTP</h1>
        <p className="text-sm leading-[21px] text-ink-3">
          Kode 6 digit sudah dikirim ke <b className="text-foreground">{session.verification?.maskedDestination}</b>.
        </p>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          verify()
        }}
        className="flex flex-col gap-6"
      >
        <fieldset className="flex flex-col gap-2.5">
          <legend className="sr-only">Kode verifikasi 6 digit</legend>
          <div className="flex gap-2.5">
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => (refs.current[i] = el)}
                value={d}
                onChange={(e) => onInput(i, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Backspace' && !digits[i] && i > 0) focusAt(i - 1)
                }}
                onPaste={(e) => {
                  e.preventDefault()
                  fill(e.clipboardData.getData('text'))
                }}
                inputMode="numeric"
                autoComplete={i === 0 ? 'one-time-code' : 'off'}
                maxLength={6}
                aria-label={`Digit ${i + 1} dari 6`}
                aria-invalid={error ? 'true' : undefined}
                className={`h-[60px] w-full max-w-[60px] min-w-0 flex-1 rounded-lg border bg-field text-center text-[22px] font-bold outline-none focus:border-primary focus:ring-3 focus:ring-ring/15 ${error ? 'border-brand-red' : d ? 'border-primary' : 'border-input'}`}
              />
            ))}
          </div>
          {error && (
            <span role="alert" className="flex items-center gap-1.5 text-[13px] font-semibold text-danger">
              <CircleAlertIcon className="size-4" aria-hidden />
              {error}
            </span>
          )}
          <span className="text-xs text-muted-foreground">Mode demo: gunakan kode 148260 (000000 = salah, 999999 = kedaluwarsa).</span>
        </fieldset>
        <Button type="submit" disabled={code.length < 6 || pending} aria-busy={pending}>
          {pending && <Spinner />}
          {pending ? 'Memverifikasi…' : 'Verifikasi'}
        </Button>
        <div className="flex flex-wrap items-center justify-center gap-1.5 text-[13px] text-ink-3">
          <span>{expired ? 'Kode kedaluwarsa?' : 'Belum terima kode?'}</span>
          <button type="button" onClick={resend} aria-disabled={wait > 0} className={`min-h-11 font-bold ${wait > 0 ? 'cursor-not-allowed text-muted-foreground' : 'text-primary'}`}>
            {wait > 0 ? `Kirim Ulang (0:${String(wait).padStart(2, '0')})` : 'Kirim Ulang'}
          </button>
        </div>
      </form>
    </AuthLayout>
  )
}
