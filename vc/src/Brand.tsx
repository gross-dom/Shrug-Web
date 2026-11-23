import { FULL, G, SHORT } from './brand'

// The wordmark and its arrow, drawn from the kit's outlines. They take the colour of the text round them
// (black on Stone and on white, white on black): never a colour of their own.

/** SHRUG CAPITAL, or SHRUG alone (`short`). It is named for assistive tech; the drawing itself is not read. */
export function Wordmark({ short, className }: { short?: boolean; className?: string }) {
  const mark = short ? SHORT : FULL
  return (
    <svg className={className} viewBox={`0 0 ${mark.box[0]} ${mark.box[1]}`} role="img" aria-label={short ? 'Shrug' : 'Shrug Capital'}>
      <path transform={`scale(${mark.scale})`} fill="currentColor" d={mark.d} />
    </svg>
  )
}

/** The arrow out of the G, on its own: it marks a point (a link that leaves, a list, a corner). */
export function Arrow({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="327.31 261.02 274.84 267.93" aria-hidden>
      <path fill="currentColor" d={G.arrow} />
    </svg>
  )
}
