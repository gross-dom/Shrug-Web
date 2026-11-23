import { useEffect, useState, type MouseEvent } from 'react'
import { Arrow } from '../Brand'
import { COMPANIES, type Company } from '../content'

// The portfolio: a grid of square tiles from one edge of the window to the other, with nothing between
// them and nothing else on the page. At rest a tile holds the company's logo and that is all. Highlighted
// (a pointer over it, the keyboard on it, or the first tap on a touch screen) the logo gives way to the
// company's photograph, with its sector, its name and Shrug's line on it laid over the foot. A tile is one
// link to the company's site; a company with no site still highlights, and goes nowhere.

/** WHERE THE REAL PICTURES GO. The design wants, for each company, a single-colour logo and a photograph.
 * Neither has been supplied, and the colour app icons in public/logos are not to stand in for them: the
 * grid is strictly black and white. Until they arrive a tile shows the company's name set in type, marked
 * [Logo], and a dark fill marked [Photo: …].
 *
 * To put one in: save the logo as an SVG in vc/public/portfolio (one colour, any colour: it is drawn as a
 * mask and takes the colour of the text) and the photograph beside it (800px square or more; it is cropped
 * to cover the tile), then name the files here against the company's `key` from src/data/portfolio.ts:
 *
 *   Varda: { logo: 'varda.svg', photo: 'varda.jpg' },
 *
 * A company named here with only one of the two shows that one and keeps the placeholder for the other. */
const ART: Record<string, { logo?: string; photo?: string }> = {}

const fileOf = (name: string) => `/portfolio/${name}`

function Tile({ company, on, onTap }: { company: Company; on: boolean; onTap: (e: MouseEvent) => void }) {
  const art = ART[company.key] ?? {}
  const inside = (
    <>
      <span className="tile__logo">
        {art.logo ? (
          <span className="tile__mark" role="img" aria-label={company.name} style={{ maskImage: `url(${fileOf(art.logo)})`, WebkitMaskImage: `url(${fileOf(art.logo)})` }} />
        ) : (
          <>
            <span className="tile__name">{company.name}</span>
            <span className="label" aria-hidden>
              [Logo]
            </span>
          </>
        )}
      </span>
      {/* The photograph says nothing the words do not: it is not read out */}
      <span className="tile__photo" aria-hidden>
        {art.photo && <img src={fileOf(art.photo)} alt="" loading="lazy" decoding="async" />}
      </span>
      <span className="tile__shade" aria-hidden />
      <span className="tile__top" aria-hidden>
        <span className="label">{!art.photo && `[Photo: ${company.name}]`}</span>
        {company.url && <Arrow size={13} />}
      </span>
      {/* Faded out at rest, never taken off the page: a screen reader has the sector and the write-up whether or not the tile is lit */}
      <span className="tile__words">
        <span className="tile__sector">{company.vertical}</span>
        <span className="tile__title" aria-hidden>
          {company.name}
        </span>
        {company.blurb && <span className="tile__blurb">{company.blurb}</span>}
      </span>
    </>
  )
  return company.url ? (
    <a className="tile" href={company.url} data-on={on || undefined} onClick={onTap}>
      {inside}
    </a>
  ) : (
    <div className="tile" tabIndex={0} data-on={on || undefined} onClick={onTap}>
      {inside}
    </div>
  )
}

export function Portfolio() {
  /** The tile a tap has lit, on a screen with nothing to hover with. */
  const [lit, setLit] = useState<string | null>(null)
  // A tap anywhere that is not a tile puts the light out
  useEffect(() => {
    const out = (e: Event) => {
      if (!(e.target as Element).closest?.('.tile')) setLit(null)
    }
    document.addEventListener('click', out)
    return () => document.removeEventListener('click', out)
  }, [])
  /** On a touch screen the first tap lights the tile and the second follows its link. With a pointer that hovers, a press is a press. */
  const tap = (key: string) => (e: MouseEvent) => {
    if (!window.matchMedia?.('(hover: none)').matches || lit === key) return
    e.preventDefault()
    setLit(key)
  }
  return (
    <ul className="tiles">
      {COMPANIES.map((company) => (
        <li key={company.key}>
          <Tile company={company} on={lit === company.key} onTap={tap(company.key)} />
        </li>
      ))}
    </ul>
  )
}
