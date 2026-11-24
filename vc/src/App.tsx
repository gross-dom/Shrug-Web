import { useEffect, useRef } from 'react'
import { SITE } from './content'
import { Menu } from './Menu'
import { Faq } from './pages/Faq'
import { Portfolio } from './pages/Portfolio'
import { Quotes } from './pages/Quotes'
import { Vip } from './pages/Vip'
import { Rail } from './Rail'
import { ROUTES, usePath, type Path } from './router'
import { useYear } from './year'

// The frame every page sits in. On a wide window (1280px and more) a rail down the left edge does the
// navigating, and everything else is in the space to its right. On a narrower one a slim bar stays at the
// top with the wordmark and the menu's two lines. Only one of the two is ever shown (styles.css). Then the
// page, and a foot that is a hairline and the copyright line: the wordmark and the links are in the rail
// and in the menu's panel. Quotes, VIP and FAQ sit in one column, centred in the space they have;
// Portfolio runs from edge to edge of it.

const PAGES: Record<Path, () => JSX.Element> = { '/': Quotes, '/portfolio': Portfolio, '/vip': Vip, '/faq': Faq }

function Foot({ wide }: { wide: boolean }) {
  const year = useYear()
  return (
    <footer id="foot" className={wide ? 'foot foot--wide' : 'foot'}>
      <div className="foot__in">
        <p className="foot__small">
          © {year} {SITE.legalName}
        </p>
        {/* The menu's panel needs its script. Without one, the pages are still a press away. */}
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
      <Rail />
      <Menu />
      <div className="shell">
        <main id="page" ref={page} key={path} className="page" tabIndex={-1}>
          {/* The pages have no titles to look at: the rail or the menu names the page. This one is for assistive tech. */}
          <h1 className="sr">{ROUTES.find((route) => route.path === path)!.label}</h1>
          <Page />
        </main>
        {/* Portfolio's foot is as wide as its grid; the others' is the width of their column */}
        <Foot wide={path === '/portfolio'} />
      </div>
    </>
  )
}
