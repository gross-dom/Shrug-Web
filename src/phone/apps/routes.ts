import type { Conversation } from '../../apps/state'

// The names of the screens inside each app, as they are kept in the app's
// stack (`sys.stacks`). They are written here so that what opens an app at a
// place (a notification, a widget, search) and the app itself agree on them.

/** Messages: a conversation. `c:group` is Shrug Family; `c:12` is the thirteenth person's own. */
export const conversationView = (conversation: Conversation) => `c:${conversation}`
export const GROUP_VIEW = conversationView('group')

/** Files: a folder (`f:all` is Portfolio, every company; `f:2` is what one vertical is tagged on). */
export const folderView = (vertical: number | 'all') => `f:${vertical}`
/** The folder Files opens in: Portfolio. */
export const PORTFOLIO_FOLDER = folderView('all')
/** Files: a company, looked at over whatever folder is showing. A sheet (`sys.sheet`), not a screen. */
export const companySheet = (name: string) => `company:${name}`

/** Notes: the folder the questions are kept in, and one of them as a note inside it (`['f:faqs', 'n:3']`). */
export const FAQS_FOLDER = 'f:faqs'
export const noteView = (index: number) => `n:${index}`

/** VIP: one drop's album, and one photo or video in the viewer. */
export const albumView = (drop: string) => `a:${drop}`
export const mediaView = (index: number) => `m:${index}`
