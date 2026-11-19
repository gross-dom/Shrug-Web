import { useId } from 'react'
import { CAP, FIGURES } from './clockFace'

// The Lock Screen's clock. Its figures are drawn as shapes, not set as type
// (clockFace.ts holds their outlines), so that the clock is one size and one
// shape on every phone, whatever type the phone has: on an iPhone 17 Pro's own
// Lock Screen the figures are a little over a fifth of the screen's width
// tall and "20:15" is seven tenths of it across, and so they are here. They are
// filled as glass: pale and seen through, brightest along the tops of the
// figures where the light catches, with a line of light round each (phone.css).

/** An iPhone's figures are a little wider than the face draws them. */
const WIDER = 1.04

/** The colon sits closer in than the face would put it: this is left either side of it. */
const BY_COLON = 42

/** The round figures run this far over a capital's height, top and foot: the drawing leaves room for it. */
const OVER = 30

export function LockClock({ time }: { time: string }) {
  const id = useId().replace(/:/g, '')
  const figures = [...time].filter((ch) => FIGURES[ch])
  let x = 0
  const placed = figures.map((ch, i) => {
    const figure = FIGURES[ch]!
    const last = figures[i - 1]
    if (last !== undefined) x += (last === ':' ? BY_COLON : FIGURES[last]!.after) + (ch === ':' ? BY_COLON : figure.before)
    const at = x
    x += figure.width
    return { ch, at, d: figure.d }
  })
  return (
    <p className="sb-lock__clock">
      {/* Read out as the time it is; the drawing is for the eye */}
      <span className="sr-only">{time}</span>
      <svg viewBox={`0 ${-OVER} ${Math.round(x * WIDER)} ${CAP + OVER * 2}`} aria-hidden>
        <defs>
          <linearGradient id={id} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2={CAP}>
            <stop offset="0.04" stopColor="#fff" stopOpacity="0.9" />
            <stop offset="0.46" stopColor="#fff" stopOpacity="0.5" />
            <stop offset="0.72" stopColor="#fff" stopOpacity="0.36" />
            <stop offset="1" stopColor="#fff" stopOpacity="0.6" />
          </linearGradient>
        </defs>
        <g transform={`scale(${WIDER} 1)`} style={{ fill: `url(#${id})` }}>
          {placed.map(({ ch, at, d }, i) => (
            <path key={`${i}${ch}`} d={d} transform={`translate(${at} 0)`} />
          ))}
        </g>
      </svg>
    </p>
  )
}
