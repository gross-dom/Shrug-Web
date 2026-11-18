import { useCallback, useEffect, useId, useRef, useState, type ComponentType, type CSSProperties, type ReactNode } from 'react'
import { ArrowUpRight, Check, Search, Sun, X } from 'lucide-react'
import { chat, toggleChat } from '../../apps/chat'
import { GROUP_NAME } from '../../apps/chat-ui'
import { hostOf } from '../../apps/portfolio-ui'
import { ShrugAvatar } from '../../apps/ui'
import { CASE_STUDIES } from '../../data/caseStudies'
import { arrived, DROPS } from '../../data/drops'
import { FAQS } from '../../data/faqs'
import { PEOPLE } from '../../data/people'
import { COMPANY_COUNT, VERTICALS } from '../../data/portfolio'
import { reach, reachable, SITE } from '../../data/site'
import { useStore } from '../../os/store'
import '../../styles/phone/settings.css'
import { AUTO_LOCK, autoLockLabel, setSetting, settings } from '../settings'
import { launch, launchAt, push, type PhoneApp } from '../system'
import { Cell, Empty, GlassButton, List, NavStack, quoted, Screen, SearchBar, Section, Switch, usePageHeadingId } from '../ui'

// Settings, as the iPhone has it. Whose phone this is heads the first screen,
// as an Apple Account does; under it are the pages that change something here
// (how replies are announced, when the phone locks, the tick under a finger)
// and the two that only tell: General › About, where an iPhone keeps its name
// and its counts, and Privacy & Security. Every figure is counted from the
// site's own data, and every switch is one the rest of the phone obeys
// (src/phone/settings.ts), kept in the browser from one visit to the next.

// ---- The pages ----

type PageId = 'account' | 'general' | 'about' | 'notifications' | 'previews' | 'display' | 'autolock' | 'sounds' | 'privacy'

/** The pages reached from the first screen's list, each with a tile of its own. */
type TopId = 'general' | 'display' | 'notifications' | 'sounds' | 'privacy'

interface Page {
  title: string
  /** What the app's stack holds while the page is showing: the pages that lead to it, itself last. */
  path: PageId[]
  /** The tile it wears in search: its own, or that of the page it is under. */
  top: TopId | null
  /** What is on the page, in words: search finds a page by these too. */
  words: string
}

const PAGES: Record<PageId, Page> = {
  account: { title: SITE.legalName, path: ['account'], top: null, words: 'about shrug one-pager website contact reach email pitch get in touch' },
  general: { title: 'General', path: ['general'], top: 'general', words: '' },
  about: { title: 'About', path: ['general', 'about'], top: 'general', words: `name replies companies verticals faqs case studies drops${arrived() ? ' photos videos' : ''}` },
  display: { title: 'Display & Brightness', path: ['display'], top: 'display', words: '' },
  autolock: { title: 'Auto-Lock', path: ['display', 'autolock'], top: 'display', words: '' },
  notifications: { title: 'Notifications', path: ['notifications'], top: 'notifications', words: 'allow notifications banners replies pause stop' },
  previews: { title: 'Show Previews', path: ['notifications', 'previews'], top: 'notifications', words: '' },
  sounds: { title: 'Sounds & Haptics', path: ['sounds'], top: 'sounds', words: 'system haptics' },
  privacy: { title: 'Privacy & Security', path: ['privacy'], top: 'privacy', words: 'tracking cookies messages access requests storage saved kept' },
}

/** The first screen's list, in iOS's order. */
const TOP: TopId[] = ['general', 'display', 'notifications', 'sounds', 'privacy']

/** In search, in the order the pages come in Settings. */
const SEARCHED: PageId[] = ['account', 'general', 'about', 'display', 'autolock', 'notifications', 'previews', 'sounds', 'privacy']

const isPage = (view: string): view is PageId => Object.prototype.hasOwnProperty.call(PAGES, view)

/** A page's place in Settings, as search writes it under a result: "General › About". */
const trailOf = (page: Page) => page.path.map((id) => PAGES[id].title).join(' › ')

// ---- Tiles ----

/** A gear, solid: eight teeth round a hub, the hub cut out. */
const GEAR = (() => {
  const at = (deg: number, r: number) => {
    const a = ((deg - 90) * Math.PI) / 180
    return `${(12 + r * Math.cos(a)).toFixed(2)} ${(12 + r * Math.sin(a)).toFixed(2)}`
  }
  const rim = 9.7
  const root = 7.3
  let d = ''
  for (let i = 0; i < 8; i++) {
    const t = i * 45
    // Along the root to the tooth, up its flank, across its tip, back down
    d += `${i ? `A${root} ${root} 0 0 1 ` : 'M'}${at(t - 13.5, root)}L${at(t - 7.5, rim)}A${rim} ${rim} 0 0 1 ${at(t + 7.5, rim)}L${at(t + 13.5, root)}`
  }
  return `${d}A${root} ${root} 0 0 1 ${at(-13.5, root)}ZM15.3 12a3.3 3.3 0 1 0-6.6 0a3.3 3.3 0 1 0 6.6 0Z`
})()

/** A bell with its badge. The badge sits clear of the bell: a ring of the bell is cut away round it. */
function BellGlyph({ size }: { size: number }) {
  const id = useId().replace(/:/g, '')
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden>
      <mask id={id}>
        <rect width="24" height="24" fill="#fff" />
        <circle cx="17.6" cy="6.2" r="4.3" fill="#000" />
      </mask>
      <g mask={`url(#${id})`}>
        <path d="M12 3.4a5.7 5.7 0 0 0-5.7 5.7c0 4-1.2 5.5-2.5 6.8a1 1 0 0 0 .7 1.7h15a1 1 0 0 0 .7-1.7c-1.3-1.3-2.5-2.8-2.5-6.8A5.7 5.7 0 0 0 12 3.4z" />
        <path d="M9.5 19.3a2.65 2.65 0 0 0 5 0z" />
      </g>
      <circle cx="17.6" cy="6.2" r="2.9" />
    </svg>
  )
}

type Glyph = (size: number) => ReactNode

/** What is drawn on each tile, in white, after the symbol iOS puts there. */
const GLYPHS: Record<TopId, Glyph> = {
  general: (size) => (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <path d={GEAR} fill="currentColor" fillRule="evenodd" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
    </svg>
  ),
  display: (size) => <Sun size={size} strokeWidth={2.3} fill="currentColor" aria-hidden />,
  notifications: (size) => <BellGlyph size={size} />,
  // A speaker, solid, and the sound coming off it
  sounds: (size) => (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M10.4 5.3 6.7 8.5H4.3a.9.9 0 0 0-.9.9v5.2a.9.9 0 0 0 .9.9h2.4l3.7 3.2a.55.55 0 0 0 .9-.42V5.72a.55.55 0 0 0-.9-.42z" fill="currentColor" strokeWidth="1.3" />
      <path d="M15.2 9.2a4 4 0 0 1 0 5.6" />
      <path d="M18.1 6.5a8 8 0 0 1 0 11" />
    </svg>
  ),
  // A raised hand: four fingers, the palm under them, the thumb out to one side
  privacy: (size) => (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden>
      <rect x="6.7" y="4.3" width="3" height="10.5" rx="1.5" />
      <rect x="10.1" y="2.5" width="3" height="12" rx="1.5" />
      <rect x="13.5" y="3.5" width="3" height="11" rx="1.5" />
      <rect x="16.9" y="6" width="2.9" height="9" rx="1.45" />
      <path d="M6.7 11.8h13.1v3.3a6.55 6.55 0 0 1-13.1 0z" />
      <rect x="3" y="11.3" width="3.1" height="7.8" rx="1.55" transform="rotate(-36 4.55 15.2)" />
    </svg>
  ),
}

/** The colour of each tile. */
const TILE: Record<TopId, string> = { general: '#8e8e93', display: '#007aff', notifications: '#ff3b30', sounds: '#ff2d55', privacy: '#007aff' }

/** A page's icon: a rounded square of colour with its symbol in white. `big` is the one that heads the page itself. */
function Tile({ id, big }: { id: TopId; big?: boolean }) {
  return (
    <span className="settings-tile" data-big={big || undefined} style={{ '--tile': TILE[id] } as CSSProperties} aria-hidden>
      {GLYPHS[id](big ? 38 : 20)}
    </span>
  )
}

// ---- Parts the pages share ----

/** A row that leaves the site says so with an arrow, where a row that stays has a chevron; and in
 * words, after everything else the row says, for someone who is told the row and not shown it. */
const leaves = (where: string) => (
  <>
    <ArrowUpRight className="settings-out" size={18} strokeWidth={2.4} aria-hidden />
    <span className="sr-only">, {where}</span>
  </>
)
const out = leaves('opens in a new tab')

/** The site is being read at the address Settings would send a visitor to: there is nowhere else to send them. */
const atHome = () => {
  try {
    return new URL(SITE.url).hostname === window.location.hostname
  } catch {
    return false
  }
}

/** A page headed by its own name in the page (a card, a face): the bar says
 * the name only once that has scrolled away under it, as Settings does. */
function Headed({ title, head, children }: { title: string; head: (name: (el: HTMLElement | null) => void, id: string | undefined) => ReactNode; children: ReactNode }) {
  const scroller = useRef<HTMLDivElement>(null)
  const name = useRef<HTMLElement | null>(null)
  // The name in the page is the page's heading: the page is named by it
  const headingId = usePageHeadingId()
  const setName = useCallback((el: HTMLElement | null) => {
    name.current = el
  }, [])
  const [under, setUnder] = useState(false)

  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const look = () => {
      const h = name.current
      if (!h) return
      // The bar ends where the page's own padding does
      const bar = parseFloat(getComputedStyle(el).paddingTop) || 0
      setUnder(h.offsetTop + h.offsetHeight - el.scrollTop < bar - 4)
    }
    look()
    el.addEventListener('scroll', look, { passive: true })
    return () => el.removeEventListener('scroll', look)
  }, [])

  return (
    <Screen
      title={title}
      tone="grouped"
      className="settings-screen"
      scrollRef={scroller}
      ownHeading
      center={
        // The name in the page is the page's heading; this one is only for the eye
        <span className="ios-bar__name settings-bar-name" data-show={under || undefined} aria-hidden>
          {title}
        </span>
      }
    >
      {head(setName, headingId)}
      {children}
    </Screen>
  )
}

/** The card iOS puts at the top of a page of settings: its tile, its name, a line on what it is for. */
function Carded({ id, text, children }: { id: TopId; text: string; children: ReactNode }) {
  return (
    <Headed
      title={PAGES[id].title}
      head={(name, headingId) => (
        <div className="settings-hero">
          <Tile id={id} big />
          <h2 ref={name} id={headingId} className="settings-hero__title">
            {PAGES[id].title}
          </h2>
          <p className="settings-hero__text">{text}</p>
        </div>
      )}
    >
      {children}
    </Headed>
  )
}

/** A page that is only its rows, under its name in the bar. */
function Plain({ id, children }: { id: PageId; children: ReactNode }) {
  return (
    <Screen title={PAGES[id].title} tone="grouped" className="settings-screen">
      {children}
    </Screen>
  )
}

/** One of a list of choices: the one that is chosen carries the tick. */
function Choice({ title, chosen, onPick }: { title: string; chosen: boolean; onPick: () => void }) {
  return (
    <Cell
      title={
        <>
          {title}
          {chosen && <span className="sr-only">, selected</span>}
        </>
      }
      onClick={onPick}
      trailing={chosen ? <Check className="settings-check" size={20} strokeWidth={2.8} aria-hidden /> : undefined}
    />
  )
}

// ---- The first screen ----

function Root() {
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const q = query.trim().toLowerCase()
  const found = q ? SEARCHED.filter((id) => `${PAGES[id].title} ${PAGES[id].words}`.toLowerCase().includes(q)) : []

  const done = () => {
    setQuery('')
    setSearching(false)
    const field = document.activeElement
    if (field instanceof HTMLElement) field.blur()
  }

  return (
    <Screen
      title="Settings"
      large
      tone="grouped"
      className="settings-screen"
      foot={
        <>
          <SearchBar value={query} onChange={setQuery} label="Search Settings" onFocus={() => setSearching(true)} onBlur={() => setSearching(!!query.trim())} />
          {(searching || q) && (
            // Pressing it must not take the keyboard from the field first: the field going quiet would put the button away under the finger
            <span className="settings-close" onMouseDown={(e) => e.preventDefault()}>
              <GlassButton label="Close search" onClick={done}>
                <X size={20} strokeWidth={2.4} aria-hidden />
              </GlassButton>
            </span>
          )}
        </>
      }
    >
      {q ? (
        found.length ? (
          <List>
            <Section>
              {found.map((id) => {
                const page = PAGES[id]
                return <Cell key={id} className="settings-result" lead={page.top ? <Tile id={page.top} /> : <ShrugAvatar size={30} />} title={page.title} subtitle={page.path.length > 1 ? trailOf(page) : undefined} onClick={() => launchAt('about', page.path)} />
              })}
            </Section>
          </List>
        ) : (
          <Empty icon={<Search size={44} strokeWidth={1.8} />} title={`No Results for “${quoted(query)}”`}>
            Check the spelling or try a new search.
          </Empty>
        )
      ) : (
        <List>
          <Section>
            <Cell className="settings-account" lead={<ShrugAvatar size={60} />} title={SITE.legalName} subtitle="About Shrug, one-pager, and more" chevron onClick={() => push('account')} />
          </Section>
          <Section>
            {TOP.map((id) => (
              <Cell key={id} lead={<Tile id={id} />} title={PAGES[id].title} chevron onClick={() => push(id)} />
            ))}
          </Section>
        </List>
      )}
    </Screen>
  )
}

// ---- Whose phone this is ----

function Account() {
  // The way to Shrug, when there is one that is more than the one-pager (src/data/site.ts)
  const way = reachable() ? reach() : null
  return (
    <Headed
      title={SITE.legalName}
      head={(name, headingId) => (
        <div className="settings-id">
          <ShrugAvatar size={96} />
          <h2 ref={name} id={headingId} className="settings-id__name">
            {SITE.legalName}
          </h2>
          <div className="settings-id__mark" aria-hidden>
            {SITE.mark}
          </div>
          {/* Who Shrug is, in a sentence */}
          <p className="settings-id__line">{SITE.line.replace(/-/g, '\u2011')}</p>
        </div>
      )}
    >
      <List>
        <Section>
          {way && <Cell title={way.label} href={way.href} trailing={leaves(way.kind === 'email' ? 'opens your mail app' : 'opens your messages app')} />}
          <Cell title="One-pager" href={SITE.onePager} trailing={out} />
          {/* Not when this is that website: the row would open the page it is on */}
          {!atHome() && <Cell title="Website" value={hostOf(SITE.url)} href={SITE.url} trailing={out} />}
        </Section>
      </List>
    </Headed>
  )
}

// ---- General, and About inside it ----

function General() {
  return (
    <Carded id="general" text="What this iPhone is, and what is on it.">
      <List>
        <Section>
          <Cell title="About" chevron onClick={() => push('about')} />
        </Section>
      </List>
    </Carded>
  )
}

/** What is on the phone, counted: where an iPhone lists its songs, videos and photos. A row with an app opens it. */
const FACTS: { label: string; value: number; app?: PhoneApp }[] = [
  { label: 'Replies', value: PEOPLE.length, app: 'messages' },
  { label: 'Companies', value: COMPANY_COUNT, app: 'finder' },
  { label: 'Verticals', value: VERTICALS.length, app: 'finder' },
  { label: 'FAQs', value: FAQS.length, app: 'notes' },
  { label: 'Case Studies', value: CASE_STUDIES.length, app: 'terminal' },
  { label: 'Drops', value: DROPS.length, app: 'photos' },
  // Photos and videos are counted as they arrive: until one has, there is no row for them
  ...(arrived('photo') ? [{ label: 'Photos', value: arrived('photo') }] : []),
  ...(arrived('video') ? [{ label: 'Videos', value: arrived('video') }] : []),
]

function About() {
  return (
    <Plain id="about">
      <List>
        <Section>
          <Cell title="Name" value={SITE.name} />
        </Section>
        <Section footer="Every figure here is counted from what is on the site.">
          {FACTS.map(({ label, value, app }) => (app ? <Cell key={label} title={label} value={value} chevron onClick={() => launch(app)} /> : <Cell key={label} title={label} value={value} />))}
        </Section>
      </List>
    </Plain>
  )
}

// ---- Notifications ----

function Notifications() {
  const allowed = useStore(settings, (s) => s.notifications)
  const previews = useStore(settings, (s) => s.previews)
  // The conversation itself: the same switch as in its details, here so that it can be stopped from outside it
  const paused = useStore(chat, (c) => c.paused)
  const done = useStore(chat, (c) => c.done)
  return (
    <Carded id="notifications" text="Replies drop in at the top of the screen while you are outside Messages, and wait on the Lock Screen.">
      <List>
        <Section>
          <Cell title="Allow Notifications" trailing={<Switch on={allowed} label="Allow Notifications" onChange={(on) => setSetting('notifications', on)} />} />
        </Section>
        <Section>
          {/* With nothing announced there is nothing to preview */}
          <Cell title="Show Previews" value={previews ? 'Always' : 'Never'} chevron disabled={!allowed} onClick={() => push('previews')} />
        </Section>
        <Section footer={done ? 'Everyone has replied.' : `Stops new replies everywhere: in ${GROUP_NAME}, as notifications, on the Messages badge and on the Home Screen.`}>
          <Cell title="Pause Replies" trailing={<Switch on={paused} label="Pause Replies" disabled={done} onChange={toggleChat} />} />
        </Section>
      </List>
    </Carded>
  )
}

function Previews() {
  const previews = useStore(settings, (s) => s.previews)
  return (
    <Plain id="previews">
      <List>
        <Section footer="With previews off, a notification says who a reply is from and not what it says.">
          <Choice title="Always" chosen={previews} onPick={() => setSetting('previews', true)} />
          <Choice title="Never" chosen={!previews} onPick={() => setSetting('previews', false)} />
        </Section>
      </List>
    </Plain>
  )
}

// ---- Display & Brightness ----

function Display() {
  const autoLock = useStore(settings, (s) => s.autoLock)
  return (
    <Plain id="display">
      <List>
        <Section>
          <Cell title="Auto-Lock" value={autoLockLabel(autoLock)} chevron onClick={() => push('autolock')} />
        </Section>
      </List>
    </Plain>
  )
}

function AutoLock() {
  const autoLock = useStore(settings, (s) => s.autoLock)
  return (
    <Plain id="autolock">
      <List>
        <Section>
          {AUTO_LOCK.map((seconds) => (
            <Choice key={String(seconds)} title={autoLockLabel(seconds)} chosen={seconds === autoLock} onPick={() => setSetting('autoLock', seconds)} />
          ))}
        </Section>
      </List>
    </Plain>
  )
}

// ---- Sounds & Haptics ----

function Sounds() {
  const haptics = useStore(settings, (s) => s.haptics)
  return (
    <Plain id="sounds">
      <List>
        <Section footer="Play haptics for system controls and interactions.">
          <Cell title="System Haptics" trailing={<Switch on={haptics} label="System Haptics" onChange={(on) => setSetting('haptics', on)} />} />
        </Section>
      </List>
    </Plain>
  )
}

// ---- Privacy & Security ----

/** What the site does with a visitor, row by row. Each is true of the site's
 * own code as it stands. Nothing is sent anywhere by the site: what is typed
 * into a conversation stays where it was typed (`sendMessage` in
 * apps/chat.ts), and an access request, once Shrug has an address, is written
 * in the visitor's own mail or messages app and sent by them. Nothing is
 * written to cookies, and every file the page loads is the site's own. What a
 * visitor sets or writes is kept, in their own browser and nowhere else, so
 * that the site is as they left it: the choices made here
 * (src/phone/settings.ts), their notes and folders, what they have favorited
 * in VIP, how far the conversation has got, and the phone's place (in the
 * tab's history). If the site starts to send anything, to keep it anywhere
 * else, or to load anything from elsewhere, this page has to say so. */
const PRIVACY: { label: string; value: string }[] = [
  { label: 'Messages You Type', value: 'Not Sent' },
  { label: 'Access Requests', value: reachable() ? (reach().kind === 'email' ? 'From Your Mail' : 'From Your Messages') : 'Not Sent' },
  { label: 'Cookies', value: 'None' },
  { label: 'Tracking', value: 'None' },
  { label: 'What You Set or Write', value: 'Kept on This Device' },
]

function Privacy() {
  return (
    <Carded id="privacy" text="What this site does with what you do here.">
      <List>
        <Section footer="Nothing you do here is sent anywhere, and the site loads nothing from other sites. What you set or write is kept in this browser, on this device, so that the site is as you left it. Clearing this site’s data in your browser clears it.">
          {PRIVACY.map(({ label, value }) => (
            <Cell key={label} title={label} value={value} />
          ))}
        </Section>
      </List>
    </Carded>
  )
}

// ---- All of it ----

const SCREENS: Record<PageId, ComponentType> = {
  account: Account,
  general: General,
  about: About,
  notifications: Notifications,
  previews: Previews,
  display: Display,
  autolock: AutoLock,
  sounds: Sounds,
  privacy: Privacy,
}

/** A place Settings has no page for: nothing to show, and the way back. */
function Missing() {
  return (
    <Screen title="Settings" tone="grouped" className="settings-screen">
      <Empty title="Nothing Here">This page of Settings isn’t on this iPhone.</Empty>
    </Screen>
  )
}

/** The screen for a view in the app's stack. */
function Shown({ view }: { view: string }) {
  if (!isPage(view)) return <Missing />
  const Body = SCREENS[view]
  return <Body />
}

export function SettingsApp() {
  return <NavStack>{(view) => (view === null ? <Root /> : <Shown view={view} />)}</NavStack>
}
