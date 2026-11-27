import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { ChevronLeft, Play, Rotate3d, X } from 'lucide-react'
import { fmtCents, priceCents } from '../../store/shared/rules'
import { galleryOf, type Slide } from '../../store/src/pictures'
import { W_S } from '../data/lettering'
import { ALL_PAINTS, inkOn, MORE, PAINTS, PAPER, shadedOn, type Making, type Paint } from '../data/workspace'
import { FINISH_WORDS } from '../../store/shared/colors'
import { Window } from '../kit/window'
import { account, askLogIn } from '../os/account'
import { isOn } from '../os/address'
import { prefersReducedMotion } from '../os/dom'
import { launchApp } from '../os/launch'
import { loadShop, useShelf, wantShop } from '../os/shop'
import { useStore } from '../os/store'
import { addToBar, onBar, pick, picked } from '../os/workspace'
import { wm } from '../os/wm'
import { addressOf, Balance, StoreFrame, type FrameHandle } from './storefront'
import { chosenOf, ground, leadOf, MAKING_SHOWN, OWNERS_SHOWN, stockOf, Turntable, type Chosen } from './workspace/parts'
import { ChairStill } from './workspace/Still'
import '../styles/desk/workspace.css'

// Workspace: the studio (design/v1-workspace, and Dom's notes after testing it, twice). The chair is chosen
// here and bought here. It opens, every time, on the colors: a slab for each of the eight it is known by, and
// one that opens the sixteen more. Pick one and the whole window becomes a studio in that color: a lit cove
// from edge to edge (the window's bar is laid over it), the color's name set huge behind the chair, the
// chair itself on a turntable with photographs of it beside (one picked fills the window, under a shade the
// controls can still be read on), the colors in a small glass tray of dots with who owns one under them,
// and the price and one button. The tray is as wide as the window leaves it: it has the eight, then any of
// the sixteen more that has been picked (each is added to it, and stays for the visit: loaded again, the site
// has the eight), and at its end the dot that lets
// the sixteen down. In a narrower window it holds fewer dots, and those it has no room for are in the grid
// with the sixteen. The price is said to someone logged in. Buy opens the store's own page for
// that chair inside this window (storefront.tsx), in that chair's color: the same checkout as everywhere,
// in dollars, with their points to bring it down and their address already on file.
//
// Two more things are in its bar: BTS, a wall of how a chair is made, and Notable Owners. Each has a way back.
//
// The chair is a 3D model, turned by dragging (workspace/stage.ts). Until it has loaded, and wherever a
// browser cannot draw in 3D, a drawing of the chair in the same paint stands where it will be.

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
  // Which of the chair's pictures is on the stage: the 3D chair (null), or one of its gallery's slides. And
  // how it came to be: one picture pushes the last off the stage (`moving`, for as long as that takes),
  // from the right going on and from the left going back (`dir`), `from` being what it pushes off.
  const [stage, setStage] = useState<{ shot: number | null; from: number | null; dir: 1 | -1; moving: boolean }>({ shot: null, from: null, dir: 1, moving: false })
  const shot = stage.shot
  /** Shows one of them. On to a photograph it comes in from the right, the way a carousel is pushed on; back
   * to the chair, or to an earlier photograph, from the left. */
  const setShot = (next: number | null) =>
    setStage((now) => (now.shot === next ? now : { shot: next, from: now.shot, dir: next !== null && (now.shot === null || next > now.shot) ? 1 : -1, moving: !prefersReducedMotion() }))
  useEffect(() => {
    if (!stage.moving) return
    const done = setTimeout(() => setStage((now) => ({ ...now, moving: false })), PUSH)
    return () => clearTimeout(done)
  }, [stage])
  /** The photographs come in by themselves, after the 3D chair has been looked at a while (below), until
   * whoever is looking takes over: picks a picture, or takes hold of the chair. */
  const [auto, setAuto] = useState(true)
  /** A film or photograph of the wall, opened large. */
  const [look, setLook] = useState<Making | null>(null)
  const frame = useRef<FrameHandle>(null)
  const [framed, setFramed] = useState(false)

  const chosen: Chosen | null = kept ? (ALL_PAINTS.map(chosenOf).find((c) => c.id === kept.id) ?? null) : null
  const member = who.status === 'member'
  useEffect(() => {
    // (another color: its chair, with nothing pushed anywhere, and its photographs to come by themselves again)
    setStage({ shot: null, from: null, dir: 1, moving: false })
    setAuto(true)
  }, [chosen?.id])
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
  /** A color picked from the grid: the studio is in it. One of the sixteen more is added to the tray, where it stays for the visit. */
  const pickMore = (c: Chosen) => {
    choose(c)
    setMore(false)
    setView('studio')
  }
  // (however one of the sixteen came to be the studio's color: from the grid, or from the store's page. One kept
  // from last time is not added while the colors are still up: picked from them, the studio opens on the eight)
  useEffect(() => {
    if (view === 'studio' && chosen?.paint.more) addToBar(chosen.id)
  }, [view, chosen?.id, chosen?.paint.more])

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
    const measure = () => {
      const pick = el.querySelector<HTMLElement>('.fl-pick')
      if (!pick) return
      const info = el.querySelector<HTMLElement>('.fl-info')?.offsetWidth ?? 0
      const buy = el.querySelector<HTMLElement>('.fl-buy')?.offsetWidth ?? 0
      const wide = pick.clientWidth
      // (everything in the window is as large as the window makes it: the dots too. scaleOf is the stylesheet's --wsu)
      const k = scaleOf(el.closest<HTMLElement>('.fl'))
      const PAD = 32 * k
      const sizes = SIZES.map((one) => ({ dot: Math.round(one.dot * k), gap: Math.round(one.gap * k) }))
      const fits = (size: { dot: number; gap: number }) => Math.floor((wide - PAD + size.gap) / (size.dot + size.gap))
      const size = sizes.find((one) => fits(one) >= all) ?? sizes[sizes.length - 1]!
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
  // Its gallery, a slide at a time beside the 3D chair. A slide is a landscape photograph, which fills the
  // window; two upright ones, which share it side by side; or one upright one, whole, inside it (which is
  // which is Shrug's to say: galleryOf in store/src/pictures.ts)
  const shots = product ? galleryOf(product) : []
  const photo = shot !== null ? (shots[shot] ?? null) : null
  /** A photograph is on the stage and has covered it: one still on its way in over the chair has not. */
  const covered = !!photo && !(stage.moving && stage.from === null)
  // ---- The automatic push (Niv, 27 Nov): from the 3D chair into its horizontal photography. The chair is
  // looked at for a while; then its first photograph that fills the window pushes in from the right, and the
  // next after it, and when they have all been shown the chair comes back, and round again. An upright
  // photograph shown whole is left for whoever picks it. It stops for good, for this color, as soon as a
  // picture is picked or the chair is taken hold of; nothing moves by itself for someone who has asked for
  // less motion, on a desk asked to keep still (?still), or while the window or the page is out of sight.
  const filling = shots.map((slide, n) => (slide.kind === 'portrait' ? -1 : n)).filter((n) => n >= 0)
  const nextAuto = shot === null ? (filling[0] ?? null) : (filling.find((n) => n > shot) ?? null)
  const pushes = auto && view === 'studio' && shown && filling.length > 0 && !QUIET && !prefersReducedMotion()
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!pushes || stage.moving) return
    const timer = setTimeout(
      () => {
        // (out of sight, it waits where it is)
        if (document.hidden) return setTick((n) => n + 1)
        setStage((now) => (now.shot === nextAuto ? now : { shot: nextAuto, from: now.shot, dir: nextAuto === null ? -1 : 1, moving: true }))
      },
      shot === null ? HOLD_CHAIR : HOLD_PHOTO,
    )
    return () => clearTimeout(timer)
  }, [pushes, stage.moving, shot, nextAuto, tick])
  /** What is drawn of the gallery: the photograph on the stage, the one it is pushing off, and the one that
   * comes next by itself, which is held ready out of sight so that it is there, whole, when it is pushed on. */
  const layers = [...new Set([stage.moving ? stage.from : null, shot, pushes ? nextAuto : null].filter((n): n is number => n !== null && !!shots[n]))]
  /** How many photographs come before a slide, and how many there are in all: what each is called by. */
  const before = (n: number) => shots.slice(0, n).reduce((sum, slide) => sum + slide.shots.length, 0)
  const photographs = before(shots.length)
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
  const ink = view === 'studio' && covered ? '#fff' : coloured ? inkOn(chosen.color) : '#141414'
  const dark = ink === '#fff'
  // (at checkout a shifting paint is its one color: the store's page, which is drawn in it, has one ground)
  const cove = view === 'buy' && chosen ? chosen.color : coloured ? ground(chosen) : PAPER
  // How the chips are set off from the ground: on paper a little darker; on a color a little lighter, as the
  // design has them, unless white words could not then be read on one (data/workspace.ts)
  const chips = view === 'studio' && covered ? ' dark shade' : !coloured ? '' : dark ? (shadedOn(chosen.color) ? ' dark shade' : ' dark') : ' hue'
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
            <h1>Your new daily driver</h1>
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
                  {/* Each slab holds its chair from the start, loaded and unseen, so that it is there the moment the pointer is */}
                  <ChairStill className="ch" paint={c.id} width={168} held />
                  <b>{c.name}</b>
                  <small>{stockOf(c.paint)}</small>
                </button>
              )
            })}
            {/* The sixteen more, each painted to order: a slab of all of them at once, which lets the grid down */}
            <button type="button" className="fl-slab eight more" aria-haspopup="dialog" onClick={() => setMore(true)}>
              <span className="fl-mosaic" aria-hidden>
                {MORE.map((paint) => (
                  <i key={paint.id} style={{ background: paint.color }} />
                ))}
              </span>
              <b>Custom Coloring</b>
              <small>Made to Order</small>
            </button>
          </div>
        </div>
      )}
      {view === 'studio' && chosen && (
        <div className={`fl st${chips}`} data-photo={covered ? '' : undefined} data-stage={stage.moving && (stage.from === null || shot === null) ? (shot === null ? 'in' : 'out') : undefined}>
          <span className="st-light" aria-hidden />
          <span className="st-floor" aria-hidden />
          <Word name={chosen.name} />
          {/* (taken hold of, or turned from the keyboard, the chair is theirs: nothing pushes it off by itself after that) */}
          <div className="st-stage" data-shot={covered || undefined} onPointerDownCapture={() => setAuto(false)} onKeyDownCapture={() => setAuto(false)}>
            <Turntable id={chosen.id} color={chosen.color} shift={chosen.shift} finish={chosen.paint.finish} name={chosen.name} live={shown && !covered} />
          </div>
          {/* A photograph on the stage fills the window, under a shade the controls can still be read on. One too
              narrow to fill it is set whole, on a blur of itself. It comes in by pushing off what was there, and
              is pushed off in its turn (`layers`: the one on the stage, the one going, and the one held ready) */}
          {layers.map((n) => {
            const slide: Slide = shots[n]!
            const on = n === shot
            const going = stage.moving && n === stage.from && !on
            return (
              <div key={slide.shots[0]!.full} className="st-photo" data-fit={slide.kind === 'pair' ? 'pair' : slide.kind === 'wide' ? 'fill' : 'whole'} data-enter={on && stage.moving ? stage.dir : undefined} data-leave={going ? stage.dir : undefined} data-ahead={!on && !going ? '' : undefined} aria-hidden={on ? undefined : true}>
                {slide.kind !== 'pair' && <img className="st-photo__back" src={slide.shots[0]!.small} alt="" aria-hidden draggable={false} />}
                {slide.shots.map((one, i) => (
                  <img key={one.full} className="st-photo__pic" src={one.full} srcSet={one.set} sizes={slide.kind === 'pair' ? '550px' : slide.kind === 'wide' ? '1100px' : `${Math.round(560 * (one.aspect ?? 0.75))}px`} alt={on ? (one.alt ?? `${chosen.name}: photograph ${before(n) + i + 1} of ${photographs}`) : ''} draggable={false} />
                ))}
                <span className="st-photo__shade" aria-hidden />
              </div>
            )
          })}
          {/* The chair's pictures, beside it: the 3D chair, and each photograph there is of it in this color */}
          {shots.length > 0 && (
            <div className="st-shots" role="group" aria-label={`Pictures of the chair in ${chosen.name}`}>
              <button type="button" className="st-shot" aria-pressed={shot === null} aria-label="The chair in 3D" onClick={() => (setAuto(false), setShot(null))}>
                <Rotate3d size={18} strokeWidth={1.9} aria-hidden />
                <span>3D</span>
              </button>
              {shots.map((slide, n) => {
                const from = before(n) + 1
                return (
                  <button key={slide.shots[0]!.full} type="button" className="st-shot" data-pair={slide.shots.length > 1 || undefined} aria-pressed={shot === n} aria-label={slide.shots.length > 1 ? `Photographs ${from} and ${from + 1} of ${photographs}` : `Photograph ${from} of ${photographs}`} data-next={pushes && !stage.moving && n === nextAuto ? '' : undefined} style={pushes && n === nextAuto ? ({ '--hold': `${shot === null ? HOLD_CHAIR : HOLD_PHOTO}ms` } as CSSProperties) : undefined} onClick={() => (setAuto(false), setShot(n))}>
                    {slide.shots.map((one) => (
                      <img key={one.full} src={one.small} alt="" loading="lazy" draggable={false} />
                    ))}
                  </button>
                )
              })}
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
                  {/* (words alone: the dots of color that stood before them read as more colors to pick, Niv, 27 Nov) */}
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

/** How large the color's name is set behind the chair, at most; and how much of the studio's width its longest word may take. */
const WORD = 176

/** How long the 3D chair is looked at before its photographs begin to come in by themselves, how long each
 * of those is shown, and how long one takes to push the last off the stage (the stylesheet's own figure). */
const HOLD_CHAIR = 9000
const HOLD_PHOTO = 5200
const PUSH = 720
/** A desk asked to keep still (?still): nothing on it moves by itself. */
const QUIET = typeof window !== 'undefined' && isOn('still')

/** How much larger or smaller than it opens the studio is drawn: 1 in a window 1100 by 720, and with the
 * window from there, between about four fifths and half as much again (the stylesheet's --wsu, as a number). */
const scaleOf = (studio: HTMLElement | null) => (studio ? Math.max(0.82, Math.min(1.5, Math.min(studio.clientWidth / 1100, studio.clientHeight / 720))) : 1)
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
      // (as large as the window makes it: 176 in the window as it opens)
      const full = Math.round(WORD * scaleOf(room))
      el.style.fontSize = `${full}px`
      const widest = Math.max(...[...el.children].map((line) => line.getBoundingClientRect().width))
      const most = room.getBoundingClientRect().width * WORD_ROOM
      if (widest > most) el.style.fontSize = `${Math.floor((full * most) / widest)}px`
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
