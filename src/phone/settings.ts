import { askedIdle } from '../os/saver'
import { createStore } from '../os/store'

// What Settings on the phone can change. The rest of the phone reads it here.
// A choice made in Settings is kept in the browser, so that it is still made
// on the next visit: someone who set Auto-Lock to Never because the phone kept
// locking under them does not have to do it again every time.

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

/** What Auto-Lock offers, as iOS offers it. */
export const AUTO_LOCK: (number | null)[] = [30, 60, 120, 180, 240, 300, null]

/** How iOS words an Auto-Lock time: "30 seconds", "2 minutes", "Never". */
export function autoLockLabel(seconds: number | null) {
  if (seconds === null) return 'Never'
  if (seconds < 60 || seconds % 60) return `${seconds} seconds`
  return seconds === 60 ? '1 minute' : `${seconds / 60} minutes`
}

const DEFAULTS: PhoneSettings = { notifications: true, previews: true, autoLock: 120, haptics: true }

// ---- Kept between visits ----

/** Where the choices are kept. Only what a visitor has changed is written: the rest stays the site's to set. */
const KEPT = 'shrug:settings'

/** What was kept, as far as it can still be believed: a value of the wrong kind is as good as none.
 * A browser that will not give the page its storage (a private window, a frame without the right) keeps
 * nothing, and the settings last as long as the page does. */
function kept(): Partial<PhoneSettings> {
  try {
    const found: unknown = JSON.parse(window.localStorage.getItem(KEPT) ?? 'null')
    if (!found || typeof found !== 'object') return {}
    const was = found as Record<string, unknown>
    const out: Partial<PhoneSettings> = {}
    for (const key of ['notifications', 'previews', 'haptics'] as const) if (typeof was[key] === 'boolean') out[key] = was[key]
    if (AUTO_LOCK.includes(was.autoLock as number | null) && 'autoLock' in was) out.autoLock = was.autoLock as number | null
    return out
  } catch {
    return {}
  }
}

function keep<K extends keyof PhoneSettings>(key: K, value: PhoneSettings[K]) {
  try {
    window.localStorage.setItem(KEPT, JSON.stringify({ ...kept(), [key]: value }))
  } catch {
    // Nowhere to keep it: it holds for this visit
  }
}

// `?idle=20` in the address is for trying Auto-Lock out: it wins over what was kept for as long as it is there, and is not itself kept
export const settings = createStore<PhoneSettings>({ ...DEFAULTS, ...(typeof window === 'undefined' ? {} : kept()), ...(askedIdle() === null ? {} : { autoLock: askedIdle() }) })

export function setSetting<K extends keyof PhoneSettings>(key: K, value: PhoneSettings[K]) {
  if (settings.get()[key] === value) return
  settings.set((s) => ({ ...s, [key]: value }))
  keep(key, value)
}
