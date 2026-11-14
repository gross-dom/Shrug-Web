// VIP: photos and videos from the people who got a drop. The drops are from
// the design canvas; the media has not been supplied, so every tile is a slot.

export const DROPS = ['Deep Tech Mat', 'Atoms x MKBHD', 'Feastables x Shrug', 'Billboards', 'Alt x Shrug', 'VC Sticker Pack', 'Shrug Calendar 2020', 'Shrug Calendar 2021', 'VC Puzzle', 'Acquire x Shrug', 'Demo Day Socks']

export type MediaKind = 'photo' | 'video'

export interface MediaSlot {
  kind: MediaKind
  /** The drop it shows. */
  drop: string
  /** Who sent it. `null` until supplied. */
  from: string | null
  /** The file to show. `null` until supplied. */
  src: string | null
  /** How the tile sits in the grid. */
  span: '' | 'big' | 'tall' | 'wide'
}

const slot = (kind: MediaKind, drop: string, span: MediaSlot['span'] = ''): MediaSlot => ({ kind, drop, from: null, src: null, span })

export const MEDIA: MediaSlot[] = [
  slot('photo', 'Deep Tech Mat', 'big'),
  slot('video', 'Atoms x MKBHD'),
  slot('photo', 'Feastables x Shrug', 'tall'),
  slot('photo', 'Billboards'),
  slot('video', 'Alt x Shrug', 'wide'),
  slot('photo', 'VC Sticker Pack'),
  slot('photo', 'Shrug Calendar 2020', 'tall'),
  slot('photo', 'Shrug Calendar 2021'),
  slot('video', 'VC Puzzle', 'big'),
  slot('photo', 'Acquire x Shrug'),
  slot('photo', 'Demo Day Socks'),
  slot('video', 'Deep Tech Mat', 'wide'),
]
