import type { Conversation } from '../../apps/state'

// The names of the screens inside each app, as they are kept in the app's
// stack (`sys.stacks`). They are written here so that what opens an app at a
// place (a notification, a widget, search) and the app itself agree on them.

/** Messages: a conversation. `c:group` is Shrug Family; `c:12` is the thirteenth person's own. */
export const conversationView = (conversation: Conversation) => `c:${conversation}`
export const GROUP_VIEW = conversationView('group')

/** Portfolio: a vertical's folder (`f:all`, `f:2`), and a company inside it (`c:Anduril`). */
export const folderView = (vertical: number | 'all') => `f:${vertical}`
export const companyView = (name: string) => `c:${name}`

/** FAQs: one note. */
export const noteView = (index: number) => `n:${index}`

/** VIP: one drop's album, and one photo or video in the viewer. */
export const albumView = (drop: string) => `a:${drop}`
export const mediaView = (index: number) => `m:${index}`
