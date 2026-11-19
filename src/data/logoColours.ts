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
  '818.webp': { ground: '#ffffff', page: '#5a6670' },
  'acquire.webp': { ground: '#ffffff', page: '#585fa1' },
  'adquick.webp': { ground: '#ffffff', page: '#446e4d' },
  'aether.webp': { ground: '#0e1218', page: '#5a6670' },
  'aidaly.webp': { ground: '#ffffff', page: '#95505b' },
  'alt.webp': { ground: '#fe4f30', page: '#90554a' },
  'amca.webp': { ground: null, page: '#5a6670' },
  'anduril.webp': { ground: null, page: '#5a6670' },
  'antares.webp': { ground: '#ffffff', page: '#5a6670' },
  'atoms-co.webp': { ground: '#000000', page: '#5a6670' },
  'atoms.webp': { ground: null, page: '#5a6670' },
  'avalanche-energy.webp': { ground: '#000000', page: '#5a6670' },
  'bezel.webp': { ground: '#ffffff', page: '#466c62' },
  'cameo.webp': { ground: '#15171b', page: '#984b68' },
  'charthop.webp': { ground: '#ffffff', page: '#6c599e' },
  'clubhouse.webp': { ground: '#ffffff', page: '#6b653e' },
  'copilot.webp': { ground: null, page: '#496687' },
  'crossmint.webp': { ground: '#0e171b', page: '#366e5f' },
  'dispo.webp': { ground: '#ffffff', page: '#526776' },
  'donotpay.webp': { ground: '#ffffff', page: '#8f4b8c' },
  'eight-sleep.webp': { ground: '#050608', page: '#5a6670' },
  'enigma.webp': { ground: '#ffffff', page: '#5a6670' },
  'fourthwall.webp': { ground: '#161712', page: '#5a6670' },
  'galvanick.webp': { ground: '#192b3c', page: '#4f677d' },
  'general-matter.webp': { ground: '#ffffff', page: '#5a6670' },
  'genies.webp': { ground: null, page: '#5a6670' },
  'ghost.webp': { ground: '#ffffff', page: '#5a6670' },
  'giraffe360.webp': { ground: '#ffffff', page: '#706437' },
  'hadrian.webp': { ground: '#002548', page: '#44688a' },
  'hang.webp': { ground: '#0b121c', page: '#5a6670' },
  'hq-trivia.webp': { ground: '#3837c7', page: '#5d5ca5' },
  'hype-vice.webp': { ground: '#ffffff', page: '#5a6670' },
  'kapwing.webp': { ground: '#ffffff', page: '#93534b' },
  'khloud.webp': { ground: '#ffffff', page: '#516684' },
  'layer2.webp': { ground: '#ffffff', page: '#486591' },
  'levels.webp': { ground: '#ffffff', page: '#366e64' },
  'light-phone.webp': { ground: '#1c1c1e', page: '#5a6670' },
  'liquid-death.webp': { ground: '#ffffff', page: '#5a6670' },
  'living-carbon.webp': { ground: '#1c1c1e', page: '#4a6c5c' },
  'lula.webp': { ground: '#ffffff', page: '#47668f' },
  'luminai.webp': { ground: null, page: '#5360a4' },
  'merlin-labs.webp': { ground: '#ffffff', page: '#5a6670' },
  'modretro.webp': { ground: '#000000', page: '#5a6670' },
  'montes.webp': { ground: '#ffffff', page: '#964f55' },
  'moonpay.webp': { ground: '#ffffff', page: '#7a51a5' },
  'night.webp': { ground: '#000000', page: '#5a6670' },
  'oncyber.webp': { ground: '#191919', page: '#5a6670' },
  'outtake.webp': { ground: null, page: '#8a5844' },
  'playgroundai.webp': { ground: '#ffffff', page: '#5a6670' },
  'pogo.webp': { ground: '#8e5aea', page: '#6f5994' },
  'popshop.webp': { ground: null, page: '#5a6b34' },
  'primer.webp': { ground: null, page: '#885945' },
  'robs-popcorn.webp': { ground: '#231f20', page: '#5a6670' },
  'runway.webp': { ground: '#efeee6', page: '#5a6670' },
  'sandbox-vr.webp': { ground: '#ffffff', page: '#5a6670' },
  'sauron.webp': { ground: '#222222', page: '#5a6670' },
  'seated.webp': { ground: '#f7d977', page: '#6c6448' },
  'senra.webp': { ground: '#ffffff', page: '#5a6670' },
  'seso.webp': { ground: '#006e33', page: '#376f51' },
  'shinkei.webp': { ground: null, page: '#805e3f' },
  'snackpass.webp': { ground: '#ffffff', page: '#5a6670' },
  'snappr.webp': { ground: '#000000', page: '#5a6670' },
  'sundays.webp': { ground: '#ffffff', page: '#6c6635' },
  'superhuman.webp': { ground: '#ffffff', page: '#885760' },
  'superplastic.webp': { ground: '#ffffff', page: '#5a6670' },
  'the-network.webp': { ground: '#ffffff', page: '#5a6670' },
  'thirdweb.webp': { ground: '#000000', page: '#93488a' },
  'tone.webp': { ground: null, page: '#5a6670' },
  'varda.webp': { ground: '#0a3065', page: '#476690' },
  'voiceflow.webp': { ground: '#ffffff', page: '#5a6670' },
  'w-labs.webp': { ground: null, page: '#656833' },
}

export interface PosterColours {
  /** Along the picture's top, where the status bar is. */
  top: string
  /** The page under the picture: the colour of its foot, dark enough for white words. */
  page: string
}

/** The same for each picture that heads a card in place of a logo (public/posters). */
export const POSTER_COLOURS: Record<string, PosterColours> = {}
