import { useId, type ReactNode } from 'react'
import { VIP_LETTERS } from '../data/logo'
import type { PhoneApp } from './system'

// The iPhone's app icons. Each is drawn here, after the icon of the iOS app it
// stands for (Messages, Contacts, Notes), in the continuous-corner tile
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

/** Contacts: the head and shoulders of nobody in particular, on pale gray, with the tabs of an address book down the trailing edge. */
function Contacts() {
  const id = useId().replace(/:/g, '')
  return (
    <Tile from="#fbfbfc" to="#e3e3e8" sheen={0.6}>
      <defs>
        <linearGradient id={`${id}-who`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#a9a9b1" />
          <stop offset="1" stopColor="#7f7f88" />
        </linearGradient>
      </defs>
      {/* The page of the book the figure is on, a shade under the tabs' side */}
      <rect width="80" height="100" fill="#000" opacity="0.035" />
      <circle cx="40" cy="38" r="15.5" fill={`url(#${id}-who)`} />
      <path d="M40 58.500c-17.500 0-29.500 10.300-31 26.200-.4 4.300 0 15.300 0 15.300h62s.4-11 0-15.300C69.500 68.800 57.500 58.500 40 58.500z" fill={`url(#${id}-who)`} />
      {/* The tabs: four, as far apart as they are tall */}
      <rect x="80" width="20" height="100" fill="#fff" opacity="0.55" />
      <rect x="80" width="0.800" height="100" fill="#000" opacity="0.08" />
      {[14, 34, 54, 74].map((y, i) => (
        <rect key={y} x="85.500" y={y} width="9" height="12" rx="2.500" fill={['#b9b9c1', '#a6a6af', '#b9b9c1', '#a6a6af'][i]} />
      ))}
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

/** VIP: black, with its name in white capitals, as on the desktop. It is Shrug's own app, so it has no iOS icon to be drawn after. */
function Vip() {
  return (
    <Tile from="#2a2a2e" to="#000000" sheen={0.3}>
      <path d={VIP_LETTERS} fill="#fff" fillRule="evenodd" />
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
  finder: Contacts,
  notes: Notes,
  photos: Vip,
  terminal: Terminal,
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
