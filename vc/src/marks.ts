// The companies' own marks: each one as the company's own website draws it at the head of its pages, taken
// from there on 24 November 2026. What is kept of a mark is its shape and nothing else: a picture in
// vc/public/companies that holds only how see-through each point is, with no colour of the company's, so
// that the page can draw every one in the colour of its own text, light or dark (Portfolio.tsx draws them
// as masks). `w` and `h` are the picture's size, which gives the page the mark's proportions before the
// picture has arrived.
//
// Six were not to be had from a site (down, shut, or closed to anything but a person at a browser) and are
// from files Shrug sent, brought into the same form: Cameo, Cloud23, Enigma, Alt, Poparazzi and HQ Trivia
// (its "HQ"). Every company on the page has one; a company added to the list without one shows its name
// in type until it has.
//
// Five sites show a symbol and no lettering, and that symbol is what is here: AMCA, OnCyber, RTFKT, Sprinter
// (whose site is now its drink's, k2o) and W Labs. Light Phone's reads "light", as its site has it. Popshop
// Live's is its own lettering without the line beneath it that credits another company.
//
// A company is named here by its `key` in src/data/portfolio.ts. To replace one, or add one: save the
// company's wordmark in vc/public/companies as an SVG, PNG or WebP with a clear background (any one colour),
// and give its file and its size here.

export interface Mark {
  /** A file in vc/public/companies. */
  file: string
  w: number
  h: number
}

export const MARKS: Record<string, Mark> = {
  Varda: { file: 'varda.webp', w: 640, h: 170 },
  Hadrian: { file: 'hadrian.webp', w: 640, h: 104 },
  Senra: { file: 'senra.webp', w: 640, h: 122 },
  Antares: { file: 'antares.webp', w: 640, h: 56 },
  Anduril: { file: 'anduril.webp', w: 636, h: 120 },
  AMCA: { file: 'amca.webp', w: 204, h: 150 },
  'Avalanche Energy': { file: 'avalanche-energy.webp', w: 640, h: 113 },
  'Eight Sleep': { file: 'eight-sleep.webp', w: 490, h: 199 },
  ModRetro: { file: 'modretro.webp', w: 640, h: 77 },
  Genies: { file: 'genies.webp', w: 528, h: 108 },
  RTFKT: { file: 'rtfkt.webp', w: 401, h: 192 },
  Montes: { file: 'montes.webp', w: 640, h: 172 },
  Superplastic: { file: 'superplastic.webp', w: 640, h: 81 },
  Runway: { file: 'runway.webp', w: 517, h: 117 },
  'Sandbox VR': { file: 'sandbox-vr.webp', w: 640, h: 98 },
  MoonPay: { file: 'moonpay.webp', w: 572, h: 120 },
  Bezel: { file: 'bezel.webp', w: 456, h: 108 },
  AdQuick: { file: 'adquick.webp', w: 640, h: 104 },
  Shinkei: { file: 'shinkei.webp', w: 600, h: 137 },
  Opal: { file: 'opal.webp', w: 390, h: 120 },
  'Merlin Labs': { file: 'merlin-labs.webp', w: 591, h: 96 },
  Galvanick: { file: 'galvanick.webp', w: 640, h: 82 },
  Khloud: { file: 'khloud.webp', w: 640, h: 175 },
  'W Labs': { file: 'w-labs.webp', w: 377, h: 300 },
  Night: { file: 'night.webp', w: 640, h: 80 },
  'Rob’s Popcorn': { file: 'rob-s-popcorn.webp', w: 640, h: 144 },
  'Living Carbon': { file: 'living-carbon.webp', w: 640, h: 118 },
  Fourthwall: { file: 'fourthwall.webp', w: 640, h: 114 },
  BloxSnacks: { file: 'bloxsnacks.webp', w: 411, h: 177 },
  Tone: { file: 'tone.webp', w: 640, h: 128 },
  Loyal: { file: 'loyal.webp', w: 476, h: 192 },
  'Liquid Death': { file: 'liquid-death.webp', w: 560, h: 141 },
  Levels: { file: 'levels.webp', w: 640, h: 102 },
  Pogo: { file: 'pogo.webp', w: 394, h: 192 },
  Snackpass: { file: 'snackpass.webp', w: 640, h: 134 },
  Primer: { file: 'primer.webp', w: 599, h: 162 },
  'Hype & Vice': { file: 'hype-vice.webp', w: 640, h: 56 },
  'Light Phone': { file: 'light-phone.webp', w: 360, h: 174 },
  Drumroll: { file: 'drumroll.webp', w: 640, h: 84 },
  Aidaly: { file: 'aidaly.webp', w: 640, h: 163 },
  Copilot: { file: 'copilot.webp', w: 640, h: 112 },
  OnCyber: { file: 'oncyber.webp', w: 252, h: 144 },
  Thirdweb: { file: 'thirdweb.webp', w: 640, h: 94 },
  Sundays: { file: 'sundays.webp', w: 640, h: 182 },
  Luminai: { file: 'luminai.webp', w: 610, h: 144 },
  Giraffe360: { file: 'giraffe360.webp', w: 640, h: 84 },
  Kapwing: { file: 'kapwing.webp', w: 640, h: 78 },
  Aether: { file: 'aether.webp', w: 640, h: 64 },
  Charthop: { file: 'charthop.webp', w: 640, h: 204 },
  Crossmint: { file: 'crossmint.webp', w: 640, h: 120 },
  Hang: { file: 'hang.webp', w: 276, h: 120 },
  Seso: { file: 'seso.webp', w: 640, h: 148 },
  Acquire: { file: 'acquire.webp', w: 640, h: 103 },
  Ghost: { file: 'ghost.webp', w: 552, h: 144 },
  Snappr: { file: 'snappr.webp', w: 640, h: 143 },
  Seated: { file: 'seated.webp', w: 640, h: 129 },
  Outtake: { file: 'outtake.webp', w: 640, h: 114 },
  Superhuman: { file: 'superhuman.webp', w: 640, h: 92 },
  Sauron: { file: 'sauron.webp', w: 640, h: 109 },
  Voiceflow: { file: 'voiceflow.webp', w: 640, h: 117 },
  DoNotPay: { file: 'donotpay.webp', w: 640, h: 129 },
  PlaygroundAI: { file: 'playgroundai.webp', w: 640, h: 127 },
  'Atoms (atoms.co)': { file: 'atoms-atoms-co.webp', w: 612, h: 84 },
  Atoms: { file: 'atoms.webp', w: 640, h: 117 },
  Clubhouse: { file: 'clubhouse.webp', w: 640, h: 116 },
  Dispo: { file: 'dispo.webp', w: 640, h: 164 },
  'Popshop Live': { file: 'popshop-live.webp', w: 640, h: 75 },
  '818 Tequila': { file: '818-tequila.webp', w: 416, h: 246 },
  Sprinter: { file: 'sprinter.webp', w: 414, h: 144 },
  Cameo: { file: 'cameo.webp', w: 640, h: 132 },
  Cloud23: { file: 'cloud23.webp', w: 640, h: 84 },
  Enigma: { file: 'enigma.webp', w: 640, h: 86 },
  Alt: { file: 'alt.webp', w: 640, h: 263 },
  Poparazzi: { file: 'poparazzi.webp', w: 640, h: 43 },
  'HQ Trivia': { file: 'hq-trivia.webp', w: 551, h: 300 },
}
