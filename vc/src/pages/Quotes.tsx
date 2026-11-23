import { useEffect, useRef, useState } from 'react'
import { initialsOf, TAGS, VOICES, type Person } from '../content'

// The landing page is what people say: every testimonial, in Shrug's order, each in full, down one long
// page. Nothing is cut short and nothing turns by itself. The pills at the top narrow the page to the
// founders Shrug has backed or to the investors (everyone else); the counts are of the data.

const isFounder = (person: Person) => person.relations.includes('F')

const FILTERS = [
  { id: 'all', label: 'All', has: (_: Person) => true },
  { id: 'founders', label: 'Founders', has: isFounder },
  { id: 'investors', label: 'Investors', has: (person: Person) => !isFounder(person) },
] as const

type Filter = (typeof FILTERS)[number]['id']

/** A line across the top of the window that fills as the page is read. Where the browser can tie an
 * animation to the scroll it is all CSS (styles.css); where it cannot, the same line is moved from here. */
function Progress() {
  const line = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (window.CSS?.supports?.('animation-timeline: scroll()')) return
    const read = () => {
      const room = document.documentElement.scrollHeight - window.innerHeight
      line.current?.style.setProperty('transform', `scaleX(${room > 0 ? Math.min(1, Math.max(0, window.scrollY / room)) : 0})`)
    }
    read()
    window.addEventListener('scroll', read, { passive: true })
    window.addEventListener('resize', read)
    return () => {
      window.removeEventListener('scroll', read)
      window.removeEventListener('resize', read)
    }
  }, [])
  return <div ref={line} className="progress" aria-hidden />
}

export function Quotes() {
  const [filter, setFilter] = useState<Filter>('all')
  const has = FILTERS.find((f) => f.id === filter)!.has
  return (
    <div className="quotes">
      <Progress />
      <div className="pills" role="group" aria-label="Filter">
        {FILTERS.map((f) => (
          <button key={f.id} type="button" className="pill" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
            <span>{f.label}</span>
            <span className="pill__count">{VOICES.filter(f.has).length}</span>
          </button>
        ))}
      </div>
      <p className="sr" role="status">
        {VOICES.filter(has).length} quotes showing
      </p>
      <div className="rows">
        {/* Every row is always on the page, so that it is all there before the script is; the pills only hide */}
        {VOICES.map((person) => (
          <article key={person.name} className="row" hidden={!has(person)}>
            <div className="who">
              {person.photo ? (
                <img className="who__face" src={`/people/${person.photo}`} width={64} height={64} alt={person.name} loading="lazy" decoding="async" />
              ) : (
                <span className="who__face who__face--none" aria-hidden>
                  {initialsOf(person.name)}
                </span>
              )}
              <div className="who__text">
                <div className="who__name">
                  <h2>{person.name}</h2>
                  <p>{person.role}</p>
                </div>
                <div className="who__tags">
                  {person.relations.map((relation) => (
                    <span key={relation} className="tag" data-look={TAGS[relation].look}>
                      {TAGS[relation].says}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <blockquote className="row__quote">{person.quote}</blockquote>
          </article>
        ))}
      </div>
    </div>
  )
}
