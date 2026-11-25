// Workspace: the chair, and the colors it is painted in (design/v1-workspace, WORKSPACE.md, and Dom's notes
// after testing it). Workspace is where the chair is chosen and bought: the studio is its own, and the
// buying is the store's (a chair in each color is a product there, bought on the store's own page inside
// this window).
//
// Each color is ONE value here, and everything that shows the color is drawn from it: the cove of the
// studio, the slab on the first screen, the dot in the studio's dock, the Workspace icon in the desktop's
// Dock, and the paint on the chair itself. The values are working values, not final (WORKSPACE.md, section
// 3): Scuderia Red and Championship Green were sampled from the catalog; Solar Orange is approximate;
// Alexandrite is a stand-in for a color-shifting paint; Supersonic and Pearl Lavender are guesses awaiting
// swatches. To change one, change it here.
//
// What a chair costs is not here: it is the store's to say (Matte Black from $1,100, a painted one from
// $1,200), and it is said only to someone logged in. Still Shrug's to supply: which colors are in stock, the
// one line about each color, photographs of each, and the owners who have agreed to be named.

export interface Paint {
  id: string
  name: string
  /** The color. A paint that shifts with the angle it is seen from has the colors it moves through, first to last. */
  color: string
  shift?: string[]
  /** Matte Black is not a gloss paint: the chair as it comes, with no shine on it. */
  finish?: 'matte'
  /** In stock, or made to order. Either is bought here. */
  stock: 'now' | 'order'
  /** One line about it. Null until it is written: nothing is drawn where it would be. */
  line: string | null
  /** The chair in this color, in the store: what Buy opens. */
  product: string
}

/** A file of the real chair, if there is one: a scan or a modelled chair as a .glb, served by the site
 * (put it in public/workspace/ and name it here, "/workspace/chair.glb"). The studio loads it in place of
 * the chair it draws itself, stands it on the turntable at the drawn chair's height, and paints whichever
 * of its materials has "paint" in its name. Null: the drawn chair. */
export const CHAIR_MODEL: string | null = null

export const PAINTS: Paint[] = [
  { id: 'matte-black', name: 'Matte Black', color: '#1b1c1f', finish: 'matte', stock: 'now', line: null, product: 'chair-matte-black' },
  { id: 'scuderia-red', name: 'Scuderia Red', color: '#d8141c', stock: 'order', line: null, product: 'chair-scuderia-red' },
  { id: 'solar-orange', name: 'Solar Orange', color: '#fb8a05', stock: 'now', line: null, product: 'chair-solar-orange' },
  { id: 'alexandrite', name: 'Alexandrite', color: '#6b3f9c', shift: ['#27307d', '#6b3f9c', '#b0683a'], stock: 'order', line: null, product: 'chair-alexandrite' },
  { id: 'championship-green', name: 'Championship Green', color: '#0f9a48', stock: 'order', line: null, product: 'chair-championship-green' },
  { id: 'supersonic', name: 'Supersonic', color: '#9db3c9', stock: 'order', line: null, product: 'chair-supersonic' },
  { id: 'pearl-lavender', name: 'Pearl Lavender', color: '#c4b5ea', stock: 'order', line: null, product: 'chair-pearl-lavender' },
  { id: 'mantis-green', name: 'Mantis Green', color: '#6fd12a', stock: 'order', line: null, product: 'chair-mantis-green' },
]

/** A color of the visitor's own: always a request, never charged for here. */
export const OWN = { id: 'own', name: 'Your own', start: '#1f8a7a' }

/** The ground the app stands on before a color is picked. */
export const PAPER = '#f3f2ee'

// ---- Reading a color someone types: a hex, a RAL code, or a name

/** The RAL Classic colors people ask for by number, and what each is called. (A working table, to be checked against a fan deck.) */
const RAL: Record<string, [string, string]> = {
  '1003': ['#f9a800', 'Signal yellow'],
  '1015': ['#e6d2b5', 'Light ivory'],
  '1021': ['#eec900', 'Rape yellow'],
  '1023': ['#f0ca00', 'Traffic yellow'],
  '2004': ['#e25303', 'Pure orange'],
  '2009': ['#de5307', 'Traffic orange'],
  '3000': ['#a72920', 'Flame red'],
  '3003': ['#8d1d2c', 'Ruby red'],
  '3020': ['#c1121c', 'Traffic red'],
  '4005': ['#76689a', 'Blue lilac'],
  '4008': ['#844c82', 'Signal violet'],
  '5002': ['#00387b', 'Ultramarine blue'],
  '5005': ['#005387', 'Signal blue'],
  '5010': ['#004f7c', 'Gentian blue'],
  '5012': ['#0089b6', 'Light blue'],
  '5015': ['#007cb0', 'Sky blue'],
  '5018': ['#058b8c', 'Turquoise blue'],
  '5024': ['#6093ac', 'Pastel blue'],
  '6005': ['#0f4336', 'Moss green'],
  '6018': ['#48a43f', 'Yellow green'],
  '6019': ['#b7d9b1', 'Pastel green'],
  '6029': ['#006f3d', 'Mint green'],
  '6033': ['#1f8a7a', 'Mint turquoise'],
  '7016': ['#383e42', 'Anthracite gray'],
  '7035': ['#c5c7c4', 'Light gray'],
  '7037': ['#7a7b7a', 'Dusty gray'],
  '8017': ['#442f29', 'Chocolate brown'],
  '9001': ['#e9e0d2', 'Cream'],
  '9003': ['#ecece7', 'Signal white'],
  '9005': ['#0e0e10', 'Jet black'],
  '9010': ['#f1ece1', 'Pure white'],
  '9016': ['#f1f0ea', 'Traffic white'],
}

/** What was typed, as a color: its value, and what to call it. Null where it names none (the studio stays as it was). */
export function readColor(typed: string): { color: string; name: string } | null {
  const text = typed.trim()
  if (!text) return null
  const hex = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(text)
  if (hex) {
    const digits = hex[1]!.length === 3 ? hex[1]!.replace(/./g, '$&$&') : hex[1]!
    return { color: `#${digits.toLowerCase()}`, name: `#${digits.toUpperCase()}` }
  }
  const ral = /^ral\s*-?\s*(\d{4})\b/i.exec(text)
  if (ral) {
    const found = RAL[ral[1]!]
    return found ? { color: found[0], name: `RAL ${ral[1]} ${found[1]}` } : null
  }
  // A name: one of the RAL names, or anything a browser knows as a color ("teal", "hot pink")
  // (a name is found however its gray is spelled)
  const plain = (name: string) => name.toLowerCase().replace(/grey/g, 'gray')
  const named = Object.entries(RAL).find(([, [, name]]) => plain(name) === plain(text))
  if (named) return { color: named[1][0], name: `RAL ${named[0]} ${named[1][1]}` }
  if (typeof document === 'undefined') return null
  const probe = document.createElement('span')
  probe.style.color = text.replace(/\s+/g, '')
  if (!probe.style.color) return null
  document.body.append(probe)
  const rgb = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(getComputedStyle(probe).color)
  probe.remove()
  if (!rgb) return null
  const color = `#${[1, 2, 3].map((i) => Number(rgb[i]).toString(16).padStart(2, '0')).join('')}`
  return { color, name: text.replace(/\b\w/g, (letter) => letter.toUpperCase()) }
}

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
