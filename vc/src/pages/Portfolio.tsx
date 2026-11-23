import { useMemo, useState } from 'react'
import { Arrow } from '../Brand'
import { COMPANIES, FACTS, hostOf, VERTICALS } from '../content'

// The portfolio: every company, in Shrug's order, with its logo and one line on what it does. It can be
// narrowed to a vertical. A company with a site is a link to it; one without is simply listed.

export function Portfolio() {
  const [vertical, setVertical] = useState<string | null>(null)
  const shown = useMemo(() => (vertical ? COMPANIES.filter((company) => company.vertical === vertical) : COMPANIES), [vertical])
  const backs = FACTS.find((fact) => fact.label === 'Backs')!.value
  return (
    <>
      <section className="hero hero--page">
        <p className="label">Portfolio</p>
        <h1 className="h1">{COMPANIES.length} companies.</h1>
        <p className="lead">{backs}.</p>
      </section>
      <section className="portfolio" aria-label="Companies">
        <div className="chips chips--wrap" role="group" aria-label="Vertical">
          <button type="button" className="chip" aria-pressed={vertical === null} onClick={() => setVertical(null)}>
            All <i>{COMPANIES.length}</i>
          </button>
          {VERTICALS.filter((v) => v.companies.length).map((v) => (
            <button key={v.name} type="button" className="chip" aria-pressed={vertical === v.name} onClick={() => setVertical(vertical === v.name ? null : v.name)}>
              {v.name} <i>{v.companies.length}</i>
            </button>
          ))}
        </div>
        <p className="sr" role="status">
          {shown.length} companies showing
        </p>
        <ul className="companies">
          {shown.map((company) => {
            const inside = (
              <>
                <span className="logo" data-empty={company.logo ? undefined : ''} aria-hidden>
                  {company.logo ? <img src={`/logos/${company.logo}`} width={56} height={56} alt="" loading="lazy" decoding="async" /> : company.name.trim()[0]}
                </span>
                <span className="company__text">
                  <b>{company.name}</b>
                  {company.blurb && <span className="company__blurb">{company.blurb}</span>}
                  <span className="company__foot">
                    <span className="label">{company.vertical}</span>
                    {company.url && (
                      <span className="company__host">
                        {/notion\.site/.test(company.url) ? 'Case study' : hostOf(company.url)}
                        <Arrow className="arrow arrow--out" />
                      </span>
                    )}
                  </span>
                </span>
              </>
            )
            return (
              <li key={company.key}>
                {company.url ? (
                  <a className="company" href={company.url} target="_blank" rel="noopener">
                    {inside}
                    <span className="sr">, opens in a new tab</span>
                  </a>
                ) : (
                  <div className="company">{inside}</div>
                )}
              </li>
            )
          })}
        </ul>
      </section>
    </>
  )
}
