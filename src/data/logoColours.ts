// Two colours for each company's logo, read from the logo itself by tools/logo-colours.py: the ground
// it is drawn on (null where the picture runs to its edges), and the colour its contact card is tinted.
// Written by that tool; run it again when a logo is added or changed.

export interface LogoColours {
  /** What the logo sits on: the round face on its card is filled with it, and the logo drawn inside. */
  ground: string | null
  /** Its card's page: the logo's own colour, dark enough for white words. */
  page: string
}

/** For a company with no logo: a slate. */
export const PLAIN_PAGE = '#5a6670'

export const LOGO_COLOURS: Record<string, LogoColours> = {
  '818-tequila.webp': { ground: '#e3e2c9', page: '#5a6670' },
  '818.webp': { ground: '#ffffff', page: '#5a6670' },
  'acquire.webp': { ground: '#ffffff', page: '#585fa1' },
  'adquick.webp': { ground: '#ffffff', page: '#446e4d' },
  'aether.webp': { ground: '#0e1218', page: '#5a6670' },
  'aidaly.webp': { ground: '#ffffff', page: '#95505b' },
  'alt.webp': { ground: '#3e51f8', page: '#575fa1' },
  'amca.webp': { ground: null, page: '#54676d' },
  'anduril.webp': { ground: null, page: '#5a6670' },
  'antares.webp': { ground: '#ffffff', page: '#5a6670' },
  'atoms-co.webp': { ground: '#000000', page: '#5a6670' },
  'atoms.webp': { ground: '#000000', page: '#5a6670' },
  'avalanche-energy.webp': { ground: '#000000', page: '#5a6670' },
  'bezel.webp': { ground: '#ffffff', page: '#466c62' },
  'bloxsnacks.webp': { ground: '#97cffe', page: '#556775' },
  'cameo.webp': { ground: '#0b0d0f', page: '#994b68' },
  'charthop.webp': { ground: '#ffffff', page: '#6c599e' },
  'cloud23.webp': { ground: '#e9f3fb', page: '#5a6670' },
  'clubhouse.webp': { ground: '#ffffff', page: '#6b653e' },
  'copilot.webp': { ground: '#07162a', page: '#5a6670' },
  'crossmint.webp': { ground: '#0e171b', page: '#366e5f' },
  'dispo.webp': { ground: '#ffffff', page: '#526776' },
  'donotpay.webp': { ground: '#ffffff', page: '#8f4b8c' },
  'drumroll.webp': { ground: '#ad78f5', page: '#6f5c8a' },
  'eight-sleep.webp': { ground: '#000000', page: '#5a6670' },
  'enigma.webp': { ground: '#000000', page: '#5a6670' },
  'fourthwall.webp': { ground: '#161712', page: '#5a6670' },
  'galvanick.webp': { ground: '#1e2b3d', page: '#54667e' },
  'genies.webp': { ground: '#000000', page: '#5a6670' },
  'ghost.webp': { ground: '#ffffff', page: '#5a6670' },
  'giraffe360.webp': { ground: null, page: '#706437' },
  'hadrian.webp': { ground: '#00274e', page: '#45678b' },
  'hang.webp': { ground: '#0b121c', page: '#5a6670' },
  'hq-trivia.webp': { ground: '#36389b', page: '#5d5e9e' },
  'hype-vice.webp': { ground: '#000000', page: '#5a6670' },
  'kapwing.webp': { ground: '#ffffff', page: '#93534b' },
  'khloud.webp': { ground: null, page: '#48678b' },
  'layer2.webp': { ground: '#ffffff', page: '#486591' },
  'levels.webp': { ground: '#ffffff', page: '#366e64' },
  'light-phone.webp': { ground: '#c6c5c1', page: '#5a6670' },
  'liquid-death.webp': { ground: null, page: '#605aad' },
  'living-carbon.webp': { ground: null, page: '#4a6c5d' },
  'loyal.webp': { ground: '#2a3447', page: '#59657b' },
  'lula.webp': { ground: '#ffffff', page: '#47658f' },
  'luminai.webp': { ground: '#0f171b', page: '#366e5f' },
  'merlin-labs.webp': { ground: '#ffffff', page: '#5a6670' },
  'modretro.webp': { ground: '#000000', page: '#5a6670' },
  'montes.webp': { ground: '#ffffff', page: '#8d554b' },
  'moonpay.webp': { ground: '#7715f3', page: '#7852a7' },
  'night.webp': { ground: '#000000', page: '#5a6670' },
  'oncyber.webp': { ground: '#191919', page: '#5a6670' },
  'opal.webp': { ground: '#ffffff', page: '#5a6670' },
  'outtake.webp': { ground: null, page: '#8a5844' },
  'playgroundai.webp': { ground: '#ffffff', page: '#5a6670' },
  'pogo.webp': { ground: '#8e5aea', page: '#6f5994' },
  'poparazzi.webp': { ground: '#f2efe5', page: '#6b663f' },
  'popshop.webp': { ground: null, page: '#5a6b34' },
  'primer.webp': { ground: null, page: '#885945' },
  'robs-popcorn.webp': { ground: '#ffffff', page: '#6f634c' },
  'rtfkt.webp': { ground: null, page: '#915165' },
  'runway.webp': { ground: '#efeee6', page: '#5a6670' },
  'sandbox-vr.webp': { ground: '#ffffff', page: '#5a6670' },
  'sauron.webp': { ground: '#222222', page: '#5a6670' },
  'seated.webp': { ground: '#f7d977', page: '#6c6448' },
  'senra.webp': { ground: '#ffffff', page: '#5a6670' },
  'seso.webp': { ground: '#393b3c', page: '#5a6670' },
  'shinkei.webp': { ground: null, page: '#805e3f' },
  'snackpass.webp': { ground: '#ffffff', page: '#5a6670' },
  'snappr.webp': { ground: '#000000', page: '#5a6670' },
  'sundays.webp': { ground: '#ffffff', page: '#6c6635' },
  'superhuman.webp': { ground: '#ffffff', page: '#885760' },
  'superplastic.webp': { ground: null, page: '#476b68' },
  'the-network.webp': { ground: '#ffffff', page: '#5a6670' },
  'thirdweb.webp': { ground: '#262626', page: '#5a6670' },
  'tone.webp': { ground: '#faf7ed', page: '#5a6670' },
  'varda.webp': { ground: '#0a3065', page: '#476690' },
  'voiceflow.webp': { ground: '#ffffff', page: '#5a6670' },
  'w-labs.webp': { ground: null, page: '#676735' },
}

export interface PosterColours {
  /** Along the picture's top, where the status bar is. */
  top: string
  /** The page under the picture: the colour of its foot, dark enough for white words. */
  page: string
}

/** The same for each picture that heads a card in place of a logo (public/posters). */
export const POSTER_COLOURS: Record<string, PosterColours> = {}
