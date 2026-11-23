import { useCallback, useEffect, useState } from 'react'

// Light or dark. A visitor who has not chosen is given what their system is set to; one who has is given
// their choice on every page from then on. The class that carries it (th-light or th-dark, on <html>) is
// put there before the first paint by the short script in the head of vc/index.html, which settles it the
// same way as here: the two must be kept in step. Nothing in the page as written depends on the theme, so
// the page as it starts up never disagrees with it.

export type Theme = 'light' | 'dark'

/** Where the choice is kept. */
const KEY = 'shrug-theme'

/** What the browser paints its own bars in, to go with the page. */
const GROUND: Record<Theme, string> = { light: '#FFFFFF', dark: '#000000' }

const system = (): Theme => (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')

/** The choice that has been kept, if there is one. Storage can be turned off, or refuse: then there is none. */
function kept(): Theme | null {
  try {
    const theme = localStorage.getItem(KEY)
    return theme === 'light' || theme === 'dark' ? theme : null
  } catch {
    return null
  }
}

function show(theme: Theme) {
  const root = document.documentElement.classList
  root.toggle('th-dark', theme === 'dark')
  root.toggle('th-light', theme === 'light')
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', GROUND[theme])
}

/** The theme the page is in, and the way to choose one. It is null until the page has started up: only
 * then is it known which of the two the script in the head settled on. */
export function useTheme(): [Theme | null, (theme: Theme) => void] {
  const [theme, setTheme] = useState<Theme | null>(null)
  useEffect(() => {
    setTheme(document.documentElement.classList.contains('th-dark') ? 'dark' : 'light')
    // Someone who has not chosen follows their system, also when it changes while the page is open
    const query = window.matchMedia?.('(prefers-color-scheme: dark)')
    const follow = () => {
      if (kept()) return
      show(system())
      setTheme(system())
    }
    query?.addEventListener('change', follow)
    return () => query?.removeEventListener('change', follow)
  }, [])
  const choose = useCallback((next: Theme) => {
    show(next)
    setTheme(next)
    try {
      localStorage.setItem(KEY, next)
    } catch {
      // Not kept: the choice still holds for this page
    }
  }, [])
  return [theme, choose]
}
