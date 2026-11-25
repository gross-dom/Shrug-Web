// The chair's other colors: sixteen more, beyond the eight the studio opens on, each made to order. Workspace
// shows them as a grid to pick from (src/apps/Workspace.tsx); the store sells each as a chair of its own
// (in the demo, store/src/demo.ts; for real, a row each in Shrug's Products).
//
// THESE ARE STAND-INS. Shrug's own list (the PDF of available colors) has not reached this code: until it
// does, these are sixteen standard RAL paints under their own names, so that the grid, the studio and the
// checkout can all be used. Put the real names and values here and everything that shows them follows.

export interface MoreColor {
  /** A short name for it in addresses and files: "ultramarine-blue". */
  id: string
  name: string
  /** As a hex color. */
  color: string
}

export const MORE_COLORS: MoreColor[] = [
  { id: 'traffic-yellow', name: 'Traffic Yellow', color: '#f7b500' },
  { id: 'pastel-orange', name: 'Pastel Orange', color: '#f67828' },
  { id: 'flame-red', name: 'Flame Red', color: '#a72920' },
  { id: 'rose', name: 'Rose', color: '#d36e70' },
  { id: 'heather-violet', name: 'Heather Violet', color: '#c4618c' },
  { id: 'signal-violet', name: 'Signal Violet', color: '#844c82' },
  { id: 'ultramarine-blue', name: 'Ultramarine Blue', color: '#00387b' },
  { id: 'sky-blue', name: 'Sky Blue', color: '#007cb0' },
  { id: 'turquoise-blue', name: 'Turquoise Blue', color: '#058b8c' },
  { id: 'pastel-blue', name: 'Pastel Blue', color: '#6093ac' },
  { id: 'emerald-green', name: 'Emerald Green', color: '#366735' },
  { id: 'pastel-green', name: 'Pastel Green', color: '#b9ceac' },
  { id: 'clay-brown', name: 'Clay Brown', color: '#7e4b26' },
  { id: 'anthracite-gray', name: 'Anthracite Gray', color: '#383e42' },
  { id: 'light-gray', name: 'Light Gray', color: '#c5c7c4' },
  { id: 'cream', name: 'Cream', color: '#e9e0d2' },
]
