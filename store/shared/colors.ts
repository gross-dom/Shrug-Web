// The chair's colors beyond the eight the studio opens on: sixteen more, each made to order. Workspace shows
// them as a grid to pick from (src/apps/Workspace.tsx); the store sells each as a chair of its own (in the
// demo, store/src/demo.ts; for real, a row each in Shrug's Products).
//
// They are Shrug's own: the names, finishes and values are from the Workspace design as redrawn on 25 Nov
// (the "Sixteen more" board of the Shrug.VIP v1 designs, set from the catalog's swatches converted to sRGB;
// where a swatch and the reference photographs disagree, as for Hulk Green and Dazzling Pink, the
// photographs won). The reference photographs are the standard for the paint: a value here is where the
// match starts. Change one here and everything that shows the color follows.

/** How a paint is finished. One paint material, in seven settings (and Matte Leather's, which has no gloss). */
export type Finish = 'matte' | 'gloss' | 'pearl' | 'metallic' | 'shift' | 'holo' | 'uv'

/** A finish, as the catalog words it. */
export const FINISH_WORDS: Record<Finish, string> = {
  matte: 'Matte',
  gloss: 'High gloss',
  pearl: 'Pearl',
  metallic: 'Metallic',
  shift: 'Color-shifting',
  holo: 'Holographic',
  uv: 'Glows under black light',
}

export interface MoreColor {
  /** A short name for it in addresses and files: "neutron-star". */
  id: string
  name: string
  /** As a hex color. For a paint that shifts, the one color it is shown as where there is room for one. */
  color: string
  finish: Finish
  /** A paint that shifts with the angle it is seen from: the colors it moves through, first to last. */
  shift?: string[]
}

export const MORE_COLORS: MoreColor[] = [
  { id: 'neutron-star', name: 'Neutron Star', color: '#4a52d2', finish: 'shift', shift: ['#051a83', '#4a52d2', '#9375f3'] },
  { id: 'gummi-berry', name: 'Gummi Berry', color: '#724f93', finish: 'shift', shift: ['#49076e', '#724f93', '#a96142'] },
  { id: 'luxury-bronze', name: 'Luxury Bronze', color: '#968677', finish: 'metallic' },
  { id: 'smurf', name: 'Smurf', color: '#56aae3', finish: 'metallic' },
  { id: 'nuclear-pink', name: 'Nuclear Pink', color: '#fa9a9a', finish: 'uv' },
  { id: 'championship-green', name: 'Championship Green', color: '#0b9d6e', finish: 'metallic' },
  { id: 'interstellar-black', name: 'Interstellar Black', color: '#2d3140', finish: 'holo', shift: ['#23242e', '#4f6488', '#6a5690', '#2d3140'] },
  { id: 'hulk-green', name: 'Hulk Green', color: '#42a549', finish: 'metallic' },
  { id: 'reserve-green', name: 'Reserve Green', color: '#978d47', finish: 'shift', shift: ['#15431d', '#3e7839', '#b98e44', '#f5c077'] },
  { id: 'nuclear-green', name: 'Nuclear Green', color: '#aaf68e', finish: 'uv' },
  { id: 'nuclear-violet', name: 'Nuclear Violet', color: '#e9a6e8', finish: 'uv' },
  { id: 'dazzling-pink', name: 'Dazzling Pink', color: '#ce184e', finish: 'metallic' },
  { id: 'palleon-panther', name: 'Palleon Panther', color: '#939f9b', finish: 'shift', shift: ['#9da2aa', '#8fb8b0', '#8fa9c9'] },
  { id: 'giallo-yellow', name: 'Giallo Yellow', color: '#f2c81b', finish: 'gloss' },
  // (Manhattan Blue took Tiffany Blue's place on the launch list of 27 Nov: a pale aqua metallic, its value taken
  // from the paint in its own photographs)
  { id: 'manhattan-blue', name: 'Manhattan Blue', color: '#89becc', finish: 'metallic' },
  { id: 'fractured-love', name: 'Fractured Love', color: '#6e0301', finish: 'metallic' },
]
