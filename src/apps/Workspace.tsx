import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { Check, FileText, Rotate3d } from 'lucide-react'
import { inkOn, OWN, OWNERS, PAINTS, PAPER, readColor, type Paint } from '../data/workspace'
import { TEMPLATED } from '../data/site'
import { Window } from '../kit/window'
import { account, askLogIn, logIn } from '../os/account'
import { prefersReducedMotion } from '../os/dom'
import { launchApp } from '../os/launch'
import { useStore } from '../os/store'
import { pick, picked } from '../os/workspace'
import { wm } from '../os/wm'
import { openProduct } from './Store'
import type { Stage } from './workspace/stage'
import { ChairStill } from './workspace/Still'
import '../styles/desk/workspace.css'

// Workspace: the studio (design/v1-workspace). A color picker for the chair with one button. It opens on
// eight slabs, seven colors and Your own. Pick one and the whole window becomes a studio in that color: a
// lit cove, the color's name set huge behind the chair, the chair itself on a turntable, the colors in a
// small glass dock of dots, the price and one button. Chairs are still sold in the VIP Store: a color in
// stock is bought there, and one made to order is asked for.
//
// The chair is a 3D model, turned by dragging (workspace/stage.ts). Until it has loaded, and wherever a
// browser cannot draw in 3D, a drawing of the chair in the same paint stands where it will be.

/** A color as the studio holds it: one of the seven, or the visitor's own. */
interface Chosen {
  id: string
  name: string
  color: string
  shift?: string[]
  paint: Paint | null
}

const chosenOf = (paint: Paint): Chosen => ({ id: paint.id, name: paint.name, color: paint.color, shift: paint.shift, paint })
const dollars = (n: number) => `$${n.toLocaleString('en-US')}`
/** What a slab, a dot or the cove is painted with: the color, or for a shifting paint the colors it moves through. */
const ground = (c: { color: string; shift?: string[] }) => (c.shift ? `linear-gradient(135deg, ${c.shift.join(', ')})` : c.color)
const stockOf = (paint: Paint) => (paint.shift ? 'Color-shifting' : paint.stock === 'now' ? 'Available now' : 'Made to order')

// ---- What has been asked for, in the demo: kept in this browser, by who asked

const ASKED = 'shrug:workspace-asked.v1'
function asked(email: string): string[] {
  try {
    return (JSON.parse(window.localStorage.getItem(ASKED) ?? '{}') as Record<string, string[]>)[email] ?? []
  } catch {
    return []
  }
}
function ask(email: string, what: string) {
  try {
    const all = JSON.parse(window.localStorage.getItem(ASKED) ?? '{}') as Record<string, string[]>
    all[email] = [...new Set([...(all[email] ?? []), what])]
    window.localStorage.setItem(ASKED, JSON.stringify(all))
  } catch {
    // No storage: asked for as long as the page is open
  }
}

export function WorkspaceApp() {
  const shown = useStore(wm, (s) => s.wins.workspace.open && !s.wins.workspace.minimized)
  const who = useStore(account, (s) => s)
  const sheet = useStore(logIn, (s) => s.open)
  const kept = useStore(picked, (s) => s)
  const [view, setView] = useState<'first' | 'studio' | 'owners'>(kept ? 'studio' : 'first')
  const [own, setOwn] = useState(() => ({ typed: kept?.id === OWN.id ? (kept.typed ?? '') : '', color: kept?.id === OWN.id ? kept.color : OWN.start }))
  const [flood, setFlood] = useState<string | null>(null)
  const [hover, setHover] = useState<string | null>(null)
  const [requested, setRequested] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const waiting = useRef(false)

  const chosen: Chosen | null = !kept ? null : kept.id === OWN.id ? { id: OWN.id, name: OWN.name, color: own.color, paint: null } : (PAINTS.map(chosenOf).find((c) => c.id === kept.id) ?? null)
  const email = who.status === 'member' ? who.email : null
  useEffect(() => setRequested(email ? asked(email) : []), [email])

  const choose = (c: Chosen) => pick({ id: c.id, color: c.color, shift: c.shift, typed: c.id === OWN.id ? own.typed : undefined })
  /** From a slab: the slab grows to fill the window, and the studio is there when it has. A cut, for a visitor who has asked for less motion. */
  const enter = (c: Chosen) => {
    choose(c)
    if (prefersReducedMotion()) return setView('studio')
    setFlood(c.id)
    setTimeout(() => (setFlood(null), setView('studio')), 420)
  }
  const type = (typed: string) => {
    const read = readColor(typed)
    const color = read?.color ?? own.color
    setOwn({ typed, color })
    pick({ id: OWN.id, color, typed })
  }

  /** The one thing each color is asked for by: the paint's id, or for a color of their own, the color itself. */
  const what = chosen ? (chosen.id === OWN.id ? `own:${own.color}` : chosen.id) : ''
  const isAsked = requested.includes(what)
  const request = async () => {
    if (!chosen || isAsked || busy) return
    if (!email) {
      // The color is kept while they log in, and the request is sent when they have
      waiting.current = true
      return askLogIn('request', `${chosen.id === OWN.id ? 'Your color' : chosen.name} is kept while you log in. Start with your email.`)
    }
    waiting.current = false
    setBusy(true)
    await new Promise((done) => setTimeout(done, 400))
    ask(email, what)
    setRequested(asked(email))
    setBusy(false)
  }
  // Logged in with a request waiting: it is sent, as they asked. The sheet put away without logging in: it waits no longer
  useEffect(() => {
    if (!waiting.current || sheet) return
    if (email) void request()
    else waiting.current = false
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, sheet])

  const ink = view === 'owners' || !chosen || view === 'first' ? '#141414' : inkOn(chosen.color)
  const dark = ink === '#fff'
  const cove = view === 'studio' && chosen ? ground(chosen) : PAPER

  const bar = (
    <div className="wxbar" style={{ color: ink }}>
      <button type="button" className="wxbar__home" aria-label="Workspace: all the colors" onClick={() => setView('first')}>
        <span className="mk" aria-hidden>
          W/S
        </span>
        Workspace
      </button>
      {(OWNERS.length > 0 && TEMPLATED) || OWNERS.some((owner) => !owner.name.startsWith('[')) ? (
        <button type="button" className="pill" aria-pressed={view === 'owners'} onClick={() => setView(view === 'owners' ? (chosen ? 'studio' : 'first') : 'owners')}>
          Notable Owners
        </button>
      ) : null}
    </div>
  )

  return (
    <Window className={`app wxwin${dark ? ' dark' : ''}`} lightsSize="large" lead={bar} body={{ className: 'wxwin__body' }} style={{ background: cove, color: ink }}>
      {view === 'first' && (
        <div className="wx-first" data-flood={flood ? '' : undefined}>
          <div className="fl-head">
            <h1>
              One chair.
              <br />
              Seven colors.
            </h1>
            <p>Pick one and the studio changes with you.</p>
          </div>
          <div className="fl-slabs" role="group" aria-label="Colors">
            {[...PAINTS.map(chosenOf), { id: OWN.id, name: OWN.name, color: own.color, paint: null } as Chosen].map((c) => {
              const mine = c.id === OWN.id
              const big = hover === c.id && !flood
              return (
                <button
                  key={c.id}
                  type="button"
                  className={`fl-slab eight${mine ? ' own' : ''}${big ? ' big' : ''}${flood === c.id ? ' flood' : ''}`}
                  style={mine ? undefined : { background: ground(c), color: inkOn(c.color) }}
                  onPointerEnter={(e) => e.pointerType === 'mouse' && setHover(c.id)}
                  onPointerLeave={() => setHover(null)}
                  onFocus={() => setHover(c.id)}
                  onBlur={() => setHover(null)}
                  onClick={() => enter(c)}
                >
                  {big && !mine && <ChairStill className="ch" paint={c.color} shift={c.shift} width={150} />}
                  <b>{c.name}</b>
                  <small>{c.paint ? stockOf(c.paint) : 'On request'}</small>
                </button>
              )
            })}
          </div>
        </div>
      )}
      {view === 'studio' && chosen && (
        <div className={`fl st${dark ? ' dark' : ''}`}>
          <span className="st-light" aria-hidden />
          <span className="st-floor" aria-hidden />
          <span className="fl-word" aria-hidden>
            {chosen.name.split(' ').map((word, i) => (
              <span key={i}>{word}</span>
            ))}
          </span>
          {TEMPLATED && <span className="st-stand">Placeholder model. The licensed 3D chair goes here.</span>}
          <Turntable color={chosen.color} shift={chosen.shift} name={chosen.name} live={shown} />
          <div className="fl-info">
            <h2>{chosen.name}</h2>
            {chosen.id === OWN.id ? (
              <>
                <p>Name it, or give a hex or RAL code. The studio follows.</p>
                <label className="st-own">
                  <i style={{ background: own.color }} aria-hidden />
                  <input type="text" value={own.typed} placeholder="RAL 6033 Mint turquoise" aria-label="Your own color: a name, a hex or a RAL code" spellCheck={false} autoComplete="off" onChange={(e) => type(e.target.value)} />
                </label>
              </>
            ) : (
              <>
                {(chosen.paint?.line || chosen.shift) && (
                  <p>
                    {chosen.paint?.line}
                    {chosen.shift ? `${chosen.paint?.line ? ' ' : ''}Turn it to see it shift.` : ''}
                  </p>
                )}
                {chosen.shift && <span className="st-tag">Color-shifting</span>}
                <span className="st-tag">{chosen.paint?.stock === 'now' ? 'Available now' : 'Made to order'}</span>
              </>
            )}
          </div>
          <div className="fl-dock" role="group" aria-label="Colors">
            {PAINTS.map(chosenOf).map((c) => (
              <button key={c.id} type="button" className={`fl-dot${chosen.id === c.id ? ' on' : ''}`} style={{ background: ground(c), color: ink }} aria-label={c.name} aria-pressed={chosen.id === c.id} onClick={() => choose(c)} />
            ))}
            <button type="button" className={`fl-dot own${chosen.id === OWN.id ? ' on' : ''}`} style={{ color: ink }} aria-label="Your own color" aria-pressed={chosen.id === OWN.id} onClick={() => choose({ id: OWN.id, name: OWN.name, color: own.color, paint: null })} />
          </div>
          <div className="fl-buy">
            <b className="num">{chosen.paint ? dollars(chosen.paint.price) : 'On request'}</b>
            {chosen.paint?.stock === 'now' ? (
              <button type="button" className="fl-btn" onClick={() => (chosen.paint?.product && openProduct(chosen.paint.product), launchApp('store'))}>
                Buy in VIP Store
              </button>
            ) : (
              <button type="button" className="fl-btn" aria-disabled={isAsked || busy || undefined} onClick={() => void request()}>
                {isAsked ? (
                  <>
                    <Check size={16} strokeWidth={2.4} aria-hidden />
                    Requested
                  </>
                ) : busy ? (
                  'Requesting…'
                ) : (
                  'Request'
                )}
              </button>
            )}
            <small>{chosen.paint?.stock === 'now' ? 'Available now. Paid for in the VIP Store.' : isAsked ? 'Requested today. We’ll email you.' : !email && waiting.current ? 'Log in to send this request.' : chosen.paint ? 'Made to order. No charge now.' : 'Always made to order. No charge now.'}</small>
          </div>
        </div>
      )}
      {view === 'owners' && (
        <div className="ow">
          <header>
            <h1>People who own one</h1>
            <span className="pill pill--quiet">
              <FileText size={13} strokeWidth={2} aria-hidden />
              Notable Owners opens in Preview once it is written
            </span>
          </header>
          <div className="ow-grid">
            {OWNERS.map((owner, i) => {
              const paint = PAINTS.find((p) => p.id === owner.paint) ?? PAINTS[0]!
              return (
                <article key={i} className="ow-card" style={{ background: ground(paint), color: inkOn(paint.color) }}>
                  <q>“{owner.words}”</q>
                  <footer>
                    <b>{owner.name}</b>
                    {owner.of} · {paint.name}
                  </footer>
                  <ChairStill paint={paint.color} shift={paint.shift} width={120} />
                </article>
              )
            })}
          </div>
          <p className="ow-note">Only owners who have agreed to be named appear. Each card takes its owner’s color.</p>
        </div>
      )}
    </Window>
  )
}

/** The chair on its turntable: dragged to turn it. A drawing stands in for it until the 3D chair has been drawn, and stays where it cannot be. */
function Turntable({ color, shift, name, live }: { color: string; shift?: string[]; name: string; live: boolean }) {
  const box = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const stage = useRef<Stage | null>(null)
  const [drawn, setDrawn] = useState(false)
  const [angle, setAngle] = useState(0)
  const paint = useRef({ color, shift })
  paint.current = { color, shift }

  // The stage is made when the studio is first seen, and three.js is fetched then and not before
  useEffect(() => {
    if (!live || stage.current) return
    let gone = false
    void import('./workspace/stage')
      .then(({ makeStage }) => {
        if (gone || !canvas.current || !box.current) return
        const made = makeStage(canvas.current, !prefersReducedMotion(), () => setDrawn(true))
        stage.current = made
        made.size(box.current.clientWidth, box.current.clientHeight)
        made.paint(paint.current.color, paint.current.shift)
      })
      .catch(() => {
        // No 3D here: the drawing stays, and the app works without turning
      })
    return () => {
      gone = true
    }
  }, [live])
  useEffect(
    () => () => {
      stage.current?.stop()
      stage.current = null
    },
    [],
  )
  // A new color: the paint fades to it, as the cove does
  useEffect(() => stage.current?.paint(color, shift), [color, shift])
  useEffect(() => {
    const el = box.current
    if (!el) return
    const watch = new ResizeObserver(() => stage.current?.size(el.clientWidth, el.clientHeight))
    watch.observe(el)
    return () => watch.disconnect()
  }, [])

  const turn = (dx: number, dy: number) => {
    stage.current?.turn(dx, dy)
    if (stage.current) setAngle(stage.current.angle())
  }
  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!stage.current || (e.pointerType === 'mouse' && e.button !== 0)) return
    const el = e.currentTarget
    el.setPointerCapture(e.pointerId)
    let last = { x: e.clientX, y: e.clientY }
    const move = (ev: PointerEvent) => {
      turn(ev.clientX - last.x, ev.clientY - last.y)
      last = { x: ev.clientX, y: ev.clientY }
    }
    const up = () => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
      el.removeAttribute('data-held')
    }
    el.setAttribute('data-held', '')
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
  }
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    turn(e.key === 'ArrowLeft' ? -30 : 30, 0)
  }

  return (
    <>
      <span className="st-ring" aria-hidden />
      <div
        ref={box}
        className="st-table"
        data-autofocus
        tabIndex={0}
        role="slider"
        aria-label={`The chair in ${name}. Drag, or use the arrow keys, to turn it`}
        aria-valuemin={0}
        aria-valuemax={359}
        aria-valuenow={angle}
        aria-valuetext={`${angle} degrees`}
        data-3d={drawn || undefined}
        onPointerDown={onDown}
        onKeyDown={onKey}
      >
        <ChairStill className="st-still" paint={color} shift={shift} width={300} />
        <canvas ref={canvas} aria-hidden />
      </div>
      {drawn && (
        <span className="st-turn" aria-hidden>
          <Rotate3d size={13} strokeWidth={2} />
          Drag to turn · {angle}°
        </span>
      )}
    </>
  )
}
