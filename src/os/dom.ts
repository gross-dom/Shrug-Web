import type { AppId } from './apps'
import type { Point } from './wm'

// Small reads from the page: where a Dock icon is, for windows to open from
// and minimize into.

/** The center of an app's Dock icon; for an app that has none, of its icon on the desk (Wallpapers), or
 * failing that of the menu bar's mark (About Shrug). */
export function dockPoint(id: AppId): Point | null {
  const el = document.querySelector<HTMLElement>(`[data-dock-app="${id}"]`) ?? document.querySelector<HTMLElement>(`[data-desk="${id}"] .desk__icon`) ?? document.querySelector<HTMLElement>('[data-menu-mark]')
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}

export const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
