import { CAPITAL, SHRUG, TALL, WIDE } from '../../store/shared/wordmark'

// Shrug's mark on this site: its wordmark, SHRUG, as the brand kit draws it (store/shared/wordmark.ts). The
// letter s that stood for it before is gone from everywhere it was: the tab's icon, a phone's Home Screen
// icon, the loading screen, Shrug's face in a conversation, About Shrug's icon, the head of the one-pager.
// An official document carries the name in full, SHRUG CAPITAL. It is kept here as plain data so that the
// site (src/os/icons.tsx), the pages the build writes (tools/page.ts) and the pictures made from it
// (tools/icons.cjs, tools/og.cjs) all draw the one shape.

/** SHRUG, and how wide and tall its outline is. */
export const MARK = SHRUG
export const MARK_WIDE = WIDE.shrug
export const MARK_TALL = TALL
/** SHRUG CAPITAL: the name in full, for an official document. */
export const FULL = SHRUG + CAPITAL
export const FULL_WIDE = WIDE.capital

/** How the wordmark sits on a square or round ground 100 units across: across its middle, with air either side. */
export const onGround = (share = 0.72) => {
  const scale = (100 * share) / MARK_WIDE
  return `translate(${(50 - (MARK_WIDE * scale) / 2).toFixed(3)} ${(50 - (MARK_TALL * scale) / 2).toFixed(3)}) scale(${scale.toFixed(5)})`
}

/** The wordmark as markup, so tall, for a page that has no script to draw it: the loading screen, the plain page, the page for an address that is not there. */
export const markSvg = (height: number, ink = 'currentColor') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${MARK_WIDE} ${MARK_TALL}" width="${((MARK_WIDE / MARK_TALL) * height).toFixed(1)}" height="${height}" aria-hidden="true"><path fill="${ink}" d="${MARK}"/></svg>`

/** The wordmark on a square tile, as markup: the tab's icon and a phone's Home Screen icon (tools/icons.cjs). */
export const tileSvg = (ground = '#000', ink = '#fff') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="${ground}"/><path fill="${ink}" transform="${onGround(0.78)}" d="${MARK}"/></svg>`

/** The three letters of VIP, drawn (not set in a typeface, so they are the same on every machine): for a tile 100 units across. */
export const VIP_LETTERS = 'M17.25 35H25.65L30.75 50.3L35.85 35H44.25L34.25 65H27.25ZM48.25 35H56.25V65H48.25ZM61.75 35H73.75a9 9 0 0 1 0 18H69.75V65H61.75ZM69.75 41.6V46.4H73.6a2.4 2.4 0 0 0 0-4.8Z'
