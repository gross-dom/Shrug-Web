import type { Conversation } from '../../apps/state'
import { COMPANIES, VERTICALS } from '../../data/portfolio'

// The names of the screens inside each app, as they are kept in the app's
// stack (`sys.stacks`). They are written here so that what opens an app at a
// place (a notification, a widget, search) and the app itself agree on them.

/** Messages: a conversation. `c:group` is the group chat (Testimonials); `c:drops` is one of the others, by its id. */
export const conversationView = (conversation: Conversation) => `c:${conversation}`
export const GROUP_VIEW = conversationView('group')

/** Wallet: one vertical's card, out of the stack with its companies showing (`v:2`: the third vertical).
 * With no such screen the cards are all in their stack, which is how the app opens. */
export const cardView = (vertical: number) => `v:${vertical}`

/** The vertical whose card a screen of the Wallet names, by its place in the list; null where it names none. */
export function cardOf(view: string | null | undefined) {
  const named = view ? /^v:(\d+)$/.exec(view) : null
  const vertical = named ? Number(named[1]) : -1
  return vertical >= 0 && vertical < VERTICALS.length ? vertical : null
}

/** Wallet: a company, looked at over whatever the cards are doing. A sheet (`sys.sheet`), not a screen.
 * It is named by the company's key: its name, for all but the one that shares a name (`company:Anduril`). */
export const companySheet = (key: string) => `company:${key}`

/** The Wallet's screens for a company that is come to from outside the app (search, the Home Screen's
 * folder, a link, the desktop's window): its vertical's card is out of the stack, so that the company
 * is found among its own once its sheet is put away. For no company, the stack as it is at first. */
export function cardsFor(key: string | null): string[] {
  const company = key ? COMPANIES.find((c) => c.key === key) : null
  const vertical = company ? VERTICALS.findIndex((v) => v.name === company.vertical) : -1
  return vertical >= 0 ? [cardView(vertical)] : []
}

/** Notes: the folder the questions are kept in, and one of them as a note inside it (`['f:faqs', 'n:3']`). */
export const FAQS_FOLDER = 'f:faqs'
export const noteView = (index: number) => `n:${index}`

/** VIP: one photo or video in the viewer, by its place in the library. With no such screen, the library itself. */
export const mediaView = (index: number) => `m:${index}`
