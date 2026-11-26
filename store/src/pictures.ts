import { MORE_COLORS } from '../shared/colors'
import type { Product } from '../shared/rules'

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
const tall = (shot: Shot) => !shot.drawn && !shot.ground && !shot.fills && shape(shot) <= 0.82

/** A chair's pictures, in the order they are shown (Dom, 26 Nov): the studio pictures first; then its
 * photographs, the wide ones first (a wide photograph fills a page by itself), then any that are near square,
 * and the tall ones last, where they share a page two by two (`pagesOf`). */
const chair = (color: string, photographs: Shot[] = []): Shot[] => [
  ...mock(color),
  ...photographs.filter((shot) => shape(shot) >= 1.15),
  ...photographs.filter((shot) => shape(shot) < 1.15 && !tall(shot)),
  ...photographs.filter(tall),
]

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

/** By name, in small letters. The chair goes by its old names too, in case a row in Airtable still has one. */
const KEPT: Record<string, Shot[]> = {
  chromatic: set('chromatic'),
  'workspace, matte black': chair('matte-black', set('workspace-matte-black')),
  'workspace chair': chair('matte-black', set('workspace-matte-black')),
  'workspace, ferrari red': chair('scuderia-red', set('workspace-ferrari-red')),
  'workspace chair, ferrari red': chair('scuderia-red', set('workspace-ferrari-red')),
  'workspace, scuderia red': chair('scuderia-red', set('workspace-ferrari-red')),
  'workspace, solar orange': chair('solar-orange'),
  'workspace, alexandrite': chair('alexandrite'),
  'workspace, illusion blue': chair('illusion-blue'),
  'workspace, supersonic': chair('supersonic'),
  'workspace, pearl lavender': chair('pearl-lavender'),
  'workspace, mantis green': chair('mantis-green'),
  // (and each of the sixteen more)
  ...Object.fromEntries(MORE_COLORS.map((color) => [`workspace, ${color.name.toLowerCase()}`, chair(color.id)])),
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
  const kept = KEPT[product.name.trim().toLowerCase()]
  if (kept) return kept
  const all = product.pictures?.length ? product.pictures : product.picture ? [product.picture] : []
  return all.map((full, n) => ({ full, small: n === 0 && product.picture ? product.picture : full }))
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
