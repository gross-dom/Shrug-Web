import { useMemo } from 'react'
import { ChevronLeft, ChevronRight, Folder, LayoutGrid, List } from 'lucide-react'
import { COMPANY_COUNT, VERTICALS } from '../data/portfolio'
import { Window } from '../kit/window'
import { FolderIcon } from '../os/icons'
import { useStore } from '../os/store'
import { finder, pickCompany, setFinderQuery, setFinderView, showVertical, stepVertical } from './state'
import { SearchField, SideLabel, ToolSet, ToolSetButton } from './ui'

// The portfolio as a Finder window: verticals down the sidebar, the companies
// in the one that's picked as folders, in icons or a list. Back and Forward
// retrace the verticals visited; the search narrows whatever is showing.

interface Company {
  name: string
  vertical: string
}

const ALL: Company[] = VERTICALS.flatMap((v) => v.companies.map((name) => ({ name, vertical: v.name })))

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

export function FinderApp() {
  const { vertical, view, query, at, trail, picked } = useStore(finder, (s) => s)
  const name = vertical === -1 ? 'All' : VERTICALS[vertical]!.name
  const q = query.trim().toLowerCase()
  const shown = useMemo(() => {
    const base = vertical === -1 ? ALL : ALL.filter((c) => c.vertical === VERTICALS[vertical]!.name)
    return q ? base.filter((c) => c.name.toLowerCase().includes(q) || c.vertical.toLowerCase().includes(q)) : base
  }, [vertical, q])
  const chosen = shown.find((c) => c.name === picked) ?? null
  const count = `${shown.length} ${shown.length === 1 ? 'company' : 'companies'}`

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

      {view === 'icons' ? (
        <div className="pf__icons scrolls" tabIndex={-1} onPointerDown={(e) => e.target === e.currentTarget && pickCompany(null)}>
          {shown.map((c) => (
            <button key={`${c.vertical}/${c.name}`} type="button" className="pf-file" aria-pressed={picked === c.name} title={`${c.name} · ${c.vertical}`} onClick={() => pickCompany(c.name)}>
              <span className="pf-file__icon">
                <FolderIcon />
              </span>
              <span className="pf-file__name">{c.name}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="pf__list scrolls" role="table" aria-label={`${name}: ${count}`}>
          <div className="pf-row pf-row--head" role="row">
            <span role="columnheader">Name</span>
            <span role="columnheader">Vertical</span>
            <span role="columnheader">Kind</span>
          </div>
          {shown.map((c) => (
            <button key={`${c.vertical}/${c.name}`} type="button" className="pf-row" role="row" aria-pressed={picked === c.name} onClick={() => pickCompany(c.name)}>
              <span className="pf-row__name" role="cell">
                <span className="pf-row__icon">
                  <FolderIcon />
                </span>
                {c.name}
              </span>
              <span role="cell">{c.vertical}</span>
              <span role="cell">Company</span>
            </button>
          ))}
        </div>
      )}
      {shown.length === 0 && <div className="pf__none">Nothing in the portfolio matches “{query.trim()}”</div>}

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
              <b>{chosen.name}</b>
            </>
          )}
        </span>
        <span className="pf__count" role="status">
          {chosen ? `1 of ${shown.length} selected` : count}
        </span>
      </div>
    </Window>
  )
}
