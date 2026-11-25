// The apps on the desktop: what each is called, how big its window opens and
// how small it can get. The windows themselves are in src/apps.
//
// Four of them are where things are sold and kept (design/v1, and Dom's notes after testing it): ArtStore,
// Books and Workspace each sell their own things and nothing else, and My VIP is what is a member's (their
// pack and card, points, orders, address). All four show the store's own pages (store/) for what is bought
// or kept, so there is one checkout. An address can ask for each by name: `?open=artstore`, `books`,
// `workspace`, `vip`.

export type AppId = 'messages' | 'notes' | 'terminal' | 'finder' | 'about' | 'wallpapers' | 'updates' | 'store' | 'preview' | 'mail' | 'quicktime' | 'photobooth' | 'spotify' | 'youtube' | 'workspace' | 'books' | 'myvip' | 'weather'

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
  /** For a window that is drawn for one size: it opens at that size or as near as the desk has room for,
   * and is not made shorter to keep clear of what is left out on the desk (wm.ts). On a desk with no clear
   * place as wide as it, it lies over the widget's edge, as a window on a Mac would. */
  whole?: boolean
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
    // (as tall as what is in it, drawn in full: three facts, two rows that open windows, and the one-pager.
    // The steps it takes on a shorter desk are in apps.css, by this height)
    size: () => ({ w: 340, h: 444 }),
    min: { w: 340, h: 444 },
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
    name: 'ArtStore',
    blurb: 'Six pieces, fifty of each',
    size: fit({ w: 0.78, h: 0.95 }, { w: 960, h: 640 }, { w: 1120, h: 720 }),
    min: { w: 960, h: 640 },
    nudge: { x: 0, y: -6 },
    resizable: true,
    lightsY: 30,
    dock: 6,
  },
  // Books: Shrug's five books, after the Mac's own Books: a sidebar and a shelf of covers, and a book's own
  // page, which is the store's (src/apps/Books.tsx). A product's page does not scroll at 1120 by 720, so it
  // opens at the store's size
  books: {
    id: 'books',
    name: 'Books',
    blurb: 'Five books from Shrug',
    size: fit({ w: 0.78, h: 0.95 }, { w: 960, h: 640 }, { w: 1120, h: 720 }),
    min: { w: 960, h: 640 },
    nudge: { x: 12, y: -2 },
    resizable: true,
    lightsY: 26,
    dock: 7,
  },
  // My VIP: what is a member's. Their pack is opened here, and their card, points, orders and address are
  // kept here, with the doors to the three stores (src/apps/MyVip.tsx). Last in the Dock
  myvip: {
    id: 'myvip',
    name: 'My VIP',
    blurb: 'Your card, points and orders',
    size: fit({ w: 0.78, h: 0.95 }, { w: 960, h: 640 }, { w: 1120, h: 720 }),
    min: { w: 960, h: 640 },
    nudge: { x: -12, y: -6 },
    resizable: true,
    lightsY: 30,
    dock: 8,
  },
  // Workspace: the studio (design/v1-workspace). A color picker for the chair with one button: eight slabs,
  // and then the whole window in the color picked, with the chair on a turntable (src/apps/Workspace.tsx).
  // In the Dock between Mail and VIP Store
  workspace: {
    id: 'workspace',
    name: 'Workspace',
    blurb: 'The chair, in every color',
    size: fit({ w: 0.77, h: 0.95 }, { w: 900, h: 620 }, { w: 1100, h: 720 }),
    min: { w: 900, h: 620 },
    nudge: { x: 0, y: -4 },
    resizable: true,
    lightsY: 24,
    dock: 5,
  },
  // Mail: twenty email exchanges that led to something, read-only, in a window driven as Superhuman is
  // (design/v1; src/apps/Mail.tsx). 1180 by 740, at which all twenty are on the screen at once
  mail: {
    id: 'mail',
    name: 'Mail',
    blurb: 'Twenty exchanges that led to something',
    size: fit({ w: 0.82, h: 0.97 }, { w: 860, h: 560 }, { w: 1180, h: 740 }),
    min: { w: 860, h: 560 },
    // (the widest window there is: with the desk's icons down one side and its widget at the other there is
    // no clear place for it on a 1440 screen, and all twenty rows are only on the screen at its full height)
    whole: true,
    nudge: { x: 0, y: -4 },
    resizable: true,
    lightsY: 21,
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
  // QuickTime Player: the old brushed-metal player (design/v1). Its icon is on the desk, and it is in the
  // Dock, after the rule, only while it is open (unless it is dragged in). Its window opens as wide as its
  // picture, and can be made larger: the picture grows with it (src/apps/QuickTime.tsx)
  quicktime: {
    id: 'quicktime',
    name: 'QuickTime Player',
    blurb: 'Films',
    size: () => ({ w: 748, h: 652 }),
    min: { w: 520, h: 470 },
    nudge: { x: 30, y: -10 },
    resizable: true,
    lightsY: 15,
    dock: null,
    guest: 2,
  },
  // Photo Booth, after the Mac's own: the camera, a photo taken through one of nine effects, and the wall
  // of everyone's along its foot (src/apps/PhotoBooth.tsx). On the desk
  photobooth: {
    id: 'photobooth',
    name: 'Photo Booth',
    blurb: 'Take a photo for the wall',
    size: fit({ w: 0.55, h: 0.84 }, { w: 620, h: 540 }, { w: 780, h: 660 }),
    min: { w: 620, h: 540 },
    nudge: { x: -20, y: 0 },
    resizable: true,
    lightsY: 20,
    dock: null,
  },
  // Spotify: the listening room. Podcasts Shrug's network is on, and playlists from the team, played by
  // Spotify's own player (src/apps/Spotify.tsx). On the desk
  spotify: {
    id: 'spotify',
    name: 'Spotify',
    blurb: 'The listening room',
    size: fit({ w: 0.8, h: 0.86 }, { w: 780, h: 520 }, { w: 1180, h: 720 }),
    min: { w: 780, h: 520 },
    nudge: { x: -10, y: 10 },
    resizable: true,
    lightsY: 32,
    dock: null,
  },
  // YouTube: one playlist, videos the team loves, played by YouTube's own player (src/apps/YouTube.tsx). On the desk
  youtube: {
    id: 'youtube',
    name: 'YouTube',
    blurb: 'Videos the team loves',
    size: fit({ w: 0.77, h: 0.85 }, { w: 860, h: 540 }, { w: 1100, h: 664 }),
    min: { w: 860, h: 540 },
    nudge: { x: 10, y: 6 },
    resizable: true,
    lightsY: 28,
    dock: null,
  },
  // Weather, after the Mac's own: the widget on the desk opens it (src/apps/Weather.tsx). Like Preview it
  // has no icon of its own to open from: it is in the Dock, after the rule, while it is open
  weather: {
    id: 'weather',
    name: 'Weather',
    blurb: 'The forecast',
    size: fit({ w: 0.7, h: 0.88 }, { w: 780, h: 540 }, { w: 1040, h: 700 }),
    min: { w: 600, h: 440 },
    nudge: { x: 30, y: 4 },
    resizable: true,
    lightsY: 26,
    dock: null,
    guest: 3,
  },
}

export const APP_IDS = Object.keys(APPS) as AppId[]

export const DOCK_APPS = APP_IDS.filter((id) => APPS[id].dock !== null).sort((a, b) => APPS[a].dock! - APPS[b].dock!)

/** The windows that are the desktop's alone, with nothing of theirs on a phone: an address that names one names nothing there. */
export const DESK_ONLY: AppId[] = ['store', 'preview', 'mail', 'quicktime', 'photobooth', 'spotify', 'youtube', 'workspace', 'books', 'myvip', 'weather']

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
  // (VIP was the store; it is what is a member's now, and the store that was the VIP Store is ArtStore)
  vip: 'myvip',
  'my-vip': 'myvip',
  'vip-store': 'store',
  shop: 'store',
  art: 'store',
  artstore: 'store',
  'art-store': 'store',
  'book-store': 'books',
  bookstore: 'books',
  inbox: 'mail',
  email: 'mail',
  chair: 'workspace',
  film: 'quicktime',
  films: 'quicktime',
  'photo-booth': 'photobooth',
  podcasts: 'spotify',
  videos: 'youtube',
  forecast: 'weather',
  // (the one-pager is a file that opens in Preview: asked for by its own name, that is what opens, on it)
  'one-pager': 'preview',
  onepager: 'preview',
}
