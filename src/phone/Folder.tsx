import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { ALL, CompanyLogo, type Listed } from '../apps/portfolio-ui'
import { FAQS } from '../data/faqs'
import { prefersReducedMotion } from '../os/dom'
import { focusFirst, focusLost } from '../os/focus'
import { useStore } from '../os/store'
import { cardsFor, companySheet, FAQS_FOLDER, noteView } from './apps/routes'
import { closeSheet, launchAt, openSheet, sys } from './system'
import { scaleOf } from './ui'
import '../styles/phone/folder.css'

// The two folders on the Home Screen, Portfolio and FAQs, as an iPhone has
// folders: a square of frosted glass with a little of what is inside showing
// through it and its name underneath, which opens where it is into a larger
// piece of glass with everything in it. Portfolio holds the companies, each
// under its logo the way a folder holds apps, nine to a page; FAQs holds the
// questions, as the titles of the notes they are. Picking one opens it in its
// app: a company in Wallet, a question in Notes.
//
// An open folder is a step in the phone's history like any other place (it is
// kept as the sheet over the Home Screen), so the browser's back closes it.
//
// How large a closed folder is drawn goes by the room the screen has: two
// icons tall among the widgets where that fits, an ordinary icon-sized folder
// among the icons where it does not. That is the stylesheet's doing
// (src/styles/phone/folder.css); what is drawn here is the same either way.

type FolderId = 'portfolio' | 'faqs'

const NAME: Record<FolderId, string> = { portfolio: 'Portfolio', faqs: 'FAQs' }

/** The name an open folder has in `sys.sheet`. */
const sheetOf = (id: FolderId) => `folder:${id}`
const folderOf = (sheet: string | null): FolderId | null => (sheet === sheetOf('portfolio') ? 'portfolio' : sheet === sheetOf('faqs') ? 'faqs' : null)

/** The folder that is open over the Home Screen, if one is. */
export const useOpenFolder = () => useStore(sys, (s) => (s.app === null && !s.locked ? folderOf(s.sheet) : null))

/** What shows through the closed Portfolio folder: the first nine companies that have a logo. */
const PEEK = ALL.filter((c) => c.logo).slice(0, 9)

/** How many companies an open folder shows at a time, as a folder shows apps. */
const PER_PAGE = 9

const PAGES: Listed[][] = []
for (let i = 0; i < ALL.length; i += PER_PAGE) PAGES.push(ALL.slice(i, i + PER_PAGE))

// ---- On the Home Screen ----

/** A folder where it sits among the icons: two icons wide, as the widgets beside it are, or one icon's size on a screen too short for that. */
export function HomeFolder({ id }: { id: FolderId }) {
  return (
    <button type="button" className="sb-widget sb-folder" aria-haspopup="dialog" onClick={() => openSheet(sheetOf(id))}>
      <span className="sb-folder__face" data-folder={id} data-origin={`folder:${id}`}>
        {id === 'portfolio' ? (
          PEEK.map((c) => <CompanyLogo key={c.key} company={c} size={40} />)
        ) : (
          <span className="sb-folder__titles" aria-hidden>
            {FAQS.slice(0, 3).map((f) => (
              <span key={f.question}>{f.question}</span>
            ))}
          </span>
        )}
      </span>
      <span className="sb-icon__name">
        {NAME[id]}
        <span className="sr-only">{id === 'portfolio' ? `, ${ALL.length} companies` : `, ${FAQS.length} questions`}</span>
      </span>
    </button>
  )
}

// ---- Open ----

/** The folder that is open, drawn over the Home Screen for as long as it is open and while it goes away. */
export function OpenFolder() {
  const open = useOpenFolder()
  const motion = useStore(sys, (s) => s.motion)
  const [shown, setShown] = useState<{ id: FolderId; closing: boolean } | null>(open ? { id: open, closing: false } : null)
  if (open && (!shown || shown.id !== open || shown.closing)) setShown({ id: open, closing: false })
  // Something picked out of it opens from where it was: the folder stays drawn while that happens
  else if (!open && shown && !shown.closing) setShown(motion ? { id: shown.id, closing: true } : null)

  useEffect(() => {
    if (!shown?.closing) return
    const t = setTimeout(() => setShown((s) => (s?.closing ? null : s)), 360)
    return () => clearTimeout(t)
  }, [shown])

  if (!shown) return null
  return <FolderView key={shown.id} id={shown.id} closing={shown.closing} still={!motion} />
}

function FolderView({ id, closing, still }: { id: FolderId; closing: boolean; still: boolean }) {
  const root = useRef<HTMLDivElement>(null)
  const box = useRef<HTMLDivElement>(null)
  const pages = useRef<HTMLDivElement>(null)
  const [page, setPage] = useState(0)
  /** A page was turned from the keyboard: when it has turned, the keyboard goes to its first company. */
  const follow = useRef(false)
  /** Where the folder on the Home Screen is from the open one: it grows out of that, and goes back into it. */
  const [from, setFrom] = useState<CSSProperties | undefined>(undefined)

  useLayoutEffect(() => {
    const tile = document.querySelector<HTMLElement>(`.sb-folder__face[data-folder="${id}"]`)
    const el = box.current
    const stage = root.current
    if (!tile || !el || !stage || !el.offsetWidth) return
    // Where the open folder will be is taken from its layout, which the way in doesn't move; the closed one from where it is drawn
    const k = scaleOf(stage)
    const a = tile.getBoundingClientRect()
    const s = stage.getBoundingClientRect()
    if (!a.width) return
    setFrom({
      '--from-x': `${(a.left + a.width / 2 - s.left) / k - (el.offsetLeft + el.offsetWidth / 2)}px`,
      '--from-y': `${(a.top + a.height / 2 - s.top) / k - (el.offsetTop + el.offsetHeight / 2)}px`,
      '--from-k': String(Math.min(1, a.width / k / el.offsetWidth)),
    } as CSSProperties)
  }, [id])

  /** Closed onto the Home Screen, the keyboard goes back to the folder it came out of. Closed because
   * something in it was picked, an app is opening and the keyboard is that app's; locked, the Lock Screen's. */
  const giveBack = () => {
    const s = sys.get()
    if (s.app !== null || s.locked) return
    const tile = document.querySelector(`.sb-folder__face[data-folder="${id}"]`)?.closest<HTMLElement>('.sb-folder')
    // The Home Screen may still be shut off for the length of this draw: once more when it is not
    if (!focusFirst(tile)) requestAnimationFrame(() => focusLost() && focusFirst(tile))
  }

  // The keyboard goes to the folder when it opens and back to its tile when it closes
  useLayoutEffect(() => {
    if (closing) giveBack()
    else box.current?.focus({ preventScroll: true })
  }, [closing]) // eslint-disable-line react-hooks/exhaustive-deps
  // Taken away without closing first (arrived at by the browser's Back, nothing moves): the same
  useEffect(
    () => () => {
      if (focusLost()) giveBack()
    },
    [], // eslint-disable-line react-hooks/exhaustive-deps
  )

  // Escape closes it, and the arrows turn its pages
  useEffect(() => {
    if (closing) return
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        closeSheet()
      } else if (id === 'portfolio' && (e.key === 'ArrowRight' || e.key === 'ArrowLeft') && !(e.target as HTMLElement).closest?.('input, textarea')) {
        e.preventDefault()
        const next = Math.max(0, Math.min(PAGES.length - 1, page + (e.key === 'ArrowRight' ? 1 : -1)))
        if (next === page) return
        // The page the keyboard was on is about to be shut off: it goes with the turn, to the new page's first company
        follow.current = true
        turn(next)
      }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  })
  useEffect(() => {
    if (!follow.current) return
    follow.current = false
    focusFirst(pages.current?.children[page]?.querySelector('.sb-open__app'))
  }, [page])

  const turn = (to: number) => {
    const el = pages.current
    if (!el) return
    const next = Math.max(0, Math.min(PAGES.length - 1, to))
    // No glide for a visitor who has asked for less motion, nor when nothing else on the phone is moving
    el.scrollTo({ left: next * el.clientWidth, behavior: still || prefersReducedMotion() ? 'auto' : 'smooth' })
  }

  return (
    <div ref={root} className="sb-open" data-folder={id} data-closing={closing || undefined} data-still={still || undefined} style={from} {...(closing ? ({ inert: '' } as object) : null)}>
      <button type="button" className="sb-open__away" aria-label="Close the folder" tabIndex={-1} onClick={() => closeSheet()} />
      <div ref={box} className="sb-open__box" role="dialog" aria-modal="true" aria-label={`${NAME[id]} folder`} tabIndex={-1}>
        <h2 className="sb-open__name">{NAME[id]}</h2>
        <div className="sb-open__panel">
          {id === 'portfolio' ? (
            <>
              <div
                ref={pages}
                className="sb-open__pages"
                onScroll={(e) => {
                  const el = e.currentTarget
                  if (el.clientWidth) setPage(Math.round(el.scrollLeft / el.clientWidth))
                }}
              >
                {PAGES.map((companies, i) => (
                  <div key={i} className="sb-open__page" role="group" aria-label={`Page ${i + 1} of ${PAGES.length}`} {...(i === page ? null : ({ inert: '' } as object))}>
                    {companies.map((c) => (
                      // A company opens in Wallet, out of its icon here, as an app opens out of a folder
                      <button key={c.key} type="button" className="sb-open__app" onClick={() => launchAt('finder', cardsFor(c.key), `folder:${c.key}`, companySheet(c.key))}>
                        <span className="sb-open__icon" data-origin={`folder:${c.key}`}>
                          <CompanyLogo company={c} size={60} />
                        </span>
                        <span className="sb-icon__name">{c.name}</span>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
              {/* The dots are a picture of where the pages are. As on an iPhone, a press on the strip's left
                  half goes back a page and one on its right half goes on: two targets a finger can find */}
              <div className="sb-open__turn" role="group" aria-label="Pages">
                <button type="button" className="sb-open__step" data-way="back" aria-label="Previous page" aria-disabled={page === 0 || undefined} onClick={() => turn(page - 1)} />
                <button type="button" className="sb-open__step" data-way="on" aria-label="Next page" aria-disabled={page === PAGES.length - 1 || undefined} onClick={() => turn(page + 1)} />
                <span className="sb-open__dots" aria-hidden>
                  {PAGES.map((_, i) => (
                    <span key={i} className="sb-open__dot" data-current={i === page || undefined} />
                  ))}
                </span>
                <span className="sr-only" role="status">
                  Page {page + 1} of {PAGES.length}
                </span>
              </div>
            </>
          ) : (
            <div className="sb-open__notes">
              {FAQS.map((f, i) => (
                <button key={f.question} type="button" className="sb-open__note" data-origin={`folder:faq:${i}`} onClick={() => launchAt('notes', [FAQS_FOLDER, noteView(i)], `folder:faq:${i}`)}>
                  {f.question}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
