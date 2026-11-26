import { MORE_COLORS } from '../shared/colors'
import type { Product } from '../shared/rules'
import CHAIR_PHOTOS from './chair-photos.json'

// A product's photographs. The ones Shrug has supplied are kept with the pages (store/public/pictures), each
// whole, and are found by the product's name, so that they are the same in the demo and in the real store.
// Each is kept at three sizes: small (760 on its long side: a thumbnail, and a phone's tile), the one a
// product's screen shows (1,800), and, where the original had the pixels for it, a large one (2,400) for big
// and dense screens. The browser is told how wide each file is and how large it will be drawn, and fetches
// the smallest that is sharp there: nothing is shown softer than the screen can show it, and no phone is
// sent a desktop's file. A product with none here shows what its row in Airtable has (Products → Picture),
// and one with nothing there shows a drawing of the sort of thing it is.

export interface Shot {
  /** The photograph, whole, for a product's own screen. */
  full: string
  /** The same, small: the foot, a thumbnail. */
  small: string
  /** Every size there is, as the browser is told of them ("…-s.webp 570w, ….webp 1350w, …-l.webp 1800w"); none for a picture from Airtable. */
  set?: string
  /** How wide it is for its height: 0.75 is upright, 1.5 is wide. Unknown for a picture from Airtable. */
  aspect?: number
  /** Where its subject is, for a tile that shows only part of it (the display crops to 4:5). */
  at?: string
  /** It is not a photograph: a picture made of the thing from its model. */
  drawn?: boolean
  /** It was made to fill whatever shows it: its subject is in its middle with room all round, so a place of
   * another shape shows the middle of it, edge to edge, where a photograph is shown whole. */
  fills?: boolean
  /** It is a thing on a plain ground (a piece on white): it is shown whole, on a tile painted that same
   * color, so that the ground runs to the tile's edges and nothing dim is set round it. */
  ground?: string
  /** What it shows, where that is known and worth saying: "Solar Orange Workspace chair, from behind". */
  alt?: string
  /** It has a page to itself whatever its shape: it is not put beside another to fill one. */
  alone?: boolean
}

/** One slide of a chair's gallery, in a landscape window: a landscape photograph, which fills it; two upright
 * ones, side by side, which fill it between them; or one upright one, whole, inside it. */
export interface Slide {
  kind: 'wide' | 'pair' | 'portrait'
  shots: Shot[]
}

// (the desktop's own windows read these too, for a shelf of covers: from there the store's pages are at /vip/store/)
const BASE = import.meta.env.BASE_URL.endsWith('store/') ? import.meta.env.BASE_URL : '/vip/store/'

/** Each photograph kept here, in the order it is shown: how wide its small file is, how wide and tall the
 * one a product's screen shows, and how wide its large one, if it has one. (Written by the script that
 * makes the files: the widths are the files' own.) */
const SIZES: Record<string, number[][]> = {
  'chromatic': [[705, 1670, 1800, 2227], [760, 1800, 1200, 2400], [760, 1800, 1174, 2400]],
  'workspace-matte-black': [[570, 1350, 1800, 1800], [570, 1350, 1800, 1800], [507, 1200, 1800, 1600]],
  'workspace-ferrari-red': [[507, 1200, 1800, 1601], [507, 1200, 1800, 1601], [681, 1613, 1800, 2116]],
  'art-on-acrylic': [[608, 1440, 1800, 1920], [760, 1800, 1012, 2400], [760, 1800, 1013, 2400], [760, 1800, 1183, 2400]],
  // (the five pieces, as Dom supplied them on 26 Nov: each a product shot on white, a close look at it, and
  // the artwork itself, flat and whole)
  'art-america-must-win': [[760, 1254, 1254], [760, 840, 840], [681, 1614, 1800, 2152]],
  'art-becoming-steve-jobs': [[760, 1254, 1254], [760, 800, 800], [608, 1440, 1800, 1920]],
  'art-outatime': [[760, 1254, 1254], [728, 728, 728], [760, 1800, 1012, 2400]],
  'art-return-of-the-jedi': [[760, 1254, 1254], [760, 840, 840], [507, 1200, 1800, 1600]],
  'art-tesla-flying': [[760, 1254, 1254], [760, 784, 784], [760, 1800, 1411, 2400]],
  'ws-catalog': [[760, 1734, 1220], [760, 1800, 1012, 2400], [760, 1800, 1008, 2400], [760, 1800, 1011, 2400]],
  'shrug-2027': [[608, 1122, 1402], [608, 1122, 1402]],
}

const set = (slug: string, at: Record<number, string> = {}): Shot[] =>
  (SIZES[slug] ?? []).map(([small, wide, tall, large], n) => {
    const at1 = `${BASE}pictures/${slug}-${n + 1}`
    return {
      full: `${at1}.webp`,
      small: `${at1}-s.webp`,
      set: [`${at1}-s.webp ${small}w`, `${at1}.webp ${wide}w`, ...(large ? [`${at1}-l.webp ${large}w`] : [])].join(', '),
      aspect: wide! / tall!,
      at: at[n + 1],
    }
  })

/** One of the art pieces: its product shot (the piece whole, on white), a close look at it, and the artwork
 * itself. The piece is shown whole, on a tile of its own white; the close look fills whatever shows it; the
 * artwork is shown whole, as any photograph is. */
const piece = (slug: string): Shot[] => set(slug).map((shot, n) => (n === 0 ? { ...shot, ground: '#fdfdfd' } : n === 1 ? { ...shot, fills: true } : shot))

/** The chair in a color, as product pictures: Dom's model of it in that color's paint, stood in a white
 * studio and taken four ways (from behind at a three-quarter, where the color is; from in front; square on
 * from behind; from the side: `node tools/chair-mockups.cjs` makes them). Every color has these, to be
 * clicked through, and they come first, so that the page a chair is bought on always opens on a proper
 * picture of the product, the same for each of them; a color's photographs, where it has them, follow. Each
 * says of itself that it is not a photograph, and Workspace, which has the chair itself to turn, leaves
 * them out of its strip. */
const mock = (color: string): Shot[] =>
  [1, 2, 3, 4].map((n) => {
    const at1 = `${BASE}pictures/workspace-${color}-mock-${n}`
    return { full: `${at1}.webp`, small: `${at1}-s.webp`, set: `${at1}-s.webp 760w, ${at1}.webp 1800w`, aspect: 1, drawn: true, fills: true }
  })

/** How wide a photograph is for its height, where that is known (one from Airtable is taken to be square). */
const shape = (shot: Shot) => shot.aspect ?? 1
/** A tall photograph: one that is shown two to a page. */
const tall = (shot: Shot) => !shot.drawn && !shot.ground && !shot.fills && !shot.alone && shape(shot) <= 0.82

// ---- The chair's own photography (Shrug's selects of 27 Nov)
//
// Each color has a folder of its own (store/public/pictures/workspace/<color>/), with two sets in it:
//   gallery/   what Workspace shows in its window: slides, each a landscape, a pair of uprights or one upright
//   checkout/  upright studio shots for the page the chair is bought on, one to three, the first its hero
// `python3 -I tools/chair-photos.py <Shrug's folder>` copies them in as they are and writes what there is to
// chair-photos.json, which is all that is read here: a color with nothing there is shown as it was before
// (the chair drawn from its model, and such photographs as were kept by its name).

interface Kept {
  /** Its file in the color's folder, without its ending: "gallery/02-pair-left__X". */
  file: string
  w: number
  h: number
  /** How wide its small and its middle copy are (.webp); a photograph too small to need one has none. */
  s?: number
  m?: number
  ground?: string
  view?: string
}
const PHOTOS = CHAIR_PHOTOS as Record<string, { name: string; gallery: { kind: string; photos: Kept[] }[]; checkout: Kept[] } | undefined>

/** One of them as a picture: the file as Shrug supplied it is its largest size, and is sent only to a screen
 * that can show it. */
const kept = (color: string, name: string, one: Kept): Shot => {
  const at1 = `${BASE}pictures/workspace/${color}/${one.file}`
  const whole = `${at1}.jpg`
  return {
    full: one.m ? `${at1}-m.webp` : whole,
    small: one.s ? `${at1}-s.webp` : one.m ? `${at1}-m.webp` : whole,
    set: [one.s ? `${at1}-s.webp ${one.s}w` : '', one.m ? `${at1}-m.webp ${one.m}w` : '', `${whole} ${one.w}w`].filter(Boolean).join(', '),
    aspect: one.w / one.h,
    ground: one.ground,
    alt: `${name} Workspace chair${one.view ? `, ${one.view}` : ''}`,
    alone: true,
  }
}

/** A color's checkout shots, the hero first; none where it has none yet. */
const studio = (color: string): Shot[] => (PHOTOS[color]?.checkout ?? []).map((one) => kept(color, PHOTOS[color]!.name, one))
/** And the slides of its gallery. */
const slides = (color: string): Slide[] =>
  (PHOTOS[color]?.gallery ?? []).map((slide) => ({ kind: slide.kind === 'pair' ? 'pair' : slide.kind === 'portrait' ? 'portrait' : 'wide', shots: slide.photos.map((one) => kept(color, PHOTOS[color]!.name, one)) }))

/** A chair's pictures before its color has studio shots of its own, in the order they are shown (Dom, 26
 * Nov): the pictures made from its model first; then its photographs, the wide ones first (a wide photograph fills a page by itself), then any that are near square,
 * and the tall ones last, where they share a page two by two (`pagesOf`). */
const drawnChair = (color: string, photographs: Shot[] = []): Shot[] => [
  ...mock(color),
  ...photographs.filter((shot) => shape(shot) >= 1.15),
  ...photographs.filter((shot) => shape(shot) < 1.15 && !tall(shot)),
  ...photographs.filter(tall),
]

/** The photographs kept by a chair's name before its color had a folder of its own. */
const BEFORE: Record<string, string> = { 'matte-black': 'workspace-matte-black', 'scuderia-red': 'workspace-ferrari-red' }

/** A chair's pictures on the page it is bought on: its studio shots, where Shrug has supplied them (one to
 * three, the hero first, a page each); until then the chair drawn from its model, as above. */
const chair = (color: string): Shot[] => {
  // (made once for each color: a page that asks twice is given the same pictures, not ones like them)
  const made = MADE.get(color)
  if (made) return made
  const shots = studio(color)
  const all = shots.length ? shots : drawnChair(color, BEFORE[color] ? set(BEFORE[color]) : [])
  MADE.set(color, all)
  return all
}
const MADE = new Map<string, Shot[]>()
const SLIDES = new Map<string, Slide[]>()

/** The chair's colors, by the names its products go by, in small letters. A color goes by its old names too,
 * in case a row in Airtable still has one: Matte Leather was Matte Black, Scuderia Red was Ferrari Red. */
const CHAIRS: Record<string, string> = {
  'workspace, matte leather': 'matte-black',
  'workspace, matte black': 'matte-black',
  'workspace chair': 'matte-black',
  'workspace, scuderia red': 'scuderia-red',
  'workspace, ferrari red': 'scuderia-red',
  'workspace chair, ferrari red': 'scuderia-red',
  'workspace, solar orange': 'solar-orange',
  'workspace, alexandrite': 'alexandrite',
  'workspace, illusion blue': 'illusion-blue',
  'workspace, supersonic': 'supersonic',
  'workspace, pearl lavender': 'pearl-lavender',
  'workspace, mantis green': 'mantis-green',
  // (and each of the sixteen more)
  ...Object.fromEntries(MORE_COLORS.map((color) => [`workspace, ${color.name.toLowerCase()}`, color.id])),
}

/** Which color a product is the chair in; null for anything that is not a chair. */
const chairOf = (product: Pick<Product, 'name'>): string | null => CHAIRS[product.name.trim().toLowerCase()] ?? null

/** The pictures as they are paged through. A tall photograph shares its page with the tall one after it, side
 * by side, so that the two of them fill the page; everything else has a page of its own. */
export function pagesOf(shots: Shot[]): Shot[][] {
  const pages: Shot[][] = []
  for (const shot of shots) {
    const last = pages[pages.length - 1]
    if (tall(shot) && last?.length === 1 && tall(last[0]!)) last.push(shot)
    else pages.push([shot])
  }
  return pages
}

/** By name, in small letters. (The chair, in each of its colors, is found by `chairOf`.) */
const KEPT: Record<string, Shot[]> = {
  chromatic: set('chromatic'),
  'art on acrylic': set('art-on-acrylic'),
  // (five of the six pieces, by the names Shrug gives them, with Dom's photographs of 26 Nov. The sixth is on its way)
  'america must win': piece('art-america-must-win'),
  'becoming steve jobs': piece('art-becoming-steve-jobs'),
  outatime: piece('art-outatime'),
  'return of the jedi': piece('art-return-of-the-jedi'),
  'tesla flying': piece('art-tesla-flying'),
  // The cover's lettering is at its right-hand edge
  'ws catalog': set('ws-catalog', { 1: '88% 50%' }),
  'shrug 2027': set('shrug-2027'),
  'in plain sight': set('shrug-2027'),
}

/** Every photograph of a product, the first first; empty where it has none. */
export function shotsOf(product: Pick<Product, 'name' | 'picture' | 'pictures'>): Shot[] {
  const color = chairOf(product)
  const ours = color ? chair(color) : KEPT[product.name.trim().toLowerCase()]
  if (ours) return ours
  const all = product.pictures?.length ? product.pictures : product.picture ? [product.picture] : []
  return all.map((full, n) => ({ full, small: n === 0 && product.picture ? product.picture : full }))
}

/** A photograph wide enough to fill a landscape window by itself; a narrower one is shown whole in it. */
const WIDE = 1.25

/** A chair's gallery, as Workspace shows it in its window, a slide at a time: Shrug's own slides for its
 * color, where there are any; until then such photographs as it has, a wide one to a slide and the tall ones
 * two by two. Empty for a chair with no photographs, and for anything that is not a chair. */
export function galleryOf(product: Pick<Product, 'name' | 'picture' | 'pictures'>): Slide[] {
  const color = chairOf(product)
  if (!color) return []
  const made = SLIDES.get(color)
  if (made) return made
  const own = slides(color)
  const all: Slide[] = own.length ? own : pagesOf(shotsOf(product).filter((shot) => !shot.drawn)).map((page) => ({ kind: page.length > 1 ? 'pair' : shape(page[0]!) >= WIDE ? 'wide' : 'portrait', shots: page }))
  SLIDES.set(color, all)
  return all
}

/** How wide a photograph is drawn in the display, for the browser to choose a file by. A tile is 4 by 5 and
 * the picture fills it, so one that is wider than the tile is drawn wider than the tile is. */
export function tileSizes(shot: Shot): string | undefined {
  if (!shot.set || !shot.aspect) return undefined
  // (one shown whole on its own ground is never drawn wider than the tile)
  const over = shot.ground ? 1 : Math.max(1, shot.aspect / 0.8)
  const vw = (share: number) => `${Math.round(share * over)}vw`
  return `(max-width: 739px) ${vw(50)}, (min-width: 1700px) ${vw(25)}, ${vw(33)}`
}

/** And on a product's own screen, where it is shown whole in a tile that is most of the window. */
export function wholeSizes(shot: Shot): string | undefined {
  if (!shot.set || !shot.aspect) return undefined
  // (one that fills its tile is as wide as the tile, or wider where the tile is taller than it)
  if (shot.fills) return '(max-width: 739px) max(calc(100vw - 40px), 46vh), max(58vw, calc(100vh - 200px))'
  const a = shot.aspect.toFixed(3)
  return `(max-width: 739px) min(calc(100vw - 40px), calc(46vh * ${a})), min(58vw, calc((100vh - 200px) * ${a}))`
}
