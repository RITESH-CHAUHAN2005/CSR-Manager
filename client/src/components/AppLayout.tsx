import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import { Menu, Moon, Sun } from './icons'
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

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={toggle}
              role="switch"
              aria-checked={theme === 'dark'}
              aria-label="Toggle theme"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              className="relative inline-flex h-7 w-14 items-center rounded-full border border-line bg-gradient-to-r from-amber-200 to-sky-200 px-0.5 shadow-inner transition-colors duration-300 dark:from-indigo-900 dark:to-slate-800"
            >
              <span className="relative z-10 flex h-6 w-6 translate-x-0 items-center justify-center rounded-full bg-white text-amber-500 shadow-md transition-all duration-300 ease-out dark:translate-x-[1.75rem] dark:bg-slate-900 dark:text-slate-100">
                <Sun
                  size={14}
                  weight="fill"
                  className="absolute rotate-0 scale-100 opacity-100 transition-all duration-300 dark:rotate-90 dark:scale-0 dark:opacity-0"
                />
                <Moon
                  size={14}
                  weight="fill"
                  className="absolute -rotate-90 scale-0 opacity-0 transition-all duration-300 dark:rotate-0 dark:scale-100 dark:opacity-100"
                />
              </span>
            </button>

            <div
              className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-light text-xs font-semibold text-white shadow-sm ring-1 ring-line"
              title={user?.name}
            >
              {initials(user?.name)}
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
