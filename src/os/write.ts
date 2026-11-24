import { launchApp } from './launch'

// Writing to Shrug. Nothing on the desktop sends mail of its own: a reply in Mail, and Message Shrug in a
// locked folder, open a message to Shrug in Messages (design/v1, "Group Chat: write to Shrug").

/** What the message is about, where the place it was started from says so: Mail gives the subject it replies to. */
export interface About {
  subject?: string
}

/** Opens Messages, to write to Shrug. */
export function writeToShrug(_about?: About) {
  launchApp('messages')
}
