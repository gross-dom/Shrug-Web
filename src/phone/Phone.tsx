import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { chat, QUESTION, TOTAL } from '../apps/chat'
import { PersonAvatar } from '../apps/chat-ui'
import { ALL, CompanyLogo } from '../apps/portfolio-ui'
import { useUnseen } from '../apps/state'
import { CASE_STUDIES } from '../data/caseStudies'
import { DROPS } from '../data/drops'
import { FAQS } from '../data/faqs'
import { PEOPLE } from '../data/people'
import { COMPANY_COUNT } from '../data/portfolio'
import { SITE } from '../data/site'
import { Count } from '../kit/motion/Count'
import { AppIcon } from '../os/icons'
import { useStore } from '../os/store'
import { AppScreen, SheetScreen } from './apps'
import { goHome, openApp, phone, PHONE_APPS, type PhoneApp } from './nav'
import { ViewContext } from './ui'

// The site on a phone. A dashboard of what's here, a Dock that is always at
// the foot of the screen, and one app at a time between them. The Dock is the
// way around: every app is one tap away from every other, and Home closes
// whichever is open. It is drawn edge to edge and leaves the status bar and
// the home indicator to the real phone.

/** What each app is called under its icon: short enough for six across. */
const LABEL: Record<PhoneApp, string> = { messages: 'Chat', finder: 'Portfolio', notes: 'FAQs', terminal: 'Cases', photos: 'VIP' }

// ---- The Dock ----

function Dock() {
  const app = useStore(phone, (s) => s.app)
  const unseen = useUnseen()
  return (
    <nav className="ph-dock" aria-label="Apps">
      <button type="button" className="ph-dock__item" aria-label="Home" aria-current={app ? undefined : 'page'} onClick={goHome}>
        <span className="ph-dock__icon">
          <AppIcon id="about" />
        </span>
        <span className="ph-dock__name">Home</span>
      </button>
      <span className="ph-dock__rule" aria-hidden />
      {PHONE_APPS.map((id) => {
        const badge = id === 'messages' && app !== 'messages' ? unseen : 0
        return (
          <button
            key={id}
            type="button"
            className="ph-dock__item"
            data-dock-app={id}
            aria-label={`${LABEL[id]}${badge ? `, ${badge} new` : ''}`}
            aria-current={app === id ? 'page' : undefined}
            onClick={() => {
              // Its own icon again takes an app back to its top, as a tab bar does
              if (app === id) document.querySelector(`.ph-app[data-app="${id}"] [data-scroller]`)?.scrollTo({ top: 0, behavior: 'smooth' })
              else openApp(id)
            }}
          >
            <span className="ph-dock__icon">
              <AppIcon id={id} />
              {badge > 0 && (
                <span className="ph-dock__badge" aria-hidden>
                  {badge}
                </span>
              )}
            </span>
            <span className="ph-dock__name">{LABEL[id]}</span>
          </button>
        )
      })}
    </nav>
  )
}

// ---- The dashboard ----

/** The group chat, as it stands: how many have replied, and the newest of them. */
function ChatCard() {
  const replied = useStore(chat, (s) => s.replied)
  const latest = replied > 0 ? PEOPLE[replied - 1]! : null
  return (
    <button type="button" className="ph-card ph-card--chat" aria-label={`Group chat: ${replied} of ${TOTAL} have replied. Open it.`} onClick={() => openApp('messages')}>
      <span className="ph-card__head">
        <span className="ph-card__icon">
          <AppIcon id="messages" />
        </span>
        <span className="ph-card__app">Group chat</span>
        <span className="ph-card__count">
          <Count value={replied} /> of {TOTAL} replied
        </span>
      </span>
      <span className="ph-card__ask">{QUESTION[1]}</span>
      {latest ? (
        <span className="ph-card__reply" key={replied}>
          <PersonAvatar index={replied - 1} size={30} />
          <span className="ph-card__text">
            <b>{latest.name}</b>
            <span>{latest.quote ?? latest.role}</span>
          </span>
        </span>
      ) : (
        <span className="ph-card__reply ph-card__reply--waiting">Waiting on {TOTAL} people…</span>
      )}
    </button>
  )
}

/** One app, as a figure: what it is, how much of it there is. */
function Tile({ app, name, value, unit, aside }: { app: PhoneApp; name: string; value: number; unit: string; aside?: ReactNode }) {
  return (
    <button type="button" className="ph-card ph-card--tile" aria-label={`${name}: ${value} ${unit}. Open it.`} onClick={() => openApp(app)}>
      <span className="ph-card__head">
        <span className="ph-card__icon">
          <AppIcon id={app} />
        </span>
        <span className="ph-card__app">{name}</span>
        {aside}
      </span>
      <span className="ph-card__figure">
        <b>{value}</b> {unit}
      </span>
    </button>
  )
}

/** The first few logos, as a taste of the portfolio. */
const SAMPLE = ALL.filter((c) => c.logo).slice(0, 3)

function Dashboard({ covered }: { covered: boolean }) {
  return (
    <div className="ph-home" data-covered={covered || undefined} {...(covered ? ({ inert: '' } as object) : null)}>
      <header className="ph-home__top">
        <div className="ph-home__mark" aria-hidden>
          {SITE.mark}
        </div>
        <div className="ph-home__name">{SITE.legalName}</div>
      </header>
      <ChatCard />
      <div className="ph-tiles">
        <Tile
          app="finder"
          name="Portfolio"
          value={COMPANY_COUNT}
          unit="companies"
          aside={
            <span className="ph-card__logos" aria-hidden>
              {SAMPLE.map((c) => (
                <CompanyLogo key={c.name} company={c} size={20} />
              ))}
            </span>
          }
        />
        <Tile app="notes" name="FAQs" value={FAQS.length} unit="questions" />
        <Tile app="terminal" name="Case Studies" value={CASE_STUDIES.length} unit="private" />
        <Tile app="photos" name="VIP" value={DROPS.length} unit="drops" />
      </div>
      <a className="ph-home__link" href={SITE.onePager} target="_blank" rel="noreferrer">
        One-pager
        <ArrowUpRight size={16} strokeWidth={2.4} aria-hidden />
      </a>
    </div>
  )
}

// ---- Apps and sheets ----

/** An app, full screen: it grows out of its place in the Dock and shrinks back into it. */
function AppHost({ app, state, still, active }: { app: PhoneApp; state: 'open' | 'closing' | 'under'; still: boolean; active: boolean }) {
  const ref = useRef<HTMLElement>(null)
  // Where its icon is from here: the move it makes on the way in and on the way out
  useLayoutEffect(() => {
    const el = ref.current
    const box = el?.parentElement?.getBoundingClientRect()
    const icon = document.querySelector<HTMLElement>(`[data-dock-app="${app}"] .ph-dock__icon`)?.getBoundingClientRect()
    if (!el || !box || !icon || !box.width) return
    el.style.setProperty('--dx', `${(icon.left + icon.width / 2 - (box.left + box.width / 2)).toFixed(1)}px`)
    el.style.setProperty('--dy', `${(icon.top + icon.height / 2 - (box.top + box.height / 2)).toFixed(1)}px`)
    el.style.setProperty('--k', (icon.width / box.width).toFixed(4))
  }, [app, state])
  return (
    <section ref={ref} className="ph-app" data-app={app} data-state={state} data-still={still || undefined} aria-label={LABEL[app]} {...(active ? null : ({ inert: '' } as object))}>
      <ViewContext.Provider value={{ active }}>
        <AppScreen app={app} />
      </ViewContext.Provider>
    </section>
  )
}

export function Phone() {
  const { app, sheet, leaving, closing, motion } = useStore(phone, (s) => s)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = root.current
    const vv = window.visualViewport
    if (!el) return
    // Lets :active show under a finger in Safari, which otherwise waits for a listener
    const touch = () => {}
    document.addEventListener('touchstart', touch, { passive: true })
    // The keyboard takes the bottom of the screen: the phone keeps to what is
    // left above it, and the Dock steps aside. A pinch-zoom is not a keyboard.
    const fit = () => {
      if (!vv || Math.abs(vv.scale - 1) > 0.01) return
      const keyboard = window.innerHeight - vv.height > 120
      el.toggleAttribute('data-keyboard', keyboard)
      if (keyboard) {
        el.style.setProperty('--vv-h', `${vv.height}px`)
        el.style.setProperty('--vv-top', `${vv.offsetTop}px`)
      } else {
        el.style.removeProperty('--vv-h')
        el.style.removeProperty('--vv-top')
        // Safari can leave the page nudged up after the keyboard has gone
        if (window.scrollY) window.scrollTo(0, 0)
      }
    }
    fit()
    vv?.addEventListener('resize', fit)
    vv?.addEventListener('scroll', fit)
    return () => {
      document.removeEventListener('touchstart', touch)
      vv?.removeEventListener('resize', fit)
      vv?.removeEventListener('scroll', fit)
    }
  }, [])

  // Going home, the app shrinks into the Dock. Going to another app, it stays
  // where it is while the new one grows over it, then it is gone.
  const hosts: { app: PhoneApp; state: 'open' | 'closing' | 'under' }[] = []
  if (leaving && leaving !== app) hosts.push({ app: leaving, state: app ? 'under' : 'closing' })
  if (app) hosts.push({ app, state: 'open' })
  const over = sheet ?? closing

  return (
    <div ref={root} className="ph" data-app={app ?? 'home'} data-sheet={sheet ? '' : undefined}>
      <Dashboard covered={!!app} />
      {hosts.map((host) => (
        <AppHost key={host.app} app={host.app} state={host.state} still={!motion} active={host.state === 'open' && !sheet} />
      ))}
      <Dock />
      {over && <SheetScreen key={over} sheet={over} closing={!sheet} />}
    </div>
  )
}
