import { create } from 'zustand'

export type Theme = 'dark' | 'light'

const STORAGE_KEY = 'trade-dashboard-theme'

function getInitialTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'dark' || stored === 'light') return stored
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme)
  localStorage.setItem(STORAGE_KEY, theme)
}

interface ThemeStore {
  theme: Theme
  toggle: () => void
  setTheme: (t: Theme) => void
}

export const useThemeStore = create<ThemeStore>((set, get) => {
  const initial = getInitialTheme()
  applyTheme(initial)
  return {
    theme: initial,
    toggle: () => {
      const next: Theme = get().theme === 'dark' ? 'light' : 'dark'
      applyTheme(next)
      set({ theme: next })
    },
    setTheme: (t) => {
      applyTheme(t)
      set({ theme: t })
    },
  }
})
