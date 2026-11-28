// The chair's colors beyond the eight the studio opens on: sixteen more, each made to order. Workspace shows
// them as a grid to pick from (src/apps/Workspace.tsx); the store sells each as a chair of its own (in the
// demo, store/src/demo.ts; for real, a row each in Shrug's Products).
//
// They are Shrug's own: the names, finishes and values are from the Workspace design as redrawn on 25 Nov
// (the "Sixteen more" board of the Shrug.VIP v1 designs, set from the catalog's swatches converted to sRGB;
// where a swatch and the reference photographs disagree, the photographs won). The reference photographs
// are the standard for the paint: a value here is where the match starts. Change one here and everything
// that shows the color follows.

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
  // (Proton Sparkle took Hulk Green's place on 27 Nov, Hulk Green being too near Mantis Green: a paint that goes
  // from maroon to copper, its values taken from the paint in its own photographs)
  { id: 'proton-sparkle', name: 'Proton Sparkle', color: '#9a4c36', finish: 'shift', shift: ['#561d1a', '#9a4c36', '#d07c58'] },
  { id: 'reserve-green', name: 'Reserve Green', color: '#978d47', finish: 'shift', shift: ['#15431d', '#3e7839', '#b98e44', '#f5c077'] },
  { id: 'nuclear-green', name: 'Nuclear Green', color: '#aaf68e', finish: 'uv' },
  { id: 'nuclear-violet', name: 'Nuclear Violet', color: '#e9a6e8', finish: 'uv' },
  // (Dazzling Pink is the magenta of its photographs, which since 27 Nov are the Luxury Pink set: it was a pink-red)
  { id: 'dazzling-pink', name: 'Dazzling Pink', color: '#e434a6', finish: 'metallic' },
  { id: 'palleon-panther', name: 'Palleon Panther', color: '#939f9b', finish: 'shift', shift: ['#9da2aa', '#8fb8b0', '#8fa9c9'] },
  { id: 'giallo-yellow', name: 'Giallo Yellow', color: '#f2c81b', finish: 'gloss' },
  // (Manhattan Blue took Tiffany Blue's place on the launch list of 27 Nov: a pale aqua metallic, its value taken
  // from the paint in its own photographs)
  { id: 'manhattan-blue', name: 'Manhattan Blue', color: '#89becc', finish: 'metallic' },
  { id: 'fractured-love', name: 'Fractured Love', color: '#6e0301', finish: 'metallic' },
]

/** One line about a color, where Shrug has one: said under its name in Workspace's studio, and as the chair's
 * write-up at checkout in the demo (in the real store that is Products → Description, which is Shrug's to
 * write). They are the lines on workspace.vip's page for each (workspace.vip/products/…), as Dom took them
 * on 28 Nov: some whole, some cut to their first sentence, and each under the name the color has here (Mantis
 * Green for Lambo Mantis, Reserve Green for Lambo Reserve, Giallo Yellow for Ferrari Yellow). Supersonic's is
 * the catalog's. A color with no line here (Matte Leather, Scuderia Red, Illusion Blue, Luxury Bronze, Nuclear
 * Pink) has nothing said of it until one is written: none is to be made up. */
export const COLOR_LINES: Record<string, string> = {
  'solar-orange': 'Solar Orange is a rich automotive orange with a high-gloss finish.',
  alexandrite: 'Alexandrite is a beautiful, sparkling transparent blue with gold and violet metallic.',
  supersonic: 'Inspired by Boom Supersonic.',
  'pearl-lavender': 'Pearl Lavender is a light transparent lavender that has a silver sparkle with a high gloss finish.',
  'mantis-green': 'Mantis Green is an OEM matched green with a high gloss finish.',
  'neutron-star': 'Neutron Star is a deep blue to violet color-shifting metallic.',
  'gummi-berry': 'Gummi Berry is a deep, burgundy violet, dusted with gold metallic and a high gloss finish.',
  smurf: 'The Smurf is a sleek sky blue with a subtle color shifting rainbow metallic.',
  'championship-green': 'Designed for the 2024 NBA Champions.',
  'interstellar-black': 'Interstellar Black is a deep black color with a vibrant rainbow color shifting effect.',
  'proton-sparkle': 'Proton Sparkle is a fine red to red/gold color shifting metallic with a high gloss finish.',
  'reserve-green': 'Reserve Green is a rich, emerald green dusted with gold metallic and glossy finish.',
  'nuclear-green': 'Nuclear Green is a light lime green with a cool hue that glows when exposed to black light.',
  'nuclear-violet': 'Nuclear Violet is a rich lavender pink that glows when exposed to black light.',
  'dazzling-pink': 'Dazzling Pink is a pink top coat with a fine metallic sparkle and high gloss finish.',
  // (the page's line has no "a" before "silvery": put in here)
  'palleon-panther': 'Palleon Panther is a silvery white vein that shifts to turquoise green and blue in the light.',
  'giallo-yellow': 'Giallo Yellow is an OEM matched Ferrari Giallo Modena with a gloss finish.',
  'manhattan-blue': 'Manhattan Blue is a shiny turquoise blue metallic with a high gloss finish.',
  'fractured-love': 'Fractured Love is a deep blood red metallic with a “fractured”, high-gloss finish.',
}
