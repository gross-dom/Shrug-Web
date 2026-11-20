// VIP: photos from the people who got a drop, as they posted them. The pictures are Shrug's own
// (public/vip, kept at the size they are shown at), each filed under the drop it is of; they are set
// out a drop at a time in turn, so that no one drop fills the head of the grid. A slot with no file is
// still drawn (a quiet tile with the drop's name on it), but it is never counted: a count a visitor
// reads is of what has arrived.

export const DROPS = ['Atoms x MKBHD', 'Deep Tech Mat', 'Feastables x Shrug', 'Billboards', 'Alt x Shrug', 'Shrug Calendar', 'VC Puzzle', 'VC Sticker Pack', 'Other Drops']

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

const photo = (drop: string, file: string, span: MediaSlot['span'] = ''): MediaSlot => ({ kind: 'photo', drop, from: null, src: `/vip/${file}`, span })

export const MEDIA: MediaSlot[] = [
  photo('Atoms x MKBHD', 'atoms-x-mkbhd.webp', 'big'),
  photo('Deep Tech Mat', 'deep-tech-mat.webp'),
  photo('Feastables x Shrug', 'feastables-1.webp'),
  photo('Billboards', 'billboard-1.webp'),
  photo('Alt x Shrug', 'alt-1.webp'),
  photo('Shrug Calendar', 'shrug-cal-1.webp'),
  photo('VC Puzzle', 'shrug-cal-9.webp'),
  photo('VC Sticker Pack', 'others-3.webp'),
  photo('Other Drops', 'others-1.webp'),
  photo('Atoms x MKBHD', 'atoms-1.webp'),
  photo('Feastables x Shrug', 'feastables-2.webp'),
  photo('Billboards', 'billboard-2.webp'),
  photo('Alt x Shrug', 'alt-2.webp'),
  photo('Shrug Calendar', 'shrug-cal-2.webp'),
  photo('VC Puzzle', 'shrug-cal-10.webp'),
  photo('Other Drops', 'others-2.webp'),
  photo('Atoms x MKBHD', 'atoms-2.webp'),
  photo('Feastables x Shrug', 'feastables-3.webp'),
  photo('Billboards', 'billboard-3.webp'),
  photo('Alt x Shrug', 'alt-3.webp'),
  photo('Shrug Calendar', 'shrug-cal-3.webp'),
  photo('VC Puzzle', 'shrug-cal-11.webp'),
  photo('Atoms x MKBHD', 'atoms-3.webp'),
  photo('Feastables x Shrug', 'feastables-4.webp'),
  photo('Billboards', 'billboard-4.webp'),
  photo('Shrug Calendar', 'shrug-cal-4.webp'),
  photo('Atoms x MKBHD', 'atoms-4.webp'),
  photo('Billboards', 'billboard-5.webp'),
  photo('Shrug Calendar', 'shrug-cal-5.webp'),
  photo('Atoms x MKBHD', 'atoms-5.webp'),
  photo('Shrug Calendar', 'shrug-cal-6.webp'),
  photo('Shrug Calendar', 'shrug-cal-7.webp'),
  photo('Shrug Calendar', 'shrug-cal-8.webp'),
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
