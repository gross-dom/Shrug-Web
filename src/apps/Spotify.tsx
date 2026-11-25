import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUpRight, Bookmark, ChevronLeft, ChevronRight, Clock, House, ListMusic, Mic, Music, Play, Search, Shuffle, SkipBack, SkipForward, TriangleAlert, X } from 'lucide-react'
import { embedOf, EPISODES, LISTS, PLAYLISTS, type Episode, type Playlist } from '../data/listening'
import { Window } from '../kit/window'
import { askSpotify, told as spotifySays } from '../os/listening'
import { useStore } from '../os/store'
import { wm } from '../os/wm'
import '../styles/desk/spotify.css'

// Spotify: the listening room (design/v1, "Spotify"), laid out as Spotify's own Mac app is in Dom's
// screenshots of it: a black window; along its head the way back and on, Home, and one long search field;
// under that three rounded panels on the black: Your Library at the left, the main pane, and along the foot
// the bar where what is playing is.
//
// What it has is Shrug's: the podcast episodes its network is on, and playlists from the team. Playing is
// Spotify's own embedded player, with nothing drawn over it: in the bar at the foot for one episode, and in
// the main pane for a playlist, since the embed brings its own track list. A listener who is not signed in
// to Spotify may hear previews, and the window says so. If the player does not arrive the lists still work:
// each row can be opened in Spotify.
//
// It opens with something chosen: the first episode is in the bar at the foot, ready to play. The chips over
// Your Library filter that list, as Spotify's do; the chips over Home filter Home.

type At = { is: 'home' } | { is: 'podcasts'; list: number } | { is: 'playlists' } | { is: 'playlist'; id: string }
const same = (a: At, b: At) => a.is === b.is && (a.is !== 'playlist' || (b.is === 'playlist' && a.id === b.id)) && (a.is !== 'podcasts' || (b.is === 'podcasts' && a.list === b.list))
/** What a list of episodes is called: its own name, or until it has one its number (or plain Podcasts, where there is only one). */
const listName = (n: number) => LISTS[n]?.name ?? (LISTS.length > 1 ? `Podcasts ${n + 1}` : 'Podcasts')

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
  return <iframe className={`sp-frame${tall ? ' sp-frame--tall' : ''}`} src={src} title={title} loading="lazy" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" onLoad={() => clearTimeout(timer.current)} />
}

/** A cover: Spotify's own picture where it has told of one, and until then the tone it stands on, with what it is drawn on it. */
const Cover = ({ tone, size, list, src }: { tone: string; size?: number; list?: boolean; src?: string | null }) => (
  <span className="sp-cov" style={{ background: `linear-gradient(145deg, ${tone}, #1a1a1a)`, ...(size ? { width: size, height: size } : {}) }} aria-hidden>
    {src ? <img src={src} alt="" loading="lazy" draggable={false} /> : list ? <ListMusic size={size ? Math.round(size * 0.42) : 28} strokeWidth={1.7} /> : <Mic size={size ? Math.round(size * 0.42) : 28} strokeWidth={1.7} />}
  </span>
)
const PLAYLIST_TONES = ['#7a5cc4', '#c4573f', '#3f8f8a', '#b08a2a']
const toneOf = (p: Playlist) => PLAYLIST_TONES[PLAYLISTS.indexOf(p) % PLAYLIST_TONES.length]!

export function SpotifyApp() {
  const shown = useStore(wm, (s) => s.wins.spotify.open && !s.wins.spotify.minimized)
  // Where it is, and where it has been: the bar's two arrows go back and on through it
  const [trail, setTrail] = useState<{ past: At[]; at: At; ahead: At[] }>({ past: [], at: { is: 'home' }, ahead: [] })
  const at = trail.at
  const [query, setQuery] = useState('')
  const [only, setOnly] = useState<'all' | 'podcasts' | 'playlists'>('all')
  /** What Your Library is showing: all of it, or only one kind (its chips). */
  const [lib, setLib] = useState<'all' | 'podcasts' | 'playlists'>('all')
  /** What is in the bar at the foot. It opens on the first episode there is, so the bar is never empty. */
  const FIRST = (EPISODES.find((e) => e.link) ?? EPISODES[0])?.id ?? null
  const [playing, setPlaying] = useState<string | null>(FIRST)
  /** Whether whoever is here chose it: an episode that was only set out for them says nothing about what it lacks. */
  const [chose, setChose] = useState(false)
  const [failed, setFailed] = useState(false)
  const [again, setAgain] = useState(0)
  const main = useRef<HTMLElement>(null)

  // What each is called, and its cover: written on its row, or as Spotify says (asked when the window opens)
  const says = useStore(spotifySays, (all) => all)
  useEffect(() => {
    if (shown) askSpotify()
  }, [shown])
  const titleOf = (e: Episode) => e.title ?? (e.link ? says[e.link]?.title : undefined) ?? `Episode ${EPISODES.filter((other) => other.list === e.list).indexOf(e) + 1}`
  const nameOf = (p: Playlist) => p.name ?? (p.link ? says[p.link]?.title : undefined) ?? `Playlist ${PLAYLISTS.indexOf(p) + 1}`
  const coverOf = (row: { link: string | null }) => (row.link ? (says[row.link]?.cover ?? null) : null)
  /** The columns the table has: only those some episode has something for. */
  const cols = { guest: EPISODES.some((e) => e.guest), date: EPISODES.some((e) => e.date), length: EPISODES.some((e) => e.length) }

  const q = query.trim().toLowerCase()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const episodes = useMemo(() => EPISODES.filter((e) => !q || [titleOf(e), e.show, e.guest].some((text) => !!text && text.toLowerCase().includes(q))), [q, says])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const playlists = useMemo(() => PLAYLISTS.filter((p) => !q || nameOf(p).toLowerCase().includes(q)), [q, says])
  const episode = playing ? (EPISODES.find((e) => e.id === playing) ?? null) : null
  const playlist = at.is === 'playlist' ? (PLAYLISTS.find((p) => p.id === at.id) ?? null) : null
  const embed = episode ? embedOf(episode.link) : null

  // Nothing plays in a window that cannot be seen: closed or minimized, the player is taken away
  useEffect(() => {
    if (shown) return setPlaying((was) => was ?? FIRST)
    setPlaying(null)
    setChose(false)
  }, [shown, FIRST])

  const play = (e: Episode) => {
    setFailed(false)
    setChose(true)
    setPlaying(e.id)
  }
  const go = (to: At) => {
    setFailed(false)
    setTrail((t) => (same(t.at, to) ? t : { past: [...t.past, t.at], at: to, ahead: [] }))
    main.current?.scrollTo(0, 0)
  }
  const back = () => setTrail((t) => (t.past.length ? { past: t.past.slice(0, -1), at: t.past[t.past.length - 1]!, ahead: [t.at, ...t.ahead] } : t))
  const on = () => setTrail((t) => (t.ahead.length ? { past: [...t.past, t.at], at: t.ahead[0]!, ahead: t.ahead.slice(1) } : t))

  const bar = (
    <div className="spbar">
      <span className="spbar__nav">
        <button type="button" aria-label="Back" aria-disabled={!trail.past.length || undefined} onClick={back}>
          <ChevronLeft size={22} strokeWidth={1.8} aria-hidden />
        </button>
        <button type="button" aria-label="Forward" aria-disabled={!trail.ahead.length || undefined} onClick={on}>
          <ChevronRight size={22} strokeWidth={1.8} aria-hidden />
        </button>
      </span>
      <span className="spbar__mid">
        <button type="button" className="spbar__home" aria-label="Home" aria-current={at.is === 'home' ? 'page' : undefined} onClick={() => go({ is: 'home' })}>
          <House size={20} strokeWidth={1.9} aria-hidden />
        </button>
        <label className="sp-search">
          <Search size={20} strokeWidth={1.8} aria-hidden />
          <input type="text" value={query} placeholder="What do you want to play?" aria-label="Search the listening room" spellCheck={false} autoComplete="off" onChange={(e) => (setQuery(e.target.value), at.is !== 'home' && go({ is: 'home' }))} />
        </label>
      </span>
      <span className="spbar__end" />
    </div>
  )

  /** A row of the table: an episode, to be played. */
  const rowOf = (e: Episode, i: number) => (
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
        <Cover tone={e.tone} size={40} src={coverOf(e)} />
        <span className="t">
          <b>{titleOf(e)}</b>
          {e.show ?? 'Podcast episode'}
        </span>
        {cols.guest && <span>{e.guest}</span>}
        {cols.date && <span>{e.date}</span>}
        {cols.length && <span className="num">{e.length}</span>}
      </button>
    </li>
  )
  const table = (list: Episode[]) => (
    <ol className="sp-rows" data-cols={[cols.guest && 'guest', cols.date && 'date', cols.length && 'length'].filter(Boolean).join(' ') || 'title'}>
      <li className="sp-row head" aria-hidden>
        <span>#</span>
        <span />
        <span>Title</span>
        {cols.guest && <span>Who’s on it</span>}
        {cols.date && <span>Date</span>}
        {cols.length && (
          <span>
            <Clock size={14} strokeWidth={1.8} />
          </span>
        )}
      </li>
      {list.map(rowOf)}
    </ol>
  )
  const cardOf = (p: Playlist) => (
    <li key={p.id}>
      <button type="button" className="sp-card" onClick={() => go({ is: 'playlist', id: p.id })}>
        <Cover tone={toneOf(p)} list src={coverOf(p)} />
        <b>{nameOf(p)}</b>
        <span>{p.line ?? 'Playlist'}</span>
      </button>
    </li>
  )
  const none = <p className="sp-none">Nothing in the room is called that.</p>

  return (
    <Window className="app spwin" lightsSize="large" lead={bar} body={{ className: 'spwin__body' }}>
      <div className="sp">
        <nav className="sp-lib" aria-label="Your Library">
          <h2>Your Library</h2>
          {/* The chips filter this list, as Spotify's do: one kind at a time, and an x to have all of it back */}
          <div className="sp-chips" role="group" aria-label="Show in Your Library">
            {lib !== 'all' && (
              <button type="button" className="x" aria-label="Show everything" onClick={() => setLib('all')}>
                <X size={16} strokeWidth={2} aria-hidden />
              </button>
            )}
            {(['podcasts', 'playlists'] as const)
              .filter((id) => lib === 'all' || lib === id)
              .map((id) => (
                <button key={id} type="button" aria-pressed={lib === id} onClick={() => setLib(lib === id ? 'all' : id)}>
                  {id === 'podcasts' ? 'Podcasts' : 'Playlists'}
                </button>
              ))}
          </div>
          <ul>
            {lib !== 'playlists' &&
              LISTS.map((list, n) => (
                <li key={list.id}>
                  <button type="button" className="sp-item" aria-current={(at.is === 'podcasts' && at.list === n) || undefined} onClick={() => go({ is: 'podcasts', list: n })}>
                    <span className="sp-cov sp-cov--ep" aria-hidden>
                      <Bookmark size={18} strokeWidth={0} fill="currentColor" />
                    </span>
                    <span>
                      <b>{listName(n)}</b>
                      <small>
                        {EPISODES.filter((e) => e.list === n).length} episodes · Shrug’s network
                      </small>
                    </span>
                  </button>
                </li>
              ))}
            {lib !== 'podcasts' &&
              PLAYLISTS.map((p) => (
                <li key={p.id}>
                  <button type="button" className="sp-item" aria-current={(at.is === 'playlist' && at.id === p.id) || undefined} onClick={() => go({ is: 'playlist', id: p.id })}>
                    <Cover tone={toneOf(p)} size={48} list src={coverOf(p)} />
                    <span>
                      <b>{nameOf(p)}</b>
                      <small>Playlist</small>
                    </span>
                  </button>
                </li>
              ))}
          </ul>
        </nav>
        <section ref={main} className="sp-main" aria-label={at.is === 'home' ? 'Home' : at.is === 'podcasts' ? listName(at.list) : playlist ? nameOf(playlist) : 'Playlists'} data-autofocus tabIndex={-1}>
          {at.is === 'home' && (
            <div className="sp-home">
              <div className="sp-chips" role="group" aria-label="Filter">
                {(['all', 'podcasts', 'playlists'] as const).map((id) => (
                  <button key={id} type="button" aria-pressed={only === id} onClick={() => setOnly(id)}>
                    {id === 'all' ? 'All' : id === 'podcasts' ? 'Podcasts' : 'Playlists'}
                  </button>
                ))}
              </div>
              {only === 'all' && !q && (
                <ul className="sp-tiles">
                  {PLAYLISTS.map((p) => (
                    <li key={p.id}>
                      <button type="button" onClick={() => go({ is: 'playlist', id: p.id })}>
                        <Cover tone={toneOf(p)} size={48} list src={coverOf(p)} />
                        <b>{nameOf(p)}</b>
                      </button>
                    </li>
                  ))}
                  {EPISODES.slice(0, 4).map((e) => (
                    <li key={e.id}>
                      <button type="button" onClick={() => play(e)}>
                        <Cover tone={e.tone} size={48} src={coverOf(e)} />
                        <b>{titleOf(e)}</b>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {only !== 'playlists' &&
                (q
                  ? // (a search looks through every list at once)
                    [{ n: -1, found: episodes }]
                  : LISTS.map((_, n) => ({ n, found: episodes.filter((e) => e.list === n) }))
                ).map(({ n, found }) => (
                  <div key={n}>
                    <header className="sp-sect">
                      <span>
                        <small>Shrug’s network, on air</small>
                        <h1>{n < 0 ? 'Podcasts' : listName(n)}</h1>
                      </span>
                      {n >= 0 && (
                        <button type="button" onClick={() => go({ is: 'podcasts', list: n })}>
                          Show all
                        </button>
                      )}
                    </header>
                    {found.length ? table(n < 0 || only === 'podcasts' ? found : found.slice(0, 4)) : none}
                  </div>
                ))}
              {only !== 'podcasts' && (
                <>
                  <header className="sp-sect">
                    <span>
                      <small>From the team</small>
                      <h1>Playlists</h1>
                    </span>
                    <button type="button" onClick={() => go({ is: 'playlists' })}>
                      Show all
                    </button>
                  </header>
                  {playlists.length ? <ul className="sp-cards">{playlists.map(cardOf)}</ul> : none}
                </>
              )}
            </div>
          )}
          {at.is === 'podcasts' && (
            <>
              <header className="sp-hero" style={{ ['--tone' as string]: '#3a5a4a' }}>
                <span className="sp-cov sp-cov--ep sp-cov--hero" aria-hidden>
                  <Bookmark size={64} strokeWidth={0} fill="currentColor" />
                </span>
                <span>
                  <small>Podcasts</small>
                  <h1>{LISTS[at.list]?.name ?? 'Shrug’s network, on air'}</h1>
                  <p>
                    <b>{listName(at.list)}</b> · {EPISODES.filter((e) => e.list === at.list).length} episodes
                  </p>
                </span>
              </header>
              <div className="sp-under">{episodes.some((e) => e.list === at.list) ? table(episodes.filter((e) => e.list === at.list)) : none}</div>
            </>
          )}
          {at.is === 'playlists' && (
            <div className="sp-home">
              <header className="sp-sect">
                <span>
                  <small>From the team</small>
                  <h1>Playlists</h1>
                </span>
              </header>
              {playlists.length ? <ul className="sp-cards">{playlists.map(cardOf)}</ul> : none}
            </div>
          )}
          {playlist && (
            <>
              <header className="sp-hero" style={{ ['--tone' as string]: toneOf(playlist) }}>
                <Cover tone={toneOf(playlist)} list src={coverOf(playlist)} />
                <span>
                  <small>Public Playlist</small>
                  <h1>{nameOf(playlist)}</h1>
                  {playlist.line && <p>{playlist.line}</p>}
                </span>
              </header>
              <div className="sp-under">
                {embedOf(playlist.link) && !failed ? (
                  <>
                    <Player key={`${playlist.id}-${again}`} src={embedOf(playlist.link)!} title={`${nameOf(playlist)}, in Spotify’s player`} tall onFailed={() => setFailed(true)} />
                    <p className="sp-tag">Previews, unless you’re signed in to Spotify</p>
                  </>
                ) : (
                  <div className="sp-stand">
                    <span className="sp-play" aria-hidden>
                      <Play size={22} strokeWidth={0} fill="currentColor" />
                    </span>
                    <span>
                      <b>{failed ? 'Spotify’s player didn’t load' : 'Spotify’s own player goes here'}</b>
                      {playlist.link ? 'Open the playlist in Spotify, or try again.' : 'Its own cover, track list and controls. This playlist has no link to Spotify yet.'}
                    </span>
                    {failed && (
                      <button type="button" className="sp-pill" onClick={() => (setFailed(false), setAgain((n) => n + 1))}>
                        Try Again
                      </button>
                    )}
                    {playlist.link && <Out href={playlist.link} />}
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      </div>
      {/* The bar at the foot: what is playing, and Spotify's own player for it */}
      <footer className={`sp-now${episode && embed && !failed ? ' embed' : ''}`}>
        {episode && embed && !failed ? (
          <>
            <div className="sp-what">
              <Cover tone={episode.tone} size={56} src={coverOf(episode)} />
              <span>
                <b>{titleOf(episode)}</b>
                <small>{episode.show ?? 'Podcast episode'}</small>
              </span>
            </div>
            <div className="sp-in">
              <Player key={`${episode.id}-${again}`} src={embed} title={`${titleOf(episode)}, in Spotify’s player`} onFailed={() => setFailed(true)} />
            </div>
            <span className="sp-tag">Previews, unless you’re signed in to Spotify</span>
          </>
        ) : (
          <>
            <div className="sp-what">
              {episode ? <Cover tone={episode.tone} size={56} src={coverOf(episode)} /> : <span className="sp-cov" style={{ width: 56, height: 56 }} aria-hidden><Music size={22} strokeWidth={1.7} /></span>}
              <span>
                <b>{episode ? titleOf(episode) : 'Pick something to play'}</b>
                <small>{episode ? (episode.show ?? 'Podcast episode') : 'An episode, or a playlist.'}</small>
              </span>
            </div>
            <div className="sp-ctl" aria-hidden={!(episode && (chose || failed)) || undefined}>
              {episode && (chose || failed) ? (
                <p role="status">
                  <TriangleAlert size={14} strokeWidth={1.9} aria-hidden />
                  {episode.link ? 'Spotify’s player didn’t load. Open the episode in Spotify, or try again.' : 'This episode has no link to Spotify yet.'}
                  {episode.link && (
                    <button type="button" className="sp-pill" onClick={() => (setFailed(false), setAgain((n) => n + 1))}>
                      Try Again
                    </button>
                  )}
                  {episode.link && <Out href={episode.link} />}
                </p>
              ) : (
                <>
                  <span className="sp-keys">
                    <Shuffle size={16} strokeWidth={1.9} />
                    <SkipBack size={18} strokeWidth={0} fill="currentColor" />
                    <i>
                      <Play size={15} strokeWidth={0} fill="currentColor" />
                    </i>
                    <SkipForward size={18} strokeWidth={0} fill="currentColor" />
                  </span>
                  <span className="sp-line">
                    <small>-:--</small>
                    <i />
                    <small>-:--</small>
                  </span>
                </>
              )}
            </div>
            <span />
          </>
        )}
      </footer>
    </Window>
  )
}

/** A way out to Spotify itself, for when its player is not here. */
const Out = ({ href }: { href: string }) => (
  <a className="sp-pill" href={href} target="_blank" rel="noopener noreferrer">
    Open in Spotify
    <ArrowUpRight size={12} strokeWidth={2.2} aria-hidden />
  </a>
)
