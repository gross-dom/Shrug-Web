import { useEffect, useState } from 'react'
import { Arrow, Wordmark } from './Brand'
import { CASE_STUDIES_PDF, HAS_CASE_STUDIES_PDF, SITE, SOCIAL } from './content'
import { Faq } from './pages/Faq'
import { Portfolio } from './pages/Portfolio'
import { Quotes } from './pages/Quotes'
import { Vip } from './pages/Vip'
import { PageLink, ROUTES, usePath, type Path } from './router'

// The frame every page sits in: the bar across the top (the wordmark, the pages, the case studies and the
// one-pager), the page itself, and the foot.

const PAGES: Record<Path, () => JSX.Element> = { '/': Quotes, '/portfolio': Portfolio, '/vip': Vip, '/faq': Faq }

/** The case studies are one PDF. Until Shrug has supplied it, the link says so and goes nowhere. */
export function CaseStudiesLink({ className, children }: { className?: string; children?: React.ReactNode }) {
  if (!HAS_CASE_STUDIES_PDF)
    return (
      <span className={className} aria-disabled="true" title="The PDF is on its way">
        {children ?? 'Case Studies'}
        <span className="soon">PDF soon</span>
      </span>
    )
  return (
    <a className={className} href={CASE_STUDIES_PDF} download>
      {children ?? 'Case Studies'}
      <span className="soon">PDF</span>
    </a>
  )
}

function Nav() {
  const path = usePath()
  const [open, setOpen] = useState(false)
  const [lifted, setLifted] = useState(false)
  // The bar is flat on the page at its top, and takes a ground of its own once the page has moved under it
  useEffect(() => {
    const read = () => setLifted(window.scrollY > 8)
    read()
    window.addEventListener('scroll', read, { passive: true })
    return () => window.removeEventListener('scroll', read)
  }, [])
  useEffect(() => setOpen(false), [path])
  return (
    <header className="nav" data-lifted={lifted || undefined} data-open={open || undefined}>
      <div className="nav__in">
        <PageLink to="/" className="nav__mark" onGo={() => setOpen(false)}>
          <Wordmark className="nav__full" />
          <Wordmark short className="nav__short" />
        </PageLink>
        <button type="button" className="nav__menu" aria-expanded={open} aria-controls="nav-links" onClick={() => setOpen((o) => !o)}>
          <span className="sr">{open ? 'Close the menu' : 'Menu'}</span>
          <i aria-hidden />
          <i aria-hidden />
        </button>
        <nav id="nav-links" className="nav__links" aria-label="Pages">
          {ROUTES.map((route) => (
            <PageLink key={route.path} to={route.path} className="nav__link" aria-current={route.path === path ? 'page' : undefined}>
              {route.label}
            </PageLink>
          ))}
          <CaseStudiesLink className="nav__link nav__link--file" />
          <a className="nav__cta" href={SITE.onePager} target="_blank" rel="noreferrer">
            One-pager
            <Arrow className="arrow arrow--out" />
            <span className="sr">, opens in a new tab</span>
          </a>
        </nav>
      </div>
    </header>
  )
}

function Foot() {
  const [shrugged, setShrugged] = useState(0)
  return (
    <footer className="foot">
      <div className="foot__in">
        <div className="foot__top">
          <Wordmark className="foot__mark" />
          <button type="button" className="foot__shrug" key={shrugged} data-again={shrugged ? '' : undefined} onClick={() => setShrugged((n) => n + 1)} aria-label="Shrug">
            <span aria-hidden>¯\_(ツ)_/¯</span>
          </button>
        </div>
        <div className="foot__rows">
          <nav className="foot__col" aria-label="Pages, again">
            {ROUTES.map((route) => (
              <PageLink key={route.path} to={route.path} className="foot__link">
                {route.label}
              </PageLink>
            ))}
            <CaseStudiesLink className="foot__link" />
          </nav>
          <div className="foot__col">
            <a className="foot__link" href={SITE.onePager} target="_blank" rel="noreferrer">
              One-pager
              <span className="sr">, opens in a new tab</span>
            </a>
            {SOCIAL.map((link) => (
              <a key={link.label} className="foot__link" href={link.href} target="_blank" rel="noreferrer">
                {link.label}
                <span className="sr">, opens in a new tab</span>
              </a>
            ))}
          </div>
          <p className="foot__small">
            © {new Date().getFullYear()} {SITE.legalName}
          </p>
        </div>
      </div>
    </footer>
  )
}

export function App() {
  const path = usePath()
  const Page = PAGES[path]
  return (
    <>
      <a className="skip" href="#page">
        Skip to the page
      </a>
      <Nav />
      <main id="page" key={path} className="page" tabIndex={-1}>
        <Page />
      </main>
      <Foot />
    </>
  )
}
