import { useEffect, useRef } from 'react'
import { LINKS, SITE } from './content'
import { Menu } from './Menu'
import { Faq } from './pages/Faq'
import { Portfolio } from './pages/Portfolio'
import { Quotes } from './pages/Quotes'
import { Vip } from './pages/Vip'
import { ROUTES, usePath, type Path } from './router'
import { useYear } from './year'

// The frame every page sits in. One bar across the top at every width (Menu.tsx): the wordmark, the four
// pages by name on a window wide enough for them, and the two lines that open the panel. Then the page,
// and a foot that is a hairline, the copyright line and the two small links. Quotes, VIP and FAQ sit in
// one container, up to 1760px wide and centred; Portfolio's grid runs from edge to edge of the window.
//
// What is on a page comes in as it is first seen: hairlines draw from their left end and words rise into
// place (styles.css, "Coming in"). The short script at the foot of vc/index.html says when each thing is
// in view, so that it works on the page as written, before this has started; a page come to from another
// is handed to the same script from here.

declare global {
  interface Window {
    /** Looks for what has not yet come in and brings each thing in as it is seen (vc/index.html). */
    __shrugIn?: () => void
  }
}

const PAGES: Record<Path, () => JSX.Element> = { '/': Quotes, '/portfolio': Portfolio, '/vip': Vip, '/faq': Faq }

function Foot() {
  const year = useYear()
  return (
    <footer id="foot" className="foot">
      <span className="rule draw" aria-hidden />
      <div className="foot__in">
        <p className="foot__small mono">
          © {year} {SITE.legalName}
        </p>
        <div className="foot__links">
          {LINKS.map((link) => (
            <a key={link.label} className="foot__link mono" href={link.href}>
              {link.label}
            </a>
          ))}
        </div>
        {/* Under 900px the pages are named only in the menu's panel, which needs its script. Without one, they are still a press away. */}
        <noscript>
          <nav className="foot__plain" aria-label="Pages">
            {ROUTES.map((route) => (
              <a key={route.path} href={route.path}>
                {route.label}
              </a>
            ))}
          </nav>
        </noscript>
      </div>
    </footer>
  )
}

export function App() {
  const path = usePath()
  const Page = PAGES[path]
  const page = useRef<HTMLElement>(null)
  const arrived = useRef(path)
  // A page come to from another is read from its top: the keyboard, and a screen reader with it, starts there
  useEffect(() => {
    if (arrived.current === path) return
    arrived.current = path
    page.current?.focus({ preventScroll: true })
  }, [path])
  // What the new page holds comes in as the first page's did
  useEffect(() => {
    window.__shrugIn?.()
  }, [path])
  return (
    <>
      <Menu />
      <div className="shell">
        <main id="page" ref={page} key={path} className="page" tabIndex={-1}>
          {/* The pages have no titles to look at: the bar names the page. This one is for assistive tech. FAQ has a heading of its own to be seen. */}
          {path !== '/faq' && <h1 className="sr">{ROUTES.find((route) => route.path === path)!.label}</h1>}
          <Page />
        </main>
        <Foot />
      </div>
    </>
  )
}
