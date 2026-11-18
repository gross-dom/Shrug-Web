import { DROPS } from '../data/drops'
import { PEOPLE } from '../data/people'
import { COMPANY_COUNT, VERTICALS } from '../data/portfolio'
import { reach, reachable, SITE } from '../data/site'
import { Card } from '../kit/parts/Card'
import { Window } from '../kit/window'
import { APPS } from '../os/apps'
import { dockPoint } from '../os/dom'
import { AppIcon } from '../os/icons'
import { openApp } from '../os/wm'

// About Shrug: the small window a system keeps for this. Who Shrug is, in a
// sentence; what is on the site, each figure counted from the site's own data
// and each row opening what it counts; and the ways on: the one-pager, and a
// way to write to Shrug once there is one (src/data/site.ts).

const FACTS: { label: string; value: string; open: () => void }[] = [
  { label: APPS.messages.name, value: `${PEOPLE.length} people`, open: () => openApp('messages', dockPoint('messages')) },
  { label: APPS.finder.name, value: `${COMPANY_COUNT} companies`, open: () => openApp('finder', dockPoint('finder')) },
  { label: 'Verticals', value: String(VERTICALS.length), open: () => openApp('finder', dockPoint('finder')) },
  { label: 'Drops', value: String(DROPS.length), open: () => openApp('photos', dockPoint('photos')) },
]

export function AboutApp() {
  const way = reachable() ? reach() : null
  return (
    <Window className="app about" lightsSize="large" body={{ className: 'about__body' }}>
      <div className="about__icon">
        <AppIcon id="about" />
      </div>
      <div className="about__name">{SITE.name}</div>
      {/* Set with hyphens that hold their word together: "early-stage" is not broken across the two lines */}
      <p className="about__kind">{SITE.line.replace(/-/g, '\u2011')}</p>
      <Card className="about__facts" flush pad="small" tone="sunken">
        {FACTS.map((fact) => (
          <button key={fact.label} type="button" className="about__fact" onClick={fact.open}>
            <span>{fact.label}</span>
            <span className="about__value">{fact.value}</span>
          </button>
        ))}
      </Card>
      <div className="about__links">
        {way && (
          <a className="about__link" href={way.href}>
            {way.label}
          </a>
        )}
        <a className="about__link" data-quiet={way ? '' : undefined} href={SITE.onePager} target="_blank" rel="noreferrer">
          One-pager<span className="sr-only">, opens in a new tab</span>
        </a>
      </div>
      <div className="about__mark" aria-hidden>
        {SITE.mark}
      </div>
    </Window>
  )
}
