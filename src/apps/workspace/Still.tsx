import { useId } from 'react'
import { W_S, set } from '../../data/lettering'

// The chair as a drawing: what the studio shows while the 3D chair is on its way, what stays where 3D
// cannot run, and the chair on a slab and on an owner's card. It is drawn here, in the paint it is given: a
// stand-in for the real chair, as the design's own drawing is (design/v1-workspace). No photograph of the
// chair is used anywhere.

export function ChairStill({ paint, shift, width = 320, className, label }: { paint: string; shift?: string[]; width?: number; className?: string; label?: string }) {
  const id = useId().replace(/:/g, '')
  const fill = shift ? `url(#${id}-paint)` : paint
  return (
    <svg viewBox="0 0 300 400" width={width} className={className} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <defs>
        <pattern id={`${id}-mesh`} width="7" height="7" patternUnits="userSpaceOnUse">
          <circle cx="3.5" cy="3.5" r="1.2" fill="#40424a" />
        </pattern>
        {shift && (
          <linearGradient id={`${id}-paint`} gradientUnits="userSpaceOnUse" x1="50" y1="60" x2="250" y2="380">
            {shift.map((color, i) => (
              <stop key={i} offset={i / (shift.length - 1)} stopColor={color} />
            ))}
          </linearGradient>
        )}
      </defs>
      <ellipse cx="150" cy="384" rx="116" ry="12" fill="#000" opacity=".2" />
      <g fill="#0d0e10">
        <circle cx="50" cy="372" r="10" />
        <circle cx="250" cy="372" r="10" />
        <circle cx="150" cy="382" r="10" />
        <circle cx="95" cy="356" r="8" />
        <circle cx="205" cy="356" r="8" />
      </g>
      <path d="M150 330 52 366M150 330l98 36M150 330v46M150 330l-54 22M150 330l54 22" stroke="rgba(0,0,0,.28)" strokeWidth="17" strokeLinecap="round" fill="none" />
      <path d="M150 330 52 366M150 330l98 36M150 330v46M150 330l-54 22M150 330l54 22" stroke={fill} strokeWidth="13" strokeLinecap="round" fill="none" />
      <rect x="141" y="268" width="18" height="64" rx="5" fill="#b3b7bd" />
      <rect x="66" y="236" width="168" height="34" rx="15" fill="#17181b" />
      <g fill="#0d0e10">
        <rect x="40" y="188" width="13" height="62" rx="5" />
        <rect x="247" y="188" width="13" height="62" rx="5" />
        <rect x="26" y="176" width="46" height="15" rx="7.5" />
        <rect x="228" y="176" width="46" height="15" rx="7.5" />
      </g>
      <path d="M86 86c0-12 8-20 20-20h88c12 0 20 8 20 20l-12 140c-1 10-8 16-18 16h-68c-10 0-17-6-18-16L86 86Z" fill="#131417" />
      <path d="M86 86c0-12 8-20 20-20h88c12 0 20 8 20 20l-12 140c-1 10-8 16-18 16h-68c-10 0-17-6-18-16L86 86Z" fill={`url(#${id}-mesh)`} />
      <rect x="104" y="10" width="92" height="44" rx="17" fill="#131417" />
      <rect x="104" y="10" width="92" height="44" rx="17" fill={`url(#${id}-mesh)`} />
      <path d="M150 50v28" stroke={fill} strokeWidth="12" strokeLinecap="round" />
      <path d="M150 262V196M150 196C150 150 104 152 100 92M150 196C150 150 196 152 200 92" stroke="rgba(0,0,0,.3)" strokeWidth="20" strokeLinecap="round" fill="none" />
      <path d="M150 262V196M150 196C150 150 104 152 100 92M150 196C150 150 196 152 200 92" stroke={fill} strokeWidth="16" strokeLinecap="round" fill="none" />
      <path d="M146 258V198C146 156 108 154 104 96" stroke="#fff" strokeOpacity=".28" strokeWidth="3" strokeLinecap="round" fill="none" />
      <rect x="100" y="170" width="100" height="26" rx="11" fill="#0d0e10" />
      <path d={W_S.d} transform={set(W_S, 13, 150, 188)} fill="#c9ccd2" />
    </svg>
  )
}
