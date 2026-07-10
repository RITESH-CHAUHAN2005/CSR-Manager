import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type Theme = 'light' | 'dark'

interface ThemeState {
  theme: Theme
  toggle: () => void
  setTheme: (t: Theme) => void
}

const ThemeContext = createContext<ThemeState | undefined>(undefined)

const STORAGE_KEY = 'csr-theme'

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'light'
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved === 'light' || saved === 'dark') return saved
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme)

  useEffect(() => {
    const root = document.documentElement
    // Opt out of the global color transition for the flip itself, so every
    // surface (sidebar, header, page) repaints in the SAME frame instead of
    // each easing over 200ms at its own pace. Forcing a reflow commits the new
    // colors while transitions are off; re-enabling after leaves hover/focus
    // transitions intact.
    root.classList.add('no-theme-transition')
    root.classList.toggle('dark', theme === 'dark')
    localStorage.setItem(STORAGE_KEY, theme)
    void root.offsetHeight
    root.classList.remove('no-theme-transition')
  }, [theme])

  const value: ThemeState = {
    theme,
    setTheme: setThemeState,
    toggle: () => setThemeState((p) => (p === 'dark' ? 'light' : 'dark')),
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
