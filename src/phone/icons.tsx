import { useId, type ReactNode } from 'react'
import type { PhoneApp } from './system'

// The iPhone's app icons. Each is drawn here, after the icon of the iOS app it
// stands for (Messages, Files, Notes, Settings), in the continuous-corner tile
// iOS cuts its icons to; Case Studies and VIP, which are Shrug's own, have
// icons of their own. No file from an operating system is used.

/** A continuous-corner square (a superellipse), 100 units across. */
const SQUIRCLE = (() => {
  const n = 5
  const steps = 96
  const pts: string[] = []
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2
    const c = Math.cos(t)
    const s = Math.sin(t)
    pts.push(`${(50 + 50 * Math.sign(c) * Math.pow(Math.abs(c), 2 / n)).toFixed(2)} ${(50 + 50 * Math.sign(s) * Math.pow(Math.abs(s), 2 / n)).toFixed(2)}`)
  }
  return `M${pts.join('L')}Z`
})()

/** An icon's tile: its ground, what is drawn on it (cut to the tile's shape), and the light along its top edge. */
function Tile({ from, to, children, sheen = 0.45 }: { from: string; to: string; children: ReactNode; sheen?: number }) {
  const id = useId().replace(/:/g, '')
  return (
    <svg viewBox="0 0 100 100" className="app-icon" style={{ isolation: 'isolate' }} aria-hidden>
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={from} />
          <stop offset="1" stopColor={to} />
        </linearGradient>
        <linearGradient id={`${id}-hi`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity={sheen} />
          <stop offset="0.45" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <clipPath id={`${id}-clip`}>
          <path d={SQUIRCLE} />
        </clipPath>
      </defs>
      <path d={SQUIRCLE} fill={`url(#${id}-bg)`} />
      <g clipPath={`url(#${id}-clip)`}>{children}</g>
      <path d={SQUIRCLE} fill="none" stroke={`url(#${id}-hi)`} strokeWidth="1.4" transform="translate(0.7 0.7) scale(0.986)" />
      {/* A white tile needs an edge of its own on a pale ground */}
      <path d={SQUIRCLE} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="0.8" transform="translate(0.4 0.4) scale(0.992)" />
    </svg>
  )
}

/** Messages: the white speech bubble on green. */
function Messages() {
  return (
    <Tile from="#67f27f" to="#0abf2e">
      <path d="M50 22.5c-18.5 0-33.5 12.1-33.5 27 0 9.1 5.6 17.1 14.2 22-.5 4.6-2.6 8.500-6.300 11.4-.6.5-.2 1.4.6 1.3 7-.9 12.800-3.700 16.800-7.900 2.6.5 5.400.8 8.200.8 18.500 0 33.500-12.400 33.500-27.600S68.500 22.500 50 22.500z" fill="#fff" />
    </Tile>
  )
}

/** Files: the blue folder on white. */
function Files() {
  const id = useId().replace(/:/g, '')
  return (
    <Tile from="#ffffff" to="#f1f3f7" sheen={0.9}>
      <defs>
        <linearGradient id={`${id}-front`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5fc0ff" />
          <stop offset="1" stopColor="#1f8ff5" />
        </linearGradient>
      </defs>
      <path d="M18 33.500a6.500 6.500 0 0 1 6.500-6.500h14.200a6.500 6.500 0 0 1 4.900 2.200l3.100 3.600H75.500a6.500 6.500 0 0 1 6.500 6.500V48H18z" fill="#1a7fe8" />
      <rect x="18" y="38.500" width="64" height="37" rx="7.500" fill={`url(#${id}-front)`} />
      <rect x="18" y="38.500" width="64" height="1.800" rx="0.900" fill="#fff" opacity="0.4" />
    </Tile>
  )
}

/** Notes: a pad with its yellow binding, the perforation under it, and two ruled lines. */
function Notes() {
  const id = useId().replace(/:/g, '')
  return (
    <Tile from="#ffffff" to="#fbfbfd" sheen={0.6}>
      <defs>
        <linearGradient id={`${id}-top`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe35a" />
          <stop offset="1" stopColor="#ffc905" />
        </linearGradient>
      </defs>
      <rect width="100" height="30" fill={`url(#${id}-top)`} />
      <rect y="30" width="100" height="1" fill="#000" opacity="0.1" />
      {Array.from({ length: 21 }, (_, i) => (
        <circle key={i} cx={6 + i * 4.4} cy="38.500" r="1.050" fill="#b4b4ba" />
      ))}
      <rect y="55.500" width="100" height="1.300" fill="#d4d4d9" />
      <rect y="73" width="100" height="1.300" fill="#d4d4d9" />
    </Tile>
  )
}

/** VIP: the star it has on the desktop, white on purple. It is Shrug's own app, so it has no iOS icon to be drawn after. */
function Vip() {
  return (
    <Tile from="#b9a2ff" to="#5a2fd8" sheen={0.4}>
      <path d="M50 23.5l7.7 16.4 18 2.3-13.2 12.4 3.4 17.8L50 63.7l-15.9 8.7 3.4-17.8-13.2-12.4 18-2.3z" fill="#fff" stroke="#fff" strokeWidth="4" strokeLinejoin="round" />
    </Tile>
  )
}

/** Settings: gears on gray. */
function Settings() {
  const id = useId().replace(/:/g, '')
  return (
    <Tile from="#b6b6bb" to="#77777d" sheen={0.35}>
      <defs>
        <linearGradient id={`${id}-disc`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4a4a4e" />
          <stop offset="1" stopColor="#1f1f22" />
        </linearGradient>
      </defs>
      {/* The outer gear: a ring of teeth around its rim */}
      <circle cx="50" cy="50" r="33.500" fill="none" stroke="#e6e6ea" strokeWidth="6" strokeDasharray="3.510 3.510" />
      <circle cx="50" cy="50" r="30.500" fill="#e6e6ea" />
      <circle cx="50" cy="50" r="27" fill={`url(#${id}-disc)`} />
      {/* The inner gear: a toothed ring, three spokes and a hub */}
      <circle cx="50" cy="50" r="20.500" fill="none" stroke="#d4d4d9" strokeWidth="3.200" strokeDasharray="2.150 2.150" />
      <circle cx="50" cy="50" r="18.200" fill="none" stroke="#d4d4d9" strokeWidth="2.200" />
      <g stroke="#d4d4d9" strokeWidth="3.400" strokeLinecap="round">
        <path d="M50 50V32.500" />
        <path d="M50 50l15.200 8.700" />
        <path d="M50 50l-15.200 8.700" />
      </g>
      <circle cx="50" cy="50" r="5.600" fill="#d4d4d9" />
      <circle cx="50" cy="50" r="2.300" fill="#2a2a2d" />
    </Tile>
  )
}

/** Case Studies: a terminal, which iOS has none of its own of. */
function Terminal() {
  return (
    <Tile from="#3c3c42" to="#101012" sheen={0.3}>
      <g fill="none" strokeWidth="6.500" strokeLinecap="round" strokeLinejoin="round">
        <path d="M25 34l16 14.500L25 63" stroke="#f4f4f6" />
        <path d="M49 65h25" stroke="#6ee7a8" />
      </g>
    </Tile>
  )
}

const ICONS: Record<PhoneApp, () => ReactNode> = {
  messages: Messages,
  finder: Files,
  notes: Notes,
  photos: Vip,
  terminal: Terminal,
  about: Settings,
}

/** An app's icon on the iPhone. */
export function PhoneIcon({ id }: { id: PhoneApp }) {
  const Glyph = ICONS[id]
  return <Glyph />
}

/** The one-pager, as a page that has been added to the Home Screen: a sheet of paper on a white tile. */
export function OnePagerIcon() {
  return (
    <Tile from="#ffffff" to="#e9ecf2" sheen={0.9}>
      <path d="M31 22a6 6 0 0 1 6-6h19l15 15v47a6 6 0 0 1-6 6H37a6 6 0 0 1-6-6z" fill="#fff" stroke="rgba(0,0,0,0.14)" strokeWidth="1.200" />
      <path d="M56 16l15 15H61a5 5 0 0 1-5-5z" fill="#d5d9e2" />
      <g fill="none" strokeWidth="3.400" strokeLinecap="round">
        <path d="M39 45h14" stroke="#0a84ff" />
        <path d="M39 55h23M39 63h23M39 71h15" stroke="#c4c8d2" />
      </g>
    </Tile>
  )
}

/** The glyphs on the Lock Screen's two round buttons: solid shapes with cut-outs, after the flashlight and camera symbols iOS uses there. */
const LOCK_GLYPHS = {
  torch: { size: 22, d: 'M7.6 1.6h8.8a1.6 1.6 0 0 1 1.6 1.6v1.9H6V3.2a1.6 1.6 0 0 1 1.6-1.6ZM6 6h12l-2.6 4v10.4a2 2 0 0 1-2 2h-2.8a2 2 0 0 1-2-2V10ZM10.6 14a1.4 1.4 0 1 0 2.8 0 1.4 1.4 0 1 0-2.8 0Z' },
  camera: { size: 24, d: 'M4.6 6.6h3.3l1.2-1.8a1.3 1.3 0 0 1 1.1-.6h3.6a1.3 1.3 0 0 1 1.1.6l1.2 1.8h3.3A2.6 2.6 0 0 1 22 9.2v8.6a2.6 2.6 0 0 1-2.6 2.6H4.6A2.6 2.6 0 0 1 2 17.8V9.2a2.6 2.6 0 0 1 2.6-2.6ZM7.5 13.4a4.5 4.5 0 1 0 9 0 4.5 4.5 0 1 0-9 0ZM9 13.4a3 3 0 1 0 6 0 3 3 0 1 0-6 0Z' },
}

export function LockGlyph({ name }: { name: keyof typeof LOCK_GLYPHS }) {
  const { size, d } = LOCK_GLYPHS[name]
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <path fill="currentColor" fillRule="evenodd" d={d} />
    </svg>
  )
}
