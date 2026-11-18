// The portfolio: one list, in the order Shrug gives its companies in, each
// carrying the vertical it is in. The names and their order are Shrug's own
// list; the verticals are from the design canvas; a company's website and
// one-line description are from the portfolio page of shrug.vc, where it has
// them. A logo is the company's own site icon, kept in public/logos;
// `logo: null` means none could be confirmed, and the window shows the
// company's initial until a file is added.

import { typeset } from './typeset'

export interface Company {
  /** What tells it from every other company: its name, except for the one whose name another company has too. */
  key: string
  name: string
  /** The vertical it is in: one of the names in VERTICAL_ORDER. */
  vertical: string
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

/** Shrug's caption for its social apps, which is what their vertical is called. */
const SOCIAL = '“Social is Hard” — Evan'

/** The verticals, in the order they are listed in. */
const VERTICAL_ORDER = ['Deep tech', 'Climate and energy', 'Creator', 'Health', 'Consumer', 'Fintech', 'Web3', 'Marketplaces', 'AI', 'Products', 'Enterprise', SOCIAL, 'Other'] as const

type VerticalName = (typeof VERTICAL_ORDER)[number]

const c = (name: string, vertical: VerticalName, url: string | null, logo: string | null, blurb: string | null = null, key = name): Company => ({ key, name, vertical, url, blurb: blurb && typeset(blurb), logo })

/** Every company, in Shrug's order. */
export const COMPANIES: Company[] = [
  c('Varda', 'Deep tech', 'http://varda.com', 'varda.webp', 'Space factories for Earth-bound products'),
  c('Hadrian', 'Deep tech', 'http://hadrian.co', 'hadrian.webp', 'Advanced manufacturing for aerospace & defense'),
  c('Senra', 'Deep tech', 'http://senrasystems.us', 'senra.webp', 'Wire harnesses in two weeks!'),
  c('Antares', 'Deep tech', 'http://antaresindustries.com', 'antares.webp', 'Abundant energy from Earth to the asteroid belt.'),
  c('Anduril', 'Deep tech', 'http://anduril.com', 'anduril.webp', 'Not your traditional defense contractor'),
  c('AMCA', 'Deep tech', 'http://amca.co', 'amca.webp'),
  c('Avalanche Energy', 'Climate and energy', 'http://avalanchefusion.com', 'avalanche-energy.webp', 'Micro-fusion reactors for distributed energy'),
  c('Eight Sleep', 'Health', 'http://eightsleep.com', 'eight-sleep.webp', 'The ultimate sleep fitness machine'),
  c('ModRetro', 'Consumer', 'http://modretro.com', 'modretro.webp'),
  c('General Matter', 'Climate and energy', 'https://generalmatter.com', 'general-matter.webp'),
  c('Genies', 'Consumer', 'http://genies.com', 'genies.webp', 'Star-studded digital avatars'),
  c('RTFKT', 'Web3', 'http://rtfkt.com', null, 'Avatars & collectibles for the metaverse'),
  c('Montes', 'Consumer', 'http://montesportland.com', 'montes.webp'),
  c('Cloud23', 'Consumer', 'https://cloud23.com', null),
  c('Superplastic', 'Consumer', 'http://superplastic.co', 'superplastic.webp', 'The world\'s top creator of animated celebs'),
  c('Runway', 'Fintech', 'http://runway.com', 'runway.webp', 'Understand the financial health of your business'),
  c('Sandbox VR', 'Products', 'http://sandboxvr.com', 'sandbox-vr.webp', 'Full-body immersive VR with friends'),
  c('MoonPay', 'Web3', 'http://moonpay.com', 'moonpay.webp', 'A fast and simple way to buy and sell crypto'),
  c('Bezel', 'Marketplaces', 'http://shop.getbezel.com', 'bezel.webp', 'Fully authenticated watch marketplace'),
  c('AdQuick', 'Marketplaces', 'http://adquick.com', 'adquick.webp', 'Out-of-home advertising made easy.'),
  c('Shinkei', 'Products', 'http://shinkei.systems', 'shinkei.webp'),
  c('Opal', 'Products', 'http://opalcamera.com', null, 'The first professional webcamera'),
  c('Merlin Labs', 'Deep tech', 'http://merlinlabs.com', 'merlin-labs.webp', 'Aviation technology for fully autonomous flights'),
  c('Galvanick', 'Deep tech', 'http://galvanick.com', 'galvanick.webp', 'Cybersecurity for industrial control systems'),
  c('Enigma', 'Deep tech', 'http://enigmalabs.io', 'enigma.webp'),
  c('Khloud', 'Creator', 'https://khloudfoods.com/', 'khloud.webp', 'Kardashian Protein Popcorn'),
  c('W Labs', 'Creator', 'http://getw.com', 'w-labs.webp', 'Jake Paul\'s Personal Care'),
  c('Night', 'Creator', 'https://www.night.co', 'night.webp'),
  c('Rob’s Popcorn', 'Creator', 'https://eatrobs.com/', 'robs-popcorn.webp', 'The Jonas Brothers popcorn!'),
  c('Living Carbon', 'Climate and energy', 'http://livingcarbon.com', 'living-carbon.webp', 'Carbon-capturing supertrees 🌱'),
  c('Mona Lee Solar', 'Climate and energy', 'http://monalee.co', null, 'Frictionless solar installation for your home'),
  c('Fourthwall', 'Creator', 'http://fourthwall.com', 'fourthwall.webp', 'All-in-one monetization platform for creators'),
  c('BloxSnacks', 'Creator', 'http://bloxsnacks.com', null, 'Creator snacks & beverages for kids'),
  c('Tone', 'Creator', 'http://tone.shop', 'tone.webp'),
  c('Loyal', 'Health', 'http://loyal.com', null, 'Life extension for dogs'),
  c('Liquid Death', 'Consumer', 'http://liquiddeath.com', 'liquid-death.webp', 'Mountain water that murders your thirst 💀'),
  c('Levels', 'Health', 'http://levels.com', 'levels.webp', 'Unlock your metabolic health'),
  c('Pogo', 'Consumer', 'http://joinpogo.com', 'pogo.webp', 'Unlock the power of your data to earn money'),
  c('Snackpass', 'Consumer', 'http://snackpass.co', 'snackpass.webp', 'Food meets friends on college campuses'),
  c('Primer', 'Consumer', 'http://primer.com', 'primer.webp', 'Where ambitious kids unlock their potential'),
  c('Hype & Vice', 'Consumer', 'http://hypeandvice.com', 'hype-vice.webp', '#1 college apparel brand for women'),
  c('Light Phone', 'Consumer', 'http://thelightphone.com', 'light-phone.webp'),
  c('Drumroll', 'Consumer', null, null),
  c('Cameo', 'Consumer', 'http://cameo.com/', 'cameo.webp', 'Personalized videos from your favorite people'),
  c('Lula', 'Fintech', 'https://shrug.notion.site/Lula-5b80af9245dd441d931194856fa0f9d3', 'lula.webp', 'Insurance API for the modern economy'),
  c('Aidaly', 'Fintech', 'http://aidaly.com', 'aidaly.webp', 'Getting family caregivers paid for their work'),
  c('Copilot', 'Fintech', 'http://copilot.money', 'copilot.webp', 'The app that changes the way you see your money'),
  c('OnCyber', 'Web3', 'https://oncyber.io/', 'oncyber.webp', 'World-building engine for web3'),
  c('Thirdweb', 'Web3', 'http://thirdweb.com', 'thirdweb.webp', 'The fastest way to build web3 apps'),
  c('Sundays', 'Products', 'http://sundaysfordogs.com', 'sundays.webp', 'Ready-to-eat human grade dog food'),
  c('Luminai', 'Products', 'http://luminai.com', 'luminai.webp', 'Superhuman for customer support'),
  c('Giraffe360', 'Products', 'http://giraffe360.com', 'giraffe360.webp', 'Digitizing physical spaces'),
  c('Kapwing', 'Products', 'http://kapwing.com/', 'kapwing.webp', 'Create more content in less time'),
  c('Aether', 'Enterprise', 'http://aetherbio.com', 'aether.webp'),
  c('Charthop', 'Enterprise', 'http://charthop.com', 'charthop.webp', 'The data platform for people leaders'),
  c('Crossmint', 'Web3', 'http://crossmint.com', 'crossmint.webp', 'NFT infrastructure for developers'),
  c('Layer2', 'Web3', 'http://rail.io', 'layer2.webp', 'Secure, regulated crypto banking as a service'),
  c('Hang', 'Web3', 'http://hang.com', 'hang.webp', 'Loyalty programs for brands powered by NFTs'),
  c('Alt', 'Marketplaces', 'https://shrug.notion.site/Alt-31a8f4ddc2f44df9a3b737ee87617892', 'alt.webp', 'Unlocking the value of alternative assets'),
  c('Seso', 'Marketplaces', 'http://sesolabor.com', 'seso.webp', 'Labor marketplace for the agriculture industry'),
  c('Acquire', 'Marketplaces', 'http://acquire.com', 'acquire.webp', 'The #1 startup acquisition marketplace'),
  c('Ghost', 'Marketplaces', 'http://ghst.io', 'ghost.webp', 'Private b2b marketplace for excess inventory'),
  c('Snappr', 'Marketplaces', 'http://snappr.com', 'snappr.webp', 'Professional photographers on-demand'),
  c('Seated', 'Marketplaces', 'https://www.seatedapp.io/', 'seated.webp', 'Earn rewards at your favorite restaurants'),
  c('The Network', 'Marketplaces', 'http://thenetwork.com', 'the-network.webp', 'It’s private.'),
  c('Outtake', 'AI', 'http://outtake.ai', 'outtake.webp'),
  c('Superhuman', 'AI', 'http://superhuman.com', 'superhuman.webp', 'Incredibly useful Superhuman AI implementation ⚡️'),
  c('Sauron', 'AI', 'http://sauron.systems', 'sauron.webp'),
  c('Voiceflow', 'AI', 'http://voiceflow.com', 'voiceflow.webp', 'Build amazing conversational AI assistants'),
  c('DoNotPay', 'AI', 'http://donotpay.com', 'donotpay.webp', 'The world\'s first robot lawyer'),
  c('PlaygroundAI', 'AI', 'https://playgroundai.com/', 'playgroundai.webp', 'Create any image from your imagination'),
  // Two companies are called Atoms. The one at atoms.co is told from the other by its key; its address tells them apart on screen
  c('Atoms', 'Products', 'https://atoms.co', 'atoms-co.webp', null, 'Atoms (atoms.co)'),
  c('Atoms', 'Products', 'https://atoms.com/', 'atoms.webp', 'The most comfortable everyday shoes'),
  c('HQ Trivia', SOCIAL, null, 'hq-trivia.webp', 'A live gameshow that anyone can win'),
  c('Clubhouse', SOCIAL, null, 'clubhouse.webp', 'A space for casual, drop-in audio conversations'),
  c('Poparazzi', SOCIAL, null, null, 'Photo sharing app curated by your friends'),
  c('Dispo', SOCIAL, null, 'dispo.webp', 'The digital disposable camera app'),
  c('YOLO', SOCIAL, null, null),
  c('Popshop Live', SOCIAL, null, 'popshop.webp', 'Livestream shopping app'),
  c('818 Tequila', 'Other', 'https://drink818.com/', '818.webp', 'Award winning tequila'),
  c('Sprinter', 'Other', 'https://drinksprinter.com', null),
]

/** The companies by vertical: each vertical's in the order of the list. A vertical with nothing in it is left out. */
export const VERTICALS: Vertical[] = VERTICAL_ORDER.map((name) => ({ name, companies: COMPANIES.filter((company) => company.vertical === name) })).filter((v) => v.companies.length > 0)

export const COMPANY_COUNT = COMPANIES.length
