import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { flushSync } from 'react-dom'
import { ArrowUpRight, Check, Search, Share, WalletCards, X } from 'lucide-react'
import { companiesIn, companyKeyed, CompanyLogo, fateOf, hostOf, tellApart, visitLabel, type Listed } from '../../apps/portfolio-ui'
import { finder, setFinderQuery, sought } from '../../apps/state'
import { COMPANY_COUNT, VERTICALS } from '../../data/portfolio'
import { useStore } from '../../os/store'
import { share } from '../native'
import { closeSheet, openSheet, pop, push, sys } from '../system'
import { BackButton, Cell, Empty, GlassButton, List, NavStack, Screen, SearchBar, Section, Sheet, SheetHost } from '../ui'
import { cardOf, cardView, companySheet } from './routes'
import '../../styles/phone/wallet.css'

// The portfolio as the Wallet app. The desktop's window is a Finder; on an
// iPhone the portfolio is kept the way Wallet keeps cards. Each vertical is a
// card of its own colour, and the cards lie in a stack, each over the one
// before, so that what shows of a card is its name, how many companies are in
// it, and the first row of them as icons. A card that is pressed comes out of
// the stack to the top of the screen, opened to all of its companies under
// their names, while the others drop into a pile at the foot of the screen;
// the pile, Back, or the card's own heading puts it back. A company opens over
// the cards as a sheet: what it is, the link to its site (or, for one with no
// site, the line that says so where the link would be), and what is known
// about it. Search, in the corner, looks through all of them at once.
//
// The cards are one piece that rearranges itself: nothing slides in from the
// side. The card that is out is still a step in the app's stack (`v:2`), so
// the browser's Back puts it away as it would leave any other screen.

interface WalletState {
  searching: boolean
  /** Into search, with the keyboard in the field. */
  openSearch: () => void
  closeSearch: () => void
  /** How far down each screen had been scrolled when it was last showing. */
  tops: Map<string, number>
}

const WalletContext = createContext<WalletState | null>(null)
const useWallet = () => useContext(WalletContext)!

/** A screen that comes and goes (the cards, while search covers them) is scrolled where it was left. */
function useKeptScroll(id: string) {
  const { tops } = useWallet()
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (el) el.scrollTop = tops.get(id) ?? 0
    return () => {
      if (el) tops.set(id, el.scrollTop)
    }
  }, [id, tops])
  return ref
}

// ---- The cards ----

/** A card's two colours, from its top corner to its bottom one: one pair for each vertical, in the order
 * the verticals are listed in. Every one is dark enough for small white type to be read on it (at least
 * 4.5 to 1 at its paler end). There are as many as there are verticals; one added to the list takes the
 * first again. */
const TINTS: [string, string][] = [
  ['#18181b', '#3f3f46'],
  ['#0a6a3d', '#15824e'],
  ['#a8134f', '#d6336c'],
  ['#b02222', '#dc2f2f'],
  ['#a9390a', '#cc470d'],
  ['#0c3f99', '#2a6bdc'],
  ['#5a23b8', '#7c4ce8'],
  ['#0a6676', '#0e8194'],
  ['#2f2c85', '#5d58dc'],
  ['#7b500a', '#9c6a0e'],
  ['#334155', '#5f7089'],
  ['#07588a', '#1479b8'],
  ['#504b46', '#77706a'],
]

const tintOf = (vertical: number) => TINTS[vertical % TINTS.length]!

const verticalOf = (company: Listed) => Math.max(0, VERTICALS.findIndex((v) => v.name === company.vertical))

/** How many companies a card sets side by side: the first row of them is what shows of it in the stack. */
const ACROSS = 4

const rowsOf = (vertical: number) => Math.ceil(VERTICALS[vertical]!.companies.length / ACROSS)

/** How many of the other cards show in the pile at the foot of the screen while one is out. */
const PILED = 3

/** How many, in words. */
const countOf = (n: number) => `${n} ${n === 1 ? 'company' : 'companies'}`

const open = (company: Listed) => openSheet(companySheet(company.key))

/** What a company's sheet is called begins with this: the rest is the company's key. */
const COMPANY_SHEET = companySheet('')

/** Where a card is: in the stack with the rest, out of it and open, or put by while another is out
 * (in the pile at the foot of the screen, or below it with the rest). */
type Lying = 'stacked' | 'out' | 'piled' | 'away'

/** One vertical: its name and how many it holds, and its companies as icons. */
function Card({ vertical, lying, slot }: { vertical: number; lying: Lying; slot: number }) {
  const v = VERTICALS[vertical]!
  const id = useId()
  const out = lying === 'out'
  const [from, to] = tintOf(vertical)
  return (
    // A card that is put by is not there to press or to tab to: the pile is one button of its own
    <li className="wallet-slot" data-lying={lying} data-front={lying === 'piled' && slot === PILED - 1 ? '' : undefined} style={{ '--n': vertical, '--slot': slot, '--rows': rowsOf(vertical), '--from': from, '--to': to } as CSSProperties} {...(lying === 'piled' || lying === 'away' ? ({ inert: '' } as object) : null)}>
      <section className="wallet-card" aria-labelledby={`${id}-name`}>
        <h3 className="wallet-card__head">
          {/* In the stack the whole card is this button; out of it, the heading is, and puts the card back */}
          <button type="button" id={`${id}-name`} className="wallet-card__toggle" aria-expanded={out} aria-controls={`${id}-in`} onClick={() => (out ? pop() : push(cardView(vertical)))}>
            <span className="wallet-card__name">{v.name}</span>
            <span className="wallet-card__count">
              <span aria-hidden>
                <span className="wallet-card__label">{v.companies.length === 1 ? 'Company' : 'Companies'}</span>
                {v.companies.length}
              </span>
              <span className="sr-only">, {countOf(v.companies.length)}</span>
            </span>
          </button>
        </h3>
        <ul id={`${id}-in`} className="wallet-card__in" {...(out ? null : ({ inert: '' } as object))}>
          {v.companies.map((company) => {
            // Two companies can have one name: each says which it is, by its address
            const apart = tellApart(company)
            return (
              <li key={company.key}>
                <button type="button" className="wallet-co" onClick={() => open(company)}>
                  <CompanyLogo company={company} size={60} eager />
                  <span className="wallet-co__name">{company.name}</span>
                  {apart && <span className="wallet-co__where">{apart}</span>}
                </button>
              </li>
            )
          })}
        </ul>
      </section>
    </li>
  )
}

/** The cards: in their stack, or with one of them (`out`) at the top of the screen and the rest put by. */
function CardsScreen({ out }: { out: number | null }) {
  const { openSearch } = useWallet()
  const scroll = useKeptScroll('cards')
  const stack = useRef<HTMLDivElement>(null)

  // The card that is out is set against the screen, and the stack it came from against the page, which
  // may be scrolled: where the page is, where on it the stack begins and how tall the screen is are what
  // the stylesheet places the card and the pile by. All three are the page's own measures, so a phone
  // that is drawn smaller than life (in its frame, or still growing out of its icon) reads the same
  const measure = useCallback(() => {
    const page = scroll.current
    const el = stack.current
    if (!page || !el) return
    el.style.setProperty('--scrolled', `${page.scrollTop}px`)
    el.style.setProperty('--origin', `${el.offsetTop}px`)
    el.style.setProperty('--view', `${page.clientHeight}px`)
  }, [scroll])

  // Before the card that is out is drawn out: it leaves from where the stack is now
  useLayoutEffect(() => {
    if (out !== null) measure()
  }, [out, measure])

  // A phone turned on its side, a keyboard, a window resized: the screen is another height
  useEffect(() => {
    const page = scroll.current
    if (!page || typeof ResizeObserver === 'undefined') return
    const watch = new ResizeObserver(measure)
    watch.observe(page)
    return () => watch.disconnect()
  }, [measure, scroll])

  // The others, in the order they are put by in: the first few make the pile
  const others = VERTICALS.map((_, i) => i).filter((i) => i !== out)
  const lyingOf = (i: number): Lying => (out === null ? 'stacked' : i === out ? 'out' : others.indexOf(i) < PILED ? 'piled' : 'away')

  return (
    <Screen
      title="Portfolio"
      large
      subtitle={`${countOf(COMPANY_COUNT)} in ${VERTICALS.length} verticals`}
      className={`wallet-screen${out === null ? '' : ' wallet-screen--out'}`}
      scrollRef={scroll}
      leading={out === null ? undefined : <BackButton />}
      // With a card out the bar is bare, as Wallet's is: the card says what it is
      center={out === null ? undefined : <></>}
      trailing={
        out === null ? (
          <GlassButton label="Search" onClick={openSearch}>
            <Search size={22} strokeWidth={2.3} aria-hidden />
          </GlassButton>
        ) : undefined
      }
    >
      <div ref={stack} className="wallet-stack" data-out={out === null ? undefined : ''} style={{ '--cards': VERTICALS.length, '--last-rows': rowsOf(VERTICALS.length - 1) } as CSSProperties}>
        <ul className="wallet-cards">
          {VERTICALS.map((v, i) => (
            <Card key={v.name} vertical={i} lying={lyingOf(i)} slot={out === null ? 0 : Math.max(0, others.indexOf(i))} />
          ))}
        </ul>
        {/* The pile at the foot of the screen is the way back to the stack, as it is in Wallet */}
        {out !== null && <button type="button" className="wallet-pile" aria-label="All cards" onClick={() => pop()} />}
      </div>
    </Screen>
  )
}

// ---- Search ----

function Rows({ companies }: { companies: Listed[] }) {
  return (
    <ul className="wallet-rows">
      {companies.map((company) => (
        <li key={company.key}>
          <button type="button" className="wallet-row" onClick={() => open(company)}>
            <CompanyLogo company={company} size={40} />
            <span className="wallet-row__text">
              <span className="wallet-row__name">{company.name}</span>
              {/* Two companies can have one name: where the line under each would say the same, its address goes there instead */}
              <span className="wallet-row__where">{tellApart(company) || company.vertical}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}

/** Search, in place of the cards: every company, by name, vertical or what it does. */
function SearchScreen() {
  const { closeSearch } = useWallet()
  const query = useStore(finder, (s) => s.query)
  const found = useMemo(() => (query.trim() ? companiesIn(-1, query) : []), [query])
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter') (e.target as HTMLElement).blur()
  }

  // Escape, as in every search on the phone: it empties the field, then lets go of it (the shared search
  // bar sees to both, and keeps them to itself), and after that it is the way back. Back from here is
  // out of search, to the cards it was opened over, not out of the app. Heard on the document: after the
  // field has had its say, and before the phone takes Escape for its own Back.
  useEffect(() => {
    const key = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      const s = sys.get()
      if (s.app !== 'finder' || s.locked || s.sheet || s.switcher || s.spotlight) return
      e.preventDefault()
      closeSearch()
    }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [closeSearch])
  return (
    <Screen
      title="Search"
      large
      leading={null}
      className={`wallet-screen wallet-screen--search${found.length ? '' : ' wallet-screen--void'}`}
      foot={
        <span className="wallet-search" onKeyDown={onKey}>
          <SearchBar value={query} onChange={setFinderQuery} label="Search the portfolio" placeholder="Search" />
          <GlassButton label="Close search" onClick={closeSearch}>
            <X size={22} strokeWidth={2.4} aria-hidden />
          </GlassButton>
        </span>
      }
    >
      {!query.trim() ? (
        <Empty icon={<Search size={44} strokeWidth={1.8} />} title="Search the Portfolio">
          By a company’s name, its vertical, or what it does.
        </Empty>
      ) : found.length ? (
        <>
          <Rows companies={found} />
          <p className="wallet-count">{countOf(found.length)}</p>
        </>
      ) : (
        <Empty icon={<Search size={44} strokeWidth={1.8} />} title={`No Results for “${sought(query)}”`}>
          Check the spelling or try a new search.
        </Empty>
      )}
    </Screen>
  )
}

// ---- A company ----

/** A company, looked at over the cards: what it is, large, with the one thing
 * to do with it, and what is known about it underneath. */
function CompanySheet({ id }: { id: string }) {
  const company = companyKeyed(id)
  /** What Share put on the clipboard, where there was no share sheet to hand it to. */
  const [copied, setCopied] = useState<'Link copied' | 'Copied' | null>(null)

  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(null), 1800)
    return () => clearTimeout(t)
  }, [copied])

  if (!company)
    return (
      <Sheet label="Not in the Portfolio" tone="plain" className="wallet-sheet">
        <Empty icon={<WalletCards size={44} strokeWidth={1.8} />} title="Not in the Portfolio">
          There is no company here called “{id}”.
        </Empty>
      </Sheet>
    )

  const visit = visitLabel(company)
  const fate = fateOf(company)
  const site = company.url && !/notion\.site/.test(company.url) ? hostOf(company.url) : ''
  // A company with no site is passed on as its name and what it does, with no address: not this page's in its place
  const send = async () => {
    const sent = await share({ title: company.name, text: company.blurb ? `${company.name}: ${company.blurb}` : company.name, url: company.url ?? null })
    if (sent === 'copied') setCopied(company.url ? 'Link copied' : 'Copied')
  }

  return (
    <Sheet
      label={`${company.name}, ${company.vertical}`}
      title={company.name}
      tone="plain"
      className="wallet-sheet"
      leading={
        <GlassButton label="Close" onClick={() => closeSheet()}>
          <X size={20} strokeWidth={2.4} aria-hidden />
        </GlassButton>
      }
      trailing={
        <GlassButton label="Share" onClick={send}>
          {copied ? <Check size={21} strokeWidth={2.6} aria-hidden /> : <Share size={20} strokeWidth={2.2} aria-hidden style={{ marginTop: -2 }} />}
        </GlassButton>
      }
    >
      <div className="wallet-company">
        <CompanyLogo company={company} size={120} />
        <h3 className="wallet-company__name">{company.name}</h3>
        <div className="wallet-company__kind">Company · {company.vertical}</div>
        {company.blurb && <p className="wallet-company__blurb">{company.blurb}</p>}
        {company.url && visit ? (
          // Its own site is told where the visit came from: `noopener`, not `noreferrer`
          <a className="wallet-visit" href={company.url} target="_blank" rel="noopener">
            {visit}
            <ArrowUpRight size={18} strokeWidth={2.6} aria-hidden />
            <span className="sr-only">, opens in a new tab</span>
          </a>
        ) : (
          // Nowhere to send anyone: said where the link would be, so the sheet is not just a name
          <p className="wallet-fate">{fate}</p>
        )}
        {/* Said aloud when it happens; the button keeps its own name */}
        <span className="sr-only" role="status">
          {copied ?? ''}
        </span>
      </div>
      <List className="wallet-info">
        <Section header="Information">
          <Cell
            title="Vertical"
            value={
              // The colour is its card's
              <span className="wallet-tag">
                <span className="wallet-dot" style={{ '--dot': tintOf(verticalOf(company))[1] } as CSSProperties} aria-hidden />
                {company.vertical}
              </span>
            }
          />
          {site && <Cell title="Website" value={site} />}
        </Section>
      </List>
    </Sheet>
  )
}

// ---- The app ----

export function WalletApp() {
  const root = useRef<HTMLDivElement>(null)
  const depth = useStore(sys, (s) => s.stacks.finder.length)
  const [seen, setSeen] = useState(depth)
  const [searching, setSearching] = useState(false)
  const tops = useRef(new Map<string, number>()).current

  // A card is brought out from the cards themselves. One that comes out while search is up was asked
  // for from outside the app (search on the Home Screen opens a company over its card): it is not left
  // behind this app's own search
  if (seen !== depth) {
    setSeen(depth)
    if (depth > seen) setSearching(false)
  }

  // The search belongs to the time it is up: what was typed doesn't outlast it, nor this visit to the app
  useEffect(() => {
    if (!searching) setFinderQuery('')
  }, [searching])
  useEffect(() => () => setFinderQuery(''), [])

  const state = useMemo<WalletState>(
    () => ({
      searching,
      openSearch: () => {
        // The field is drawn and focused inside the tap itself: a phone only raises its keyboard for that
        flushSync(() => setSearching(true))
        root.current?.querySelector<HTMLInputElement>('.ios-page[data-pos="top"] .ios-search__input')?.focus({ preventScroll: true })
      },
      closeSearch: () => setSearching(false),
      tops,
    }),
    [searching, tops],
  )

  return (
    <div ref={root} className="wallet-app">
      <WalletContext.Provider value={state}>
        <NavStack flat>{(view) => (searching ? <SearchScreen /> : <CardsScreen out={cardOf(view)} />)}</NavStack>
        <SheetHost>{(name) => (name.startsWith(COMPANY_SHEET) ? <CompanySheet id={name.slice(COMPANY_SHEET.length)} /> : null)}</SheetHost>
      </WalletContext.Provider>
    </div>
  )
}
