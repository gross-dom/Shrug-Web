// The portfolio, grouped by vertical. Names and verticals are from the design
// canvas; each company's website and one-line description are from the
// portfolio page of shrug.vc. A logo is the company's own site icon, kept in
// public/logos; `logo: null` means none could be confirmed, and the window
// shows the company's initial until a file is added.

export interface Company {
  name: string
  /** Where its icon opens: the company's site, or its Shrug case study. */
  url: string | null
  /** One line on what it does, as shrug.vc has it. */
  blurb: string | null
  /** A file in public/logos. */
  logo: string | null
}

export interface Vertical {
  name: string
  companies: Company[]
}

const c = (name: string, url: string | null, logo: string | null, blurb: string | null = null): Company => ({ name, url, blurb, logo })

export const VERTICALS: Vertical[] = [
  {
    name: 'Deep tech',
    companies: [
      c('Hadrian', 'http://hadrian.co', 'hadrian.webp', 'Advanced manufacturing for aerospace & defense'),
      c('Varda', 'http://varda.com', 'varda.webp', 'Space factories for Earth-bound products'),
      c('Senra', 'http://senrasystems.us', null, 'Wire harnesses in two weeks!'),
      c('Antares', 'http://antaresindustries.com', 'antares.webp', 'Abundant energy from Earth to the asteroid belt.'),
      c('Enigma', 'http://enigmalabs.io', 'enigma.webp'),
      c('Anduril', 'http://anduril.com', 'anduril.webp', 'Not your traditional defense contractor'),
      c('Merlin Labs', 'http://merlinlabs.com', 'merlin-labs.webp', 'Aviation technology for fully autonomous flights'),
      c('Galvanick', 'http://galvanick.com', 'galvanick.webp', 'Cybersecurity for industrial control systems'),
      c('AMCA', 'http://amca.co', 'amca.webp'),
    ],
  },
  {
    name: 'Climate and energy',
    companies: [
      c('Avalanche Energy', 'http://avalanchefusion.com', 'avalanche-energy.webp', 'Micro-fusion reactors for distributed energy'),
      c('Earth', 'http://earthfuneral.com', 'earth.webp', 'Carbon-neutral funerals'),
      c('Living Carbon', 'http://livingcarbon.com', 'living-carbon.webp', 'Carbon-capturing supertrees 🌱'),
      c('Mona Lee Solar', 'http://monalee.co', null, 'Frictionless solar installation for your home'),
    ],
  },
  {
    name: 'Creator',
    companies: [
      c('Khloud', 'https://khloudfoods.com/', 'khloud.webp', 'Kardashian Protein Popcorn'),
      c('W Labs', 'http://getw.com', 'w-labs.webp', 'Jake Paul\'s Personal Care'),
      c('Night', 'https://www.night.co', 'night.webp'),
      c('Feastables', 'http://feastables.com', 'feastables.webp', 'Better-for-you snacks by MrBeast'),
      c('Rob’s Popcorn', 'https://eatrobs.com/', 'robs-popcorn.webp', 'The Jonas Brothers popcorn!'),
      c('Homemade', 'http://homemade.co/', null, 'Flip homes like the Austin Flipsters'),
      c('Tone', 'http://tone.shop', 'tone.webp'),
      c('BloxSnacks', 'http://bloxsnacks.com', null, 'Creator snacks & beverages for kids'),
      c('Fourthwall', 'http://fourthwall.com', 'fourthwall.webp', 'All-in-one monetization platform for creators'),
    ],
  },
  {
    name: 'Health',
    companies: [
      c('Eight Sleep', 'http://eightsleep.com', 'eight-sleep.webp', 'The ultimate sleep fitness machine'),
      c('Nucleus', 'http://mynucleus.com', 'nucleus.webp', 'Analyze your genetic makeup and DNA 🧬'),
      c('Summer Health', 'http://summerhealth.com', 'summer-health.webp', 'Text with a pediatrician instantly about anything'),
      c('Loyal', 'http://loyal.com', null, 'Life extension for dogs'),
      c('Levels', 'http://levels.com', 'levels.webp', 'Unlock your metabolic health'),
    ],
  },
  {
    name: 'Consumer',
    companies: [
      c('ModRetro', 'http://modretro.com', 'modretro.webp'),
      c('Supergreat', 'https://supergreat.com/', null, 'Real beauty reviews from real people'),
      c('Genies', 'http://genies.com', 'genies.webp', 'Star-studded digital avatars'),
      c('Pogo', 'http://joinpogo.com', 'pogo.webp', 'Unlock the power of your data to earn money'),
      c('Snackpass', 'http://snackpass.co', 'snackpass.webp', 'Food meets friends on college campuses'),
      c('Primer', 'http://primer.com', 'primer.webp', 'Where ambitious kids unlock their potential'),
      c('Superplastic', 'http://superplastic.co', 'superplastic.webp', 'The world\'s top creator of animated celebs'),
      c('Liquid Death', 'http://liquiddeath.com', 'liquid-death.webp', 'Mountain water that murders your thirst 💀'),
      c('Hype & Vice', 'http://hypeandvice.com', 'hype-vice.webp', '#1 college apparel brand for women'),
      c('Montes', 'http://montesportland.com', 'montes.webp'),
      c('Light Phone', 'http://thelightphone.com', 'light-phone.webp'),
      c('Drumroll', null, null),
      c('Cameo', 'http://cameo.com/', 'cameo.webp', 'Personalized videos from your favorite people'),
    ],
  },
  {
    name: 'Fintech',
    companies: [
      c('Lula', 'https://shrug.notion.site/Lula-5b80af9245dd441d931194856fa0f9d3', null, 'Insurance API for the modern economy'),
      c('MainStreet', 'https://mainstreet.com/', 'mainstreet.webp', 'Free money for startups and SMBs'),
      c('Seis', 'http://seis.com', null, 'Banking for US Spanish speakers'),
      c('Aidaly', 'http://aidaly.com', 'aidaly.webp', 'Getting family caregivers paid for their work'),
      c('Copilot', 'http://copilot.money', 'copilot.webp', 'The app that changes the way you see your money'),
      c('Runway', 'http://runway.com', 'runway.webp', 'Understand the financial health of your business'),
      c('Pipe', 'http://pipe.com', 'pipe.webp', 'Turn your recurring revenue into upfront capital'),
    ],
  },
  {
    name: 'Web3',
    companies: [
      c('RTFKT', 'http://rtfkt.com', null, 'Avatars & collectibles for the metaverse'),
      c('MoonPay', 'http://moonpay.com', 'moonpay.webp', 'A fast and simple way to buy and sell crypto'),
      c('OnCyber', 'https://oncyber.io/', 'oncyber.webp', 'World-building engine for web3'),
      c('Thirdweb', 'http://thirdweb.com', 'thirdweb.webp', 'The fastest way to build web3 apps'),
      c('Crossmint', 'http://crossmint.com', 'crossmint.webp', 'NFT infrastructure for developers'),
      c('Once Upon', 'http://onceupon.xyz', null, 'The human-readable web3 block explorer'),
      c('Layer2', 'http://rail.io', 'layer2.webp', 'Secure, regulated crypto banking as a service'),
      c('Hang', 'http://hang.com', 'hang.webp', 'Loyalty programs for brands powered by NFTs'),
    ],
  },
  {
    name: 'Marketplaces',
    companies: [
      c('Alt', 'https://shrug.notion.site/Alt-31a8f4ddc2f44df9a3b737ee87617892', 'alt.webp', 'Unlocking the value of alternative assets'),
      c('Seso', 'http://sesolabor.com', 'seso.webp', 'Labor marketplace for the agriculture industry'),
      c('Acquire', 'http://acquire.com', 'acquire.webp', 'The #1 startup acquisition marketplace'),
      c('Ghost', 'http://ghst.io', 'ghost.webp', 'Private b2b marketplace for excess inventory'),
      c('Snappr', 'http://snappr.com', 'snappr.webp', 'Professional photographers on-demand'),
      c('AdQuick', 'http://adquick.com', 'adquick.webp', 'Out-of-home advertising made easy.'),
      c('The Network', 'http://thenetwork.com', 'the-network.webp', 'It’s private.'),
      c('Bezel', 'http://shop.getbezel.com', 'bezel.webp', 'Fully authenticated watch marketplace'),
      c('Seated', 'https://www.seatedapp.io/', 'seated.webp', 'Earn rewards at your favorite restaurants'),
    ],
  },
  {
    name: 'AI',
    companies: [
      c('Diagram', 'https://diagram.com/', null, 'AI-powered design tools'),
      c('Mem.ai', 'http://get.mem.ai', 'mem-ai.webp', 'Your personalized AI knowledge assistant'),
      c('PlaygroundAI', 'https://playgroundai.com/', 'playgroundai.webp', 'Create any image from your imagination'),
      c('DoNotPay', 'http://donotpay.com', 'donotpay.webp', 'The world\'s first robot lawyer'),
      c('Voiceflow', 'http://voiceflow.com', 'voiceflow.webp', 'Build amazing conversational AI assistants'),
      c('Betterleap', 'http://betterleap.com', 'betterleap.webp', 'AI-powered outbound recruiting platform'),
      c('Sauron', 'http://sauron.systems', 'sauron.webp'),
      c('Superhuman', 'http://superhuman.com', 'superhuman.webp', 'Incredibly useful Superhuman AI implementation ⚡️'),
      c('Outtake', 'http://outtake.ai', 'outtake.webp'),
      c('Tome', 'http://tome.com/', null, 'Instantly review SAFEs with AI'),
    ],
  },
  {
    name: 'Products',
    companies: [
      c('Atoms', 'https://atoms.com/', 'atoms.webp', 'The most comfortable everyday shoes'),
      c('Opal', 'http://opalcamera.com', null, 'The first professional webcamera'),
      c('Carrd', 'http://carrd.co', 'carrd.webp', 'No-code fully responsive sites for anything'),
      c('Canal', 'http://shopcanal.com', 'canal.webp', 'A dropshipping platform for modern brands'),
      c('Sundays', 'http://sundaysfordogs.com', 'sundays.webp', 'Ready-to-eat human grade dog food'),
      c('Luminai', 'http://luminai.com', 'luminai.webp', 'Superhuman for customer support'),
      c('Sandbox VR', 'http://sandboxvr.com', 'sandbox-vr.webp', 'Full-body immersive VR with friends'),
      c('Giraffe360', 'http://giraffe360.com', 'giraffe360.webp', 'Digitizing physical spaces'),
      c('Shinkei', 'http://shinkei.systems', 'shinkei.webp'),
      c('Kapwing', 'http://kapwing.com/', 'kapwing.webp', 'Create more content in less time'),
      c('Cabal', 'https://getcabal.com/', 'cabal.webp', 'Get more out of your investors & advisors'),
    ],
  },
  {
    name: 'Enterprise',
    companies: [
      c('Charthop', 'http://charthop.com', 'charthop.webp', 'The data platform for people leaders'),
      c('Aether', 'http://aetherbio.com', 'aether.webp'),
    ],
  },
  {
    name: 'Social',
    companies: [
      c('Clubhouse', null, 'clubhouse.webp', 'A space for casual, drop-in audio conversations'),
      c('Poparazzi', null, null, 'Photo sharing app curated by your friends'),
      c('HQ Trivia', null, 'hq-trivia.webp', 'A live gameshow that anyone can win'),
      c('Popshop', null, 'popshop.webp', 'Livestream shopping app'),
      c('Freestyle Chess', 'http://freestyle-chess.com', 'freestyle-chess.webp'),
      c('Dispo', null, 'dispo.webp', 'The digital disposable camera app'),
    ],
  },
  {
    name: 'Other',
    companies: [
      c('818', 'https://drink818.com/', '818.webp', 'Award winning tequila'),
      c('Memora Health', 'http://memorahealth.com/', 'memora-health.webp', 'Care enablement platform'),
      c('Overtime', 'http://overtime.tv', 'overtime.webp', 'Next-gen sports media'),
      c('Blank Street', 'http://blankstreet.com/', 'blank-street.webp', 'Tech-enabled coffee shops'),
    ],
  },
]

export const COMPANY_COUNT = VERTICALS.reduce((n, v) => n + v.companies.length, 0)
