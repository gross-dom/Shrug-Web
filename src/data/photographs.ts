// Photographs: the second section of the Wallpapers window, beside the five colorways (design/v1,
// "Wallpapers"). Twenty, by the team. A photograph opens large, to be put on the desk or downloaded.
//
// None has been supplied yet, so the twenty are templated, as the design has them: a tone where the picture
// will be, and a title in [square brackets]. To put one in: its files go in public/wallpapers (the picture
// the window shows, `src`; the same small, `small`; and large to download, `full`), with its title, who
// took it, where and when. For it to be put on the desk it must also be among the desk's own pictures,
// which tools/wallpaper.cjs writes (src/data/wallpapers.ts, and the script at the head of index.html):
// `desk` is its place among them.

export interface Photograph {
  id: string
  title: string
  /** Who took it, and where and when: "By [Name], [Place, Year]". */
  by: string
  /** The picture, and the same small; null until it is supplied. */
  src: string | null
  small: string | null
  /** The file to download, and its size in bytes. */
  full: string | null
  bytes: number
  /** Its place among the desk's own pictures (src/data/wallpapers.ts), once it is one of them. */
  desk: number | null
  /** The tones it stands in until its picture is there. */
  tone: [number, string, string]
}

const TONES: [number, string, string][] = [
  [160, '#c9b79a', '#7a6a58'],
  [200, '#8aa4b8', '#2f4257'],
  [140, '#d8c7b8', '#a0705a'],
  [180, '#9fb39a', '#3f5a48'],
  [210, '#e2d5c0', '#b79c6a'],
  [150, '#b7b9c4', '#555a6c'],
  [170, '#d9a98f', '#6d3f3a'],
  [190, '#a9c4c9', '#3d6670'],
]

export const PHOTOGRAPHS: Photograph[] = Array.from({ length: 20 }, (_, i) => ({
  id: `photograph-${i + 1}`,
  title: `[Photograph ${String(i + 1).padStart(2, '0')}]`,
  by: 'By [Name], [Place, Year]',
  src: null,
  small: null,
  full: null,
  bytes: 0,
  desk: null,
  tone: TONES[i % TONES.length]!,
}))
