import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import AppLayout from './components/AppLayout'

// Route-based code splitting: each page is emitted as its own hashed chunk under
// /assets (e.g. Dashboard-XXXX.js) and fetched on demand, instead of one giant
// bundle. This is the standard React production structure and keeps the initial
// load small.
const Login = lazy(() => import('./pages/Login'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Companies = lazy(() => import('./pages/Companies'))
const FinancialYears = lazy(() => import('./pages/FinancialYears'))
const Projects = lazy(() => import('./pages/Projects'))
const FundReceipts = lazy(() => import('./pages/FundReceipts'))
const Expenditures = lazy(() => import('./pages/Expenditures'))
const Reports = lazy(() => import('./pages/Reports'))
const AdminPanel = lazy(() => import('./pages/AdminPanel'))
const UserDashboard = lazy(() => import('./pages/UserDashboard'))

function PageFallback() {
  return (
    <div className="flex h-screen items-center justify-center bg-canvas text-slate-500">
      Loading…
    </div>
  )
}

function RequireAuth({ children }: { children: JSX.Element }) {
  const { isAuthenticated } = useAuth()
  return isAuthenticated ? children : <Navigate to="/login" replace />
}

export default function App() {
  const { isAuthenticated, loading } = useAuth()

  // Wait for session restore (mock: localStorage, API: /auth/me) before routing.
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-canvas text-slate-500">
        Loading…
      </div>
    )
  }

  return (
    <Suspense fallback={<PageFallback />}>
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />}
      />
      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/companies" element={<Companies />} />
        <Route path="/financial-years" element={<FinancialYears />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/fund-receipts" element={<FundReceipts />} />
        <Route path="/expenditures" element={<Expenditures />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="/my-dashboard" element={<UserDashboard />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
    </Suspense>
  )
}
