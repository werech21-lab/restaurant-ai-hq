'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type Theme = 'dark' | 'light'

const STORAGE_KEY_AETHER = 'aetherbi_theme_mode'
const STORAGE_KEY_LEGACY = 'ai-hq-theme'

type ThemeContextValue = {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function applyThemeToDOM(theme: Theme) {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme
  if (theme === 'light') {
    document.documentElement.classList.add('light', 'light-mode')
    document.documentElement.classList.remove('dark')
  } else {
    document.documentElement.classList.add('dark')
    document.documentElement.classList.remove('light', 'light-mode')
  }
}

export function persistTheme(theme: Theme) {
  if (typeof window === 'undefined') return
  applyThemeToDOM(theme)
  try {
    window.localStorage.setItem(STORAGE_KEY_AETHER, theme)
    window.localStorage.setItem(STORAGE_KEY_LEGACY, theme)
    document.cookie = `${STORAGE_KEY_AETHER}=${theme}; path=/; max-age=31536000; samesite=lax`
    document.cookie = `${STORAGE_KEY_LEGACY}=${theme}; path=/; max-age=31536000; samesite=lax`
  } catch (err) {
    console.error('Failed to persist theme:', err)
  }
}

export function ThemeProvider({ initialTheme = 'dark', children }: { initialTheme?: Theme; children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(initialTheme)

  useEffect(() => {
    try {
      const stored =
        (window.localStorage.getItem(STORAGE_KEY_AETHER) as Theme | null) ||
        (window.localStorage.getItem(STORAGE_KEY_LEGACY) as Theme | null)
      if (stored === 'light' || stored === 'dark') {
        if (stored !== theme) {
          setThemeState(stored)
        }
        applyThemeToDOM(stored)
      } else {
        applyThemeToDOM(initialTheme)
      }
    } catch {
      applyThemeToDOM(initialTheme)
    }
  }, [initialTheme])

  function setTheme(next: Theme) {
    setThemeState(next)
    persistTheme(next)
  }

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
  }

  return <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const value = useContext(ThemeContext)
  if (!value) throw new Error('useTheme must be used within ThemeProvider')
  return value
}
