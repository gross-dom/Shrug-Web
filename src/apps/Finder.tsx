import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { ArrowUpRight, ChevronLeft, ChevronRight, Folder, LayoutGrid, List } from 'lucide-react'
import { peopleOf } from '../data/founders'
import { PEOPLE } from '../data/people'
import { COMPANY_COUNT, VERTICALS } from '../data/portfolio'
import { Window } from '../kit/window'
import { FolderIcon } from '../os/icons'
import { showReply } from '../os/launch'
import { shrug } from '../os/shrug'
import { useStore } from '../os/store'
import { GROUP_NAME, PersonAvatar } from './chat-ui'
import { companiesIn, CompanyLogo, fateOf, hostOf, openCompany, tellApart, visitLabel, type Listed } from './portfolio-ui'
import { finder, pickCompany, setFinderQuery, setFinderView, showVertical, sought, stepVertical } from './state'
import { SearchField, SideLabel, ToolSet, ToolSetButton } from './ui'

// The portfolio as a Finder window: verticals down the sidebar, and the
// companies in the one that's picked, each under its own logo, in icons or a
// list. All is every company in the order Shrug lists them. One is always
// selected, and the preview beside them says what it does and links to it;
// where someone in the group chat speaks for the company (src/data/founders.ts)
// the preview has the way to what they said.
// Back and Forward retrace the verticals visited; the search narrows whatever
// is showing. A company with no site says so where its link would be, and a
// double-click on one is answered there rather than by nothing.

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

/** The way in to a company: the link to its site, or, for one with no site, the line that says so.
 * `nudge` counts the times that company was asked to open with nothing to open: the line stirs each time.
 * A company's own site is told where a visit came from (`noopener`, not `noreferrer`). */
function WayIn({ company, at, nudge = 0 }: { company: Listed; at: 'preview' | 'foot'; nudge?: number }) {
  const visit = visitLabel(company)
  if (company.url && visit)
    return (
      <a className={at === 'preview' ? 'pf-preview__visit' : 'pf__foot-visit'} href={company.url} target="_blank" rel="noopener" draggable={false}>
        <span>{visit}</span>
        <ArrowUpRight size={at === 'preview' ? 13 : 11} strokeWidth={2.2} aria-hidden />
        <span className="sr-only">, opens in a new tab</span>
      </a>
    )
  return (
    <span key={nudge} className={at === 'preview' ? 'pf-preview__fate' : 'pf__foot-fate'} data-nudged={nudge ? '' : undefined}>
      {fateOf(company)}
    </span>
  )
}

/** The selected company, as a Finder preview shows a file: its icon, what it is, and a way in. Where its
 * founder is in the group chat, the way to what they said about Shrug is here too. */
function Preview({ company, nudge }: { company: Listed; nudge: number }) {
  const apart = tellApart(company)
  const voices = peopleOf(company.key)
  return (
    <aside className="pf-preview" aria-label={`${company.name}, ${company.vertical}`}>
      <CompanyLogo company={company} size={88} />
      <div className="pf-preview__text">
        <h2 className="pf-preview__name">{company.name}</h2>
        <div className="pf-preview__kind">
          {company.vertical}
          {apart && ` · ${apart}`}
        </div>
        {company.blurb && <p className="pf-preview__blurb">{company.blurb}</p>}
      </div>
      <WayIn company={company} at="preview" nudge={nudge} />
      {voices.length > 0 && (
        <div className="pf-preview__voices">
          {voices.map((person) => (
            <button key={person} type="button" className="pf-preview__voice" onClick={() => showReply(person)}>
              <PersonAvatar index={person} size={26} />
              <span className="pf-preview__voice-text">
                <b>{PEOPLE[person]!.name}</b>
                <span>in {GROUP_NAME}</span>
              </span>
              <ChevronRight size={13} strokeWidth={2.2} aria-hidden />
            </button>
          ))}
        </div>
      )}
    </aside>
  )
}

export function FinderApp() {
  const { vertical, view, query, at, trail, picked } = useStore(finder, (s) => s)
  const name = vertical === -1 ? 'All' : VERTICALS[vertical]!.name
  const shown = useMemo(() => companiesIn(vertical, query), [vertical, query])
  // A search that finds no company: the mark in the menu bar shrugs. Once as the window comes up empty,
  // not again for each letter typed after that
  const none = shown.length === 0
  useEffect(() => {
    if (none) shrug()
  }, [none])
  // Something is always selected: the one that was picked, or the first showing
  const chosen = shown.find((c) => c.key === picked) ?? shown[0] ?? null
  const count = `${shown.length} ${shown.length === 1 ? 'company' : 'companies'}`
  const files = useRef<HTMLDivElement>(null)
  /** A company with no site was asked to open: which, and how many times that has happened. */
  const [asked, setAsked] = useState<{ key: string; times: number } | null>(null)
  const nudge = chosen && asked?.key === chosen.key ? asked.times : 0

  // What was said about it is said once: a moment later the line is at rest again
  useEffect(() => {
    if (!asked) return
    const t = setTimeout(() => setAsked(null), 2400)
    return () => clearTimeout(t)
  }, [asked])

  /** Opens a company's site. One with no site has nothing to open: it is selected, and the line where
   * its link would be says so (aloud too), so that a double-click or Return is never met with nothing. */
  const open = (company: Listed) => {
    if (openCompany(company)) return
    pickCompany(company.key)
    setAsked((was) => ({ key: company.key, times: (was?.key === company.key ? was.times : 0) + 1 }))
  }

  // Picked from somewhere else (a link, a person's card, the terminal), the company may be far down the
  // window: it is brought into sight. One picked by hand is already there, and nothing moves
  const chosenKey = chosen?.key ?? null
  useEffect(() => {
    if (!chosenKey) return
    const box = files.current
    const tile = box && Array.from(box.querySelectorAll<HTMLElement>('[data-company]')).find((el) => el.dataset.company === chosenKey)
    if (!box || !tile) return
    const around = box.getBoundingClientRect()
    const at = tile.getBoundingClientRect()
    if (at.top < around.top || at.bottom > around.bottom) tile.scrollIntoView({ block: 'center' })
  }, [chosenKey, view])

  /** From the search field into what it found: the first company showing takes the keyboard. */
  const intoResults = () => files.current?.querySelector<HTMLElement>('[data-company][tabindex="0"]')?.focus()

  /** Arrows walk the companies, the way they walk a Finder window; Return opens the one selected. */
  const onKey = (e: KeyboardEvent) => {
    const box = files.current
    if (!box || !chosen) return
    if (e.key === 'Enter') return void (e.preventDefault(), open(chosen))
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
    pickCompany(shown[next]!.key)
    tiles[next]?.focus()
  }

  return (
    <Window
      className="app pf"
      sidebar={<Sidebar />}
      // Wide enough for the longest vertical's name (“Social is Hard” — Evan) beside its count
      sidebarWidth={226}
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
            <SearchField value={query} onChange={setFinderQuery} label="Search the portfolio" onEnter={intoResults} onArrowDown={intoResults} />
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

      <div className="pf__main" data-view={view}>
        {shown.length === 0 ? (
          <div className="pf__none" role="status">
            <b>No Results for “{sought(query)}”</b>
            <span>Check the spelling or try a new search.</span>
          </div>
        ) : view === 'icons' ? (
          <div ref={files} className="pf__icons scrolls" role="listbox" aria-label={`${name}: ${count}`} aria-orientation="horizontal" onKeyDown={onKey}>
            {shown.map((c) => {
              const on = c === chosen
              // Two companies share a name: each carries its address under it
              const apart = tellApart(c)
              return (
                <button
                  key={c.key}
                  type="button"
                  className="pf-file"
                  role="option"
                  aria-selected={on}
                  tabIndex={on ? 0 : -1}
                  data-company={c.key}
                  title={`${c.name}: ${c.blurb ?? (c.url ? hostOf(c.url) : fateOf(c))}`}
                  onClick={() => pickCompany(c.key)}
                  onDoubleClick={() => open(c)}
                >
                  <span className="pf-file__icon">
                    <CompanyLogo company={c} size={60} />
                  </span>
                  <span className="pf-file__name">{c.name}</span>
                  {apart && <span className="pf-file__host">{apart}</span>}
                </button>
              )
            })}
          </div>
        ) : (
          <div ref={files} className="pf__list scrolls" role="listbox" aria-label={`${name}: ${count}`} onKeyDown={onKey}>
            <div className="pf-row pf-row--head" aria-hidden>
              <span>Name</span>
              <span className="pf-row__vertical">Vertical</span>
              <span>About</span>
            </div>
            {shown.map((c) => {
              const on = c === chosen
              const apart = tellApart(c)
              // What it does; failing that where it lives; failing that, that it has nowhere
              const about = c.blurb ?? (c.url ? hostOf(c.url) : fateOf(c)) ?? ''
              return (
                <button key={c.key} type="button" className="pf-row" role="option" aria-selected={on} tabIndex={on ? 0 : -1} data-company={c.key} onClick={() => pickCompany(c.key)} onDoubleClick={() => open(c)}>
                  <span className="pf-row__name" title={apart ? `${c.name} (${apart})` : c.name}>
                    <CompanyLogo company={c} size={18} />
                    <span>{c.name}</span>
                    {apart && <span className="pf-row__host">{apart}</span>}
                  </span>
                  <span className="pf-row__vertical" title={c.vertical}>
                    {c.vertical}
                  </span>
                  <span title={about}>{about}</span>
                </button>
              )
            })}
          </div>
        )}
        {chosen && <Preview company={chosen} nudge={nudge} />}
      </div>

      <div className="pf__foot" data-view={view}>
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
        <span className="pf__foot-end">
          {/* In a list too narrow to keep the preview beside it, the way in to the company is here instead */}
          {chosen && <WayIn company={chosen} at="foot" nudge={nudge} />}
          <span className="pf__count" role="status">
            {count}
          </span>
        </span>
        {/* Said aloud when a company with no site is asked to open */}
        <span className="sr-only" role="status">
          {chosen && nudge ? `${chosen.name}: ${fateOf(chosen)}.` : ''}
        </span>
      </div>
    </Window>
  )
}
