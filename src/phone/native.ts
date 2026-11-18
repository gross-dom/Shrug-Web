// What a phone can do that a desktop can't: the share sheet, and a tick under
// the finger. Each does nothing where it isn't there.

import { linkTo, spotOfPlace } from '../os/place'
import { settings } from './settings'
import { sys } from './system'

/** The address to pass on: a link to where the phone is now (the app, and the company, question,
 * conversation or drop that is open in it). Where the page has no address of its own (a preview
 * opened from a file) it is the site's. */
export const pageUrl = () => linkTo(spotOfPlace(sys.get()))

/** Sends something on through the phone's own share sheet, or copies it where
 * there is none. It goes with this page's address unless given another;
 * `url: null` sends the words alone (a note of the visitor's own). */
export async function share(data: { title?: string; text?: string; url?: string | null } = {}): Promise<'shared' | 'copied' | 'neither'> {
  const url = data.url === null ? null : (data.url ?? pageUrl())
  try {
    if (navigator.share) {
      await navigator.share({ title: data.title, text: data.text, ...(url ? { url } : null) })
      return 'shared'
    }
    await navigator.clipboard.writeText([data.text, url].filter(Boolean).join(' '))
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
  if (!settings.get().haptics) return
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
