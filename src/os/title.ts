import { SITE } from '../data/site'

// The page's title names the place: the window in front on the desktop, the
// screen an iPhone is on. A screen reader reads it on arrival, a tab shows it,
// and each step in the browser's history is listed under the title it had.

/** What the page is called with nowhere in particular showing: the bare desk, the Lock Screen. */
export const HOME_TITLE = `${SITE.name} ${SITE.mark}`

/** Names the place, innermost first: `setTitle('Shrug Family', 'Messages')` is "Shrug Family · Messages · Shrug". With nothing, the site's own title. */
export function setTitle(...place: (string | null | undefined | false)[]) {
  const parts = place.filter((part): part is string => !!part)
  const title = parts.length ? [...parts, SITE.name].join(' · ') : HOME_TITLE
  if (document.title !== title) document.title = title
}
