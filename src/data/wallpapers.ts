// The desktop's wallpapers, as tools/wallpaper.cjs made them: the picture the desk shows, the same small for
// the Wallpapers window's grid, and large to download (its size in pixels and in bytes). `sky` is the
// drawing's sky from its top to its foot, for the moment before a picture has arrived. Written by that tool:
// run it again when a colourway is added or changed.

export interface Wallpaper {
  id: string
  name: string
  src: string
  small: string
  full: string
  width: number
  height: number
  bytes: number
  sky: string[]
}

export const WALLPAPERS: Wallpaper[] = [
  { id: 'indigo', name: 'Indigo', src: '/wallpaper.webp', small: '/wallpapers/indigo-small.webp', full: '/wallpapers/shrug-indigo.jpg', width: 3840, height: 2160, bytes: 1425112, sky: ['#03041c', '#0c1254', '#1c3296'] },
  { id: 'dusk', name: 'Dusk', src: '/wallpapers/dusk.webp', small: '/wallpapers/dusk-small.webp', full: '/wallpapers/shrug-dusk.jpg', width: 3840, height: 2160, bytes: 1429478, sky: ['#140617', '#3a1646', '#622c7e'] },
  { id: 'ember', name: 'Ember', src: '/wallpapers/ember.webp', small: '/wallpapers/ember-small.webp', full: '/wallpapers/shrug-ember.jpg', width: 3840, height: 2160, bytes: 1431725, sky: ['#1a0d04', '#4d270f', '#8a3f21'] },
  { id: 'lagoon', name: 'Lagoon', src: '/wallpapers/lagoon.webp', small: '/wallpapers/lagoon-small.webp', full: '/wallpapers/shrug-lagoon.jpg', width: 3840, height: 2160, bytes: 1428046, sky: ['#041919', '#0f4b48', '#218677'] },
  { id: 'graphite', name: 'Graphite', src: '/wallpapers/graphite.webp', small: '/wallpapers/graphite-small.webp', full: '/wallpapers/shrug-graphite.jpg', width: 3840, height: 2160, bytes: 1420964, sky: ['#0d0d0f', '#29292f', '#4c4e57'] },
]
