import { lazy, type ComponentType } from 'react'

// Each version is loaded only when it is the one being shown, and one that is
// mid-edit can't take the others down with it.
const V1 = lazy(() => import('./v1'))
const V2 = lazy(() => import('./v2'))
const V3 = lazy(() => import('./v3'))
const V4 = lazy(() => import('./v4'))
const V5 = lazy(() => import('./v5'))
const V6 = lazy(() => import('./v6'))
const V7 = lazy(() => import('./v7'))
const V8 = lazy(() => import('./v8'))
const V9 = lazy(() => import('./v9'))
const V10 = lazy(() => import('./v10'))

// Ten ways the site could work on a phone, from the most familiar to the
// least. Each is the phone's home: it gets the whole screen under the bar that
// names it, and can open the shared pages and sheets (src/phone/apps.tsx) for
// anything it doesn't draw itself. `?v=3` shows the third; no `v` shows the
// list of them.

export interface Variant {
  id: number
  name: string
  /** What it is, in a line. */
  pitch: string
  /** What of the phone it leans on. */
  uses: string
  Home: ComponentType<{ active: boolean }>
}

export const VARIANTS: Variant[] = [
  { id: 1, name: 'The scroll', pitch: 'One long page. The conversation plays as you scroll into it; the rest follows as chapters.', uses: 'Scrolling, snap carousels', Home: V1 },
  { id: 2, name: 'Messages, with apps', pitch: 'The conversation, with the site living where the keyboard does, as iMessage apps do.', uses: 'The keyboard’s place, taps, stickers', Home: V2 },
  { id: 3, name: 'The sheet', pitch: 'The conversation never stops; everything else is a sheet you pull up over it with a thumb.', uses: 'A draggable sheet, one-thumb reach', Home: V3 },
  { id: 4, name: 'Stories', pitch: 'Ninety rings. Tap one and their reply fills the screen; tap on, hold to read, swipe away.', uses: 'Taps, holds, swipes', Home: V4 },
  { id: 5, name: 'The feed', pitch: 'One reply to a screen. Swipe up for the next, sideways for the portfolio, double tap to love.', uses: 'Paging swipes, double tap, the share sheet', Home: V5 },
  { id: 6, name: 'The deck', pitch: 'A deck of ninety cards to flick through: keep the ones that land, and share your hand.', uses: 'Dragging and flinging, flips, ticks', Home: V6 },
  { id: 7, name: 'Shrug it', pitch: 'Ask the question, then shrug your phone. Every shrug is another answer.', uses: 'Shaking and tilting', Home: V7 },
  { id: 8, name: 'The jar', pitch: 'Ninety people pour in and pile up. Tilt the phone and they roll; tap one to hear them out.', uses: 'Which way is down, flicks', Home: V8 },
  { id: 9, name: 'The window', pitch: 'Your phone is a window onto Niv’s Mac: pan, pinch and turn it to look around the real desktop.', uses: 'Pan, pinch, turning the phone', Home: V9 },
  { id: 10, name: 'The room', pitch: 'The family is all around you. Turn where you stand to look round the room at them.', uses: 'Which way you face, the camera', Home: V10 },
]

/** A page that shows the site inside a frame of its own picks the version for
 * it and is asked for the next one. The one-file preview does this: a file has
 * no address to reload onto, so it can't go from version to version itself. */
interface Host {
  v: number
  go(id: number): void
}

const host = (window as { __shrugHost?: Host }).__shrugHost

/** The version the address asks for, or 0 for the list of them. */
export const variantFromUrl = () => {
  const v = host ? host.v : Number(new URLSearchParams(location.search).get('v'))
  return Number.isInteger(v) && v >= 1 && v <= VARIANTS.length ? v : 0
}

/** Goes to a version (or, with 0, back to the list) as a page of its own, so the browser's back returns. */
export const goToVariant = (id: number) => {
  if (host) host.go(id)
  else location.assign(id ? `${location.pathname}?v=${id}` : location.pathname)
}
