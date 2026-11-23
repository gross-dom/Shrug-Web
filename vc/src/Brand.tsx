import { ARROW, FULL } from './brand'

// The wordmark and its arrow, drawn from the kit's outlines. They take the colour of the text round them
// (black on white, white on black): never a colour of their own.

/** SHRUG CAPITAL. It is named for assistive tech; the drawing itself is not read. On the pages it stands in
 * two places only: the foot of the menu and the footer. */
export function Wordmark({ className, width, height }: { className?: string; width?: number; height?: number }) {
  return (
    <svg className={className} viewBox={`0 0 ${FULL.box[0]} ${FULL.box[1]}`} width={width} height={height} role="img" aria-label="Shrug Capital">
      <path transform={`scale(${FULL.scale})`} fill="currentColor" d={FULL.d} />
    </svg>
  )
}

/** The arrow out of the G, on its own: it marks a link that goes somewhere. */
export function Arrow({ size = 11, className }: { size?: number; className?: string }) {
  return (
    <svg className={className ? `arrow ${className}` : 'arrow'} viewBox={ARROW.box.join(' ')} width={size} height={size} aria-hidden>
      <path fill="currentColor" d={ARROW.d} />
    </svg>
  )
}
