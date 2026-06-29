import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import { Bell, Menu, Moon, Sun } from './icons'
import { useTheme } from '../context/ThemeContext'
import { useAuth } from '../context/AuthContext'

function initials(name?: string) {
  if (!name) return 'U'
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export default function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const { theme, toggle } = useTheme()
  const { user } = useAuth()

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar mobileOpen={menuOpen} onClose={() => setMenuOpen(false)} />

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Global header */}
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-line bg-surface/70 px-4 py-3 backdrop-blur-xl sm:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMenuOpen(true)}
              className="rounded-xl p-2 text-muted transition-colors hover:bg-ink/5 hover:text-ink lg:hidden"
              aria-label="Open menu"
            >
              <Menu size={22} />
            </button>
            <div className="flex items-center gap-2 lg:hidden">
              <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg bg-white ring-1 ring-line">
                <img src="/logo.png" alt="CSR Fund Manager" className="h-full w-full object-contain" />
              </div>
              <span className="text-sm font-semibold text-ink">CSR Fund Manager</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              className="relative rounded-xl p-2 text-muted transition-colors hover:bg-ink/5 hover:text-ink"
              aria-label="Notifications"
              title="Notifications"
            >
              <Bell size={19} />
              <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-primary" />
            </button>

            <button
              onClick={toggle}
              className="rounded-xl p-2 text-muted transition-colors hover:bg-ink/5 hover:text-ink"
              aria-label="Toggle theme"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
            </button>

            <div className="ml-1 flex items-center gap-2.5 rounded-xl border border-line bg-surface/60 py-1 pl-1 pr-3 shadow-sm">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary-light text-xs font-semibold text-white">
                {initials(user?.name)}
              </div>
              <div className="hidden leading-tight sm:block">
                <p className="max-w-[140px] truncate text-sm font-medium text-ink">{user?.name}</p>
                <p className="text-xs capitalize text-muted">{user?.role}</p>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            <div className="animate-fade-in">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
