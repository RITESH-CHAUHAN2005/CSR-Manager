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

function initials(name?: string) {
  if (!name) return 'U'
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export default function Sidebar({
  mobileOpen = false,
  onClose,
}: {
  mobileOpen?: boolean
  onClose?: () => void
}) {
  const { user, logout, role } = useAuth()

  // Per-role navigation:
  //   admin  — Dashboard + data pages + Admin Panel
  //   editor — Dashboard + data pages + My Dashboard (no Admin Panel)
  //   viewer — Dashboard + data pages (read-only)
  const nav =
    role === 'admin'
      ? [DASHBOARD, ...DATA_PAGES, ADMIN_PANEL]
      : role === 'editor'
        ? [DASHBOARD, ...DATA_PAGES, MY_DASHBOARD]
        : [DASHBOARD, ...DATA_PAGES]

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-30 bg-slate-950/50 backdrop-blur-sm lg:hidden"
          aria-hidden
        />
      )}

      <aside
        className={[
          'fixed inset-y-0 left-0 z-40 flex w-[260px] flex-shrink-0 flex-col border-r border-white/10 bg-sidebar/95 text-slate-300 backdrop-blur-xl transition-transform duration-300 ease-out lg:static lg:z-auto lg:translate-x-0 lg:shadow-2xl lg:shadow-black/30',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        {/* Brand */}
        <div className="flex items-center gap-3 px-5 py-5">
          <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-white/30">
            <img src="/logo.png" alt="CSR Fund Manager" className="h-full w-full object-contain" />
          </div>
          <div className="leading-tight">
            <p className="text-[15px] font-semibold tracking-tight text-white">CSR Fund Manager</p>
            <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
              Enterprise CSR
            </p>
          </div>
        </div>

        <div className="mx-5 mb-2 h-px bg-white/10" />

        {/* Nav */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/dashboard'}
              onClick={onClose}
              className={({ isActive }) =>
                [
                  'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-primary text-white shadow-lg shadow-primary/30'
                    : 'text-slate-300 hover:translate-x-0.5 hover:bg-white/5 hover:text-white',
                ].join(' ')
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    size={18}
                    weight={isActive ? 'fill' : 'regular'}
                    className="shrink-0 transition-transform duration-200 group-hover:scale-110"
                  />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User / logout */}
        <div className="border-t border-white/10 p-3">
          <div className="mb-2 flex items-center gap-3 rounded-xl px-2 py-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-light text-xs font-semibold text-white">
              {initials(user?.name)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">{user?.name}</p>
              <p className="text-xs capitalize text-slate-400">{user?.role}</p>
            </div>
          </div>
          <button
            onClick={() => {
              onClose?.()
              logout()
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
          >
            <LogOut size={18} />
            Sign out
          </button>
        </div>
      </aside>
    </>
  )
}
