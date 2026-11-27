import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { initialsOf, TAGS, VOICES, type Person } from '../content'

// The landing page is what people say: every testimonial, in Shrug's order, each in full, down one long
// page. Nothing is cut short and nothing turns by itself. The filters at the top narrow the page to the
// founders Shrug has backed or to the investors (everyone else); the counts are of the data.

const isFounder = (person: Person) => person.relations.includes('F')

const FILTERS = [
  { id: 'all', label: 'All', has: (_: Person) => true },
  { id: 'founders', label: 'Founders', has: isFounder },
  { id: 'investors', label: 'Investors', has: (person: Person) => !isFounder(person) },
] as const

type Filter = (typeof FILTERS)[number]['id']

/** A line across the top of the window that fills as the page is read. It is moved from here, a frame at a
 * time, and only ever by how far the page has been read: a browser's own bars coming and going change the
 * window's height (and with it how much page there is left), so the page's whole height is what it is
 * measured against, less the least the window has been, and the line never goes back while the page goes on. */
function Progress() {
  const line = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let frame = 0
    const read = () => {
      frame = 0
      const page = document.documentElement
      // (the visible part of the window, where the browser says: its bars are not part of the page)
      const tall = window.visualViewport?.height ?? window.innerHeight
      const room = page.scrollHeight - tall
      const at = room > 0 ? Math.min(1, Math.max(0, window.scrollY / room)) : 0
      line.current?.style.setProperty('transform', `scaleX(${at.toFixed(4)})`)
    }
    const ask = () => {
      if (!frame) frame = requestAnimationFrame(read)
    }
    read()
    window.addEventListener('scroll', ask, { passive: true })
    window.addEventListener('resize', ask)
    window.visualViewport?.addEventListener('resize', ask)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', ask)
      window.removeEventListener('resize', ask)
      window.visualViewport?.removeEventListener('resize', ask)
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
      <div className="filters rise" role="group" aria-label="Filter">
        {FILTERS.map((f) => (
          <button key={f.id} type="button" className="filter mono" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
            <span>{f.label}</span>
            <span className="filter__count">{VOICES.filter(f.has).length}</span>
          </button>
        ))}
      </div>
      <p className="sr" role="status">
        {VOICES.filter(has).length} quotes showing
      </p>
      <div className="rows">
        {/* Every row is always on the page, so that it is all there before the script is; the filters only hide.
            The rows in view when the page opens come in one after another from the top (--i, in styles.css). */}
        {VOICES.map((person, n) => (
          <article key={person.name} className="row" hidden={!has(person)} style={{ '--i': Math.min(n + 2, 10) } as CSSProperties}>
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
