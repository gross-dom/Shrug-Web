import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { ArrowUpLeft, LayoutGrid, Search, X } from 'lucide-react'
import { PersonAvatar } from '../apps/chat-ui'
import { ALL, CompanyLogo } from '../apps/portfolio-ui'
import { DROPS, MEDIA } from '../data/drops'
import { FAQS } from '../data/faqs'
import { PEOPLE } from '../data/people'
import { VERTICALS } from '../data/portfolio'
import { APPS } from '../os/apps'
import { useStore } from '../os/store'
import { PhoneIcon } from './icons'
import { DOCKED, ON_HOME, PHONE } from './apps'
import { albumView, companySheet, conversationView, FAQS_FOLDER, noteView, PORTFOLIO_FOLDER } from './apps/routes'
import { launch, launchAt, showSpotlight, sys, type PhoneApp } from './system'
import '../styles/phone/spotlight.css'

// Search, over the Home Screen, as Spotlight: a field at the foot of the
// screen, the apps suggested before anything is typed, and then everything on
// the site that matches, grouped by the app it lives in. Choosing a result
// opens that app at that place.

// ---- What matches ----

type Kind = 'app' | 'person' | 'company' | 'faq' | 'drop'

interface Hit {
  key: string
  kind: Kind
  /** How good a match it is: lower is better. Names that start with what was typed come first. */
  score: number
  /** Its picture, at a size. */
  lead: (size: number) => ReactNode
  title: ReactNode
  subtitle?: ReactNode
  open: () => void
}

interface Found {
  top: Hit | null
  groups: { id: Kind; title: string; icon: ReactNode; hits: Hit[] }[]
}

/** How well `text` answers `q` as a name: the whole of it, its start, the start of a word in it, somewhere in it, or not at all (-1). */
function rank(text: string, q: string) {
  const t = text.toLowerCase()
  const at = t.indexOf(q)
  if (at < 0) return -1
  if (at === 0) return t.length === q.length ? 0 : 1
  return /[^a-z0-9]/.test(t[at - 1]!) ? 2 : 3
}

/** `text` with what was typed picked out in it. */
function Marked({ text, q }: { text: string; q: string }) {
  const at = text.toLowerCase().indexOf(q)
  if (at < 0) return <>{text}</>
  return (
    <>
      {text.slice(0, at)}
      <b>{text.slice(at, at + q.length)}</b>
      {text.slice(at + q.length)}
    </>
  )
}

/** The part of a long text that holds what was typed: from a few words before it. */
function around(text: string, q: string) {
  const at = text.toLowerCase().indexOf(q)
  if (at <= 30) return text
  const from = text.indexOf(' ', at - 30)
  return `…${text.slice(from >= 0 && from < at ? from + 1 : at)}`
}

const tile = (id: PhoneApp) => (size: number) => (
  <span className="spot-tile" style={{ width: size, height: size }}>
    <PhoneIcon id={id} />
  </span>
)

/** How many photos and videos a drop has, in words. */
function mediaOf(drop: string) {
  const photos = MEDIA.filter((m) => m.drop === drop && m.kind === 'photo').length
  const videos = MEDIA.filter((m) => m.drop === drop && m.kind === 'video').length
  const said = [photos && `${photos} photo${photos === 1 ? '' : 's'}`, videos && `${videos} video${videos === 1 ? '' : 's'}`].filter(Boolean)
  return said.length ? said.join(', ') : 'Album'
}

/** The apps, in the order the Home Screen has them: the Dock's, then the rest. */
const APP_ORDER: PhoneApp[] = [...DOCKED, ...ON_HOME]

/** A group shows this many at most. */
const MOST = 4

function find(raw: string): Found {
  const q = raw.trim().toLowerCase()
  if (!q) return { top: null, groups: [] }
  const byScore = (a: Hit, b: Hit) => a.score - b.score

  const apps: Hit[] = []
  APP_ORDER.forEach((id) => {
    const named = rank(PHONE[id].label, q)
    const also = named < 0 ? Math.max(rank(APPS[id].name, q), rank(APPS[id].blurb, q)) : -1
    if (named < 0 && also < 0) return
    apps.push({ key: `app:${id}`, kind: 'app', score: named >= 0 ? named : 4 + also, lead: tile(id), title: <Marked text={PHONE[id].label} q={q} />, subtitle: <Marked text={APPS[id].blurb} q={q} />, open: () => launch(id) })
  })

  const people: Hit[] = []
  PEOPLE.forEach((person, i) => {
    const named = rank(person.name, q)
    const role = named < 0 ? rank(person.role, q) : -1
    const said = named < 0 && role < 0 && !!person.quote && person.quote.toLowerCase().includes(q)
    if (named < 0 && role < 0 && !said) return
    people.push({
      key: `person:${i}`,
      kind: 'person',
      score: named >= 0 ? named : role >= 0 ? 4 + role : 9,
      lead: (size) => <PersonAvatar index={i} size={size} />,
      title: <Marked text={person.name} q={q} />,
      // What they said, where that is what matched; otherwise who they are
      subtitle: said ? <Marked text={around(person.quote!, q)} q={q} /> : <Marked text={person.role} q={q} />,
      open: () => launchAt('messages', [conversationView(i)]),
    })
  })

  const companies: Hit[] = []
  ALL.forEach((company) => {
    const named = rank(company.name, q)
    const field = named < 0 ? rank(company.vertical, q) : -1
    const described = named < 0 && field < 0 && !!company.blurb && company.blurb.toLowerCase().includes(q)
    if (named < 0 && field < 0 && !described) return
    companies.push({
      key: `company:${company.name}`,
      kind: 'company',
      score: named >= 0 ? named : field >= 0 ? 4 + field : 9,
      lead: (size) => <CompanyLogo company={company} size={size} />,
      title: <Marked text={company.name} q={q} />,
      subtitle: described ? <Marked text={around(company.blurb!, q)} q={q} /> : <Marked text={company.vertical} q={q} />,
      open: () => launchAt('finder', [PORTFOLIO_FOLDER], null, companySheet(company.name)),
    })
  })

  // Asking for a kind of thing by its name ("faqs", "drops") finds all of that kind
  const kindOf = (...names: string[]) => q.length >= 3 && names.some((name) => name.startsWith(q))

  const faqs: Hit[] = []
  const anyFaq = kindOf('faqs', 'questions', 'notes')
  FAQS.forEach((faq, i) => {
    const asked = rank(faq.question, q)
    const answered = asked < 0 && !!faq.answer && faq.answer.toLowerCase().includes(q)
    if (asked < 0 && !answered && !anyFaq) return
    faqs.push({
      key: `faq:${i}`,
      kind: 'faq',
      score: asked >= 0 ? asked : answered ? 9 : 10,
      lead: tile('notes'),
      title: <Marked text={faq.question} q={q} />,
      subtitle: answered ? <Marked text={around(faq.answer!, q)} q={q} /> : 'Note',
      open: () => launchAt('notes', [FAQS_FOLDER, noteView(i)]),
    })
  })

  const drops: Hit[] = []
  const anyDrop = kindOf('drops', 'albums')
  DROPS.forEach((drop) => {
    const named = rank(drop, q)
    if (named < 0 && !anyDrop) return
    drops.push({ key: `drop:${drop}`, kind: 'drop', score: named >= 0 ? named : 10, lead: tile('photos'), title: <Marked text={drop} q={q} />, subtitle: mediaOf(drop), open: () => launchAt('photos', [albumView(drop)]) })
  })

  const lists: Record<Kind, Hit[]> = { app: apps.sort(byScore), person: people.sort(byScore), company: companies.sort(byScore), faq: faqs.sort(byScore), drop: drops.sort(byScore) }

  // The best of them all, if it is a name that what was typed begins (or begins a word of)
  let top: Hit | null = null
  for (const kind of ['app', 'person', 'company', 'faq', 'drop'] as Kind[]) {
    const best = lists[kind][0]
    if (best && best.score <= 2 && (!top || best.score < top.score)) top = best
  }
  const rest = (kind: Kind) => lists[kind].filter((hit) => hit !== top).slice(0, MOST)

  const icon = (id: PhoneApp) => <PhoneIcon id={id} />
  const groups: Found['groups'] = [
    { id: 'person' as const, title: PHONE.messages.label, icon: icon('messages'), hits: rest('person') },
    { id: 'company' as const, title: PHONE.finder.label, icon: icon('finder'), hits: rest('company') },
    { id: 'faq' as const, title: PHONE.notes.label, icon: icon('notes'), hits: rest('faq') },
    { id: 'drop' as const, title: PHONE.photos.label, icon: icon('photos'), hits: rest('drop') },
    { id: 'app' as const, title: 'Apps', icon: <LayoutGrid size={16} strokeWidth={2.4} />, hits: rest('app') },
  ].filter((group) => group.hits.length > 0)
  return { top, groups }
}

/** Things to type, to see what search finds: a person, a company, a vertical and a word from a question. */
const TRY = [PEOPLE[0]!.name, (ALL.find((c) => c.name === 'Anduril') ?? ALL[0]!).name, VERTICALS[0]!.name, 'drops']

// ---- What it looks like ----

function Row({ hit, top }: { hit: Hit; top?: boolean }) {
  return (
    <button type="button" className="spot-row" data-top={top || undefined} data-spot-item onClick={hit.open}>
      <span className="spot-row__lead">{hit.lead(top ? 52 : 40)}</span>
      <span className="spot-row__text">
        <span className="spot-row__title">{hit.title}</span>
        {hit.subtitle && <span className="spot-row__sub">{hit.subtitle}</span>}
      </span>
    </button>
  )
}

function Group({ title, icon, children }: { title: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <section className="spot-group" aria-label={title}>
      <h2 className="spot-group__head">
        {icon && (
          <span className="spot-group__icon" aria-hidden>
            {icon}
          </span>
        )}
        {title}
      </h2>
      <div className="spot-card">{children}</div>
    </section>
  )
}

export function Spotlight() {
  const on = useStore(sys, (s) => s.spotlight)
  // It stays drawn while it leaves
  const [shown, setShown] = useState(on)
  const [query, setQuery] = useState('')
  /** The result the arrow keys are on, counted down the list, or -1 for none. The keyboard itself stays in the field. */
  const [at, setAt] = useState(-1)
  const root = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  if (on && !shown) setShown(true)

  useEffect(() => {
    if (on || !shown) return
    const t = setTimeout(() => setShown(false), 320)
    return () => clearTimeout(t)
  }, [on, shown])

  // It opens empty and takes the keyboard; closing gives the keyboard back
  useLayoutEffect(() => {
    if (on) {
      setQuery('')
      setAt(-1)
      input.current?.focus({ preventScroll: true })
    } else if (root.current?.contains(document.activeElement)) {
      // Back on the Home Screen, the keyboard goes back to the pill search was opened from
      const pill = sys.get().app ? null : document.querySelector<HTMLElement>('.sb-search')
      if (pill) pill.focus({ preventScroll: true })
      else (document.activeElement as HTMLElement).blur()
    }
  }, [on])

  const found = useMemo(() => find(query), [query])
  const typed = query.trim().length > 0
  const first = found.top ?? found.groups[0]?.hits[0] ?? null
  const close = () => showSpotlight(false)

  const items = () => [...(root.current?.querySelectorAll<HTMLElement>('[data-spot-item]') ?? [])]

  // The result the arrow keys are on is marked, named to assistive tech, and kept in view
  useLayoutEffect(() => {
    const list = items()
    list.forEach((el, i) => {
      el.id = `spot-item-${i}`
      el.toggleAttribute('data-active', i === at)
    })
    if (at >= 0 && list[at]) {
      input.current?.setAttribute('aria-activedescendant', list[at]!.id)
      list[at]!.scrollIntoView({ block: 'nearest' })
    } else input.current?.removeAttribute('aria-activedescendant')
  }) // every draw: what is listed changes with what is typed

  /** In the field, the arrow keys walk the results and Return opens the one they are on, or the best. */
  const onFieldKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const count = items().length
      if (!count) return
      e.preventDefault()
      setAt((now) => Math.max(-1, Math.min(count - 1, now + (e.key === 'ArrowDown' ? 1 : -1))))
    } else if (e.key === 'Enter') {
      const picked = at >= 0 ? items()[at] : null
      if (!picked && !(typed && first)) return
      e.preventDefault()
      if (picked) picked.click()
      else first!.open()
    }
  }

  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return
    e.preventDefault()
    close()
  }

  if (!shown) return null
  return (
    <div ref={root} className="spot" data-leaving={!on || undefined} role="dialog" aria-modal="true" aria-label="Search" onKeyDown={onKey} {...(on ? null : ({ inert: '' } as object))}>
      {/* The ground behind: a tap on it closes search. The round button beside the field is the one with a name */}
      <div className="spot-away" aria-hidden onClick={close} />
      <div
        className="spot-scroll"
        // A tap on the bare ground between results closes it, as a tap on the wallpaper does
        onClick={(e) => e.target === e.currentTarget && close()}
        // Reaching for the results puts the keyboard away
        onTouchMove={() => document.activeElement === input.current && input.current?.blur()}
      >
        {!typed ? (
          <>
            <Group title="Siri Suggestions">
              <div className="spot-apps">
                {APP_ORDER.map((id) => (
                  <button key={id} type="button" className="spot-app" data-spot-item onClick={() => launch(id)}>
                    <span className="spot-app__icon">
                      <PhoneIcon id={id} />
                    </span>
                    <span className="spot-app__name">{PHONE[id].label}</span>
                  </button>
                ))}
              </div>
            </Group>
            <Group title="Try Searching For">
              {TRY.map((text) => (
                <button
                  key={text}
                  type="button"
                  className="spot-row spot-row--try"
                  data-spot-item
                  aria-label={`Search for ${text}`}
                  onClick={() => {
                    setQuery(text)
                    setAt(-1)
                    input.current?.focus({ preventScroll: true })
                  }}
                >
                  <span className="spot-row__lead">
                    <span className="spot-glyph">
                      <Search size={16} strokeWidth={2.6} aria-hidden />
                    </span>
                  </span>
                  <span className="spot-row__text">
                    <span className="spot-row__title">{text}</span>
                  </span>
                  <ArrowUpLeft className="spot-row__fill" size={18} strokeWidth={2.2} aria-hidden />
                </button>
              ))}
            </Group>
          </>
        ) : first ? (
          <div className="spot-found" role="region" aria-label="Results" aria-live="polite">
            {found.top && (
              <Group title="Top Hit">
                <Row hit={found.top} top />
              </Group>
            )}
            {found.groups.map((group) => (
              <Group key={group.id} title={group.title} icon={group.icon}>
                {group.hits.map((hit) => (
                  <Row key={hit.key} hit={hit} />
                ))}
              </Group>
            ))}
          </div>
        ) : (
          <div className="spot-none" role="status">
            <b>No Results</b>
            <span>for “{query.trim()}”</span>
          </div>
        )}
      </div>
      <div className="spot-foot">
        <label className="spot-field">
          <Search size={18} strokeWidth={2.4} className="spot-field__glass" aria-hidden />
          <input
            ref={input}
            className="spot-input"
            type="text"
            inputMode="search"
            enterKeyHint="search"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder="Search"
            aria-label="Search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setAt(-1)
            }}
            onKeyDown={onFieldKey}
          />
          {query && (
            <button
              type="button"
              className="spot-field__clear"
              aria-label="Clear search"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setQuery('')
                setAt(-1)
                input.current?.focus({ preventScroll: true })
              }}
            >
              <X size={11} strokeWidth={3.2} aria-hidden />
            </button>
          )}
        </label>
        <button type="button" className="spot-close" aria-label="Close search" onClick={close}>
          <X size={20} strokeWidth={2.4} aria-hidden />
        </button>
      </div>
    </div>
  )
}
