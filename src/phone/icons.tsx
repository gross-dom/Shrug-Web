import { useId } from 'react'

// Icons the phone needs that the desktop doesn't. Drawn for Shrug, in the
// same continuous-corner tile as the desktop's.

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

/** The one-pager as an app icon: a page on a white tile. */
export function OnePagerIcon() {
  const id = useId().replace(/:/g, '')
  return (
    <svg viewBox="0 0 100 100" className="app-icon" aria-hidden>
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#e6e9f0" />
        </linearGradient>
      </defs>
      <path d={SQUIRCLE} fill={`url(#${id}-bg)`} />
      <path d="M31 22a6 6 0 0 1 6-6h19l15 15v47a6 6 0 0 1-6 6H37a6 6 0 0 1-6-6z" fill="#fff" stroke="rgba(0,0,0,0.14)" strokeWidth="1.2" />
      <path d="M56 16l15 15H61a5 5 0 0 1-5-5z" fill="#d5d9e2" />
      <g fill="none" strokeWidth="3.4" strokeLinecap="round">
        <path d="M39 45h14" stroke="#0a84ff" />
        <path d="M39 55h23M39 63h23M39 71h15" stroke="#c4c8d2" />
      </g>
    </svg>
  )
}
