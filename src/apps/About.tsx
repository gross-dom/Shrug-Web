import { DROPS } from '../data/drops'
import { PEOPLE } from '../data/people'
import { COMPANY_COUNT, VERTICALS } from '../data/portfolio'
import { ABOUT, reach, reachable, SITE } from '../data/site'
import { Card } from '../kit/parts/Card'
import { Window } from '../kit/window'
import { APPS } from '../os/apps'
import { dockPoint } from '../os/dom'
import { AppIcon } from '../os/icons'
import { openApp } from '../os/wm'

// About Shrug: the small window a system keeps for this. Who Shrug is, in a
// sentence and then in a few facts (when it started, who its partners are,
// which fund this is and what it backs: src/data/site.ts); what is on the
// site, each figure counted from the site's own data and each row opening
// what it counts; and the ways on: the one-pager, and a way to write to Shrug
// once there is one. The drops are counted with the rest and are not on this
// site: they are VIP's, which is the points site, so that row is a link to it.

/** A row either opens a window of the desk's (`open`) or leaves for a page in a tab of its own (`href`). */
const FACTS: ({ label: string; value: string } & ({ open: () => void } | { href: string }))[] = [
  { label: APPS.messages.name, value: `${PEOPLE.length} people`, open: () => openApp('messages', dockPoint('messages')) },
  { label: APPS.finder.name, value: `${COMPANY_COUNT} companies`, open: () => openApp('finder', dockPoint('finder')) },
  { label: 'Verticals', value: String(VERTICALS.length), open: () => openApp('finder', dockPoint('finder')) },
  { label: 'Drops', value: String(DROPS.length), href: SITE.points },
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
        <dl className="about__firm">
          {[...ABOUT.facts, { label: 'Backs', value: ABOUT.backs }].map((fact) => (
            <div key={fact.label} className="about__fact about__fact--said">
              <dt>{fact.label}</dt>
              <dd className="about__value">{fact.value}</dd>
            </div>
          ))}
        </dl>
      </Card>
      <Card className="about__facts" flush pad="small" tone="sunken">
        {FACTS.map((fact) =>
          'href' in fact ? (
            <a key={fact.label} className="about__fact" href={fact.href} target="_blank" rel="noopener noreferrer" draggable={false}>
              <span>{fact.label}</span>
              <span className="about__value">
                {fact.value}
                <span className="sr-only">, opens in a new tab</span>
              </span>
            </a>
          ) : (
            <button key={fact.label} type="button" className="about__fact" onClick={fact.open}>
              <span>{fact.label}</span>
              <span className="about__value">{fact.value}</span>
            </button>
          ),
        )}
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
    </Window>
  )
}
