import type { Kind } from '../shared/rules'

// A stand-in picture for a product that has none yet: a line drawing of the sort of thing it is, in the
// pack's own gold. It says that it is a placeholder. A picture put in Airtable (Products → Picture) takes
// its place.

const LINE = { fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

const DRAWN: Record<Kind, JSX.Element> = {
  Book: (
    <>
      <path {...LINE} d="M40 24h64a6 6 0 0 1 6 6v92a6 6 0 0 1-6 6H40z" />
      <path {...LINE} d="M40 24a10 10 0 0 0-10 10v84a10 10 0 0 0 10 10M52 24v104" />
      <path {...LINE} d="M66 50h30M66 62h30M66 74h18" opacity="0.7" />
      <rect {...LINE} x="66" y="94" width="30" height="18" rx="2" />
    </>
  ),
  Chair: (
    <>
      <path {...LINE} d="M52 22h36a8 8 0 0 1 8 8v40a6 6 0 0 1-6 6H50a6 6 0 0 1-6-6V30a8 8 0 0 1 8-8z" />
      <path {...LINE} d="M36 86h68a6 6 0 0 1 0 12H36a6 6 0 0 1 0-12zM60 76v10M80 76v10" />
      <path {...LINE} d="M36 70v16M104 70v16" opacity="0.7" />
      <path {...LINE} d="M70 98v20M70 118l-26 10M70 118l26 10M70 118v12" />
      <circle {...LINE} cx="44" cy="131" r="3" />
      <circle {...LINE} cx="96" cy="131" r="3" />
      <circle {...LINE} cx="70" cy="133" r="3" />
    </>
  ),
  Art: (
    <>
      <rect {...LINE} x="24" y="30" width="92" height="92" rx="3" />
      <circle {...LINE} cx="32" cy="38" r="2" />
      <circle {...LINE} cx="108" cy="38" r="2" />
      <circle {...LINE} cx="32" cy="114" r="2" />
      <circle {...LINE} cx="108" cy="114" r="2" />
      <circle {...LINE} cx="58" cy="68" r="16" />
      <path {...LINE} d="M44 108l26-34 14 18 10-12 12 16" />
      <path {...LINE} d="M82 50h18M82 58h10" opacity="0.7" />
    </>
  ),
  Document: (
    <>
      <path {...LINE} d="M40 22h42l20 20v82a6 6 0 0 1-6 6H40a6 6 0 0 1-6-6V28a6 6 0 0 1 6-6z" />
      <path {...LINE} d="M82 22v14a6 6 0 0 0 6 6h14" />
      <path {...LINE} d="M48 62h40M48 74h40M48 86h40M48 98h24" opacity="0.7" />
      <path {...LINE} d="M48 46h18" />
    </>
  ),
  Other: (
    <>
      <path {...LINE} d="M70 24l40 20v50l-40 22-40-22V44z" />
      <path {...LINE} d="M30 44l40 22 40-22M70 66v50" />
    </>
  ),
}

export function Art({ kind }: { kind: Kind }) {
  return (
    <span className="art" aria-hidden>
      <svg viewBox="0 0 140 150">{DRAWN[kind]}</svg>
      <i>Placeholder</i>
    </span>
  )
}
