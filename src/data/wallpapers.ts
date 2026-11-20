// The desktop's wallpapers, as tools/wallpaper.cjs made them: the picture the desk shows, the same small for
// the Wallpapers window's grid, and large to download (its size in pixels and in bytes). Each visit shows
// the next of them (src/os/wallpaper.ts). Written by that tool: run it again when a colourway is added or
// changed. (It writes the same pictures, in the same order, into the script at the head of index.html.)

export interface Wallpaper {
  id: string
  name: string
  src: string
  small: string
  full: string
  width: number
  height: number
  bytes: number
}

export const WALLPAPERS: Wallpaper[] = [
  { id: 'indigo', name: 'Indigo', src: '/wallpaper.webp', small: '/wallpapers/indigo-small.webp', full: '/wallpapers/shrug-indigo.jpg', width: 3840, height: 2160, bytes: 1425112 },
  { id: 'dusk', name: 'Dusk', src: '/wallpapers/dusk.webp', small: '/wallpapers/dusk-small.webp', full: '/wallpapers/shrug-dusk.jpg', width: 3840, height: 2160, bytes: 1429478 },
  { id: 'ember', name: 'Ember', src: '/wallpapers/ember.webp', small: '/wallpapers/ember-small.webp', full: '/wallpapers/shrug-ember.jpg', width: 3840, height: 2160, bytes: 1431725 },
  { id: 'lagoon', name: 'Lagoon', src: '/wallpapers/lagoon.webp', small: '/wallpapers/lagoon-small.webp', full: '/wallpapers/shrug-lagoon.jpg', width: 3840, height: 2160, bytes: 1428046 },
  { id: 'graphite', name: 'Graphite', src: '/wallpapers/graphite.webp', small: '/wallpapers/graphite-small.webp', full: '/wallpapers/shrug-graphite.jpg', width: 3840, height: 2160, bytes: 1420964 },
]
