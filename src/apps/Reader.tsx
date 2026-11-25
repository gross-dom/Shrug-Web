import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, List } from 'lucide-react'
import type { Inline } from '../data/faqs'
import type { Edition } from '../data/editions'

// The reader: a book from the Library, read a page at a time, after the Mac's own Books as Dom's screenshots
// show it. A black window; the book's name in the middle of its bar, with the way back and the contents at
// its left and the size of the letters at its right; two pages side by side (one, in a narrow window), white
// serif on the black; each page's number under it; and a chevron at either side to turn. The arrow keys turn
// too, and Escape closes the book.
//
// The pages are the browser's own columns: the book's leaves are flowed into columns one page wide, and
// turning slides them along. So the words fall into pages by the size of the window and of the letters, as
// they do in Books, and the count of pages is whatever that comes to.

const SIZES = [15.5, 17.5, 20] as const

export interface Reading {
  edition: Edition
  /** The first page showing, from 0; how many pages there are; and whether two show at once. */
  first: number
  pages: number
  two: boolean
  size: number
  toc: boolean
  turn(by: number): void
  goTo(leaf: string): void
  resize(): void
  setToc(open: boolean): void
  /** For the pages: where they are measured, and told what they came to. */
  flow: React.RefObject<HTMLDivElement>
  clip: React.RefObject<HTMLDivElement>
  step: number
  measure(): void
}

/** A book being read: where it is in it, and the turning. (The bar and the pages are drawn apart: this is what they share.) */
export function useReading(edition: Edition | null): Reading | null {
  const flow = useRef<HTMLDivElement>(null)
  const clip = useRef<HTMLDivElement>(null)
  const [first, setFirst] = useState(0)
  const [geo, setGeo] = useState({ pages: 1, two: true, step: 0 })
  const [size, setSize] = useState(1)
  const [toc, setToc] = useState(false)
  const id = edition?.of ?? null
  useEffect(() => {
    setFirst(0)
    setToc(false)
  }, [id])

  const measure = useCallback(() => {
    const view = clip.current
    const el = flow.current
    if (!view || !el) return
    const width = view.clientWidth
    const two = width >= 700
    const gap = two ? 96 : 56
    const page = two ? (width - gap) / 2 : width
    el.style.setProperty('--rd-page', `${page}px`)
    el.style.setProperty('--rd-gap', `${gap}px`)
    const step = page + gap
    const pages = Math.max(1, Math.round((el.scrollWidth + gap) / step))
    setGeo((was) => (was.pages === pages && was.two === two && Math.abs(was.step - step) < 0.5 ? was : { pages, two, step }))
  }, [])

  // Kept on a page that is there, and on the left-hand one of a pair
  const per = geo.two ? 2 : 1
  const last = Math.max(0, Math.ceil(geo.pages / per) * per - per)
  const at = Math.min(first - (first % per), last)
  useEffect(() => {
    if (at !== first) setFirst(at)
  }, [at, first])

  if (!edition) return null
  return {
    edition,
    first: at,
    pages: geo.pages,
    two: geo.two,
    size,
    toc,
    flow,
    clip,
    step: geo.step,
    measure,
    setToc,
    turn: (by) => setFirst((f) => Math.max(0, Math.min(last, f + by * per))),
    goTo: (leaf) => {
      const el = flow.current?.querySelector<HTMLElement>(`[data-leaf="${leaf}"]`)
      if (!el || !flow.current || !geo.step) return
      const page = Math.floor((el.getBoundingClientRect().left - flow.current.getBoundingClientRect().left + 2) / geo.step)
      setFirst(Math.max(0, Math.min(last, page - (page % per))))
      setToc(false)
    },
    resize: () => setSize((s) => (s + 1) % SIZES.length),
  }
}

const words = (parts: Inline[]): ReactNode[] =>
  parts.map((part, n) =>
    typeof part === 'string' ? (
      part
    ) : 'em' in part ? (
      <em key={n}>{part.em}</em>
    ) : 'struck' in part ? (
      <s key={n}>{part.struck}</s>
    ) : 'href' in part ? (
      <a key={n} href={part.href} target="_blank" rel="noopener noreferrer">
        {part.label}
      </a>
    ) : (
      part.label
    ),
  )

/** The reader's bar: back to the Library and the contents; the book's name; the size of the letters, and `end` (what the book costs, and the way to it). */
export function ReaderBar({ reading, onBack, end }: { reading: Reading; onBack: () => void; end?: ReactNode }) {
  const chapters = reading.edition.leaves.filter((leaf) => leaf.kind === 'chapter')
  return (
    <div className="rdbar">
      <span className="rd-tools">
        <button type="button" className="rd-tool rd-back" aria-label="Back to the Library" onClick={onBack}>
          <ChevronLeft size={17} strokeWidth={2.2} aria-hidden />
        </button>
        {chapters.length > 1 && (
          <button type="button" className="rd-tool" aria-label="Contents" aria-expanded={reading.toc} aria-haspopup="dialog" onClick={() => reading.setToc(!reading.toc)}>
            <List size={16} strokeWidth={2} aria-hidden />
          </button>
        )}
      </span>
      <b className="rdbar__title">{reading.edition.title}</b>
      <span className="rd-tools rd-tools--end">
        <button type="button" className="rd-tool" aria-label={`Text size: ${['small', 'medium', 'large'][reading.size]}. Change it`} onClick={reading.resize}>
          <span className="rd-aa" aria-hidden>
            <small>A</small>A
          </span>
        </button>
        {end}
      </span>
    </div>
  )
}

/** The pages. */
export function ReaderPages({ reading, onBack }: { reading: Reading; onBack: () => void }) {
  const { edition, first, pages, two, flow, clip, step, measure } = reading
  const root = useRef<HTMLDivElement>(null)

  // Measured when it is first drawn, when the window or the letters change size, and as its pictures arrive
  useLayoutEffect(measure, [measure, edition.of, reading.size])
  useEffect(() => {
    const view = clip.current
    if (!view) return
    const seen = new ResizeObserver(measure)
    seen.observe(view)
    // (letters that arrive late change where the words fall)
    void document.fonts?.ready.then(measure)
    return () => seen.disconnect()
  }, [clip, measure, edition.of])
  useEffect(() => root.current?.focus({ preventScroll: true }), [edition.of])

  const chapters = edition.leaves.filter((leaf) => leaf.kind === 'chapter')
  const lastPage = Math.min(pages, first + (two ? 2 : 1))
  return (
    <div
      ref={root}
      className="rd"
      tabIndex={-1}
      role="group"
      aria-label={`${edition.title}: page ${first + 1}${two && first + 2 <= pages ? ` and ${first + 2}` : ''} of ${pages}`}
      style={{ ['--rd-size' as string]: `${SIZES[reading.size]}px` }}
      onKeyDown={(e) => {
        if (e.metaKey || e.ctrlKey || e.altKey) return
        if (e.key === 'ArrowRight' || e.key === 'PageDown' || (e.key === ' ' && !e.shiftKey)) e.preventDefault(), reading.turn(1)
        else if (e.key === 'ArrowLeft' || e.key === 'PageUp' || (e.key === ' ' && e.shiftKey)) e.preventDefault(), reading.turn(-1)
        else if (e.key === 'Escape') e.preventDefault(), e.stopPropagation(), reading.toc ? reading.setToc(false) : onBack()
      }}
    >
      <button type="button" className="rd-turn rd-prev" aria-label="Previous page" aria-disabled={first === 0 || undefined} onClick={() => reading.turn(-1)}>
        <ChevronLeft size={30} strokeWidth={1.4} aria-hidden />
      </button>
      <div ref={clip} className="rd-clip">
        <div ref={flow} className="rd-flow" style={{ transform: `translateX(${-first * step}px)` }}>
          {edition.leaves.map((leaf, n) =>
            leaf.kind === 'title' ? (
              <div key={n} className="rd-title" data-leaf="title">
                <h1>{leaf.title}</h1>
                <p>{leaf.by}</p>
                <small>{leaf.note}</small>
              </div>
            ) : leaf.kind === 'plate' ? (
              <figure key={n} className="rd-plate" data-leaf={leaf.id}>
                <img src={leaf.src} srcSet={leaf.set} sizes="(max-width: 900px) 90vw, 45vw" alt={leaf.alt} draggable={false} onLoad={measure} />
              </figure>
            ) : (
              <section key={n} className="rd-chapter" data-leaf={leaf.id}>
                <h2>{leaf.title}</h2>
                {leaf.blocks.map((block, b) =>
                  block.kind === 'list' ? (
                    <ul key={b}>
                      {block.items.map((item, i) => (
                        <li key={i}>{words(item)}</li>
                      ))}
                    </ul>
                  ) : (
                    <p key={b}>{words(block.parts)}</p>
                  ),
                )}
              </section>
            ),
          )}
        </div>
      </div>
      <button type="button" className="rd-turn rd-next" aria-label="Next page" aria-disabled={lastPage >= pages || undefined} onClick={() => reading.turn(1)}>
        <ChevronRight size={30} strokeWidth={1.4} aria-hidden />
      </button>
      <p className="rd-nums" aria-hidden data-two={two || undefined}>
        <span>
          {first + 1} of {pages}
        </span>
        {two && <span>{first + 2 <= pages ? `${first + 2} of ${pages}` : ''}</span>}
      </p>
      <p className="rd-left" role="status">
        {pages - lastPage === 0 ? 'The last page' : `${pages - lastPage} ${pages - lastPage === 1 ? 'page' : 'pages'} left`}
      </p>
      {reading.toc && (
        <div className="rd-toc" role="dialog" aria-label="Contents">
          <h3>Contents</h3>
          <ol>
            {chapters.map((leaf) => (
              <li key={leaf.kind === 'chapter' ? leaf.id : ''}>
                <button type="button" onClick={() => leaf.kind === 'chapter' && reading.goTo(leaf.id)}>
                  {leaf.kind === 'chapter' ? leaf.title : ''}
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}
