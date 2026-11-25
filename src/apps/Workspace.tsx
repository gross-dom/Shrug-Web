import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { ChevronLeft, Play, Rotate3d, X } from 'lucide-react'
import { fmtCents, priceCents } from '../../store/shared/rules'
import { shotsOf } from '../../store/src/pictures'
import { W_S } from '../data/lettering'
import { ALL_PAINTS, inkOn, MAKING, MORE, OWNERS, PAINTS, PAPER, shadedOn, type Making, type Paint } from '../data/workspace'
import { FINISH_WORDS, type Finish } from '../../store/shared/colors'
import { TEMPLATED } from '../data/site'
import { Window } from '../kit/window'
import { account, askLogIn } from '../os/account'
import { prefersReducedMotion } from '../os/dom'
import { launchApp } from '../os/launch'
import { loadShop, useShelf, wantShop } from '../os/shop'
import { useStore } from '../os/store'
import { addToBar, onBar, pick, picked } from '../os/workspace'
import { wm } from '../os/wm'
import { addressOf, Balance, StoreFrame, type FrameHandle } from './storefront'
import type { Stage } from './workspace/stage'
import { ChairStill } from './workspace/Still'
import '../styles/desk/workspace.css'

// Workspace: the studio (design/v1-workspace, and Dom's notes after testing it, twice). The chair is chosen
// here and bought here. It opens, every time, on the colors: a slab for each of the eight it is known by, and
// one that opens the sixteen more. Pick one and the whole window becomes a studio in that color: a lit cove
// from edge to edge (the window's bar is laid over it), the color's name set huge behind the chair, the
// chair itself on a turntable with photographs of it beside (one picked fills the window, under a shade the
// controls can still be read on), the colors in a small glass tray of dots with who owns one under them,
// and the price and one button. The tray is as wide as the window leaves it: it has the eight, then any of
// the sixteen more that has been picked (each is added to it, and stays), and at its end the dot that lets
// the sixteen down. In a narrower window it holds fewer dots, and those it has no room for are in the grid
// with the sixteen. The price is said to someone logged in. Buy opens the store's own page for
// that chair inside this window (storefront.tsx), in that chair's color: the same checkout as everywhere,
// in dollars, with their points to bring it down and their address already on file.
//
// Two more things are in its bar: BTS, a wall of how a chair is made, and Notable Owners. Each has a way back.
//
// The chair is a 3D model, turned by dragging (workspace/stage.ts). Until it has loaded, and wherever a
// browser cannot draw in 3D, a drawing of the chair in the same paint stands where it will be.

/** A color as the studio holds it. */
interface Chosen {
  id: string
  name: string
  color: string
  shift?: string[]
  paint: Paint
}

const chosenOf = (paint: Paint): Chosen => ({ id: paint.id, name: paint.name, color: paint.color, shift: paint.shift, paint })
/** What a slab, a dot or the cove is painted with: the color, or for a shifting paint the colors it moves through. */
const ground = (c: { color: string; shift?: string[] }) => (c.shift ? `linear-gradient(135deg, ${c.shift.join(', ')})` : c.color)
const stockOf = (paint: Paint) => (paint.shift ? 'Color-shifting' : paint.stock === 'now' ? 'Available now' : 'Made to order')
/** How a chair in a color is to be had, as the studio says it on the color's tag: every color can be bought; one that is not in stock is made, and takes its weeks. */
const leadOf = (paint: Paint) => (paint.stock === 'now' ? 'Available now' : 'Made to order · 2–3 weeks')
const COUNT = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten']
/** A visitor never reads a note written for Shrug: what is still templated is the demo's and the editor's. */
const real = (text: string) => !text.startsWith('[')
const OWNERS_SHOWN = TEMPLATED ? OWNERS : OWNERS.filter((owner) => real(owner.name))
const MAKING_SHOWN = TEMPLATED ? MAKING : MAKING.filter((piece) => piece.src && real(piece.says))
/** A photograph wide enough to fill the window whole; a narrower one is set whole on a blur of itself. */
const WIDE = 1.25

type View = 'first' | 'studio' | 'owners' | 'bts' | 'buy'

export function WorkspaceApp() {
  const open = useStore(wm, (s) => s.wins.workspace.open)
  const shown = useStore(wm, (s) => s.wins.workspace.open && !s.wins.workspace.minimized)
  useEffect(() => {
    if (open) wantShop()
  }, [open])
  const who = useStore(account, (s) => s)
  const kept = useStore(picked, (s) => s)
  const added = useStore(onBar, (s) => s)
  const shelf = useShelf('chairs')
  // It opens on the colors, every time it is opened: choosing one is what Workspace is for. (The color last
  // picked is still kept: it is the one the Dock's icon wears.)
  const [view, setView] = useState<View>('first')
  useEffect(() => {
    if (open) setView('first')
  }, [open])
  const [flood, setFlood] = useState<string | null>(null)
  const [hover, setHover] = useState<string | null>(null)
  /** The sixteen more colors, let down as a grid to pick from. */
  const [more, setMore] = useState(false)
  /** Which of the chair's pictures is on the stage: the 3D chair (null), or one of its photographs. */
  const [shot, setShot] = useState<number | null>(null)
  /** A film or photograph of the wall, opened large. */
  const [look, setLook] = useState<Making | null>(null)
  const frame = useRef<FrameHandle>(null)
  const [framed, setFramed] = useState(false)

  const chosen: Chosen | null = kept ? (ALL_PAINTS.map(chosenOf).find((c) => c.id === kept.id) ?? null) : null
  const member = who.status === 'member'
  useEffect(() => setShot(null), [chosen?.id])
  /** Where the bar's way back leads, and what from: the studio if a color is picked, or the slabs. */
  const home: View = chosen ? 'studio' : 'first'

  const choose = (c: Chosen) => pick({ id: c.id, color: c.color, shift: c.shift })
  /** From a slab: the slab grows to fill the window, and the studio is there when it has. A cut, for a visitor who has asked for less motion. */
  const enter = (c: Chosen) => {
    choose(c)
    if (prefersReducedMotion()) return setView('studio')
    setFlood(c.id)
    setTimeout(() => (setFlood(null), setView('studio')), 420)
  }
  /** A color picked from the grid: the studio is in it. One of the sixteen more is added to the tray, where it stays. */
  const pickMore = (c: Chosen) => {
    choose(c)
    setMore(false)
    setView('studio')
  }
  // (however one of the sixteen came to be the color: from the grid, from the store's page, or kept from last time)
  useEffect(() => {
    if (chosen?.paint.more) addToBar(chosen.id)
  }, [chosen?.id, chosen?.paint.more])

  // ---- The tray: the eight, then what has been added, in as many dots as there is room for
  const tray = [...PAINTS, ...added.map((id) => MORE.find((p) => p.id === id)).filter((p): p is Paint => !!p)].map(chosenOf)
  const foot = useRef<HTMLDivElement>(null)
  /** How many dots the tray has room for (the one that lets the grid down among them), and how far it is moved to stand under the middle of the window. */
  const [room, setRoom] = useState({ dots: 99, nudge: 0, dot: 36, gap: 10 })
  const all = tray.length + 1
  useLayoutEffect(() => {
    const el = foot.current
    if (!el || view !== 'studio') return
    // The dots are drawn as large as lets them all in, down to the smallest that can still be told apart
    // and pressed; only past that does the tray hold fewer of them
    const SIZES = [
      { dot: 36, gap: 10 },
      { dot: 30, gap: 8 },
      { dot: 26, gap: 7 },
    ]
    const PAD = 32
    const measure = () => {
      const pick = el.querySelector<HTMLElement>('.fl-pick')
      if (!pick) return
      const info = el.querySelector<HTMLElement>('.fl-info')?.offsetWidth ?? 0
      const buy = el.querySelector<HTMLElement>('.fl-buy')?.offsetWidth ?? 0
      const wide = pick.clientWidth
      const fits = (size: { dot: number; gap: number }) => Math.floor((wide - PAD + size.gap) / (size.dot + size.gap))
      const size = SIZES.find((one) => fits(one) >= all) ?? SIZES[SIZES.length - 1]!
      const dots = Math.max(2, Math.min(all, fits(size)))
      const slack = Math.max(0, wide - (dots * size.dot + (dots - 1) * size.gap + PAD))
      const nudge = Math.round(Math.max(-slack / 2, Math.min(slack / 2, (buy - info) / 2)))
      setRoom((was) => (was.dots === dots && was.nudge === nudge && was.dot === size.dot ? was : { dots, nudge, ...size }))
    }
    measure()
    const watch = new ResizeObserver(measure)
    watch.observe(el)
    for (const part of el.children) watch.observe(part)
    return () => watch.disconnect()
  }, [view, all, chosen?.id])
  /** The dots there is room for: the eight, then of what has been added the latest, and always the color that is picked. */
  const shownDots = (() => {
    const n = Math.max(1, Math.min(tray.length, room.dots - 1))
    const eight = tray.filter((c) => !c.paint.more)
    const addedOn = tray.filter((c) => c.paint.more)
    const first = n >= eight.length ? [...eight, ...addedOn.slice(addedOn.length - (n - eight.length))] : eight.slice(0, n)
    if (!chosen || first.some((c) => c.id === chosen.id)) return first
    const mine = tray.find((c) => c.id === chosen.id)
    // (the one picked takes the place of the oldest of what was added, or of the last of the eight)
    if (!mine) return first
    return n > eight.length ? [...eight, mine, ...first.slice(eight.length + 1)] : [...first.slice(0, n - 1), mine]
  })()
  /** Those there is no room for: they are in the grid, ahead of the sixteen. */
  const crowded = tray.filter((c) => !c.paint.more && !shownDots.some((d) => d.id === c.id))

  // ---- A chair in one of the colors: what the store says of it, and the way to its page

  const product = chosen ? (shelf?.products.find((p) => p.id === chosen.paint.product) ?? null) : null
  /** Its price, as it is said: only to someone logged in, and never one the store has not given. */
  const price = product && !product.priceHidden && product.points ? `From ${fmtCents(priceCents(product))}` : null
  // (its photographs: a color that has none yet has the chair drawn in the store's pages, and here the chair itself)
  const shots = product ? shotsOf(product).filter((s) => !s.drawn) : []
  const photo = shot !== null ? (shots[shot] ?? null) : null
  /** The store's page for a chair, in that chair's color. */
  const pageOf = (c: Chosen) => `${addressOf('chairs', c.paint.product)}&c=${c.color.slice(1)}`
  const buy = () => {
    if (!chosen) return
    setView('buy')
    if (framed) frame.current?.to(pageOf(chosen))
    else setFramed(true)
  }
  const enquire = () => {
    if (!chosen) return
    askLogIn('price', `${chosen.name} is kept while you log in.`)
  }

  const coloured = (view === 'studio' || view === 'buy') && !!chosen
  // Over a photograph the words are white, on the shade laid under them
  const ink = view === 'studio' && photo ? '#fff' : coloured ? inkOn(chosen.color) : '#141414'
  const dark = ink === '#fff'
  // (at checkout a shifting paint is its one color: the store's page, which is drawn in it, has one ground)
  const cove = view === 'buy' && chosen ? chosen.color : coloured ? ground(chosen) : PAPER
  // How the chips are set off from the ground: on paper a little darker; on a color a little lighter, as the
  // design has them, unless white words could not then be read on one (data/workspace.ts)
  const chips = view === 'studio' && photo ? ' dark shade' : !coloured ? '' : dark ? (shadedOn(chosen.color) ? ' dark shade' : ' dark') : ' hue'
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
    <Window className={`app wxwin${chips}${view === 'buy' ? ' buying' : ''}`} lightsSize="large" lead={bar} body={{ className: 'wxwin__body' }} style={{ background: cove, color: ink }}>
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
            {PAINTS.map(chosenOf).map((c) => {
              const big = hover === c.id && !flood
              return (
                <button
                  key={c.id}
                  type="button"
                  className={`fl-slab eight${big ? ' big' : ''}${flood === c.id ? ' flood' : ''}`}
                  style={{ background: ground(c), color: inkOn(c.color) }}
                  onPointerEnter={(e) => e.pointerType === 'mouse' && setHover(c.id)}
                  onPointerLeave={() => setHover(null)}
                  onFocus={() => setHover(c.id)}
                  onBlur={() => setHover(null)}
                  onClick={() => enter(c)}
                >
                  {big && <ChairStill className="ch" paint={c.color} shift={c.shift} width={150} />}
                  <b>{c.name}</b>
                  <small>{stockOf(c.paint)}</small>
                </button>
              )
            })}
            {/* The sixteen more: a slab of all of them at once, which lets the grid down */}
            <button type="button" className="fl-slab eight more" aria-haspopup="dialog" onClick={() => setMore(true)}>
              <span className="fl-mosaic" aria-hidden>
                {MORE.map((paint) => (
                  <i key={paint.id} style={{ background: paint.color }} />
                ))}
              </span>
              <b>{MORE.length} more colors</b>
              <small>Made to order</small>
            </button>
          </div>
        </div>
      )}
      {view === 'studio' && chosen && (
        <div className={`fl st${chips}`} data-photo={photo ? '' : undefined}>
          <span className="st-light" aria-hidden />
          <span className="st-floor" aria-hidden />
          <Word name={chosen.name} />
          <div className="st-stage" data-shot={shot !== null || undefined}>
            <Turntable color={chosen.color} shift={chosen.shift} finish={chosen.paint.finish} name={chosen.name} live={shown && shot === null} />
          </div>
          {/* A photograph picked fills the window, under a shade the controls can still be read on. One too
              narrow to fill it is set whole, on a blur of itself */}
          {photo && (
            <div className="st-photo" data-fit={(photo.aspect ?? 1) >= WIDE ? 'fill' : 'whole'}>
              <img className="st-photo__back" src={photo.small} alt="" aria-hidden draggable={false} />
              <img className="st-photo__pic" src={photo.full} srcSet={photo.set} sizes="1100px" alt={`${chosen.name}: photograph ${shot! + 1} of ${shots.length}`} draggable={false} />
              <span className="st-photo__shade" aria-hidden />
            </div>
          )}
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
          <div className="st-foot" ref={foot}>
            <div className="fl-info">
              <h2>{chosen.name}</h2>
              {(chosen.paint.line || chosen.shift) && (
                <p>
                  {chosen.paint.line}
                  {chosen.shift ? `${chosen.paint.line ? ' ' : ''}Turn it to see it shift.` : ''}
                </p>
              )}
              <div className="st-tags">
                {/* How it is finished, as the catalog words it, and how it is to be had */}
                <span className="st-tag">{FINISH_WORDS[chosen.paint.finish]}</span>
                <span className="st-tag">{leadOf(chosen.paint)}</span>
              </div>
            </div>
            <div className="fl-pick">
              <div className="fl-dock" role="group" aria-label="Colors" style={{ ['--nudge' as string]: `${room.nudge}px`, ['--dot' as string]: `${room.dot}px`, ['--dot-gap' as string]: `${room.gap}px` }}>
                {shownDots.map((c) => (
                  <button key={c.id} type="button" className={`fl-dot${chosen.id === c.id ? ' on' : ''}`} style={{ background: ground(c), color: ink }} aria-label={c.name} aria-pressed={chosen.id === c.id} onClick={() => choose(c)} />
                ))}
                {/* The sixteen more, and whatever of the tray there is no room for: the dot at its end lets the grid down */}
                <button type="button" className="fl-dot more" style={{ color: ink }} aria-label="More colors" aria-haspopup="dialog" onClick={() => setMore(true)} />
              </div>
              {/* Who owns one, under the colors: on the way to buying it. (Nobody is said to own one of the sixteen more.) */}
              {owners.length > 0 && !chosen.paint.more && (
                <button type="button" className="fl-owners" style={{ ['--nudge' as string]: `${room.nudge}px` }} onClick={() => setView('owners')}>
                  <span className="fl-faces" aria-hidden>
                    {owners.slice(0, 4).map((owner, i) => {
                      const paint = ALL_PAINTS.find((p) => p.id === owner.paint) ?? PAINTS[0]!
                      return <i key={i} style={{ background: ground(paint) }} />
                    })}
                  </span>
                  <span>
                    Owned by <b>{owners.slice(0, 2).map((owner) => owner.name).join(', ')}</b>
                    {owners.length > 2 ? ` and ${owners.length - 2} more` : ''}
                  </span>
                </button>
              )}
              {/* (where nobody is said to own one, the line's room is kept, so the tray stands where it stood) */}
              {!(owners.length > 0 && !chosen.paint.more) && <span className="fl-owners" aria-hidden />}
            </div>
            <div className="fl-buy">
              {!shelf ? (
                <button type="button" className="fl-btn" aria-disabled="true">
                  One moment…
                </button>
              ) : price ? (
                <>
                  <b className="num">{price}</b>
                  <button type="button" className="fl-btn" onClick={buy}>
                    {chosen.paint.stock === 'now' ? 'Buy' : 'Order'}
                  </button>
                </>
              ) : member && shelf.down ? (
                // Logged in, and the store did not answer: it is asked again
                <button type="button" className="fl-btn" onClick={() => void loadShop()}>
                  Try again
                </button>
              ) : member ? (
                // Logged in, and the store has no price for this one: its page can be opened all the same, and a
                // color the store does not have yet can be asked for
                <button type="button" className="fl-btn" onClick={() => (product ? buy() : launchApp('messages'))}>
                  {product ? 'See this chair' : 'Ask us about this one'}
                </button>
              ) : (
                <button type="button" className="fl-btn" onClick={enquire}>
                  Log in to enquire
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {view === 'owners' && (
        <div className="ow">
          <h1 className="sr-only">Notable Owners</h1>
          <div className="ow-grid">
            {OWNERS_SHOWN.map((owner, i) => {
              const paint = ALL_PAINTS.find((p) => p.id === owner.paint) ?? PAINTS[0]!
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
        </div>
      )}
      {view === 'bts' && (
        <div className="bts" data-autofocus tabIndex={-1}>
          <h1 className="sr-only">BTS: how a chair is made</h1>
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
        </div>
      )}
      {/* A picture of the wall, large: over the whole window, wherever the wall is scrolled to. It is put away
          by its x, by a press anywhere off the picture, or by Escape */}
      {view === 'bts' && look && <Look piece={look} onClose={() => setLook(null)} />}
      {/* The sixteen more colors, to pick from */}
      {more && <More picked={chosen?.id ?? null} ahead={view === 'studio' ? crowded : []} onPick={pickMore} onClose={() => setMore(false)} />}
      {/* Buying: the store's own page for this chair, in this window and in its color. The colors along its
          foot are the other chairs; "View all" comes back to the studio */}
      {framed && (
        <div className="wx-buy" hidden={view !== 'buy'}>
          <StoreFrame
            ref={frame}
            room="chairs"
            title="Workspace: buying a chair"
            first={chosen ? pageOf(chosen) : addressOf('chairs')}
            onAt={(place) => {
              if (!place.product) return setView((now) => (now === 'buy' ? 'studio' : now))
              // Another color picked along the foot of the store's page: the studio follows, and so does the page's own color
              const paint = ALL_PAINTS.find((p) => p.product === place.product)
              if (paint && paint.id !== picked.get()?.id) {
                choose(chosenOf(paint))
                frame.current?.tint(paint.color)
              }
            }}
          />
        </div>
      )}
    </Window>
  )
}

/** The sixteen more colors: a grid of four by four that fills its sheet, each a slab of its color with its
 * name on it. Ahead of them, any color of the tray that the tray had no room for. One picked is the studio's. */
function More({ picked: on, ahead, onPick, onClose }: { picked: string | null; ahead: Chosen[]; onPick: (c: Chosen) => void; onClose: () => void }) {
  const sheet = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const first = sheet.current?.querySelector<HTMLElement>('[aria-pressed="true"]') ?? sheet.current?.querySelector<HTMLElement>('.mc-swatch')
    first?.focus()
  }, [])
  return (
    <div className="wx-more" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={sheet}
        className="mc-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="More colors"
        onKeyDown={(e) => {
          if (e.key === 'Escape') e.stopPropagation(), onClose()
        }}
      >
        <div className="mc-grid" role="group" aria-label="Colors">
          {[...ahead, ...MORE.map(chosenOf)].map((c) => (
            <button key={c.id} type="button" className="mc-swatch" style={{ background: ground(c), color: inkOn(c.color) }} aria-pressed={on === c.id} onClick={() => onPick(c)}>
              <span>{c.name}</span>
            </button>
          ))}
        </div>
        <button type="button" className="wx-x" aria-label="Close" onClick={onClose}>
          <X size={14} strokeWidth={2.6} aria-hidden />
        </button>
      </div>
    </div>
  )
}

/** A picture or a film of the wall, large. Nothing is written on it: the wall says what each one is. */
function Look({ piece, onClose }: { piece: Making; onClose: () => void }) {
  const x = useRef<HTMLButtonElement>(null)
  useEffect(() => x.current?.focus(), [])
  return (
    <div
      className="bts-look"
      role="dialog"
      aria-modal="true"
      aria-label={piece.says}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={(e) => {
        if (e.key === 'Escape') e.stopPropagation(), onClose()
      }}
    >
      <figure onClick={(e) => e.target === e.currentTarget && onClose()}>
        {piece.kind === 'video' && piece.src ? (
          <video src={piece.src} poster={piece.poster ?? undefined} controls autoPlay playsInline />
        ) : piece.src ? (
          <img src={piece.src} alt={piece.says} draggable={false} />
        ) : (
          <span className="bts-none" style={{ background: `linear-gradient(150deg, ${piece.tone ?? '#26272b'}, #0f1012)` }}>
            This film has not been supplied yet.
          </span>
        )}
      </figure>
      <button ref={x} type="button" className="wx-x" aria-label="Close" onClick={onClose}>
        <X size={14} strokeWidth={2.6} aria-hidden />
      </button>
    </div>
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

function Turntable({ color, shift, finish, name, live }: { color: string; shift?: string[]; finish: Finish; name: string; live: boolean }) {
  const box = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const stage = useRef<Stage | null>(null)
  const [drawn, setDrawn] = useState(false)
  const [angle, setAngle] = useState(0)
  const paint = useRef({ color, shift, finish })
  paint.current = { color, shift, finish }

  // The stage is made when the studio is first seen, and three.js is fetched then and not before
  useEffect(() => {
    if (!live || stage.current) return
    let gone = false
    void import('./workspace/stage')
      .then(({ makeStage }) => {
        if (gone || !canvas.current || !box.current) return
        const made = makeStage(
          canvas.current,
          !prefersReducedMotion(),
          () => setDrawn(true),
          () => {
            // The chair's file did not arrive: the drawing stays, and nothing is held for a chair that is not there
            made.stop()
            if (stage.current === made) stage.current = null
          },
        )
        stage.current = made
        made.size(box.current.clientWidth, box.current.clientHeight)
        made.paint(paint.current.color, paint.current.shift, paint.current.finish)
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
  useEffect(() => stage.current?.paint(color, shift, finish), [color, shift, finish])
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
