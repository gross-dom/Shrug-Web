import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { flushSync } from 'react-dom'
import { ArrowUpRight, Check, Ellipsis, Folder, LayoutGrid, List as ListIcon, Search, Share, X } from 'lucide-react'
import { ALL, companiesIn, companyNamed, CompanyLogo, hostOf, visitLabel, type Listed } from '../../apps/portfolio-ui'
import { finder, setFinderQuery, setFinderView } from '../../apps/state'
import { VERTICALS } from '../../data/portfolio'
import { useStore } from '../../os/store'
import { share } from '../native'
import { openSheet, pop, push } from '../system'
import { Cell, Empty, GlassButton, List, Menu, NavStack, Screen, SearchBar, Section, Sheet, SheetHost, TabBar, type MenuItem, type Tab } from '../ui'
import { folderView } from './routes'
import '../../styles/phone/files.css'

// The portfolio as the Files app. The desktop's window is a Finder; this is
// what a Finder is on an iPhone. Two tabs float at the foot: Portfolio is every
// company under its logo, in icons or a list, grouped by vertical the way
// Files groups a folder; Browse is the verticals as folders, each opening onto
// its own companies. Search is beside the tabs, and a company opens as the
// card Files shows for a file.

type TabId = 'portfolio' | 'browse'

interface FilesState {
  tab: TabId
  setTab: (tab: TabId) => void
  searching: boolean
  /** Into search, with the keyboard in the field. */
  openSearch: () => void
  closeSearch: () => void
  /** Companies under a heading for each vertical, or one run from A to Z. */
  grouped: boolean
  setGrouped: (grouped: boolean) => void
  /** How far down each screen had been scrolled when it was last showing. */
  tops: Map<string, number>
}

const FilesContext = createContext<FilesState | null>(null)
const useFiles = () => useContext(FilesContext)!

/** A screen that comes and goes (a tab, or one that search covers) is scrolled where it was left. */
function useKeptScroll(id: string) {
  const { tops } = useFiles()
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

// ---- A company, as a file ----

/** Where a company lives, as the gray line under a file says where or when: its site's address. */
const whereOf = (company: Listed) => (!company.url ? '' : /notion\.site/.test(company.url) ? 'Case study' : hostOf(company.url))

const open = (company: Listed) => openSheet(`company:${company.name}`)

const byName = (a: Listed, b: Listed) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })

function Icons({ companies }: { companies: Listed[]; vertical?: boolean }) {
  return (
    <ul className="files-grid">
      {companies.map((company) => (
        <li key={company.name}>
          <button type="button" className="files-item" aria-label={`${company.name}, ${company.vertical}`} onClick={() => open(company)}>
            <CompanyLogo company={company} size={76} />
            <span className="files-item__name">{company.name}</span>
            <span className="files-item__where">{whereOf(company)}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

function Rows({ companies, vertical = true }: { companies: Listed[]; vertical?: boolean }) {
  return (
    <ul className="files-rows">
      {companies.map((company) => (
        <li key={company.name}>
          <button type="button" className="files-row" aria-label={`${company.name}, ${company.vertical}`} onClick={() => open(company)}>
            <CompanyLogo company={company} size={44} />
            <span className="files-row__text">
              <span className="files-row__name">{company.name}</span>
              <span className="files-row__where">{[vertical ? company.vertical : '', whereOf(company)].filter(Boolean).join(' · ') || 'Company'}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}

/** A folder's contents, the way it is set to be shown. `groups` is whether there is more than one vertical to group by. */
function Companies({ companies, groups }: { companies: Listed[]; groups: boolean }) {
  const view = useStore(finder, (s) => s.view)
  const { grouped } = useFiles()
  const Shown = view === 'icons' ? Icons : Rows
  if (!groups) return <Shown companies={companies} vertical={false} />
  if (!grouped) return <Shown companies={[...companies].sort(byName)} />
  return (
    <>
      {VERTICALS.map((v) => {
        const inIt = companies.filter((c) => c.vertical === v.name)
        if (!inIt.length) return null
        return (
          <section key={v.name} className="files-group" aria-label={v.name}>
            <h3 className="files-group__name">
              {v.name}
              <span>{inIt.length}</span>
            </h3>
            <Shown companies={inIt} vertical={false} />
          </section>
        )
      })}
    </>
  )
}

const countOf = (n: number) => `${n} ${n === 1 ? 'company' : 'companies'}`

// ---- What floats: the tabs, search, the view menu ----

/** A tab bar's glyphs are solid, whichever tab is showing. */
const TABS: Tab<TabId>[] = [
  { id: 'portfolio', label: 'Portfolio', icon: <Folder size={24} strokeWidth={2} fill="currentColor" /> },
  { id: 'browse', label: 'Browse', icon: <LayoutGrid size={23} strokeWidth={2} fill="currentColor" /> },
]

/** The tab bar and, beside it, search. `onTab` is what choosing a tab does on this screen. */
function Tabs({ at, onTab }: { at: TabId; onTab: (tab: TabId) => void }) {
  const { openSearch } = useFiles()
  return (
    <>
      <TabBar label="Tabs" tabs={TABS} value={at} onChange={onTab} />
      <span className="files-gap" aria-hidden />
      <GlassButton label="Search" onClick={openSearch}>
        <Search size={25} strokeWidth={2.2} aria-hidden />
      </GlassButton>
    </>
  )
}

/** The "⋯" at the top of a folder: how its contents are shown. */
function ViewMenu({ groups }: { groups: boolean }) {
  const view = useStore(finder, (s) => s.view)
  const { grouped, setGrouped } = useFiles()
  const items: MenuItem[] = [
    { label: 'Icons', icon: <LayoutGrid size={19} strokeWidth={2} />, checked: view === 'icons', onSelect: () => setFinderView('icons') },
    { label: 'List', icon: <ListIcon size={20} strokeWidth={2} />, checked: view === 'list', onSelect: () => setFinderView('list') },
  ]
  if (groups) items.push({ label: 'Use Groups', checked: grouped, divided: true, onSelect: () => setGrouped(!grouped) })
  return (
    <Menu label="View options" items={items}>
      <Ellipsis size={24} strokeWidth={2.3} aria-hidden />
    </Menu>
  )
}

// ---- The screens ----

/** Every company: the Portfolio folder itself. */
function PortfolioScreen() {
  const { setTab } = useFiles()
  const scroll = useKeptScroll('portfolio')
  const onTab = (tab: TabId) => (tab === 'portfolio' ? scroll.current?.scrollTo({ top: 0, behavior: 'smooth' }) : setTab(tab))
  return (
    <Screen title="Portfolio" large className="files-screen" scrollRef={scroll} trailing={<ViewMenu groups />} foot={<Tabs at="portfolio" onTab={onTab} />}>
      <Companies companies={ALL} groups />
      <p className="files-count">
        {countOf(ALL.length)} in {VERTICALS.length} verticals
      </p>
    </Screen>
  )
}

const glyph = { size: 24, strokeWidth: 1.9 }

/** The verticals as folders, the way Files lists places to look. */
function BrowseScreen() {
  const { setTab } = useFiles()
  const scroll = useKeptScroll('browse')
  const onTab = (tab: TabId) => (tab === 'browse' ? scroll.current?.scrollTo({ top: 0, behavior: 'smooth' }) : setTab(tab))
  return (
    <Screen title="Browse" large tone="grouped" className="files-screen" scrollRef={scroll} foot={<Tabs at="browse" onTab={onTab} />}>
      <List className="files-browse">
        <Section header="Portfolio">
          <Cell lead={<LayoutGrid {...glyph} className="files-browse__glyph" aria-hidden />} title="All Companies" value={ALL.length} chevron onClick={() => push(folderView('all'))} />
        </Section>
        <Section header="Verticals">
          {VERTICALS.map((v, i) => (
            <Cell key={v.name} lead={<Folder {...glyph} className="files-browse__glyph" aria-hidden />} title={v.name} value={v.companies.length} chevron onClick={() => push(folderView(i))} />
          ))}
        </Section>
      </List>
    </Screen>
  )
}

/** One vertical's folder (or, for -1, the folder of every company), opened from Browse. */
function FolderScreen({ view, vertical }: { view: string; vertical: number }) {
  const { setTab } = useFiles()
  const scroll = useKeptScroll(view)
  const all = vertical === -1
  const companies = useMemo(() => companiesIn(vertical, ''), [vertical])
  // Its own tab again goes back up to Browse, as tapping a tab bar's current tab does; the other leaves for it
  const onTab = (tab: TabId) => {
    setTab(tab)
    pop()
  }
  return (
    <Screen title={all ? 'All Companies' : VERTICALS[vertical]!.name} className="files-screen files-screen--folder" scrollRef={scroll} trailing={<ViewMenu groups={all} />} foot={<Tabs at="browse" onTab={onTab} />}>
      <Companies companies={companies} groups={all} />
      <p className="files-count">{countOf(companies.length)}</p>
    </Screen>
  )
}

/** Search, in place of whichever folder it was started from: every company, by name, vertical or what it does. */
function SearchScreen() {
  const { closeSearch } = useFiles()
  const query = useStore(finder, (s) => s.query)
  const found = useMemo(() => (query.trim() ? companiesIn(-1, query) : []), [query])
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      closeSearch()
    } else if (e.key === 'Enter') (e.target as HTMLElement).blur()
  }
  return (
    <Screen
      title="Search"
      large
      leading={null}
      className="files-screen files-screen--search"
      foot={
        <span className="files-search" onKeyDown={onKey}>
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
          <p className="files-count">{countOf(found.length)}</p>
        </>
      ) : (
        <Empty icon={<Search size={44} strokeWidth={1.8} />} title="No Results">
          Nothing in the portfolio matches “{query.trim()}”. Check the spelling or try another search.
        </Empty>
      )}
    </Screen>
  )
}

// ---- A company ----

/** What Files shows for a file: its icon, what it is, and what can be done with it. */
function CompanyCard({ company }: { company: Listed }) {
  const [copied, setCopied] = useState(false)
  const visit = visitLabel(company)
  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 1800)
    return () => clearTimeout(t)
  }, [copied])
  const send = async () => {
    const sent = await share({ title: company.name, text: company.blurb ? `${company.name}: ${company.blurb}` : company.name, url: company.url ?? undefined })
    if (sent === 'copied') setCopied(true)
  }
  return (
    <div className="files-card">
      <CompanyLogo company={company} size={88} />
      <h3 className="files-card__name">{company.name}</h3>
      <div className="files-card__kind">{company.vertical}</div>
      {company.blurb && <p className="files-card__blurb">{company.blurb}</p>}
      <div className="files-card__actions">
        {company.url && visit && (
          <a className="files-action files-action--main" href={company.url} target="_blank" rel="noreferrer">
            {visit}
            <ArrowUpRight size={18} strokeWidth={2.6} aria-hidden />
          </a>
        )}
        <button type="button" className="files-action" onClick={send}>
          {copied ? <Check size={18} strokeWidth={2.8} aria-hidden /> : <Share size={17} strokeWidth={2.4} aria-hidden />}
          {copied ? 'Link Copied' : 'Share'}
        </button>
        {/* Said aloud when it happens; the button keeps its own name */}
        <span className="sr-only" role="status">
          {copied ? 'Link copied' : ''}
        </span>
      </div>
    </div>
  )
}

/** A company on a screen of its own: where search, or a link, lands. */
function CompanyScreen({ name }: { name: string }) {
  const company = companyNamed(name)
  if (!company)
    return (
      <Screen title="Portfolio" className="files-screen">
        <Empty icon={<Folder size={44} strokeWidth={1.8} />} title="Not in the Portfolio">
          There is no company here called “{name}”.
        </Empty>
      </Screen>
    )
  const where = whereOf(company)
  return (
    <Screen title={company.name} tone="grouped" className="files-screen files-screen--company">
      <CompanyCard company={company} />
      <List className="files-info">
        <Section header="Information">
          <Cell title="Kind" value="Company" />
          <Cell title="Vertical" value={company.vertical} />
          <Cell title="Where" value={`Portfolio › ${company.vertical}`} />
          {where && <Cell title="Website" value={where} />}
        </Section>
      </List>
    </Screen>
  )
}

function CompanySheet({ name }: { name: string }) {
  const company = companyNamed(name)
  if (!company) return null
  return (
    <Sheet label={`${company.name}, ${company.vertical}`} detent="medium" tone="plain" className="files-sheet">
      <CompanyCard company={company} />
    </Sheet>
  )
}

// ---- The app ----

/** What a view in the app's stack shows. */
function Page({ view }: { view: string | null }) {
  const { tab, searching } = useFiles()
  if (view?.startsWith('c:')) return <CompanyScreen name={view.slice(2)} />
  if (searching) return <SearchScreen />
  if (view === null) return tab === 'portfolio' ? <PortfolioScreen /> : <BrowseScreen />
  const vertical = view === 'f:all' ? -1 : view.startsWith('f:') ? Number(view.slice(2)) : NaN
  if (Number.isInteger(vertical) && vertical >= -1 && vertical < VERTICALS.length) return <FolderScreen key={view} view={view} vertical={vertical} />
  return (
    <Screen title="Portfolio" className="files-screen">
      <Empty icon={<Folder size={44} strokeWidth={1.8} />} title="Folder Not Found" />
    </Screen>
  )
}

export function FilesApp() {
  const root = useRef<HTMLDivElement>(null)
  const [tab, setTab] = useState<TabId>('portfolio')
  const [searching, setSearching] = useState(false)
  const [grouped, setGrouped] = useState(true)
  const tops = useRef(new Map<string, number>()).current

  // The search belongs to this visit to the app: it doesn't outlast it
  useEffect(() => () => setFinderQuery(''), [])

  const state = useMemo<FilesState>(
    () => ({
      tab,
      setTab,
      searching,
      openSearch: () => {
        // The field is drawn and focused inside the tap itself: a phone only raises its keyboard for that
        flushSync(() => setSearching(true))
        root.current?.querySelector<HTMLInputElement>('.ios-page[data-pos="top"] .ios-search__input')?.focus({ preventScroll: true })
      },
      closeSearch: () => {
        setSearching(false)
        setFinderQuery('')
      },
      grouped,
      setGrouped,
      tops,
    }),
    [tab, searching, grouped, tops],
  )

  return (
    <div ref={root} className="files-app">
      <FilesContext.Provider value={state}>
        <NavStack>{(view) => <Page view={view} />}</NavStack>
        <SheetHost>{(name) => (name.startsWith('company:') ? <CompanySheet name={name.slice('company:'.length)} /> : null)}</SheetHost>
      </FilesContext.Provider>
    </div>
  )
}
