import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { homePathForRole, useAuth } from './context/AuthContext'
import type { Role } from './types'
import AppLayout from './components/AppLayout'
import { ForcePasswordChangeScreen } from './components/ChangePassword'

// Route-based code splitting: each page is emitted as its own hashed chunk under
// /assets (e.g. Dashboard-XXXX.js) and fetched on demand, instead of one giant
// bundle. This is the standard React production structure and keeps the initial
// load small.
const Login = lazy(() => import('./pages/Login'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Companies = lazy(() => import('./pages/Companies'))
const CompanyDetail = lazy(() => import('./pages/CompanyDetail'))
const FinancialYears = lazy(() => import('./pages/FinancialYears'))
const MasterData = lazy(() => import('./pages/MasterData'))
const Projects = lazy(() => import('./pages/Projects'))
const FundReceipts = lazy(() => import('./pages/FundReceipts'))
const Expenditures = lazy(() => import('./pages/Expenditures'))
const Reports = lazy(() => import('./pages/Reports'))
const AdminPanel = lazy(() => import('./pages/AdminPanel'))
const UserDashboard = lazy(() => import('./pages/UserDashboard'))

function PageFallback() {
  return (
    <div className="flex h-screen items-center justify-center bg-canvas text-muted">
      Loading…
    </div>
  )
}

function RequireAuth({ children }: { children: JSX.Element }) {
  const { isAuthenticated } = useAuth()
  return isAuthenticated ? children : <Navigate to="/login" replace />
}

// Restrict a route to specific roles. A signed-in user hitting a route they are not
// allowed to see is bounced to their own home page (not shown an error).
function RequireRole({ allow, children }: { allow: Role[]; children: JSX.Element }) {
  const { role } = useAuth()
  if (role && allow.includes(role)) return children
  return <Navigate to={homePathForRole(role)} replace />
}

export default function App() {
  const { isAuthenticated, loading, role, mustChangePassword } = useAuth()

  // Wait for session restore (mock: localStorage, API: /auth/me) before routing.
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-canvas text-slate-500">
        Loading…
      </div>
    )
  }

  // Account on a temporary password (admin just approved a reset): block the whole app
  // until they set their own password.
  if (isAuthenticated && mustChangePassword) {
    return <ForcePasswordChangeScreen />
  }

  return (
    <Suspense fallback={<PageFallback />}>
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to={homePathForRole(role)} replace /> : <Login />}
      />
      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        {/* Dashboard — visible to every signed-in role */}
        <Route path="/dashboard" element={<Dashboard />} />
        {/* Data pages — every role (write actions are gated inside each page) */}
        <Route path="/companies" element={<Companies />} />
        <Route path="/companies/:id" element={<CompanyDetail />} />
        <Route path="/financial-years" element={<FinancialYears />} />
        {/* Master Data — admin + editor only; viewer has no reason to manage dropdown lists */}
        <Route
          path="/master-data"
          element={
            <RequireRole allow={['admin', 'editor']}>
              <MasterData />
            </RequireRole>
          }
        />
        <Route path="/projects" element={<Projects />} />
        <Route path="/fund-receipts" element={<FundReceipts />} />
        <Route path="/expenditures" element={<Expenditures />} />
        <Route path="/reports" element={<Reports />} />
        {/* Admin Panel — admin only */}
        <Route
          path="/admin"
          element={
            <RequireRole allow={['admin']}>
              <AdminPanel />
            </RequireRole>
          }
        />
        {/* My Dashboard — editor's personal view */}
        <Route
          path="/my-dashboard"
          element={
            <RequireRole allow={['editor', 'viewer']}>
              <UserDashboard />
            </RequireRole>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to={homePathForRole(role)} replace />} />
    </Routes>
    </Suspense>
  )
}
