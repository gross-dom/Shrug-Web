import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { Arrow, Wordmark } from './Brand'
import { CASE_STUDIES_PAGE, CASE_STUDIES_PDF, HAS_CASE_STUDIES_PDF, LINKS } from './content'
import { PageLink, ROUTES, usePath } from './router'
import { useTheme } from './theme'

// The way round the site. One bar stays at the top of the window at every width: the wordmark on the left
// and, on the right, the four pages by name and two lines. Under 900px there is no room for the names and
// the two lines are the only way round. The two lines open a panel from the right, over the page, at any
// width. The panel holds the case studies and the cross that shuts it, the choice of light or dark, the
// four pages, and at its foot the wordmark and two small links (X and Instagram).

/** What can take the keyboard inside the panel. */
const STOPS = 'a[href], button:not([disabled])'

export function Menu() {
  const path = usePath()
  const [open, setOpen] = useState(false)
  const [theme, choose] = useTheme()
  const burger = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  /** Whether the panel has just been shut by its visitor, and the keyboard is owed back to the two lines. */
  const owed = useRef(false)

  const shut = useCallback(() => {
    owed.current = true
    setOpen(false)
  }, [])

  // Shut, the panel is off the page for everyone: nothing in it can be reached while it slides away
  useEffect(() => {
    if (panel.current) panel.current.inert = !open
  }, [open])

  // Open, the panel is a dialog: the keyboard goes into it and stays there, Escape shuts it, and the page
  // behind neither scrolls nor can be reached
  useEffect(() => {
    if (!open) return
    const behind = ['bar', 'page', 'foot'].map((id) => document.getElementById(id)).filter((part): part is HTMLElement => !!part)
    for (const part of behind) part.inert = true
    const html = document.documentElement
    // The scrollbar goes with the scrolling: the page is given its width back, so that it does not jump sideways
    const bar = window.innerWidth - html.clientWidth
    html.style.overflow = 'hidden'
    if (bar > 0) document.body.style.paddingRight = `${bar}px`
    panel.current?.querySelector<HTMLElement>(STOPS)?.focus()

    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        shut()
      } else if (e.key === 'Tab' && panel.current) {
        // Round and round what the panel holds, the cross among it
        const stops = [...panel.current.querySelectorAll<HTMLElement>(STOPS)]
        const at = stops.indexOf(document.activeElement as HTMLElement)
        const next = e.shiftKey ? (at <= 0 ? stops.length - 1 : at - 1) : at === stops.length - 1 ? 0 : at + 1
        e.preventDefault()
        stops[next]?.focus()
      }
    }
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('keydown', key)
      for (const part of behind) part.inert = false
      html.style.overflow = ''
      document.body.style.paddingRight = ''
    }
  }, [open, shut])

  // Shut by its visitor, the keyboard goes back to the two lines that opened it. This comes after the page
  // behind has been made reachable again (above), or the bar would still be refusing the keyboard.
  useEffect(() => {
    if (open || !owed.current) return
    owed.current = false
    burger.current?.focus()
  }, [open])

  return (
    <>
      <header id="bar" className="bar">
        <div className="bar__in">
          <div className="bar__row">
            <PageLink to="/" className="bar__mark rise">
              <Wordmark width={198.4} height={16} />
            </PageLink>
            <div className="bar__right rise" style={{ '--i': 1 } as CSSProperties}>
              <nav className="bar__pages" aria-label="Pages">
                {ROUTES.map((route) => (
                  <PageLink key={route.path} to={route.path} className="bar__page mono" aria-current={route.path === path ? 'page' : undefined}>
                    {route.label}
                  </PageLink>
                ))}
              </nav>
              <button ref={burger} type="button" className="burger" aria-label="Menu" aria-expanded={open} aria-controls="menu" onClick={() => setOpen(true)}>
                <span />
                <span />
              </button>
            </div>
          </div>
          <span className="rule draw" aria-hidden />
        </div>
      </header>
      <div className="menu" data-open={open || undefined}>
        {/* A press anywhere on the dimmed page shuts the panel. The keyboard has Escape and the cross. */}
        <div className="menu__dim" aria-hidden onClick={shut} />
        <div ref={panel} className="menu__panel" id="menu" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="menu__in">
            <div className="menu__head">
              <div className="menu__top">
                <a className="menu__util" href={HAS_CASE_STUDIES_PDF ? CASE_STUDIES_PDF : CASE_STUDIES_PAGE} download={HAS_CASE_STUDIES_PDF || undefined}>
                  Case studies <span className="menu__quiet">PDF</span>
                  <Arrow />
                </a>
                <button type="button" className="menu__close" aria-label="Close menu" onClick={shut}>
                  <span />
                  <span />
                </button>
              </div>
              <div className="menu__theme" role="group" aria-label="Theme">
                <button type="button" className="menu__mode menu__mode--light" aria-pressed={theme === 'light'} onClick={() => choose('light')}>
                  Light
                </button>
                <span className="menu__quiet" aria-hidden>
                  /
                </span>
                <button type="button" className="menu__mode menu__mode--dark" aria-pressed={theme === 'dark'} onClick={() => choose('dark')}>
                  Dark
                </button>
              </div>
            </div>
            <nav className="menu__pages" aria-label="Menu pages">
              {ROUTES.map((route) => (
                <PageLink key={route.path} to={route.path} className="menu__page" aria-current={route.path === path ? 'page' : undefined} onGo={shut}>
                  {route.path === path && <Arrow size={22} className="arrow--here" />}
                  <span>{route.label}</span>
                </PageLink>
              ))}
            </nav>
            <div className="menu__foot">
              <PageLink to="/" className="menu__mark" onGo={shut}>
                <Wordmark />
              </PageLink>
              <div className="menu__links">
                {LINKS.map((link) => (
                  <a key={link.label} className="menu__link" href={link.href}>
                    {link.label}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
