import { useId, type ReactNode } from 'react'
import { MOV, W_S, set } from '../data/lettering'
import { useStore } from './store'
import { picked } from './workspace'

// The icons of the v1 apps (design/v1). Each is drawn here, as every icon on the desktop is. Mail's,
// QuickTime Player's, Photo Booth's, Spotify's and YouTube's are drawn after the icons Dom supplied for them
// (design/v1/reference): the apps a visitor already knows them by. Film is a file, for the desk. Workspace's
// is the color last picked in it, with its mark.

/** A continuous-corner square, 100 units across (the same as os/icons.tsx draws its tiles on). */
const squircle = (() => {
  const pts: string[] = []
  for (let i = 0; i < 96; i++) {
    const t = (i / 96) * Math.PI * 2
    const c = Math.cos(t)
    const s = Math.sin(t)
    pts.push(`${(50 + 50 * Math.sign(c) * Math.pow(Math.abs(c), 2 / 4.4)).toFixed(2)} ${(50 + 50 * Math.sign(s) * Math.pow(Math.abs(s), 2 / 4.4)).toFixed(2)}`)
  }
  return `M${pts.join('L')}Z`
})()

function Tile({ fill, children }: { fill: [string, string] | string; children: ReactNode }) {
  const id = useId().replace(/:/g, '')
  return (
    <svg viewBox="0 0 100 100" className="app-icon" aria-hidden>
      <defs>
        {typeof fill !== 'string' && (
          <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={fill[0]} />
            <stop offset="1" stopColor={fill[1]} />
          </linearGradient>
        )}
        <clipPath id={`${id}-clip`}>
          <path d={squircle} />
        </clipPath>
      </defs>
      <path d={squircle} fill={typeof fill === 'string' ? fill : `url(#${id}-bg)`} />
      <g clipPath={`url(#${id}-clip)`}>{children}</g>
    </svg>
  )
}

/** Mail: a pale envelope on deep violet, after Superhuman's. */
export function MailIcon() {
  return (
    <Tile fill={['#5a3fa6', '#2d1c63']}>
      <rect x="20" y="30" width="60" height="41" rx="7" fill="#efeaff" />
      <path d="M24 36.5 46.2 54.800a6 6 0 0 0 7.6 0L76 36.5" fill="none" stroke="#4a2f99" strokeWidth="4.6" strokeLinecap="round" strokeLinejoin="round" />
    </Tile>
  )
}

/** QuickTime Player: a blue Q on white, after the Mac's. */
export function QuickTimeIcon() {
  const id = useId().replace(/:/g, '')
  return (
    <Tile fill={['#ffffff', '#e9ecf1']}>
      <defs>
        <linearGradient id={`${id}-q`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#39b6ff" />
          <stop offset="1" stopColor="#1566e8" />
        </linearGradient>
      </defs>
      <circle cx="49" cy="48" r="26" fill="none" stroke={`url(#${id}-q)`} strokeWidth="13" />
      <path d="M58 58 76 78" stroke="#1566e8" strokeWidth="12" strokeLinecap="round" />
    </Tile>
  )
}

/** Photo Booth: a strip of two portraits under a curtain, on red, after the Mac's. */
export function PhotoBoothIcon() {
  return (
    <Tile fill={['#e8453c', '#b8241f']}>
      <rect x="27" y="20" width="46" height="64" rx="4" fill="#f4f1ec" />
      <rect x="32" y="27" width="36" height="24" rx="2" fill="#c9c6c0" />
      <rect x="32" y="55" width="36" height="24" rx="2" fill="#c9c6c0" />
      <g fill="#4a4b50">
        <circle cx="50" cy="35.5" r="5" />
        <path d="M39 51c0-7 5-10 11-10s11 3 11 10z" />
        <circle cx="50" cy="63.5" r="5" />
        <path d="M39 79c0-7 5-10 11-10s11 3 11 10z" />
      </g>
      <rect x="23" y="16" width="54" height="9" rx="4.5" fill="#1b1b1e" />
    </Tile>
  )
}

/** Spotify: its green disc and three arcs, on black. */
export function SpotifyIcon() {
  return (
    <Tile fill={['#17191a', '#060707']}>
      <circle cx="50" cy="50" r="31" fill="#1ed760" />
      <g fill="none" stroke="#0a0b0b" strokeLinecap="round">
        <path d="M32 40.500c12-3.6 26-2.4 37 3.8" strokeWidth="6" />
        <path d="M34.5 51.500c10-2.8 21-1.8 30 3.4" strokeWidth="5" />
        <path d="M37 61.500c8-2 16-1.2 23 2.8" strokeWidth="4.2" />
      </g>
    </Tile>
  )
}

/** YouTube: its red lozenge and white triangle, on white. */
export function YouTubeIcon() {
  return (
    <Tile fill={['#ffffff', '#f1f2f4']}>
      <rect x="13" y="26" width="74" height="48" rx="15" fill="#e62c20" />
      <path d="M42 38.5 62 50 42 61.500Z" fill="#fff" />
    </Tile>
  )
}

/** Workspace: its mark on the color last picked in it. Before any has been, on the orange it is known by. */
export function WorkspaceIcon() {
  const color = useStore(picked, (s) => s)
  const id = useId().replace(/:/g, '')
  const base = color?.color ?? '#f4640a'
  const n = parseInt(base.slice(1), 16)
  // (words on a color are near-black or white, whichever is read better: data/workspace.ts says the same)
  const lin = (c: number) => (c / 255 <= 0.03928 ? c / 255 / 12.92 : Math.pow((c / 255 + 0.055) / 1.055, 2.4))
  const light = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255)
  const ink = (light + 0.05) / 0.057 >= 1.05 / (light + 0.05) && color ? '#141414' : '#fff'
  return (
    <svg viewBox="0 0 100 100" className="app-icon" aria-hidden>
      <defs>
        {color?.shift ? (
          <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="1" y2="1">
            {color.shift.map((stop, i) => (
              <stop key={i} offset={i / (color.shift!.length - 1)} stopColor={stop} />
            ))}
          </linearGradient>
        ) : (
          <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={color ? base : '#ff8a2a'} />
            <stop offset="1" stopColor={base} />
          </linearGradient>
        )}
      </defs>
      <path d={squircle} fill={`url(#${id}-bg)`} />
      <path data-mark d={W_S.d} transform={set(W_S, 31, 50, 62)} fill={color?.shift ? '#fff' : ink} />
    </svg>
  )
}

/** A film, as a file on the desk: a page with a frame of it, its sprocket holes, and what kind of file it is. */
export function FilmIcon() {
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
      <rect x="28" y="36" width="45" height="30" rx="3" fill="#15161a" />
      <path d="M45 44 58 51 45 58Z" fill="#fff" />
      <g fill="#15161a">
        <rect x="28" y="71" width="6" height="5" rx="1" />
        <rect x="37.8" y="71" width="6" height="5" rx="1" />
        <rect x="47.6" y="71" width="6" height="5" rx="1" />
        <rect x="57.4" y="71" width="6" height="5" rx="1" />
        <rect x="67" y="71" width="6" height="5" rx="1" />
      </g>
      <rect x="52" y="85" width="24" height="10" rx="3" fill="#1657d6" />
      <path d={MOV.d} transform={set(MOV, 7.5, 64, 92.8)} fill="#fff" />
    </svg>
  )
}
