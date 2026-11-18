import { askedIdle } from '../os/saver'
import { createStore } from '../os/store'

// How the phone behaves where an iPhone would ask its owner. The phone has no
// Settings app to ask in, so these are the site's own choices; the rest of the
// phone reads them here.

export interface PhoneSettings {
  /** Replies are announced: as banners while another app is showing, and on the Lock Screen. */
  notifications: boolean
  /** A notification shows what the reply says. Off, it says only who it is from. */
  previews: boolean
  /** Seconds left alone before the phone locks itself. null is Never. */
  autoLock: number | null
  /** The tick under the finger when something is picked up or put down. */
  haptics: boolean
}

const DEFAULTS: PhoneSettings = { notifications: true, previews: true, autoLock: 120, haptics: true }

// `?idle=20` in the address is for trying Auto-Lock out: it holds for as long as it is there
export const settings = createStore<PhoneSettings>({ ...DEFAULTS, ...(askedIdle() === null ? {} : { autoLock: askedIdle() }) })
