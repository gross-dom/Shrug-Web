import { Arrow, Wordmark } from './Brand'
import { CASE_STUDIES_PAGE, CASE_STUDIES_PDF, HAS_CASE_STUDIES_PDF, LINKS } from './content'
import { PageLink, ROUTES, usePath } from './router'
import { useTheme } from './theme'

// The way round the site on a wide window (1280px and more): a rail down the left edge that stays put while
// the page scrolls beside it. The wordmark at its head, the four pages in its middle, and at its foot the
// case studies, the choice of light or dark, and the two small links. It is the page's own colours, not
// their inverse. On a narrower window it is not there at all, and the bar and its panel (Menu.tsx) are.

export function Rail() {
  const path = usePath()
  const [theme, choose] = useTheme()
  return (
    <aside className="rail" aria-label="Site">
      <div className="rail__in">
        <PageLink to="/" className="rail__mark">
          <Wordmark width={198.4} height={16} />
        </PageLink>
        <nav className="rail__pages" aria-label="Pages">
          {ROUTES.map((route) => (
            <PageLink key={route.path} to={route.path} className="rail__page" aria-current={route.path === path ? 'page' : undefined}>
              {route.path === path && <Arrow size={14} className="arrow--here" />}
              <span>{route.label}</span>
            </PageLink>
          ))}
        </nav>
        <div className="rail__foot">
          <a className="rail__util" href={HAS_CASE_STUDIES_PDF ? CASE_STUDIES_PDF : CASE_STUDIES_PAGE} download={HAS_CASE_STUDIES_PDF || undefined}>
            Case studies <span className="rail__quiet">PDF</span>
            <Arrow size={10} />
          </a>
          <div className="rail__theme" role="group" aria-label="Theme">
            <button type="button" className="rail__mode rail__mode--light" aria-pressed={theme === 'light'} onClick={() => choose('light')}>
              Light
            </button>
            <span className="rail__quiet" aria-hidden>
              /
            </span>
            <button type="button" className="rail__mode rail__mode--dark" aria-pressed={theme === 'dark'} onClick={() => choose('dark')}>
              Dark
            </button>
          </div>
          <div className="rail__links">
            {LINKS.map((link) => (
              <a key={link.label} className="rail__link" href={link.href}>
                {link.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </aside>
  )
}
