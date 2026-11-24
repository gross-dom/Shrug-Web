import { useRef, useState, type CSSProperties } from 'react'
import SIZES from 'virtual:picture-sizes'
import { Arrow } from '../Brand'
import { pictureOf, VIP_SITE } from '../content'
import { WALL, type Card, type Photo, type Post, type Press, type Text, type Video } from '../wall'

// VIP: a wall of what people posted and filmed when a Shrug gift arrived. The cards are set in columns in
// the order they are given in (vc/src/wall.ts), so the wall keeps its order whatever is added to it. The
// filters at the top do not take anything away: they dim every card that is not of the kind chosen.

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'video', label: 'Video' },
  { id: 'post', label: 'Posts' },
  { id: 'photo', label: 'Photos' },
] as const

type Filter = (typeof FILTERS)[number]['id']

/** A part of a card that has not been supplied, as the design marks it. */
const awaited = (what: string) => `[${what}]`

function PhotoCard({ card, early }: { card: Photo; early: boolean }) {
  const size = SIZES[card.src]
  return (
    <figure className="card card--photo" data-kind="photo">
      <img src={pictureOf(card.src)} width={size?.[0]} height={size?.[1]} alt={`Photo from ${card.drop}`} loading={early ? undefined : 'lazy'} decoding="async" />
      <span className="card__shade" aria-hidden />
      <figcaption className="card__drop">{card.drop}</figcaption>
    </figure>
  )
}

function VideoCard({ card }: { card: Video }) {
  const film = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  return (
    <figure className="card card--video" data-kind="video" data-playing={playing || undefined}>
      {card.src && <video ref={film} src={card.src} poster={card.poster} preload="none" playsInline controls={playing} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} />}
      <span className="card__shade" aria-hidden />
      {card.src ? (
        <button type="button" className="card__play" aria-label={`Play the video from ${card.name ?? card.drop}`} onClick={() => void film.current?.play()}>
          <Play />
        </button>
      ) : (
        <>
          <span className="card__play" aria-hidden>
            <Play />
          </span>
          <span className="label card__label">{awaited(`Video: ${card.drop}`)}</span>
        </>
      )}
      <figcaption className="card__who">
        <span>{card.name ?? awaited('Name')}</span>
        <span>{card.role ?? awaited('Role, company')}</span>
      </figcaption>
    </figure>
  )
}

/** The play triangle: with the arrow and the burger, all the icons there are. */
function Play() {
  return (
    <svg viewBox="0 0 48 48" width={52} height={52} aria-hidden>
      <path fill="#FFFFFF" d="M12 7.5c0-2.3 2.5-3.7 4.5-2.6l28 15.5c2 1.2 2 4 0 5.2l-28 15.5c-2 1.1-4.5-.3-4.5-2.6z" />
    </svg>
  )
}

function PostCard({ card }: { card: Post }) {
  const inside = (
    <>
      <div className="post__head">
        {card.avatar ? <img className="post__face" src={card.avatar} width={44} height={44} alt="" loading="lazy" decoding="async" /> : <span className="post__face" aria-hidden />}
        <div className="post__by">
          <span>{card.name ?? awaited('Name')}</span>
          <span>{card.handle ?? awaited('@handle')}</span>
        </div>
        {/* The arrow says the card goes to the original post: a post still to come goes nowhere, and says so by having none */}
        {card.href && <Arrow size={12} />}
      </div>
      <p className="post__text">{card.text ?? awaited(card.awaits ?? 'Post')}</p>
      {card.photo ? (
        <img className="post__photo" src={card.photo} alt="" loading="lazy" decoding="async" />
      ) : (
        card.awaitsPhoto && (
          <div className="post__photo post__photo--none">
            <span className="label">{awaited('Attached photo')}</span>
          </div>
        )
      )}
      <span className="card__small">
        {card.when ?? awaited('Time · Date')} · {card.drop}
      </span>
    </>
  )
  return card.href ? (
    <a className="card card--post" data-kind="post" href={card.href}>
      {inside}
    </a>
  ) : (
    <article className="card card--post" data-kind="post">
      {inside}
    </article>
  )
}

function TextCard({ card }: { card: Text }) {
  const inside = (
    <>
      <p className="text__words">{card.text}</p>
      <div className="text__foot">
        <span>{card.drop}</span>
        {card.href && <Arrow size={12} />}
      </div>
    </>
  )
  return card.href ? (
    <a className="card card--text" data-kind="text" href={card.href}>
      {inside}
    </a>
  ) : (
    <article className="card card--text" data-kind="text">
      {inside}
    </article>
  )
}

function PressCard({ card }: { card: Press }) {
  const inside = (
    <>
      <div className="press__head">
        <span>{card.publication ?? awaited('Publication')}</span>
        {card.href && <Arrow size={12} />}
      </div>
      <p className="press__headline">{card.headline ?? awaited(card.awaits ?? 'Headline')}</p>
      <span className="card__small">{card.drop}</span>
    </>
  )
  return card.href ? (
    <a className="card card--press" data-kind="press" href={card.href}>
      {inside}
    </a>
  ) : (
    <article className="card card--press" data-kind="press">
      {inside}
    </article>
  )
}

function WallCard({ card, early }: { card: Card; early: boolean }) {
  switch (card.kind) {
    case 'photo':
      return <PhotoCard card={card} early={early} />
    case 'video':
      return <VideoCard card={card} />
    case 'post':
      return <PostCard card={card} />
    case 'text':
      return <TextCard card={card} />
    case 'press':
      return <PressCard card={card} />
  }
}

export function Vip() {
  const [filter, setFilter] = useState<Filter>('all')
  return (
    <div className="vip">
      <div className="filters rise" role="group" aria-label="Filter">
        {FILTERS.map((f) => (
          <button key={f.id} type="button" className="filter mono" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
            <span>{f.label}</span>
          </button>
        ))}
      </div>
      <ul className="wall" data-show={filter}>
        {WALL.map((card, n) => (
          <li key={n} style={{ '--i': Math.min(n + 2, 10) } as CSSProperties}>
            {/* The first few are in view as the page opens, and are fetched at once; the rest wait until they are near */}
            <WallCard card={card} early={n < 6} />
          </li>
        ))}
      </ul>
      <div className="vip__on">
        <a className="button" href={VIP_SITE}>
          Go to shrug.vip
          <Arrow />
        </a>
      </div>
    </div>
  )
}
