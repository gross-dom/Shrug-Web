import { chat } from '../apps/chat'
import { inbox } from '../apps/state'
import { createStore, useStore } from '../os/store'

// What is new on the phone. A reply is new from the moment it comes in until
// it has been seen: in Shrug Family, where every reply lands, or in that
// person's own conversation. The badge on Messages counts the new ones, so it
// starts at nothing, ticks up as replies arrive, and is cleared by reading the
// conversation, as a badge is on an iPhone.

/** How many replies had come in when Shrug Family was last on screen. */
export const seen = createStore({ group: 0 })

// Played again from the start, nothing has been seen
chat.subscribe(() => {
  const replied = chat.get().replied
  if (replied < seen.get().group) seen.set({ group: replied })
})

/** Whether one person's reply has come in and not been seen yet. */
export const isNew = (index: number, replied: number, seenTo: number, read: number[]) => index >= seenTo && index < replied && !read.includes(index)

/** How many replies are new: what the badge on Messages says. */
export function useNewCount() {
  const replied = useStore(chat, (s) => s.replied)
  const seenTo = useStore(seen, (s) => s.group)
  const read = useStore(inbox, (s) => s.read)
  let count = 0
  for (let i = seenTo; i < replied; i++) if (!read.includes(i)) count++
  return count
}
