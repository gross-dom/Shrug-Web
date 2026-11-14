import { useMemo, useRef, type KeyboardEvent } from 'react'
import { ArrowUpRight, ChevronLeft, ChevronRight, Folder, LayoutGrid, List } from 'lucide-react'
import { COMPANY_COUNT, VERTICALS } from '../data/portfolio'
import { Window } from '../kit/window'
import { FolderIcon } from '../os/icons'
import { useStore } from '../os/store'
import { companiesIn, CompanyLogo, hostOf, openCompany, visitLabel, type Listed } from './portfolio-ui'
import { finder, pickCompany, setFinderQuery, setFinderView, showVertical, stepVertical } from './state'
import { SearchField, SideLabel, ToolSet, ToolSetButton } from './ui'

// The portfolio as a Finder window: verticals down the sidebar, and the
// companies in the one that's picked, each under its own logo, in icons or a
// list. One is always selected, and the preview beside them says what it does
// and links to it. Back and Forward retrace the verticals visited; the search
// narrows whatever is showing.

// lucide for the sidebar and toolbar glyphs, as the kit's own Finder does:
// one family, one stroke
const glyph = { size: 15, strokeWidth: 1.7 }

function Sidebar() {
  const vertical = useStore(finder, (s) => s.vertical)
  const row = (index: number, label: string, count: number) => (
    <button key={index} type="button" className="side-item" aria-current={vertical === index || undefined} onClick={() => showVertical(index)}>
      <span className="side-item__icon">{index === -1 ? <LayoutGrid {...glyph} aria-hidden /> : <Folder {...glyph} aria-hidden />}</span>
      <span className="side-item__name">{label}</span>
      <span className="side-item__count">{count}</span>
    </button>
  )
  return (
    <nav className="side scrolls" aria-label="Verticals">
      <SideLabel>Portfolio</SideLabel>
      {row(-1, 'All', COMPANY_COUNT)}
      <SideLabel>Verticals</SideLabel>
      {VERTICALS.map((v, i) => row(i, v.name, v.companies.length))}
    </nav>
  )
}

/** The selected company, as a Finder preview shows a file: its icon, what it is, and a way in. */
function Preview({ company }: { company: Listed }) {
  const visit = visitLabel(company)
  return (
    <aside className="pf-preview" aria-label={`${company.name}, ${company.vertical}`}>
      <CompanyLogo company={company} size={88} />
      <div className="pf-preview__text">
        <h3 className="pf-preview__name">{company.name}</h3>
        <div className="pf-preview__kind">{company.vertical}</div>
        {company.blurb && <p className="pf-preview__blurb">{company.blurb}</p>}
      </div>
      {company.url && visit && (
        <a className="pf-preview__visit" href={company.url} target="_blank" rel="noreferrer">
          <span>{visit}</span>
          <ArrowUpRight size={13} strokeWidth={2.2} aria-hidden />
        </a>
      )}
    </aside>
  )
}

export function FinderApp() {
  const { vertical, view, query, at, trail, picked } = useStore(finder, (s) => s)
  const name = vertical === -1 ? 'All' : VERTICALS[vertical]!.name
  const shown = useMemo(() => companiesIn(vertical, query), [vertical, query])
  // Something is always selected: the one that was picked, or the first showing
  const chosen = shown.find((c) => c.name === picked) ?? shown[0] ?? null
  const count = `${shown.length} ${shown.length === 1 ? 'company' : 'companies'}`
  const files = useRef<HTMLDivElement>(null)

  /** Arrows walk the companies, the way they walk a Finder window; Return opens the one selected. */
  const onKey = (e: KeyboardEvent) => {
    const box = files.current
    if (!box || !chosen) return
    if (e.key === 'Enter') return void (e.preventDefault(), openCompany(chosen))
    const tiles = Array.from(box.querySelectorAll<HTMLElement>('[data-company]'))
    const here = shown.indexOf(chosen)
    // How many sit in a row right now: the grid decides that, not us
    const perRow = view === 'list' ? 1 : Math.max(1, tiles.filter((t) => t.offsetTop === tiles[0]!.offsetTop).length)
    const steps: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: perRow, ArrowUp: -perRow, Home: -here, End: shown.length - 1 - here }
    const step = steps[e.key]
    if (step === undefined || (view === 'list' && (e.key === 'ArrowRight' || e.key === 'ArrowLeft'))) return
    e.preventDefault()
    const next = here + step
    if (next < 0 || next >= shown.length) return
    pickCompany(shown[next]!.name)
    tiles[next]?.focus()
  }

  return (
    <Window
      className="app pf"
      sidebar={<Sidebar />}
      sidebarWidth={212}
      sidebarStyle="floating"
      lightsSize="large"
      barSize="tall"
      lead={
        <span className="lead">
          <ToolSet label="Back/Forward">
            <ToolSetButton label="Back" disabled={at === 0} onClick={() => stepVertical(-1)}>
              <ChevronLeft size={17} strokeWidth={1.9} aria-hidden />
            </ToolSetButton>
            <ToolSetButton label="Forward" disabled={at >= trail.length - 1} onClick={() => stepVertical(1)}>
              <ChevronRight size={17} strokeWidth={1.9} aria-hidden />
            </ToolSetButton>
          </ToolSet>
          <span className="heading">{name}</span>
        </span>
      }
      toolbar={
        <span className="tools">
          <ToolSet label="View">
            <ToolSetButton label="as Icons" pressed={view === 'icons'} onClick={() => setFinderView('icons')}>
              <LayoutGrid size={15} strokeWidth={1.8} aria-hidden />
            </ToolSetButton>
            <ToolSetButton label="as List" pressed={view === 'list'} onClick={() => setFinderView('list')}>
              <List size={16} strokeWidth={1.8} aria-hidden />
            </ToolSetButton>
          </ToolSet>
          <span className="tool tool--search">
            <SearchField value={query} onChange={setFinderQuery} label="Search the portfolio" />
            <span className="tool__label" aria-hidden>
              Search
            </span>
          </span>
        </span>
      }
      body={{ className: 'pf__body' }}
    >
      {/* With the sidebar folded away, the verticals ride along the top */}
      <div className="pf__chips" role="group" aria-label="Verticals">
        <button type="button" className="chip" aria-pressed={vertical === -1} onClick={() => showVertical(-1)}>
          All
        </button>
        {VERTICALS.map((v, i) => (
          <button key={v.name} type="button" className="chip" aria-pressed={vertical === i} onClick={() => showVertical(i)}>
            {v.name}
          </button>
        ))}
      </div>

      <div className="pf__main">
        {shown.length === 0 ? (
          <div className="pf__none">Nothing in the portfolio matches “{query.trim()}”</div>
        ) : view === 'icons' ? (
          <div ref={files} className="pf__icons scrolls" role="listbox" aria-label={`${name}: ${count}`} aria-orientation="horizontal" onKeyDown={onKey}>
            {shown.map((c) => {
              const on = c === chosen
              return (
                <button
                  key={c.name}
                  type="button"
                  className="pf-file"
                  role="option"
                  aria-selected={on}
                  tabIndex={on ? 0 : -1}
                  data-company={c.name}
                  title={c.blurb ? `${c.name}: ${c.blurb}` : c.name}
                  onClick={() => pickCompany(c.name)}
                  onDoubleClick={() => openCompany(c)}
                >
                  <span className="pf-file__icon">
                    <CompanyLogo company={c} size={60} />
                  </span>
                  <span className="pf-file__name">{c.name}</span>
                </button>
              )
            })}
          </div>
        ) : (
          <div ref={files} className="pf__list scrolls" role="listbox" aria-label={`${name}: ${count}`} onKeyDown={onKey}>
            <div className="pf-row pf-row--head" aria-hidden>
              <span>Name</span>
              <span>Vertical</span>
              <span>About</span>
            </div>
            {shown.map((c) => {
              const on = c === chosen
              return (
                <button key={c.name} type="button" className="pf-row" role="option" aria-selected={on} tabIndex={on ? 0 : -1} data-company={c.name} onClick={() => pickCompany(c.name)} onDoubleClick={() => openCompany(c)}>
                  <span className="pf-row__name">
                    <CompanyLogo company={c} size={18} />
                    <span>{c.name}</span>
                  </span>
                  <span>{c.vertical}</span>
                  <span>{c.blurb ?? (c.url ? hostOf(c.url) : '')}</span>
                </button>
              )
            })}
          </div>
        )}
        {chosen && <Preview company={chosen} />}
      </div>

      <div className="pf__foot">
        <span className="pf__path">
          <span className="pf__path-icon">
            <FolderIcon />
          </span>
          Portfolio
          <ChevronRight size={11} strokeWidth={2} aria-hidden />
          <b>{name}</b>
          {chosen && (
            <>
              <ChevronRight size={11} strokeWidth={2} aria-hidden />
              <CompanyLogo company={chosen} size={14} />
              <b>{chosen.name}</b>
            </>
          )}
        </span>
        <span className="pf__count" role="status">
          {count}
        </span>
      </div>
    </Window>
  )
}
