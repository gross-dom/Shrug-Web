// Workspace: the chair, and the colors it is painted in (design/v1-workspace, WORKSPACE.md, and Dom's notes
// after testing it). Workspace is where the chair is chosen and bought: the studio is its own, and the
// buying is the store's (a chair in each color is a product there, bought on the store's own page inside
// this window).
//
// Each color is ONE value here, and everything that shows the color is drawn from it: the cove of the
// studio, the slab on the first screen, the dot in the studio's dock, the Workspace icon in the desktop's
// Dock, and the paint on the chair itself. The values are the Workspace design's as redrawn on 25 Nov (its
// "Eight priority" and "Sixteen more" boards: the catalog's swatches converted to sRGB, and where a swatch
// and the reference photographs disagree, as for Championship Green, the photographs won). Pearl Lavender is
// as it was built: the design has it as a stand-in. Each has a finish, which is how its paint is lit on the
// chair: one paint material in several settings (store/shared/colors.ts). To change one, change it here.
//
// What a chair costs is not here: it is the store's to say (Matte Leather from $1,100, a painted one from
// $1,200), and it is said only to someone logged in. Which colors are in stock is Dom's word of 26 Nov:
// the eight the studio opens on are available now, and the sixteen more are made to order, in two to three
// weeks. Each color's photographs are Shrug's selects of 27 Nov (store/public/pictures/workspace/). Still
// Shrug's to supply: the one line about each color, and the owners who have agreed to be named.
//
// (Illusion Blue is among the eight and Championship Green among the sixteen: Dom swapped the two after his
// fourth round of testing.)
//
// Beyond the eight the studio opens on there are sixteen more, each made to order and each with a name of
// its own (store/shared/colors.ts, which the store reads too: a chair in each is a product there). They are
// picked from a grid, and from then on are a color like any other. (There is no "color of your own" any
// more: every color the chair comes in has a name.)

import { MORE_COLORS, type Finish } from '../../store/shared/colors'

export interface Paint {
  id: string
  name: string
  /** The color. A paint that shifts with the angle it is seen from has the colors it moves through, first to last. */
  color: string
  shift?: string[]
  /** How it is finished: matte (Matte Leather, the chair as it comes), high gloss, pearl, metallic, and the rest. */
  finish: Finish
  /** In stock, or made to order. Either is bought here. */
  stock: 'now' | 'order'
  /** One line about it. Null until it is written: nothing is drawn where it would be. */
  line: string | null
  /** The chair in this color, in the store: what Buy opens. */
  product: string
  /** One of the sixteen more colors, picked from the grid and not from the tray. */
  more?: boolean
}

/** The chair itself: Dom's model of it, as a .glb the site serves (public/workspace/). The studio stands it
 * on the turntable and paints its material named Paint (src/apps/workspace/stage.ts, which says how a newer
 * file is put in its place). */
export const CHAIR_MODEL: string | null = '/workspace/chair.glb'

// (Matte Leather is the chair as it comes, in black: it went by Matte Black until the launch list of 27 Nov,
// and keeps that as its id, so that nothing kept under it is lost)
export const PAINTS: Paint[] = [
  { id: 'matte-black', name: 'Matte Leather', color: '#141414', finish: 'matte', stock: 'now', line: null, product: 'chair-matte-black' },
  { id: 'scuderia-red', name: 'Scuderia Red', color: '#ff302c', finish: 'gloss', stock: 'now', line: null, product: 'chair-scuderia-red' },
  { id: 'solar-orange', name: 'Solar Orange', color: '#ff7900', finish: 'gloss', stock: 'now', line: null, product: 'chair-solar-orange' },
  { id: 'alexandrite', name: 'Alexandrite', color: '#6e5e72', shift: ['#1c3146', '#6e5e72', '#b47e62'], finish: 'shift', stock: 'now', line: null, product: 'chair-alexandrite' },
  { id: 'illusion-blue', name: 'Illusion Blue', color: '#2386f7', finish: 'metallic', stock: 'now', line: null, product: 'chair-illusion-blue' },
  { id: 'supersonic', name: 'Supersonic', color: '#ffffff', finish: 'gloss', stock: 'now', line: null, product: 'chair-supersonic' },
  { id: 'pearl-lavender', name: 'Pearl Lavender', color: '#c4b5ea', finish: 'pearl', stock: 'now', line: null, product: 'chair-pearl-lavender' },
  { id: 'mantis-green', name: 'Mantis Green', color: '#13c334', finish: 'pearl', stock: 'now', line: null, product: 'chair-mantis-green' },
]

/** The sixteen more: each made to order, and each a chair of its own in the store. */
export const MORE: Paint[] = MORE_COLORS.map((c) => ({ id: c.id, name: c.name, color: c.color, shift: c.shift, finish: c.finish, stock: 'order', line: null, product: `chair-${c.id}`, more: true }))

/** Every color the chair comes in. */
export const ALL_PAINTS: Paint[] = [...PAINTS, ...MORE]

/** The ground the app stands on before a color is picked. */
export const PAPER = '#f3f2ee'

// ---- Words on a color

/** How light a color is, as the contrast of words on it is reckoned (WCAG's relative luminance); `white` is how much white is laid over it first. */
function lightOf(color: string, white = 0) {
  const n = parseInt(color.slice(1), 16)
  const lin = (c: number) => ((c = (c + (255 - c) * white) / 255), c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255)
}

/** What small words need of the color they are set on, to be read (WCAG AA). */
const READ = 4.5

/** Words set on a color are near-black or white, whichever is read better on it. Between the two is a narrow
 * run of mid-tones on which neither is read well enough (a color typed into Your own can be anything, and
 * the teal it starts on is one of them): there the words are black, which is. */
export function inkOn(color: string): '#141414' | '#fff' | '#000' {
  const light = lightOf(color) + 0.05
  const dark = light / 0.057
  const white = 1.05 / light
  return Math.max(dark, white) < READ ? '#000' : dark >= white ? '#141414' : '#fff'
}

/** How much white the chips on a dark color are tinted with (the pill in the bar, a tag, the turntable's note). */
export const CHIP = 0.14

/** Whether the chips on a dark color are shaded and not tinted: white words on a color only just dark enough
 * for them could not be read on a lighter chip, so there the chip is a little darker than its ground. */
export const shadedOn = (color: string) => inkOn(color) === '#fff' && 1.05 / (lightOf(color, CHIP) + 0.05) < READ

// ---- Notable Owners: people who own one, with their words. Only owners who have agreed to be named appear.

export interface Owner {
  name: string
  /** Their role, and where. */
  of: string
  words: string
  /** The id of the color their chair is. */
  paint: string
}

/** Templated for now, as the design has them: six cards whose names and words are in [square brackets]. */
export const OWNERS: Owner[] = ['scuderia-red', 'alexandrite', 'solar-orange', 'mantis-green', 'pearl-lavender', 'championship-green'].map((paint) => ({ name: '[Owner name]', of: '[Role, Company]', words: '[Their words about the chair.]', paint }))

// ---- BTS: how a chair is made, as a wall. Photographs and films of the making, each with a line under it.
// (Laid out differently from Notable Owners on purpose: that is cards of words; this is a wall of pictures.)

export interface Making {
  id: string
  kind: 'photo' | 'video'
  /** The photograph, or the film's file. Null until it is supplied. */
  src: string | null
  /** For a film: the still it shows before it plays. */
  poster?: string | null
  /** One line under it. */
  says: string
  /** How it sits on the wall. */
  shape: 'wide' | 'tall' | 'square'
  /** The tone that stands where a picture will be, until it is supplied. */
  tone?: string
}

const SHOT = '/vip/store/pictures/'
/** The four photographs are Shrug's own, already in the store's pictures. The films have not been supplied:
 * their tiles are templated, as the design's are, and are left out of the live site until they are in. */
export const MAKING: Making[] = [
  { id: 'booth', kind: 'photo', src: `${SHOT}ws-catalog-2.webp`, says: 'A base in the paint booth.', shape: 'wide' },
  { id: 'film-paint', kind: 'video', src: null, says: '[Film: the paint going on. 0:45]', shape: 'tall', tone: '#3a1d1f' },
  { id: 'hung', kind: 'photo', src: `${SHOT}ws-catalog-4.webp`, says: 'Painted parts, hung in the booth.', shape: 'wide' },
  { id: 'set', kind: 'photo', src: `${SHOT}workspace-ferrari-red-1.webp`, says: 'Scuderia Red, on set.', shape: 'tall' },
  { id: 'film-build', kind: 'video', src: null, says: '[Film: a chair built up from its parts. 1:20]', shape: 'wide', tone: '#1d2a3a' },
  { id: 'green', kind: 'photo', src: `${SHOT}ws-catalog-3.webp`, says: 'Championship Green.', shape: 'wide' },
  { id: 'film-match', kind: 'video', src: null, says: '[Film: matching a color to a swatch. 0:30]', shape: 'square', tone: '#2a2440' },
  { id: 'film-pack', kind: 'video', src: null, says: '[Film: packed and sent. 0:25]', shape: 'tall', tone: '#27301f' },
]
