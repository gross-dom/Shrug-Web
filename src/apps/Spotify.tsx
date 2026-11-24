import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUpRight, ListMusic, Mic, Music, Search, TriangleAlert } from 'lucide-react'
import { embedOf, EPISODES, PLAYLISTS, type Episode } from '../data/listening'
import { Window } from '../kit/window'
import { useStore } from '../os/store'
import { wm } from '../os/wm'
import '../styles/desk/spotify.css'

// Spotify: the listening room (design/v1, "Spotify"). A sidebar (Podcasts, Playlists), a list, and a player
// bar. Playing is Spotify's own embedded player, with nothing drawn over it: in the bar for one episode, and
// in the main pane for a playlist, since the embed brings its own track list. A listener who is not signed
// in to Spotify may hear previews, and the window says so. If the player does not arrive the list still
// works: each row can be opened in Spotify.

type At = { is: 'podcasts' } | { is: 'playlists' } | { is: 'playlist'; id: string }

/** How long Spotify's player is waited for before the window says it did not load. */
const WAIT = 12_000

/** Spotify's player, in a frame. If it has not arrived in a while, the window is told so. */
function Player({ src, title, tall, onFailed }: { src: string; title: string; tall?: boolean; onFailed: () => void }) {
  const timer = useRef<ReturnType<typeof setTimeout>>()
  const failed = useRef(onFailed)
  failed.current = onFailed
  useEffect(() => {
    timer.current = setTimeout(() => failed.current(), WAIT)
    return () => clearTimeout(timer.current)
  }, [src])
  return (
    <iframe
      className={`sp-frame${tall ? ' sp-frame--tall' : ''}`}
      src={src}
      title={title}
      loading="lazy"
      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
      onLoad={() => clearTimeout(timer.current)}
    />
  )
}

const Cover = ({ tone, size = 44 }: { tone: string; size?: number }) => (
  <span className="sp-cov" style={{ background: tone, width: size, height: size }} aria-hidden>
    <Mic size={Math.round(size * 0.4)} strokeWidth={1.8} />
  </span>
)

export function SpotifyApp() {
  const shown = useStore(wm, (s) => s.wins.spotify.open && !s.wins.spotify.minimized)
  const [at, setAt] = useState<At>({ is: 'podcasts' })
  const [query, setQuery] = useState('')
  const [playing, setPlaying] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const [again, setAgain] = useState(0)

  const q = query.trim().toLowerCase()
  const episodes = useMemo(() => EPISODES.filter((e) => !q || [e.title, e.show, e.guest].some((text) => text.toLowerCase().includes(q))), [q])
  const playlists = useMemo(() => PLAYLISTS.filter((p) => !q || p.name.toLowerCase().includes(q)), [q])
  const episode = playing ? (EPISODES.find((e) => e.id === playing) ?? null) : null
  const playlist = at.is === 'playlist' ? (PLAYLISTS.find((p) => p.id === at.id) ?? null) : null
  const embed = episode ? embedOf(episode.link) : null

  // Nothing plays in a window that cannot be seen: closed or minimized, the player is taken away
  useEffect(() => {
    if (!shown) setPlaying(null)
  }, [shown])

  const play = (e: Episode) => {
    setFailed(false)
    setPlaying(e.id)
  }
  const go = (to: At) => (setAt(to), setFailed(false))

  const bar = (
    <div className="spbar">
      <b className="spbar__title">Spotify</b>
      <span className="spbar__grow" />
      <label className="sp-search">
        <Search size={14} strokeWidth={2} aria-hidden />
        <input type="text" value={query} placeholder="Search the room" aria-label="Search the room" spellCheck={false} autoComplete="off" onChange={(e) => setQuery(e.target.value)} />
      </label>
    </div>
  )

  return (
    <Window className="app spwin" lightsSize="large" lead={bar} body={{ className: 'spwin__body' }}>
      <div className="sp">
        <nav className="sp-side" aria-label="Listening Room">
          <h2>Listening Room</h2>
          <button type="button" className={at.is === 'podcasts' ? 'on' : undefined} aria-current={at.is === 'podcasts' || undefined} onClick={() => go({ is: 'podcasts' })}>
            <Mic size={16} strokeWidth={1.9} aria-hidden />
            Podcasts
          </button>
          <button type="button" className={at.is === 'playlists' ? 'on' : undefined} aria-current={at.is === 'playlists' || undefined} onClick={() => go({ is: 'playlists' })}>
            <ListMusic size={16} strokeWidth={1.9} aria-hidden />
            Playlists
          </button>
          <h2>Playlists</h2>
          {PLAYLISTS.map((p) => (
            <button key={p.id} type="button" className={`pl${at.is === 'playlist' && at.id === p.id ? ' on' : ''}`} aria-current={(at.is === 'playlist' && at.id === p.id) || undefined} onClick={() => go({ is: 'playlist', id: p.id })}>
              {p.name}
            </button>
          ))}
        </nav>
        <section className="sp-main" aria-label={at.is === 'podcasts' ? 'Podcasts' : (playlist?.name ?? 'Playlists')} data-autofocus tabIndex={-1}>
          {at.is === 'podcasts' && (
            <>
              <h1>Podcasts</h1>
              <p>Shrug’s network, on air.</p>
              <ol className="sp-rows">
                <li className="sp-row head" aria-hidden>
                  <span>#</span>
                  <span />
                  <span>Episode</span>
                  <span>Who’s on it</span>
                  <span>Date</span>
                  <span>Length</span>
                </li>
                {episodes.map((e, i) => (
                  <li key={e.id}>
                    <button type="button" className={`sp-row${playing === e.id ? ' on' : ''}`} aria-pressed={playing === e.id} onClick={() => play(e)}>
                      <span className="num">
                        {playing === e.id ? (
                          <span className="sp-eq" aria-hidden>
                            <i />
                            <i />
                            <i />
                          </span>
                        ) : (
                          i + 1
                        )}
                      </span>
                      <Cover tone={e.tone} />
                      <span>
                        <b>{e.title}</b>
                        {e.show}
                      </span>
                      <span>{e.guest}</span>
                      <span>{e.date}</span>
                      <span className="num">{e.length}</span>
                    </button>
                  </li>
                ))}
              </ol>
              {!episodes.length && <p className="sp-none">Nothing in the room is called that.</p>}
            </>
          )}
          {at.is === 'playlists' && (
            <>
              <h1>Playlists</h1>
              <p>From the team.</p>
              <div className="sp-grid">
                {playlists.map((p, i) => (
                  <button key={p.id} type="button" className="sp-card" onClick={() => go({ is: 'playlist', id: p.id })}>
                    <i style={{ background: EPISODES[i % EPISODES.length]!.tone }} aria-hidden />
                    <b>{p.name}</b>
                    {p.line}
                  </button>
                ))}
              </div>
              {!playlists.length && <p className="sp-none">Nothing in the room is called that.</p>}
            </>
          )}
          {playlist && (
            <>
              <h1>{playlist.name}</h1>
              <p>{playlist.line}</p>
              {embedOf(playlist.link) && !failed ? (
                <div className="sp-embed sp-embed--live">
                  <Player key={`${playlist.id}-${again}`} src={embedOf(playlist.link)!} title={`${playlist.name}, in Spotify’s player`} tall onFailed={() => setFailed(true)} />
                </div>
              ) : (
                <div className="sp-embed">
                  <Music size={26} strokeWidth={1.7} aria-hidden />
                  <b>{playlist.link ? 'Spotify’s player didn’t load' : 'Spotify’s embedded player'}</b>
                  {playlist.link ? 'Open the playlist in Spotify, or try again.' : 'Its own cover, track list and controls. This playlist has no link to Spotify yet.'}
                  <span className="sp-tag">Previews, unless you’re signed in to Spotify</span>
                </div>
              )}
            </>
          )}
        </section>
        <footer className={`sp-bar${episode && embed && !failed ? ' embed' : ''}`}>
          {playlist ? (
            <>
              <div className="sp-now">
                <span>{embedOf(playlist.link) && !failed ? 'Playing in the player above.' : 'Pick an episode or a playlist to play.'}</span>
              </div>
              <span />
              <div className="sp-right">
                {failed && (
                  <button type="button" className="sp-tag" onClick={() => (setFailed(false), setAgain((n) => n + 1))}>
                    Try Again
                  </button>
                )}
                {playlist.link && <Out href={playlist.link} />}
              </div>
            </>
          ) : !episode ? (
            <>
              <div className="sp-now">
                <span className="sp-cov sp-cov--none" aria-hidden>
                  <Music size={22} strokeWidth={1.7} />
                </span>
                <span>Pick an episode or a playlist to play.</span>
              </div>
              <span />
              <div className="sp-right">
                <span className="sp-tag">Plays through Spotify</span>
              </div>
            </>
          ) : embed && !failed ? (
            <>
              <div className="sp-now">
                <Cover tone={episode.tone} size={56} />
                <span>
                  <b>{episode.title}</b>
                  {episode.show}
                </span>
              </div>
              <Player key={`${episode.id}-${again}`} src={embed} title={`${episode.title}, in Spotify’s player`} onFailed={() => setFailed(true)} />
              <div className="sp-right">
                <span className="sp-tag">Previews, unless you’re signed in to Spotify</span>
                <Out href={episode.link!} />
              </div>
            </>
          ) : (
            <>
              <div className="sp-now sp-now--said" role="status">
                <TriangleAlert size={20} strokeWidth={1.8} aria-hidden />
                <span>
                  <b>{episode.link ? 'Spotify’s player didn’t load' : 'This episode has no link to Spotify yet'}</b>
                  {episode.link ? 'The list still works. Open an episode in Spotify, or try again.' : 'The list still works. Its link goes in src/data/listening.ts.'}
                </span>
              </div>
              <span />
              <div className="sp-right">
                {episode.link && (
                  <button type="button" className="sp-tag" onClick={() => (setFailed(false), setAgain((n) => n + 1))}>
                    Try Again
                  </button>
                )}
                {episode.link && <Out href={episode.link} />}
              </div>
            </>
          )}
        </footer>
      </div>
    </Window>
  )
}

/** The way out to Spotify itself: the one link in the window, and it says where it goes. */
const Out = ({ href }: { href: string }) => (
  <a className="sp-tag" href={href} target="_blank" rel="noopener noreferrer">
    <ArrowUpRight size={12} strokeWidth={2.2} aria-hidden />
    Open in Spotify
    <span className="sr-only">, opens in a new tab</span>
  </a>
)
