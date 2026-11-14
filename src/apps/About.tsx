import { DROPS } from '../data/drops'
import { PEOPLE } from '../data/people'
import { COMPANY_COUNT, VERTICALS } from '../data/portfolio'
import { SITE } from '../data/site'
import { Card } from '../kit/parts/Card'
import { Window } from '../kit/window'
import { dockPoint } from '../os/dom'
import { AppIcon } from '../os/icons'
import { openApp } from '../os/wm'

// About Shrug: the small window a system keeps for this. Every figure is
// counted from the site's own data.

const FACTS: { label: string; value: string; open: () => void }[] = [
  { label: 'Group chat', value: `${PEOPLE.length} people`, open: () => openApp('messages', dockPoint('messages')) },
  { label: 'Portfolio', value: `${COMPANY_COUNT} companies`, open: () => openApp('finder', dockPoint('finder')) },
  { label: 'Verticals', value: String(VERTICALS.length), open: () => openApp('finder', dockPoint('finder')) },
  { label: 'Drops', value: String(DROPS.length), open: () => openApp('photos', dockPoint('photos')) },
]

export function AboutApp() {
  return (
    <Window className="app about" lightsSize="large" body={{ className: 'about__body' }}>
      <div className="about__icon">
        <AppIcon id="about" />
      </div>
      <div className="about__name">{SITE.name}</div>
      <div className="about__kind">{SITE.legalName}</div>
      <Card className="about__facts" flush pad="small" tone="sunken">
        {FACTS.map((fact) => (
          <button key={fact.label} type="button" className="about__fact" onClick={fact.open}>
            <span>{fact.label}</span>
            <span className="about__value">{fact.value}</span>
          </button>
        ))}
      </Card>
      <a className="about__link" href={SITE.onePager} target="_blank" rel="noreferrer">
        One-pager
      </a>
      <div className="about__mark" aria-hidden>
        {SITE.mark}
      </div>
    </Window>
  )
}
