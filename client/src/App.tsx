import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import AppLayout from './components/AppLayout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Companies from './pages/Companies'
import FinancialYears from './pages/FinancialYears'
import Projects from './pages/Projects'
import FundReceipts from './pages/FundReceipts'
import Expenditures from './pages/Expenditures'
import Reports from './pages/Reports'
import AdminPanel from './pages/AdminPanel'
import UserDashboard from './pages/UserDashboard'

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
  )
}
