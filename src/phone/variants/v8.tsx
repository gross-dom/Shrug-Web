import '../../styles/variants/v8.css'
import { memo, useEffect, useRef, useState } from 'react'
import { Smartphone, Vibrate } from 'lucide-react'
import { QUESTION } from '../../apps/chat'
import { GROUP_NAME } from '../../apps/chat-ui'
import { ALL } from '../../apps/portfolio-ui'
import { ShrugAvatar } from '../../apps/ui'
import { PEOPLE, RELATION_LABEL, type Relation } from '../../data/people'
import { VERTICALS } from '../../data/portfolio'
import { SITE } from '../../data/site'
import { prefersReducedMotion } from '../../os/dom'
import { AppIcon, DocumentIcon } from '../../os/icons'
import { askMotion, haptic, hasMotion, motionNeedsAsking, watchHeld, watchShake } from '../native'
import { openApp, openSheet, type PhoneApp } from '../nav'

// Version 8: The jar. The phone is a jar and everyone who answered is poured
// into it, one at a time, and piles up. Which way is down is whichever way the
// phone says it is, so tipping the phone tips the pile; a shake throws
// everyone up. Each of them can be picked up and thrown, and a tap on one opens
// what they said. The same jar holds the portfolio, as its logos. The floor of
// the jar is the way to the rest of the site.

// ---- The physics, by hand ----
// Circles only. A step moves everyone by gravity and what speed they had, then
// a few rounds push apart whatever overlaps (the lighter one further) and back
// inside the walls, and where each ended up says how fast it is now going. A
// grid of cells finds who could be touching without asking everyone about
// everyone. Nothing in here reads the page: it is all numbers, and the only
// thing written is each body's transform.

/** How hard down pulls, in px/s²: far less than the world's, so a pour can be watched. */
const GRAVITY = 2300
/** One step of the clock, in seconds, whatever the screen's own rate. */
const STEP = 1 / 180
/** The most steps one frame may take to catch up: past that it runs slow rather than stall. */
const MOST_STEPS = 5
/** Rounds of pushing apart in a step. */
const ROUNDS = 3
const TOP_SPEED = 1900
/** How much of a knock comes back: off each other, and off the glass. */
const BOUNCE = 0.2
const WALL_BOUNCE = 0.36
/** A knock slower than this (px/s) doesn't bounce at all, so a pile lies still. */
const KNOCK = 140
/** What a step leaves of a body's speed: in the air, and rubbing against something. */
const AIR = 0.9994
const RUB = 0.988
/** Slower than this (px/s) against something, a body is simply at rest. */
const REST = 2
/** The most bodies a jar is made for. */
const MOST = 128
/** How much of the jar its bodies fill. */
const FULL = 0.43

interface Hold {
  /** The body the finger has, or -1 where it came down on the bare jar. */
  i: number
  /** From the finger to the body's middle, so it doesn't jump to the finger. */
  ox: number
  oy: number
  /** Where the body is wanted. */
  tx: number
  ty: number
  /** Where and when the finger came down, and whether it has since gone anywhere. */
  x0: number
  y0: number
  at: number
  far: boolean
  /** Where the finger has lately been: time, x, y, three at a time. */
  trail: number[]
  /** The jar's corner on the page, read once as the finger came down. */
  left: number
  top: number
}

interface Jar {
  /** Empties the jar and pours these in: `gap(k)` is the wait, in ms, before the one after the k-th. */
  pour(bodies: HTMLElement[], gap: (k: number) => number): void
  /** The room there is, and how much of the top of it is written over. */
  resize(width: number, height: number, clear: number): void
  /** Which way is down across the screen, each from -1 to 1. */
  down(x: number, y: number): void
  /** Everyone thrown up. */
  toss(): void
  /** Whether it may run: not while something covers it. */
  run(on: boolean): void
  destroy(): void
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

interface Telling {
  /** How many are in. */
  count: (n: number) => void
  /** One was tapped. */
  open: (i: number) => void
  /** The bare glass was knocked on, here. */
  knock: (x: number, y: number) => void
  /** One was picked up (or, with -1, put down): its name goes on the tag. */
  hold: (i: number) => void
}

function createJar(host: HTMLElement, tag: HTMLElement, tell: Telling, still: boolean): Jar {
  let W = 0
  let H = 0
  /** How far down the writing over the top of the jar comes: the pile is kept below it. */
  let top = 200
  let els: HTMLElement[] = []
  let n = 0

  // Where each is, where it was a step ago, and how fast it is going
  const x = new Float64Array(MOST)
  const y = new Float64Array(MOST)
  const px = new Float64Array(MOST)
  const py = new Float64Array(MOST)
  const vx = new Float64Array(MOST)
  const vy = new Float64Array(MOST)
  /** Its speed going into a step, before anything was pushed: what a bounce is measured from. */
  const ux = new Float64Array(MOST)
  const uy = new Float64Array(MOST)
  const rad = new Float64Array(MOST)
  /** One over its weight: a bigger one is pushed less. */
  const light = new Float64Array(MOST)
  /** How far it has rolled over, in radians: it rights itself. */
  const ang = new Float64Array(MOST)
  /** What was last drawn, and where it was a frame ago. */
  const drawnX = new Float64Array(MOST)
  const drawnY = new Float64Array(MOST)
  const drawnA = new Float64Array(MOST)
  const frameX = new Float64Array(MOST)
  /** 0: not poured yet. 1: on its way in over the rim. 2: in, and the rim holds it too. */
  const inside = new Uint8Array(MOST)
  const held = new Uint8Array(MOST)
  const touching = new Uint8Array(MOST)
  const hitX = new Int8Array(MOST)
  const hitY = new Int8Array(MOST)

  // The grid: each cell heads a chain of the bodies whose middles are in it
  let cell = 48
  let cols = 1
  let rows = 1
  let heads = new Int32Array(1)
  const chain = new Int32Array(MOST)
  const cellX = new Int32Array(MOST)
  const cellY = new Int32Array(MOST)

  // The knocks of this step that were hard enough to bounce
  const KNOCKS = 256
  const knockI = new Int32Array(KNOCKS)
  const knockJ = new Int32Array(KNOCKS)
  const knockX = new Float64Array(KNOCKS)
  const knockY = new Float64Array(KNOCKS)
  const knockV = new Float64Array(KNOCKS)
  let knocks = 0

  // Down, as it is and as the phone last said it was
  let downX = 0
  let downY = 1
  let wantX = 0
  let wantY = 1

  let poured = 0
  let gap: (k: number) => number = () => 400
  let nextAt = 0
  const holds = new Map<number, Hold>()
  /** The one whose name is up, and where the tag was last put. */
  let named = -1
  let tagX = NaN
  let tagY = NaN
  /** A finger that came up where it went down: the click that follows opens this one. */
  let tapped: { i: number; at: number } | null = null
  let unclicked: ReturnType<typeof setTimeout> | undefined
  /** When a finger last came up from anything else (a throw, a knock): the click that follows is not a tap. */
  let handledAt = -1e9

  let allowed = false
  let frame = 0
  let last = 0
  let owed = 0
  let quiet = 0

  /** Sizes for everyone, by the room there is: enough to fill the jar about half way, and to lie clear of what is written over the top of it. */
  function size() {
    if (!W || !H || !n) return
    // A pile of them is about seven parts disc to three of gaps, and its top is never level
    const room = Math.min(FULL, (0.7 * (H - top - 24)) / H)
    const base = clamp(Math.sqrt((Math.max(0.24, room) * W * H) / (n * Math.PI)), 12, 27)
    let widest = 0
    for (let i = 0; i < n; i++) {
      // No two quite the same size, so they don't stack like oranges
      const r = base * (0.86 + 0.28 * ((i * 0.618034) % 1))
      rad[i] = r
      light[i] = (base * base) / (r * r)
      widest = Math.max(widest, r)
      els[i]!.style.setProperty('--d', `${(r * 2).toFixed(1)}px`)
    }
    cell = widest * 2 + 1
    cols = Math.ceil(W / cell) + 2
    rows = Math.ceil(H / cell) + 4
    heads = new Int32Array(cols * rows)
  }

  function sort() {
    heads.fill(-1)
    for (let i = 0; i < n; i++) {
      if (!inside[i]) continue
      const cx = clamp(Math.floor(x[i]! / cell) + 1, 0, cols - 1)
      const cy = clamp(Math.floor(y[i]! / cell) + 2, 0, rows - 1)
      const c = cy * cols + cx
      cellX[i] = cx
      cellY[i] = cy
      chain[i] = heads[c]!
      heads[c] = i
    }
  }

  /** One round: everyone pushed off whoever they overlap, and back inside the glass. */
  function round(first: boolean) {
    for (let i = 0; i < n; i++) {
      if (!inside[i]) continue
      const cx = cellX[i]!
      const cy = cellY[i]!
      for (let gy = cy - 1; gy <= cy + 1; gy++) {
        if (gy < 0 || gy >= rows) continue
        for (let gx = cx - 1; gx <= cx + 1; gx++) {
          if (gx < 0 || gx >= cols) continue
          for (let j = heads[gy * cols + gx]!; j !== -1; j = chain[j]!) {
            if (j <= i) continue
            const dx = x[j]! - x[i]!
            const dy = y[j]! - y[i]!
            const reach = rad[i]! + rad[j]!
            const d2 = dx * dx + dy * dy
            if (d2 >= reach * reach) continue
            // One under a finger doesn't give way
            const wi = held[i] ? 0 : light[i]!
            const wj = held[j] ? 0 : light[j]!
            const both = wi + wj
            if (!both) continue
            let d = Math.sqrt(d2)
            let nx = 0
            let ny = -1
            if (d > 1e-4) {
              nx = dx / d
              ny = dy / d
            } else d = 0
            const push = (reach - d) / both
            x[i] -= nx * push * wi
            y[i] -= ny * push * wi
            x[j] += nx * push * wj
            y[j] += ny * push * wj
            touching[i] = touching[j] = 1
            if (first && knocks < KNOCKS) {
              const closing = (ux[j]! - ux[i]!) * nx + (uy[j]! - uy[i]!) * ny
              if (closing < -KNOCK) {
                knockI[knocks] = i
                knockJ[knocks] = j
                knockX[knocks] = nx
                knockY[knocks] = ny
                knockV[knocks] = closing
                knocks++
              }
            }
          }
        }
      }
      if (held[i]) continue
      const r = rad[i]!
      if (x[i]! < r) {
        x[i] = r
        hitX[i] = -1
        touching[i] = 1
      } else if (x[i]! > W - r) {
        x[i] = W - r
        hitX[i] = 1
        touching[i] = 1
      }
      if (y[i]! > H - r) {
        y[i] = H - r
        hitY[i] = 1
        touching[i] = 1
      } else if (inside[i] === 2 && y[i]! < r) {
        y[i] = r
        hitY[i] = -1
        touching[i] = 1
      } else if (y[i]! < -3 * r) y[i] = -3 * r
    }
  }

  function step() {
    const ax = downX * GRAVITY * STEP
    const ay = downY * GRAVITY * STEP
    for (let i = 0; i < n; i++) {
      if (!inside[i]) continue
      px[i] = x[i]!
      py[i] = y[i]!
      if (!held[i]) {
        const keep = touching[i] ? RUB : AIR
        let sx = (vx[i]! + ax) * keep
        let sy = (vy[i]! + ay) * keep
        const s2 = sx * sx + sy * sy
        if (s2 > TOP_SPEED * TOP_SPEED) {
          const f = TOP_SPEED / Math.sqrt(s2)
          sx *= f
          sy *= f
        }
        ux[i] = sx
        uy[i] = sy
        x[i] += sx * STEP
        y[i] += sy * STEP
      }
      touching[i] = 0
      hitX[i] = 0
      hitY[i] = 0
    }
    // One under a finger goes to the finger: most of the way each step, so it is carried, not jumped
    for (const h of holds.values()) {
      if (h.i < 0) continue
      x[h.i] += (h.tx - x[h.i]!) * 0.45
      y[h.i] += (h.ty - y[h.i]!) * 0.45
      ux[h.i] = (x[h.i]! - px[h.i]!) / STEP
      uy[h.i] = (y[h.i]! - py[h.i]!) / STEP
    }
    sort()
    knocks = 0
    for (let k = 0; k < ROUNDS; k++) round(k === 0)
    // Where each ended up is how fast it is going; what hit the glass hard comes back off it
    for (let i = 0; i < n; i++) {
      if (!inside[i] || held[i]) continue
      let sx = (x[i]! - px[i]!) / STEP
      let sy = (y[i]! - py[i]!) / STEP
      if (hitX[i] && ux[i]! * hitX[i]! > KNOCK) sx = -ux[i]! * WALL_BOUNCE
      if (hitY[i] && uy[i]! * hitY[i]! > KNOCK) sy = -uy[i]! * WALL_BOUNCE
      vx[i] = sx
      vy[i] = sy
      if (inside[i] === 1 && y[i]! > rad[i]! + 1) inside[i] = 2
    }
    // And what hit each other hard comes back off each other
    for (let k = 0; k < knocks; k++) {
      const i = knockI[k]!
      const j = knockJ[k]!
      const wi = held[i] ? 0 : light[i]!
      const wj = held[j] ? 0 : light[j]!
      if (!(wi + wj)) continue
      const nx = knockX[k]!
      const ny = knockY[k]!
      const parting = (vx[j]! - vx[i]!) * nx + (vy[j]! - vy[i]!) * ny
      const more = -BOUNCE * knockV[k]! - parting
      if (more <= 0) continue
      const share = more / (wi + wj)
      vx[i] -= nx * share * wi
      vy[i] -= ny * share * wi
      vx[j] += nx * share * wj
      vy[j] += ny * share * wj
    }
    for (let i = 0; i < n; i++) {
      if (touching[i] && !held[i] && vx[i]! * vx[i]! + vy[i]! * vy[i]! < REST * REST) {
        vx[i] = 0
        vy[i] = 0
      }
    }
  }

  /** Only what has moved since it was last drawn is written. */
  function draw() {
    for (let i = 0; i < n; i++) {
      if (!inside[i]) continue
      const dx = x[i]! - drawnX[i]!
      const dy = y[i]! - drawnY[i]!
      if (dx * dx + dy * dy <= 0.012 && Math.abs(ang[i]! - drawnA[i]!) <= 0.004) continue
      els[i]!.style.transform = `translate3d(${x[i]!.toFixed(1)}px,${y[i]!.toFixed(1)}px,0) rotate(${ang[i]!.toFixed(3)}rad)`
      drawnX[i] = x[i]!
      drawnY[i] = y[i]!
      drawnA[i] = ang[i]!
    }
    // The name of the one in hand rides just clear of the finger: above it, or under it at the very top
    if (named < 0) return
    const r = rad[named]!
    const atX = clamp(x[named]!, Math.min(104, W / 2), Math.max(W - 104, W / 2))
    const atY = y[named]! - r - 40 < 56 ? y[named]! + r + 44 : y[named]! - r - 40
    if (Math.abs(atX - tagX) + Math.abs(atY - tagY) < 0.3) return
    tag.style.transform = `translate3d(${atX.toFixed(1)}px,${atY.toFixed(1)}px,0)`
    tagX = atX
    tagY = atY
  }

  function name(i: number) {
    if (i === named) return
    named = i
    tagX = NaN
    tell.hold(i)
  }

  function enter(i: number, atX: number, atY: number, state: 1 | 2) {
    x[i] = px[i] = frameX[i] = atX
    y[i] = py[i] = atY
    vx[i] = vy[i] = 0
    inside[i] = state
    drawnX[i] = NaN
    els[i]!.setAttribute('data-in', '')
  }

  /** The next one, over the rim: the spout wanders from side to side as it pours. */
  function drop() {
    const i = poured++
    const r = rad[i]!
    const at = clamp(W * (0.5 + 0.33 * Math.sin(i * 0.9)) + (Math.random() - 0.5) * 36, r + 2, W - r - 2)
    if (downY > 0.2) {
      enter(i, at, -r - 2, 1)
      vx[i] = (Math.random() - 0.5) * 160
      vy[i] = 240
    } else enter(i, at, r + 4 + Math.random() * 24, 2)
    ang[i] = (Math.random() - 0.5) * 1.6
    tell.count(poured)
  }

  /** Everyone in at once and already lying where they would have come to rest: nothing is seen to move. */
  function settle() {
    if (!W || !H || !n) return
    let widest = 0
    for (let i = 0; i < n; i++) widest = Math.max(widest, rad[i]!)
    let k = 0
    for (let row = 0; k < n; row++) {
      for (let at = widest + (row % 2 ? widest : 0); at <= W - widest + 0.5 && k < n; at += widest * 2.04) {
        enter(k, at + ((k * 0.618034) % 1) * 2 - 1, H - widest - row * widest * 1.8, 2)
        ang[k] = 0
        k++
      }
    }
    downX = wantX = 0
    downY = wantY = 1
    for (let s = 0; s < 500; s++) step()
    poured = n
    draw()
    tell.count(n)
  }

  function tick(t: number) {
    frame = 0
    const dt = Math.min(0.05, Math.max(0, (t - last) / 1000))
    last = t
    downX += (wantX - downX) * 0.2
    downY += (wantY - downY) * 0.2
    if (poured < n && W && t >= nextAt) {
      nextAt = t + gap(poured)
      drop()
    }
    owed += dt
    let steps = 0
    while (owed >= STEP && steps < MOST_STEPS) {
      step()
      owed -= STEP
      steps++
    }
    if (steps === MOST_STEPS) owed = 0
    // Each rolls with how far it went across, and rights itself: a weighted bottom
    let busiest = 0
    for (let i = 0; i < n; i++) {
      if (!inside[i]) continue
      ang[i] = (ang[i]! + ((x[i]! - frameX[i]!) / rad[i]!) * 0.35) * 0.93
      frameX[i] = x[i]!
      busiest = Math.max(busiest, vx[i]! * vx[i]! + vy[i]! * vy[i]!, ang[i]! * ang[i]! * 4e4)
    }
    draw()
    // Everyone in, nobody held, nothing moving and down where it was: it sleeps until something changes
    const calm = busiest < 9 && poured >= n && !holds.size && Math.abs(wantX - downX) + Math.abs(wantY - downY) < 0.02
    quiet = calm ? quiet + 1 : 0
    if (quiet > 40) return
    frame = requestAnimationFrame(tick)
  }

  function wake() {
    quiet = 0
    if (frame || !allowed || still || document.hidden) return
    last = performance.now()
    owed = 0
    frame = requestAnimationFrame(tick)
  }

  function sleep() {
    cancelAnimationFrame(frame)
    frame = 0
  }

  function toss() {
    if (still) return
    const pull = Math.hypot(downX, downY)
    const upX = pull > 0.15 ? -downX / pull : 0
    const upY = pull > 0.15 ? -downY / pull : -1
    for (let i = 0; i < n; i++) {
      if (!inside[i] || held[i]) continue
      const up = 800 + Math.random() * 900
      const across = (Math.random() - 0.5) * 1300
      vx[i] += upX * up - upY * across
      vy[i] += upY * up + upX * across
    }
    wake()
  }

  /** A knock on the glass: whoever is near is thrown back from it. */
  function knock(atX: number, atY: number) {
    const reach = Math.max(96, W * 0.3)
    for (let i = 0; i < n; i++) {
      if (!inside[i] || held[i]) continue
      const dx = x[i]! - atX
      const dy = y[i]! - atY
      const d = Math.hypot(dx, dy)
      if (d >= reach) continue
      const hard = (1 - d / reach) * 1500
      vx[i] += (d ? dx / d : 0) * hard - downX * hard * 0.25
      vy[i] += (d ? dy / d : -1) * hard - downY * hard * 0.25
    }
    tell.knock(atX, atY)
    haptic(8)
    wake()
  }

  // ---- Fingers ----

  function pointerDown(e: PointerEvent) {
    if (e.button > 0 || !n) return
    const box = host.getBoundingClientRect()
    const mx = e.clientX - box.left
    const my = e.clientY - box.top
    // Whoever is under the finger, or right beside it
    let got = -1
    let nearest = 9
    for (let i = 0; i < n; i++) {
      if (!inside[i] || held[i]) continue
      const off = Math.hypot(x[i]! - mx, y[i]! - my) - rad[i]!
      if (off < nearest) {
        nearest = off
        got = i
      }
    }
    holds.set(e.pointerId, { i: got, ox: got < 0 ? 0 : x[got]! - mx, oy: got < 0 ? 0 : y[got]! - my, tx: got < 0 ? 0 : x[got]!, ty: got < 0 ? 0 : y[got]!, x0: mx, y0: my, at: e.timeStamp, far: false, trail: [e.timeStamp, mx, my], left: box.left, top: box.top })
    try {
      host.setPointerCapture(e.pointerId)
    } catch {
      // The finger has already gone
    }
    tapped = null
    if (got >= 0) {
      held[got] = 1
      vx[got] = vy[got] = 0
      els[got]!.setAttribute('data-held', '')
      name(got)
      haptic(6)
    }
    wake()
  }

  function pointerMove(e: PointerEvent) {
    const h = holds.get(e.pointerId)
    if (!h) return
    const mx = e.clientX - h.left
    const my = e.clientY - h.top
    if (!h.far && Math.hypot(mx - h.x0, my - h.y0) > 8) h.far = true
    h.trail.push(e.timeStamp, mx, my)
    if (h.trail.length > 30) h.trail.splice(0, 3)
    if (h.i >= 0) {
      const r = rad[h.i]!
      h.tx = clamp(mx + h.ox, r, W - r)
      h.ty = clamp(my + h.oy, r, H - r)
    }
    wake()
  }

  function pointerUp(e: PointerEvent) {
    const h = holds.get(e.pointerId)
    if (!h) return
    holds.delete(e.pointerId)
    const i = h.i
    const lifted = e.type === 'pointerup'
    // A tap: down and up again in the one place, and not held there
    const tap = lifted && !h.far && e.timeStamp - h.at < 500
    if (!(i >= 0 && tap)) handledAt = e.timeStamp
    if (i >= 0) {
      held[i] = 0
      els[i]?.removeAttribute('data-held')
      if (named === i) name(-1)
      vx[i] = vy[i] = 0
      if (tap) {
        const mine = (tapped = { i, at: e.timeStamp })
        // The browser's click is what opens it. Should none come, it is opened
        // anyway, and a click that turns up late is kept from whatever has opened.
        clearTimeout(unclicked)
        unclicked = setTimeout(() => {
          if (tapped !== mine) return
          tapped = null
          tell.open(i)
          const late = (ev: Event) => {
            ev.stopPropagation()
            ev.preventDefault()
          }
          document.addEventListener('click', late, { capture: true, once: true })
          setTimeout(() => document.removeEventListener('click', late, { capture: true }), 500)
        }, 160)
      } else if (h.far) {
        // Thrown: as fast as the finger was going over its last tenth of a second
        const t = h.trail
        const end = t.length - 3
        let from = end
        while (from >= 3 && e.timeStamp - t[from - 3]! <= 100) from -= 3
        const took = (t[end]! - t[from]!) / 1000
        if (lifted && took > 0.012 && e.timeStamp - t[end]! < 90) {
          let sx = (t[end + 1]! - t[from + 1]!) / took
          let sy = (t[end + 2]! - t[from + 2]!) / took
          const s = Math.hypot(sx, sy)
          if (s > TOP_SPEED) {
            sx *= TOP_SPEED / s
            sy *= TOP_SPEED / s
          }
          vx[i] = sx
          vy[i] = sy
        }
      }
    } else if (tap) knock(h.x0, h.y0)
    wake()
  }

  /** Whatever is in hand is put down: the fingers have gone, or are about to be ignored. */
  function letGo() {
    for (const h of holds.values()) {
      if (h.i < 0) continue
      held[h.i] = 0
      els[h.i]?.removeAttribute('data-held')
    }
    holds.clear()
    name(-1)
    tapped = null
    clearTimeout(unclicked)
  }

  /** A tap on someone opens them: the one the finger was just on, or (by the keyboard, or anything that only clicks) the one clicked. */
  function click(e: MouseEvent) {
    const was = tapped
    tapped = null
    if (was && e.timeStamp - was.at < 700) return tell.open(was.i)
    if (e.timeStamp - handledAt < 700) return
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-body]')
    const i = el ? els.indexOf(el) : -1
    if (i >= 0 && inside[i]) tell.open(i)
  }

  /** The arrow keys go from one to the next of those that are in. */
  function key(e: KeyboardEvent) {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-body]')
    const by = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    let i = el ? els.indexOf(el) : -1
    if (i < 0 || !by) return
    e.preventDefault()
    for (let k = 0; k < n; k++) {
      i = (i + by + n) % n
      if (inside[i]) return (els[i]!.firstElementChild as HTMLElement | null)?.focus({ preventScroll: true })
    }
  }

  const menu = (e: Event) => e.preventDefault()
  const seen = () => (document.hidden ? sleep() : wake())

  if (!still) {
    host.addEventListener('pointerdown', pointerDown)
    host.addEventListener('pointermove', pointerMove)
    host.addEventListener('pointerup', pointerUp)
    host.addEventListener('pointercancel', pointerUp)
  }
  host.addEventListener('click', click)
  host.addEventListener('keydown', key)
  host.addEventListener('contextmenu', menu)
  document.addEventListener('visibilitychange', seen)

  return {
    pour(bodies, wait) {
      letGo()
      els = bodies.slice(0, MOST)
      n = els.length
      gap = wait
      poured = 0
      nextAt = 0
      inside.fill(0)
      held.fill(0)
      touching.fill(0)
      for (const el of els) {
        el.removeAttribute('data-in')
        el.removeAttribute('data-held')
      }
      tell.count(0)
      size()
      if (still) settle()
      else wake()
    },
    resize(width, height, clear) {
      if (width === W && height === H && clear === top) return
      W = width
      H = height
      top = clear
      size()
      if (still) settle()
      else wake()
    },
    down(gx, gy) {
      wantX = clamp(gx, -1, 1)
      wantY = clamp(gy, -1, 1)
      if (!frame && Math.abs(wantX - downX) + Math.abs(wantY - downY) > 0.04) wake()
    },
    toss,
    run(on) {
      allowed = on
      if (on) return wake()
      sleep()
      letGo()
    },
    destroy() {
      sleep()
      allowed = false
      letGo()
      host.removeEventListener('pointerdown', pointerDown)
      host.removeEventListener('pointermove', pointerMove)
      host.removeEventListener('pointerup', pointerUp)
      host.removeEventListener('pointercancel', pointerUp)
      host.removeEventListener('click', click)
      host.removeEventListener('keydown', key)
      host.removeEventListener('contextmenu', menu)
      document.removeEventListener('visibilitychange', seen)
      for (const el of els) {
        el.removeAttribute('data-in')
        el.removeAttribute('data-held')
      }
    },
  }
}

// ---- What goes in the jar ----

type Mode = 'people' | 'portfolio'

/** A person's disc carries their initials: of the first name and the last. */
function initials(name: string) {
  const words = name.replace(' & ', ' ').trim().split(/\s+/)
  const first = [...(words[0] ?? '')][0] ?? ''
  const end = words.length > 1 ? ([...words[words.length - 1]!][0] ?? '') : ''
  return (first + end).toUpperCase()
}

const KEY: Relation[] = ['F', 'L', 'C']

// Each body is a plain box that the jar moves, with the button inside it: a
// button costs several times what a box does to restyle, and a body's box is
// restyled every frame it moves.

/** Everyone, as discs: made once, and from then on only the jar moves them. A
 * disc is the colour of the first way its person knows Shrug, and ringed in
 * the colour of the second where there is one. */
const People = memo(function People() {
  return (
    <>
      {PEOPLE.map((person, i) => (
        <div key={i} className="v8__body" data-body={i}>
          <button type="button" className="v8__disc" data-r={person.relations[0] ?? 'N'} data-also={person.relations[1]} data-all={person.relations.join('')} tabIndex={i ? -1 : 0} aria-label={`${person.name}, ${person.role}`}>
            {initials(person.name)}
          </button>
        </div>
      ))}
    </>
  )
})

/** The portfolio, as tiles: each company's logo, or its initial where there is none. */
const Logos = memo(function Logos() {
  return (
    <>
      {ALL.map((company, i) => (
        <div key={company.name} className="v8__body" data-body={i}>
          <button type="button" className="v8__tile logo" data-empty={company.logo ? undefined : ''} tabIndex={i ? -1 : 0} aria-label={`${company.name}, ${company.vertical}`}>
            {company.logo ? <img src={`${import.meta.env.BASE_URL}logos/${company.logo}`} alt="" decoding="async" draggable={false} /> : company.name.trim()[0]?.toUpperCase()}
          </button>
        </div>
      ))}
    </>
  )
})

const DOORS: { app: PhoneApp; label: string }[] = [
  { app: 'notes', label: 'FAQs' },
  { app: 'terminal', label: 'Case studies' },
  { app: 'photos', label: 'VIP' },
]

/** How much more a lean to one side counts for than it measures. */
const LEAN = 1.7

/** How long the first pour waits before the one after the k-th, in ms: half a second at first, and quickening. */
const firstPour = (k: number) => Math.max(190, 520 * 0.975 ** k)
const quickPour = () => 46

export default function V8({ active }: { active: boolean }) {
  const host = useRef<HTMLDivElement>(null)
  const head = useRef<HTMLElement>(null)
  const count = useRef<HTMLElement>(null)
  const ripple = useRef<HTMLElement>(null)
  const tag = useRef<HTMLDivElement>(null)
  const jar = useRef<Jar | null>(null)
  const [mode, setMode] = useState<Mode>('people')
  /** The set on its way out through the floor, while the other pours in. */
  const [leaving, setLeaving] = useState<Mode | null>(null)
  /** The logos are only drawn once they are wanted, or the page has had a moment to itself. */
  const [logos, setLogos] = useState(false)
  /** ask: the phone has to be asked first. on: it is telling us how it is held. off: there is nothing to ask, or it said no. */
  const [motion, setMotion] = useState<'ask' | 'on' | 'off'>(() => (motionNeedsAsking() ? 'ask' : hasMotion() ? 'on' : 'off'))
  /** One way of knowing Shrug, picked out: everyone else is dimmed. */
  const [only, setOnly] = useState<Relation | null>(null)
  const still = prefersReducedMotion()
  const showing = useRef(mode)
  showing.current = mode
  const poured = useRef({ people: false, portfolio: false })
  const timer = useRef<ReturnType<typeof setTimeout>>()

  // The jar itself, for as long as this is on the page
  useEffect(() => {
    const el = host.current
    const label = tag.current
    if (!el || !label) return
    poured.current = { people: false, portfolio: false }
    const made = createJar(
      el,
      label,
      {
        count: (k) => {
          if (count.current) count.current.textContent = String(k)
        },
        open: (i) => {
          haptic()
          openSheet(showing.current === 'people' ? `person:${i}` : `company:${ALL[i]!.name}`)
        },
        knock: (x, y) => {
          ripple.current?.animate(
            [
              { opacity: 0.55, transform: `translate3d(${x}px, ${y}px, 0) scale(0.15)` },
              { opacity: 0, transform: `translate3d(${x}px, ${y}px, 0) scale(1)` },
            ],
            { duration: 460, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)' },
          )
        },
        hold: (i) => {
          label.toggleAttribute('data-on', i >= 0)
          if (i < 0) return
          const people = showing.current === 'people'
          label.firstElementChild!.textContent = people ? PEOPLE[i]!.name : ALL[i]!.name
          label.lastElementChild!.textContent = people ? PEOPLE[i]!.role : ALL[i]!.vertical
        },
      },
      still,
    )
    jar.current = made
    // The room in the jar, and how far down it the words at the top come (their fade aside)
    const fit = () => made.resize(el.clientWidth, el.clientHeight, Math.max(0, (head.current?.offsetHeight ?? 230) - 30))
    fit()
    const watch = new ResizeObserver(fit)
    watch.observe(el)
    if (head.current) watch.observe(head.current)
    return () => {
      watch.disconnect()
      made.destroy()
      jar.current = null
    }
  }, [still])

  // Whichever set is showing is poured in, once it has been drawn: slowly the
  // first time the people are, quickly after that
  const drawn = mode === 'people' || logos
  useEffect(() => {
    const el = host.current
    if (!el || !jar.current || !drawn) return
    const again = poured.current[mode] || mode === 'portfolio'
    poured.current[mode] = true
    jar.current.pour([...el.querySelectorAll<HTMLElement>(`[data-set="${mode}"] > [data-body]`)], again ? quickPour : firstPour)
  }, [mode, drawn, still])

  useEffect(() => {
    jar.current?.run(active)
  }, [active, still])

  // The phone's own word on which way is down, and on being shaken, while this is in front
  useEffect(() => {
    if (!active || motion !== 'on' || still) return
    const stopHeld = watchHeld((h) => {
      // Down is reported for a phone held upright: turned on its side, the screen has turned with it
      const turn = ((screen.orientation?.angle ?? (window as { orientation?: number }).orientation ?? 0) * Math.PI) / 180
      // A lean counts for more than it is, so a small tip of the hand is enough to set the pile sliding
      const x = (h.gx * Math.cos(turn) + h.gy * Math.sin(turn)) * LEAN
      const y = -h.gx * Math.sin(turn) + h.gy * Math.cos(turn)
      // And the pull is the whole of it however the phone is tipped back, until it is lying nearly flat: then nothing falls
      const pull = Math.hypot(x, y)
      const full = Math.min(1.1, Math.max(pull, Math.min(0.85, pull * 3.2)))
      jar.current?.down(pull ? (x / pull) * full : 0, pull ? (y / pull) * full : 0)
    })
    const stopShake = watchShake(() => {
      haptic(14)
      jar.current?.toss()
    }, 13)
    return () => {
      stopHeld()
      stopShake()
    }
  }, [active, motion, still])

  // The logos are fetched once the page is quiet, so they are there by the time they are asked for
  useEffect(() => {
    const t = setTimeout(() => setLogos(true), 2600)
    return () => {
      clearTimeout(t)
      clearTimeout(timer.current)
    }
  }, [])

  const swap = (to: Mode) => {
    if (to === mode) return
    haptic()
    setLogos(true)
    setMode(to)
    clearTimeout(timer.current)
    if (still) return setLeaving(null)
    setLeaving(mode)
    timer.current = setTimeout(() => setLeaving(null), 480)
  }

  const set = (which: Mode) => ({
    className: 'v8__set',
    'data-set': which,
    hidden: mode !== which && leaving !== which,
    'data-leaving': leaving === which || undefined,
    ...(mode === which ? null : ({ inert: '' } as object)),
  })

  const total = mode === 'people' ? PEOPLE.length : ALL.length

  return (
    <div className="v8" data-mode={mode} data-motion={motion} data-only={(mode === 'people' && only) || undefined}>
      <header ref={head} className="v8__top">
        <div className="v8__bar">
          <div className="v8__switch" role="group" aria-label="What is in the jar">
            <button type="button" aria-pressed={mode === 'people'} onClick={() => swap('people')}>
              People
            </button>
            <button type="button" aria-pressed={mode === 'portfolio'} onClick={() => swap('portfolio')}>
              Portfolio
            </button>
          </div>
          {!still && (
            <button
              type="button"
              className="v8__shake"
              aria-label="Shake the jar"
              onClick={() => {
                haptic(14)
                jar.current?.toss()
              }}
            >
              <Vibrate size={15} strokeWidth={2.2} aria-hidden />
              Shake
            </button>
          )}
        </div>
        {mode === 'people' ? (
          <div className="v8__ask">
            <ShrugAvatar size={26} />
            <div className="v8__bubbles">
              <p>{QUESTION[0]}</p>
              <p>{QUESTION[1]}</p>
            </div>
          </div>
        ) : (
          <p className="v8__title">
            Portfolio <span>{VERTICALS.length} verticals</span>
          </p>
        )}
        <p className="v8__count">
          <b ref={count}>0</b> of {total} are in
        </p>
        <p className="v8__hint">
          {mode === 'people' ? 'Tap someone for what they said.' : 'Tap a logo for the company.'}
          {still ? '' : motion === 'on' ? ' Tip your phone and they slide.' : ' Drag one to throw it.'}
        </p>
        {mode === 'people' && (
          <ul className="v8__key" aria-label="What the colours mean: pick one out">
            {KEY.map((r) => (
              <li key={r}>
                <button
                  type="button"
                  data-r={r}
                  aria-pressed={only === r}
                  onClick={() => {
                    haptic()
                    setOnly(only === r ? null : r)
                  }}
                >
                  {RELATION_LABEL[r]}
                </button>
              </li>
            ))}
          </ul>
        )}
      </header>

      <div ref={host} className="v8__jar" role="group" aria-label={mode === 'people' ? `${GROUP_NAME}: everyone who answered` : 'The portfolio'}>
        <div {...set('people')}>
          <People />
        </div>
        <div {...set('portfolio')}>{logos && <Logos />}</div>
        <i ref={ripple} className="v8__ripple" aria-hidden />
        <div ref={tag} className="v8__tag" aria-hidden>
          <b />
          <span />
        </div>
      </div>

      <nav className="v8__floor" aria-label="The rest of Shrug">
        {DOORS.map((door) => (
          <button key={door.app} type="button" className="v8__door" onClick={() => openApp(door.app)}>
            <span className="v8__door-icon" data-shot={door.app}>
              <AppIcon id={door.app} />
            </span>
            <span>{door.label}</span>
          </button>
        ))}
        <a className="v8__door" href={SITE.onePager} target="_blank" rel="noreferrer" aria-label="One-pager (opens in a new tab)">
          <span className="v8__door-icon v8__door-icon--doc">
            <DocumentIcon />
          </span>
          <span>One-pager</span>
        </a>
        {motion === 'ask' && !still && (
          <button
            type="button"
            className="v8__tilt"
            onClick={async () => {
              haptic()
              setMotion((await askMotion()) ? 'on' : 'off')
            }}
          >
            <Smartphone size={15} strokeWidth={2.2} aria-hidden />
            Turn on tilt
          </button>
        )}
      </nav>
    </div>
  )
}
