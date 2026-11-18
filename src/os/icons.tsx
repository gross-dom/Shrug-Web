import { useId, type ReactNode } from 'react'
import { IN_DISC, ON_TILE, S, VIP_LETTERS } from '../data/logo'
import type { AppId } from './apps'

// The desktop's own icons, drawn here: app icons in the rounded-square shape a
// Dock expects, a document, a folder, and Shrug's logo. The group chat's, the
// notes' and the portfolio's are drawn after the Mac apps they stand for
// (Messages, Notes, the Finder); Case Studies, VIP and Shrug's own are
// Shrug's. No file from an operating system is used.

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

/** Messages: a white speech bubble on green, as the app that sends them is drawn. */
function ChatIcon() {
  return (
    <Tile from="#6cf486" to="#0bbf2f" sheen={0.4}>
      <path
        d="M50 22.5c-18.5 0-33.5 12.1-33.5 27 0 9.1 5.6 17.1 14.2 22-.5 4.6-2.6 8.5-6.3 11.4-.6.5-.2 1.4.6 1.3 7-.9 12.8-3.7 16.8-7.9 2.6.5 5.4.8 8.2.8 18.5 0 33.5-12.4 33.5-27.6S68.5 22.5 50 22.500z"
        fill="#fff"
      />
    </Tile>
  )
}

/** FAQs: Notes. A pad with its yellow binding, the perforation under it, and two ruled lines. */
function NotesIcon() {
  const id = useId().replace(/:/g, '')
  return (
    <Tile from="#ffffff" to="#f4f4f7" sheen={0.6}>
      <defs>
        <linearGradient id={`${id}-top`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe35a" />
          <stop offset="1" stopColor="#ffc905" />
        </linearGradient>
      </defs>
      <rect width="100" height="30" fill={`url(#${id}-top)`} />
      <rect y="30" width="100" height="1" fill="#000" opacity="0.1" />
      {Array.from({ length: 21 }, (_, i) => (
        <circle key={i} cx={6 + i * 4.4} cy="38.5" r="1.05" fill="#b4b4ba" />
      ))}
      <rect y="55.5" width="100" height="1.3" fill="#d4d4d9" />
      <rect y="73" width="100" height="1.3" fill="#d4d4d9" />
    </Tile>
  )
}

function TerminalIcon() {
  return (
    <Tile from="#4b4b55" to="#131316" sheen={0.35}>
      <rect x="9" y="9" width="82" height="82" rx="17" fill="#0b0b0d" />
      <g fill="none" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M27 36l14 12.5L27 61" stroke="#f4f4f6" />
        <path d="M49 63h22" stroke="#6ee7a8" />
      </g>
    </Tile>
  )
}

function FolderGlyph() {
  const id = useId().replace(/:/g, '')
  return (
    <>
      <defs>
        <linearGradient id={`${id}-front`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7fcbff" />
          <stop offset="1" stopColor="#3f9df5" />
        </linearGradient>
      </defs>
      <path d="M17 33a7 7 0 0 1 7-7h15.2a7 7 0 0 1 5.3 2.4l3 3.6H76a7 7 0 0 1 7 7v9H17z" fill="#2f86e6" />
      <rect x="17" y="38" width="66" height="39" rx="8" fill={`url(#${id}-front)`} />
      <rect x="17" y="38" width="66" height="2" rx="1" fill="#fff" opacity="0.45" />
    </>
  )
}

/** Portfolio: the Finder. A face in two blues, one side in profile against the other, with its two eyes and its smile. */
function FinderIcon() {
  const id = useId().replace(/:/g, '')
  return (
    <Tile from="#3fb4ff" to="#0a5be0" sheen={0.55}>
      <defs>
        <linearGradient id={`${id}-far`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#d6e6fb" />
        </linearGradient>
        <linearGradient id={`${id}-ink`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#13306a" />
          <stop offset="1" stopColor="#081a40" />
        </linearGradient>
        {/* The far side lies over the near one, as a second pane of glass: it throws a little shade back along the profile */}
        <filter id={`${id}-lift`} x="-20%" y="-10%" width="140%" height="120%">
          <feDropShadow dx="-1.3" dy="0" stdDeviation="1.5" floodColor="#052a72" floodOpacity="0.42" />
        </filter>
      </defs>
      {/* The far side of the face, from its profile to the edge of the tile */}
      <path d="M57.5 -2C56 13 50.5 30.500 47.500 47.500H56.500C56.500 66 58 84 61 102H102V-2Z" fill={`url(#${id}-far)`} filter={`url(#${id}-lift)`} />
      {/* The light the pane's own edge catches */}
      <path d="M57.5 -2C56 13 50.5 30.500 47.500 47.500H56.500C56.500 66 58 84 61 102" fill="none" stroke="#fff" strokeOpacity="0.75" strokeWidth="0.900" />
      <g fill="none" stroke={`url(#${id}-ink)`} strokeLinecap="round" strokeLinejoin="round">
        <path d="M29.500 27v12M71 27v12" strokeWidth="6.200" />
        <path d="M20.500 60.500C32.500 80 67.500 80 79.500 60.500" strokeWidth="5.400" />
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
