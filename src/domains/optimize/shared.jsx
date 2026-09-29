import { api } from '@/data/api'
import { useResource } from '@/lib/hooks'
import { PageHeader } from '@/components/layout/AppShell'
import { WizardProgress } from '@/components/shared/progress'
import { SummaryRows } from '@/components/shared/ui'
import { activeApplication } from '@/domains/home/selectHomeState'
import { TAKEOVER_STEPS } from '@/domains/applications/meta'

export const modeName = (mode) => (mode === 'topup' ? 'Refinancing + Top-up' : 'Take Over')

// Snapshot + the active Take Over draft (if any). Pages refetch after mutations.
export function useOptimize() {
  const res = useResource(() => api.dashboard.getSnapshot())
  const app = res.data ? activeApplication(res.data.applications) : null
  const takeover = app?.productType === 'takeover' ? app : null
  const setApp = (next) => res.setData((s) => ({ ...s, applications: s.applications.map((a) => (a.id === next.id ? next : a)) }))
  return { ...res, snap: res.data, app: takeover, otherApp: app && !takeover ? app : null, setApp }
}

export function OptimizeHeader({ n, title, subtitle, back, comparePhase = false, saving }) {
  return (
    <>
      <PageHeader title={title} subtitle={subtitle} back={back} />
      {n && (
        <WizardProgress
          label={`Step ${n} dari 7 · ${comparePhase ? 'Bandingkan program' : TAKEOVER_STEPS[n - 1]}`}
          steps={TAKEOVER_STEPS}
          current={comparePhase ? 6 : n}
          saving={saving}
        />
      )}
    </>
  )
}

export function Aside({ icon: Icon, title, note, rows, tone = 'info' }) {
  return (
    <aside className="flex flex-col gap-3.5 rounded-card bg-card p-6 shadow-card lg:sticky lg:top-6">
      <div className="flex items-center gap-2.5">
        <Icon className="size-5 text-primary" aria-hidden />
        <span className="text-base font-extrabold">{title}</span>
      </div>
      {rows?.length > 0 && <SummaryRows size="sm" rows={rows} />}
      {note && <p className={`rounded-xl px-3.5 py-3 text-[13px] leading-5 font-medium ${tone === 'warn' ? 'bg-warning-bg text-warning' : 'bg-secondary text-ink-2'}`}>{note}</p>}
    </aside>
  )
}
