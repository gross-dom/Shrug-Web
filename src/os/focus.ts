import { useLayoutEffect, useRef } from 'react'

// Where the keyboard is, kept sensible as things open and close. Whatever
// opens over the page (a menu, a popover, a sheet, a folder, an app) takes
// the keyboard in; when it closes, the keyboard goes back to what opened it,
// so the next Tab carries on from there and a screen reader has something to
// read. Without this it falls to the page itself, which is nowhere.

// Whose hand is on the page. The site gives the keyboard to things itself (the first thing on the
// Home Screen as the phone opens, a screen that has just been pushed), and a browser draws a ring
// round whatever is given it that way. That ring is for someone using a keyboard: after a touch
// there is nobody to show it to, and a ring round a widget nobody tabbed to is only a mark on the
// screen. The page says which it was last (`data-input` on the root), and the stylesheets leave
// the ring off after a touch (base.css). The next key pressed brings it back.
if (typeof window !== 'undefined') {
  const root = document.documentElement
  window.addEventListener('touchstart', () => root.setAttribute('data-input', 'touch'), { passive: true, capture: true })
  window.addEventListener('keydown', () => root.removeAttribute('data-input'), true)
}

/** Can take the keyboard: on the page, drawn, and not shut off. */
export const takesFocus = (el: Element | null | undefined): el is HTMLElement =>
  el instanceof HTMLElement && el.isConnected && !el.closest('[inert]') && el.getClientRects().length > 0

/** The keyboard is nowhere useful: on the page itself, on something that has gone or been shut off, or inside `closing`. */
export function focusLost(closing?: Element | null) {
  const el = document.activeElement
  return !el || el === document.body || !takesFocus(el) || (!!closing && closing.contains(el))
}

const TABBABLE = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** The first control inside `root` that Tab would stop on. */
export const firstControl = (root: Element | null | undefined) => [...(root?.querySelectorAll<HTMLElement>(TABBABLE) ?? [])].find(takesFocus) ?? null

/** Puts the keyboard on the first of these that can take it. Says whether one did. */
export function focusFirst(...candidates: (Element | null | undefined)[]) {
  for (const el of candidates) {
    if (!takesFocus(el)) continue
    el.focus({ preventScroll: true })
    if (document.activeElement === el) return true
  }
  return false
}

/** Remembers what has the keyboard now. The function it returns gives the keyboard back there, or
 * failing that to the first of `otherwise` that can take it. */
export function holdFocus() {
  const was = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null
  return (...otherwise: (Element | null | undefined)[]) => focusFirst(was, ...otherwise)
}

/** For something that opens and closes (`open`): what had the keyboard when it opened gets it back when
 * it closes, unless the keyboard has already gone somewhere of its own accord (a press on another
 * control). `otherwise` names where it goes if what opened this is no longer there. */
export function useReturnFocus(open: boolean, otherwise?: () => Element | null | undefined) {
  const giveBack = useRef<ReturnType<typeof holdFocus> | null>(null)
  useLayoutEffect(() => {
    if (open) {
      giveBack.current = holdFocus()
      return
    }
    const give = giveBack.current
    giveBack.current = null
    if (!give) return
    // Once what closed has left the page (or been shut off) the keyboard is with nothing: now it can be told
    const frame = requestAnimationFrame(() => {
      if (focusLost()) give(otherwise?.())
    })
    return () => cancelAnimationFrame(frame)
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
}
