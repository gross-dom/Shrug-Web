import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { Check, Search, UserRound, X } from 'lucide-react'
import { companiesIn, companyKeyed, fateOf, hostOf, tellApart, useLogo, type Listed } from '../../apps/portfolio-ui'
import { sought } from '../../apps/state'
import { LOGO_COLOURS, PLAIN_PAGE, POSTER_COLOURS } from '../../data/logoColours'
import { COMPANY_COUNT, VERTICALS, type Company } from '../../data/portfolio'
import { ABOUT, reach, reachable, SITE } from '../../data/site'
import { LogoDisc } from '../../os/icons'
import { linkTo } from '../../os/place'
import { useStore } from '../../os/store'
import type { Ground, Tone } from '../chrome'
import { haptic, share } from '../native'
import { push, sys, topOf } from '../system'
import { Empty, GlassButton, List, NavStack, Screen, SearchBar, Section, ShareGlyph, usePageHeadingId } from '../ui'
import { companyOf, companyView, MY_CARD } from './routes'
import '../../styles/phone/contacts.css'

// The portfolio as the Contacts app. The desktop's window is a Finder; on an
// iPhone the companies are kept the way Contacts keeps people: one list, in
// sections, each company a row under its own logo, with an index of letters
// down the edge to slide a finger along. Where Contacts has a section to a
// letter, this has one to a vertical, and the letters are the verticals': a
// vertical is filed under the letter its name begins with, the sections run
// in that order as everything in Contacts does, and what is called Other
// comes last under #, where Contacts keeps whatever no letter claims. Inside a
// vertical the companies keep the order Shrug gives them in.
//
// A company opens as a contact's card does, pushed over the list: a page in
// the colour of its picture, the picture and the name at its head, the things
// to do with it in a row of round buttons (its site, passing it on), and what
// is known about it on panes under those. The picture is the company's logo in
// a round face, or, for a company with one to show, a photograph that fills
// the head of the card as a contact's poster does. At the head of the list is
// Shrug's own card, where an iPhone keeps My Card. Search is at the foot.

// ---- The verticals, filed ----

/** A vertical as the list files it. */
interface Group {
  name: string
  /** What it is filed under: the first letter of its name, or # for what is called Other. */
  letter: string
  companies: Listed[]
  /** Its section's id on the page. */
  id: string
}

/** The vertical that is everything else: it goes last, as "everything else" does. */
const EVERYTHING_ELSE = 'Other'

/** A name as it is put in order: from its first letter or figure on (one of the verticals opens with a quotation mark). */
const filedAs = (name: string) => name.normalize('NFKD').replace(/^[^A-Za-z0-9]+/, '')

const letterOf = (name: string) => (name === EVERYTHING_ELSE ? '#' : (filedAs(name).match(/[A-Za-z]/)?.[0]?.toUpperCase() ?? '#'))

const GROUPS: Group[] = VERTICALS.map((v, i) => ({ name: v.name, letter: letterOf(v.name), companies: v.companies, id: `contacts-v${i}` })).sort(
  (a, b) => Number(a.letter === '#') - Number(b.letter === '#') || filedAs(a.name).localeCompare(filedAs(b.name), 'en', { sensitivity: 'base' }),
)

/** The index down the edge: every letter, as Contacts has them, and # at its foot. */
const LETTERS = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', '#']

/** The letters something is filed under. */
const FILED = LETTERS.filter((letter) => GROUPS.some((group) => group.letter === letter))

/** The vertical a letter brings up: the first filed under it, or, for a letter with none, the next there is after it. */
function groupAt(letter: string) {
  for (let i = Math.max(0, LETTERS.indexOf(letter)); i < LETTERS.length; i++) {
    const found = GROUPS.findIndex((group) => group.letter === LETTERS[i])
    if (found >= 0) return found
  }
  return GROUPS.length - 1
}

/** What a letter is, said aloud: the verticals filed under it. */
const filedUnder = (letter: string) =>
  GROUPS.filter((group) => group.letter === letter)
    .map((group) => group.name)
    .join(', ')

// ---- The index ----

/** The letters down the trailing edge. A finger put on it, or slid along it, brings up the vertical filed
 * under the letter it is on; with a keyboard it is one stop, and the arrows walk the letters that have
 * something under them. */
function Index({ jump }: { jump: (group: number) => void }) {
  const rail = useRef<HTMLElement>(null)
  /** The letter the finger was last on, so that a slide ticks once for each. */
  const on = useRef<string | null>(null)
  /** When a finger or a pointer last came down on the index. */
  const touched = useRef(-Infinity)
  const [stop, setStop] = useState(FILED[0]!)

  /** The letter under a point: the nearest of those that are drawn (a short screen shows only the ones with something under them). */
  const letterAt = (y: number) => {
    const drawn = Array.from(rail.current?.children ?? []).filter((el): el is HTMLElement => el instanceof HTMLElement && el.getClientRects().length > 0)
    if (!drawn.length) return null
    const found = drawn.find((el) => y < el.getBoundingClientRect().bottom) ?? drawn[drawn.length - 1]!
    return found.dataset.letter ?? null
  }

  const slide = (e: PointerEvent) => {
    const letter = letterAt(e.clientY)
    if (!letter || letter === on.current) return
    on.current = letter
    haptic()
    jump(groupAt(letter))
  }

  // A letter is also a button, for a keyboard and for assistive tech, which press it without a pointer.
  // A press that came with one has been answered already, where the finger actually was: a browser that
  // gives a tap to the nearest thing that can be pressed would otherwise answer it again as the letter next door
  const click = (letter: string) => () => {
    if (performance.now() - touched.current > 700) jump(groupAt(letter))
  }

  const onKey = (e: KeyboardEvent) => {
    const at = FILED.indexOf(stop)
    const to = e.key === 'ArrowDown' ? at + 1 : e.key === 'ArrowUp' ? at - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? FILED.length - 1 : -1
    if (to < 0 || to >= FILED.length || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return
    e.preventDefault()
    const letter = FILED[to]!
    setStop(letter)
    rail.current?.querySelector<HTMLElement>(`[data-letter="${letter}"]`)?.focus()
    jump(groupAt(letter))
  }

  return (
    <nav
      ref={rail}
      className="contacts-index"
      aria-label="Verticals, by letter"
      onPointerDown={(e) => {
        // The finger keeps the index for as long as it is down, wherever it slides to
        e.currentTarget.setPointerCapture?.(e.pointerId)
        touched.current = performance.now()
        on.current = null
        slide(e)
      }}
      onPointerMove={(e) => {
        if (e.currentTarget.hasPointerCapture?.(e.pointerId)) slide(e)
      }}
      onPointerUp={() => (on.current = null)}
      onPointerCancel={() => (on.current = null)}
      onKeyDown={onKey}
    >
      {LETTERS.map((letter) =>
        FILED.includes(letter) ? (
          <button key={letter} type="button" className="contacts-index__letter" data-letter={letter} tabIndex={letter === stop ? 0 : -1} aria-label={`${letter === '#' ? 'Everything else' : letter}: ${filedUnder(letter)}`} onFocus={() => setStop(letter)} onClick={click(letter)}>
            {letter}
          </button>
        ) : (
          // A letter with nothing under it is there to be slid over, as it is in Contacts: it brings up the next that has
          <span key={letter} className="contacts-index__letter" data-letter={letter} data-empty="" aria-hidden>
            {letter}
          </span>
        ),
      )}
    </nav>
  )
}

// ---- The list ----

/** A company's face: round, as every face in Contacts is. Its logo sits inside the circle on the ground the
 * logo is drawn on (so that the circle cuts nothing off it), or fills it where the logo is a picture that
 * runs to its own edges; a company with no logo is its initial, as a contact with no photo is. `eager`
 * asks for the logo at once, for the face at the head of a card. */
function Face({ company, size, eager }: { company: Listed; size?: number; eager?: boolean }) {
  const logo = useLogo(company)
  const ground = company.logo ? (LOGO_COLOURS[company.logo]?.ground ?? null) : null
  return (
    <span className="contact-face" data-empty={logo ? undefined : ''} data-full={logo && !ground ? '' : undefined} style={{ ...(size ? { width: size, height: size, fontSize: Math.round(size * 0.45) } : null), ...(logo && ground ? { background: ground } : null) }} aria-hidden>
      {/* Small and already fetched (portfolio-ui.tsx warms them): drawn with the row, not a frame after it */}
      {logo ? <img src={eager && company.logoLarge ? `${import.meta.env.BASE_URL}logos/large/${company.logoLarge}` : logo.src} alt="" loading={eager ? 'eager' : 'lazy'} decoding="sync" draggable={false} onError={logo.onError} /> : company.name.trim()[0]?.toUpperCase()}
    </span>
  )
}

/** A company's row: its face and its name. `where` adds the vertical it is in, for a row that is not under
 * its vertical's heading. `stop` is the row Tab stops on (the arrows walk the rest: see the list). */
function Row({ company, where, stop, onStop }: { company: Listed; where?: string; stop: boolean; onStop: (key: string) => void }) {
  // Two companies can have one name: each says which it is, by its address
  const apart = tellApart(company)
  const under = [apart, where].filter(Boolean).join(' · ')
  return (
    <li>
      <button type="button" className="contacts-row" data-company={company.key} tabIndex={stop ? 0 : -1} onFocus={() => onStop(company.key)} onClick={() => push(companyView(company.key))}>
        <Face company={company} size={40} />
        <span className="contacts-row__text">
          <span className="contacts-row__name" dir="auto">
            {company.name}
          </span>
          {under && (
            <span className="contacts-row__where">
              <span className="sr-only">, </span>
              {under}
            </span>
          )}
        </span>
      </button>
    </li>
  )
}

/** How many, in words. */
const countOf = (n: number) => `${n} ${n === 1 ? 'Company' : 'Companies'}`

/** Every company, a section to a vertical, with Shrug's own card at the head and search at the foot. */
function ListScreen() {
  const scroll = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const leaving = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => () => clearTimeout(leaving.current), [])
  const searching = focused || query !== ''
  const found = useMemo(() => (query.trim() ? companiesIn(-1, query) : null), [query])
  // With a keyboard the companies are one stop, not eighty-one: Tab comes to the row last on (the first,
  // at first), and the arrows, Home and End walk the rest, across the verticals
  const [last, setLast] = useState(GROUPS[0]!.companies[0]!.key)
  const stop = found && !found.some((company) => company.key === last) ? (found[0]?.key ?? last) : last
  const onRowsKey = (e: KeyboardEvent) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return
    const rows = Array.from(scroll.current?.querySelectorAll<HTMLElement>('[data-company]') ?? [])
    const at = rows.indexOf(document.activeElement as HTMLElement)
    if (at < 0) return
    e.preventDefault()
    rows[e.key === 'ArrowDown' ? Math.min(rows.length - 1, at + 1) : e.key === 'ArrowUp' ? Math.max(0, at - 1) : e.key === 'Home' ? 0 : rows.length - 1]?.focus()
  }

  const cancel = () => {
    clearTimeout(leaving.current)
    setQuery('')
    setFocused(false)
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
  }

  /** How far down the page the bar comes: what scrolls is clear of it by its own padding. */
  const barOf = (page: HTMLElement) => parseFloat(getComputedStyle(page).paddingTop) || 0

  /** Brings a vertical's heading to the top of the page, under the bar. (Places are the page's own, as
   * it is laid out: they hold while the phone is drawn smaller than life, or is still growing out of an icon.) */
  const jump = (group: number) => {
    const page = scroll.current
    const section = page?.querySelector<HTMLElement>(`#${GROUPS[group]!.id}`)
    if (page && section) page.scrollTop = section.offsetTop - barOf(page)
  }

  // A card that is come to from outside the app (search on the Home Screen, the folder there, a link) is
  // over a list that was not pressed: the list is brought to the company, so that Back leads to it among
  // its own. One opened from its own row is already in sight, and nothing moves.
  const over = useStore(sys, (s) => companyOf(topOf(s, 'finder')))
  useLayoutEffect(() => {
    const page = scroll.current
    if (!over || !page || !page.clientHeight) return
    const row = Array.from(page.querySelectorAll<HTMLElement>('[data-company]')).find((el) => el.dataset.company === over)
    if (!row) return
    // In sight already: under the bar and the heading that stays there, and over the search field
    const top = row.offsetTop - page.scrollTop
    if (top >= barOf(page) + 30 && top + row.offsetHeight <= page.clientHeight - 96) return
    page.scrollTop = row.offsetTop + row.offsetHeight / 2 - page.clientHeight / 2
  }, [over])

  return (
    <Screen
      title="Contacts"
      className="contacts-screen"
      scrollRef={scroll}
      edge={found ? undefined : <Index jump={jump} />}
      foot={
        <>
          <SearchBar
            value={query}
            onChange={setQuery}
            label="Search the portfolio"
            onFocus={() => {
              clearTimeout(leaving.current)
              setFocused(true)
            }}
            // A press on the button that ends the search takes the keyboard from the field first: the button stays until the press has landed
            onBlur={() => (leaving.current = setTimeout(() => setFocused(false), 180))}
          />
          {searching && (
            <GlassButton label="Cancel" onClick={cancel}>
              <X size={21} strokeWidth={2.4} aria-hidden />
            </GlassButton>
          )}
        </>
      }
    >
      {found ? (
        found.length ? (
          <>
            <ul className="contacts-rows contacts-rows--found" onKeyDown={onRowsKey}>
              {found.map((company) => (
                <Row key={company.key} company={company} where={company.vertical} stop={company.key === stop} onStop={setLast} />
              ))}
            </ul>
            <p className="contacts-count">{countOf(found.length)}</p>
          </>
        ) : (
          <Empty icon={<Search size={44} strokeWidth={1.8} />} title={`No Results for “${sought(query)}”`}>
            Check the spelling or try a new search.
          </Empty>
        )
      ) : (
        <>
          {/* Shrug's own card, where Contacts keeps My Card */}
          <button type="button" className="contacts-me" onClick={() => push(MY_CARD)}>
            <LogoDisc size={40} />
            <span className="contacts-me__text">
              <span className="contacts-me__name">{SITE.legalName}</span>
              <span className="sr-only">, </span>
              <span className="contacts-me__sub">My Card</span>
            </span>
          </button>
          <div className="contacts-list" onKeyDown={onRowsKey}>
            {GROUPS.map((group) => (
              <section key={group.id} id={group.id} className="contacts-section" aria-labelledby={`${group.id}-name`}>
                <h3 id={`${group.id}-name`} className="contacts-letter">
                  {group.name}
                </h3>
                <ul className="contacts-rows">
                  {group.companies.map((company) => (
                    <Row key={company.key} company={company} stop={company.key === stop} onStop={setLast} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
          <p className="contacts-count">{countOf(COMPANY_COUNT)}</p>
        </>
      )}
    </Screen>
  )
}

// ---- A card ----

/** A link out of the site opens beside it. One that hands over to another app (mail, messages) just goes. */
const leaves = (href: string) => /^https?:/i.test(href)

// The signs on a card's round buttons, drawn solid, as the ones on a contact's card are.

/** A compass: the company's own site. */
function SiteGlyph({ size = 28 }: { size?: number }) {
  const id = useId().replace(/:/g, '')
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden>
      <mask id={id}>
        <rect width="28" height="28" fill="#fff" />
        <path d="M20.3 7.7 11.9 11.9 7.7 20.3l8.4-4.2z" fill="#000" />
        <circle cx="14" cy="14" r="1.5" fill="#fff" />
      </mask>
      <circle cx="14" cy="14" r="11.6" fill="currentColor" mask={`url(#${id})`} />
    </svg>
  )
}

/** A written page: a case study, the one-pager. */
function PageGlyph({ size = 28 }: { size?: number }) {
  const id = useId().replace(/:/g, '')
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden>
      <mask id={id}>
        <rect width="28" height="28" fill="#fff" />
        <path d="M9.8 13.2h8.4M9.8 17h8.4M9.8 20.8h5" stroke="#000" strokeWidth="1.9" strokeLinecap="round" />
      </mask>
      <path d="M8.4 2.6h7.9l6.1 6.3v14a2.9 2.9 0 0 1-2.9 2.9H8.4a2.9 2.9 0 0 1-2.9-2.9V5.5a2.9 2.9 0 0 1 2.9-2.9z" fill="currentColor" mask={`url(#${id})`} />
    </svg>
  )
}

/** Passing it on: an arrow rising out of a box. */
function PassOnGlyph({ size = 28 }: { size?: number }) {
  const id = useId().replace(/:/g, '')
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden>
      <mask id={id}>
        <rect width="28" height="28" fill="#fff" />
        <path d="M14 18V5" stroke="#000" strokeWidth="5.6" strokeLinecap="round" />
      </mask>
      <path d="M8.6 10.6h10.8a3.2 3.2 0 0 1 3.2 3.2v8.4a3.2 3.2 0 0 1-3.2 3.2H8.6a3.2 3.2 0 0 1-3.2-3.2v-8.4a3.2 3.2 0 0 1 3.2-3.2z" fill="currentColor" mask={`url(#${id})`} />
      <path d="M14 16.8V3.3M9.9 7.2 14 3.1l4.1 4.1" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** One thing to do from a card: a round pane with its sign on it, in the row a contact's card keeps under
 * the name. A link out of the site opens beside it; with nowhere to go it is drawn faint, as a contact's
 * card leaves what it cannot do, and says why (`none`). */
function Act({ label, icon, href, onClick, none }: { label: string; icon: ReactNode; href?: string | null; onClick?: () => void; none?: string | null }) {
  if (href)
    return (
      // A company's own site is told where the visit came from: `noopener`, not `noreferrer`
      <a className="contact-act" href={href} {...(leaves(href) ? { target: '_blank', rel: 'noopener' } : null)}>
        {icon}
        <span className="sr-only">
          {label}
          {leaves(href) && ', opens in a new tab'}
        </span>
      </a>
    )
  if (onClick)
    return (
      <button type="button" className="contact-act" onClick={onClick}>
        {icon}
        <span className="sr-only">{label}</span>
      </button>
    )
  return (
    <span className="contact-act" aria-disabled="true">
      {icon}
      <span className="sr-only">
        {label}: {none ?? 'none'}
      </span>
    </span>
  )
}

/** One thing a card knows: what it is, small, over what it says. One that leads somewhere is pressed
 * anywhere along its row, as a contact's number is, and carries the sign of where it leads at its end. */
function Field({ label, children, href, sign }: { label: string; children: ReactNode; href?: string | null; sign?: ReactNode }) {
  return (
    <div className="contact-field" data-link={href ? '' : undefined}>
      <dt className="contact-field__label">{label}</dt>
      <dd className="contact-field__value" dir="auto">
        {href ? (
          <a href={href} {...(leaves(href) ? { target: '_blank', rel: 'noopener' } : null)}>
            {children}
            {leaves(href) && <span className="sr-only">, opens in a new tab</span>}
          </a>
        ) : (
          children
        )}
        {href && sign && (
          <span className="contact-field__sign" aria-hidden>
            {sign}
          </span>
        )}
      </dd>
    </div>
  )
}

/** What Share put on the clipboard, where there was no share sheet to hand it to: said for a moment, then taken back. */
function useCopied() {
  const [copied, setCopied] = useState<'Link copied' | 'Copied' | null>(null)
  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(null), 1800)
    return () => clearTimeout(t)
  }, [copied])
  return [copied, setCopied] as const
}

/** How large a name is set at the head of a card: as large as a contact's (41 points) where it fits on a
 * line, and smaller the longer it is, so that a long one takes two lines and not three. */
const nameSize = (name: string) => (name.length <= 11 ? 41 : name.length <= 15 ? 35 : name.length <= 22 ? 30 : 26)

/** The head of a card: the face, and the name under it (which names the page). With a picture that fills
 * the head of the card there is no face: the name is set over the foot of the picture. */
function Head({ face, name, poster }: { face: ReactNode; name: string; poster?: boolean }) {
  const headingId = usePageHeadingId()
  return (
    // Not a <header>: outside an article that would make each card's head a banner for the whole page, which has one of its own
    <div className="contact-head" data-poster={poster ? '' : undefined}>
      {face}
      <h2 id={headingId} className="contact-head__name" style={{ fontSize: nameSize(name) }} dir="auto">
        {name}
      </h2>
    </div>
  )
}

/** A company's own picture, filling the head of its card as a contact's poster does: it runs from the top
 * of the screen down behind the name and fades into the page, which is the colour of its own foot. */
function Poster({ file }: { file: string }) {
  return (
    <div className="contact-poster" aria-hidden>
      <img src={`${import.meta.env.BASE_URL}posters/${file}`} alt="" decoding="async" draggable={false} />
    </div>
  )
}

/** The colours a picture's card falls back on until tools/logo-colours.py has read the picture. */
const UNREAD_POSTER = { top: '#1c1c1e', page: '#3a3a3c' }

/** The colour a company's card is in: its photograph's own (top and foot), where it has one, or its logo's. */
function groundOf(company: Company): Ground {
  const shot = company.poster ? (POSTER_COLOURS[company.poster] ?? UNREAD_POSTER) : null
  return shot ? { top: shot.top, foot: shot.page } : (company.logo && LOGO_COLOURS[company.logo]?.page) || PLAIN_PAGE
}

/** What Contacts is opening on, before its screens are there to say: a card's own colour, or the list's white. */
export function contactsFirst(top: string | null): { tone: Tone; ground?: Ground } {
  if (top === MY_CARD) return { tone: 'dark', ground: SHRUG_PAGE }
  const company = top ? companyKeyed(companyOf(top) ?? '') : null
  return company ? { tone: 'dark', ground: groundOf(company) } : { tone: 'plain' }
}

/** A company's card: what it is, the things to do with it, and what is known about it. */
function CompanyCard({ id }: { id: string }) {
  const company = companyKeyed(id)
  const [copied, setCopied] = useCopied()

  if (!company)
    return (
      <Screen title="No Such Company" className="contacts-screen">
        <Empty icon={<UserRound size={44} strokeWidth={1.8} />} title="Not in Contacts">
          There is no company here called “{sought(id)}”.
        </Empty>
      </Screen>
    )

  const study = !!company.url && /notion\.site/.test(company.url)
  const fate = fateOf(company)
  // A company with no site is passed on as its name and what it does, with no address: not this page's in its place
  const send = async () => {
    const sent = await share({ title: company.name, text: company.blurb ? `${company.name}: ${company.blurb}` : company.name, url: company.url ?? null })
    if (sent === 'copied') setCopied(company.url ? 'Link copied' : 'Copied')
  }
  // The card is in the colour of its picture: a photograph's own, where the company has one, or its logo's
  const poster = company.poster

  return (
    <Screen
      title={company.name}
      // A contact's card keeps its bar clear: the name is in the card
      center={<></>}
      ownHeading
      tone="dark"
      ground={groundOf(company)}
      className={`contacts-screen contacts-screen--card${poster ? ' contacts-screen--poster' : ''}`}
      trailing={
        <GlassButton label="Share" onClick={send}>
          {copied ? <Check size={22} strokeWidth={2.6} aria-hidden /> : <ShareGlyph />}
        </GlassButton>
      }
    >
      {poster && <Poster file={poster} />}
      <Head face={poster ? null : <Face company={company} eager />} name={company.name} poster={!!poster} />
      <div className="contact-acts">
        <Act label={study ? 'Case study' : 'Website'} icon={study ? <PageGlyph /> : <SiteGlyph />} href={company.url} none={fate} />
        <Act label="Share" icon={<PassOnGlyph />} onClick={send} />
      </div>
      {/* Said aloud when it happens; the buttons keep their own names */}
      <span className="sr-only" role="status">
        {copied ?? ''}
      </span>
      <List className="contact-list">
        <Section>
          <dl className="contact-fields">
            {company.url ? (
              <Field label={study ? 'case study' : 'website'} href={company.url} sign={study ? <PageGlyph size={20} /> : <SiteGlyph size={20} />}>
                {study ? 'Read the case study' : hostOf(company.url)}
              </Field>
            ) : (
              // Nowhere to send anyone: said where the link would be
              <Field label="website">
                <span className="contact-field__none">{fate}</span>
              </Field>
            )}
            <Field label="vertical">{company.vertical}</Field>
            {company.blurb && <Field label="about">{company.blurb}</Field>}
          </dl>
        </Section>
        <Section>
          <button type="button" className="contact-row" onClick={send}>
            Share Contact
          </button>
        </Section>
      </List>
    </Screen>
  )
}

/** Shrug's own card is black, as the ground of its logo is: the logo's disc runs into the page. */
const SHRUG_PAGE = '#000000'

/** Shrug's own card: who Shrug is, as the desktop's About Shrug says it, and the ways on. */
function MyCard() {
  const [copied, setCopied] = useCopied()
  const way = reachable() ? reach() : null
  const send = async () => {
    const sent = await share({ title: SITE.legalName, text: SITE.line, url: linkTo(null) })
    if (sent === 'copied') setCopied('Link copied')
  }
  return (
    <Screen
      title={SITE.legalName}
      center={<></>}
      ownHeading
      tone="dark"
      ground={SHRUG_PAGE}
      className="contacts-screen contacts-screen--card contacts-screen--mine"
      trailing={
        <GlassButton label="Share" onClick={send}>
          {copied ? <Check size={22} strokeWidth={2.6} aria-hidden /> : <ShareGlyph />}
        </GlassButton>
      }
    >
      <Head
        face={
          <span className="contact-face" data-full="" aria-hidden>
            <LogoDisc size="100%" />
          </span>
        }
        name={SITE.legalName}
      />
      <div className="contact-acts">
        <Act label="One-pager" icon={<PageGlyph />} href={SITE.onePager} />
        <Act label="Share" icon={<PassOnGlyph />} onClick={send} />
      </div>
      <span className="sr-only" role="status">
        {copied ?? ''}
      </span>
      <List className="contact-list">
        <Section>
          <dl className="contact-fields">
            <Field label="about">{SITE.line}</Field>
            {ABOUT.facts.map((fact) => (
              <Field key={fact.label} label={fact.label.toLowerCase()}>
                {fact.value}
              </Field>
            ))}
            <Field label="backs">{ABOUT.backs}</Field>
            <Field label="portfolio">
              {COMPANY_COUNT} companies in {VERTICALS.length} verticals
            </Field>
          </dl>
        </Section>
        <Section>
          <dl className="contact-fields">
            {/* A way to write to Shrug, once there is one (src/data/site.ts) */}
            {way && (
              <Field label={way.kind === 'email' ? 'email' : 'message'} href={way.href}>
                {way.label}
              </Field>
            )}
            <Field label="one-pager" href={SITE.onePager} sign={<PageGlyph size={20} />}>
              Read the one-pager
            </Field>
          </dl>
        </Section>
      </List>
    </Screen>
  )
}

// ---- The app ----

export function ContactsApp() {
  return (
    <div className="contacts-app">
      <NavStack>{(view) => (view === null ? <ListScreen /> : view === MY_CARD ? <MyCard /> : <CompanyCard id={view.startsWith('co:') ? view.slice(3) : view} />)}</NavStack>
    </div>
  )
}
