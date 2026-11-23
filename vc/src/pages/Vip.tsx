import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import SIZES from 'virtual:picture-sizes'
import { Arrow } from '../Brand'
import { DROP_STORY, DROP_VOICES, DROPS, initialsOf, MEDIA, type Person } from '../content'

// VIP: a wall of the drops. The pictures are the ones people posted when theirs arrived, each filed under
// the drop it is of; among them stand a few of the quotes that talk about the drops themselves. The wall
// can be narrowed to one drop, and a picture opens large.

type Tile = { kind: 'photo'; at: number } | { kind: 'voice'; person: Person & { quote: string } }

const PHOTOS = MEDIA.map((slot, at) => ({ slot, at })).filter(({ slot }) => slot.kind === 'photo' && slot.src)

/** The wall with nothing narrowed: the pictures in their order, a quote set in after every sixth. */
const EVERYTHING: Tile[] = PHOTOS.flatMap(({ at }, n) => {
  const voice = (n + 1) % 6 === 0 ? DROP_VOICES[(n + 1) / 6 - 1] : undefined
  return voice ? [{ kind: 'photo', at } as Tile, { kind: 'voice', person: voice } as Tile] : [{ kind: 'photo', at } as Tile]
})

function Look({ run, at, onLook }: { run: number[]; at: number; onLook: (at: number | null) => void }) {
  const slot = MEDIA[at]!
  const place = run.indexOf(at)
  const close = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const was = document.activeElement as HTMLElement | null
    close.current?.focus()
    // The page behind keeps its place and does not move under the picture
    const overflow = document.documentElement.style.overflow
    document.documentElement.style.overflow = 'hidden'
    return () => {
      document.documentElement.style.overflow = overflow
      was?.focus?.()
    }
  }, [])
  const step = (by: number) => {
    const next = run[place + by]
    if (next !== undefined) onLook(next)
  }
  // Over the whole window, from outside the page: nothing the page does to itself can hold it in
  return createPortal(
    <div
      className="look"
      role="dialog"
      aria-modal="true"
      aria-label={`Photo from ${slot.drop}. ${place + 1} of ${run.length}.`}
      onClick={(e) => e.target === e.currentTarget && onLook(null)}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onLook(null)
        else if (e.key === 'ArrowRight') step(1)
        else if (e.key === 'ArrowLeft') step(-1)
        // The keyboard stays with the picture while it is open
        else if (e.key === 'Tab') {
          const stops = [...e.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled])')]
          const first = stops[0]!
          const last = stops[stops.length - 1]!
          if (e.shiftKey && document.activeElement === first) (e.preventDefault(), last.focus())
          else if (!e.shiftKey && document.activeElement === last) (e.preventDefault(), first.focus())
        }
      }}
    >
      <div className="look__bar">
        <span className="label">
          {slot.drop} · {place + 1} / {run.length}
        </span>
        <button ref={close} type="button" className="pill pill--dark" onClick={() => onLook(null)}>
          Close
        </button>
      </div>
      <img key={slot.src} className="look__picture" src={slot.src!} alt={`Photo from ${slot.drop}`} />
      <button type="button" className="round round--dark look__step look__step--back" disabled={place === 0} onClick={() => step(-1)} aria-label="The picture before">
        <Arrow className="arrow arrow--back" />
      </button>
      <button type="button" className="round round--dark look__step look__step--on" disabled={place === run.length - 1} onClick={() => step(1)} aria-label="The next picture">
        <Arrow className="arrow arrow--on" />
      </button>
    </div>,
    document.body,
  )
}

export function Vip() {
  const [drop, setDrop] = useState<string | null>(null)
  const [look, setLook] = useState<number | null>(null)
  const tiles = useMemo<Tile[]>(() => (drop ? PHOTOS.filter(({ slot }) => slot.drop === drop).map(({ at }) => ({ kind: 'photo', at })) : EVERYTHING), [drop])
  const run = tiles.flatMap((tile) => (tile.kind === 'photo' ? [tile.at] : []))
  const drops = DROPS.filter((name) => PHOTOS.some(({ slot }) => slot.drop === name))
  return (
    <>
      <section className="hero hero--page">
        <p className="label">Shrug VIP</p>
        <h1 className="h1">The drops.</h1>
        <p className="lead">
          {PHOTOS.length} photos from {drops.length} drops, as they landed.
        </p>
      </section>
      <section className="vip" aria-label="Photos from the drops">
        <div className="chips chips--wrap" role="group" aria-label="Drop">
          <button type="button" className="chip" aria-pressed={drop === null} onClick={() => setDrop(null)}>
            All <i>{PHOTOS.length}</i>
          </button>
          {drops.map((name) => (
            <button key={name} type="button" className="chip" aria-pressed={drop === name} onClick={() => setDrop(drop === name ? null : name)}>
              {name} <i>{PHOTOS.filter(({ slot }) => slot.drop === name).length}</i>
            </button>
          ))}
        </div>
        {drop && DROP_STORY[drop] && (
          <p className="vip__story">
            <a className="textlink" href={DROP_STORY[drop]} target="_blank" rel="noreferrer">
              The story of {drop}
              <Arrow className="arrow arrow--out" />
              <span className="sr">, opens in a new tab</span>
            </a>
          </p>
        )}
        <ul className="love">
          {tiles.map((tile) =>
            tile.kind === 'photo' ? (
              <li key={`p${tile.at}`}>
                <button type="button" className="shot" onClick={() => setLook(tile.at)}>
                  <img src={MEDIA[tile.at]!.src!} width={SIZES[MEDIA[tile.at]!.src!]?.[0]} height={SIZES[MEDIA[tile.at]!.src!]?.[1]} alt="" loading="lazy" decoding="async" />
                  <span className="shot__cap label">
                    {MEDIA[tile.at]!.drop}
                    <span className="sr">: photo. Open it.</span>
                  </span>
                </button>
              </li>
            ) : (
              <li key={`v${tile.person.name}`} className="card card--love">
                <blockquote>
                  <p>{tile.person.quote}</p>
                </blockquote>
                <div className="who">
                  {tile.person.photo ? (
                    <img className="face" src={`/people/${tile.person.photo}`} width={44} height={44} alt="" loading="lazy" decoding="async" />
                  ) : (
                    <span className="face face--none" style={{ width: 44, height: 44, fontSize: 16 }} aria-hidden>
                      {initialsOf(tile.person.name)}
                    </span>
                  )}
                  <span className="who__text">
                    <b>{tile.person.name}</b>
                    <span>{tile.person.role}</span>
                  </span>
                </div>
              </li>
            ),
          )}
        </ul>
      </section>
      {look !== null && run.includes(look) && <Look run={run} at={look} onLook={setLook} />}
    </>
  )
}
