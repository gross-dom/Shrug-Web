import { askedIdle } from '../os/saver'
import { createStore } from '../os/store'

// What Settings on the phone can change. The rest of the phone reads it here.
// It lasts as long as the page does: nothing is stored.

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

export const settings = createStore<PhoneSettings>({ notifications: true, previews: true, autoLock: askedIdle() ?? 120, haptics: true })

export const setSetting = <K extends keyof PhoneSettings>(key: K, value: PhoneSettings[K]) => settings.set((s) => (s[key] === value ? s : { ...s, [key]: value }))
