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

/** Messages: the speech bubble on green, as it is drawn now: wide and of glass, white with a little of the green showing through its foot. */
function Messages() {
  const id = useId().replace(/:/g, '')
  return (
    <Tile from="#63f57c" to="#0cbf30">
      <defs>
        <linearGradient id={`${id}-glass`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.3" stopColor="#ffffff" />
          <stop offset="1" stopColor="#cdf6d6" />
        </linearGradient>
      </defs>
      <path
        d="M50 20.500c-18.800 0-34 11.800-34 26.400 0 8.500 5.200 16.100 13.300 20.900-.600 3.700-2.400 6.900-5.300 9.500-.600.500-.200 1.400.600 1.300 6.200-.600 11.400-2.800 15.300-6.500 3.200.800 6.600 1.200 10.100 1.200 18.800 0 34-11.800 34-26.400S68.800 20.500 50 20.500z"
        fill={`url(#${id}-glass)`}
        transform="translate(50 49) scale(1.07) translate(-50 -49)"
      />
    </Tile>
  )
}

/** Contacts, as it is drawn now: a warm pale tile, the head and shoulders of nobody in particular in white on
 * a darker disc, and the tabs of an address book down the trailing edge in blue, orange and green. */
function Contacts() {
  const id = useId().replace(/:/g, '')
  return (
    <Tile from="#e2e1d6" to="#cfcec2" sheen={0.7}>
      <defs>
        <linearGradient id={`${id}-disc`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#aba89e" />
          <stop offset="1" stopColor="#98958b" />
        </linearGradient>
        <linearGradient id={`${id}-who`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#eeede6" />
        </linearGradient>
        {/* The tile is glass: towards the tabs it takes a little of their colour */}
        <linearGradient id={`${id}-glass`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0.62" stopColor="#9fd6d2" stopOpacity="0" />
          <stop offset="0.86" stopColor="#9fd6d2" stopOpacity="0.5" />
        </linearGradient>
        <clipPath id={`${id}-in`}>
          <circle cx="44" cy="51" r="27.6" />
        </clipPath>
      </defs>
      <rect width="87" height="100" fill={`url(#${id}-glass)`} />
      <circle cx="44" cy="51" r="30" fill={`url(#${id}-disc)`} />
      <circle cx="44" cy="42" r="13" fill={`url(#${id}-who)`} />
      <ellipse cx="44" cy="85" rx="27" ry="23.5" fill={`url(#${id}-who)`} clipPath={`url(#${id}-in)`} />
      {/* The tabs: three, each a third of the edge */}
      <rect x="87" width="13" height="34" fill="#12bdf7" />
      <rect x="87" y="34" width="13" height="32" fill="#ff9706" />
      <rect x="87" y="66" width="13" height="34" fill="#17d45e" />
      <rect x="86.600" width="0.800" height="100" fill="#fff" opacity="0.5" />
    </Tile>
  )
}

/** Notes: a pad with its yellow binding, the perforation under it, and two ruled lines. */
function Notes() {
  const id = useId().replace(/:/g, '')
  return (
    <Tile from="#fefefe" to="#efeff1" sheen={0.6}>
      <defs>
        <linearGradient id={`${id}-top`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffdf52" />
          <stop offset="1" stopColor="#ffcb0a" />
        </linearGradient>
      </defs>
      <rect width="100" height="25" fill={`url(#${id}-top)`} />
      <rect y="25" width="100" height="0.800" fill="#000" opacity="0.08" />
      {Array.from({ length: 16 }, (_, i) => (
        <circle key={i} cx={8.500 + i * 5.530} cy="31.500" r="1.050" fill="#b9b9bf" />
      ))}
      <g stroke="#c8c8cd" strokeWidth="1.400" strokeLinecap="round">
        <path d="M14 51h72M14 74h72" />
      </g>
    </Tile>
  )
}

/** VIP: black, with its name in white capitals, as on the desktop. It is Shrug's own, so it has no iOS icon
 * to be drawn after; and it is not an app but the link to the points site, in the Dock where an app would be
 * (Springboard.tsx), as the one-pager is on the Home Screen. */
export function VipIcon() {
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
