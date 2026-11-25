import { useId, type ReactNode } from 'react'
import { MOV, W_S, set } from '../data/lettering'
import { useStore } from './store'
import { picked } from './workspace'

// The icons of the v1 apps (design/v1). Each is drawn here, as every icon on the desktop is. Mail's,
// QuickTime Player's, Photo Booth's, Spotify's and YouTube's are drawn after the icons Dom supplied for them
// (design/v1/reference): the apps a visitor already knows them by. Workspace's
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

/** Mail: Superhuman's, from Dom's picture of it in a Dock: a large pale envelope, white fading to lilac, its
 * flap one soft violet line, on a tile that goes from indigo to plum. */
export function MailIcon() {
  const id = useId().replace(/:/g, '')
  return (
    <Tile fill={['#3d2c8a', '#5a2869']}>
      <defs>
        <linearGradient id={`${id}-env`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#f1daf6" />
        </linearGradient>
      </defs>
      <rect x="14" y="27" width="72" height="46.5" rx="9" fill={`url(#${id}-env)`} />
      <path d="M17.5 31.5Q33 44.5 44.2 55.3a8.3 8.3 0 0 0 11.6 0Q67 44.5 82.5 31.5" fill="none" stroke="#4a2a82" strokeWidth="4.4" strokeLinecap="round" strokeLinejoin="round" />
    </Tile>
  )
}

/** QuickTime Player: the Mac's old one, and Dom's own picture of it (public/icons/quicktime.webp, with the white
 * it stood on cut away): the blue Q, with no tile under it, as it was. */
export function QuickTimeIcon() {
  return (
    <svg viewBox="0 0 100 100" className="app-icon" aria-hidden>
      <image href="/icons/quicktime.webp" x="3" y="3" width="94" height="94" preserveAspectRatio="xMidYMid meet" />
    </svg>
  )
}

/** Photo Booth: the Mac's, from Dom's picture of it: a strip of two grey portraits coming down out of a dark
 * slot, on red. */
export function PhotoBoothIcon() {
  return (
    <Tile fill={['#e0453b', '#c32e25']}>
      <rect x="26.5" y="21" width="47" height="74" rx="2.5" fill="#f4f4f2" />
      <rect x="30.5" y="27.5" width="39" height="29.5" rx="1.5" fill="#c8c8c8" />
      <rect x="30.5" y="61" width="39" height="29.5" rx="1.5" fill="#c8c8c8" />
      <g fill="#787878">
        <circle cx="50" cy="38" r="6.6" />
        <path d="M35.5 57c0-8.2 6.3-11.8 14.5-11.8S64.5 48.8 64.5 57z" />
        <circle cx="50" cy="71.5" r="6.6" />
        <path d="M35.5 90.5c0-8.2 6.3-11.8 14.5-11.8s14.5 3.6 14.5 11.8z" />
      </g>
      <rect x="14" y="16.5" width="72" height="9.5" rx="4.75" fill="#27110f" />
    </Tile>
  )
}

/** Spotify: its green disc and three arcs, large on black, as its own icon has them. */
export function SpotifyIcon() {
  return (
    <Tile fill={['#141414', '#050505']}>
      <g transform="translate(50 50) scale(1.2) translate(-50 -50)">
        <circle cx="50" cy="50" r="31" fill="#1ed760" />
        <g fill="none" stroke="#0a0b0b" strokeLinecap="round">
          <path d="M32 40.5c12-3.6 26-2.4 37 3.8" strokeWidth="6" />
          <path d="M34.5 51.5c10-2.8 21-1.8 30 3.4" strokeWidth="5" />
          <path d="M37 61.5c8-2 16-1.2 23 2.8" strokeWidth="4.2" />
        </g>
      </g>
    </Tile>
  )
}

/** YouTube: its red shape, nearly the tile's width, and the white triangle, on white, as its own icon has them. */
export function YouTubeIcon() {
  return (
    <Tile fill={['#ffffff', '#f4f4f5']}>
      <path d="M50 18.5C75 18.5 88 19.3 91.8 23.3C95.5 27.2 96 39 96 50C96 61 95.5 72.8 91.8 76.7C88 80.7 75 81.5 50 81.5C25 81.5 12 80.7 8.2 76.7C4.5 72.8 4 61 4 50C4 39 4.5 27.2 8.2 23.3C12 19.3 25 18.5 50 18.5Z" fill="#e52d27" />
      <path d="M40.5 35.5 65.5 50 40.5 64.5Z" fill="#fff" />
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
