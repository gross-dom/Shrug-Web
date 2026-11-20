import { useId, type ReactNode } from 'react'
import { IN_DISC, ON_TILE, S, VIP_LETTERS } from '../data/logo'
import type { AppId } from './apps'

// The desktop's own icons, drawn here: app icons in the rounded-square shape a
// Dock expects, a document, a folder, and Shrug's logo. The group chat's, the
// notes', the portfolio's and the case studies' are drawn after the Mac apps
// they stand for (Messages, Notes, the Finder, Terminal) as those are drawn
// now, and the folder after a Mac's; VIP and Shrug's own are Shrug's. No file
// from an operating system is used.

/** A continuous-corner square (a superellipse), 100 units across. */
const SQUIRCLE = (() => {
  const n = 5
  const steps = 96
  const pts: string[] = []
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2
    const c = Math.cos(t)
    const s = Math.sin(t)
    const x = 50 + 50 * Math.sign(c) * Math.pow(Math.abs(c), 2 / n)
    const y = 50 + 50 * Math.sign(s) * Math.pow(Math.abs(s), 2 / n)
    pts.push(`${x.toFixed(2)} ${y.toFixed(2)}`)
  }
  return `M${pts.join('L')}Z`
})()

/** Shrug's logo: the s on its tile, cut by it (src/data/logo.ts). A white tile and a black s, unless told otherwise. */
export function Logo({ size = 24, ground = '#fff', ink = '#000', className }: { size?: number | string; ground?: string; ink?: string; className?: string }) {
  return (
    <svg viewBox="0 0 180 180" width={size} height={size} className={className} aria-hidden>
      <rect width="180" height="180" fill={ground} />
      <path d={S} fill={ink} transform={ON_TILE} />
    </svg>
  )
}

/** The logo in a disc, white on black: Shrug's face in a conversation. */
export function LogoDisc({ size = 28, className }: { size?: number | string; className?: string }) {
  const id = useId().replace(/:/g, '')
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} className={className} aria-hidden>
      <defs>
        <clipPath id={`${id}-disc`}>
          <circle cx="100" cy="100" r="100" />
        </clipPath>
      </defs>
      <circle cx="100" cy="100" r="100" fill="#000" />
      <path d={S} fill="#fff" transform={IN_DISC} clipPath={`url(#${id}-disc)`} />
    </svg>
  )
}

function Tile({ from, to, children, sheen = 0.5 }: { from: string; to: string; children: ReactNode; sheen?: number }) {
  const id = useId().replace(/:/g, '')
  return (
    <svg viewBox="0 0 100 100" className="app-icon" aria-hidden>
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={from} />
          <stop offset="1" stopColor={to} />
        </linearGradient>
        <linearGradient id={`${id}-hi`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity={sheen} />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <clipPath id={`${id}-clip`}>
          <path d={SQUIRCLE} />
        </clipPath>
      </defs>
      <path d={SQUIRCLE} fill={`url(#${id}-bg)`} />
      <g clipPath={`url(#${id}-clip)`}>{children}</g>
      {/* A lit top edge, so the tile reads as a physical thing */}
      <path d={SQUIRCLE} fill="none" stroke={`url(#${id}-hi)`} strokeWidth="1.5" transform="translate(0.75 0.75) scale(0.985)" />
    </svg>
  )
}

/** Messages: a pale speech bubble, lit from above, on a soft green, as the app that sends them is drawn now. */
function ChatIcon() {
  const id = useId().replace(/:/g, '')
  return (
    <Tile from="#8eee8b" to="#4ec254" sheen={0.35}>
      <defs>
        <linearGradient id={`${id}-bubble`} gradientUnits="userSpaceOnUse" x1="0" y1="17" x2="0" y2="80">
          <stop offset="0" stopColor="#fcfffb" />
          <stop offset="1" stopColor="#d2f2d0" />
        </linearGradient>
        <filter id={`${id}-lift`} x="-20%" y="-20%" width="140%" height="150%">
          <feDropShadow dx="0" dy="1.2" stdDeviation="1.6" floodColor="#0c6b1c" floodOpacity="0.22" />
        </filter>
      </defs>
      <g fill={`url(#${id}-bubble)`} filter={`url(#${id}-lift)`}>
        <ellipse cx="50.200" cy="47.500" rx="37.300" ry="30.300" />
        {/* Its tail, down to the left */}
        <path d="M21.6 66.500C22.6 71.600 21.400 75.900 17.700 78.500 17 79 17.300 80 18.200 80 23.800 80.100 29 78.600 33.200 75.600Z" />
      </g>
    </Tile>
  )
}

/** FAQs: Notes. A white pad with its yellow binding, the perforation under it, and two ruled lines that stop short of its edges. */
function NotesIcon() {
  const id = useId().replace(/:/g, '')
  return (
    <Tile from="#fdfdfd" to="#f0f0f2" sheen={0.6}>
      <defs>
        <linearGradient id={`${id}-top`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fbdd58" />
          <stop offset="1" stopColor="#f6c93a" />
        </linearGradient>
      </defs>
      <rect width="100" height="26.500" fill={`url(#${id}-top)`} />
      {Array.from({ length: 21 }, (_, i) => (
        <circle key={i} cx={6.5 + i * 4.35} cy="30.300" r="0.850" fill="#bdb49a" />
      ))}
      <g fill="none" stroke="#cbcbd0" strokeWidth="1.300" strokeLinecap="round">
        <path d="M12.5 50.500h75M12.5 75.500h75" />
      </g>
    </Tile>
  )
}

/** Case Studies: a terminal. A prompt and its cursor, small, in the top corner of a black tile. */
function TerminalIcon() {
  return (
    <Tile from="#262628" to="#0f0f11" sheen={0.3}>
      {/* The tile's own edge, a shade lighter all round */}
      <path d={SQUIRCLE} fill="none" stroke="#fff" strokeOpacity="0.090" strokeWidth="1.600" transform="translate(0.8 0.8) scale(0.984)" />
      <path d="M19.2 23.400 35.400 33 19.200 42.600" fill="none" stroke="#f5f5f7" strokeWidth="4.300" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="40.200" y="48.900" width="20.800" height="4.300" rx="1" fill="#9a9a9f" />
    </Tile>
  )
}

function FolderGlyph() {
  const id = useId().replace(/:/g, '')
  return (
    <>
      <defs>
        <linearGradient id={`${id}-front`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#93d1f8" />
          <stop offset="1" stopColor="#62ade8" />
        </linearGradient>
      </defs>
      {/* The back, with its tab; a sheet of what is in it showing over the front; the front */}
      <path d="M17 32a6 6 0 0 1 6-6h14.600a6 6 0 0 1 4.700 2.300l1.200 1.500a3.400 3.400 0 0 0 2.700 1.300H77a6 6 0 0 1 6 6V47H17z" fill="#5faeea" />
      <rect x="19.400" y="33.300" width="61.200" height="9" rx="1.500" fill="#fff" />
      <rect x="17" y="35.700" width="66" height="41.300" rx="5.500" fill={`url(#${id}-front)`} />
      <rect x="17.600" y="35.700" width="64.800" height="1.300" rx="0.650" fill="#fff" opacity="0.500" />
    </>
  )
}

/** Portfolio: the Finder. A face on blue, its far side a pale pane set in from the tile's edge with the profile for its near side, two small eyes, and a smile across both. */
function FinderIcon() {
  const id = useId().replace(/:/g, '')
  return (
    <Tile from="#1fbcfc" to="#2c8cf5" sheen={0.45}>
      <defs>
        <linearGradient id={`${id}-far`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#d7e9fc" />
        </linearGradient>
      </defs>
      <path d="M56.5 8.500C55.500 24 48 39.500 41.500 54.500H50.500C50.500 68 51.800 81 54 93H82A10.500 10.500 0 0 0 92.500 82.500V19A10.500 10.500 0 0 0 82 8.500Z" fill={`url(#${id}-far)`} />
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M27.400 32.500v8M69.300 32.500v8" stroke="#16233f" strokeWidth="2.700" />
        <path d="M20.500 66.500C31 80 66 80 77 65.500" stroke="#0b0b10" strokeWidth="3.100" />
      </g>
    </Tile>
  )
}

/** VIP: black, with its name in white capitals. */
function VipIcon() {
  return (
    <Tile from="#2a2a2e" to="#000000" sheen={0.3}>
      <path d={VIP_LETTERS} fill="#fff" fillRule="evenodd" />
    </Tile>
  )
}

/** Shrug's own: the logo, white on a black tile. The s sits on this tile as it does on the logo's (ON_TILE, at five ninths the size). */
function ShrugIcon() {
  return (
    <Tile from="#2a2a2e" to="#000000" sheen={0.3}>
      <path d={S} fill="#fff" transform="translate(-38.52 -19.63) scale(0.7963)" />
    </Tile>
  )
}

const ICONS: Record<AppId, () => ReactNode> = {
  messages: ChatIcon,
  notes: NotesIcon,
  terminal: TerminalIcon,
  finder: FinderIcon,
  photos: VipIcon,
  about: ShrugIcon,
}

export function AppIcon({ id }: { id: AppId }) {
  const Glyph = ICONS[id]
  return <Glyph />
}

/** A page with a folded corner: the one-pager, as a file on the desk. */
export function DocumentIcon() {
  const id = useId().replace(/:/g, '')
  return (
    <svg viewBox="0 0 100 100" className="app-icon" aria-hidden>
      <defs>
        <linearGradient id={`${id}-page`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#e9ebf0" />
        </linearGradient>
      </defs>
      <path d="M22 13a7 7 0 0 1 7-7h29l21 21v60a7 7 0 0 1-7 7H29a7 7 0 0 1-7-7z" fill={`url(#${id}-page)`} stroke="rgba(0,0,0,0.16)" strokeWidth="1" />
      <path d="M58 6l21 21H65a7 7 0 0 1-7-7z" fill="#d3d6de" />
      <g fill="none" strokeWidth="3.6" strokeLinecap="round">
        <path d="M32 44h22" stroke="#0a6de6" />
        <path d="M32 56h36M32 66h36M32 76h24" stroke="#c4c7cf" />
      </g>
    </svg>
  )
}

/** A folder, as it sits in a Finder window or on the desktop. */
export function FolderIcon() {
  return (
    <svg viewBox="12 20 76 62" className="folder-icon" aria-hidden>
      <FolderGlyph />
    </svg>
  )
}
