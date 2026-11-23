import { MEDIA } from './content'

// What is on the VIP wall, in the order it is shown. The photographs are real: the ones in the shared data
// (src/data/drops.ts), each under the name of the drop it is of, in that data's order. So is the one text
// card, which is Shrug's own. Everything else here is a card STILL TO COME: no videos and no posts have been
// supplied, so a few stand on the wall as placeholders, their missing parts drawn in square brackets, to
// show how each kind of card looks. Nothing on this page is made up to pass for a real post.
//
// TO PUT REAL ONES IN: give a card below its real fields (a video its `src`, `poster`, `name` and `role`; a
// post its `name`, `handle`, `text`, `when` and `href`; a press piece its `publication`, `headline` and
// `href`) and take away its `awaits`, or add new cards to EXTRAS. Files go in vc/public/wall and are named
// by their address (`/wall/…`). `before` is the photograph a card stands in front of, counted from 0.

/** A photograph someone posted when theirs arrived. */
export interface Photo {
  kind: 'photo'
  /** The drop it is of: the name at its foot. */
  drop: string
  /** Its address in the shared data (/vip/…): `pictureOf` in content.ts gives where it is on this site. */
  src: string
}

/** A film someone made: upright, 9 by 16. */
export interface Video {
  kind: 'video'
  drop: string
  /** Who is in it, and what they do. */
  name?: string
  role?: string
  /** The film, and the still that stands for it until it plays. */
  src?: string
  poster?: string
}

/** A post, brought in with its author, handle and date, and linked to the original. */
export interface Post {
  kind: 'post'
  drop: string
  name?: string
  handle?: string
  /** The author's picture. */
  avatar?: string
  text?: string
  /** When it was posted, as it is to be read: "7:58 PM · May 23, 2023". */
  when?: string
  /** The original post. */
  href?: string
  /** A picture attached to it. */
  photo?: string
  /** For a post still to come: what is to go where its words will be, and whether a picture will be attached. */
  awaits?: string
  awaitsPhoto?: boolean
}

/** A few lines of Shrug's own, on the inverted card. */
export interface Text {
  kind: 'text'
  drop: string
  text: string
  /** Where the story is told in full, if anywhere. */
  href?: string
}

/** A piece written about a drop. */
export interface Press {
  kind: 'press'
  drop: string
  publication?: string
  headline?: string
  href?: string
  /** For a piece still to come: what is to go where its headline will be. */
  awaits?: string
}

export type Card = Photo | Video | Post | Text | Press

const PHOTOS: Photo[] = MEDIA.flatMap((slot) => (slot.kind === 'photo' && slot.src ? [{ kind: 'photo' as const, drop: slot.drop, src: slot.src }] : []))

/** The cards that stand among the photographs. The wording in brackets is the design's own. */
const EXTRAS: { before: number; card: Exclude<Card, Photo> }[] = [
  { before: 0, card: { kind: 'video', drop: 'Chromatic book' } },
  // Real: the one card on the wall besides the photographs that is not a placeholder
  { before: 2, card: { kind: 'text', drop: 'Deep Tech Mat', text: 'The Deep Tech Mat carried a line from Julia DeWahl’s essay on nuclear energy. When she co-founded Antares, she called us first.' } },
  { before: 4, card: { kind: 'press', drop: 'Billboards', awaits: 'Headline of the press piece about the billboards' } },
  { before: 6, card: { kind: 'post', drop: 'Deep Tech Mat', awaits: 'Post from X about the Deep Tech Mat arriving, about thirty words, pulled in with its author, handle and date.' } },
  { before: 10, card: { kind: 'video', drop: 'Feastables x Shrug' } },
  { before: 14, card: { kind: 'post', drop: 'VC Puzzle', awaits: 'Short post from X about the VC Puzzle.' } },
  { before: 20, card: { kind: 'post', drop: 'Feastables x Shrug', awaits: 'Post from X about the Feastables drop, about twenty-five words, with a photo attached below.', awaitsPhoto: true } },
]

/** The wall: every photograph in its order, with the other cards set in among them. */
export const WALL: Card[] = PHOTOS.flatMap((photo, n) => [...EXTRAS.filter((extra) => extra.before === n).map((extra) => extra.card), photo])
