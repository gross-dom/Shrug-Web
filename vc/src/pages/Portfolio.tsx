import { useEffect, useState, type CSSProperties, type MouseEvent } from 'react'
import { Arrow } from '../Brand'
import { COMPANIES, type Company } from '../content'
import { MARKS, type Mark } from '../marks'

// The portfolio: a grid of square tiles from one edge of the window to the other, with nothing between
// them and nothing else on the page, as Founders Fund's is. At rest a tile holds the company's own wordmark
// and that is all: the mark its own site carries, in the colour of this page's text, not its app icon.
// Highlighted (a pointer over it, the keyboard on it, or the first tap on a touch screen) the mark gives way
// to the company's photograph, with its sector, its name and Shrug's line on it laid over the foot. A tile
// is one link to the company's site; a company with no site still highlights, and goes nowhere.
//
// The marks are in vc/public/companies and are listed in ../marks.ts, which says where they came from and
// which companies have none yet: those show their name set in type.

/** WHERE THE PHOTOGRAPHS GO. A lit tile shows the company's photograph; a company with none here shows a
 * dark fill marked [Photo: …]. The eight here are files Shrug sent, brought down to the size a tile can use.
 * To put one in, save it in vc/public/companies (900px or more on its shorter side; it is cropped to cover
 * the square tile) and name the file here against the company's `key` from src/data/portfolio.ts. The
 * crop keeps the middle of the picture; `at` moves it, where what matters is off to one side (it is CSS's
 * object-position: across, then down). */
const PHOTOS: Record<string, { file: string; at?: string }> = {
  Varda: { file: 'varda-photo.webp' },
  Hadrian: { file: 'hadrian-photo.webp' },
  // The file came with no company's name on it. It is a picture of wire harnesses, which is what Senra makes.
  Senra: { file: 'senra-photo.webp' },
  // Its file is smaller than the others (739px wide): it is the one Shrug chose of the two that came under Antares' name
  Antares: { file: 'antares-photo.webp' },
  // The other of those two, which Shrug says is Anduril's
  Anduril: { file: 'anduril-photo.webp' },
  AMCA: { file: 'amca-photo.webp' },
  // The machine being measured is at the left of the picture
  'Avalanche Energy': { file: 'avalanche-energy-photo.webp', at: '22% 50%' },
  'Eight Sleep': { file: 'eight-sleep-photo.webp' },
}

/** How much of its tile's width a mark takes. A long thin wordmark and a square symbol given the same width
 * would not look the same size, so a mark's width goes by the root of its proportions: about half the tile
 * for a wordmark of ordinary length, less for a compact one, more for a long one, within limits. */
const shareOf = (mark: Mark) => Math.min(0.64, Math.max(0.22, 0.5 * Math.sqrt(mark.w / mark.h / 4.5)))

// Not /portfolio, which is this page's own address: a folder of that name beside the page would be taken for it
const fileOf = (name: string) => `/companies/${name}`

function Tile({ company, on, onTap }: { company: Company; on: boolean; onTap: (e: MouseEvent) => void }) {
  const mark = MARKS[company.key]
  const photo = PHOTOS[company.key]
  const inside = (
    <>
      <span className="tile__logo">
        {mark ? (
          <span
            className="tile__mark"
            role="img"
            aria-label={company.name}
            style={{ '--share': shareOf(mark).toFixed(3), aspectRatio: `${mark.w} / ${mark.h}`, maskImage: `url(${fileOf(mark.file)})`, WebkitMaskImage: `url(${fileOf(mark.file)})` } as CSSProperties}
          />
        ) : (
          <span className="tile__name">{company.name}</span>
        )}
      </span>
      {/* The photograph says nothing the words do not: it is not read out */}
      <span className="tile__photo" aria-hidden>
        {photo && <img src={fileOf(photo.file)} alt="" loading="lazy" decoding="async" style={photo.at ? { objectPosition: photo.at } : undefined} />}
      </span>
      <span className="tile__shade" aria-hidden />
      <span className="tile__top" aria-hidden>
        <span className="label">{!photo && `[Photo: ${company.name}]`}</span>
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
