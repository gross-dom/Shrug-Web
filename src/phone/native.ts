// What a phone can do that a desktop can't, asked for the same way by every
// version: the share sheet, a tick under the finger, and how the phone is
// being held and moved. Each degrades to nothing where it isn't there, so a
// version always needs a way to work by touch alone.

/** Sends something on through the phone's own share sheet, or copies the address where there is none. */
export async function share(data: { title?: string; text?: string; url?: string } = {}): Promise<'shared' | 'copied' | 'neither'> {
  const url = data.url ?? `${location.origin}${location.pathname}`
  try {
    if (navigator.share) {
      await navigator.share({ ...data, url })
      return 'shared'
    }
    await navigator.clipboard.writeText(data.text ? `${data.text} ${url}` : url)
    return 'copied'
  } catch {
    // Dismissed, or not allowed: nothing to say about it
    return 'neither'
  }
}

let ticker: HTMLLabelElement | null = null

/** A tick under the finger. Android vibrates; Safari has no vibration, but it
 * ticks when a switch is flipped, so one is kept out of sight to flip. Call it
 * from inside a touch handler. */
export function haptic(ms: number | number[] = 10) {
  try {
    if (navigator.vibrate?.(ms)) return
    if (!ticker) {
      ticker = document.createElement('label')
      ticker.setAttribute('aria-hidden', 'true')
      ticker.style.cssText = 'position:fixed;left:-99px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none'
      const box = document.createElement('input')
      box.type = 'checkbox'
      box.setAttribute('switch', '')
      box.tabIndex = -1
      ticker.append(box)
      document.body.append(ticker)
    }
    ticker.click()
  } catch {
    // No tick, then
  }
}

type Asking = { requestPermission?: () => Promise<'granted' | 'denied'> }

/** Whether the phone must be asked, by a tap, before it reports how it moves (iPhones must). */
export const motionNeedsAsking = () => typeof DeviceOrientationEvent !== 'undefined' && typeof (DeviceOrientationEvent as unknown as Asking).requestPermission === 'function'

/** Whether there is anything to ask: a phone that can report how it is held. */
export const hasMotion = () => typeof DeviceOrientationEvent !== 'undefined' && matchMedia('(pointer: coarse)').matches

/** Asks to be told how the phone moves. Call it from a tap. True if it may be read. */
export async function askMotion(): Promise<boolean> {
  try {
    const orientation = DeviceOrientationEvent as unknown as Asking
    const moving = typeof DeviceMotionEvent === 'undefined' ? null : (DeviceMotionEvent as unknown as Asking)
    if (orientation.requestPermission && (await orientation.requestPermission()) !== 'granted') return false
    if (moving?.requestPermission && (await moving.requestPermission()) !== 'granted') return false
    return typeof DeviceOrientationEvent !== 'undefined'
  } catch {
    return false
  }
}

export interface Held {
  /** Leaning left (-1) to right (1): 45 degrees is all the way. */
  x: number
  /** Tipped away (-1) or toward you (1), from how it was held when first read. */
  y: number
  /** Which way is down across the screen: (0, 1) held upright, (1, 0) on its right side. */
  gx: number
  gy: number
}

const clamp = (v: number, lo = -1, hi = 1) => Math.max(lo, Math.min(hi, v))
const rad = (deg: number) => (deg * Math.PI) / 180

/** How the phone is being held, as it changes. Returns a way to stop. */
export function watchHeld(report: (held: Held) => void): () => void {
  let rest: number | null = null
  const on = (e: DeviceOrientationEvent) => {
    if (e.beta === null || e.gamma === null) return
    if (rest === null) rest = e.beta
    const gx = Math.sin(rad(e.gamma)) * Math.cos(rad(e.beta))
    const gy = Math.sin(rad(e.beta))
    report({ x: clamp(e.gamma / 45), y: clamp((e.beta - rest) / 45), gx: clamp(gx), gy: clamp(gy) })
  }
  window.addEventListener('deviceorientation', on)
  return () => window.removeEventListener('deviceorientation', on)
}

/** Which way the phone is facing, in degrees: `yaw` round the compass (0 to 360), `pitch` up (positive) and down. */
export function watchFacing(report: (facing: { yaw: number; pitch: number }) => void): () => void {
  const on = (e: DeviceOrientationEvent) => {
    const compass = (e as DeviceOrientationEvent & { webkitCompassHeading?: number }).webkitCompassHeading
    if (e.alpha === null && compass === undefined) return
    // Safari gives a compass heading clockwise from north; elsewhere alpha runs the other way
    const yaw = compass !== undefined ? compass : (360 - (e.alpha ?? 0)) % 360
    report({ yaw, pitch: clamp(((e.beta ?? 90) - 90) / 90) * 90 })
  }
  window.addEventListener('deviceorientation', on)
  return () => window.removeEventListener('deviceorientation', on)
}

/** A shake, or a quick lift like a shrug. `hard` is how sharp it has to be, in m/s². Returns a way to stop. */
export function watchShake(shaken: () => void, hard = 14): () => void {
  let last = 0
  let before: { x: number; y: number; z: number } | null = null
  const on = (e: DeviceMotionEvent) => {
    // Without gravity where the phone gives it; otherwise the change in the reading that includes it
    const a = e.acceleration && e.acceleration.x !== null ? e.acceleration : null
    const g = e.accelerationIncludingGravity
    let force = 0
    if (a) force = Math.hypot(a.x ?? 0, a.y ?? 0, a.z ?? 0)
    else if (g && g.x !== null) {
      const now = { x: g.x ?? 0, y: g.y ?? 0, z: g.z ?? 0 }
      if (before) force = Math.hypot(now.x - before.x, now.y - before.y, now.z - before.z)
      before = now
    }
    if (force > hard && e.timeStamp - last > 700) {
      last = e.timeStamp
      shaken()
    }
  }
  window.addEventListener('devicemotion', on)
  return () => window.removeEventListener('devicemotion', on)
}
