import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { Play, Rotate3d, X } from 'lucide-react'
import { FINISH_WORDS } from '../../../store/shared/colors'
import { fmtCents, priceCents } from '../../../store/shared/rules'
import { galleryOf, type Slide } from '../../../store/src/pictures'
import { chosenOf, ground, leadOf, MAKING_SHOWN, OWNERS_SHOWN, stockOf, Turntable, type Chosen } from '../../apps/workspace/parts'
import { ChairStill } from '../../apps/workspace/Still'
import { W_S } from '../../data/lettering'
import { ALL_PAINTS, inkOn, MORE, PAINTS, PAPER, type Making } from '../../data/workspace'
import { account, askLogIn } from '../../os/account'
import { isOn } from '../../os/address'
import { prefersReducedMotion } from '../../os/dom'
import { launchApp } from '../../os/launch'
import { loadShop, useShelf, wantShop } from '../../os/shop'
import { useStore } from '../../os/store'
import { addToBar, onBar, pick, picked } from '../../os/workspace'
import { LOGIN, LogInSheet } from '../LogIn'
import { closeSheet, openSheet, pop, push, sys } from '../system'
import { BackButton, NavStack, Screen, Sheet, SheetHost, useApp } from '../ui'
import { CHECKOUT, checkOut, CheckoutTray } from './Buying'
import { MyVipSheet } from './MyVip'
import { VIP, Wallet } from './Wallet'
import '../../styles/phone/shop.css'
import '../../styles/phone/workspace.css'

// Workspace on the phone (Dom, 27 Nov: it was the store's shelf of chairs in a tab of its own, and is to be
// the thing the desk has). It is the desk's studio (src/apps/Workspace.tsx) set out for a hand: the same
// colors, the same chair, the same photographs, the same words, and the same store behind Buy.
//
// It opens on the colors, as the desk's does: "Your new daily driver" over a slab for each of the eight, its
// chair standing on it, and one slab that lets the sixteen more up in a sheet. A color picked is a screen
// of its own, flooded with it: the color's name huge behind the chair, the chair in 3D to turn with a
// finger, its photographs in a row under it (one picked covers the stage, and a swipe goes to the next),
// then its name, how it is finished and had, the colors in a row of dots to change it by, who owns one, and
// the price with the one button. Buy is the store's own page for that chair, in this app (Shop.tsx's frame),
// in the chair's color. BTS and Notable Owners are a press from the first screen.
//
// What is picked is kept where the desk keeps it (os/workspace.ts), so the two agree.

const STUDIO = 'studio'
const OWNERS = 'owners'
const BTS = 'bts'
const MORE_SHEET = 'more'

/** How long the 3D chair is looked at before its photographs begin to come by themselves, and how long each is shown. */
const HOLD_CHAIR = 9000
const HOLD_PHOTO = 5200
const PUSH = 520
const QUIET = typeof window !== 'undefined' && isOn('still')

const chosenNow = (kept: { id: string } | null): Chosen | null => (kept ? (ALL_PAINTS.map(chosenOf).find((c) => c.id === kept.id) ?? null) : null)
const choose = (c: Chosen) => pick({ id: c.id, color: c.color, shift: c.shift })
/** The store's page for a chair, in that chair's color. */

/** W/S, as the app's bar has it. (For the eye: the screen's own heading says Workspace.) */
const Mark = () => (
  <span className="wsp-mark" aria-hidden>
    <svg viewBox={`0 ${-W_S.rise} ${W_S.width} ${W_S.rise + W_S.fall}`}>
      <path d={W_S.d} fill="currentColor" />
    </svg>
  </span>
)

// ---- The colors

function Colors() {
  const enter = (c: Chosen) => {
    choose(c)
    push(STUDIO)
  }
  return (
    <Screen title="Workspace" center={<Mark />} trailing={<Wallet />} ground={PAPER} className="wsp wsp-first">
      <h3 className="wsp-head">Your new daily driver</h3>
      <div className="wsp-chips">
        {MAKING_SHOWN.length > 0 && (
          <button type="button" className="wsp-chip" onClick={() => push(BTS)}>
            BTS
          </button>
        )}
        {OWNERS_SHOWN.length > 0 && (
          <button type="button" className="wsp-chip" onClick={() => push(OWNERS)}>
            Notable Owners
          </button>
        )}
      </div>
      <div className="wsp-slabs" role="group" aria-label="Colors">
        {PAINTS.map(chosenOf).map((c) => (
          <button key={c.id} type="button" className="wsp-slab" style={{ background: ground(c), color: inkOn(c.color) }} onClick={() => enter(c)}>
            <ChairStill className="wsp-slab__chair" paint={c.id} width={150} />
            <b>{c.name}</b>
            <small>{stockOf(c.paint)}</small>
          </button>
        ))}
        {/* The sixteen more, each painted to order: one slab of all of them, which lets them up to pick from */}
        <button type="button" className="wsp-slab wsp-slab--more" aria-haspopup="dialog" onClick={() => openSheet(MORE_SHEET)}>
          <span className="wsp-mosaic" aria-hidden>
            {MORE.map((paint) => (
              <i key={paint.id} style={{ background: paint.color }} />
            ))}
          </span>
          <span>
            <b>Custom Coloring</b>
            <small>Made to Order</small>
          </span>
        </button>
      </div>
    </Screen>
  )
}

/** The sixteen more, to pick from: a sheet of slabs, each its color with its name on it. One picked is the studio's. */
function MoreSheet() {
  const kept = useStore(picked, (s) => s)
  const pickMore = (c: Chosen) => {
    choose(c)
    addToBar(c.id)
    // (the sheet goes, and the studio is there in the color: pushed from the colors, or already on the screen)
    const s = sys.get()
    const at = s.stacks.workspace
    closeSheet()
    if (at[at.length - 1] !== STUDIO) setTimeout(() => push(STUDIO), 60)
  }
  return (
    <Sheet label="More colors" title="Custom Coloring" className="wsp-more">
      <div className="wsp-more__grid" role="group" aria-label="Colors">
        {MORE.map(chosenOf).map((c) => (
          <button key={c.id} type="button" className="wsp-swatch" style={{ background: ground(c), color: inkOn(c.color) }} aria-pressed={kept?.id === c.id} onClick={() => pickMore(c)}>
            {c.name}
          </button>
        ))}
      </div>
    </Sheet>
  )
}

// ---- The studio

/** The color's name, huge behind the chair: a word to a line, as large as lets its longest word in. */
function Word({ name }: { name: string }) {
  const word = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    const el = word.current
    const room = el?.parentElement
    if (!el || !room) return
    const fit = () => {
      const full = 132
      el.style.fontSize = `${full}px`
      const widest = Math.max(...[...el.children].map((line) => (line as HTMLElement).offsetWidth))
      const most = room.clientWidth * 0.94
      if (widest > most) el.style.fontSize = `${Math.floor((full * most) / widest)}px`
    }
    fit()
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
    <span ref={word} className="wsp-word" aria-hidden>
      {name.split(' ').map((line, i) => (
        <span key={i}>{line}</span>
      ))}
    </span>
  )
}

function Studio({ top }: { top: boolean }) {
  const { active } = useApp()
  const kept = useStore(picked, (s) => s)
  const added = useStore(onBar, (s) => s)
  const who = useStore(account, (s) => s.status)
  const shelf = useShelf('chairs')
  const chosen = chosenNow(kept) ?? chosenOf(PAINTS[0]!)
  const live = active && top

  // Which of the chair's pictures is on the stage: the 3D chair (null), or one of its gallery's slides; and
  // what it pushed off, and which way, for as long as that takes
  const [stage, setStage] = useState<{ shot: number | null; from: number | null; dir: 1 | -1; moving: boolean }>({ shot: null, from: null, dir: 1, moving: false })
  const shot = stage.shot
  const setShot = (next: number | null) => setStage((now) => (now.shot === next ? now : { shot: next, from: now.shot, dir: next !== null && (now.shot === null || next > now.shot) ? 1 : -1, moving: !prefersReducedMotion() }))
  useEffect(() => {
    if (!stage.moving) return
    const done = setTimeout(() => setStage((now) => ({ ...now, moving: false })), PUSH)
    return () => clearTimeout(done)
  }, [stage])
  /** The photographs come by themselves after the chair has been looked at a while, until whoever is looking takes over. */
  const [auto, setAuto] = useState(true)
  useEffect(() => {
    setStage({ shot: null, from: null, dir: 1, moving: false })
    setAuto(true)
  }, [chosen.id])

  const product = shelf?.products.find((p) => p.id === chosen.paint.product) ?? null
  const price = product && !product.priceHidden && product.points ? `From ${fmtCents(priceCents(product))}` : null
  const shots = product ? galleryOf(product) : []
  const photo = shot !== null ? (shots[shot] ?? null) : null
  const covered = !!photo && !(stage.moving && stage.from === null)
  const nextAuto = shot === null ? (shots.length ? 0 : null) : shot + 1 < shots.length ? shot + 1 : null
  const pushes = auto && live && shots.length > 0 && !QUIET && !prefersReducedMotion()
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!pushes || stage.moving) return
    const timer = setTimeout(
      () => {
        if (document.hidden) return setTick((n) => n + 1)
        setStage((now) => (now.shot === nextAuto ? now : { shot: nextAuto, from: now.shot, dir: nextAuto === null ? -1 : 1, moving: true }))
      },
      shot === null ? HOLD_CHAIR : HOLD_PHOTO,
    )
    return () => clearTimeout(timer)
  }, [pushes, stage.moving, shot, nextAuto, tick])
  const layers = [...new Set([stage.moving ? stage.from : null, shot].filter((n): n is number => n !== null && !!shots[n]))]
  const before = (n: number) => shots.slice(0, n).reduce((sum, slide) => sum + slide.shots.length, 0)
  const photographs = before(shots.length)

  // A photograph on the stage is swiped along: on to the next, back to the last, and from the first back to the chair
  const swipe = useRef<{ x: number; y: number } | null>(null)
  const onDown = (e: ReactPointerEvent) => {
    swipe.current = { x: e.clientX, y: e.clientY }
  }
  const onUp = (e: ReactPointerEvent) => {
    const from = swipe.current
    swipe.current = null
    if (!from || shot === null) return
    const dx = e.clientX - from.x
    if (Math.abs(dx) < 36 || Math.abs(dx) < Math.abs(e.clientY - from.y)) return
    setAuto(false)
    if (dx < 0) setShot(shot + 1 < shots.length ? shot + 1 : shot)
    else setShot(shot > 0 ? shot - 1 : null)
  }

  // The tray: the eight, then whichever of the sixteen have been picked, and the dot that lets the rest up
  const tray = [...PAINTS, ...added.map((id) => MORE.find((p) => p.id === id)).filter((p): p is (typeof MORE)[number] => !!p)].map(chosenOf)
  useEffect(() => {
    if (chosen.paint.more) addToBar(chosen.id)
  }, [chosen.id, chosen.paint.more])
  // (the dot that is picked is brought into sight in the row)
  const dots = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const row = dots.current
    const on = row?.querySelector<HTMLElement>('.on')
    if (!row || !on) return
    const want = on.offsetLeft - (row.clientWidth - on.offsetWidth) / 2
    row.scrollTo({ left: Math.max(0, want), behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
  }, [chosen.id, tray.length])

  // (the foot is in the color whatever is on the stage: its words are the color's own ink)
  const ink = inkOn(chosen.color)
  const dark = ink === '#fff'
  const owners = [...OWNERS_SHOWN.filter((o) => o.paint === chosen.id), ...OWNERS_SHOWN.filter((o) => o.paint !== chosen.id)]
  const member = who === 'member'
  // Buy brings checkout up over the studio (Buying.tsx): the chair stays where it is behind it
  const buy = () => product && checkOut(product)

  return (
    <Screen title={chosen.name} center={<></>} leading={<BackButton label="Colors" />} trailing={<Wallet />} tone={dark ? 'dark' : 'plain'} ground={chosen.shift ? { top: chosen.shift[0]!, foot: chosen.shift[chosen.shift.length - 1]! } : chosen.color} fixed className="wsp wsp-studio">
      <div className="wsp-st" data-dark={dark || undefined} data-photo={covered || undefined} style={{ background: ground(chosen), color: ink }}>
        <div className="wsp-stage" data-shot={covered || undefined} onPointerDownCapture={() => setAuto(false)}>
          <span className="wsp-light" aria-hidden />
          <Word name={chosen.name} />
          <Turntable cls="wsp" id={chosen.id} color={chosen.color} shift={chosen.shift} finish={chosen.paint.finish} name={chosen.name} live={live && !covered} />
          {layers.map((n) => {
            const slide: Slide = shots[n]!
            const on = n === shot
            const going = stage.moving && n === stage.from && !on
            return (
              <div key={slide.shots[0]!.full} className="wsp-photo" data-fit={slide.kind === 'pair' ? 'pair' : 'whole'} data-enter={on && stage.moving ? stage.dir : undefined} data-leave={going ? stage.dir : undefined} aria-hidden={on ? undefined : true} onPointerDown={onDown} onPointerUp={onUp} onPointerCancel={() => (swipe.current = null)}>
                {slide.kind !== 'pair' && <img className="wsp-photo__back" src={slide.shots[0]!.small} alt="" aria-hidden draggable={false} />}
                {slide.shots.map((one, i) => (
                  <img key={one.full} className="wsp-photo__pic" src={one.full} srcSet={one.set} sizes={slide.kind === 'pair' ? '50vw' : '100vw'} alt={on ? (one.alt ?? `${chosen.name}: photograph ${before(n) + i + 1} of ${photographs}`) : ''} draggable={false} />
                ))}
                <span className="wsp-photo__shade" aria-hidden />
              </div>
            )
          })}
          {shots.length > 0 && (
            <div className="wsp-shots" role="group" aria-label={`Pictures of the chair in ${chosen.name}`}>
              <button type="button" className="wsp-shot" aria-pressed={shot === null} aria-label="The chair in 3D" onClick={() => (setAuto(false), setShot(null))}>
                <Rotate3d size={17} strokeWidth={1.9} aria-hidden />
                <span>3D</span>
              </button>
              {shots.map((slide, n) => {
                const from = before(n) + 1
                return (
                  <button key={slide.shots[0]!.full} type="button" className="wsp-shot" data-pair={slide.shots.length > 1 || undefined} aria-pressed={shot === n} aria-label={slide.shots.length > 1 ? `Photographs ${from} and ${from + 1} of ${photographs}` : `Photograph ${from} of ${photographs}`} data-next={pushes && !stage.moving && n === nextAuto ? '' : undefined} style={pushes && n === nextAuto ? ({ '--hold': `${shot === null ? HOLD_CHAIR : HOLD_PHOTO}ms` } as CSSProperties) : undefined} onClick={() => (setAuto(false), setShot(n))}>
                    {slide.shots.map((one) => (
                      <img key={one.full} src={one.small} alt="" loading="lazy" draggable={false} />
                    ))}
                  </button>
                )
              })}
            </div>
          )}
        </div>
        <div className="wsp-foot">
          <div className="wsp-info">
            <h3>{chosen.name}</h3>
            <div className="wsp-tags">
              <span className="wsp-tag">{FINISH_WORDS[chosen.paint.finish]}</span>
              <span className="wsp-tag">{leadOf(chosen.paint)}</span>
            </div>
            {(chosen.paint.line || chosen.shift) && (
              <p>
                {chosen.paint.line}
                {chosen.shift ? `${chosen.paint.line ? ' ' : ''}Turn it to see it shift.` : ''}
              </p>
            )}
          </div>
          <div className="wsp-dots" ref={dots} role="group" aria-label="Colors">
            {tray.map((c) => (
              <button key={c.id} type="button" className={`wsp-dot${chosen.id === c.id ? ' on' : ''}`} style={{ background: ground(c) }} aria-label={c.name} aria-pressed={chosen.id === c.id} onClick={() => choose(c)} />
            ))}
            <button type="button" className="wsp-dot wsp-dot--more" aria-label="More colors" aria-haspopup="dialog" onClick={() => openSheet(MORE_SHEET)} />
          </div>
          {owners.length > 0 && !chosen.paint.more && (
            <button type="button" className="wsp-owners" onClick={() => push(OWNERS)}>
              <span>
                Owned by <b>{owners.slice(0, 2).map((owner) => owner.name).join(', ')}</b>
                {owners.length > 2 ? ` and ${owners.length - 2} more` : ''}
              </span>
            </button>
          )}
          <div className="wsp-buy">
            {!shelf ? (
              <button type="button" className="wsp-btn" aria-disabled="true">
                One moment…
              </button>
            ) : price ? (
              <>
                <b className="wsp-price">{price}</b>
                <button type="button" className="wsp-btn" onClick={buy}>
                  {chosen.paint.stock === 'now' ? 'Buy' : 'Order'}
                </button>
              </>
            ) : member && shelf.down ? (
              <button type="button" className="wsp-btn" onClick={() => void loadShop()}>
                Try again
              </button>
            ) : member ? (
              <button type="button" className="wsp-btn" onClick={() => (product ? buy() : launchApp('messages'))}>
                {product ? 'See this chair' : 'Ask us about this one'}
              </button>
            ) : (
              <button type="button" className="wsp-btn" onClick={() => askLogIn('price', `${chosen.name} is kept while you log in.`)}>
                Log in to enquire
              </button>
            )}
          </div>
        </div>
      </div>
    </Screen>
  )
}

// ---- Notable Owners, and BTS

function Owners() {
  return (
    <Screen title="Notable Owners" large readable ground={PAPER} className="wsp wsp-owners-page">
      <div className="wsp-cards">
        {OWNERS_SHOWN.map((owner, i) => {
          const paint = ALL_PAINTS.find((p) => p.id === owner.paint) ?? PAINTS[0]!
          return (
            <article key={i} className="wsp-card" style={{ background: ground(paint), color: inkOn(paint.color) }}>
              <q>“{owner.words}”</q>
              <footer>
                <b>{owner.name}</b>
                {owner.of} · {paint.name}
              </footer>
            </article>
          )
        })}
      </div>
    </Screen>
  )
}

function Bts() {
  const [look, setLook] = useState<Making | null>(null)
  const x = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (look) x.current?.focus()
  }, [look])
  return (
    <Screen title="BTS" subtitle="How a chair is made" large tone="dark" className="wsp wsp-bts">
      <ol className="wsp-wall">
        {MAKING_SHOWN.map((piece) => (
          <li key={piece.id} className={`wsp-tile ${piece.shape}`}>
            <button type="button" aria-label={`${piece.kind === 'video' ? 'Play' : 'Open'}: ${piece.says}`} onClick={() => setLook(piece)}>
              <span className="wsp-tile__pic" style={piece.src && piece.kind === 'photo' ? undefined : { background: `linear-gradient(150deg, ${piece.tone ?? '#26272b'}, #0f1012)` }}>
                {piece.kind === 'photo' && piece.src ? <img src={piece.src} alt="" loading="lazy" draggable={false} /> : piece.poster ? <img src={piece.poster} alt="" loading="lazy" draggable={false} /> : null}
                {piece.kind === 'video' && (
                  <span className="wsp-tile__play" aria-hidden>
                    <Play size={18} strokeWidth={0} fill="currentColor" />
                  </span>
                )}
              </span>
              <span className="wsp-tile__says">{piece.says}</span>
            </button>
          </li>
        ))}
      </ol>
      {look && (
        <div
          className="wsp-look"
          role="dialog"
          aria-modal="true"
          aria-label={look.says}
          onClick={(e) => e.target === e.currentTarget && setLook(null)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') e.stopPropagation(), setLook(null)
          }}
        >
          <figure onClick={(e) => e.target === e.currentTarget && setLook(null)}>
            {look.kind === 'video' && look.src ? (
              <video src={look.src} poster={look.poster ?? undefined} controls autoPlay playsInline />
            ) : look.src ? (
              <img src={look.src} alt={look.says} draggable={false} />
            ) : (
              <span className="wsp-look__none" style={{ background: `linear-gradient(150deg, ${look.tone ?? '#26272b'}, #0f1012)` }}>
                This film has not been supplied yet.
              </span>
            )}
            <figcaption>{look.says}</figcaption>
          </figure>
          <button ref={x} type="button" className="wsp-look__x" aria-label="Close" onClick={() => setLook(null)}>
            <X size={18} strokeWidth={2.4} aria-hidden />
          </button>
        </div>
      )}
    </Screen>
  )
}

/** What the app is drawn on at the screen it opens at: paper for the colors and the owners, the color picked
 * for its studio, and black for the wall and for the store's page. */
export function workspaceFirst(top: string | null): { tone: 'plain' | 'dark'; ground?: string } {
  if (top === BTS) return { tone: 'dark' }
  const chosen = top === STUDIO ? chosenNow(picked.get()) : null
  return chosen ? { tone: inkOn(chosen.color) === '#fff' ? 'dark' : 'plain', ground: chosen.color } : { tone: 'plain', ground: PAPER }
}

export function WorkspaceApp() {
  const { app, active } = useApp()
  useEffect(() => {
    if (active) wantShop()
  }, [active])
  const top = useStore(sys, (s) => s.stacks[app][s.stacks[app].length - 1] ?? null)
  return (
    <>
      <NavStack>{(view) => (view === STUDIO ? <Studio top={top === STUDIO} /> : view === OWNERS ? <Owners /> : view === BTS ? <Bts /> : <Colors />)}</NavStack>
      <SheetHost>{(name) => (name === LOGIN ? <LogInSheet /> : name === CHECKOUT ? <CheckoutTray /> : name === VIP ? <MyVipSheet /> : name === MORE_SHEET ? <MoreSheet /> : null)}</SheetHost>
    </>
  )
}
