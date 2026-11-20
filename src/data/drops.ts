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
  /** The colour along the top edge of its picture, as it is drawn at the head of VIP on the iPhone (under
   * the shade laid over it there): what the browser's bar over it is given, so that the picture reads as
   * running to the very top of the screen. `null` where it has not been worked out. */
  edge: string | null
  /** How the tile sits in the grid. */
  span: '' | 'big' | 'tall' | 'wide'
}

const photo = (drop: string, file: string, edge: string, span: MediaSlot['span'] = ''): MediaSlot => ({ kind: 'photo', drop, from: null, src: `/vip/${file}`, edge, span })

export const MEDIA: MediaSlot[] = [
  photo('Atoms x MKBHD', 'atoms-x-mkbhd.webp', '#515759', 'big'),
  photo('Deep Tech Mat', 'deep-tech-mat.webp', '#8c8c89'),
  photo('Feastables x Shrug', 'feastables-1.webp', '#c2c3c3'),
  photo('Billboards', 'billboard-1.webp', '#c2c2c2'),
  photo('Alt x Shrug', 'alt-1.webp', '#c5c5c5'),
  photo('Shrug Calendar', 'shrug-cal-1.webp', '#c1c3c4'),
  photo('VC Puzzle', 'shrug-cal-9.webp', '#c5c5c5'),
  photo('VC Sticker Pack', 'others-3.webp', '#c1c1c2'),
  photo('Other Drops', 'others-1.webp', '#1c2229'),
  photo('Atoms x MKBHD', 'atoms-1.webp', '#c0c1c1'),
  photo('Feastables x Shrug', 'feastables-2.webp', '#babdbe'),
  photo('Billboards', 'billboard-2.webp', '#c1c2c3'),
  photo('Alt x Shrug', 'alt-2.webp', '#bdbec1'),
  photo('Shrug Calendar', 'shrug-cal-2.webp', '#c0c1c2'),
  photo('VC Puzzle', 'shrug-cal-10.webp', '#babebe'),
  photo('Other Drops', 'others-2.webp', '#c4c4c5'),
  photo('Atoms x MKBHD', 'atoms-2.webp', '#c4c4c5'),
  photo('Feastables x Shrug', 'feastables-3.webp', '#c2c3c4'),
  photo('Billboards', 'billboard-3.webp', '#c4c4c4'),
  photo('Alt x Shrug', 'alt-3.webp', '#c5c5c5'),
  photo('Shrug Calendar', 'shrug-cal-3.webp', '#b7babc'),
  photo('VC Puzzle', 'shrug-cal-11.webp', '#bfc1c2'),
  photo('Atoms x MKBHD', 'atoms-3.webp', '#acadaf'),
  photo('Feastables x Shrug', 'feastables-4.webp', '#c5c5c5'),
  photo('Billboards', 'billboard-4.webp', '#c0c1c1'),
  photo('Shrug Calendar', 'shrug-cal-4.webp', '#c5c5c5'),
  photo('Atoms x MKBHD', 'atoms-4.webp', '#c1c2c3'),
  photo('Billboards', 'billboard-5.webp', '#c2c3c4'),
  photo('Shrug Calendar', 'shrug-cal-5.webp', '#bebebf'),
  photo('Atoms x MKBHD', 'atoms-5.webp', '#c1c2c3'),
  photo('Shrug Calendar', 'shrug-cal-6.webp', '#c1c1c2'),
  photo('Shrug Calendar', 'shrug-cal-7.webp', '#b4b9bb'),
  photo('Shrug Calendar', 'shrug-cal-8.webp', '#b8babc'),
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
