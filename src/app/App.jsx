import { useEffect, useState } from 'react'
import { Navigate, Outlet, RouterProvider, createBrowserRouter } from 'react-router-dom'
import { Toaster } from 'sonner'
import { api } from '@/data/api'
import { PageSkeleton } from '@/components/shared/ui'
import { AppShell } from '@/components/layout/AppShell'
import { SessionProvider, useSession } from '@/domains/session/SessionProvider'
import { STAFF } from '@/data/roles'
import { RegisterPage, VerifyPage } from '@/domains/session/AuthPages'
import { HomePage } from '@/domains/home/HomePage'
import { PrimaryWizard } from '@/domains/applications/PrimaryWizard'
import { ApplicationTracker } from '@/domains/applications/ApplicationTracker'
import { MonitoringIntro } from '@/domains/mortgages/MonitoringPages'
import { MortgageSetupWizard } from '@/domains/mortgages/MortgageSetupWizard'
import { MyKprLayout, MyKprResolver } from '@/domains/mortgages/MyKprLayout'
import { OverviewTab, PaymentTab, PropertyTab, RateTab } from '@/domains/mortgages/MyKprTabs'
import { AmortizationPage, AmortizationSchedulePage } from '@/domains/mortgages/AmortizationPages'
import { HealthPage } from '@/domains/mortgages/HealthPage'
import { ExplorePage, EducationPage } from '@/domains/explore/ExplorePages'
import { OptimizeIntro } from '@/domains/optimize/OptimizeIntro'
import { OptimizeStepPage } from '@/domains/optimize/OptimizeSteps'
import { GoalStartPage } from '@/domains/optimize/GoalStartPage'
import { BaselinePage, ProgramsPage, ProgramDetailPage, ConfirmProgramPage } from '@/domains/optimize/ProgramPages'
import { ActivityPage } from '@/domains/activity/ActivityPage'
import { ProfilePage, ProfileEditPage, ReminderSettingsPage } from '@/domains/profile/ProfilePages'
import { AdminLayout, ForbiddenPage } from '@/domains/admin/AdminLayout'
import { OverviewPage as AdminOverviewPage } from '@/domains/admin/OverviewPage'
import { UserDetailPage, UserListPage } from '@/domains/admin/UsersPages'
import { ApplicationDetailPage, ApplicationListPage } from '@/domains/admin/ApplicationsPages'
import { BankListPage, ProductFormPage, ProductListPage } from '@/domains/admin/CatalogPages'
import { ArticleFormPage, ArticleListPage } from '@/domains/admin/ArticlesPages'
import { ReportsPage } from '@/domains/admin/ReportsPage'
import { ConfigurationPage, HealthConfigPage } from '@/domains/admin/ConfigurationPage'
import { AuditLogPage } from '@/domains/admin/AuditLogPage'
import { NotFoundPage } from './NotFoundPage'
import { DevPanel } from './DevPanel'

// TEMPORARY: the deployed demo has no Demo panel, so /admin signs anyone in as the seeded super admin instead of
// answering 403. Set to false (or delete with AdminDemoSignIn) to bring the gate back. Dev and E2E keep the gate.
const OPEN_ADMIN = import.meta.env.PROD

function AdminDemoSignIn() {
  const { refresh } = useSession()
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    api.auth
      .register({ name: 'Admin RuangKPR', contact: 'admin@ruangkpr.id', acceptTerms: true, acceptPrivacy: true })
      .then(() => api.auth.verifyOtp({ otp: '148260' }))
      .then(refresh)
      .catch(() => setFailed(true))
  }, [refresh])
  return failed ? <ForbiddenPage /> : <PageSkeleton />
}

// B2C pages send staff to their admin home (roles.js); /admin answers everyone else with a 403, never a silent
// redirect. UX only: every admin operation checks the role again in the data layer.
function RequireAuth({ admin = false }) {
  const { session } = useSession()
  if (admin && OPEN_ADMIN && !STAFF[session.role]) return <AdminDemoSignIn />
  if (session.status === 'pending') return <Navigate to="/verify" replace />
  if (session.status !== 'authenticated') return <Navigate to="/register" replace />
  const home = STAFF[session.role]?.home
  if (admin && !home) return <ForbiddenPage />
  if (!admin && home) return <Navigate to={home} replace />
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
    path: '/admin',
    element: <RequireAuth admin />,
    children: [
      {
        element: <AdminLayout />,
        children: [
          { index: true, element: <AdminOverviewPage /> },
          { path: 'users', element: <UserListPage /> },
          { path: 'users/:userId', element: <UserDetailPage /> },
          { path: 'applications', element: <ApplicationListPage /> },
          { path: 'applications/:applicationId', element: <ApplicationDetailPage /> },
          { path: 'products', element: <ProductListPage /> },
          { path: 'products/new', element: <ProductFormPage /> },
          { path: 'products/:productId', element: <ProductFormPage /> },
          { path: 'banks', element: <BankListPage /> },
          { path: 'articles', element: <ArticleListPage /> },
          { path: 'articles/new', element: <ArticleFormPage /> },
          { path: 'articles/:articleId', element: <ArticleFormPage /> },
          { path: 'reports', element: <ReportsPage /> },
          { path: 'configuration', element: <ConfigurationPage /> },
          { path: 'configuration/health', element: <HealthConfigPage /> },
          { path: 'audit-log', element: <AuditLogPage /> },
          { path: '*', element: <NotFoundPage to="/admin" label="Kembali ke Overview" /> },
        ],
      },
    ],
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <HomePage /> },
          { path: 'home', element: <Navigate to="/" replace /> },
          { path: 'apply/primary/:step/:productId?', element: <PrimaryWizard /> },
          { path: 'monitoring/intro', element: <MonitoringIntro /> },
          { path: 'monitoring/setup/:step', element: <MortgageSetupWizard /> },
          { path: 'optimize/intro', element: <OptimizeIntro /> },
          { path: 'optimize/start', element: <GoalStartPage /> },
          { path: 'optimize/1/pekerjaan', element: <OptimizeStepPage employment /> },
          { path: 'optimize/baseline', element: <BaselinePage /> },
          { path: 'optimize/programs', element: <ProgramsPage /> },
          { path: 'optimize/programs/:productId', element: <ProgramDetailPage /> },
          { path: 'optimize/programs/:productId/confirm', element: <ConfirmProgramPage /> },
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
