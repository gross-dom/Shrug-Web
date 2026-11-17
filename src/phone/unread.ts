// What is new on the phone: the replies that have come in to Shrug Family and
// not been seen there yet. The badge on Messages counts them, so it starts at
// nothing, ticks up as replies arrive, and is cleared by having the
// conversation on screen, as a badge is on an iPhone. The other conversations
// in the app are old ones, read long ago, and never count.
//
// It is the same count the desktop's Dock keeps (src/apps/state.ts): whatever
// shows the group says so with `seeGroup` as each reply lands.

export { useNewReplies as useNewCount } from '../apps/state'
