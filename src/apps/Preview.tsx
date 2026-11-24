import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, Download, FileQuestion, Lock, Maximize2, PanelLeft, ZoomIn, ZoomOut } from 'lucide-react'
import { ONE_PAGER as PAGE } from '../data/onepager'
import { Window } from '../kit/window'
import { account, askLogIn } from '../os/account'
import { ONE_PAGER, paperOf, preview, type Paper, type Sheet } from '../os/papers'
import { useStore } from '../os/store'
import { closeApp, wm } from '../os/wm'
import { ONE_PAGER_SHEETS } from './preview/OnePager'
import { openPdf, type Pdf } from './preview/pdf'
import '../styles/desk/v1.css'
import '../styles/desk/preview.css'

// Preview: the one viewer every document opens in (design/v1, "Preview"), after the Mac's own. One row of
// bar: the sidebar's switch, the file's name over which page it is on, the zoom, Download and Full Screen.
// Under it the pages' thumbnails down the left and the pages themselves, one under the next, on Preview's
// grey. There are no tools for editing: a document is read here.
//
// A document's pages are either drawn by the site (the one-pager's: preview/OnePager.tsx) or a PDF's, which
// pdf.js draws (preview/pdf.ts) from bytes fetched when it is opened. A private document is tagged Private
// by its name, has "Prepared for" and its reader's name under its pages, and may have Download switched off.
// (That line is the page's, here: it is not stamped into the file.)

/** A page as the window draws it: its size at 96 to the inch, and itself at any scale. */
interface Leaf {
  w: number
  h: number
  draw: (scale: number, seen: Element | null) => ReactNode
}

type Shown = { is: 'loading' } | { is: 'pages'; leaves: Leaf[] } | { is: 'missing' | 'offline' | 'not-yours' | 'anon' }

/** A PDF's point is a 72nd of an inch, and the pages here are measured at 96 to the inch. */
const PER_POINT = 96 / 72
/** What the bar's percentage is of: Preview's 100% draws a point of the page as a point of the screen. */
const percent = (scale: number) => Math.round(scale * PER_POINT * 100)
const LEAST = 0.2
const MOST = 4
const STEP = 1.25

/** The one-pager, as a paper: anyone's to read and to save. */
const onePager: Paper = {
  id: ONE_PAGER,
  name: PAGE.file,
  preparedFor: null,
  pages: { kind: 'sheets', sheets: ONE_PAGER_SHEETS },
  download: () => {
    const link = Object.assign(document.createElement('a'), { href: `${import.meta.env.BASE_URL}${PAGE.file}`, download: PAGE.file })
    document.body.append(link)
    link.click()
    link.remove()
  },
}

// ---- Pages

/** A page the site draws itself, at any size: it is laid out once, at its own size, and scaled. */
function SheetPage({ sheet, scale }: { sheet: Sheet; scale: number }) {
  return (
    <div className="pv-sheet" style={{ width: sheet.w, height: sheet.h, transform: `scale(${scale})` }}>
      {sheet.draw()}
    </div>
  )
}

/** A PDF's page, drawn by pdf.js when it is near enough to be seen, and again, a moment after, at each new size. */
function PdfPage({ pdf, n, w, h, scale, seen }: { pdf: Pdf; n: number; w: number; h: number; scale: number; seen: Element | null }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [near, setNear] = useState(false)
  useEffect(() => {
    const el = canvas.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') return setNear(true)
    const watch = new IntersectionObserver((entries) => entries.some((entry) => entry.isIntersecting) && setNear(true), { root: seen, rootMargin: '100% 0px' })
    watch.observe(el)
    return () => watch.disconnect()
  }, [seen])
  useEffect(() => {
    if (!near) return
    let gone = false
    let task: { cancel(): void; promise: Promise<unknown> } | null = null
    // Drawn off the page and then put on it whole, so that a page being drawn again is never seen half done
    const timer = setTimeout(async () => {
      try {
        const page = await pdf.getPage(n)
        if (gone) return
        const dense = Math.min(window.devicePixelRatio || 1, 2)
        const viewport = page.getViewport({ scale: scale * PER_POINT * dense })
        const off = document.createElement('canvas')
        off.width = Math.max(1, Math.floor(viewport.width))
        off.height = Math.max(1, Math.floor(viewport.height))
        task = page.render({ canvas: off, viewport })
        await task.promise
        const on = canvas.current
        if (gone || !on) return
        on.width = off.width
        on.height = off.height
        on.getContext('2d')?.drawImage(off, 0, 0)
        on.dataset.drawn = ''
      } catch {
        // Stopped because the size changed again, or the document closed: the next drawing is on its way
      }
    }, 90)
    return () => {
      gone = true
      clearTimeout(timer)
      task?.cancel()
    }
  }, [pdf, n, scale, near])
  return <canvas ref={canvas} className="pv-canvas" style={{ width: Math.round(w * scale), height: Math.round(h * scale) }} />
}

/** What a paper's pages are, once they can be drawn. A PDF is fetched and opened here. */
function useShown(paper: Paper | null, again: number): Shown {
  const [shown, setShown] = useState<Shown>({ is: 'loading' })
  useEffect(() => {
    if (!paper) return setShown({ is: 'loading' })
    if (paper.pages.kind === 'sheets') {
      const sheets = paper.pages.sheets
      return setShown({ is: 'pages', leaves: sheets.map((sheet) => ({ w: sheet.w, h: sheet.h, draw: (scale) => <SheetPage sheet={sheet} scale={scale} /> })) })
    }
    // One that is not theirs is not asked for at all: the server would only say so
    if (paper.ask) return setShown({ is: 'not-yours' })
    let gone = false
    let opened: Pdf | null = null
    setShown({ is: 'loading' })
    const read = paper.pages.read
    void (async () => {
      const got = await read()
      if (gone) return
      if ('error' in got) return setShown({ is: got.error })
      try {
        const pdf = await openPdf(got)
        opened = pdf
        const leaves: Leaf[] = []
        for (let n = 1; n <= pdf.numPages; n++) {
          const page = await pdf.getPage(n)
          const { width, height } = page.getViewport({ scale: PER_POINT })
          leaves.push({ w: width, h: height, draw: (scale, seen) => <PdfPage pdf={pdf} n={n} w={width} h={height} scale={scale} seen={seen} /> })
        }
        if (gone) return void pdf.loadingTask.destroy()
        setShown({ is: 'pages', leaves })
      } catch {
        if (!gone) setShown({ is: 'missing' })
      }
    })()
    return () => {
      gone = true
      void opened?.loadingTask.destroy()
    }
    // (a paper is the same paper while its id is: what else it carries may be made again around it)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paper?.id, !!paper?.ask, again])
  return shown
}

// ---- The window

export function PreviewApp() {
  const open = useStore(wm, (s) => s.wins.preview.open)
  const held = useStore(preview, (s) => s)
  const who = useStore(account, (s) => s)

  // A document to go back to (a reload with one open): found again once it is known who is logged in. One
  // that is not theirs any more is not shown, and neither is another document in its place
  useEffect(() => {
    if (!held.wanted || who.status === 'checking') return
    const doc = who.status === 'member' ? who.docs.find((d) => `update:${d.id}` === held.wanted) : null
    if (doc) return preview.set({ paper: paperOf(doc), wanted: null })
    preview.set({ paper: null, wanted: null })
    if (wm.get().wins.preview.open) closeApp('preview')
  }, [held.wanted, who])

  // With nothing else open in it, Preview has the one-pager. Nothing is fetched or drawn while its window is shut
  const paper = !open ? null : held.wanted ? null : (held.paper ?? onePager)
  const [again, setAgain] = useState(0)
  const shown = useShown(paper, again)
  const leaves = shown.is === 'pages' ? shown.leaves : null

  const main = useRef<HTMLDivElement>(null)
  const [room, setRoom] = useState({ w: 0, h: 0 })
  const [zoom, setZoom] = useState<number | null>(null)
  const [at, setAt] = useState(0)
  const [side, setSide] = useState<boolean | null>(null)
  const [full, setFull] = useState(false)
  const fullButton = useRef<HTMLButtonElement>(null)

  // A new document begins at its first page, fitted to the window
  useEffect(() => {
    setZoom(null)
    setAt(0)
    setFull(false)
    main.current?.scrollTo(0, 0)
  }, [paper?.id])

  useLayoutEffect(() => {
    const el = main.current
    if (!el) return
    const measure = () => setRoom({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const watch = new ResizeObserver(measure)
    watch.observe(el)
    return () => watch.disconnect()
  }, [open, shown.is])

  // Fitted: the page it is on, whole, in the room there is, with Preview's margin round it
  const first = leaves?.[Math.min(at, leaves.length - 1)]
  const under = paper?.preparedFor != null ? 44 : 24
  const fit = first && room.w ? Math.max(LEAST, Math.min((room.h - 24 - under) / first.h, (room.w - 48) / first.w)) : 0.6
  const scale = zoom ?? fit
  const thumbs = side ?? (!!leaves && leaves.length > 1 && room.w + 150 >= 640)

  /** The page the middle of the window is on. */
  const follow = () => {
    const el = main.current
    if (!el) return
    const middle = el.getBoundingClientRect().top + el.clientHeight / 2
    const pages = Array.from(el.querySelectorAll<HTMLElement>('[data-page]'))
    const on = pages.findIndex((page) => page.getBoundingClientRect().bottom >= middle)
    setAt(Math.max(0, on < 0 ? pages.length - 1 : on))
  }
  const goTo = useCallback((n: number) => {
    const el = main.current
    const page = el?.querySelector<HTMLElement>(`[data-page="${n}"]`)
    if (!el || !page) return
    el.scrollTo({ top: Math.max(0, page.offsetTop - 24) })
    setAt(n)
  }, [])
  const step = (by: number) => leaves && goTo(Math.max(0, Math.min(leaves.length - 1, at + by)))
  const zoomBy = (by: number) => setZoom(Math.max(LEAST, Math.min(MOST, scale * by)))

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.altKey || e.ctrlKey || e.metaKey || !leaves) return
    const move = e.key === 'ArrowRight' || e.key === 'PageDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'PageUp' ? -1 : 0
    if (move) return e.preventDefault(), step(move)
    if (e.key === 'Home') return e.preventDefault(), goTo(0)
    if (e.key === 'End') return e.preventDefault(), goTo(leaves.length - 1)
    if (e.key === '+' || e.key === '=') return e.preventDefault(), zoomBy(STEP)
    if (e.key === '-') return e.preventDefault(), zoomBy(1 / STEP)
    if (e.key === '0') return e.preventDefault(), setZoom(null)
  }

  const says =
    !paper || shown.is === 'loading'
      ? 'Loading…'
      : shown.is === 'pages'
        ? shown.leaves.length === 1
          ? '1 page'
          : `Page ${Math.min(at, shown.leaves.length - 1) + 1} of ${shown.leaves.length}`
        : shown.is === 'not-yours' || shown.is === 'anon'
          ? 'Not shown'
          : shown.is === 'offline'
            ? 'Not loaded'
            : 'Not found'
  const canSave = !!paper?.download && shown.is === 'pages'

  const bar = (
    <div className="pvbar">
      <span className="v-tb">
        <button type="button" aria-label={thumbs ? 'Hide Sidebar' : 'Show Sidebar'} aria-pressed={thumbs} aria-disabled={!leaves || undefined} onClick={() => leaves && setSide(!thumbs)}>
          <PanelLeft size={16} strokeWidth={1.9} aria-hidden />
        </button>
      </span>
      <span className="pvbar__name">
        <span className="pvbar__title">
          <b>{paper?.name ?? PAGE.file}</b>
          {paper?.preparedFor != null && (
            <span className="v-chip v-chip--lock pvbar__private">
              <Lock size={9} strokeWidth={2.6} aria-hidden />
              Private
            </span>
          )}
        </span>
        <span className="pvbar__sub" aria-live="polite">
          {says}
        </span>
      </span>
      <span className="pvbar__grow" />
      <span className="v-tb" role="group" aria-label="Zoom">
        <button type="button" aria-label="Zoom Out" aria-disabled={!leaves || scale <= LEAST || undefined} onClick={() => leaves && zoomBy(1 / STEP)}>
          <ZoomOut size={16} strokeWidth={1.9} aria-hidden />
        </button>
        <button type="button" className="pvbar__pct" aria-label={`${percent(scale)}%. Zoom to Fit`} aria-disabled={!leaves || undefined} onClick={() => setZoom(null)}>
          {percent(scale)}%
        </button>
        <button type="button" aria-label="Zoom In" aria-disabled={!leaves || scale >= MOST || undefined} onClick={() => leaves && zoomBy(STEP)}>
          <ZoomIn size={16} strokeWidth={1.9} aria-hidden />
        </button>
      </span>
      <span className="v-tb">
        <button
          type="button"
          aria-label={paper && !paper.download ? 'Download: switched off for this document' : 'Download'}
          aria-disabled={!canSave || undefined}
          onClick={() => canSave && void paper?.download?.()}
        >
          <Download size={16} strokeWidth={1.9} aria-hidden />
        </button>
        <button ref={fullButton} type="button" aria-label="Full Screen" aria-disabled={!leaves || undefined} onClick={() => leaves && setFull(true)}>
          <Maximize2 size={15} strokeWidth={1.9} aria-hidden />
        </button>
      </span>
    </div>
  )

  return (
    <Window className="app v1 pvwin" lightsSize="large" lead={bar} body={{ className: 'pvwin__body' }}>
      {(!paper || shown.is === 'loading') && <i className="pv-load" aria-hidden />}
      <div className="pv">
        {(!paper || shown.is === 'loading') && (
          <>
            <aside className="pv-thumbs" aria-hidden>
              <div className="pv-thumb" />
              <div className="pv-thumb" />
            </aside>
            <div className="pv-main" role="status" aria-label="Loading the document">
              <div className="pv-page pv-page--skel">
                <div className="pv-skel">
                  <i style={{ width: '40%' }} />
                  <i style={{ height: 34, width: '86%' }} />
                  <i style={{ height: 34, width: '62%' }} />
                  <i />
                  <i />
                  <i style={{ width: '70%' }} />
                  <i style={{ height: 70, marginTop: 12 }} />
                  <i />
                  <i style={{ width: '80%' }} />
                </div>
              </div>
            </div>
          </>
        )}
        {paper && leaves && (
          <>
            {thumbs && (
              <nav className="pv-thumbs" aria-label="Pages">
                {leaves.map((leaf, n) => {
                  const wide = leaf.w > leaf.h
                  const small = 98 / leaf.w
                  return (
                    <button key={n} type="button" className="pv-thumbcell" aria-current={n === at ? 'page' : undefined} onClick={() => goTo(n)}>
                      <span className={`pv-thumb${wide ? ' wide' : ''}`} style={{ height: Math.round(leaf.h * small) }} aria-hidden>
                        {leaf.draw(small, null)}
                      </span>
                      <span>
                        <span className="sr-only">Page </span>
                        {n + 1}
                      </span>
                    </button>
                  )
                })}
              </nav>
            )}
            <div ref={main} className="pv-main" data-autofocus tabIndex={0} role="group" aria-label={`${paper.name}, ${says}`} onScroll={follow} onKeyDown={onKey}>
              <div className="pv-pages" data-private={paper.preparedFor != null || undefined}>
                {leaves.map((leaf, n) => (
                  <div key={n} className="pv-page" data-page={n} style={{ width: Math.round(leaf.w * scale), height: Math.round(leaf.h * scale) }}>
                    {leaf.draw(scale, main.current)}
                  </div>
                ))}
              </div>
              {paper.preparedFor != null && <span className="pv-for">Prepared for {paper.preparedFor}</span>}
            </div>
          </>
        )}
        {paper && shown.is !== 'loading' && shown.is !== 'pages' && (
          <div className="pv-main pv-main--said">
            <Said paper={paper} what={shown.is} again={() => setAgain((n) => n + 1)} />
          </div>
        )}
      </div>
      {full && paper && leaves && (
        <Full
          paper={paper}
          leaves={leaves}
          at={Math.min(at, leaves.length - 1)}
          onAt={goTo}
          onLeave={() => {
            setFull(false)
            // The keyboard goes back to the button that began it. (While the screen is still the document's a
            // browser lets nothing outside it take the keyboard, so that waits until the screen is given back.)
            const back = () => fullButton.current?.focus()
            if (document.fullscreenElement) document.addEventListener('fullscreenchange', back, { once: true })
            else requestAnimationFrame(back)
          }}
        />
      )}
    </Window>
  )
}

/** What is said where a document's pages would be, when there are none to show. */
function Said({ paper, what, again }: { paper: Paper; what: 'missing' | 'offline' | 'not-yours' | 'anon'; again: () => void }) {
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  if (what === 'not-yours') {
    const ask = paper.ask
    const send = async () => {
      if (!ask || ask.asked || busy) return
      setBusy(true)
      setFailed(false)
      const sent = await ask.send()
      setBusy(false)
      if (sent !== true) setFailed(true)
    }
    return (
      <div className="v-empty">
        <Lock size={38} strokeWidth={1.6} aria-hidden />
        <h3>This one isn’t yours to open</h3>
        <p>{ask ? `It was written for the LPs of ${ask.forWhom}. If you think you should see it, ask and Shrug will take a look.` : 'It was written for the LPs of another fund.'}</p>
        {ask && (
          <button type="button" className="v-btn v-btn--lg" aria-disabled={ask.asked || busy || undefined} onClick={send}>
            {ask.asked ? 'Requested' : busy ? 'Requesting…' : 'Request'}
          </button>
        )}
        {failed && (
          <p className="v-said" role="alert">
            That didn’t send. Try again.
          </p>
        )}
      </div>
    )
  }
  if (what === 'anon')
    return (
      <div className="v-empty">
        <Lock size={38} strokeWidth={1.6} aria-hidden />
        <h3>Log in to open this</h3>
        <p>It is kept to the person it was prepared for.</p>
        <button type="button" className="v-btn v-btn--lg" onClick={() => askLogIn('updates')}>
          Log In
        </button>
      </div>
    )
  return (
    <div className="v-empty">
      <FileQuestion size={38} strokeWidth={1.6} aria-hidden />
      <h3>{what === 'offline' ? 'This file didn’t load' : 'This file can’t be found'}</h3>
      <p>{what === 'offline' ? 'Check your connection, then try again.' : 'It may have been moved or replaced. Nothing is wrong on your side.'}</p>
      <button type="button" className="v-btn v-btn--grey v-btn--lg" onClick={again}>
        Try Again
      </button>
    </div>
  )
}

/** A document in full screen, a page at a time: the arrow keys step through it, and Escape leaves. */
function Full({ paper, leaves, at, onAt, onLeave }: { paper: Paper; leaves: Leaf[]; at: number; onAt: (n: number) => void; onLeave: () => void }) {
  const el = useRef<HTMLDivElement>(null)
  const [screen, setScreen] = useState({ w: window.innerWidth, h: window.innerHeight })
  const leave = useRef(onLeave)
  leave.current = onLeave

  useEffect(() => {
    const node = el.current
    node?.focus()
    // The whole screen, where the browser gives it; where it does not, the whole page
    let whole = false
    void node
      ?.requestFullscreen?.()
      .then(() => (whole = true))
      .catch(() => {})
    const changed = () => {
      if (whole && !document.fullscreenElement) leave.current()
    }
    const sized = () => setScreen({ w: window.innerWidth, h: window.innerHeight })
    document.addEventListener('fullscreenchange', changed)
    window.addEventListener('resize', sized)
    return () => {
      document.removeEventListener('fullscreenchange', changed)
      window.removeEventListener('resize', sized)
      if (document.fullscreenElement === node) void document.exitFullscreen?.().catch(() => {})
    }
  }, [])

  const leaf = leaves[at]!
  const scale = useMemo(() => Math.min((screen.w * 0.94) / leaf.w, (screen.h * 0.94) / leaf.h), [screen, leaf])
  const to = (n: number) => onAt(Math.max(0, Math.min(leaves.length - 1, n)))
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') return e.preventDefault(), e.stopPropagation(), onLeave()
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') return e.preventDefault(), to(at + 1)
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') return e.preventDefault(), to(at - 1)
    if (e.key === 'Home') return e.preventDefault(), to(0)
    if (e.key === 'End') return e.preventDefault(), to(leaves.length - 1)
    // The keyboard stays in here until it is left
    if (e.key === 'Tab') {
      const stops = Array.from(el.current?.querySelectorAll<HTMLElement>('button:not([aria-disabled])') ?? [])
      const on = stops.indexOf(document.activeElement as HTMLElement)
      e.preventDefault()
      stops[(on + (e.shiftKey ? -1 : 1) + stops.length) % stops.length]?.focus()
    }
  }

  return createPortal(
    <div ref={el} className="pv-full" role="dialog" aria-modal aria-label={`${paper.name}, full screen`} tabIndex={-1} onKeyDown={onKey}>
      <div className="pv-page" key={at} style={{ width: Math.round(leaf.w * scale), height: Math.round(leaf.h * scale) }}>
        {leaf.draw(scale, null)}
      </div>
      {paper.preparedFor != null && <span className="pv-for pv-for--full">Prepared for {paper.preparedFor}</span>}
      <div className="pv-hud">
        <button type="button" aria-label="Previous Page" aria-disabled={at === 0 || undefined} onClick={() => to(at - 1)}>
          <ChevronLeft size={16} strokeWidth={2} aria-hidden />
        </button>
        <span className="pv-hud__at" aria-live="polite">
          {at + 1} of {leaves.length}
        </span>
        <button type="button" aria-label="Next Page" aria-disabled={at === leaves.length - 1 || undefined} onClick={() => to(at + 1)}>
          <ChevronRight size={16} strokeWidth={2} aria-hidden />
        </button>
        <span className="pv-hud__rule" aria-hidden>
          |
        </span>
        <span>
          <kbd>←</kbd>
          <kbd>→</kbd> to step
        </span>
        <button type="button" className="pv-hud__leave" onClick={onLeave}>
          <kbd>esc</kbd> to leave
        </button>
      </div>
    </div>,
    // (over the whole desktop, and inside it, where the desktop's own controls begin from nothing)
    document.querySelector('.os') ?? document.body,
  )
}
