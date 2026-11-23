import { useEffect, useRef } from 'react'
import { Wordmark } from './Brand'
import { LINE, SITE } from './content'
import { Menu } from './Menu'
import { Faq } from './pages/Faq'
import { Portfolio } from './pages/Portfolio'
import { Quotes } from './pages/Quotes'
import { Vip } from './pages/Vip'
import { PageLink, ROUTES, usePath, type Path } from './router'
import { useYear } from './year'

// The frame every page sits in. There is no bar and no logo at the top: one line of text top left, which
// scrolls away with the page, and the menu's two lines top right, which stay. Then the page, and a foot
// that holds the wordmark and the copyright line and nothing else (the links are in the menu).

const PAGES: Record<Path, () => JSX.Element> = { '/': Quotes, '/portfolio': Portfolio, '/vip': Vip, '/faq': Faq }

function Foot() {
  const year = useYear()
  return (
    <footer id="foot" className="foot">
      <div className="foot__in">
        <PageLink to="/" className="foot__mark">
          <Wordmark width={161.2} height={13} />
        </PageLink>
        <p className="foot__small">
          © {year} {SITE.legalName}
        </p>
        {/* The menu needs its script. Without one, the pages are still a press away. */}
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
  return (
    <>
      <header className="top">
        <p className="top__line">{LINE}</p>
        <Menu />
      </header>
      <main id="page" ref={page} key={path} className="page" tabIndex={-1}>
        {/* The pages have no titles to look at: the menu names the page. This one is for assistive tech. */}
        <h1 className="sr">{ROUTES.find((route) => route.path === path)!.label}</h1>
        <Page />
      </main>
      <Foot />
    </>
  )
}
