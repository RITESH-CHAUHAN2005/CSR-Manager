import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  BarChart3,
  Briefcase,
  Building2,
  CalendarDays,
  ChevronDown,
  Database,
  FileText,
  Gauge,
  LayoutGrid,
  LogOut,
  Receipt,
  UserCircle,
} from './icons'
import { useAuth } from '../context/AuthContext'

const DASHBOARD = { to: '/dashboard', label: 'Dashboard', icon: LayoutGrid }

// Two sequential top-level groups — the order mirrors the natural workflow:
// set up a donor + funding year, record what came in, then allocate/spend it
// and report on it.
const FUNDING_PAGES = [
  { to: '/companies', label: 'Companies', icon: Building2 },
  { to: '/financial-years', label: 'Financial Years', icon: CalendarDays },
  { to: '/fund-receipts', label: 'Fund Receipts', icon: FileText },
]
const DELIVERY_PAGES = [
  { to: '/projects', label: 'Projects', icon: Briefcase },
  { to: '/expenditures', label: 'Expenditures', icon: Receipt },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
]

const MASTER_DATA = { to: '/master-data', label: 'Master Data', icon: Database }
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

function NavItem({
  to,
  label,
  icon: Icon,
  onClick,
  indent = 0,
}: {
  to: string
  label: string
  icon: typeof LayoutGrid
  onClick?: () => void
  indent?: number
}) {
  return (
    <NavLink
      to={to}
      end={to === '/dashboard'}
      onClick={onClick}
      className={({ isActive }) =>
        [
          'group flex items-center gap-3 rounded-xl py-2.5 text-sm font-medium transition-all duration-200',
          indent === 2 ? 'pl-14 pr-3' : indent === 1 ? 'pl-9 pr-3' : 'px-3',
          isActive
            ? 'bg-primary text-white shadow-lg shadow-primary/30'
            : 'text-muted hover:translate-x-0.5 hover:bg-ink/5 hover:text-ink',
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
  )
}

function NavGroup({
  label,
  icon: Icon,
  active,
  indent = 0,
  children,
}: {
  label: string
  icon: typeof LayoutGrid
  active: boolean
  indent?: number
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(true)
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={[
          'flex w-full items-center justify-between gap-3 rounded-xl py-2.5 text-sm font-medium transition-colors',
          indent === 1 ? 'pl-9 pr-3' : 'px-3',
          active ? 'text-ink' : 'text-muted hover:bg-ink/5 hover:text-ink',
        ].join(' ')}
      >
        <span className="flex items-center gap-3">
          <Icon size={18} className="shrink-0" />
          {label}
        </span>
        <ChevronDown size={16} className={`shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="space-y-1">{children}</div>}
    </div>
  )
}

export default function Sidebar({
  mobileOpen = false,
  onClose,
}: {
  mobileOpen?: boolean
  onClose?: () => void
}) {
  const { user, logout, role, canWrite } = useAuth()
  const { pathname } = useLocation()

  const fundingActive = FUNDING_PAGES.some((p) => pathname.startsWith(p.to))
  const deliveryActive = DELIVERY_PAGES.some((p) => pathname.startsWith(p.to))

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
          // No backdrop-blur: at 95% opacity it is invisible, but it forces a
          // compositing layer that repaints a frame behind the rest of the page.
          'fixed inset-y-0 left-0 z-40 flex w-[260px] flex-shrink-0 flex-col border-r border-line bg-sidebar text-muted transition-transform duration-300 ease-out lg:static lg:z-auto lg:translate-x-0 lg:shadow-2xl lg:shadow-black/10',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        {/* Brand */}
        <div className="flex items-center gap-3 px-5 py-5">
          <img src="/logo.png" alt="CSR Fund Manager" className="h-11 w-11 object-contain" />
          <div className="leading-tight">
            <p className="text-[15px] font-semibold tracking-tight text-ink">CSR Fund Manager</p>
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted">
              Enterprise CSR
            </p>
          </div>
        </div>

        <div className="mx-5 mb-2 h-px bg-line" />

        {/* Nav */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
          <NavItem {...DASHBOARD} onClick={onClose} />

          <NavGroup label="Funding" icon={FileText} active={fundingActive}>
            {FUNDING_PAGES.map((p) => (
              <NavItem key={p.to} {...p} onClick={onClose} indent={1} />
            ))}
          </NavGroup>
          <NavGroup label="Delivery" icon={Briefcase} active={deliveryActive}>
            {DELIVERY_PAGES.map((p) => (
              <NavItem key={p.to} {...p} onClick={onClose} indent={1} />
            ))}
          </NavGroup>

          {canWrite && <NavItem {...MASTER_DATA} onClick={onClose} />}
          {role === 'admin' && <NavItem {...ADMIN_PANEL} onClick={onClose} />}
          {role === 'editor' && <NavItem {...MY_DASHBOARD} onClick={onClose} />}
        </nav>

        {/* User / logout */}
        <div className="border-t border-line p-3">
          <div className="mb-2 flex items-center gap-3 rounded-xl px-2 py-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-light text-xs font-semibold text-white">
              {initials(user?.name)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">{user?.name}</p>
              <p className="text-xs capitalize text-muted">{user?.role}</p>
            </div>
          </div>
          <button
            onClick={() => {
              onClose?.()
              logout()
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-ink/5 hover:text-ink"
          >
            <LogOut size={18} />
            Sign out
          </button>
        </div>
      </aside>
    </>
  )
}
