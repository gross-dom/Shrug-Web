import { useId, type ReactNode } from 'react'
import type { AppId } from './apps'

// The desktop's own icons, drawn for Shrug: app icons in the rounded-square
// shape a Dock expects, a document, a folder, and the face from the shrug.
// Original artwork: none of these is another product's icon.

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

/** The ツ from ¯\_(ツ)_/¯, as three strokes in a 24-unit box. */
export function Face({ size = 24, stroke = 2.4, className }: { size?: number; stroke?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5.4 8.2l2.5 4.9" />
      <path d="M11 6.6l2.4 4.9" />
      <path d="M19.4 6.6c-.5 6.9-4.9 11.3-12.7 12.7" />
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

function ChatIcon() {
  return (
    <Tile from="#63c6ff" to="#0a67f2">
      <path
        d="M50 23c-17.7 0-32 11-32 24.6 0 7.6 4.5 14.4 11.6 18.9-.7 4-2.7 7.5-5.8 10.2 6.3-.3 11.8-2.4 15.9-6 3.3.8 6.7 1.3 10.3 1.3 17.7 0 32-11 32-24.4S67.7 23 50 23z"
        fill="#fff"
      />
      <g fill="none" stroke="#0b6df4" strokeWidth="4.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M36.5 40.5l3.7 7.3" />
        <path d="M45.8 38l3.6 7.3" />
        <path d="M63.5 38c-.8 10.3-7.4 16.9-19 19" />
      </g>
    </Tile>
  )
}

function NotesIcon() {
  return (
    <Tile from="#ffe884" to="#ffb81f">
      <g transform="rotate(-6 50 52)">
        <rect x="24" y="21" width="52" height="61" rx="10" fill="#fff" />
        <path d="M41.5 42.5c0-5.4 4-8.9 9-8.9s8.9 3.3 8.9 8.1c0 3.9-2.2 5.9-4.8 7.7-2.2 1.5-3.3 2.7-3.3 5.3" fill="none" stroke="#f0a000" strokeWidth="5.2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="51.2" cy="66.8" r="3.3" fill="#f0a000" />
      </g>
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

function FinderIcon() {
  return (
    <Tile from="#ffffff" to="#dfe8f5" sheen={0.9}>
      <FolderGlyph />
    </Tile>
  )
}

function VipIcon() {
  return (
    <Tile from="#b39bff" to="#6238de">
      <path
        d="M50 23.5l7.7 16.4 18 2.3-13.2 12.4 3.4 17.8L50 63.7l-15.9 8.7 3.4-17.8-13.2-12.4 18-2.3z"
        fill="#fff"
        stroke="#fff"
        strokeWidth="4"
        strokeLinejoin="round"
      />
    </Tile>
  )
}

function ShrugIcon() {
  return (
    <Tile from="#3a3a40" to="#0c0c0e" sheen={0.35}>
      <g fill="none" stroke="#fff" strokeWidth="6.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M28 36.5l5.6 11" />
        <path d="M42.5 32.5l5.5 11" />
        <path d="M70.5 32.5c-1.2 15.6-11.2 25.6-28.7 28.8" />
      </g>
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

/** A page with a folded corner: the one-pager. */
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
