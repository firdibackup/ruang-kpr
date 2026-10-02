import { Navigate, Outlet, RouterProvider, createBrowserRouter } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AppShell } from '@/components/layout/AppShell'
import { SessionProvider, useSession } from '@/domains/session/SessionProvider'
import { RegisterPage, VerifyPage } from '@/domains/session/AuthPages'
import { HomePage } from '@/domains/home/HomePage'
import { PrimaryWizard } from '@/domains/applications/PrimaryWizard'
import { PrimarySuccess } from '@/domains/applications/PrimarySuccess'
import { ApplicationTracker } from '@/domains/applications/ApplicationTracker'
import { MonitoringIntro, MonitoringSuccess } from '@/domains/mortgages/MonitoringPages'
import { MortgageSetupWizard } from '@/domains/mortgages/MortgageSetupWizard'
import { MyKprLayout, MyKprResolver } from '@/domains/mortgages/MyKprLayout'
import { OverviewTab, PaymentTab, PropertyTab, RateTab } from '@/domains/mortgages/MyKprTabs'
import { AmortizationPage, AmortizationSchedulePage } from '@/domains/mortgages/AmortizationPages'
import { HealthPage } from '@/domains/mortgages/HealthPage'
import { ExplorePage, EducationPage } from '@/domains/explore/ExplorePages'
import { OptimizeIntro, OptimizeSuccess } from '@/domains/optimize/OptimizeIntro'
import { OptimizeStepPage } from '@/domains/optimize/OptimizeSteps'
import { GoalStartPage } from '@/domains/optimize/GoalStartPage'
import { BaselinePage, ProgramsPage, ProgramDetailPage, ConfirmProgramPage } from '@/domains/optimize/ProgramPages'
import { ActivityPage } from '@/domains/activity/ActivityPage'
import { ProfilePage, ProfileEditPage, ReminderSettingsPage } from '@/domains/profile/ProfilePages'
import { NotFoundPage } from './NotFoundPage'
import { DevPanel } from './DevPanel'

function RequireAuth() {
  const { session } = useSession()
  if (session.status === 'pending') return <Navigate to="/verify" replace />
  if (session.status !== 'authenticated') return <Navigate to="/register" replace />
  return <Outlet />
}

function GuestOnly({ pending = false }) {
  const { session } = useSession()
  if (session.status === 'authenticated') return <Navigate to="/" replace />
  if (pending && session.status !== 'pending') return <Navigate to="/register" replace />
  return <Outlet />
}

const router = createBrowserRouter([
  { element: <GuestOnly />, children: [{ path: '/register', element: <RegisterPage /> }] },
  { element: <GuestOnly pending />, children: [{ path: '/verify', element: <VerifyPage /> }] },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <HomePage /> },
          { path: 'home', element: <Navigate to="/" replace /> },
          { path: 'apply/primary/success', element: <PrimarySuccess /> },
          { path: 'apply/primary/:step/:productId?', element: <PrimaryWizard /> },
          { path: 'monitoring/intro', element: <MonitoringIntro /> },
          { path: 'monitoring/setup/:step/:part?', element: <MortgageSetupWizard /> },
          { path: 'monitoring/success', element: <MonitoringSuccess /> },
          { path: 'optimize/intro', element: <OptimizeIntro /> },
          { path: 'optimize/start', element: <GoalStartPage /> },
          { path: 'optimize/1/pekerjaan', element: <OptimizeStepPage employment /> },
          { path: 'optimize/baseline', element: <BaselinePage /> },
          { path: 'optimize/programs', element: <ProgramsPage /> },
          { path: 'optimize/programs/:productId', element: <ProgramDetailPage /> },
          { path: 'optimize/programs/:productId/confirm', element: <ConfirmProgramPage /> },
          { path: 'optimize/success', element: <OptimizeSuccess /> },
          { path: 'optimize/:step', element: <OptimizeStepPage /> },
          { path: 'my-kpr', element: <MyKprResolver /> },
          { path: 'my-kpr/application', element: <ApplicationTracker /> },
          {
            path: 'my-kpr',
            element: <MyKprLayout />,
            children: [
              { path: 'overview', element: <OverviewTab /> },
              { path: 'payment', element: <PaymentTab /> },
              { path: 'rate', element: <RateTab /> },
              { path: 'property', element: <PropertyTab /> },
            ],
          },
          { path: 'my-kpr/amortization', element: <AmortizationPage /> },
          { path: 'my-kpr/amortization/jadwal', element: <AmortizationSchedulePage /> },
          { path: 'my-kpr/health', element: <HealthPage /> },
          { path: 'explore', element: <ExplorePage /> },
          { path: 'education/:slug', element: <EducationPage /> },
          { path: 'activity', element: <ActivityPage /> },
          { path: 'profile', element: <ProfilePage /> },
          { path: 'profile/edit', element: <ProfileEditPage /> },
          { path: 'profile/reminders', element: <ReminderSettingsPage /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
])

export function App() {
  return (
    <SessionProvider>
      <RouterProvider router={router} />
      <Toaster
        position="bottom-center"
        offset={88}
        toastOptions={{ style: { background: '#0B1B33', color: '#fff', border: 'none', borderRadius: 14, fontFamily: 'inherit', fontWeight: 600, fontSize: 14 } }}
      />
      {import.meta.env.DEV && <DevPanel />}
    </SessionProvider>
  )
}
