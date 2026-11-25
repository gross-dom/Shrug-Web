import { createStore } from './store'

// The desk's appearance: light or dark, as a Mac has it. It is chosen in the sheet at the menu bar's right
// (and in the Shrug menu), and kept in this browser. What follows it: the menus, the sheets and the
// notifications the desk lets down, the Dock's menu, and the windows that are a Mac's own (Messages, Notes,
// Portfolio, About, Wallpapers, Updates, Preview). The windows that are something else's keep that thing's
// look whichever it is: Spotify and Photo Booth are dark, the old QuickTime is brushed metal, Mail is
// Superhuman's white, the stores are Shrug's black.
//
// Only the desktop has it: a phone's screen is drawn after iOS, in its own tones.

export type Theme = 'light' | 'dark'
const KEPT = 'shrug:appearance.v1'

function kept(): Theme {
  try {
    return window.localStorage.getItem(KEPT) === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

export const theme = createStore<{ is: Theme }>({ is: typeof window === 'undefined' ? 'light' : kept() })

export function setTheme(is: Theme) {
  theme.set({ is })
  try {
    window.localStorage.setItem(KEPT, is)
  } catch {
    // No storage: it is as chosen for as long as the page is open
  }
}
