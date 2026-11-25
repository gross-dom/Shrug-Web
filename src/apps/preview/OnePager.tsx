import { Wordmark } from '../../../store/src/brand'
import { ONE_PAGER as P } from '../../data/onepager'
import type { Sheet } from '../../os/papers'
import '../../styles/desk/onepager.css'

// The one-pager's two pages, at US Letter (816 by 1056), black on white, after design/v1's OnePager-Page1
// and OnePager-Page2. They are drawn by the site, in Shrug's own mark, wordmark and type, from the lines in
// src/data/onepager.ts. Preview shows them as it shows any document's pages; the file a visitor downloads
// is these same pages, printed (tools/onepager.cjs writes public/One-pager.pdf from them).

function Top({ page }: { page: number }) {
  return (
    <div className="op-top">
      {/* The name in full, as an official document carries it */}
      <b>
        <Wordmark lockup="capital" height={13} />
      </b>
      <span>{['One-pager', P.dated, `${page} of 2`].filter(Boolean).join(' · ')}</span>
    </div>
  )
}

const Foot = () => (
  <div className="op-foot">
    <span>{P.site}</span>
    {P.contact && <span>{P.contact}</span>}
  </div>
)

const Quote = ({ words, by }: { words: string; by: string }) => (
  <blockquote>
    “{words.replace(/^[“"]|[”"]$/g, '')}”<cite>{by}</cite>
  </blockquote>
)

/** A list under its heading. One with nothing in it (its lines are still Shrug's to write) is not drawn. */
function Listed({ head, lines, after }: { head: string; lines: string[]; after?: boolean }) {
  if (!lines.length) return null
  return (
    <>
      <h2 className={after ? 'op-h3--after' : undefined}>{head}</h2>
      <ul>
        {lines.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>
    </>
  )
}

const said = <T,>(items: (T | null)[]) => items.filter((item): item is T => item !== null)

function First() {
  const f = P.first
  const quotes = said(f.quotes)
  return (
    <div className="op">
      <Top page={1} />
      <h1>{f.headline}</h1>
      {f.lead && <p className="op-lead">{f.lead}</p>}
      <div className="op-stats">
        {f.stats.map((stat) => (
          <div key={stat.label}>
            <b>{stat.value}</b>
            <span>{stat.label}</span>
          </div>
        ))}
      </div>
      {(f.backs.length > 0 || f.works.length > 0) && (
        <div className="op-cols">
          <div>
            <Listed head="What we back" lines={f.backs} />
          </div>
          <div>
            <Listed head="How we work" lines={f.works} />
          </div>
        </div>
      )}
      {quotes.length > 0 && (
        <div className="op-cols">
          {quotes.map((quote, i) => (
            <div key={i}>
              <Quote {...quote} />
            </div>
          ))}
        </div>
      )}
      {f.beyond.length > 0 && (
        <div>
          <h2>Beyond the check</h2>
          <div className="op-stats op-stats--three">
            {f.beyond.map((item, i) => (
              <div key={i}>
                <b>{item.does}</b>
                <span>{item.line}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div>
        <h2>In the portfolio</h2>
        <div className="op-logos">
          {f.portfolio.map((name) => (
            <span key={name}>{name}</span>
          ))}
        </div>
      </div>
      <Foot />
    </div>
  )
}

function Second() {
  const s = P.second
  const quotes = said(s.quotes)
  return (
    <div className="op">
      <Top page={2} />
      <h1 className="op-h1--second">{s.headline}</h1>
      <div className="op-cols">
        <div>
          <h2>Shrug V at a glance</h2>
          <table>
            <tbody>
              {s.glance.map(([label, value]) => (
                <tr key={label}>
                  <td>{label}</td>
                  <td>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          {s.team.length > 0 && (
            <>
              <h2>The team</h2>
              <ul>
                {s.team.map((partner) => (
                  <li key={partner.name}>
                    <b>{partner.name}</b>
                    {partner.line && (
                      <>
                        <br />
                        {partner.line}
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
          <Listed head="Case studies" lines={s.cases} after={s.team.length > 0} />
        </div>
      </div>
      <div>
        <h2>By vertical</h2>
        <div className="op-logos op-logos--four">
          {s.verticals.map((name) => (
            <span key={name}>{name}</span>
          ))}
        </div>
      </div>
      <div>
        <h2>What people say</h2>
        {quotes.length > 0 && (
          <div className="op-cols">
            {quotes.map((quote, i) => (
              <Quote key={i} {...quote} />
            ))}
          </div>
        )}
        <p className="op-said">{s.said}</p>
      </div>
      <Foot />
    </div>
  )
}

/** The one-pager's pages, as Preview takes them. */
export const ONE_PAGER_SHEETS: Sheet[] = [
  { w: 816, h: 1056, draw: () => <First /> },
  { w: 816, h: 1056, draw: () => <Second /> },
]
