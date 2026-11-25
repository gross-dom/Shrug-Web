import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { Check, ChevronLeft, FileText, Play, Rotate3d } from 'lucide-react'
import { fmtCents, priceCents } from '../../store/shared/rules'
import { shotsOf } from '../../store/src/pictures'
import { W_S } from '../data/lettering'
import { inkOn, MAKING, OWN, OWNERS, PAINTS, PAPER, readColor, shadedOn, type Making, type Paint } from '../data/workspace'
import { TEMPLATED } from '../data/site'
import { Window } from '../kit/window'
import { account, askLogIn, logIn } from '../os/account'
import { prefersReducedMotion } from '../os/dom'
import { useShelf, wantShop } from '../os/shop'
import { useStore } from '../os/store'
import { pick, picked } from '../os/workspace'
import { wm } from '../os/wm'
import { Balance, StoreFrame, type FrameHandle } from './storefront'
import type { Stage } from './workspace/stage'
import { ChairStill } from './workspace/Still'
import '../styles/desk/workspace.css'

// Workspace: the studio (design/v1-workspace, and Dom's notes after testing it). The chair is chosen here
// and bought here. It opens on a slab for each color and one for a color of your own. Pick one and the
// whole window becomes a studio in that color: a lit cove, the color's name set huge behind the chair, the
// chair itself on a turntable with photographs of it beside, the colors in a small glass dock of dots with
// who owns one under them, and the price and one button. The price is said to someone logged in. Buy opens
// the store's own page for that chair inside this window (storefront.tsx): the same checkout as everywhere,
// in dollars, with their points to bring it down and their address already on file.
//
// Two more things are in its bar: BTS, a wall of how a chair is made, and Notable Owners. Each has a way back.
//
// The chair is a 3D model, turned by dragging (workspace/stage.ts). Until it has loaded, and wherever a
// browser cannot draw in 3D, a drawing of the chair in the same paint stands where it will be.

/** A color as the studio holds it: one of the paints, or the visitor's own. */
interface Chosen {
  id: string
  name: string
  color: string
  shift?: string[]
  paint: Paint | null
}

const chosenOf = (paint: Paint): Chosen => ({ id: paint.id, name: paint.name, color: paint.color, shift: paint.shift, paint })
/** What a slab, a dot or the cove is painted with: the color, or for a shifting paint the colors it moves through. */
const ground = (c: { color: string; shift?: string[] }) => (c.shift ? `linear-gradient(135deg, ${c.shift.join(', ')})` : c.color)
const stockOf = (paint: Paint) => (paint.shift ? 'Color-shifting' : paint.stock === 'now' ? 'Available now' : 'Made to order')
const COUNT = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten']
/** A visitor never reads a note written for Shrug: what is still templated is the demo's and the editor's. */
const real = (text: string) => !text.startsWith('[')
const OWNERS_SHOWN = TEMPLATED ? OWNERS : OWNERS.filter((owner) => real(owner.name))
const MAKING_SHOWN = TEMPLATED ? MAKING : MAKING.filter((piece) => piece.src && real(piece.says))

// ---- What has been asked for (a color of their own), in the demo: kept in this browser, by who asked

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

type View = 'first' | 'studio' | 'owners' | 'bts' | 'buy'

export function WorkspaceApp() {
  const open = useStore(wm, (s) => s.wins.workspace.open)
  const shown = useStore(wm, (s) => s.wins.workspace.open && !s.wins.workspace.minimized)
  useEffect(() => {
    if (open) wantShop()
  }, [open])
  const who = useStore(account, (s) => s)
  const sheet = useStore(logIn, (s) => s.open)
  const kept = useStore(picked, (s) => s)
  const shelf = useShelf('chairs')
  const [view, setView] = useState<View>(kept ? 'studio' : 'first')
  const [own, setOwn] = useState(() => ({ typed: kept?.id === OWN.id ? (kept.typed ?? '') : '', color: kept?.id === OWN.id ? kept.color : OWN.start }))
  const [flood, setFlood] = useState<string | null>(null)
  const [hover, setHover] = useState<string | null>(null)
  const [requested, setRequested] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  /** Which of the chair's pictures is on the stage: the 3D chair (null), or one of its photographs. */
  const [shot, setShot] = useState<number | null>(null)
  /** A film or photograph of the wall, opened large. */
  const [look, setLook] = useState<Making | null>(null)
  const waiting = useRef<'request' | 'price' | null>(null)
  const frame = useRef<FrameHandle>(null)
  const [framed, setFramed] = useState(false)

  const chosen: Chosen | null = !kept ? null : kept.id === OWN.id ? { id: OWN.id, name: OWN.name, color: own.color, paint: null } : (PAINTS.map(chosenOf).find((c) => c.id === kept.id) ?? null)
  const email = who.status === 'member' ? who.email : null
  useEffect(() => setRequested(email ? asked(email) : []), [email])
  useEffect(() => setShot(null), [chosen?.id])
  /** Where the bar's way back leads, and what from: the studio if a color is picked, or the slabs. */
  const home: View = chosen ? 'studio' : 'first'

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

  // ---- A chair in one of the colors: what the store says of it, and the way to its page

  const product = chosen?.paint ? (shelf?.products.find((p) => p.id === chosen.paint!.product) ?? null) : null
  /** Its price, as it is said: only to someone logged in, and never one the store has not given. */
  const price = product && !product.priceHidden && product.points ? `From ${fmtCents(priceCents(product))}` : null
  const shots = product ? shotsOf(product) : []
  const buy = () => {
    if (!chosen?.paint) return
    setView('buy')
    if (framed) frame.current?.go(chosen.paint.product)
    else setFramed(true)
  }
  const seePrice = () => {
    if (!chosen) return
    waiting.current = 'price'
    askLogIn('price', `${chosen.name} is kept while you log in. Start with your email.`)
  }

  // ---- A color of their own: asked for

  /** The one thing a color of their own is asked for by: the color itself. */
  const what = chosen?.id === OWN.id ? `own:${own.color}` : ''
  const isAsked = !!what && requested.includes(what)
  const request = async () => {
    if (!chosen || !what || isAsked || busy) return
    if (!email) {
      // The color is kept while they log in, and the request is sent when they have
      waiting.current = 'request'
      return askLogIn('request', 'Your color is kept while you log in. Start with your email.')
    }
    waiting.current = null
    setBusy(true)
    await new Promise((done) => setTimeout(done, 400))
    ask(email, what)
    setRequested(asked(email))
    setBusy(false)
  }
  // Logged in with a request waiting: it is sent, as they asked. The sheet put away without logging in: it waits no longer
  useEffect(() => {
    if (!waiting.current || sheet) return
    if (email && waiting.current === 'request') void request()
    else waiting.current = null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, sheet])

  const coloured = view === 'studio' && !!chosen
  const ink = view === 'buy' ? '#f5f5f7' : coloured ? inkOn(chosen.color) : '#141414'
  const dark = ink === '#fff'
  const cove = view === 'buy' ? '#0c0c0d' : coloured ? ground(chosen) : PAPER
  // How the chips are set off from the ground: on paper a little darker; on a color a little lighter, as the
  // design has them, unless white words could not then be read on one (data/workspace.ts)
  const chips = view === 'buy' ? ' dark buying' : !coloured ? '' : dark ? (shadedOn(chosen.color) ? ' dark shade' : ' dark') : ' hue'
  /** Who owns one, as the studio says it under the colors: owners of this color first. */
  const owners = chosen ? [...OWNERS_SHOWN.filter((o) => o.paint === chosen.id), ...OWNERS_SHOWN.filter((o) => o.paint !== chosen.id)] : OWNERS_SHOWN

  const bar = (
    <div className="wxbar" style={{ color: ink }}>
      <button type="button" className="wxbar__home" aria-label="Workspace: all the colors" onClick={() => setView('first')}>
        <svg className="mk" viewBox={`0 ${-W_S.rise} ${W_S.width} ${W_S.rise + W_S.fall}`} aria-hidden>
          <path d={W_S.d} fill="currentColor" />
        </svg>
        Workspace
      </button>
      {(view === 'owners' || view === 'bts' || view === 'buy') && (
        <button type="button" className="wxbar__back" onClick={() => setView(home)}>
          <ChevronLeft size={16} strokeWidth={2.4} aria-hidden />
          {chosen ? `Back to ${chosen.name}` : 'Back to the colors'}
        </button>
      )}
      <span className="wxbar__end">
        {view === 'buy' ? (
          <Balance className="storebar__wallet wxbar__wallet" />
        ) : (
          <>
            {MAKING_SHOWN.length > 0 && (
              <button type="button" className="pill" aria-pressed={view === 'bts'} onClick={() => setView(view === 'bts' ? home : 'bts')}>
                BTS
              </button>
            )}
            {OWNERS_SHOWN.length > 0 && (
              <button type="button" className="pill" aria-pressed={view === 'owners'} onClick={() => setView(view === 'owners' ? home : 'owners')}>
                Notable Owners
              </button>
            )}
          </>
        )}
      </span>
    </div>
  )

  return (
    <Window className={`app wxwin${chips}`} lightsSize="large" lead={bar} body={{ className: 'wxwin__body' }} style={{ background: cove, color: ink }}>
      {view === 'first' && (
        <div className="wx-first" data-flood={flood ? '' : undefined}>
          <div className="fl-head">
            <h1>
              One chair.
              <br />
              {COUNT[PAINTS.length] ?? PAINTS.length} colors.
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
        <div className={`fl st${chips}`}>
          <span className="st-light" aria-hidden />
          <span className="st-floor" aria-hidden />
          <Word name={chosen.name} />
          {TEMPLATED && <span className="st-stand">A drawn model of the chair. A scan of the real one can take its place.</span>}
          <div className="st-stage" data-shot={shot !== null || undefined}>
            <Turntable color={chosen.color} shift={chosen.shift} matte={chosen.paint?.finish === 'matte'} name={chosen.name} live={shown && shot === null} />
            {shot !== null && shots[shot] && <img className="st-photo" src={shots[shot]!.full} srcSet={shots[shot]!.set} sizes="520px" alt={`${chosen.name}: photograph ${shot + 1} of ${shots.length}`} draggable={false} />}
          </div>
          {/* The chair's pictures, beside it: the 3D chair, and each photograph there is of it in this color */}
          {shots.length > 0 && (
            <div className="st-shots" role="group" aria-label={`Pictures of the chair in ${chosen.name}`}>
              <button type="button" className="st-shot" aria-pressed={shot === null} aria-label="The chair in 3D" onClick={() => setShot(null)}>
                <Rotate3d size={18} strokeWidth={1.9} aria-hidden />
                <span>3D</span>
              </button>
              {shots.map((s, n) => (
                <button key={s.full} type="button" className="st-shot" aria-pressed={shot === n} aria-label={`Photograph ${n + 1} of ${shots.length}`} onClick={() => setShot(n)}>
                  <img src={s.small} alt="" loading="lazy" draggable={false} />
                </button>
              ))}
            </div>
          )}
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
          <div className="fl-pick">
            <div className="fl-dock" role="group" aria-label="Colors">
              {PAINTS.map(chosenOf).map((c) => (
                <button key={c.id} type="button" className={`fl-dot${chosen.id === c.id ? ' on' : ''}`} style={{ background: ground(c), color: ink }} aria-label={c.name} aria-pressed={chosen.id === c.id} onClick={() => choose(c)} />
              ))}
              <button type="button" className={`fl-dot own${chosen.id === OWN.id ? ' on' : ''}`} style={{ color: ink }} aria-label="Your own color" aria-pressed={chosen.id === OWN.id} onClick={() => choose({ id: OWN.id, name: OWN.name, color: own.color, paint: null })} />
            </div>
            {/* Who owns one, under the colors: on the way to buying it */}
            {owners.length > 0 && (
              <button type="button" className="fl-owners" onClick={() => setView('owners')}>
                <span className="fl-faces" aria-hidden>
                  {owners.slice(0, 4).map((owner, i) => {
                    const paint = PAINTS.find((p) => p.id === owner.paint) ?? PAINTS[0]!
                    return <i key={i} style={{ background: ground(paint) }} />
                  })}
                </span>
                <span>
                  Owned by <b>{owners.slice(0, 2).map((owner) => owner.name).join(', ')}</b>
                  {owners.length > 2 ? ` and ${owners.length - 2} more` : ''}
                </span>
              </button>
            )}
          </div>
          <div className="fl-buy">
            {chosen.id === OWN.id ? (
              <>
                <b className="num">On request</b>
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
                <small>{isAsked ? 'Requested today. We’ll email you.' : 'Always made to order. No charge now.'}</small>
              </>
            ) : !shelf ? (
              <>
                <b className="num" aria-hidden>
                   
                </b>
                <button type="button" className="fl-btn" aria-disabled="true">
                  One moment…
                </button>
                <small> </small>
              </>
            ) : price ? (
              <>
                <b className="num">{price}</b>
                <button type="button" className="fl-btn" onClick={buy}>
                  {chosen.paint?.stock === 'now' ? 'Buy' : 'Order'}
                </button>
                <small>{chosen.paint?.stock === 'now' ? 'Available now.' : 'Made to order.'} Your points bring it down.</small>
              </>
            ) : email ? (
              // Logged in, and the store has no price for this one (or is not answering): it can be opened all the same
              <>
                <button type="button" className="fl-btn" aria-disabled={!product || undefined} onClick={() => product && buy()}>
                  {product ? 'See this chair' : 'Not available just now'}
                </button>
                <small>{chosen.paint?.stock === 'now' ? 'Available now.' : 'Made to order.'}</small>
              </>
            ) : (
              <>
                <button type="button" className="fl-btn" onClick={seePrice}>
                  Log in to see the price
                </button>
                <small>The chair’s price is for members. Logging in is free.</small>
              </>
            )}
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
            {OWNERS_SHOWN.map((owner, i) => {
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
      {view === 'bts' && (
        <div className="bts" data-autofocus tabIndex={-1}>
          <header>
            <h1>BTS</h1>
            <p>How a chair is made, in pictures and film.</p>
          </header>
          <ol className="bts-wall">
            {MAKING_SHOWN.map((piece) => (
              <li key={piece.id} className={`bts-tile ${piece.shape}`}>
                <button type="button" aria-label={`${piece.kind === 'video' ? 'Play' : 'Open'}: ${piece.says}`} onClick={() => setLook(piece)}>
                  <span className="bts-pic" style={piece.src && piece.kind === 'photo' ? undefined : { background: `linear-gradient(150deg, ${piece.tone ?? '#26272b'}, #0f1012)` }}>
                    {piece.kind === 'photo' && piece.src ? <img src={piece.src} alt="" loading="lazy" draggable={false} /> : piece.poster ? <img src={piece.poster} alt="" loading="lazy" draggable={false} /> : null}
                    {piece.kind === 'video' && (
                      <span className="bts-play" aria-hidden>
                        <Play size={20} strokeWidth={0} fill="currentColor" />
                      </span>
                    )}
                  </span>
                  <span className="bts-says">{piece.says}</span>
                </button>
              </li>
            ))}
          </ol>
          {look && (
            <div className="bts-look" role="dialog" aria-label={look.says} onClick={(e) => e.target === e.currentTarget && setLook(null)} onKeyDown={(e) => e.key === 'Escape' && (e.stopPropagation(), setLook(null))}>
              <figure>
                {look.kind === 'video' && look.src ? (
                  <video src={look.src} poster={look.poster ?? undefined} controls autoPlay playsInline />
                ) : look.src ? (
                  <img src={look.src} alt={look.says} draggable={false} />
                ) : (
                  <span className="bts-none" style={{ background: `linear-gradient(150deg, ${look.tone ?? '#26272b'}, #0f1012)` }}>
                    This film has not been supplied yet.
                  </span>
                )}
                <figcaption>
                  {look.says}
                  <button type="button" className="pill" autoFocus onClick={() => setLook(null)}>
                    Done
                  </button>
                </figcaption>
              </figure>
            </div>
          )}
        </div>
      )}
      {/* Buying: the store's own page for this chair, in this window. The colors along its foot are the other
          chairs; "View all" comes back to the studio */}
      {framed && (
        <div className="wx-buy" hidden={view !== 'buy'}>
          <StoreFrame
            ref={frame}
            room="chairs"
            title="Workspace: buying a chair"
            first={`/vip/store/?k=chairs&p=${encodeURIComponent(chosen?.paint?.product ?? '')}`}
            onAt={(place) => {
              if (!place.product) return setView((now) => (now === 'buy' ? 'studio' : now))
              // Another color picked along the foot of the store's page: the studio follows
              const paint = PAINTS.find((p) => p.product === place.product)
              if (paint && paint.id !== picked.get()?.id) choose(chosenOf(paint))
            }}
          />
        </div>
      )}
    </Window>
  )
}

/** The chair on its turntable: dragged to turn it. A drawing stands in for it until the 3D chair has been drawn, and stays where it cannot be. */
/** How large the color's name is set behind the chair, at most; and how much of the studio's width its longest word may take. */
const WORD = 176
const WORD_ROOM = 0.868

/** The color's name, huge behind the chair: a word to a line, as large as the design sets it where that
 * fits, and smaller for a long word (Championship, Alexandrite), so that none runs off the window. */
function Word({ name }: { name: string }) {
  const word = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    const el = word.current
    const room = el?.parentElement
    if (!el || !room) return
    const fit = () => {
      el.style.fontSize = `${WORD}px`
      const widest = Math.max(...[...el.children].map((line) => line.getBoundingClientRect().width))
      const most = room.getBoundingClientRect().width * WORD_ROOM
      if (widest > most) el.style.fontSize = `${Math.floor((WORD * most) / widest)}px`
    }
    fit()
    // (measured again when the type it is set in has arrived, and when the window is another width)
    let live = true
    void document.fonts?.ready.then(() => live && fit())
    const watch = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(fit)
    watch?.observe(room)
    return () => {
      live = false
      watch?.disconnect()
    }
  }, [name])
  return (
    <span ref={word} className="fl-word" aria-hidden>
      {name.split(' ').map((line, i) => (
        <span key={i}>{line}</span>
      ))}
    </span>
  )
}

function Turntable({ color, shift, matte, name, live }: { color: string; shift?: string[]; matte?: boolean; name: string; live: boolean }) {
  const box = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const stage = useRef<Stage | null>(null)
  const [drawn, setDrawn] = useState(false)
  const [angle, setAngle] = useState(0)
  const paint = useRef({ color, shift, matte })
  paint.current = { color, shift, matte }

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
        made.paint(paint.current.color, paint.current.shift, paint.current.matte)
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
  useEffect(() => stage.current?.paint(color, shift, matte), [color, shift, matte])
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
