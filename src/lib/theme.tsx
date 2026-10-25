'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'

export type Theme = 'dark' | 'light'

const storageKey = 'ai-hq-theme'

type ThemeContextValue = {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function persistTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
  document.cookie = `${storageKey}=${theme}; path=/; max-age=31536000; samesite=lax`
  window.localStorage.setItem(storageKey, theme)
}

export function ThemeProvider({ initialTheme, children }: { initialTheme: Theme; children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(initialTheme)

  function setTheme(next: Theme) {
    setThemeState(next)
    persistTheme(next)
  }

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const value = useContext(ThemeContext)
  if (!value) throw new Error('useTheme must be used within ThemeProvider')
  return value
}
