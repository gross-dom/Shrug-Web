import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight, Check, Clapperboard, Play, RectangleHorizontal, Search, Share2, TriangleAlert, X } from 'lucide-react'
import { PLAYLIST, VIDEOS } from '../data/videos'
import { Window } from '../kit/window'
import { useStore } from '../os/store'
import { wm } from '../os/wm'
import { YouTubeMark } from './youtube-mark'
import '../styles/desk/youtube.css'

// YouTube (design/v1, "YouTube"): one playlist, the player with the list beside it, laid out as YouTube's
// own watch page is in Dom's screenshot of it: its dark ground, its mark and one long field along the head
// (which searches this playlist, and says so), the player with rounded corners, the title under it, then the
// channel with one white button and grey ones beside, and at the right the list, each video a still with its
// length on it. Theater mode puts the list away and gives the player the window's width, as YouTube's does.
// The player is YouTube's own embed, with nothing drawn over it. A video whose owner does not allow it on
// other sites says so, with a link to watch it on YouTube.
//
// It plays when the window opens, with its sound off (a browser lets a video start by itself only so), from
// the first of the list; a video that is picked plays with its sound. When one ends the next begins, as a
// playlist does, and Play all starts the list from its top.

/** Where YouTube's player is served from: the address it has for sites that set no cookies until it plays. */
const HOST = 'https://www.youtube-nocookie.com'
/** What YouTube's player says when a video may not be played off its own site (or is gone). */
const REFUSED = [100, 101, 150, 153]

/** What YouTube's player has said each video is called, and whose it is: kept for the visit, by the video's id. */
interface Said {
  title: string
  channel: string
}
const KEPT = 'shrug:videos.v1'
function kept(): Record<string, Said> {
  try {
    const was = JSON.parse(window.sessionStorage.getItem(KEPT) ?? '{}') as Record<string, Said>
    return was && typeof was === 'object' ? was : {}
  } catch {
    return {}
  }
}

export function YouTubeApp() {
  const shown = useStore(wm, (s) => s.wins.youtube.open && !s.wins.youtube.minimized)
  const [at, setAt] = useState(0)
  const [started, setStarted] = useState(false)
  /** Whether it plays without its sound: it does when it started by itself, and not once something was picked. */
  const [muted, setMuted] = useState(true)
  const [refused, setRefused] = useState(false)
  const [query, setQuery] = useState('')
  const [copied, setCopied] = useState(false)
  /** Theater mode: the list is put away, and the player has the window's width. */
  const [theater, setTheater] = useState(false)
  const wide = !theater
  const frame = useRef<HTMLIFrameElement>(null)
  const answered = useRef(false)
  const ended = useRef<string | null>(null)
  const video = VIDEOS[at]!
  const [said, setSaid] = useState<Record<string, Said>>(kept)
  /** A video's title and channel: as written on its row, or as YouTube's player has said, or its place in the list. */
  const titleOf = (v: (typeof VIDEOS)[number], i: number) => v.title ?? (v.id ? said[v.id]?.title : undefined) ?? `Video ${i + 1}`
  const channelOf = (v: (typeof VIDEOS)[number]) => v.channel ?? (v.id ? said[v.id]?.channel : undefined) ?? null

  useEffect(() => setRefused(false), [at])
  // The window is opened: the video plays, with its sound off. And nothing plays in a window that cannot be
  // seen: closed or minimized, the player is taken away
  useEffect(() => {
    if (shown) return setStarted(true)
    setStarted(false)
    setMuted(true)
  }, [shown])
  /** A video that is picked: it plays, with its sound. */
  const pick = (i: number) => {
    setMuted(false)
    setAt(i)
    setStarted(true)
  }
  const next = useRef(() => {})
  next.current = () => setAt((was) => (was + 1 < VIDEOS.length ? was + 1 : was))

  // YouTube's player says what happens in it, to whoever asks: it is asked, and listened to for a refusal
  useEffect(() => {
    if (!started || !video.id) return
    const heard = (e: MessageEvent) => {
      if (e.origin !== HOST || e.source !== frame.current?.contentWindow || typeof e.data !== 'string') return
      try {
        const told = JSON.parse(e.data) as { event?: string; info?: unknown }
        // (the player has answered: it is now asked to say when a video ends, and when one may not be played)
        if (!answered.current) {
          answered.current = true
          for (const what of ['onStateChange', 'onError']) frame.current?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func: 'addEventListener', args: [what], id: 1, channel: 'widget' }), HOST)
        }
        if (told.event === 'onError' && REFUSED.includes(Number(told.info))) setRefused(true)
        // A video that has ended: the next one in the list begins
        const state = told.event === 'onStateChange' ? told.info : told.event === 'infoDelivery' ? (told.info as { playerState?: unknown } | null)?.playerState : undefined
        if (state === 0 && ended.current !== video.id) {
          ended.current = video.id
          next.current()
        }
        // The player says what it is playing: its title, and whose it is. That is what the window calls it from then on
        const data = (told.info as { videoData?: { video_id?: unknown; title?: unknown; author?: unknown } } | null)?.videoData
        if (data && data.video_id === video.id && typeof data.title === 'string' && data.title.trim()) {
          const now = { title: data.title.trim().slice(0, 200), channel: typeof data.author === 'string' ? data.author.trim().slice(0, 120) : '' }
          setSaid((all) => {
            if (all[video.id!]?.title === now.title && all[video.id!]?.channel === now.channel) return all
            const next = { ...all, [video.id!]: now }
            try {
              window.sessionStorage.setItem(KEPT, JSON.stringify(next))
            } catch {
              // No storage: it is told again the next time it is played
            }
            return next
          })
        }
      } catch {
        // Not something of the player's
      }
    }
    answered.current = false
    ended.current = null
    window.addEventListener('message', heard)
    // (the player is told it is listened to, until it answers: it may not be ready the moment its page loads)
    const ask = setInterval(() => {
      if (answered.current) return clearInterval(ask)
      frame.current?.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }), HOST)
    }, 500)
    return () => {
      window.removeEventListener('message', heard)
      clearInterval(ask)
    }
  }, [started, video.id])

  const place = `${at + 1} / ${VIDEOS.length}`
  const q = query.trim().toLowerCase()
  const found = VIDEOS.map((v, i) => ({ v, i })).filter(({ v, i }) => !q || [titleOf(v, i), channelOf(v)].some((text) => !!text && text.toLowerCase().includes(q)))
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
      <span className="ytbar__mark">
        <YouTubeMark height={20} />
      </span>
      <label className="yt-search">
        <input type="text" value={query} placeholder="Search this playlist" aria-label={`Search ${PLAYLIST.name}`} spellCheck={false} autoComplete="off" onChange={(e) => setQuery(e.target.value)} />
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
      <div
        className="yt"
        data-wide={wide || undefined}
        onKeyDown={(e) => {
          // T, as on YouTube: theater mode, and back
          if (e.key.toLowerCase() === 't' && !e.metaKey && !e.ctrlKey && !e.altKey && !(e.target as HTMLElement).closest('input, textarea')) setTheater((t) => !t)
        }}
      >
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
                key={`${video.id}${muted ? '-quiet' : ''}`}
                src={`${HOST}/embed/${video.id}?autoplay=1${muted ? '&mute=1' : ''}&rel=0&playsinline=1&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`}
                title={`${titleOf(video, at)}, in YouTube’s player`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
                onLoad={(e) => e.currentTarget.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }), HOST)}
              />
            ) : video.id ? (
              // Nothing of YouTube's is fetched until a video is asked for: its still, and a button
              <button type="button" className="yt-start" aria-label={`Play ${titleOf(video, at)}`} onClick={() => pick(at)}>
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
          <h1>{titleOf(video, at)}</h1>
          <div className="yt-under">
            <span className="yt-face" aria-hidden>
              {(channelOf(video) ?? PLAYLIST.by).charAt(0).toUpperCase()}
            </span>
            <span className="yt-chan">
              <b>{channelOf(video) ?? PLAYLIST.by}</b>
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
            <button type="button" className="yt-pill" aria-pressed={theater} onClick={() => setTheater((t) => !t)}>
              <RectangleHorizontal size={18} strokeWidth={1.6} aria-hidden />
              {theater ? 'Default view' : 'Theater mode'}
            </button>
            {link && (
              <button type="button" className="yt-pill" onClick={() => void share()}>
                {copied ? <Check size={18} strokeWidth={1.8} aria-hidden /> : <Share2 size={18} strokeWidth={1.6} aria-hidden />}
                {copied ? 'Link copied' : 'Share'}
              </button>
            )}
          </div>
          {video.why && (
            <div className="yt-why">
              <b>Why it’s here</b>
              {video.why}
            </div>
          )}
        </div>
        {wide && (
          <aside className="yt-list" aria-label={PLAYLIST.name}>
            <header>
              <span>
                <b>{PLAYLIST.name}</b>
                <span>
                  {PLAYLIST.by} · {place}
                </span>
              </span>
              <button type="button" className="yt-pill yt-pill--white" onClick={() => pick(0)}>
                <Play size={15} strokeWidth={0} fill="currentColor" aria-hidden />
                Play all
              </button>
            </header>
            <ol>
              {found.map(({ v, i }) => (
                <li key={i}>
                  <button type="button" className={`yt-item${i === at ? ' on' : ''}`} aria-current={i === at || undefined} onClick={() => pick(i)}>
                    <span className="n" aria-hidden>
                      {i === at ? '▶' : i + 1}
                    </span>
                    <span className="yt-th" style={{ background: v.tone }}>
                      {v.id && <img src={`https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`} alt="" loading="lazy" />}
                      {v.length && <small>{v.length}</small>}
                    </span>
                    <span className="w">
                      <b>{titleOf(v, i)}</b>
                      {channelOf(v)}
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
