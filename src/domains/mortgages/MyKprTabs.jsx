import { useState } from 'react'
import { Link, useNavigate, useOutletContext, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowRightIcon, CircleCheckIcon, CircleIcon, CircleAlertIcon, PencilIcon, RefreshCwIcon } from 'lucide-react'
import { api } from '@/data/api'
import { addDays, addMonths, daysUntil } from '@/calculations/dates'
import { CERTIFICATES, PROPERTY_TYPES, dateLong, dateShort, daysLabel, labelOf, monthName, monthYear, percentBps, percentRatio, rupiah, signedRupiah, tenorLabel, toMoney } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { DateField, MoneyField, SelectField } from '@/components/shared/fields'
import { FormDialog } from '@/components/shared/dialogs'
import { Timeline } from '@/components/shared/progress'
import { Disclaimer, EstimateTag, Notice, Panel, ProgressBar, Spinner, SummaryRows } from '@/components/shared/ui'

export function OverviewTab() {
  const { m, d, snap } = useOutletContext()
  const navigate = useNavigate()
  return (
    <section className="grid grid-cols-1 gap-7 rounded-card bg-card p-6 shadow-card md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] sm:p-7" aria-label="Ringkasan KPR">
      <div className="flex min-w-0 flex-col gap-4">
        <span className="text-[13px] font-extrabold text-ink-3">Sisa Pokok {m.outstandingEstimated && <EstimateTag />}</span>
        <span className="text-[34px] font-extrabold tracking-[-1px] tabular sm:text-[40px]">{rupiah(m.outstandingPrincipal)}</span>
        <span className="mt-2 text-[13px] font-extrabold text-ink-3">Progress Pokok</span>
        <ProgressBar value={d.paidRatio * 100} size="lg" label="Progres pokok lunas" />
        <span className="text-sm font-bold text-primary">{Math.round(d.paidRatio * 100)}% lunas</span>
        <div className="grid grid-cols-3 gap-2 border-t border-line pt-3.5">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-extrabold">{monthYear(m.startDate)}</span>
            <span className="text-xs text-muted-foreground">Mulai</span>
          </div>
          <div className="flex flex-col gap-0.5 text-center">
            <span className="text-sm font-extrabold">Hari ini</span>
            <span className="text-xs text-muted-foreground">{dateShort(snap.clock)}</span>
          </div>
          <div className="flex flex-col gap-0.5 text-right">
            <span className="text-sm font-extrabold">{d.estimatedEndDate ? monthYear(d.estimatedEndDate) : 'Belum tersedia'}</span>
            <span className="text-xs text-muted-foreground">Est. lunas</span>
          </div>
        </div>
      </div>
      <div className="flex min-w-0 flex-col gap-1.5">
        <SummaryRows
          rows={[
            { k: 'Bank / produk', v: `${m.bankName}${m.productName ? ` · ${m.productName}` : ''}` },
            { k: 'Pinjaman Awal', v: rupiah(m.originalPrincipal) },
            { k: 'Cicilan Saat Ini', v: rupiah(m.currentPayment) },
            { k: 'Sisa Tenor', v: `${m.remainingTenorMonths} bulan (${tenorLabel(m.remainingTenorMonths)})` },
            { k: 'Bunga', v: `${percentBps(m.currentRateBps)} ${m.currentRateType === 'fixed' ? 'Fixed' : 'Floating'}` },
            { k: 'Jatuh tempo', v: `Setiap tanggal ${m.dueDay}` },
          ]}
        />
        <Button variant="outline" size="md" className="mt-3.5 w-fit" onClick={() => navigate('/monitoring/setup/1?edit=mykpr')}>
          <PencilIcon aria-hidden />
          Edit Data KPR
        </Button>
      </div>
    </section>
  )
}

export function PaymentTab() {
  const { m, d, snap, reload } = useOutletContext()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const row = d.schedule?.rows.find((r) => r.dueDate === d.nextDue) ?? null
  const paid = new Map(m.payments.filter((p) => p.status === 'paid').map((p) => [p.dueDate, p]))
  const previousDue = addMonths(d.nextDue, -1, m.dueDay)
  const months = [previousDue, d.nextDue, addMonths(d.nextDue, 1, m.dueDay)].filter((x) => x > m.startDate)
  const history = [...new Set([...m.payments.map((p) => p.dueDate), ...months])].sort().slice(-5)
  const unpaid = months.filter((x) => !paid.has(x) && x <= addDays(snap.clock, 31))

  const undo = async (payment) => {
    await api.mortgages.removePayment(m.id, payment.id)
    toast('Tanda pembayaran dibatalkan.')
    reload()
  }

  return (
    <div className="grid grid-cols-1 items-start gap-5 md:grid-cols-2">
      <Panel className="gap-3 sm:p-7">
        <span className="text-[13px] font-extrabold text-ink-3">Pembayaran berikutnya</span>
        <span className="text-[34px] font-extrabold tracking-[-0.6px] tabular">{rupiah(m.currentPayment)}</span>
        <span className="text-sm text-ink-3">
          {dateLong(d.nextDue)} · {daysLabel(d.daysToNextDue)}
        </span>
        {row ? (
          <SummaryRows
            className="mt-1.5"
            rows={[
              { k: `Pokok bulan ${monthName(d.nextDue)}`, v: rupiah(row.principal), tag: <EstimateTag>proyeksi</EstimateTag> },
              { k: `Bunga bulan ${monthName(d.nextDue)}`, v: rupiah(row.interest), tag: <EstimateTag>proyeksi</EstimateTag> },
            ]}
          />
        ) : (
          <Notice tone="muted">Komposisi pokok/bunga belum dapat dihitung: {d.scheduleMissing.join(', ') || 'data belum lengkap'}.</Notice>
        )}
        <Button className="mt-2.5 w-fit" onClick={() => navigate('/my-kpr/amortization')}>
          Lihat Jadwal Amortisasi
          <ArrowRightIcon aria-hidden />
        </Button>
      </Panel>
      <Panel className="gap-3 sm:p-7">
        <h2 className="text-[17px] font-extrabold">Riwayat pembayaran</h2>
        <ul className="flex flex-col">
          {history.map((due) => {
            const p = paid.get(due)
            const past = due < snap.clock
            return (
              <li key={due} className="flex min-h-[52px] flex-wrap items-center justify-between gap-2 border-b border-line px-1 text-sm last:border-b-0">
                <span className="font-bold">
                  {monthName(due)} {due.slice(0, 4)}
                </span>
                <span className="flex items-center gap-3">
                  <span className={`flex items-center gap-1.5 font-bold ${p ? 'text-success' : past ? 'text-warning-text' : 'text-muted-foreground'}`}>
                    {p ? <CircleCheckIcon className="size-4" aria-hidden /> : past ? <CircleAlertIcon className="size-4" aria-hidden /> : <CircleIcon className="size-4" aria-hidden />}
                    {p ? `Ditandai dibayar ${dateShort(p.paidAt)}` : past ? 'Belum ditandai' : 'Mendatang'}
                  </span>
                  {p && (
                    <button type="button" onClick={() => undo(p)} className="min-h-11 text-xs font-bold text-primary underline">
                      Batalkan
                    </button>
                  )}
                </span>
              </li>
            )
          })}
        </ul>
        {!m.payments.length && <p className="text-[13px] text-muted-foreground">Belum ada pembayaran yang ditandai.</p>}
        <Button variant="outline" size="md" className="mt-1.5 w-fit" onClick={() => setOpen(true)} disabled={!unpaid.length}>
          Tandai Pembayaran
        </Button>
        <Disclaimer>Status pembayaran kamu catat sendiri (user-recorded) dan tidak tersinkron dengan bank.</Disclaimer>
      </Panel>
      {open && <MarkPaidDialog onOpenChange={setOpen} m={m} dueOptions={unpaid} clock={snap.clock} onDone={reload} />}
    </div>
  )
}

function MarkPaidDialog({ onOpenChange, m, dueOptions, clock, onDone }) {
  const [dueDate, setDueDate] = useState(dueOptions[0] ?? '')
  const [amount, setAmount] = useState(String(m.currentPayment))
  const [paidAt, setPaidAt] = useState(clock)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const submit = async (e) => {
    e.preventDefault()
    if (!(toMoney(amount) > 0)) return setError('Nominal harus lebih dari 0.')
    if (!paidAt || paidAt > clock) return setError('Tanggal bayar tidak boleh di masa depan.')
    setPending(true)
    try {
      await api.mortgages.markPaid(m.id, { dueDate, amount: toMoney(amount), paidAt })
      toast('Pembayaran ditandai dibayar.')
      onOpenChange(false)
      onDone()
    } catch (err) {
      setError(err.message)
    } finally {
      setPending(false)
    }
  }
  return (
    <FormDialog open onOpenChange={onOpenChange} title="Tandai pembayaran" description="Status ini dicatat manual oleh kamu dan tidak dikonfirmasi bank.">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <SelectField label="Jatuh tempo" value={dueDate} onChange={setDueDate} options={dueOptions.map((x) => ({ value: x, label: dateLong(x) }))} />
        <MoneyField label="Nominal dibayar" value={amount} onChange={setAmount} />
        <DateField label="Tanggal bayar" value={paidAt} onChange={setPaidAt} max={clock} />
        {error && <p role="alert" className="text-[13px] font-semibold text-danger">{error}</p>}
        <Button type="submit" size="md" disabled={pending || !dueDate} aria-busy={pending}>
          {pending && <Spinner />}
          Simpan
        </Button>
      </form>
    </FormDialog>
  )
}

export function RateTab() {
  const { m, d, snap } = useOutletContext()
  const navigate = useNavigate()
  const fixed = d.mode !== 'floating'
  const fi = d.floatingImpact
  const steps = [
    ...(m.rateHistory ?? []).filter((p) => p.endDate).map((p) => ({ label: `${p.type === 'fixed' ? 'Fixed' : 'Floating'} ${percentBps(p.rateBps)}`, sub: `${dateShort(p.startDate)} – ${dateShort(p.endDate)}`, state: 'done' })),
    fixed
      ? { label: `Fixed ${percentBps(m.currentRateBps)}`, sub: `Sekarang – ${dateShort(m.fixedUntil)}`, state: 'current' }
      : { label: `Floating ${percentBps(m.currentRateBps)}`, sub: 'Saat ini', state: 'current' },
    ...(fixed && m.fixedUntil ? [{ label: m.estimatedFloatingRateBps ? `Estimasi Floating ${percentBps(m.estimatedFloatingRateBps)}` : 'Floating (estimasi belum diisi)', sub: `Mulai ${dateShort(addDays(m.fixedUntil, 1))}`, state: 'estimate' }] : []),
  ]
  return (
    <div className="grid grid-cols-1 items-start gap-5 md:grid-cols-2">
      <Panel className="gap-[18px] sm:p-7">
        <div className="flex flex-col gap-1">
          <span className="text-[13px] font-extrabold text-ink-3">Bunga saat ini</span>
          <span className="text-[34px] font-extrabold">
            {percentBps(m.currentRateBps)} {fixed ? 'Fixed' : 'Floating'}
          </span>
        </div>
        {fixed && m.fixedUntil && (
          <>
            <div className="flex flex-col gap-1">
              <span className="text-[13px] font-extrabold text-ink-3">Fixed berakhir</span>
              <span className="text-base font-bold">
                {dateLong(m.fixedUntil)} · {daysLabel(daysUntil({ fromDate: snap.clock, targetDate: m.fixedUntil }))}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[13px] font-extrabold text-ink-3">Berikutnya</span>
              {m.estimatedFloatingRateBps ? (
                <span className="flex items-center gap-2 text-base font-bold">
                  Floating {percentBps(m.estimatedFloatingRateBps)} <EstimateTag />
                </span>
              ) : (
                <span className="flex flex-wrap items-center gap-2 text-base font-bold text-warning-text">
                  Estimasi floating belum diisi
                  <Link to="/monitoring/setup/2?edit=rate" className="text-[13px] text-primary underline">
                    Edit
                  </Link>
                </span>
              )}
            </div>
          </>
        )}
        <div className="flex flex-col gap-1 rounded-2xl bg-muted px-[18px] py-4">
          <span className="text-[13px] font-extrabold text-ink-3">Dampak cicilan</span>
          <span className="text-base font-extrabold">
            {fi ? (
              <>
                {rupiah(fi.currentPayment)} → estimasi {rupiah(fi.estimatedNextPayment)} ({signedRupiah(fi.monthlyDelta)}/bln)
              </>
            ) : fixed ? (
              'Belum dapat dihitung'
            ) : (
              `${rupiah(m.currentPayment)}/bulan dengan bunga floating`
            )}
          </span>
          {fi && <span className="text-xs text-muted-foreground">Dihitung dari proyeksi sisa pokok saat reset {dateShort(fi.resetDate)} dan sisa tenor yang sama.</span>}
        </div>
        <Button className="w-fit" onClick={() => navigate('/explore')}>
          Bandingkan Pilihan
        </Button>
      </Panel>
      <Panel className="gap-3.5 sm:p-7">
        <h2 className="text-[17px] font-extrabold">Timeline bunga</h2>
        <Timeline label="Riwayat dan rencana periode bunga" steps={steps} />
        <Disclaimer>Bunga floating di masa depan selalu estimasi dan dapat berubah mengikuti kebijakan bank.</Disclaimer>
      </Panel>
    </div>
  )
}

export function PropertyTab() {
  const { m, d, snap, setMortgage } = useOutletContext()
  const [params, setParams] = useSearchParams()
  const [open, setOpen] = useState(params.get('edit') === '1')
  const [value, setValue] = useState(String(m.property?.estimatedValue ?? ''))
  const [asOf, setAsOf] = useState(snap.clock)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const p = m.property ?? {}
  const hasValue = p.estimatedValue > 0
  const save = async (e) => {
    e.preventDefault()
    if (!(toMoney(value) > 0)) return setError('Isi estimasi nilai properti.')
    if (!asOf || asOf > snap.clock) return setError('Tanggal tidak boleh di masa depan.')
    setPending(true)
    try {
      setMortgage(await api.mortgages.update(m.id, { property: { estimatedValue: toMoney(value), valueAsOf: asOf, valueLater: false } }))
      toast('Nilai properti diperbarui.')
      setOpen(false)
      setParams({})
    } catch (err) {
      setError(err.message)
    } finally {
      setPending(false)
    }
  }
  return (
    <section className="grid grid-cols-1 gap-7 rounded-card bg-card p-6 shadow-card md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] sm:p-7" aria-label="Properti">
      <div className="flex min-w-0 flex-col gap-2.5">
        <h2 className="text-xl font-extrabold">{p.address || 'Alamat belum diisi'}</h2>
        <span className="text-sm text-ink-3">
          {labelOf(PROPERTY_TYPES, p.type)} · LT {p.landArea ?? '–'} / LB {p.buildingArea ?? '–'} · {labelOf(CERTIFICATES, p.certificateType)}
        </span>
        <SummaryRows
          className="mt-2"
          rows={
            hasValue
              ? [
                  { k: 'Estimasi nilai rumah', v: rupiah(p.estimatedValue), tag: <EstimateTag /> },
                  { k: 'Sisa pokok', v: rupiah(m.outstandingPrincipal) },
                  { k: 'Estimasi equity', v: rupiah(d.property.equity), tone: d.property.equity >= 0 ? 'ok' : 'bad' },
                  { k: 'LTV', v: percentRatio(d.property.ltvRatio), tone: d.property.ltvRatio > 1 ? 'bad' : undefined },
                ]
              : [
                  { k: 'Estimasi nilai rumah', v: 'Belum diisi', tone: 'warn' },
                  { k: 'Sisa pokok', v: rupiah(m.outstandingPrincipal) },
                  { k: 'Estimasi equity', v: 'Belum dapat dihitung', tone: 'mute' },
                  { k: 'LTV', v: 'Belum dapat dihitung', tone: 'mute' },
                ]
          }
        />
        {hasValue && d.property.equity < 0 && <Notice tone="warn">Sisa pokok lebih besar dari estimasi nilai rumah (equity negatif).</Notice>}
      </div>
      <div className="flex min-w-0 flex-col gap-3.5">
        <span className="text-[13px] text-ink-3">{hasValue ? `Nilai diperbarui ${dateShort(p.valueAsOf)}` : 'Nilai properti belum diisi.'}</span>
        <Button variant="outline" size="md" className="w-fit" onClick={() => setOpen(true)}>
          <RefreshCwIcon aria-hidden />
          {hasValue ? 'Perbarui Nilai' : 'Isi Nilai Properti'}
        </Button>
        <div className="flex flex-col gap-1.5 rounded-2xl bg-muted px-[18px] py-4 text-[13px] leading-5 text-ink-3">
          <span>Nilai properti bukan appraisal resmi.</span>
          <span>Equity bukan otomatis dana tunai.</span>
        </div>
      </div>
      <FormDialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setParams({}) }} title="Perbarui nilai properti" description="Isi perkiraan nilai rumah saat ini. Bukan appraisal resmi.">
        <form onSubmit={save} className="flex flex-col gap-4">
          <MoneyField label="Estimasi nilai properti sekarang" placeholder="850.000.000" value={value} onChange={(x) => { setValue(x); setError('') }} />
          <DateField label="Tanggal nilai" value={asOf} onChange={setAsOf} max={snap.clock} />
          {error && <p role="alert" className="text-[13px] font-semibold text-danger">{error}</p>}
          <Button type="submit" size="md" disabled={pending} aria-busy={pending}>
            {pending && <Spinner />}
            Simpan
          </Button>
        </form>
      </FormDialog>
    </section>
  )
}
