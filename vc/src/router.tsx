import { createContext, useCallback, useContext, useEffect, useState, type MouseEvent, type ReactNode } from 'react'

// The site's pages and how a visitor moves between them. Each page is a real address with its own HTML
// (vc/prerender.mjs writes one file for each), so a link shared, a reload or a search engine finds the
// page itself. Once the site is running, a link to another of its pages swaps the page in place.

export const ROUTES = [
  { path: '/', label: 'Quotes', title: 'Shrug Capital', description: 'Shrug Capital is an early-stage venture fund. What founders, investors and partners say about working with Shrug.' },
  { path: '/portfolio', label: 'Portfolio', title: 'Portfolio · Shrug Capital', description: 'The companies Shrug Capital has backed.' },
  { path: '/vip', label: 'VIP', title: 'VIP · Shrug Capital', description: 'Shrug VIP: what people posted and filmed when a Shrug gift arrived.' },
  { path: '/faq', label: 'FAQ', title: 'FAQ · Shrug Capital', description: 'Questions about Shrug Capital and Shrug V, answered.' },
] as const

export type Path = (typeof ROUTES)[number]['path']

/** The page an address names: its path without a trailing slash, or the home page for anything else. */
export const pathOf = (pathname: string): Path => {
  const clean = pathname.replace(/\/+$/, '') || '/'
  return (ROUTES.find((route) => route.path === clean)?.path ?? '/') as Path
}

const Where = createContext<{ path: Path; go: (to: Path, hash?: string) => void }>({ path: '/', go: () => {} })

export function Router({ start, children }: { start: Path; children: ReactNode }) {
  const [path, setPath] = useState<Path>(start)
  useEffect(() => {
    const back = () => setPath(pathOf(window.location.pathname))
    window.addEventListener('popstate', back)
    return () => window.removeEventListener('popstate', back)
  }, [])
  // The tab says which page it is on
  useEffect(() => {
    document.title = ROUTES.find((route) => route.path === path)!.title
  }, [path])
  const go = useCallback((to: Path, hash = '') => {
    if (to !== pathOf(window.location.pathname)) {
      window.history.pushState(null, '', to + hash)
      setPath(to)
      // A new page is read from its top, unless the link names a place on it
      if (!hash) window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
    }
    if (hash) requestAnimationFrame(() => document.querySelector(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }, [])
  return <Where.Provider value={{ path, go }}>{children}</Where.Provider>
}

export const usePath = () => useContext(Where).path

/** A link to one of the site's own pages. With a modifier key, or a middle click, it is the browser's to open. */
export function PageLink({ to, hash, className, children, onGo, ...rest }: { to: Path; hash?: string; className?: string; children: ReactNode; onGo?: () => void; 'aria-current'?: 'page' }) {
  const { go } = useContext(Where)
  const click = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    e.preventDefault()
    go(to, hash)
    onGo?.()
  }
  return (
    <a {...rest} className={className} href={to + (hash ?? '')} onClick={click}>
      {children}
    </a>
  )
}
