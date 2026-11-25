import { CAPITAL, SHRUG, STORE, VIP, WIDE } from '../shared/wordmark'

// Shrug's wordmark, as the brand kit draws it: SHRUG in Unbounded Bold, with the G whose bar turns down into
// an arrow, and what follows it (VIP, STORE) in Unbounded Light, as the kit sets CAPITAL. These are outlines,
// not type: the G is not to be redrawn, and no typeface has to arrive for them. White on the store's black,
// never a colour. All three are in the units of the face (1,000 to the em), on one baseline.


const NAMED = { shrug: 'Shrug', vip: 'Shrug VIP', store: 'Shrug VIP Store', capital: 'Shrug Capital' }

/** SHRUG, SHRUG VIP, SHRUG VIP STORE, or SHRUG CAPITAL (the fund's own name in full: what an official document
 * carries). It is named for assistive tech; the drawing itself is not read. */
export function Wordmark({ lockup = 'store', height = 14, className }: { lockup?: 'shrug' | 'vip' | 'store' | 'capital'; height?: number; className?: string }) {
  const wide = WIDE[lockup]
  return (
    <svg className={className} viewBox={`0 0 ${wide} 782`} width={Math.round((wide / 782) * height * 10) / 10} height={height} role="img" aria-label={NAMED[lockup]}>
      <path fill="currentColor" d={wordmarkPath(lockup)} />
    </svg>
  )
}

/** A lockup's outline and its width (782 tall), for where it is drawn without React: a page written as text, a picture. */
export const wordmarkPath = (lockup: 'shrug' | 'vip' | 'store' | 'capital') => SHRUG + (lockup === 'shrug' ? '' : lockup === 'capital' ? CAPITAL : VIP) + (lockup === 'store' ? STORE : '')
export const wordmarkWide = (lockup: 'shrug' | 'vip' | 'store' | 'capital') => WIDE[lockup]

/** Points, as a mark: a gold coin with the turn of the wordmark's G struck into it. It stands wherever a
 * number is a number of points, in place of the word. */
export function PointsMark({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg className={className ? `pm ${className}` : 'pm'} viewBox="0 0 20 20" width={size} height={size} aria-hidden="true">
      <circle cx="10" cy="10" r="10" fill="#d9b862" />
      <path fill="#0c0c0d" d="M5.4 6h8.6v8.6h-3.1V9.1H5.4z" />
    </svg>
  )
}

/** A number of points: the mark, then the figure. Read aloud as "8,400 points". */
export function Points({ n, size = 16, sign = '' }: { n: number; size?: number; sign?: string }) {
  const figure = n.toLocaleString('en-US')
  return (
    <span className="pts-n">
      <PointsMark size={size} />
      <span aria-hidden="true">
        {sign}
        {figure}
      </span>
      <span className="sr">
        {sign === '−' ? 'minus ' : sign === '+' ? 'plus ' : ''}
        {figure} points
      </span>
    </span>
  )
}
