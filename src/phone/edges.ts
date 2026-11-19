import { useStore } from '../os/store'
import { COLOR, WALLPAPER_DIMMED, WALLPAPER_FOOT, WALLPAPER_TOP, carried, chrome, grounds, overs, sheeted } from './chrome'
import { sys } from './system'

// What is at the top edge of the screen and what is at its foot, as colours. On a real phone the
// browser paints its own bars from them (the one over the page that holds the clock, the one under
// it that holds the address), so that the page seems to run on under both, to the very top and
// foot of the phone.
//
// Safari takes each bar's colour from a strip of solid colour fixed along that edge of the page,
// and only failing that from the page's own colour; a browser that still reads `theme-color` takes
// the top's from there. It reads a colour and nothing else: a picture cannot be put under its bars.
// So the two strips are drawn (Phone.tsx), each in the colour of what is at its edge, and the
// wallpaper is brought to those same two colours at its own edges (phone.css), where it is all but
// flat already: what the browser paints over the top is then the wallpaper's own top, and under the
// foot its own foot.
//
// An app's screen is one colour from top to foot. The wallpaper is not (it is dark at the top and
// pale at the foot), which is why the two are told apart at all. A sheet lays a shade over the app
// behind it, which shows above the sheet, and runs to the foot of the screen itself.

/** A colour with a shade of black laid over it: `by` is how much of the black shows. */
function shaded(hex: string, by: number) {
  const part = (at: number) => Math.round(parseInt(hex.slice(at, at + 2), 16) * (1 - by))
  return `#${[1, 3, 5].map((at) => part(at).toString(16).padStart(2, '0')).join('')}`
}

export function useEdges() {
  const tones = useStore(chrome, (s) => s)
  const own = useStore(grounds, (s) => s)
  const over = useStore(overs, (s) => s)
  const lifted = useStore(carried, (s) => s)
  const sheet = useStore(sheeted, (s) => s)
  const app = useStore(sys, (s) => (s.locked || s.switcher || s.spotlight ? null : s.app))
  // The wallpaper as it is showing: plain, behind the App Switcher's cards, or under search
  const wall = useStore(sys, (s) => (s.locked ? 'plain' : s.switcher ? 'switcher' : s.spotlight ? 'search' : 'plain'))
  /** The status bar's ink is light: over the wallpaper, over a dark app, or over a dark picture at the top of a pale one. */
  const dark = !app || lifted || (over[app] ?? tones[app]) === 'dark'
  /** And the home indicator's, which is at the foot of the screen: there it is the screen's own tone that counts. */
  const darkFoot = !app || lifted || tones[app] === 'dark'
  if (app && !lifted) {
    // A screen in a colour of its own gives the browser that; the rest give it their tone's
    const ground = own[app] ?? COLOR[tones[app]]
    const top = typeof ground === 'string' ? ground : ground.top
    const foot = typeof ground === 'string' ? ground : ground.foot
    if (!sheet.shade) return { dark, darkFoot, top, foot }
    return { dark, darkFoot, top: shaded(top, sheet.shade), foot: sheet.foot ?? shaded(foot, sheet.shade) }
  }
  return wall === 'plain' ? { dark, darkFoot, top: WALLPAPER_TOP, foot: WALLPAPER_FOOT } : { dark, darkFoot, ...WALLPAPER_DIMMED[wall] }
}
