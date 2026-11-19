import type { Conversation } from '../../apps/state'
import { COMPANIES } from '../../data/portfolio'

// The names of the screens inside each app, as they are kept in the app's
// stack (`sys.stacks`). They are written here so that what opens an app at a
// place (a notification, a widget, search) and the app itself agree on them.

/** Messages: a conversation. `c:group` is the group chat (Testimonials); `c:drops` is one of the others, by its id. */
export const conversationView = (conversation: Conversation) => `c:${conversation}`
export const GROUP_VIEW = conversationView('group')

/** Contacts: a company's card, pushed over the list of them (`co:Varda`). It is named by the company's
 * key: its name, for all but the one that shares a name (`co:Atoms (atoms.co)`). */
export const companyView = (key: string) => `co:${key}`

/** The company whose card a screen of Contacts is, by its key; null where it is no company's (or none that is there). */
export function companyOf(view: string | null | undefined) {
  const key = view?.startsWith('co:') ? view.slice(3) : null
  return key && COMPANIES.some((company) => company.key === key) ? key : null
}

/** Contacts: Shrug's own card, where an iPhone keeps My Card. */
export const MY_CARD = 'me'

/** The screens Contacts is on for a company that is come to from outside the app (search, the Home
 * Screen's folder, a link, the desktop's window): its card, over the list, so that Back leads to the
 * company among its own. For no company, the list by itself, which is how the app opens. */
export function contactsFor(key: string | null): string[] {
  return key && COMPANIES.some((company) => company.key === key) ? [companyView(key)] : []
}

/** Notes: the folder the questions are kept in, and one of them as a note inside it (`['f:faqs', 'n:3']`). */
export const FAQS_FOLDER = 'f:faqs'
export const noteView = (index: number) => `n:${index}`

/** VIP: one photo or video in the viewer, by its place in the library. With no such screen, the library itself. */
export const mediaView = (index: number) => `m:${index}`
