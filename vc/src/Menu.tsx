import { useCallback, useEffect, useRef, useState } from 'react'
import { Arrow, Wordmark } from './Brand'
import { CASE_STUDIES_PAGE, CASE_STUDIES_PDF, HAS_CASE_STUDIES_PDF, LINKS } from './content'
import { PageLink, ROUTES, usePath } from './router'
import { useTheme } from './theme'
import { useYear } from './year'

// The way round the site. There is no bar across the top: two lines in the top right corner open a panel
// from the right, over the page, and the same two lines (crossed) shut it. The panel holds the case studies,
// the choice of light or dark, the four pages, and at its foot the wordmark and the small links.

/** What can take the keyboard inside the panel. */
const STOPS = 'a[href], button:not([disabled])'

export function Menu() {
  const path = usePath()
  const [open, setOpen] = useState(false)
  const [theme, choose] = useTheme()
  const year = useYear()
  const burger = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)

  /** Shut, with the keyboard handed back to the two lines that opened it. */
  const shut = useCallback(() => {
    setOpen(false)
    burger.current?.focus()
  }, [])

  // Shut, the panel is off the page for everyone: nothing in it can be reached while it slides away
  useEffect(() => {
    if (panel.current) panel.current.inert = !open
  }, [open])

  // Open, the panel is a dialog: the keyboard goes into it and stays there, Escape shuts it, and the page
  // behind neither scrolls nor can be reached
  useEffect(() => {
    if (!open) return
    const behind = [document.getElementById('page'), document.getElementById('foot')].filter((part): part is HTMLElement => !!part)
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
      } else if (e.key === 'Tab' && burger.current && panel.current) {
        // Round and round: the two lines, then what the panel holds, then the two lines again
        const stops = [burger.current, ...panel.current.querySelectorAll<HTMLElement>(STOPS)]
        const at = stops.indexOf(document.activeElement as HTMLElement)
        const next = e.shiftKey ? (at <= 0 ? stops.length - 1 : at - 1) : at === stops.length - 1 ? 0 : at + 1
        e.preventDefault()
        stops[next]!.focus()
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

  return (
    <div className="menu" data-open={open || undefined}>
      {/* Under the two lines, two more of the same shape that are not seen themselves: they push whatever is
          behind them to black or to white, so that the lines above, blended with it, never fade into a mid-grey photograph */}
      <span className="burger-under" aria-hidden>
        <span />
        <span />
      </span>
      <button ref={burger} type="button" className="burger" aria-label={open ? 'Close menu' : 'Menu'} aria-expanded={open} aria-controls="menu" onClick={() => (open ? shut() : setOpen(true))}>
        <span />
        <span />
      </button>
      {/* A press anywhere on the dimmed page shuts the panel. The keyboard has Escape and the two lines. */}
      <div className="menu__dim" aria-hidden onClick={shut} />
      <div ref={panel} className="menu__panel" id="menu" role="dialog" aria-label="Menu">
        <div className="menu__in">
          <div className="menu__top">
            <a className="menu__util" href={HAS_CASE_STUDIES_PDF ? CASE_STUDIES_PDF : CASE_STUDIES_PAGE} download={HAS_CASE_STUDIES_PDF || undefined}>
              Case studies <span className="menu__quiet">PDF</span>
              <Arrow />
            </a>
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
          <nav className="menu__pages" aria-label="Pages">
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
            <div className="menu__small">
              <div className="menu__links">
                {LINKS.map((link) => (
                  <a key={link.label} className="menu__link" href={link.href}>
                    {link.label}
                  </a>
                ))}
              </div>
              <p className="menu__year">© {year}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
