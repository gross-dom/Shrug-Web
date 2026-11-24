// The apps on the desktop: what each is called, how big its window opens and
// how small it can get. The windows themselves are in src/apps.
//
// The VIP Store is one of them (design/v1): the store's own pages, in a window, last in the Dock. (It was a
// link to the points site, which opened in a tab of its own.) An address can ask for it by name: `?open=vip`.

import { EXCHANGES } from '../data/mail'
import { TEMPLATED } from '../data/site'

export type AppId = 'messages' | 'notes' | 'terminal' | 'finder' | 'about' | 'wallpapers' | 'updates' | 'store' | 'preview' | 'mail'

export interface Size {
  w: number
  h: number
}

export interface AppSpec {
  id: AppId
  /** The name in the menu bar, the Dock and the window's label. */
  name: string
  /** One line for the Dock's label and assistive tech. */
  blurb: string
  /** The size the window opens at, given the room on the desktop. */
  size: (room: Size) => Size
  min: Size
  /** For a window that would sooner open narrower than lie on the desk's
   * icons: the least width it will open at beside them, on a desk too narrow
   * for its size there and too short to have it under them (wm.ts). Without
   * one a window opens at its size, on the icons if that is where it falls. */
  slim?: number
  /** Where it opens, as an offset from centered. */
  nudge: { x: number; y: number }
  resizable: boolean
  /** How far the traffic lights' centers sit from the window's top and left
   * edges: 19 for the kit's 38px bar, 26 for its tall icon-and-label toolbar,
   * 30 for the store's 60px bar, which they sit in the middle of. A window with a bar of its own height
   * says where its middle is. */
  lightsY: number
  /** In the Dock, in this order. */
  dock: number | null
  /** In the Dock only while it has something open, after the rule at the end of the apps, in this order
   * (Preview: it is there when a document is, and not before). */
  guest?: number
}

/** A share of the desktop, kept between a smallest and a largest size. */
const fit = (share: Size, least: Size, most: Size) => (room: Size) => ({
  w: Math.round(Math.min(room.w - 48, most.w, Math.max(least.w, room.w * share.w))),
  h: Math.round(Math.min(room.h - 40, most.h, Math.max(least.h, room.h * share.h))),
})

export const APPS: Record<AppId, AppSpec> = {
  finder: {
    id: 'finder',
    name: 'Portfolio',
    blurb: 'Every company, by vertical',
    size: fit({ w: 0.62, h: 0.74 }, { w: 760, h: 500 }, { w: 1060, h: 700 }),
    min: { w: 420, h: 320 },
    nudge: { x: -70, y: -6 },
    resizable: true,
    lightsY: 26,
    dock: 0,
  },
  messages: {
    id: 'messages',
    name: 'Group Chat',
    blurb: 'What people say',
    size: fit({ w: 0.7, h: 0.84 }, { w: 820, h: 560 }, { w: 1180, h: 800 }),
    min: { w: 380, h: 360 },
    // It opens by itself as the visit begins, and on a small screen its 820
    // would cover the desk's icons before anyone had seen them. It keeps its
    // list beside the conversation down to 560 across (styles/apps.css)
    slim: 560,
    nudge: { x: 0, y: -4 },
    resizable: true,
    lightsY: 26,
    dock: 1,
  },
  notes: {
    id: 'notes',
    name: 'FAQs',
    blurb: 'Questions about Shrug',
    size: fit({ w: 0.54, h: 0.66 }, { w: 700, h: 460 }, { w: 900, h: 620 }),
    min: { w: 400, h: 320 },
    nudge: { x: 90, y: 18 },
    resizable: true,
    lightsY: 26,
    dock: 2,
  },
  terminal: {
    id: 'terminal',
    name: 'Case Studies',
    blurb: 'Private. Ask nicely.',
    size: fit({ w: 0.47, h: 0.55 }, { w: 620, h: 400 }, { w: 800, h: 520 }),
    min: { w: 360, h: 240 },
    nudge: { x: -120, y: 40 },
    resizable: true,
    lightsY: 19,
    dock: 3,
  },
  about: {
    id: 'about',
    name: 'About Shrug',
    blurb: 'About Shrug',
    size: () => ({ w: 340, h: 560 }),
    min: { w: 340, h: 560 },
    nudge: { x: 0, y: -30 },
    resizable: false,
    lightsY: 19,
    dock: null,
  },
  // The VIP Store: the store's own pages (store/), in a window whose bar is the store's bar. 1120 by 720,
  // at which a product does not scroll, and no smaller than 960 by 640 (src/apps/Store.tsx). It takes nearly
  // all the desk's height, so that a 1440 by 900 screen, the one it was drawn on, has it at its full size
  store: {
    id: 'store',
    name: 'VIP Store',
    blurb: 'Points, and what they buy',
    size: fit({ w: 0.78, h: 0.95 }, { w: 960, h: 640 }, { w: 1120, h: 720 }),
    min: { w: 960, h: 640 },
    nudge: { x: 0, y: -6 },
    resizable: true,
    lightsY: 30,
    dock: 6,
  },
  // Mail: twenty email exchanges that led to something, read-only, in a window driven as Superhuman is
  // (design/v1; src/apps/Mail.tsx). 1180 by 740, at which all twenty are on the screen at once
  mail: {
    id: 'mail',
    name: 'Mail',
    blurb: 'Twenty exchanges that led to something',
    size: fit({ w: 0.82, h: 0.97 }, { w: 860, h: 560 }, { w: 1180, h: 740 }),
    min: { w: 860, h: 560 },
    nudge: { x: 0, y: -4 },
    resizable: true,
    lightsY: 25,
    dock: 4,
  },
  // The desk's wallpapers, to look at, to keep on the desk and to download. It is a folder on the desk, not
  // an app in the Dock: only the desktop has it (a phone has a wallpaper of its own)
  wallpapers: {
    id: 'wallpapers',
    name: 'Wallpapers',
    blurb: 'The desktop’s wallpapers',
    size: fit({ w: 0.56, h: 0.68 }, { w: 720, h: 480 }, { w: 980, h: 660 }),
    min: { w: 420, h: 340 },
    nudge: { x: 30, y: 10 },
    resizable: true,
    lightsY: 26,
    dock: null,
  },
  // The Updates folder: documents for Shrug's LPs. It is always on the desk, with a lock: nobody but an LP
  // sees what is inside, not even the names of the files, and what an LP sees is theirs alone (os/account.ts).
  // Opened by someone who is not logged in, it lets down Log In instead (Surface.tsx)
  updates: {
    id: 'updates',
    name: 'Updates',
    blurb: 'For Shrug’s LPs',
    size: fit({ w: 0.53, h: 0.72 }, { w: 620, h: 440 }, { w: 760, h: 540 }),
    min: { w: 520, h: 360 },
    nudge: { x: 60, y: 24 },
    resizable: true,
    lightsY: 26,
    dock: null,
  },
  // Preview: the one viewer every document opens in (design/v1), after the Mac's own. The one-pager, which
  // is a file on the desk, and an LP's documents from Updates. It has no icon in the Dock until a document
  // is open; while one is, it is there after the Dock's rule (src/apps/Preview.tsx)
  preview: {
    id: 'preview',
    name: 'Preview',
    blurb: 'Documents',
    size: fit({ w: 0.7, h: 0.95 }, { w: 720, h: 560 }, { w: 980, h: 720 }),
    min: { w: 560, h: 420 },
    nudge: { x: -40, y: -6 },
    resizable: true,
    lightsY: 26,
    dock: null,
    guest: 1,
  },
}

export const APP_IDS = Object.keys(APPS) as AppId[]

/** An app whose rows are all still templated is left out of the live site until they are supplied
 * (data/site.ts, TEMPLATED): it is in the demo, and in the editor's view. */
const HELD: Partial<Record<AppId, boolean>> = { mail: !TEMPLATED && EXCHANGES.every((exchange) => exchange.from.startsWith('[')) }

export const DOCK_APPS = APP_IDS.filter((id) => APPS[id].dock !== null && !HELD[id]).sort((a, b) => APPS[a].dock! - APPS[b].dock!)

/** The apps that are in the Dock only while they have something open, after its rule. */
export const GUEST_APPS = APP_IDS.filter((id) => APPS[id].guest !== undefined).sort((a, b) => APPS[a].guest! - APPS[b].guest!)

/** The names an address can ask for besides the apps' own: `?open=portfolio,faqs` opens those, and
 * `/portfolio` (an address the site does not have) is sent to `?open=portfolio` (tools/page.ts). */
export const ALIASES: Record<string, AppId> = {
  chat: 'messages',
  'group-chat': 'messages',
  portfolio: 'finder',
  contacts: 'finder',
  wallet: 'finder',
  files: 'finder',
  settings: 'about',
  faqs: 'notes',
  faq: 'notes',
  'case-studies': 'terminal',
  vip: 'store',
  'vip-store': 'store',
  shop: 'store',
  inbox: 'mail',
  email: 'mail',
  // (the one-pager is a file that opens in Preview: asked for by its own name, that is what opens, on it)
  'one-pager': 'preview',
  onepager: 'preview',
}
