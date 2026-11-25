import type { ReactNode } from 'react'

// The pictures for a sky in the Weather window, as the Mac's Weather draws them: filled, not outlined, the
// cloud white, the sun yellow, the rain blue. (The widget on the desk keeps the outlines it has always
// had: os/SanFrancisco.tsx.) Which picture goes with which words follows `glyphOf` there, so that the
// window and the widget never disagree about a sky.

const SUN = '#ffd60a'
const RAIN = '#74d3ff'

/** A cloud, 20 by 14 from (2, 5) in a square of 24. */
const CLOUD = 'M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z'
/** A crescent, in the same square. */
const MOON = 'M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z'

type Kind = 'storm' | 'snow' | 'drizzle' | 'rain' | 'fog' | 'partly' | 'partly-night' | 'cloud' | 'wind' | 'sun' | 'moon'

function kindOf(says: string, day: boolean): Kind {
  if (/thunder|t-?storm/i.test(says)) return 'storm'
  if (/snow|sleet|ice|flurr|blizzard|wintry/i.test(says)) return 'snow'
  if (/drizzle|light rain|showers?/i.test(says)) return 'drizzle'
  if (/rain/i.test(says)) return 'rain'
  if (/fog|haze|mist|smoke/i.test(says)) return 'fog'
  if (/partly|mostly (sunny|clear)|few clouds/i.test(says)) return day ? 'partly' : 'partly-night'
  if (/cloud|overcast/i.test(says)) return 'cloud'
  if (/wind|breez/i.test(says)) return 'wind'
  return day ? 'sun' : 'moon'
}

/** A sun: its disc, and rays round it from `from` out to `to`. */
const sun = (cx: number, cy: number, r: number, from: number, to: number, width: number): ReactNode => (
  <g fill={SUN} stroke={SUN} strokeWidth={width} strokeLinecap="round">
    <circle cx={cx} cy={cy} r={r} stroke="none" />
    {Array.from({ length: 8 }, (_, i) => {
      const a = (i * Math.PI) / 4
      return <line key={i} x1={cx + Math.cos(a) * from} y1={cy + Math.sin(a) * from} x2={cx + Math.cos(a) * to} y2={cy + Math.sin(a) * to} />
    })}
  </g>
)

/** A cloud with room under it for what falls from it. */
const high = <path d={CLOUD} transform="translate(1.7 -2) scale(0.86)" fill="#fff" />

const PICTURES: Record<Kind, ReactNode> = {
  cloud: <path d={CLOUD} fill="#fff" />,
  sun: sun(12, 12, 4.6, 7.4, 9.4, 2),
  moon: <path d={MOON} fill="#fff" />,
  partly: (
    <>
      {sun(16.6, 7.8, 3.4, 5.4, 6.8, 1.6)}
      <path d={CLOUD} transform="translate(-0.4 5.6) scale(0.8)" fill="#fff" />
    </>
  ),
  'partly-night': (
    <>
      <path d={MOON} transform="translate(10.2 0.6) scale(0.56)" fill="#fff" />
      <path d={CLOUD} transform="translate(-0.4 5.6) scale(0.8)" fill="#fff" />
    </>
  ),
  rain: (
    <>
      {high}
      <g stroke={RAIN} strokeWidth="1.9" strokeLinecap="round">
        <line x1="8.4" y1="17" x2="7.2" y2="21.2" />
        <line x1="12.8" y1="17" x2="11.6" y2="21.2" />
        <line x1="17.2" y1="17" x2="16" y2="21.2" />
      </g>
    </>
  ),
  drizzle: (
    <>
      {high}
      <g stroke={RAIN} strokeWidth="1.9" strokeLinecap="round">
        <line x1="8.2" y1="17" x2="7.8" y2="18.4" />
        <line x1="12.6" y1="17" x2="12.2" y2="18.4" />
        <line x1="17" y1="17" x2="16.6" y2="18.4" />
        <line x1="10" y1="20.2" x2="9.6" y2="21.6" />
        <line x1="14.4" y1="20.2" x2="14" y2="21.6" />
      </g>
    </>
  ),
  storm: (
    <>
      {high}
      <path d="M13.4 14.6 9.6 19.3h2.7l-.9 3.5 4.2-4.9h-2.7l1.1-3.3z" fill={SUN} />
    </>
  ),
  snow: (
    <>
      {high}
      <g fill="#fff">
        <circle cx="8" cy="18" r="1.15" />
        <circle cx="12.4" cy="18" r="1.15" />
        <circle cx="16.8" cy="18" r="1.15" />
        <circle cx="10.2" cy="21.2" r="1.15" />
        <circle cx="14.6" cy="21.2" r="1.15" />
      </g>
    </>
  ),
  fog: (
    <>
      {high}
      <g stroke="#fff" strokeWidth="1.8" strokeLinecap="round" opacity="0.85">
        <line x1="5" y1="17.6" x2="19" y2="17.6" />
        <line x1="7" y1="21" x2="17" y2="21" />
      </g>
    </>
  ),
  wind: (
    <g fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9h10.5a2.5 2.5 0 1 0-2.4-3.2" />
      <path d="M3 13h15a2.6 2.6 0 1 1-2.5 3.3" />
      <path d="M3 17h7" />
    </g>
  ),
}

/** The picture for a sky, by what the Service calls it. Said aloud as the Service says it. */
export function SkyGlyph({ says, day, size = 22 }: { says: string; day: boolean; size?: number }) {
  return (
    <svg className="wt-glyph" width={size} height={size} viewBox="0 0 24 24" role="img" aria-label={says}>
      {PICTURES[kindOf(says, day)]}
    </svg>
  )
}

/** The sun at the horizon, going down or coming up. */
export function HorizonGlyph({ is, size = 22 }: { is: 'rise' | 'set'; size?: number }) {
  return (
    <svg className="wt-glyph" width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <g fill="none" stroke={SUN} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7.2 17.4a4.8 4.8 0 0 1 9.6 0Z" fill={SUN} stroke="none" />
        <line x1="3" y1="20.4" x2="21" y2="20.4" />
        <line x1="4.4" y1="14.2" x2="5.8" y2="15" />
        <line x1="19.6" y1="14.2" x2="18.2" y2="15" />
        {is === 'set' ? <path d="M12 3.2v6M9.6 7l2.4 2.4L14.4 7" stroke="#fff" /> : <path d="M12 9.4v-6M9.6 5.6 12 3.2l2.4 2.4" stroke="#fff" />}
      </g>
    </svg>
  )
}
