import { useId, type ReactNode } from 'react'
import { IN_DISC, ON_TILE, S, VIP_LETTERS } from '../data/logo'
import type { AppId } from './apps'

// The desktop's own icons, drawn here: app icons in the rounded-square shape a
// Dock expects, a document, a folder, and Shrug's logo. The group chat's, the
// notes', the portfolio's and the case studies' are drawn after the Mac apps
// they stand for (Messages, Notes, the Finder, Terminal) as those are drawn
// now, and the folder after a Mac's; VIP and Shrug's own are Shrug's. No file
// from an operating system is used.

/** A superellipse as a path: an ellipse whose shoulders are fuller the higher `n` is (at 2 it is a plain ellipse). */
const superellipse = (cx: number, cy: number, rx: number, ry: number, n: number) => {
  const steps = 96
  const pts: string[] = []
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2
    const c = Math.cos(t)
    const s = Math.sin(t)
    const x = cx + rx * Math.sign(c) * Math.pow(Math.abs(c), 2 / n)
    const y = cy + ry * Math.sign(s) * Math.pow(Math.abs(s), 2 / n)
    pts.push(`${x.toFixed(2)} ${y.toFixed(2)}`)
  }
  return `M${pts.join('L')}Z`
}

/** A continuous-corner square, 100 units across: its corners as round as the Mac's own tiles measure. */
const SQUIRCLE = superellipse(50, 50, 50, 50, 4.4)

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

/** The tile an app's icon is drawn on: flat, as the Mac's are now, with nothing lit along its edge. */
function Tile({ from, to, children }: { from: string; to: string; children: ReactNode }) {
  const id = useId().replace(/:/g, '')
  return (
    <svg viewBox="0 0 100 100" className="app-icon" aria-hidden>
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={from} />
          <stop offset="1" stopColor={to} />
        </linearGradient>
        <clipPath id={`${id}-clip`}>
          <path d={SQUIRCLE} />
        </clipPath>
      </defs>
      <path d={SQUIRCLE} fill={`url(#${id}-bg)`} />
      <g clipPath={`url(#${id}-clip)`}>{children}</g>
    </svg>
  )
}

/** The bubble: wider than it is tall, and only a little fuller at its shoulders than an ellipse. */
const BUBBLE = superellipse(49.8, 48.25, 36.3, 30.2, 2.12)

/** Messages: a pale speech bubble, lit from above, on a soft green, as the app that sends them is drawn now. */
function ChatIcon() {
  const id = useId().replace(/:/g, '')
  return (
    <Tile from="#84ed7d" to="#63ce54">
      <defs>
        <linearGradient id={`${id}-bubble`} gradientUnits="userSpaceOnUse" x1="0" y1="18" x2="0" y2="79">
          <stop offset="0" stopColor="#f8fdf8" />
          <stop offset="1" stopColor="#d5f4d6" />
        </linearGradient>
        <filter id={`${id}-lift`} x="-20%" y="-20%" width="140%" height="150%">
          <feDropShadow dx="0" dy="1.2" stdDeviation="1.6" floodColor="#0c6b1c" floodOpacity="0.22" />
        </filter>
      </defs>
      <g fill={`url(#${id}-bubble)`} filter={`url(#${id}-lift)`}>
        <path d={BUBBLE} />
        {/* Its tail: a short nub at its left, down to the level of the bubble's own foot and no lower */}
        <path d="M18.400 64.400C19.600 66.400 20.500 68.500 20.850 70.400C21.150 72.400 19.350 75.300 17.550 77.100C17.050 77.650 17.400 78.450 18.200 78.450C21.900 78.300 26.600 76.400 30.200 74.200L30 66Z" />
      </g>
    </Tile>
  )
}

/** FAQs: Notes. A white pad with its yellow binding, the perforation under it on a strip of cream, and two ruled lines that stop short of its edges. */
function NotesIcon() {
  const id = useId().replace(/:/g, '')
  return (
    <Tile from="#fefefe" to="#f4f5f5">
      <defs>
        <linearGradient id={`${id}-top`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f8d856" />
          <stop offset="0.900" stopColor="#f7d14a" />
          <stop offset="1" stopColor="#ffe55c" />
        </linearGradient>
        <linearGradient id={`${id}-strip`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f7f4e8" />
          <stop offset="0.560" stopColor="#f7f4e8" />
          <stop offset="1" stopColor="#f7f4e8" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}-glow`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff39c" />
          <stop offset="1" stopColor="#fff39c" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect y="24" width="100" height="7.600" fill={`url(#${id}-strip)`} />
      {/* The binding is lit along its lower edge, and a little of that light falls on the strip under it */}
      <rect y="24.600" width="100" height="1.700" fill={`url(#${id}-glow)`} />
      <rect width="100" height="24.600" fill={`url(#${id}-top)`} />
      {/* Fifteen holes, a sixteenth of the pad apart */}
      {Array.from({ length: 15 }, (_, i) => (
        <circle key={i} cx={6.25 + i * 6.25} cy="28.300" r="1.050" fill="#bbbab1" />
      ))}
      <g fill="none" stroke="#c2c2c2" strokeWidth="1.800" strokeLinecap="round">
        <path d="M13.400 50h73.200M13.400 75.100h73.200" />
      </g>
    </Tile>
  )
}

/** Case Studies: a terminal. A prompt and its cursor, small, in the top corner of a black tile. */
function TerminalIcon() {
  const id = useId().replace(/:/g, '')
  return (
    <Tile from="#202020" to="#0e0e0e">
      <defs>
        <linearGradient id={`${id}-edge`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="50">
          <stop offset="0" stopColor="#fff" stopOpacity="0.240" />
          <stop offset="0.160" stopColor="#fff" stopOpacity="0.100" />
          <stop offset="0.280" stopColor="#fff" stopOpacity="0.060" />
          <stop offset="0.480" stopColor="#fff" stopOpacity="0.028" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* The one tile with an edge to it: a faint light along its top that follows the corners round and is gone
          before it is half-way down the sides, so that black still has a shape against a dark desk */}
      <path d={SQUIRCLE} fill="none" stroke={`url(#${id}-edge)`} strokeWidth="3.200" />
      {/* The prompt, cut as type is: its ends upright, and its point too */}
      <path d="M18.400 20.500 36.600 30.850V34.650L18.400 45V40.520L32.060 32.750 18.400 24.980Z" fill="#fff" />
      <rect x="39.800" y="48.750" width="20.900" height="4.250" rx="1" fill="#909092" />
    </Tile>
  )
}

function FolderGlyph() {
  const id = useId().replace(/:/g, '')
  return (
    <>
      <defs>
        <linearGradient id={`${id}-back`} gradientUnits="userSpaceOnUse" x1="0" y1="25.200" x2="0" y2="36">
          <stop offset="0" stopColor="#75bce7" />
          <stop offset="1" stopColor="#58a3d5" />
        </linearGradient>
        <linearGradient id={`${id}-front`} gradientUnits="userSpaceOnUse" x1="0" y1="34.600" x2="0" y2="77.900">
          <stop offset="0" stopColor="#8ccef3" />
          <stop offset="1" stopColor="#62abda" />
        </linearGradient>
        <linearGradient id={`${id}-lit`} gradientUnits="userSpaceOnUse" x1="0" y1="34.600" x2="0" y2="35.800">
          <stop offset="0" stopColor="#fff" stopOpacity="0.420" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <clipPath id={`${id}-clip`}>
          <rect x="17" y="34.600" width="66" height="43.300" rx="4.300" />
        </clipPath>
      </defs>
      {/* The back, with its tab, a third of the way along; a sheet of what is in it showing over the front; and the
          front, lit along its top edge. (The light is cut to the front's own corners: left as a bar, its square ends
          stood out past them as two nicks) */}
      <path d="M17 29.500A4.300 4.300 0 0 1 21.300 25.200H36.200C38.300 25.200 39.200 26.500 40.150 27.750C41.100 29 42.100 29.820 44.200 29.820H78.600A4.400 4.400 0 0 1 83 34.220V48H17Z" fill={`url(#${id}-back)`} />
      <rect x="19.650" y="32.200" width="60.700" height="9" rx="2" fill="#fff" />
      <rect x="17" y="34.600" width="66" height="43.300" rx="4.300" fill={`url(#${id}-front)`} />
      <rect x="17" y="34.600" width="66" height="1.200" fill={`url(#${id}-lit)`} clipPath={`url(#${id}-clip)`} />
    </>
  )
}

/** The Finder's far side: a pale pane set in from the tile's edge, rounded at every corner, with the profile of a face for its near side. */
const PANE =
  'M63.500 7.400H70C84.500 7.400 91.500 14.500 91.500 28.500V71.500C91.500 84.500 84 92 70 92H66.500C57.200 92 54.300 86.400 53.300 80C51.600 73 50.500 66 50.300 58.800C50.250 57.300 49.600 56.700 48.400 56.700H44.200C41.600 56.700 40.200 55.200 40.900 52.300C41.700 41 45 27 47.600 18.500C49.600 11.800 54.600 7.400 63.500 7.400Z'

/** Portfolio: the Finder. A face on blue, its far side a pale pane with the profile for its near side, two small eyes, and a smile across both. */
function FinderIcon() {
  const id = useId().replace(/:/g, '')
  return (
    <Tile from="#0ec4ff" to="#39a5ff">
      <defs>
        <linearGradient id={`${id}-far`} gradientUnits="userSpaceOnUse" x1="0" y1="7.400" x2="0" y2="92">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.250" stopColor="#fdfeff" />
          <stop offset="0.500" stopColor="#f3fbff" />
          <stop offset="0.860" stopColor="#def3fe" />
          <stop offset="1" stopColor="#d7effd" />
        </linearGradient>
      </defs>
      <path d={PANE} fill={`url(#${id}-far)`} />
      <g fill="none" stroke="#000" strokeLinecap="round" strokeLinejoin="round">
        <path d="M27.550 32.450v6.100M68.300 32.450v6.100" strokeWidth="3.700" />
        <path d="M21.850 66.450C35.750 79.970 60.450 79.970 74.350 66.450" strokeWidth="3.700" />
      </g>
    </Tile>
  )
}

/** VIP: black, with its name in white capitals. It is not an app's icon: VIP is the Dock's link to the points
 * site (Dock.tsx), drawn on a tile so that it sits among the apps as one of them would. */
export function VipIcon() {
  return (
    <Tile from="#2a2a2e" to="#000000">
      <path d={VIP_LETTERS} fill="#fff" fillRule="evenodd" />
    </Tile>
  )
}

/** Shrug's own: the logo, white on a black tile. The s sits on this tile as it does on the logo's (ON_TILE, at five ninths the size). */
function ShrugIcon() {
  return (
    <Tile from="#2a2a2e" to="#000000">
      <path d={S} fill="#fff" transform="translate(-38.52 -19.63) scale(0.7963)" />
    </Tile>
  )
}

const ICONS: Record<AppId, () => ReactNode> = {
  messages: ChatIcon,
  notes: NotesIcon,
  terminal: TerminalIcon,
  finder: FinderIcon,
  about: ShrugIcon,
  wallpapers: FolderIcon,
  updates: FolderIcon,
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
