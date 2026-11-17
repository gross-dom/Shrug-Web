import { createContext, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { ArrowUpRight, Check, ChevronDown, Clock, Ellipsis, Folder, LayoutGrid, List as ListIcon, Search, Share, Trash2, X } from 'lucide-react'
import { ALL, companiesIn, companyKeyed, CompanyLogo, hostOf, visitLabel, type Listed } from '../../apps/portfolio-ui'
import { finder, setFinderQuery, setFinderView } from '../../apps/state'
import { VERTICALS } from '../../data/portfolio'
import { SITE } from '../../data/site'
import { prefersReducedMotion } from '../../os/dom'
import { createStore, useStore } from '../../os/store'
import { share } from '../native'
import { closeSheet, openSheet, pop, push, sys } from '../system'
import { Cell, Empty, GlassButton, List, Menu, NavStack, Screen, SearchBar, Section, Sheet, SheetHost, TabBar, type MenuItem, type Tab } from '../ui'
import { companySheet, folderView, PORTFOLIO_FOLDER } from './routes'
import '../../styles/phone/files.css'

// The portfolio as the Files app. The desktop's window is a Finder; this is
// what a Finder is on an iPhone, laid out as Files is. Three tabs float at the
// foot with search beside them. Browse lists where there is to look: Portfolio
// under Locations, and the verticals under Tags, each with a coloured dot, the
// way Files lists tags. The app opens inside the Portfolio folder: every
// company as a file under its logo, in icons or a list, in the order Shrug
// lists them. Use Groups puts them under their verticals instead, as Files
// groups a folder. Recents is what has been opened this visit, Shared is the
// one-pager, and a company opens over the folder as the card Files shows for
// a file.

type TabId = 'recents' | 'shared' | 'browse'

/** How a folder's contents are put in order. They are all one kind of thing,
 * so by kind they stay as the portfolio lists them: Shrug's own order. */
type Sort = 'name' | 'kind'

/** The sections of Browse, each of which folds away under its heading. */
type SideId = 'locations' | 'tags'

interface FilesState {
  tab: TabId
  setTab: (tab: TabId) => void
  searching: boolean
  /** Into search, with the keyboard in the field. */
  openSearch: () => void
  closeSearch: () => void
  sort: Sort
  setSort: (sort: Sort) => void
  /** Portfolio under a heading for each vertical, or in one run. */
  grouped: boolean
  setGrouped: (grouped: boolean) => void
  /** The sections of Browse that are folded away. */
  folded: Record<SideId, boolean>
  fold: (id: SideId) => void
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

/** Recently Deleted: a folder Files always lists. Nothing here can be deleted, so it is always empty. */
const DELETED = 'f:deleted'

// ---- Tags ----

/** The colours Files gives its tags, in its own order. There are more verticals than colours, so they go round again. */
const TAG_COLORS = ['#ff3b30', '#ff9500', '#ffcc00', '#34c759', '#007aff', '#af52de', '#8e8e93']

const verticalOf = (company: Listed) => Math.max(0, VERTICALS.findIndex((v) => v.name === company.vertical))

/** A tag's dot: a vertical's colour. */
function Dot({ vertical }: { vertical: number }) {
  return <span className="files-dot" style={{ '--dot': TAG_COLORS[vertical % TAG_COLORS.length] } as CSSProperties} aria-hidden />
}

// ---- Recents ----

/** The companies opened this visit, by their keys, the latest first. It lasts as long as the page does. */
const recents = createStore<string[]>([])

const RECENTS = 12

const noteOpened = (key: string) => recents.set((keys) => (keys[0] === key ? keys : [key, ...keys.filter((k) => k !== key)].slice(0, RECENTS)))

// ---- A company, as a file ----

/** Where a company lives, as the gray line under a file says where or when: its site's address. */
const whereOf = (company: Listed) => (!company.url ? '' : /notion\.site/.test(company.url) ? 'Case study' : hostOf(company.url))

const open = (company: Listed) => openSheet(companySheet(company.key))

/** What a company's sheet is called begins with this: the rest is the company's key. */
const COMPANY_SHEET = companySheet('')

const byName = (a: Listed, b: Listed) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })

/** Two companies can have one name. Where a line under a company would say the same for both, its address goes there instead. */
const namesake = (company: Listed) => ALL.some((other) => other !== company && other.name === company.name)

function Icons({ companies }: { companies: Listed[] }) {
  return (
    <ul className="files-grid">
      {companies.map((company) => (
        <li key={company.key}>
          <button type="button" className="files-item" onClick={() => open(company)}>
            <CompanyLogo company={company} size={76} />
            <span className="files-item__name">{company.name}</span>
            <span className="files-item__where">{whereOf(company)}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

function Rows({ companies, detail = whereOf }: { companies: Listed[]; detail?: (company: Listed) => string }) {
  return (
    <ul className="files-rows">
      {companies.map((company) => (
        <li key={company.key}>
          <button type="button" className="files-row" onClick={() => open(company)}>
            <CompanyLogo company={company} size={40} />
            <span className="files-row__text">
              <span className="files-row__name">{company.name}</span>
              <span className="files-row__where">{detail(company) || 'Company'}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}

/** A folder's contents, the way it is set to be shown. `groups` is whether there is more than one vertical in it to group by. */
function Companies({ companies, groups }: { companies: Listed[]; groups: boolean }) {
  const view = useStore(finder, (s) => s.view)
  const { grouped, sort } = useFiles()
  const Shown = view === 'icons' ? Icons : Rows
  // By kind is the order the portfolio keeps them in; under their verticals, each vertical's are in that order too
  const sorted = (list: Listed[]) => (sort === 'name' ? [...list].sort(byName) : list)
  if (!groups || !grouped) return <Shown companies={sorted(companies)} />
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
            <Shown companies={sorted(inIt)} />
          </section>
        )
      })}
    </>
  )
}

/** How many, the way Files counts a folder. */
const countOf = (n: number) => `${n} ${n === 1 ? 'item' : 'items'}`

// ---- What floats: the tabs, search, the view menu ----

// A tab bar's glyphs are solid. Lucide draws in outline, and an outline filled
// in loses whatever was inside it (a clock's hands), so the three are drawn here.

const FOLDER = 'M2.5 7.2a2.7 2.7 0 0 1 2.7-2.7h3.4c.72 0 1.4.28 1.9.79l1.2 1.21h7.1a2.7 2.7 0 0 1 2.7 2.7v8.1a2.7 2.7 0 0 1-2.7 2.7H5.2a2.7 2.7 0 0 1-2.7-2.7z'

function ClockGlyph() {
  const id = useId().replace(/:/g, '')
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden>
      <mask id={id}>
        <rect width="24" height="24" fill="#fff" />
        <path d="M12 6.9V12l3.5 2.3" fill="none" stroke="#000" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      </mask>
      <circle cx="12" cy="12" r="9.4" fill="currentColor" mask={`url(#${id})`} />
    </svg>
  )
}

function FolderGlyph() {
  const id = useId().replace(/:/g, '')
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden>
      <mask id={id}>
        <rect width="24" height="24" fill="#fff" />
        {/* The line where the front of the folder closes over the back */}
        <path d="M2 9.6h20" stroke="#000" strokeWidth="1.1" />
      </mask>
      <path d={FOLDER} fill="currentColor" mask={`url(#${id})`} />
    </svg>
  )
}

/** A folder with somebody's badge on its corner: what is shared. */
function SharedGlyph() {
  const id = useId().replace(/:/g, '')
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden>
      <mask id={`${id}-folder`}>
        <rect width="24" height="24" fill="#fff" />
        <path d="M0 8.1h20" stroke="#000" strokeWidth="1" />
        <circle cx="18.2" cy="17.2" r="6" fill="#000" />
      </mask>
      <mask id={`${id}-badge`}>
        <rect width="24" height="24" fill="#fff" />
        <circle cx="18.2" cy="15.6" r="1.55" fill="#000" />
        <path d="M14.9 20.9c.2-1.9 1.5-3 3.3-3s3.1 1.1 3.3 3z" fill="#000" />
      </mask>
      <path d={FOLDER} fill="currentColor" mask={`url(#${id}-folder)`} transform="translate(-0.9 -0.7) scale(0.88)" />
      <circle cx="18.2" cy="17.2" r="4.7" fill="currentColor" mask={`url(#${id}-badge)`} />
    </svg>
  )
}

const TABS: Tab<TabId>[] = [
  { id: 'recents', label: 'Recents', icon: <ClockGlyph /> },
  { id: 'shared', label: 'Shared', icon: <SharedGlyph /> },
  { id: 'browse', label: 'Browse', icon: <FolderGlyph /> },
]

/** The tab bar and, beside it, search. `onTab` is what choosing a tab does on this screen. */
function Tabs({ at, onTab }: { at: TabId; onTab: (tab: TabId) => void }) {
  const { openSearch } = useFiles()
  return (
    <>
      <TabBar label="Tabs" tabs={TABS} value={at} onChange={onTab} />
      <GlassButton label="Search" onClick={openSearch}>
        <Search size={25} strokeWidth={2.2} aria-hidden />
      </GlassButton>
    </>
  )
}

/** What the first screen of a tab needs: its place on the page kept, and a tab bar on which its own tab goes back to the top. */
function useTabRoot(id: TabId) {
  const { setTab } = useFiles()
  const scroll = useKeptScroll(id)
  const onTab = (tab: TabId) => (tab === id ? scroll.current?.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' }) : setTab(tab))
  return { scroll, foot: <Tabs at={id} onTab={onTab} /> }
}

/** Inside a folder the tab bar leads out of it: Browse goes back up to Browse itself, as the tab that is showing does, and another tab goes to that tab. */
function useWayOut() {
  const { setTab } = useFiles()
  return (tab: TabId) => {
    setTab(tab)
    pop()
  }
}

/** The "⋯" at the top of a folder: how its contents are shown and put in order. */
function ViewMenu({ groups }: { groups: boolean }) {
  const view = useStore(finder, (s) => s.view)
  const { grouped, setGrouped, sort, setSort } = useFiles()
  const items: MenuItem[] = [
    { label: 'Icons', icon: <LayoutGrid size={19} strokeWidth={2} />, checked: view === 'icons', onSelect: () => setFinderView('icons') },
    { label: 'List', icon: <ListIcon size={20} strokeWidth={2} />, checked: view === 'list', onSelect: () => setFinderView('list') },
    { label: 'Name', checked: sort === 'name', divided: true, onSelect: () => setSort('name') },
    { label: 'Kind', checked: sort === 'kind', onSelect: () => setSort('kind') },
  ]
  if (groups) items.push({ label: 'Use Groups', checked: grouped, toggle: true, divided: true, onSelect: () => setGrouped(!grouped) })
  return (
    <Menu label="More" items={items}>
      <Ellipsis size={24} strokeWidth={2.3} aria-hidden />
    </Menu>
  )
}

// ---- Browse ----

/** One of Browse's sections: a bold heading that folds its rows away. */
function Side({ id, title, children }: { id: SideId; title: string; children: ReactNode }) {
  const { folded, fold } = useFiles()
  const shut = folded[id]
  const rows = useId()
  return (
    <section className="files-side" data-shut={shut || undefined}>
      <h3 className="files-side__head">
        <button type="button" className="files-side__toggle" aria-expanded={!shut} aria-controls={rows} onClick={() => fold(id)}>
          {title}
          <ChevronDown className="files-side__chevron" size={21} strokeWidth={2.7} aria-hidden />
        </button>
      </h3>
      <div className="files-side__fold">
        <ul id={rows} className="files-side__rows" {...(shut ? ({ inert: '' } as object) : null)}>
          {children}
        </ul>
      </div>
    </section>
  )
}

/** A row of Browse: somewhere to look. Files gives these neither a chevron nor a count. */
function Place({ lead, name, onClick }: { lead: ReactNode; name: string; onClick: () => void }) {
  return (
    <li>
      <button type="button" className="files-place" onClick={onClick}>
        <span className="files-place__lead">{lead}</span>
        <span className="files-place__name">{name}</span>
      </button>
    </li>
  )
}

const glyph = { size: 24, strokeWidth: 1.9 }

/** Where there is to look: the Portfolio folder, and the verticals as the tags its companies carry. */
function BrowseScreen() {
  const { scroll, foot } = useTabRoot('browse')
  return (
    <Screen title="Browse" large className="files-screen" scrollRef={scroll} foot={foot}>
      <Side id="locations" title="Locations">
        <Place lead={<Folder {...glyph} aria-hidden />} name="Portfolio" onClick={() => push(PORTFOLIO_FOLDER)} />
        <Place lead={<Trash2 {...glyph} aria-hidden />} name="Recently Deleted" onClick={() => push(DELETED)} />
      </Side>
      <Side id="tags" title="Tags">
        {VERTICALS.map((v, i) => (
          <Place key={v.name} lead={<Dot vertical={i} />} name={v.name} onClick={() => push(folderView(i))} />
        ))}
      </Side>
    </Screen>
  )
}

// ---- The other screens ----

/** The Portfolio folder (-1: every company), or everything one vertical is tagged on. */
function FolderScreen({ view, vertical }: { view: string; vertical: number }) {
  const scroll = useKeptScroll(view)
  const wayOut = useWayOut()
  const all = vertical === -1
  const companies = useMemo(() => companiesIn(vertical, ''), [vertical])
  return (
    <Screen title={all ? 'Portfolio' : VERTICALS[vertical]!.name} large className="files-screen" scrollRef={scroll} trailing={<ViewMenu groups={all} />} foot={<Tabs at="browse" onTab={wayOut} />}>
      <Companies companies={companies} groups={all} />
      <p className="files-count">{countOf(companies.length)}</p>
    </Screen>
  )
}

function DeletedScreen() {
  const wayOut = useWayOut()
  return (
    <Screen title="Recently Deleted" large className="files-screen files-screen--void" foot={<Tabs at="browse" onTab={wayOut} />}>
      <Empty icon={<Trash2 size={44} strokeWidth={1.8} />} title="No Items" />
    </Screen>
  )
}

/** What has been opened this visit, the latest first. */
function RecentsScreen() {
  const { scroll, foot } = useTabRoot('recents')
  const keys = useStore(recents, (s) => s)
  const companies = useMemo(() => keys.map(companyKeyed).filter((c): c is Listed => !!c), [keys])
  return (
    <Screen title="Recents" large className={`files-screen${companies.length ? '' : ' files-screen--void'}`} scrollRef={scroll} foot={foot}>
      {companies.length ? (
        <Icons companies={companies} />
      ) : (
        <Empty icon={<Clock size={44} strokeWidth={1.8} />} title="No Recents">
          Companies you open will show up here.
        </Empty>
      )}
    </Screen>
  )
}

/** The one-pager's first page, as Files shows a document: a sheet of paper with its lines of type. */
function PageThumb() {
  return (
    <span className="files-doc" aria-hidden>
      <svg viewBox="0 0 60 78">
        <rect x="0.5" y="0.5" width="59" height="77" rx="3.5" fill="#fff" stroke="rgb(0 0 0 / 0.16)" />
        <g fill="none" strokeLinecap="round" strokeWidth="3">
          <path d="M9 14h20" stroke="#1c1c1e" />
          <path d="M9 25h42M9 32h42M9 39h31" stroke="#c7c7cc" />
          <path d="M9 51h42M9 58h42M9 65h24" stroke="#c7c7cc" />
        </g>
      </svg>
    </span>
  )
}

/** What Shrug shares: its one-pager, which opens where it is kept. */
function SharedScreen() {
  const { scroll, foot } = useTabRoot('shared')
  return (
    <Screen title="Shared" large className="files-screen" scrollRef={scroll} foot={foot}>
      <ul className="files-grid">
        <li>
          <a className="files-item files-item--shared" href={SITE.onePager} target="_blank" rel="noreferrer">
            <PageThumb />
            <span className="files-item__name">{SITE.name} One-pager</span>
            <span className="files-item__where">Shared by {SITE.legalName}</span>
            <span className="sr-only">, opens in the browser</span>
          </a>
        </li>
      </ul>
      <p className="files-count">{countOf(1)}</p>
    </Screen>
  )
}

/** Search, in place of whichever screen it was started from: every company, by name, vertical or what it does. */
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
      className={`files-screen files-screen--search${found.length ? '' : ' files-screen--void'}`}
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
          <Rows companies={found} detail={(company) => `Portfolio — ${namesake(company) && company.url ? whereOf(company) : company.vertical}`} />
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

/** A company, looked at the way Files looks at a file: what it is, large, with
 * the one thing to do with it, and what is known about it underneath. */
function CompanySheet({ id }: { id: string }) {
  const company = companyKeyed(id)
  const [copied, setCopied] = useState(false)

  // Looked at is opened: it goes to the front of Recents
  useEffect(() => {
    if (company) noteOpened(company.key)
  }, [company])

  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 1800)
    return () => clearTimeout(t)
  }, [copied])

  if (!company)
    return (
      <Sheet label="Not in the Portfolio" tone="plain" className="files-sheet">
        <Empty icon={<Folder size={44} strokeWidth={1.8} />} title="Not in the Portfolio">
          There is no company here called “{id}”.
        </Empty>
      </Sheet>
    )

  const visit = visitLabel(company)
  const site = company.url && !/notion\.site/.test(company.url) ? hostOf(company.url) : ''
  const send = async () => {
    const sent = await share({ title: company.name, text: company.blurb ? `${company.name}: ${company.blurb}` : company.name, url: company.url ?? undefined })
    if (sent === 'copied') setCopied(true)
  }

  return (
    <Sheet
      label={`${company.name}, ${company.vertical}`}
      title={company.name}
      tone="plain"
      className="files-sheet"
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
      <div className="files-file">
        <CompanyLogo company={company} size={120} />
        <h3 className="files-file__name">{company.name}</h3>
        <div className="files-file__kind">Company · {company.vertical}</div>
        {company.blurb && <p className="files-file__blurb">{company.blurb}</p>}
        {company.url && visit && (
          <a className="files-open" href={company.url} target="_blank" rel="noreferrer">
            {visit}
            <ArrowUpRight size={18} strokeWidth={2.6} aria-hidden />
            <span className="sr-only">, in the browser</span>
          </a>
        )}
        {/* Said aloud when it happens; the button keeps its own name */}
        <span className="sr-only" role="status">
          {copied ? 'Link copied' : ''}
        </span>
      </div>
      <List className="files-info">
        <Section header="Information">
          <Cell title="Kind" value="Company" />
          <Cell title="Where" value="Portfolio" />
          <Cell
            title="Tags"
            value={
              <span className="files-tag">
                <Dot vertical={verticalOf(company)} />
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

/** What a view in the app's stack shows. */
function Page({ view }: { view: string | null }) {
  const { tab, searching } = useFiles()
  const wayOut = useWayOut()
  if (searching) return <SearchScreen />
  if (view === null) return tab === 'recents' ? <RecentsScreen /> : tab === 'shared' ? <SharedScreen /> : <BrowseScreen />
  if (view === DELETED) return <DeletedScreen />
  const tagged = /^f:(\d+)$/.exec(view)
  const vertical = view === PORTFOLIO_FOLDER ? -1 : tagged ? Number(tagged[1]) : NaN
  if (vertical >= -1 && vertical < VERTICALS.length) return <FolderScreen key={view} view={view} vertical={vertical} />
  return (
    <Screen title="Browse" className="files-screen files-screen--void" foot={<Tabs at="browse" onTab={wayOut} />}>
      <Empty icon={<Folder size={44} strokeWidth={1.8} />} title="Folder Not Found" />
    </Screen>
  )
}

export function FilesApp() {
  const root = useRef<HTMLDivElement>(null)
  const depth = useStore(sys, (s) => s.stacks.finder.length)
  const [tab, setTab] = useState<TabId>('browse')
  const [seen, setSeen] = useState(depth)
  const [searching, setSearching] = useState(false)
  const [sort, setSort] = useState<Sort>('kind')
  // The folder opens as one run, in Shrug's order; Use Groups is there for whoever wants the verticals
  const [grouped, setGrouped] = useState(false)
  const [folded, setFolded] = useState<Record<SideId, boolean>>({ locations: false, tags: false })
  const tops = useRef(new Map<string, number>()).current

  // A folder is Browse's. One opened from outside the app (search on the Home
  // Screen opens a company over Portfolio) brings Browse with it, so that Back
  // leads there whichever tab was showing before.
  if (seen !== depth) {
    setSeen(depth)
    if (depth > seen) setTab('browse')
  }

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
      sort,
      setSort,
      grouped,
      setGrouped,
      folded,
      fold: (id) => setFolded((f) => ({ ...f, [id]: !f[id] })),
      tops,
    }),
    [tab, searching, sort, grouped, folded, tops],
  )

  return (
    <div ref={root} className="files-app">
      <FilesContext.Provider value={state}>
        <NavStack>{(view) => <Page view={view} />}</NavStack>
        <SheetHost>{(name) => (name.startsWith(COMPANY_SHEET) ? <CompanySheet id={name.slice(COMPANY_SHEET.length)} /> : null)}</SheetHost>
      </FilesContext.Provider>
    </div>
  )
}
