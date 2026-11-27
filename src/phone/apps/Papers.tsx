import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { FileQuestion, FolderOpen, Lock } from 'lucide-react'
import { UPDATE_GROUPS } from '../../../store/shared/rules'
import { onePager, useShown } from '../../apps/Preview'
import { dayOf, fundsOf, LOCKED } from '../../apps/Updates'
import { account, askLogIn, isLP, requestDoc, type Doc } from '../../os/account'
import { PdfIcon } from '../../os/icons'
import { paperOf, type Paper } from '../../os/papers'
import { useStore } from '../../os/store'
import { writeToShrug } from '../../os/write'
import { LOGIN, LogInSheet } from '../LogIn'
import { launch, push } from '../system'
import { BackButton, Cell, Empty, GlassButton, List, NavStack, Screen, Section, ShareGlyph, SheetHost } from '../ui'
import '../../styles/desk/onepager.css'
import '../../styles/phone/papers.css'

// Documents on the phone (Dom, 27 Nov: the one-pager was a link that opened in a tab of its own, and there
// was nothing of Updates here at all). Two apps, over the one reader the desk's Preview is
// (src/apps/Preview.tsx, whose pages these are):
//
// One-pager opens straight on the one-pager: its two pages as the site draws them, one under the other, as
// wide as the screen. A double tap brings a page up close, to be read and moved about, and another puts it
// back; two fingers do the same by hand. Its bar has the way to save the file.
//
// Updates is the folder of the desk's (src/apps/Updates.tsx): for an LP, the documents that are theirs,
// under Funds and SPVs, each opening in the same reader; for anyone else, who it is for, the way to log in,
// and the way to ask Shrug about becoming an LP. Nothing of what is in it is shown to anyone it is not for.

const DOC = 'd:'

/** How much closer a double tap brings a page than fitted to the screen, and the most two fingers may. */
const CLOSE = 2.6
const MOST = 5

/** A document, read: its pages one under the other, fitted to the screen's width. */
function Reader({ paper, lead }: { paper: Paper; lead?: ReactNode }) {
  const [again, setAgain] = useState(0)
  const shown = useShown(paper, again)
  const leaves = shown.is === 'pages' ? shown.leaves : null
  const main = useRef<HTMLDivElement>(null)
  const [room, setRoom] = useState(0)
  /** How much closer than fitted the pages are: 1 is fitted. */
  const [zoom, setZoom] = useState(1)
  const [at, setAt] = useState(0)

  useLayoutEffect(() => {
    const el = main.current
    if (!el) return
    const measure = () => setRoom(el.clientWidth)
    measure()
    const watch = new ResizeObserver(measure)
    watch.observe(el)
    return () => watch.disconnect()
  }, [shown.is])
  useEffect(() => {
    setZoom(1)
    setAt(0)
    main.current?.scrollTo(0, 0)
  }, [paper.id])

  const widest = leaves ? Math.max(...leaves.map((leaf) => leaf.w)) : 816
  const fit = room ? (room - 24) / widest : 0.44
  const scale = fit * zoom

  /** Brings the pages to another size about a point of the screen, which stays under the finger. */
  const zoomTo = (next: number, x: number, y: number) => {
    const el = main.current
    if (!el) return
    const to = Math.max(1, Math.min(MOST, next))
    const box = el.getBoundingClientRect()
    const px = x - box.left
    const py = y - box.top
    const k = to / zoom
    const left = (el.scrollLeft + px) * k - px
    const top = (el.scrollTop + py) * k - py
    setZoom(to)
    requestAnimationFrame(() => el.scrollTo({ left: Math.max(0, left), top: Math.max(0, top) }))
  }

  // A double tap: up close where the finger is, or back to fitted
  const last = useRef<{ t: number; x: number; y: number } | null>(null)
  const tapped = (e: ReactPointerEvent) => {
    if (!leaves || fingers.current.size > 0) return
    const was = last.current
    const now = { t: e.timeStamp, x: e.clientX, y: e.clientY }
    if (was && now.t - was.t < 320 && Math.abs(now.x - was.x) < 28 && Math.abs(now.y - was.y) < 28) {
      last.current = null
      zoomTo(zoom > 1.05 ? 1 : CLOSE, e.clientX, e.clientY)
    } else last.current = now
  }

  // Two fingers: the pages follow them apart and together
  const fingers = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef<{ gap: number; zoom: number } | null>(null)
  const gapOf = () => {
    const [a, b] = [...fingers.current.values()]
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0
  }
  const down = (e: ReactPointerEvent) => {
    if (e.pointerType !== 'touch') return
    fingers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (fingers.current.size === 2) pinch.current = { gap: gapOf(), zoom }
  }
  const move = (e: ReactPointerEvent) => {
    if (!fingers.current.has(e.pointerId)) return
    fingers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const p = pinch.current
    if (!p || fingers.current.size < 2 || !p.gap) return
    const [a, b] = [...fingers.current.values()]
    zoomTo(p.zoom * (gapOf() / p.gap), (a!.x + b!.x) / 2, (a!.y + b!.y) / 2)
  }
  const up = (e: ReactPointerEvent) => {
    const was = fingers.current.size
    fingers.current.delete(e.pointerId)
    if (fingers.current.size < 2) pinch.current = null
    if (was === 1 && e.type === 'pointerup') tapped(e)
    else if (e.pointerType !== 'touch' && e.type === 'pointerup') tapped(e)
  }

  /** The page the middle of the screen is on. */
  const follow = () => {
    const el = main.current
    if (!el) return
    const middle = el.getBoundingClientRect().top + el.clientHeight / 2
    const pages = Array.from(el.querySelectorAll<HTMLElement>('[data-page]'))
    const on = pages.findIndex((page) => page.getBoundingClientRect().bottom >= middle)
    setAt(Math.max(0, on < 0 ? pages.length - 1 : on))
  }

  const says = shown.is === 'loading' ? 'Loading…' : shown.is === 'pages' ? (shown.leaves.length === 1 ? '1 page' : `Page ${Math.min(at, shown.leaves.length - 1) + 1} of ${shown.leaves.length}`) : undefined
  const canSave = !!paper.download && shown.is === 'pages'
  const name = paper.name.replace(/\.pdf$/i, '')

  return (
    <Screen
      title={name}
      subtitle={says}
      tone="grouped"
      fixed
      className="pp"
      leading={lead}
      trailing={
        canSave ? (
          <GlassButton label={`Save ${paper.name}`} onClick={() => void paper.download?.()}>
            <ShareGlyph />
          </GlassButton>
        ) : undefined
      }
    >
      {shown.is === 'loading' && (
        <div className="pp-main" role="status" aria-label="Loading the document">
          <div className="pp-page pp-page--wait" />
        </div>
      )}
      {leaves && (
        <div ref={main} className="pp-main" data-zoomed={zoom > 1.05 || undefined} tabIndex={0} role="group" aria-label={`${paper.name}${says ? `, ${says}` : ''}`} onScroll={follow} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
          <div className="pp-pages" style={{ width: Math.max(room, Math.round(widest * scale) + 24) }}>
            {leaves.map((leaf, n) => (
              <div key={n} className="pp-page" data-page={n} style={{ width: Math.round(leaf.w * scale), height: Math.round(leaf.h * scale) }}>
                {leaf.draw(scale, main.current)}
              </div>
            ))}
            {paper.preparedFor != null && (
              <span className="pp-for">
                <Lock size={11} strokeWidth={2.6} aria-hidden />
                Private · Prepared for {paper.preparedFor}
              </span>
            )}
          </div>
        </div>
      )}
      {shown.is !== 'loading' && shown.is !== 'pages' && (
        <div className="pp-said">
          {shown.is === 'not-yours' ? (
            <NotYours paper={paper} />
          ) : shown.is === 'anon' ? (
            <>
              <Empty icon={<Lock size={40} strokeWidth={1.6} />} title="Log in to open this">
                It is kept to the person it was prepared for.
              </Empty>
              <button type="button" className="pp-go" onClick={() => askLogIn('updates')}>
                Log In
              </button>
            </>
          ) : (
            <>
              <Empty icon={<FileQuestion size={40} strokeWidth={1.6} />} title={shown.is === 'offline' ? 'This file didn’t load' : 'This file can’t be found'}>
                {shown.is === 'offline' ? 'Check your connection, then try again.' : 'It may have been moved or replaced. Nothing is wrong on your side.'}
              </Empty>
              <button type="button" className="pp-go pp-go--grey" onClick={() => setAgain((n) => n + 1)}>
                Try Again
              </button>
            </>
          )}
        </div>
      )}
    </Screen>
  )
}

/** A document written for the LPs of another fund: whose it is, and the way to ask for it. */
function NotYours({ paper }: { paper: Paper }) {
  const ask = paper.ask
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const send = async () => {
    if (!ask || ask.asked || busy) return
    setBusy(true)
    setFailed(false)
    const sent = await ask.send()
    setBusy(false)
    if (sent !== true) setFailed(true)
  }
  return (
    <>
      <Empty icon={<Lock size={40} strokeWidth={1.6} />} title="This one isn’t yours to open">
        {ask ? `It was written for the LPs of ${ask.forWhom}. If you think you should see it, ask and Shrug will take a look.` : 'It was written for the LPs of another fund.'}
      </Empty>
      {ask && (
        <button type="button" className="pp-go" aria-disabled={ask.asked || busy || undefined} onClick={send}>
          {ask.asked ? 'Requested' : busy ? 'Requesting…' : 'Request'}
        </button>
      )}
      {failed && (
        <p className="pp-failed" role="alert">
          That didn’t send. Try again.
        </p>
      )}
    </>
  )
}

/** One-pager: the app is the document. */
export function OnePagerApp() {
  return <NavStack>{() => <Reader paper={onePager} lead={null} />}</NavStack>
}

// ---- Updates

function Row({ doc }: { doc: Doc }) {
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const ask = async () => {
    if (busy) return
    setBusy(true)
    setFailed(false)
    const sent = await requestDoc(doc)
    setBusy(false)
    if (sent !== true) setFailed(true)
  }
  const opens = doc.state === 'open' || doc.state === 'requested'
  const day = dayOf(doc.date)
  return (
    <Cell
      lead={
        <span className="upp-file" aria-hidden>
          <PdfIcon />
        </span>
      }
      title={doc.name}
      subtitle={failed ? 'That didn’t send. Try again.' : [`For ${doc.forWhom.replace(/^All\b/, 'all')}`, day].filter(Boolean).join(' · ')}
      chevron={opens}
      onClick={opens ? () => push(DOC + doc.id) : doc.state === 'request' ? ask : doc.state === 'locked' ? () => launch('myvip') : undefined}
      // (what pressing it does, where that is not opening it, in the blue of something to press; and where
      // nothing does anything yet, how it stands)
      value={doc.state === 'open' ? undefined : doc.state === 'requested' ? 'Requested' : doc.state === 'request' || doc.state === 'locked' ? undefined : 'Coming soon'}
      trailing={doc.state === 'request' || doc.state === 'locked' ? <span className="upp-act">{doc.state === 'locked' ? 'Unlock' : busy ? 'Requesting…' : 'Request'}</span> : undefined}
      label={doc.state === 'open' ? `Open ${doc.name}` : doc.state === 'request' ? `Request ${doc.name}` : doc.state === 'locked' ? `Unlock ${doc.name} in My VIP` : undefined}
      className="upp-row"
    />
  )
}

/** For someone the folder is locked to: who it is for, the way in, and the way to ask about becoming an LP. */
function Locked({ anon }: { anon: boolean }) {
  return (
    <div className="upp-locked">
      <Empty icon={<Lock size={40} strokeWidth={1.6} />} title="For Shrug LPs">
        {LOCKED}
      </Empty>
      {anon && (
        <button type="button" className="pp-go" onClick={() => askLogIn('updates')}>
          Log In
        </button>
      )}
      <button type="button" className="pp-link" onClick={() => writeToShrug({ subject: 'Becoming an LP' })}>
        Enquire about becoming an LP
      </button>
    </div>
  )
}

function Folder() {
  const who = useStore(account, (s) => s)
  const lp = isLP(who)
  const docs = who.status === 'member' ? who.docs : []
  const groups = [...UPDATE_GROUPS, ...docs.map((doc) => doc.group).filter((group) => !UPDATE_GROUPS.includes(group))].filter((group, i, all) => all.indexOf(group) === i && docs.some((doc) => doc.group === group))
  return (
    <Screen
      title="Updates"
      large
      tone="grouped"
      leading={null}
      className="upp"
      subtitle={lp && who.status === 'member' ? `LP${who.funds.length ? ` · ${fundsOf(who.funds)}` : ''}` : undefined}
      trailing={
        who.status === 'anon' ? (
          <GlassButton label="Log In" wide onClick={() => askLogIn('updates')}>
            <span className="upp-login">Log In</span>
          </GlassButton>
        ) : undefined
      }
    >
      {who.status === 'checking' ? (
        <Empty title="One moment…" />
      ) : who.status !== 'member' || !lp ? (
        <Locked anon={who.status !== 'member'} />
      ) : docs.length === 0 ? (
        <Empty icon={<FolderOpen size={40} strokeWidth={1.6} />} title="Nothing here yet">
          Updates written for your funds will appear in this folder. We’ll email you when the first one does.
        </Empty>
      ) : (
        <List>
          {groups.map((group, i) => (
            <Section key={group} header={group} footer={i === groups.length - 1 ? `${docs.length === 1 ? '1 document' : `${docs.length} documents`} · Prepared for ${who.name || who.email}` : undefined}>
              {docs
                .filter((doc) => doc.group === group)
                .map((doc) => (
                  <Row key={doc.id} doc={doc} />
                ))}
            </Section>
          ))}
        </List>
      )}
    </Screen>
  )
}

/** A document of the folder, in the reader. One that is no longer theirs (logged out, or another account) is said to be. */
function Document({ id }: { id: string }) {
  const who = useStore(account, (s) => s)
  const doc = who.status === 'member' ? who.docs.find((d) => d.id === id) : null
  if (!doc)
    return (
      <Screen title="Updates" tone="grouped" leading={<BackButton label="Updates" />}>
        <Empty icon={<Lock size={40} strokeWidth={1.6} />} title={who.status === 'member' ? 'This file can’t be found' : 'Log in to open this'}>
          {who.status === 'member' ? 'It may have been moved or replaced.' : 'It is kept to the person it was prepared for.'}
        </Empty>
      </Screen>
    )
  return <Reader paper={paperOf(doc)} lead={<BackButton label="Updates" />} />
}

export function UpdatesApp() {
  return (
    <>
      <NavStack>{(view) => (view?.startsWith(DOC) ? <Document id={view.slice(DOC.length)} /> : <Folder />)}</NavStack>
      <SheetHost>{(name) => (name === LOGIN ? <LogInSheet /> : null)}</SheetHost>
    </>
  )
}
