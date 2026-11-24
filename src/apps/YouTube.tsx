import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight, Clapperboard, TriangleAlert } from 'lucide-react'
import { PLAYLIST, VIDEOS } from '../data/videos'
import { Window } from '../kit/window'
import { useStore } from '../os/store'
import { wm } from '../os/wm'
import '../styles/desk/youtube.css'

// YouTube (design/v1, "YouTube"): one playlist, the player with the list beside it. The player is YouTube's
// own embed, with nothing drawn over it. A video whose owner does not allow it on other sites says so, with
// a link to watch it on YouTube.

/** Where YouTube's player is served from: the address it has for sites that set no cookies until it plays. */
const HOST = 'https://www.youtube-nocookie.com'
/** What YouTube's player says when a video may not be played off its own site (or is gone). */
const REFUSED = [100, 101, 150, 153]

export function YouTubeApp() {
  const shown = useStore(wm, (s) => s.wins.youtube.open && !s.wins.youtube.minimized)
  const [at, setAt] = useState(0)
  const [started, setStarted] = useState(false)
  const [refused, setRefused] = useState(false)
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

  const place = `${at + 1} of ${VIDEOS.length}`
  const bar = (
    <div className="ytbar">
      <b className="ytbar__title">YouTube</b>
      <span className="ytbar__sub">{PLAYLIST.name}</span>
    </div>
  )
  return (
    <Window className="app ytwin" lightsSize="large" lead={bar} body={{ className: 'ytwin__body' }}>
      <div className="yt">
        <div className="yt-col">
          <div className="yt-player">
            {refused ? (
              <div className="yt-msg" role="status">
                <TriangleAlert size={30} strokeWidth={1.7} aria-hidden />
                <h3>This one can’t play here</h3>
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
                  <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor">
                    <path d="M8 5.5v13l11-6.5z" />
                  </svg>
                </span>
              </button>
            ) : (
              <div className="yt-msg" style={{ background: video.tone }}>
                <Clapperboard size={30} strokeWidth={1.7} aria-hidden />
                <h3>YouTube’s embedded player</h3>
                With its own controls. This video has no link to YouTube yet.
              </div>
            )}
          </div>
          <div className="yt-info">
            <h1>{video.title}</h1>
            <p>
              {video.channel} · {place}
            </p>
            <div className="yt-why">
              <b>Why it’s here</b>
              {video.why}
            </div>
          </div>
        </div>
        <aside className="yt-list" aria-label={PLAYLIST.name}>
          <header>
            <b>{PLAYLIST.name}</b>
            <span>
              {PLAYLIST.by} · {place}
            </span>
          </header>
          <ol>
            {VIDEOS.map((v, i) => (
              <li key={i}>
                <button type="button" className={`yt-item${i === at ? ' on' : ''}`} aria-current={i === at || undefined} onClick={() => (setAt(i), setStarted(true))}>
                  <span aria-hidden>{i + 1}</span>
                  <span className="yt-th" style={{ background: v.tone }}>
                    {v.id && <img src={`https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`} alt="" loading="lazy" />}
                    <small>{v.length}</small>
                  </span>
                  <span>
                    <b>{v.title}</b>
                    {v.channel}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </Window>
  )
}
