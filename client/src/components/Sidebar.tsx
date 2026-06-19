import { NavLink } from 'react-router-dom'
import {
  BarChart3,
  Briefcase,
  Building2,
  CalendarDays,
  FileText,
  Gauge,
  LayoutGrid,
  LogOut,
  Receipt,
  UserCircle,
} from './icons'
import { useAuth } from '../context/AuthContext'

const DASHBOARD = { to: '/dashboard', label: 'Dashboard', icon: LayoutGrid }
// Data pages — visible to every role.
const DATA_PAGES = [
  { to: '/companies', label: 'Companies', icon: Building2 },
  { to: '/financial-years', label: 'Financial Years', icon: CalendarDays },
  { to: '/projects', label: 'Projects', icon: Briefcase },
  { to: '/fund-receipts', label: 'Fund Receipts', icon: FileText },
  { to: '/expenditures', label: 'Expenditures', icon: Receipt },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
]
const ADMIN_PANEL = { to: '/admin', label: 'Admin Panel', icon: Gauge }
const MY_DASHBOARD = { to: '/my-dashboard', label: 'My Dashboard', icon: UserCircle }

export default function Sidebar() {
  const { user, logout, role } = useAuth()

  // Per-role navigation:
  //   admin  — Dashboard + data pages + Admin Panel
  //   editor — data pages + My Dashboard (no Dashboard, no Admin Panel)
  //   viewer — Dashboard + data pages (read-only)
  const nav =
    role === 'admin'
      ? [DASHBOARD, ...DATA_PAGES, ADMIN_PANEL]
      : role === 'editor'
        ? [...DATA_PAGES, MY_DASHBOARD]
        : [DASHBOARD, ...DATA_PAGES]

  return (
    <aside className="flex h-screen w-64 flex-shrink-0 flex-col bg-sidebar text-slate-200">
      {/* Logo */}
      <div className="flex items-center gap-3 border-b border-white/10 px-6 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-white">
          <Building2 size={20} />
        </div>
        <span className="text-lg font-semibold tracking-tight text-white">CSR Manager</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {nav.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              [
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-slate-300 hover:bg-sidebar-hover hover:text-white',
              ].join(' ')
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User / logout */}
      <div className="border-t border-white/10 px-3 py-4">
        <div className="mb-2 px-3">
          <p className="truncate text-sm font-medium text-white">{user?.name}</p>
          <p className="text-xs capitalize text-slate-400">{user?.role}</p>
        </div>
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-sidebar-hover hover:text-white"
        >
          <LogOut size={18} />
          Sign out
        </button>
      </div>
    </aside>
  )
}
