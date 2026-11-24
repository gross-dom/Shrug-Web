import type { Kind } from '../shared/rules'

// The few drawings the store has, as the design's screens draw them: a picture, a book and a document
// (what stands in for a product with no photograph yet), the two arrows, the tick, the lock and the cloud.

const svg = (size: number, width: number, inside: JSX.Element) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {inside}
  </svg>
)

const PICTURE = (
  <>
    <rect x="3" y="4" width="18" height="16" rx="3" />
    <circle cx="9" cy="10" r="1.6" />
    <path d="M4 17l5-4 4 3 3-2 4 3" />
  </>
)
const BOOK = (
  <>
    <path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z" />
    <path d="M5 17a3 3 0 0 1 3-3h11" />
  </>
)
const DOC = (
  <>
    <path d="M6 3h8l5 5v13H6z" />
    <path d="M14 3v5h5" />
    <path d="M9 13h7M9 17h5" />
  </>
)

/** What stands in for a product's photograph: a drawing of the sort of thing it is. */
export const KindIcon = ({ kind, size = 44, width = 1.2 }: { kind: Kind; size?: number; width?: number }) => svg(size, width, kind === 'Book' ? BOOK : kind === 'Document' ? DOC : PICTURE)
export const DocIcon = ({ size = 20 }: { size?: number }) => svg(size, 1.6, DOC)
export const Left = ({ size = 20 }: { size?: number }) => svg(size, size < 20 ? 2 : 1.8, <path d="M15 5l-7 7 7 7" />)
export const Right = ({ size = 20 }: { size?: number }) => svg(size, size < 20 ? 2 : 1.8, <path d="M9 5l7 7-7 7" />)
export const Tick = () => svg(24, 2.4, <path d="M5 12.5l4.5 4.5L19 7.5" />)
export const Lock = () =>
  svg(
    22,
    1.6,
    <>
      <rect x="5" y="10" width="14" height="10" rx="2.5" />
      <path d="M8 10V7.5a4 4 0 0 1 8 0V10" />
    </>,
  )
export const NoCloud = () =>
  svg(
    22,
    1.6,
    <>
      <path d="M7 18a4 4 0 0 1-.6-7.96A6 6 0 0 1 18 9.5 4.3 4.3 0 0 1 17.5 18z" />
      <path d="M4 4l16 16" />
    </>,
  )
