import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight, Check, Clapperboard, Menu, Search, Share2, TriangleAlert, X } from 'lucide-react'
import { PLAYLIST, VIDEOS } from '../data/videos'
import { Window } from '../kit/window'
import { useStore } from '../os/store'
import { wm } from '../os/wm'
import '../styles/desk/youtube.css'

// YouTube (design/v1, "YouTube"): one playlist, the player with the list beside it, laid out as YouTube's
// own watch page is in Dom's screenshot of it: its dark ground, its mark and one long search field along the
// head, the player with rounded corners, the title under it, then the channel with one white button and
// grey ones beside, and at the right the list, each video a still with its length on it. The player is
// YouTube's own embed, with nothing drawn over it. A video whose owner does not allow it on other sites
// says so, with a link to watch it on YouTube.

/** Where YouTube's player is served from: the address it has for sites that set no cookies until it plays. */
const HOST = 'https://www.youtube-nocookie.com'
/** What YouTube's player says when a video may not be played off its own site (or is gone). */
const REFUSED = [100, 101, 150, 153]

export function YouTubeApp() {
  const shown = useStore(wm, (s) => s.wins.youtube.open && !s.wins.youtube.minimized)
  const [at, setAt] = useState(0)
  const [started, setStarted] = useState(false)
  const [refused, setRefused] = useState(false)
  const [query, setQuery] = useState('')
  const [copied, setCopied] = useState(false)
  const [wide, setWide] = useState(true)
  const frame = useRef<HTMLIFrameElement>(null)
  const video = VIDEOS[at]!

  useEffect(() => setRefused(false), [at])
  // Nothing plays in a window that cannot be seen: closed or minimized, the player is taken away
  useEffect(() => {
    if (!shown) setStarted(false)
  }, [shown])

  // YouTube's player says what happens in it, to whoever asks: it is asked, and listened to for a refusal
  useEffect(() => {
    if (!started || !video.id) return
    const heard = (e: MessageEvent) => {
      if (e.origin !== HOST || e.source !== frame.current?.contentWindow || typeof e.data !== 'string') return
      try {
        const said = JSON.parse(e.data) as { event?: string; info?: unknown }
        if (said.event === 'onError' && REFUSED.includes(Number(said.info))) setRefused(true)
      } catch {
        // Not something of the player's
      }
    }
    window.addEventListener('message', heard)
    return () => window.removeEventListener('message', heard)
  }, [started, video.id])

  const place = `${at + 1} / ${VIDEOS.length}`
  const q = query.trim().toLowerCase()
  const found = VIDEOS.map((v, i) => ({ v, i })).filter(({ v }) => !q || [v.title, v.channel].some((text) => text.toLowerCase().includes(q)))
  const link = video.id ? `https://www.youtube.com/watch?v=${video.id}` : null
  const share = async () => {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // No clipboard here: the link is still under Watch on YouTube
    }
  }

  const bar = (
    <div className="ytbar">
      <button type="button" className="ytbar__menu" aria-label={wide ? 'Hide the list' : 'Show the list'} aria-pressed={wide} onClick={() => setWide((w) => !w)}>
        <Menu size={20} strokeWidth={1.6} aria-hidden />
      </button>
      <span className="ytbar__mark" role="img" aria-label="YouTube">
        <svg viewBox="0 0 30 21" width="30" height="21" aria-hidden>
          <path d="M15 0C22 0 26.3.3 27.6 1.6C29.6 3.5 30 7 30 10.5C30 14 29.6 17.5 27.6 19.4C26.3 20.7 22 21 15 21C8 21 3.7 20.7 2.4 19.4C.4 17.5 0 14 0 10.5C0 7 .4 3.5 2.4 1.6C3.7.3 8 0 15 0Z" fill="#f03" />
          <path d="M12 6l8 4.5-8 4.5z" fill="#fff" />
        </svg>
        <b aria-hidden>YouTube</b>
      </span>
      <label className="yt-search">
        <input type="text" value={query} placeholder="Search" aria-label={`Search ${PLAYLIST.name}`} spellCheck={false} autoComplete="off" onChange={(e) => setQuery(e.target.value)} />
        {query && (
          <button type="button" aria-label="Clear" onClick={() => setQuery('')}>
            <X size={18} strokeWidth={1.6} aria-hidden />
          </button>
        )}
        <span aria-hidden>
          <Search size={18} strokeWidth={1.7} />
        </span>
      </label>
      <span className="ytbar__end" />
    </div>
  )
  return (
    <Window className="app ytwin" lightsSize="large" lead={bar} body={{ className: 'ytwin__body' }}>
      <div className="yt" data-wide={wide || undefined}>
        <div className="yt-col" data-autofocus tabIndex={-1}>
          <div className="yt-player">
            {refused ? (
              <div className="yt-msg" role="status">
                <TriangleAlert size={30} strokeWidth={1.7} aria-hidden />
                <h2>This one can’t play here</h2>
                Its owner doesn’t allow it on other sites.
                <a className="yt-link" href={`https://www.youtube.com/watch?v=${video.id}`} target="_blank" rel="noopener noreferrer">
                  Watch on YouTube <ArrowUpRight size={14} strokeWidth={2.2} aria-hidden />
                  <span className="sr-only">, opens in a new tab</span>
                </a>
              </div>
            ) : video.id && started ? (
              <iframe
                ref={frame}
                key={video.id}
                src={`${HOST}/embed/${video.id}?autoplay=1&rel=0&playsinline=1&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`}
                title={`${video.title}, in YouTube’s player`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
                onLoad={(e) => e.currentTarget.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }), HOST)}
              />
            ) : video.id ? (
              // Nothing of YouTube's is fetched until a video is asked for: its still, and a button
              <button type="button" className="yt-start" aria-label={`Play ${video.title}`} onClick={() => setStarted(true)}>
                <img src={`https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`} alt="" />
                <span className="yt-pbtn" aria-hidden>
                  <svg viewBox="0 0 68 48" width="68" height="48">
                    <path d="M34 0C50 0 60 .7 63 3.7C67 8 68 16 68 24C68 32 67 40 63 44.3C60 47.3 50 48 34 48C18 48 8 47.3 5 44.3C1 40 0 32 0 24C0 16 1 8 5 3.7C8 .7 18 0 34 0Z" fill="#f03" />
                    <path d="M27 14l18 10-18 10z" fill="#fff" />
                  </svg>
                </span>
              </button>
            ) : (
              <div className="yt-msg" style={{ background: `linear-gradient(rgba(0, 0, 0, 0.58), rgba(0, 0, 0, 0.58)), ${video.tone}` }}>
                <Clapperboard size={30} strokeWidth={1.7} aria-hidden />
                <h2>YouTube’s embedded player</h2>
                With its own controls. This video has no link to YouTube yet.
              </div>
            )}
          </div>
          <h1>{video.title}</h1>
          <div className="yt-under">
            <span className="yt-face" aria-hidden>
              {video.channel.replace(/^\[/, '').charAt(0).toUpperCase()}
            </span>
            <span className="yt-chan">
              <b>{video.channel}</b>
              <small>
                {PLAYLIST.name} · {place}
              </small>
            </span>
            {link ? (
              <a className="yt-pill yt-pill--white" href={link} target="_blank" rel="noopener noreferrer">
                Watch on YouTube
                <span className="sr-only">, opens in a new tab</span>
              </a>
            ) : (
              <span className="yt-pill yt-pill--off">No link yet</span>
            )}
            <span className="yt-grow" />
            {link && (
              <button type="button" className="yt-pill" onClick={() => void share()}>
                {copied ? <Check size={18} strokeWidth={1.8} aria-hidden /> : <Share2 size={18} strokeWidth={1.6} aria-hidden />}
                {copied ? 'Link copied' : 'Share'}
              </button>
            )}
          </div>
          <div className="yt-why">
            <b>Why it’s here</b>
            {video.why}
          </div>
        </div>
        {wide && (
          <aside className="yt-list" aria-label={PLAYLIST.name}>
            <header>
              <b>{PLAYLIST.name}</b>
              <span>
                {PLAYLIST.by} · {place}
              </span>
            </header>
            <ol>
              {found.map(({ v, i }) => (
                <li key={i}>
                  <button type="button" className={`yt-item${i === at ? ' on' : ''}`} aria-current={i === at || undefined} onClick={() => (setAt(i), setStarted(true))}>
                    <span className="n" aria-hidden>
                      {i === at ? '▶' : i + 1}
                    </span>
                    <span className="yt-th" style={{ background: v.tone }}>
                      {v.id && <img src={`https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`} alt="" loading="lazy" />}
                      <small>{v.length}</small>
                    </span>
                    <span className="w">
                      <b>{v.title}</b>
                      {v.channel}
                    </span>
                  </button>
                </li>
              ))}
              {!found.length && <li className="yt-none">Nothing in the list is called that.</li>}
            </ol>
          </aside>
        )}
      </div>
    </Window>
  )
}
