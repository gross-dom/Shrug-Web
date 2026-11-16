// What a phone can do that a desktop can't: the share sheet, and a tick under
// the finger. Each does nothing where it isn't there.

import { SITE } from '../data/site'

/** The address to pass on: this page's, or the site's where the page has none of its own (a preview opened from a file). */
export const pageUrl = () => (/^https?:$/.test(location.protocol) ? `${location.origin}${location.pathname}` : SITE.url)

/** Sends something on through the phone's own share sheet, or copies the address where there is none. */
export async function share(data: { title?: string; text?: string; url?: string } = {}): Promise<'shared' | 'copied' | 'neither'> {
  const url = data.url ?? pageUrl()
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
