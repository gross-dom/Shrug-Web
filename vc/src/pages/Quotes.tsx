import { useEffect, useMemo, useRef, useState } from 'react'
import { CaseStudiesLink } from '../App'
import { Arrow } from '../Brand'
import { CASE_STUDIES, COMPANIES, FACTS, initialsOf, KINDS, SITE, VOICES, type Person, type Relation } from '../content'
import { PageLink } from '../router'

// The landing page is what people say. One quote at a time is given the stage, large, and moves on by
// itself; under it is everyone, as a wall that can be narrowed to founders, to the people who invest in
// Shrug or to those who invest beside it, or searched by a name or a company.

function Face({ person, size = 44 }: { person: Person; size?: number }) {
  return person.photo ? (
    <img className="face" src={`/people/${person.photo}`} width={size} height={size} alt="" loading="lazy" decoding="async" />
  ) : (
    <span className="face face--none" style={{ width: size, height: size, fontSize: size * 0.36 }} aria-hidden>
      {initialsOf(person.name)}
    </span>
  )
}

const kindsOf = (person: Person) => KINDS.filter((kind) => person.relations.includes(kind.id))

/** The quotes that take the stage: those short enough to be read large. (Everyone is on the wall below.) */
const STAGED = VOICES.filter((person) => person.quote.length <= 290)

/** How long one quote has the stage, by its length: long enough to read it at an ordinary pace. */
const stayFor = (quote: string) => Math.min(15000, 4200 + quote.length * 40)

/** One quote at a time, large. It moves on by itself (not for someone who has asked for less motion, and
 * not while a pointer or the keyboard is on it); the arrows step, and Shuffle picks one at random. Every
 * staged quote is laid in the same place, only the one showing seen, so that the stage is as tall as its
 * tallest and the page under it never moves as they change. */
function Stage() {
  const [at, setAt] = useState(0)
  const [held, setHeld] = useState(false)
  const [turn, setTurn] = useState(0)
  const person = STAGED[at]!
  const step = (by: number) => {
    setAt((n) => (n + by + STAGED.length) % STAGED.length)
    setTurn((t) => t + 1)
  }
  const shuffle = () => {
    setAt((n) => {
      let next = n
      while (next === n) next = Math.floor(Math.random() * STAGED.length)
      return next
    })
    setTurn((t) => t + 1)
  }
  const still = useRef(false)
  useEffect(() => {
    still.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }, [])
  useEffect(() => {
    if (held || still.current) return
    const timer = setTimeout(() => step(1), stayFor(person.quote))
    return () => clearTimeout(timer)
  }, [at, held, turn]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section
      className="stage"
      aria-roledescription="carousel"
      aria-label="What people say, one at a time"
      data-held={held || undefined}
      onPointerEnter={(e) => e.pointerType === 'mouse' && setHeld(true)}
      onPointerLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setHeld(false)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') step(1)
        else if (e.key === 'ArrowLeft') step(-1)
      }}
    >
      {/* Read out as it changes only while someone is on it: left to itself it would never stop talking */}
      <div className="stage__stack" aria-live={held ? 'polite' : 'off'}>
        {STAGED.map((staged, n) => (
          <blockquote key={staged.name} data-on={n === at || undefined} data-size={staged.quote.length > 225 ? 's' : staged.quote.length > 150 ? 'm' : staged.quote.length > 90 ? 'l' : 'xl'} aria-hidden={n !== at || undefined}>
            <p>{staged.quote}</p>
          </blockquote>
        ))}
      </div>
      <div className="stage__who who" key={at}>
        <Face person={person} size={52} />
        <span className="who__text">
          <b>{person.name}</b>
          <span>{person.role}</span>
        </span>
        <span className="tags">
          {kindsOf(person).map((kind) => (
            <span key={kind.id} className="tag">
              {kind.one}
            </span>
          ))}
        </span>
      </div>
      <div className="stage__bar">
        <span className="stage__count label" aria-hidden>
          {String(at + 1).padStart(2, '0')} / {STAGED.length}
        </span>
        <span className="stage__line" aria-hidden>
          {/* It fills for as long as the quote stays; held, it waits */}
          <i key={`${at}-${turn}`} style={{ animationDuration: `${stayFor(person.quote)}ms` }} />
        </span>
        <span className="stage__keys">
          <button type="button" className="round" onClick={() => step(-1)} aria-label="The quote before">
            <Arrow className="arrow arrow--back" />
          </button>
          <button type="button" className="round" onClick={() => step(1)} aria-label="The next quote">
            <Arrow className="arrow arrow--on" />
          </button>
          <button type="button" className="pill" onClick={shuffle}>
            Shuffle
          </button>
        </span>
      </div>
    </section>
  )
}

/** Whether someone answers a search: by their name, what they do, or a word of what they said. */
const answers = (person: Person & { quote: string }, asked: string) => {
  const q = asked.trim().toLowerCase()
  return !q || `${person.name} ${person.role}`.toLowerCase().includes(q) || (q.length > 3 && person.quote.toLowerCase().includes(q))
}

/** How many of the wall are set out to begin with, and how many more each press of Show more brings. */
const FIRST = 18
const MORE = 24

function Wall() {
  const [kind, setKind] = useState<Relation | null>(null)
  const [asked, setAsked] = useState('')
  const [most, setMost] = useState(FIRST)
  const found = useMemo(() => VOICES.filter((person) => (!kind || person.relations.includes(kind)) && answers(person, asked)), [kind, asked])
  // Someone looking for a name is shown everyone who answers; otherwise the wall is set out a part at a time
  const shown = asked.trim() ? found : found.slice(0, most)
  const left = found.length - shown.length
  return (
    <section className="wall" id="everyone" aria-labelledby="everyone-h">
      <div className="wall__head">
        <h2 id="everyone-h" className="h2">
          Everyone
        </h2>
        <div className="chips" role="group" aria-label="Show">
          <button type="button" className="chip" aria-pressed={kind === null} onClick={() => setKind(null)}>
            All <i>{VOICES.length}</i>
          </button>
          {KINDS.map((k) => (
            <button key={k.id} type="button" className="chip" aria-pressed={kind === k.id} onClick={() => setKind(kind === k.id ? null : k.id)}>
              {k.label} <i>{VOICES.filter((person) => person.relations.includes(k.id)).length}</i>
            </button>
          ))}
        </div>
        <label className="find">
          <span className="sr">Find a name or a company</span>
          <input type="search" placeholder="Find a name or a company" value={asked} onChange={(e) => setAsked(e.target.value)} autoComplete="off" />
        </label>
      </div>
      <p className="sr" role="status">
        {shown.length} of {found.length} showing
      </p>
      {shown.length === 0 ? (
        <p className="none">
          Nobody by that name. <button type="button" className="textlink" onClick={() => (setAsked(''), setKind(null))}>Show everyone</button>
        </p>
      ) : (
        <ul className="cards">
          {shown.map((person, n) => (
            <li key={person.name} className="card" data-loud={person.quote.length < 180 || undefined} style={{ ['--n' as string]: (n < FIRST ? n : (n - FIRST) % MORE) % 7 }}>
              <blockquote>
                <p>{person.quote}</p>
              </blockquote>
              <div className="who">
                <Face person={person} />
                <span className="who__text">
                  <b>{person.name}</b>
                  <span>{person.role}</span>
                </span>
              </div>
              <div className="tags">
                {kindsOf(person).map((k) => (
                  <span key={k.id} className="tag">
                    {k.one}
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
      {left > 0 && (
        <div className="more">
          <span className="label">
            {shown.length} of {found.length}
          </span>
          <button type="button" className="pill" onClick={() => setMost((n) => n + MORE)}>
            Show {Math.min(MORE, left)} more
          </button>
          {left > MORE && (
            <button type="button" className="pill" onClick={() => setMost(VOICES.length)}>
              Show all {found.length}
            </button>
          )}
        </div>
      )}
    </section>
  )
}

export function Quotes() {
  return (
    <>
      <section className="hero">
        <p className="label">Early-stage venture · Since {FACTS[0]!.value}</p>
        <h1 className="h1">
          What people say
          <br />
          about working
          <br />
          with Shrug.
        </h1>
        <p className="lead">
          {SITE.line} {VOICES.length} founders, investors and partners, in their own words.
        </p>
      </section>
      <Stage />
      <dl className="facts">
        {FACTS.map((fact) => (
          <div key={fact.label} className="fact">
            <dt className="label">{fact.label}</dt>
            <dd>{fact.value}</dd>
          </div>
        ))}
        <div className="fact">
          <dt className="label">Portfolio</dt>
          <dd>
            <PageLink to="/portfolio" className="textlink">
              {COMPANIES.length} companies
              <Arrow className="arrow arrow--on" />
            </PageLink>
          </dd>
        </div>
      </dl>
      <Wall />
      <section className="band" aria-labelledby="cases-h">
        <div>
          <p className="label">Case studies</p>
          <h2 id="cases-h" className="h2">
            How we operate, behind the scenes.
          </h2>
          <p className="band__list">{CASE_STUDIES.join(' · ')}</p>
        </div>
        <CaseStudiesLink className="button button--light">Download the case studies</CaseStudiesLink>
      </section>
    </>
  )
}
