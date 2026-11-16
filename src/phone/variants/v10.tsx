import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { ArrowUpRight, Camera, Compass, Lock } from 'lucide-react'
import { QUESTION, TOTAL } from '../../apps/chat'
import { GROUP_NAME, PersonAvatar } from '../../apps/chat-ui'
import { ALL, CompanyLogo } from '../../apps/portfolio-ui'
import { ShrugAvatar } from '../../apps/ui'
import { CASE_STUDIES } from '../../data/caseStudies'
import { DROPS } from '../../data/drops'
import { FAQS } from '../../data/faqs'
import { PEOPLE } from '../../data/people'
import { COMPANY_COUNT } from '../../data/portfolio'
import { SITE } from '../../data/site'
import { prefersReducedMotion } from '../../os/dom'
import { AppIcon, DocumentIcon } from '../../os/icons'
import { askMotion, hasMotion, motionNeedsAsking, watchFacing } from '../native'
import { openApp, openSheet } from '../nav'
import '../../styles/variants/v10.css'

// Version 10: the room. You stand in the middle and the family is all round
// you: Niv's question straight ahead, the ninety replies as cards on the wall
// of a cylinder about you, three rows of thirty, and lower down the things the
// site keeps (the portfolio, the FAQs, the case studies, VIP, the one-pager).
// Turning where you stand turns the room, if the phone is allowed to say which
// way it faces; a drag turns it otherwise. The card in the middle of the view
// comes forward, full size; a tap on any card brings that person up.

// ---- Where everything is, in degrees round you (clockwise from straight ahead) and up ----

/** The rows of replies: how far above the level of the eye each is. */
const ROWS = [13.5, 0, -13.5]
const PER_ROW = Math.ceil(PEOPLE.length / ROWS.length)
/** The part of the wall straight ahead kept clear for the question: this far each side. */
const FRONT = 15.5
/** From one card to the next along a row. */
const STEP = (360 - FRONT * 2) / PER_ROW
/** A card, at the size it is read at. */
const CARD = { w: 232, h: 252 }
/** How far away the wall of cards is: at this distance one card takes most of a step. */
const FAR = 1364
/** How far down, and up, the view can be turned. */
const LOW = -38
const HIGH = 24
/** The landmarks stand lower down, tipped back to face you. */
const MARK_AT = -30
/** A card this close to the middle of the view starts to come forward. */
const REACH = 9.5
/** The room's wall: eight flat pieces of wallpaper, further out than everything else, each going into the dark at its edges. */
const WALLS = [0, 45, 90, 135, 180, 225, 270, 315]
const WALL_FAR = 2400

const RAD = Math.PI / 180
const MARK_Y = Math.round(FAR * Math.tan(-MARK_AT * RAD))
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const wrap = (deg: number) => ((deg % 360) + 360) % 360
/** The short way round from straight ahead to a bearing: -180 to 180. */
const turn = (deg: number) => {
  const w = wrap(deg)
  return w > 180 ? w - 360 : w
}

/** Where each reply hangs. People who follow one another in the conversation are
 * neighbours in the room: three to a column, one in each row, each row a third of a step on from the last. */
const SPOTS = PEOPLE.map((_, i) => {
  const row = i % ROWS.length
  const column = Math.floor(i / ROWS.length)
  return { b: FRONT + STEP * (column + 0.5) + (row - 1) * (STEP / 3), e: ROWS[row]! }
})

/** Puts something on the wall of the room: round to its bearing, up or down, out to its distance, and its own middle on that spot. */
const place = (b: number, y: number, far: number, also = '') => `rotateY(${(-b).toFixed(2)}deg) translate3d(0, ${y.toFixed(1)}px, ${(-far).toFixed(1)}px) ${also} translate(-50%, -50%)`
/** A landmark: on its spot lower down, tipped back to face whoever looks down at it. */
const mark = (b: number) => place(b, MARK_Y, FAR, `rotateX(${-MARK_AT}deg)`)

/** Where the view is turned to for a landmark: a little above it, so it sits in the room left between the compass and the foot. */
const MARK_VIEW = MARK_AT + 3

/** What the compass names, and where it is. */
const NAMES = [
  { id: 'niv', label: 'Niv', b: 0, e: 0 },
  { id: 'finder', label: 'Portfolio', b: 36, e: MARK_VIEW },
  { id: 'notes', label: 'FAQs', b: 108, e: MARK_VIEW },
  { id: 'terminal', label: 'Case studies', b: 180, e: MARK_VIEW },
  { id: 'photos', label: 'VIP', b: 252, e: MARK_VIEW },
  { id: 'one-pager', label: 'One-pager', b: 324, e: MARK_VIEW },
] as const

const LOGOS = ALL.filter((c) => c.logo).slice(0, 8)

// ---- The room: which way it is turned, the finger that turns it, and the frames that carry it on ----

function makeRoom(root: HTMLElement, scene: HTMLElement, world: HTMLElement, moved: () => void) {
  const still = prefersReducedMotion()
  const cards = Array.from(world.querySelectorAll<HTMLElement>('.v10__card')).map((el, i) => {
    const spot = SPOTS[i]!
    return { el, b: spot.b, e: spot.e, y: FAR * Math.tan(spot.e * RAD), on: false, f: -1 }
  })
  /** The things that stay where they are put: the walls, the question, the landmarks. */
  const fixed = Array.from(world.querySelectorAll<HTMLElement>('[data-b]')).map((el) => ({ el, b: Number(el.dataset.b), half: Number(el.dataset.half), on: true }))
  const names = Array.from(root.querySelectorAll<HTMLElement>('.v10__name')).map((el) => ({ el, b: Number(el.dataset.at), here: false }))
  const ticks = root.querySelector<HTMLElement>('.v10__ticks')

  let W = 0
  let H = 0
  /** How far the eye is from the screen, in points: what sets how wide the view is. */
  let P = 760
  /** How far away a card is when it has come all the way forward. */
  let near = 760
  /** Half of what the view takes in, across and up, in degrees. */
  let across = 15
  let up = 25
  /** Points of compass strip to a degree. */
  let strip = 3.7

  /** Where a finger (or a tap on the compass) has turned the view. */
  let user = { yaw: 0, pitch: 0 }
  /** Where the phone's own turning has turned it since it was last asked: now, and what it is easing to. */
  const sense = { yaw: 0, pitch: 0, tyaw: 0, tpitch: 0, last: null as number | null, level: null as number | null }
  /** What a flick leaves it with, in degrees a second. */
  let vel = { yaw: 0, pitch: 0 }
  let glide: { from: { yaw: number; pitch: number }; to: { yaw: number; pitch: number }; t0: number; ms: number } | null = null
  let frame = 0
  let last = 0
  let on = true
  let dragging = false
  let told = false

  const facing = () => ({ yaw: wrap(user.yaw + sense.yaw), pitch: clamp(user.pitch + sense.pitch, LOW, HIGH) })

  const paint = () => {
    const { yaw, pitch } = facing()
    world.style.transform = `translateZ(${P}px) rotateX(${pitch.toFixed(2)}deg) rotateY(${yaw.toFixed(2)}deg)`

    // Only what is near the view is painted at all
    const reachAcross = across + 8
    const reachUp = up + 13
    for (const c of cards) {
      const dy = turn(c.b - yaw)
      const dp = c.e - pitch
      const shown = Math.abs(dy) < reachAcross && Math.abs(dp) < reachUp
      if (shown !== c.on) {
        c.on = shown
        c.el.style.display = shown ? 'flex' : 'none'
        c.f = -1
      }
      if (!shown) continue
      // The nearer the middle of the view, the further forward: full size and bright in the middle, small and dim away from it
      const t = clamp(1 - Math.hypot(dy, dp) / REACH, 0, 1)
      const f = t * t * (3 - 2 * t)
      if (Math.abs(f - c.f) < 0.003) continue
      c.f = f
      const far = FAR - (FAR - near) * f
      c.el.style.transform = place(c.b, (-c.y * far) / FAR, far)
      c.el.style.setProperty('--dim', (0.56 * (1 - f)).toFixed(3))
      c.el.toggleAttribute('data-near', f > 0.6)
    }
    for (const thing of fixed) {
      const shown = Math.abs(turn(thing.b - yaw)) < across + thing.half
      if (shown === thing.on) continue
      thing.on = shown
      thing.el.style.display = shown ? '' : 'none'
    }

    // The compass: each name where it is, and the ticks under them
    for (const name of names) {
      const d = turn(name.b - yaw)
      name.el.style.transform = `translate3d(${(W / 2 + d * strip).toFixed(1)}px, 0, 0) translateX(-50%)`
      const here = Math.abs(d) < 10
      if (here !== name.here) {
        name.here = here
        name.el.toggleAttribute('data-here', here)
      }
    }
    if (ticks) ticks.style.backgroundPositionX = `${(W / 2 - yaw * strip).toFixed(1)}px`

    if (!told && (Math.abs(turn(yaw)) > 14 || Math.abs(pitch) > 9) && !glide) {
      told = true
      moved()
    }
  }

  const step = (t: number) => {
    frame = 0
    const dt = last ? Math.min(0.05, Math.max(0.001, (t - last) / 1000)) : 1 / 60
    last = t
    let busy = false

    if (glide) {
      const p = glide.ms ? clamp((t - glide.t0) / glide.ms, 0, 1) : 1
      const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2
      user = { yaw: glide.from.yaw + (glide.to.yaw - glide.from.yaw) * e, pitch: glide.from.pitch + (glide.to.pitch - glide.from.pitch) * e }
      if (p >= 1) glide = null
      else busy = true
    } else if (!dragging && (vel.yaw || vel.pitch)) {
      // A flick runs down
      user.yaw += vel.yaw * dt
      user.pitch = clamp(user.pitch + vel.pitch * dt, LOW - sense.pitch, HIGH - sense.pitch)
      const drag = Math.exp(-dt * 3.2)
      vel = { yaw: vel.yaw * drag, pitch: vel.pitch * drag }
      if (Math.hypot(vel.yaw, vel.pitch) < 3) {
        vel = { yaw: 0, pitch: 0 }
        rest()
        busy = !!glide
      } else busy = true
    }

    // The phone's turning is followed a little behind, so its trembling isn't
    if (sense.yaw !== sense.tyaw || sense.pitch !== sense.tpitch) {
      const pull = 1 - Math.exp(-dt * 9)
      sense.yaw += (sense.tyaw - sense.yaw) * pull
      sense.pitch += (sense.tpitch - sense.pitch) * pull
      if (Math.abs(sense.tyaw - sense.yaw) < 0.02 && Math.abs(sense.tpitch - sense.pitch) < 0.02) {
        sense.yaw = sense.tyaw
        sense.pitch = sense.tpitch
      } else busy = true
    }

    paint()
    if (busy && on) frame = requestAnimationFrame(step)
    else last = 0
  }

  const wake = () => {
    if (on && !frame) frame = requestAnimationFrame(step)
  }

  /** Once a finger has let go and the room has stopped, it comes to rest on the card nearest the middle of the view, if one is near. */
  const rest = () => {
    if (still || !on || dragging || glide) return
    const { yaw, pitch } = facing()
    let best: (typeof cards)[number] | null = null
    let least = REACH * 0.62
    for (const c of cards) {
      if (!c.on) continue
      const d = Math.hypot(turn(c.b - yaw), c.e - pitch)
      if (d < least) {
        least = d
        best = c
      }
    }
    if (best && least > 0.15) turnTo(best.b, best.e, 240 + least * 30)
  }

  /** Turns to face a bearing, the short way round. */
  const turnTo = (b: number, e: number, ms?: number) => {
    const now = facing()
    const by = turn(b - now.yaw)
    const to = { yaw: user.yaw + by, pitch: clamp(e, LOW, HIGH) - sense.pitch }
    vel = { yaw: 0, pitch: 0 }
    if (still || !on) {
      glide = null
      user = to
      paint()
      return
    }
    glide = { from: { ...user }, to, t0: performance.now(), ms: ms ?? 520 + Math.abs(by) * 3.4 }
    wake()
  }

  // ---- A finger turns the room; a press that doesn't move is a tap on what is under it ----

  let finger: number | null = null
  let at = { x: 0, y: 0 }
  let start = { x: 0, y: 0 }
  let trail: { x: number; y: number; t: number }[] = []
  /** A click before this moment is the end of a drag, not a press. */
  let swallow = 0

  const down = (e: PointerEvent) => {
    if (finger !== null || (e.pointerType === 'mouse' && e.button !== 0)) return
    finger = e.pointerId
    at = start = { x: e.clientX, y: e.clientY }
    trail = [{ ...at, t: performance.now() }]
    dragging = false
    swallow = 0
    glide = null
    vel = { yaw: 0, pitch: 0 }
  }

  const move = (e: PointerEvent) => {
    if (e.pointerId !== finger) return
    const p = { x: e.clientX, y: e.clientY }
    if (!dragging) {
      const slop = e.pointerType === 'mouse' ? 4 : 8
      const d = Math.hypot(p.x - start.x, p.y - start.y)
      if (d < slop) return
      dragging = true
      swallow = Infinity
      // The drag begins where the finger left its slop: nothing of the move is lost, and nothing jumps
      at = { x: start.x + ((p.x - start.x) * slop) / d, y: start.y + ((p.y - start.y) * slop) / d }
      scene.setAttribute('data-dragging', '')
      try {
        scene.setPointerCapture(e.pointerId)
      } catch {
        // Not a finger that can be held on to
      }
    }
    // What is under the finger stays under it: the room turns by the angle the finger has moved through
    user.yaw -= (p.x - at.x) / P / RAD
    user.pitch = clamp(user.pitch + (p.y - at.y) / P / RAD, LOW - sense.pitch, HIGH - sense.pitch)
    at = p
    const now = performance.now()
    trail.push({ ...p, t: now })
    while (trail.length > 2 && now - trail[0]!.t > 110) trail.shift()
    wake()
  }

  const lift = (e: PointerEvent) => {
    if (e.pointerId !== finger) return
    finger = null
    scene.removeAttribute('data-dragging')
    if (!dragging) return
    dragging = false
    swallow = performance.now() + 380
    const a = trail[0]
    const b = trail[trail.length - 1]
    if (!still && e.type !== 'pointercancel' && a && b && a !== b && performance.now() - b.t < 70 && b.t - a.t > 12) {
      const s = 1000 / (b.t - a.t) / P / RAD
      vel = { yaw: clamp(-(b.x - a.x) * s, -420, 420), pitch: clamp((b.y - a.y) * s, -160, 160) }
    }
    // Let go of without a flick, it settles from where it is
    if (Math.hypot(vel.yaw, vel.pitch) < 3) {
      vel = { yaw: 0, pitch: 0 }
      rest()
    }
    wake()
  }

  const click = (e: MouseEvent) => {
    if (performance.now() < swallow) {
      e.preventDefault()
      e.stopPropagation()
    }
  }

  const quiet = (e: Event) => e.preventDefault()

  scene.addEventListener('pointerdown', down)
  scene.addEventListener('pointermove', move)
  scene.addEventListener('pointerup', lift)
  scene.addEventListener('pointercancel', lift)
  scene.addEventListener('click', click, true)
  scene.addEventListener('gesturestart', quiet)
  scene.addEventListener('contextmenu', quiet)
  scene.addEventListener('dragstart', quiet)

  return {
    /** The room has a size, or a new one. */
    fit() {
      const w = root.clientWidth
      const h = root.clientHeight
      if (!w || !h || (w === W && h === H)) return
      W = w
      H = h
      P = clamp(Math.min(W, H) * 1.95, 600, 860)
      // Forward, a card is as large as the screen has room for, and no larger than it is drawn
      near = P / Math.min(1, (W * 0.64) / CARD.w, (H - 150) / CARD.h)
      across = Math.atan(W / 2 / P) / RAD
      up = Math.atan(H / 2 / P) / RAD
      strip = clamp(W / 104, 3, 5.2)
      scene.style.perspective = `${P}px`
      if (ticks) ticks.style.backgroundSize = `${(12 * strip).toFixed(2)}px 100%`
      for (const c of cards) c.f = -1
      paint()
    },
    turnTo,
    /** A step to one side, or up or down a row. */
    nudge(dyaw: number, dpitch: number) {
      const now = glide ? { yaw: wrap(glide.to.yaw + sense.yaw), pitch: glide.to.pitch + sense.pitch } : facing()
      turnTo(now.yaw + dyaw, now.pitch + dpitch, 260)
    },
    /** Arriving: the room swings round to the question. */
    arrive() {
      if (still) return
      user = { yaw: -32, pitch: 3 }
      glide = { from: { ...user }, to: { yaw: 0, pitch: 0 }, t0: performance.now() + 250, ms: 1500 }
      paint()
      wake()
    },
    /** Which way the phone is facing, as it reports it. Only how far it has turned since it was first read counts. */
    face(yaw: number, pitch: number) {
      if (sense.last === null || sense.level === null) {
        sense.last = yaw
        sense.level = pitch
        return
      }
      sense.tyaw += turn(yaw - sense.last)
      sense.last = yaw
      sense.tpitch = pitch - sense.level
      wake()
    },
    /** The phone is no longer being listened to: the view stays where its turning left it. */
    settle() {
      const now = facing()
      user = { yaw: user.yaw + sense.yaw, pitch: now.pitch }
      sense.yaw = sense.tyaw = sense.pitch = sense.tpitch = 0
      sense.last = sense.level = null
      paint()
    },
    run(yes: boolean) {
      if (on === yes) return
      on = yes
      if (yes) return wake()
      cancelAnimationFrame(frame)
      frame = 0
      last = 0
      if (glide) user = glide.to
      glide = null
      vel = { yaw: 0, pitch: 0 }
      finger = null
      dragging = false
      scene.removeAttribute('data-dragging')
      paint()
    },
    destroy() {
      on = false
      cancelAnimationFrame(frame)
      scene.removeEventListener('pointerdown', down)
      scene.removeEventListener('pointermove', move)
      scene.removeEventListener('pointerup', lift)
      scene.removeEventListener('pointercancel', lift)
      scene.removeEventListener('click', click, true)
      scene.removeEventListener('gesturestart', quiet)
      scene.removeEventListener('contextmenu', quiet)
      scene.removeEventListener('dragstart', quiet)
    },
  }
}

type Room = ReturnType<typeof makeRoom>

export default function V10({ active }: { active: boolean }) {
  const root = useRef<HTMLDivElement>(null)
  const scene = useRef<HTMLDivElement>(null)
  const world = useRef<HTMLDivElement>(null)
  const video = useRef<HTMLVideoElement>(null)
  const room = useRef<Room | null>(null)
  const stream = useRef<MediaStream | null>(null)
  /** The visitor has looked away from where they started: the hint has done its work. */
  const [looked, setLooked] = useState(false)
  const [canTurn] = useState(hasMotion)
  /** Where the phone needn't be asked, turning it turns the room from the start. */
  const [turning, setTurning] = useState<'off' | 'on' | 'refused'>(() => (hasMotion() && !motionNeedsAsking() ? 'on' : 'off'))
  const [canCamera] = useState(() => typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia)
  const [camera, setCamera] = useState<'off' | 'asking' | 'on' | 'failed'>('off')

  useLayoutEffect(() => {
    const rootEl = root.current
    const sceneEl = scene.current
    const worldEl = world.current
    if (!rootEl || !sceneEl || !worldEl) return
    const made = makeRoom(rootEl, sceneEl, worldEl, () => setLooked(true))
    room.current = made
    made.fit()
    made.arrive()
    const watch = new ResizeObserver(() => made.fit())
    watch.observe(rootEl)
    return () => {
      watch.disconnect()
      made.destroy()
      room.current = null
    }
  }, [])

  useEffect(() => {
    room.current?.run(active)
  }, [active])

  // The way the phone faces turns the room, for as long as it is asked to and nothing is over the room
  useEffect(() => {
    if (turning !== 'on' || !active) return
    const stop = watchFacing((facing) => room.current?.face(facing.yaw, facing.pitch))
    return () => {
      stop()
      room.current?.settle()
    }
  }, [turning, active])

  const toggleTurning = async () => {
    if (turning === 'on') return setTurning('off')
    setTurning((await askMotion()) ? 'on' : 'refused')
  }

  // The camera, behind the cards: off until asked for, and nothing said if it can't be had
  const toggleCamera = async () => {
    if (camera === 'asking') return
    if (camera === 'on') {
      stream.current?.getTracks().forEach((track) => track.stop())
      stream.current = null
      return setCamera('off')
    }
    setCamera('asking')
    try {
      const got = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      stream.current = got
      setCamera('on')
    } catch {
      setCamera('failed')
      setTimeout(() => setCamera((now) => (now === 'failed' ? 'off' : now)), 2600)
    }
  }

  useEffect(() => {
    const el = video.current
    if (!el) return
    if (camera !== 'on' || !stream.current) {
      el.srcObject = null
      return
    }
    if (el.srcObject !== stream.current) el.srcObject = stream.current
    // With something over the room the camera rests too
    stream.current.getVideoTracks().forEach((track) => (track.enabled = active))
    if (active) el.play().catch(() => {})
    else el.pause()
  }, [camera, active])

  useEffect(
    () => () => {
      stream.current?.getTracks().forEach((track) => track.stop())
      stream.current = null
    },
    [],
  )

  const onKey = (e: ReactKeyboardEvent) => {
    const by: Record<string, [number, number] | undefined> = { ArrowLeft: [-STEP, 0], ArrowRight: [STEP, 0], ArrowUp: [0, 13.5], ArrowDown: [0, -13.5] }
    const d = by[e.key]
    if (!d) return
    e.preventDefault()
    room.current?.nudge(d[0], d[1])
  }

  return (
    <div ref={root} className="v10" data-camera={camera === 'on' || undefined}>
      <video ref={video} className="v10__camera" muted playsInline aria-hidden />
      <div ref={scene} className="v10__scene" tabIndex={0} role="group" aria-label={`The room: Niv’s question ahead of you and ${TOTAL} replies all round. Drag to look around, or use the arrow keys.`} onKeyDown={onKey}>
        <div ref={world} className="v10__world">
          {WALLS.map((b) => (
            <div key={b} className="v10__wall" data-b={b} data-half="26" style={{ transform: place(b, 0, WALL_FAR, 'scale(5)') }} aria-hidden />
          ))}

          <div className="v10__ask" data-b="0" data-half="17" style={{ transform: place(0, 0, FAR) }}>
            <p className="v10__ask-who">
              <ShrugAvatar size={54} />
              <span>
                <b>Niv</b>
                {GROUP_NAME}
              </span>
            </p>
            {QUESTION.map((line) => (
              <p key={line} className="v10__bubble">
                {line}
              </p>
            ))}
            <p className="v10__ask-note">
              {TOTAL} replies. They’re all round you.
            </p>
          </div>

          {PEOPLE.map((person, i) => (
            <button key={i} type="button" className="v10__card" aria-label={`${person.name}, ${person.role}. Read what they said.`} onClick={() => openSheet(`person:${i}`)}>
              <span className="v10__who">
                <PersonAvatar index={i} size={44} />
                <span className="v10__id">
                  <b>{person.name}</b>
                  <span>{person.role}</span>
                </span>
              </span>
              <span className="v10__quote">{person.quote}</span>
            </button>
          ))}

          <button type="button" className="v10__mark" data-b="36" data-half="13" data-shot="finder" style={{ transform: mark(36) }} onClick={() => openApp('finder')}>
            <span className="v10__mark-head">
              <span className="v10__mark-icon">
                <AppIcon id="finder" />
              </span>
              <span className="v10__mark-name">
                <b>Portfolio</b>
                {COMPANY_COUNT} companies
              </span>
            </span>
            <span className="v10__logos" aria-hidden>
              {LOGOS.map((company) => (
                <CompanyLogo key={company.name} company={company} size={92} />
              ))}
            </span>
          </button>

          <button type="button" className="v10__mark" data-b="108" data-half="13" data-shot="notes" style={{ transform: mark(108) }} onClick={() => openApp('notes')}>
            <span className="v10__mark-head">
              <span className="v10__mark-icon">
                <AppIcon id="notes" />
              </span>
              <span className="v10__mark-name">
                <b>FAQs</b>
                {FAQS.length} questions
              </span>
            </span>
            <span className="v10__lines" aria-hidden>
              {FAQS.slice(0, 4).map((faq) => (
                <span key={faq.question}>{faq.question}</span>
              ))}
            </span>
          </button>

          <button type="button" className="v10__mark" data-kind="dark" data-b="180" data-half="13" style={{ transform: mark(180) }} onClick={() => openSheet('request')}>
            <span className="v10__mark-head">
              <span className="v10__mark-icon">
                <AppIcon id="terminal" />
              </span>
              <span className="v10__mark-name">
                <b>Case studies</b>
                Private. Ask nicely.
              </span>
            </span>
            <span className="v10__lines" aria-hidden>
              {CASE_STUDIES.slice(0, 4).map((name) => (
                <span key={name}>
                  <Lock size={24} strokeWidth={2.4} />
                  {name}
                </span>
              ))}
            </span>
          </button>

          <button type="button" className="v10__mark" data-b="252" data-half="13" data-shot="photos" style={{ transform: mark(252) }} onClick={() => openApp('photos')}>
            <span className="v10__mark-head">
              <span className="v10__mark-icon">
                <AppIcon id="photos" />
              </span>
              <span className="v10__mark-name">
                <b>VIP</b>
                {DROPS.length} drops
              </span>
            </span>
            <span className="v10__drops" aria-hidden>
              {DROPS.slice(0, 5).map((drop) => (
                <span key={drop}>{drop}</span>
              ))}
            </span>
          </button>

          <a className="v10__mark" data-kind="page" data-b="324" data-half="13" style={{ transform: mark(324) }} href={SITE.onePager} target="_blank" rel="noreferrer">
            <span className="v10__mark-head">
              <span className="v10__mark-icon">
                <DocumentIcon />
              </span>
              <span className="v10__mark-name">
                <b>One-pager</b>
                Shrug, on a page
              </span>
            </span>
            <span className="v10__go">
              Opens in a new tab
              <ArrowUpRight size={30} strokeWidth={2.4} aria-hidden />
            </span>
          </a>
        </div>
      </div>

      <nav className="v10__compass" aria-label="Where things are">
        <span className="v10__ticks" aria-hidden />
        {NAMES.map((name) => (
          <button key={name.id} type="button" className="v10__name" data-at={name.b} aria-label={`Turn to ${name.label}`} onClick={() => room.current?.turnTo(name.b, name.e)}>
            {name.label}
          </button>
        ))}
        <span className="v10__needle" aria-hidden />
      </nav>

      <div className="v10__foot">
        <p className="v10__hint" data-gone={looked || undefined} aria-hidden={looked || undefined}>
          {turning === 'on' ? 'Turn where you stand, or drag, to look round' : 'Drag to look round the room'}
        </p>
        <div className="v10__switches">
          {canTurn && (
            <button type="button" className="v10__switch" aria-pressed={turning === 'on'} onClick={toggleTurning}>
              <Compass size={16} strokeWidth={2.2} aria-hidden />
              {turning === 'refused' ? 'Motion isn’t allowed here' : 'Look around by turning'}
            </button>
          )}
          {canCamera && (
            <button type="button" className="v10__switch" aria-pressed={camera === 'on'} onClick={toggleCamera}>
              <Camera size={16} strokeWidth={2.2} aria-hidden />
              {camera === 'failed' ? 'No camera to use' : 'Use camera'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
