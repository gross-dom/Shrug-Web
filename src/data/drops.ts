// VIP: photos and videos from the people who got a drop. The drops are from
// the design canvas; the media has not been supplied, so every tile is a slot.
// A slot with no file is still drawn (a quiet tile with the drop's name on
// it, or, with `?draft` in the address, the note that says what is missing),
// but it is never counted: a count a visitor reads is of what has arrived.

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

/** A drop's own colour: what its tiles are drawn in until their pictures arrive, so that a drop looks
 * the same wherever it turns up and a grid of them does not read as a gray wall. */
const HUES = ['#3f8cff', '#8a6dff', '#ff66b8', '#ffa63d', '#2bbfa4', '#ff5a3c', '#2b55cf', '#3fb8e0']
export const hueOf = (drop: string) => HUES[Math.max(0, DROPS.indexOf(drop)) % HUES.length]!

/** The slot has its photo or video. */
export const hasFile = (slot: MediaSlot) => !!slot.src

/** How many photos and videos have arrived: all of them, or those of one kind, or from one drop
 * (`arrived('photo')`, `arrived(undefined, 'Billboards')`). Every count a visitor is shown is one of these. */
export const arrived = (kind?: MediaKind, drop?: string) => MEDIA.filter((slot) => hasFile(slot) && (!kind || slot.kind === kind) && (!drop || slot.drop === drop)).length
