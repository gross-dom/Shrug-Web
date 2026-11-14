// The apps on the desktop: what each is called, how big its window opens and
// how small it can get. The windows themselves are in src/apps.

export type AppId = 'messages' | 'notes' | 'terminal' | 'finder' | 'photos' | 'about'

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
  /** Where it opens, as an offset from centered. */
  nudge: { x: number; y: number }
  resizable: boolean
  /** How far the traffic lights' centers sit from the window's top and left
   * edges: 19 for the kit's 38px bar, 26 for its tall icon-and-label toolbar. */
  lightsY: 19 | 26
  /** In the Dock, in this order. */
  dock: number | null
}

const fit = (w: number, h: number) => (room: Size) => ({
  w: Math.round(Math.min(w, room.w - 48)),
  h: Math.round(Math.min(h, room.h - 40)),
})

export const APPS: Record<AppId, AppSpec> = {
  finder: {
    id: 'finder',
    name: 'Portfolio',
    blurb: 'Every company, by vertical',
    size: fit(900, 580),
    min: { w: 420, h: 320 },
    nudge: { x: -70, y: -6 },
    resizable: true,
    lightsY: 26,
    dock: 0,
  },
  messages: {
    id: 'messages',
    name: 'Group chat',
    blurb: 'What people say',
    size: fit(1000, 660),
    min: { w: 380, h: 360 },
    nudge: { x: 0, y: -4 },
    resizable: true,
    lightsY: 26,
    dock: 1,
  },
  notes: {
    id: 'notes',
    name: 'FAQs',
    blurb: 'Questions, answered',
    size: fit(780, 520),
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
    size: fit(680, 430),
    min: { w: 360, h: 240 },
    nudge: { x: -120, y: 40 },
    resizable: true,
    lightsY: 19,
    dock: 3,
  },
  photos: {
    id: 'photos',
    name: 'VIP',
    blurb: 'When the drops landed',
    size: fit(940, 620),
    min: { w: 420, h: 340 },
    nudge: { x: 50, y: -16 },
    resizable: true,
    lightsY: 26,
    dock: 4,
  },
  about: {
    id: 'about',
    name: 'About Shrug',
    blurb: 'About Shrug',
    size: () => ({ w: 300, h: 432 }),
    min: { w: 300, h: 432 },
    nudge: { x: 0, y: -30 },
    resizable: false,
    lightsY: 19,
    dock: null,
  },
}

export const APP_IDS = Object.keys(APPS) as AppId[]

export const DOCK_APPS = APP_IDS.filter((id) => APPS[id].dock !== null).sort((a, b) => APPS[a].dock! - APPS[b].dock!)
