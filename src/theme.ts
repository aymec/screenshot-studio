import { useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'screenshot-studio:theme'

const systemTheme = (): Theme =>
  window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'

function storedTheme(): Theme | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v === 'light' || v === 'dark' ? v : null
  } catch {
    return null
  }
}

/**
 * Theme state, defaulting to the OS preference. Once the user picks a theme explicitly it
 * is remembered and the OS is no longer followed; until then, the app tracks system changes
 * live (e.g. macOS switching to dark at sunset).
 */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => storedTheme() ?? systemTheme())
  const [pinned, setPinned] = useState(() => storedTheme() !== null)

  useEffect(() => {
    if (pinned) return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => setThemeState(mq.matches ? 'dark' : 'light')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [pinned])

  // Tailwind's dark variant keys off this class (see the @custom-variant in index.css).
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    document.documentElement.style.colorScheme = theme
  }, [theme])

  const setTheme = (next: Theme) => {
    setThemeState(next)
    setPinned(true)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Private mode or storage disabled: the choice just won't survive a reload.
    }
  }

  return { theme, toggleTheme: () => setTheme(theme === 'dark' ? 'light' : 'dark') }
}
