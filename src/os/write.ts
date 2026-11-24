import { launchApp } from './launch'
import { createStore } from './store'

// Writing to Shrug. Nothing on the desktop sends mail of its own: a reply in Mail, and Message Shrug in a
// locked folder, open a message to Shrug in Messages (design/v1, "Group Chat: write to Shrug"), where the
// pencil starts one too. The message's only recipient is Shrug, and a subject is picked first.

/** What the message is about, where the place it was started from says so: Mail gives the subject it replies to. */
export interface About {
  subject?: string
}

/** Whether Messages is showing the message to Shrug, in its conversation's place, and what it was started about. */
export const writing = createStore<{ on: boolean; about: About | null }>({ on: false, about: null })

/** Opens Messages, to write to Shrug. (On a phone Messages has a compose button of its own, and is what opens.) */
export function writeToShrug(about?: About) {
  writing.set({ on: true, about: about ?? null })
  launchApp('messages')
}

export const stopWriting = () => writing.set((s) => (s.on ? { on: false, about: s.about } : s))
