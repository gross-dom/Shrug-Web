import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { ArrowUpLeft, AtSign, LayoutGrid, Lightbulb, MessageCircle, Search, X } from 'lucide-react'
import { chat } from '../apps/chat'
import { ConversationAvatar, GROUP_NAME, PersonAvatar } from '../apps/chat-ui'
import { ALL, CompanyLogo, hostOf } from '../apps/portfolio-ui'
import { showInGroup } from '../apps/state'
import { arrived, DROPS, MEDIA } from '../data/drops'
import { EGGS, lastWords } from '../data/eggs'
import { answerWords, FAQS } from '../data/faqs'
import { PEOPLE } from '../data/people'
import { VERTICALS } from '../data/portfolio'
import { DRAFT, reach, SITE } from '../data/site'
import { APPS } from '../os/apps'
import { useStore } from '../os/store'
import { OnePagerIcon, PhoneIcon } from './icons'
import { DOCKED, ON_HOME, PHONE } from './apps'
import { contactsFor, conversationView, FAQS_FOLDER, GROUP_VIEW, mediaView, noteView } from './apps/routes'
import { launch, launchAt, showSpotlight, sys, type PhoneApp } from './system'
import '../styles/phone/spotlight.css'

/** The names more than one company has. */
const shared = new Set(ALL.map((c) => c.name).filter((name, i, all) => all.indexOf(name) !== i))

// Search, over the Home Screen, as Spotlight: a field at the foot of the
// screen, the apps suggested before anything is typed, and then everything on
// the site that matches, grouped by the app it lives in. Choosing a result
// opens that app at that place.
//
// It answers to the site's own nouns and to what a visitor is likely to type:
// an app by either of its names (Contacts is the Portfolio, Notes the FAQs) and
// by the words for what it holds; the one-pager; and
// the words for getting hold of Shrug (contact, email, pitch), which find the
// way there is (`reach` in src/data/site.ts). A search that finds nothing
// still leaves two things to press.

// ---- What matches ----

type Kind = 'app' | 'reach' | 'person' | 'company' | 'faq' | 'drop'

interface Hit {
  key: string
  kind: Kind
  /** How good a match it is: lower is better. Names that start with what was typed come first. */
  score: number
  /** Its picture, at a size. */
  lead: (size: number) => ReactNode
  title: ReactNode
  subtitle?: ReactNode
  /** Opens it: an app at a place, or, for a link out of the site, the link. */
  open: () => void
  /** Where it goes, if that is out of the site. It is drawn as a link then, and opens as one. */
  href?: string
  /** Never the Top Hit while anything else was found: something Shrug has yet to supply. */
  shy?: boolean
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

/** The best `rank` among several names, or -1 if none answers. */
const best = (names: string[], q: string) => names.reduce((least, name) => ((r) => (r >= 0 && (least < 0 || r < least) ? r : least))(rank(name, q)), -1)

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

/** A glyph on a disc of glass, for a row that is a thing to do and not a place. */
const glyph = (icon: ReactNode) => (size: number) => (
  <span className="spot-glyph" style={{ width: size, height: size }}>
    {icon}
  </span>
)

/** What has arrived from a drop, in words. Only what has arrived is counted; with the editor's view
 * (`?draft`) a drop with nothing yet says so, and otherwise it is just a drop. */
function mediaOf(drop: string) {
  const photos = arrived('photo', drop)
  const videos = arrived('video', drop)
  const said = [photos && `${photos} photo${photos === 1 ? '' : 's'}`, videos && `${videos} video${videos === 1 ? '' : 's'}`].filter(Boolean)
  return said.length ? said.join(', ') : DRAFT ? 'Drop · nothing supplied yet' : 'Drop'
}

/** The apps, in the order the Home Screen has them: the Dock's, then the rest. */
const APP_ORDER: PhoneApp[] = [...DOCKED, ...ON_HOME]

/** The site's own word for what an app is, where that is neither of its names (the one here, the one
 * on the desktop): it counts as a name. Drops are what VIP holds, and the site says "drops" throughout. */
const NOUN: Partial<Record<PhoneApp, string[]>> = { photos: ['drops'], messages: ['chat'], terminal: ['terminal'] }

/** What else each app answers to, a little less surely: the words for what it holds. */
const ALSO: Record<PhoneApp, string[]> = {
  messages: ['group chat', 'testimonials', 'what people say', 'replies', 'texts'],
  finder: ['portfolio', 'companies', 'backed', 'investments', 'startups'],
  notes: ['faq', 'faqs', 'questions', 'answers'],
  photos: ['photos', 'videos', 'merch'],
  terminal: ['access', 'case study'],
}

/** What the one-pager answers to besides its name. */
const ONE_PAGER = { names: ['one-pager', 'one pager', 'onepager'], words: ['deck', 'summary', 'overview', 'pdf', 'docsend', 'memo'] }

/** What someone types who wants to get hold of Shrug. */
const REACH = ['contact', 'get in touch', 'touch', 'email', 'e-mail', 'mail', 'reach', 'reach out', 'pitch', 'apply', 'application', 'intro', 'introduction', 'talk', 'call', 'phone', 'meet', 'meeting', 'hello', 'submit', 'raise', 'raising', 'fundraise', 'fundraising']

/** A group shows this many at most. */
const MOST = 4

/** Follows a link out of the site: a page in a tab of its own, a mail or a text in the app that sends them. */
function follow(href: string) {
  if (/^https?:/i.test(href)) window.open(href, '_blank', 'noopener,noreferrer')
  else window.location.href = href
}

const onePager = (key: string, score: number, title: ReactNode): Hit => ({
  key,
  kind: 'app',
  score,
  lead: (size) => (
    <span className="spot-tile" style={{ width: size, height: size }}>
      <OnePagerIcon />
    </span>
  ),
  title,
  subtitle: hostOf(SITE.onePager),
  href: SITE.onePager,
  open: () => follow(SITE.onePager),
})

/** The way to Shrug there is today (src/data/site.ts): an email, a text, or with neither the one-pager. */
function toShrug(key: string, score: number): Hit {
  const way = reach()
  return {
    key,
    kind: 'reach',
    score,
    lead: glyph(<AtSign size={18} strokeWidth={2.4} aria-hidden />),
    title: 'Get in Touch',
    subtitle: way.kind === 'doc' ? 'Start with the one-pager' : way.label,
    href: way.href,
    open: () => follow(way.href),
  }
}

const askInMessages = (): Hit => ({
  key: 'ask',
  kind: 'person',
  score: 0,
  lead: glyph(<MessageCircle size={18} strokeWidth={2.4} aria-hidden />),
  title: 'Ask in Messages',
  subtitle: GROUP_NAME,
  open: () => launchAt('messages', [GROUP_VIEW]),
})

function find(raw: string, replied: number): Found {
  const q = raw.trim().toLowerCase()
  if (!q) return { top: null, groups: [] }
  const byScore = (a: Hit, b: Hit) => a.score - b.score

  // An app answers to its name here, to its name on the desktop, to the site's own word for it, and (a little less surely) to the words for what it holds
  const apps: Hit[] = []
  APP_ORDER.forEach((id) => {
    const { name, blurb } = APPS[id]
    const named = best([PHONE[id].label, name, ...(NOUN[id] ?? [])], q)
    const word = named < 0 && q.length >= 2 ? best(ALSO[id], q) : -1
    const also = word >= 0 && word <= 2 ? word : -1
    const said = named < 0 && also < 0 ? rank(blurb, q) : -1
    if (named < 0 && also < 0 && said < 0) return
    // Under its name: the name it has on the desktop where that is another one, and what it is
    const line = name !== PHONE[id].label && name !== blurb ? `${name} · ${blurb}` : blurb
    apps.push({ key: `app:${id}`, kind: 'app', score: named >= 0 ? named : also >= 0 ? 1.5 + also : 4 + said, lead: tile(id), title: <Marked text={PHONE[id].label} q={q} />, subtitle: <Marked text={line} q={q} />, open: () => launch(id) })
  })
  // The one-pager is on the Home Screen among the apps, and is found among them
  {
    const named = best(['One-pager', ...ONE_PAGER.names], q)
    const word = named < 0 && q.length >= 3 ? best(ONE_PAGER.words, q) : -1
    if (named >= 0 || (word >= 0 && word <= 1)) apps.push(onePager('link:one-pager', named >= 0 ? named : 1.25 + word, <Marked text="One-pager" q={q} />))
  }

  // The words for getting hold of Shrug: the whole of one, or (four letters in) the start of one
  const reaching: Hit[] = []
  {
    const word = best(REACH, q)
    if (word === 0 || (word === 1 && q.length >= 4)) reaching.push(toShrug('reach', word === 0 ? 0.75 : 2.25))
  }

  const people: Hit[] = []
  // The conversation everyone is in
  {
    const named = rank(GROUP_NAME, q)
    if (named >= 0) people.push({ key: 'group', kind: 'person', score: named, lead: (size) => <ConversationAvatar conversation="group" size={size} />, title: <Marked text={GROUP_NAME} q={q} />, subtitle: `${PEOPLE.length} people`, open: () => launchAt('messages', [GROUP_VIEW]) })
  }
  // Only those who have replied so far: what someone has yet to say is not there to be found
  PEOPLE.slice(0, replied).forEach((person, i) => {
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
      // Their reply is in the group (Testimonials) and nowhere else: the group opens on it
      open: () => {
        showInGroup(i)
        launchAt('messages', [GROUP_VIEW])
      },
    })
  })
  // The other conversations in Messages, by who they are with
  EGGS.forEach((egg) => {
    const named = rank(egg.name, q)
    if (named < 0) return
    people.push({
      key: `egg:${egg.id}`,
      kind: 'person',
      score: named,
      lead: (size) => <ConversationAvatar conversation={egg.id} size={size} />,
      title: <Marked text={egg.name} q={q} />,
      subtitle: lastWords(egg),
      open: () => launchAt('messages', [conversationView(egg.id)]),
    })
  })

  const companies: Hit[] = []
  ALL.forEach((company) => {
    const named = rank(company.name, q)
    const field = named < 0 ? rank(company.vertical, q) : -1
    const described = named < 0 && field < 0 && !!company.blurb && company.blurb.toLowerCase().includes(q)
    if (named < 0 && field < 0 && !described) return
    companies.push({
      key: `company:${company.key}`,
      kind: 'company',
      score: named >= 0 ? named : field >= 0 ? 4 + field : 9,
      lead: (size) => <CompanyLogo company={company} size={size} />,
      title: <Marked text={company.name} q={q} />,
      // Two companies share a name: for them the line under it is their address, which tells them apart
      subtitle: described ? <Marked text={around(company.blurb!, q)} q={q} /> : shared.has(company.name) && company.url ? hostOf(company.url) : <Marked text={company.vertical} q={q} />,
      open: () => launchAt('finder', contactsFor(company.key)),
    })
  })

  // Asking for a kind of thing by its name ("faqs", "drops") finds all of that kind
  const kindOf = (...names: string[]) => q.length >= 3 && names.some((name) => name.startsWith(q))

  const faqs: Hit[] = []
  const anyFaq = kindOf('faqs', 'questions', 'notes')
  FAQS.forEach((faq, i) => {
    const asked = rank(faq.question, q)
    const words = faq.answer ? answerWords(faq.answer) : ''
    const answered = asked < 0 && words.toLowerCase().includes(q)
    if (asked < 0 && !answered && !anyFaq) return
    faqs.push({
      key: `faq:${i}`,
      kind: 'faq',
      score: asked >= 0 ? asked : answered ? 9 : 10,
      lead: tile('notes'),
      title: <Marked text={faq.question} q={q} />,
      subtitle: answered ? <Marked text={around(words, q)} q={q} /> : 'Note',
      open: () => launchAt('notes', [FAQS_FOLDER, noteView(i)]),
    })
  })

  const drops: Hit[] = []
  const anyDrop = kindOf('drops', 'albums')
  DROPS.forEach((drop) => {
    const named = rank(drop, q)
    if (named < 0 && !anyDrop) return
    // A drop nothing has arrived for yet is found, but is not what search puts first. It opens as the first of its
    // photos and videos, in the viewer, over the library
    const first = MEDIA.findIndex((slot) => slot.drop === drop)
    drops.push({ key: `drop:${drop}`, kind: 'drop', score: named >= 0 ? named : 10, shy: arrived(undefined, drop) === 0, lead: tile('photos'), title: <Marked text={drop} q={q} />, subtitle: mediaOf(drop), open: () => launchAt('photos', first < 0 ? [] : [mediaView(first)]) })
  })

  const lists: Record<Kind, Hit[]> = { app: apps.sort(byScore), reach: reaching, person: people.sort(byScore), company: companies.sort(byScore), faq: faqs.sort(byScore), drop: drops.sort(byScore) }
  const all = Object.values(lists).flat()

  // The best of them all, if it is a name that what was typed begins (or begins a word of). Level, the
  // site's own things come first: an app, the way to Shrug, then what is in the apps
  let top: Hit | null = null
  for (const kind of ['app', 'reach', 'person', 'company', 'faq', 'drop'] as Kind[]) {
    const eligible = lists[kind].find((hit) => !(hit.shy && all.some((other) => !other.shy)))
    if (eligible && eligible.score <= 2 && (!top || eligible.score < top.score)) top = eligible
  }
  const rest = (kind: Kind) => lists[kind].filter((hit) => hit !== top).slice(0, MOST)

  const icon = (id: PhoneApp) => <PhoneIcon id={id} />
  const groups: Found['groups'] = [
    { id: 'app' as const, title: 'Apps', icon: <LayoutGrid size={16} strokeWidth={2.4} />, hits: rest('app') },
    { id: 'reach' as const, title: 'Suggestions', icon: <Lightbulb size={16} strokeWidth={2.4} />, hits: rest('reach') },
    { id: 'person' as const, title: PHONE.messages.label, icon: icon('messages'), hits: rest('person') },
    { id: 'company' as const, title: PHONE.finder.label, icon: icon('finder'), hits: rest('company') },
    { id: 'faq' as const, title: PHONE.notes.label, icon: icon('notes'), hits: rest('faq') },
    { id: 'drop' as const, title: PHONE.photos.label, icon: icon('photos'), hits: rest('drop') },
  ].filter((group) => group.hits.length > 0)
  return { top, groups }
}

/** Things to type, to see what search finds: a person, a company, a vertical and a word from a question. */
const TRY = [PEOPLE[0]!.name, (ALL.find((c) => c.name === 'Anduril') ?? ALL[0]!).name, VERTICALS[0]!.name, 'drops']

/** What is still there to press when a search finds nothing: the short version of Shrug, and the conversation. */
const INSTEAD: Hit[] = [onePager('instead:one-pager', 0, 'One-pager'), askInMessages()]

// ---- What it looks like ----

/** One thing found. The keyboard stays in the field (the arrow keys walk these from there), so a row
 * is an option of the field's list and not a stop of its own for Tab. */
function Row({ hit, top, onLeave }: { hit: Hit; top?: boolean; onLeave: () => void }) {
  const inside = (
    <>
      <span className="spot-row__lead">{hit.lead(top ? 52 : 40)}</span>
      <span className="spot-row__text">
        <span className="spot-row__title">{hit.title}</span>
        {hit.subtitle && <span className="spot-row__sub">{hit.subtitle}</span>}
      </span>
    </>
  )
  if (hit.href) {
    const page = /^https?:/i.test(hit.href)
    return (
      // A link out of the site is a link: it can be opened in a tab of its own, copied, or followed. Search closes behind it
      <a className="spot-row" role="option" aria-selected={false} tabIndex={-1} data-top={top || undefined} data-spot-item href={hit.href} {...(page ? { target: '_blank', rel: 'noopener noreferrer' } : null)} onClick={onLeave}>
        {inside}
        {page && <span className="sr-only">, opens in a new tab</span>}
      </a>
    )
  }
  return (
    <button type="button" className="spot-row" role="option" aria-selected={false} tabIndex={-1} data-top={top || undefined} data-spot-item onClick={hit.open}>
      {inside}
    </button>
  )
}

function Group({ title, icon, children }: { title: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <div className="spot-group" role="group" aria-label={title}>
      {/* The group is named for a screen reader by its label; this is that name for the eye */}
      <div className="spot-group__head" aria-hidden>
        {icon && <span className="spot-group__icon">{icon}</span>}
        {title}
      </div>
      <div className="spot-card" role="presentation">
        {children}
      </div>
    </div>
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
  /** Where a finger came down on the results (`from`), and whether they were at their top then: a pull down from there closes search. */
  const pull = useRef<{ from: number; top: boolean } | null>(null)
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

  const replied = useStore(chat, (c) => c.replied)
  const found = useMemo(() => find(query, replied), [query, replied])
  const typed = query.trim().length > 0
  const first = found.top ?? found.groups[0]?.hits[0] ?? null
  /** How many things were found, as the list shows them. */
  const count = (found.top ? 1 : 0) + found.groups.reduce((sum, group) => sum + group.hits.length, 0)
  const close = () => showSpotlight(false)

  const items = () => [...(root.current?.querySelectorAll<HTMLElement>('[data-spot-item]') ?? [])]

  // The result the arrow keys are on is marked, named to assistive tech, and kept in view
  useLayoutEffect(() => {
    const list = items()
    list.forEach((el, i) => {
      el.id = `spot-item-${i}`
      el.toggleAttribute('data-active', i === at)
      el.setAttribute('aria-selected', String(i === at))
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
      else {
        first!.open()
        // A link has gone to a tab of its own: search has done its work here
        if (first!.href) close()
      }
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
      {/* The ground behind: a tap on it closes search, as it does on an iPhone, and so does a pull down on what is
          found. The button that says so by name is after the field, for a keyboard and a screen reader */}
      <div className="spot-away" aria-hidden onClick={close} />
      <div
        className="spot-scroll"
        // A tap on the bare ground between results closes it, as a tap on the wallpaper does
        onClick={(e) => (e.target === e.currentTarget || (e.target as HTMLElement).id === 'spot-list') && close()}
        onTouchStart={(e) => (pull.current = { from: e.touches[0]!.clientY, top: e.currentTarget.scrollTop <= 0 })}
        // Dragging the results puts the keyboard away, as it does on an iPhone. A drag, not a tap whose finger shook
        onTouchMove={(e) => {
          if (pull.current && Math.abs(e.touches[0]!.clientY - pull.current.from) > 10 && document.activeElement === input.current) input.current?.blur()
        }}
        // Pulled down from its top, the list goes back where it came from: search closes
        onTouchEnd={(e) => {
          const began = pull.current
          pull.current = null
          if (began?.top && e.changedTouches[0]!.clientY - began.from > 96 && e.currentTarget.scrollTop <= 0) close()
        }}
        onTouchCancel={() => (pull.current = null)}
      >
        {typed && !first && (
          <div className="spot-none">
            <b>No Results</b>
            <span>for “{query.trim()}”</span>
          </div>
        )}
        {/* Everything there is to choose, as the list the field belongs to: suggestions before anything is typed, then what was found */}
        <div id="spot-list" className="spot-found" role="listbox" aria-label={typed && first ? 'Results' : 'Suggestions'}>
          {!typed ? (
            <>
              <Group title="Siri Suggestions">
                <div className="spot-apps" role="presentation">
                  {APP_ORDER.map((id) => (
                    <button key={id} type="button" className="spot-app" role="option" aria-selected={false} tabIndex={-1} data-spot-item onClick={() => launch(id)}>
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
                    role="option"
                    aria-selected={false}
                    tabIndex={-1}
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
            <>
              {found.top && (
                <Group title="Top Hit">
                  <Row hit={found.top} top onLeave={close} />
                </Group>
              )}
              {found.groups.map((group) => (
                <Group key={group.id} title={group.title} icon={group.icon}>
                  {group.hits.map((hit) => (
                    <Row key={hit.key} hit={hit} onLeave={close} />
                  ))}
                </Group>
              ))}
            </>
          ) : (
            // Nothing found is not the end of the road: the short version of Shrug, and the conversation
            <Group title="Suggestions" icon={<Lightbulb size={16} strokeWidth={2.4} />}>
              {INSTEAD.map((hit) => (
                <Row key={hit.key} hit={hit} onLeave={close} />
              ))}
            </Group>
          )}
        </div>
      </div>
      {/* What a screen reader is told as the list changes: how much was found, not all of it over again */}
      <div className="sr-only" role="status" aria-live="polite">
        {!typed ? '' : !first ? `No results for ${query.trim()}` : `${count} result${count === 1 ? '' : 's'}`}
      </div>
      <div className="spot-foot">
        <label className="spot-field">
          <Search size={18} strokeWidth={2.4} className="spot-field__glass" aria-hidden />
          <input
            ref={input}
            className="spot-input"
            type="text"
            role="combobox"
            aria-expanded
            aria-controls="spot-list"
            aria-autocomplete="list"
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
          {/* What Return will do with what has been typed, written after it in the field as Spotlight writes it */}
          {typed && first && at < 0 && query.length <= 18 && (
            <span className="spot-hint" aria-hidden>
              <span className="spot-hint__typed">{query}</span>
              <span className="spot-hint__does">— Open</span>
            </span>
          )}
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
        {/* Out of sight until it has the keyboard: a finger closes search on the ground behind it */}
        <button type="button" className="spot-close" onClick={close}>
          Close Search
        </button>
      </div>
    </div>
  )
}
