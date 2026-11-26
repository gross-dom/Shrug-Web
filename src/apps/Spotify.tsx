import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ArrowUpRight, ChevronLeft, ChevronRight, Clock, House, ListMusic, Mic, Search, SquarePlay, X } from 'lucide-react'
import { embedOf, EPISODES, LISTS, PLAYLISTS, type Episode, type Playlist } from '../data/listening'
import { Window } from '../kit/window'
import { askSpotify, told as spotifySays } from '../os/listening'
import { clock, spotifyApi, uriOf, type Beat, type Controller } from '../os/spotify-player'
import { useStore } from '../os/store'
import { wm } from '../os/wm'
import '../styles/desk/spotify.css'

// Spotify: the listening room (design/v1, "Spotify"), laid out as Spotify's own Mac app is in Dom's
// screenshots of it: a black window; along its head the way back and on, Home, and one long search field;
// under that rounded panels on the black: Your Library at the left, the main pane, and at the right the Now
// playing view; and along the foot the bar where what is playing is.
//
// What it has is Shrug's: three playlists of podcast episodes (Tech, Culture, Infrastructure) and playlists
// of songs from the team. Playing is Spotify's own embedded player. For an episode it is in the Now playing
// view, and the bar at the foot is this window's own, drawn as Spotify draws its bar (Dom's screenshots of
// it, 26 Nov): shuffle, the episode before, play and pause in a white disc, the episode after, repeat, and
// under them a line to drag along the episode. Its buttons drive Spotify's player through Spotify's iFrame
// API (src/os/spotify-player.ts), and what it shows (where the episode is, how long it is, whether it is
// playing) is what that player says. A playlist of songs is Spotify's player in the main pane, since the
// embed brings its own track list and controls.
//
// Spotify's bar has a volume slider too. This one has none: Spotify's embedded player takes no word about
// how loud it is (its iFrame API has play, pause, seek and load, and nothing for volume), and a page cannot
// turn down a frame from another site. A slider here would move and change nothing, so it is left out; the
// Mac's own volume is what there is.
//
// Where Spotify's script does not arrive, the Now playing view holds the plain embedded player instead and
// the bar's play button shows it; where no player arrives at all, the view says so, and each thing can be
// opened in Spotify.
//
// It opens with something chosen: the first episode is in the bar at the foot, ready to play. The chips over
// Your Library filter that list, as Spotify's do; the chips over Home filter Home.

type At = { is: 'home' } | { is: 'podcasts'; list: number } | { is: 'playlists' } | { is: 'playlist'; id: string }
const same = (a: At, b: At) => a.is === b.is && (a.is !== 'playlist' || (b.is === 'playlist' && a.id === b.id)) && (a.is !== 'podcasts' || (b.is === 'podcasts' && a.list === b.list))
const listName = (n: number) => LISTS[n]?.name ?? 'Podcasts'
const inList = (n: number) => EPISODES.filter((e) => e.list === n)

/** How long Spotify's player is waited for before the window says it did not load. */
const WAIT = 12_000
const STILL: Beat = { paused: true, buffering: false, at: 0, of: 0 }

/** Spotify's player, in a plain frame. If it has not arrived in a while, the window is told so. */
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

/** A picture that is taken away if it does not arrive, so that what it stands on is seen instead. */
const Pic = ({ src }: { src: string }) => <img src={src} alt="" loading="lazy" draggable={false} onError={(e) => (e.currentTarget.hidden = true)} />

/** A cover: Spotify's own picture where there is one, and until then the tone it stands on, with what it is drawn on it. */
const Cover = ({ tone, size, list, src }: { tone: string; size?: number; list?: boolean; src?: string | null }) => (
  <span className="sp-cov" style={{ background: `linear-gradient(145deg, ${tone}, #1a1a1a)`, ...(size ? { width: size, height: size } : {}) }} aria-hidden>
    {list ? <ListMusic size={size ? Math.round(size * 0.42) : 28} strokeWidth={1.7} /> : <Mic size={size ? Math.round(size * 0.42) : 28} strokeWidth={1.7} />}
    {src && <Pic src={src} />}
  </span>
)

/** The cover of a list of episodes: four of its episodes' covers, two by two, as Spotify makes a playlist's. */
function Mosaic({ list, size }: { list: number; size?: number }) {
  const covers = inList(list)
    .map((e) => e.cover)
    .filter((src): src is string => !!src)
    .slice(0, 4)
  return (
    <span className="sp-cov sp-mosaic" style={{ background: 'linear-gradient(145deg, #1a7a4e, #0f4a32)', ...(size ? { width: size, height: size } : {}) }} aria-hidden>
      {covers.length === 4 ? covers.map((src) => <Pic key={src} src={src} />) : <Mic size={size ? Math.round(size * 0.42) : 28} strokeWidth={1.7} />}
    </span>
  )
}

type Mark = 'play' | 'pause' | 'prev' | 'next' | 'shuffle' | 'repeat' | 'repeat-one' | 'sound' | 'home'

const LINE = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' } as const
const SOLID = { fill: 'currentColor', stroke: 'currentColor', strokeWidth: 1.4, strokeLinejoin: 'round' } as const

/** The pictures on the buttons that play, to the shapes Spotify's own have in Dom's screenshots of its bar:
 * solid, in a square of sixteen. A triangle with soft corners; two bars; a triangle against a bar, for the
 * one before and the one after; two arrows that cross; an arrow that comes round a rounded box, with a 1
 * in its top edge when it is the one episode that repeats. */
const MARKS: Record<Mark, ReactNode> = {
  play: <path d="M3.5 2v12L14 8z" {...SOLID} />,
  pause: (
    <>
      <rect x="2.3" y="1.3" width="4" height="13.4" rx="0.8" fill="currentColor" />
      <rect x="9.7" y="1.3" width="4" height="13.4" rx="0.8" fill="currentColor" />
    </>
  ),
  prev: (
    <>
      <rect x="1" y="1.3" width="3.2" height="13.4" rx="0.7" fill="currentColor" />
      <path d="M14.3 2.1v11.8L4.7 8z" {...SOLID} />
    </>
  ),
  next: (
    <>
      <rect x="11.8" y="1.3" width="3.2" height="13.4" rx="0.7" fill="currentColor" />
      <path d="M1.7 2.1v11.8L11.3 8z" {...SOLID} />
    </>
  ),
  shuffle: (
    <g {...LINE}>
      <path d="M0.75 12.75h0.5c1.05 0 2.04-0.47 2.7-1.28l5.1-6.19a3.5 3.5 0 0 1 2.7-1.28h3.3" />
      <path d="M12.85 1.8l2.2 2.2-2.2 2.2" />
      <path d="M0.75 3.25h0.5c1.05 0 2.04 0.47 2.7 1.28l0.9 1.09" />
      <path d="M8.2 10.5l0.85 1.03a3.5 3.5 0 0 0 2.7 1.27h3.3" />
      <path d="M12.85 10.6l2.2 2.2-2.2 2.2" />
    </g>
  ),
  repeat: (
    <g {...LINE}>
      <path d="M5 12.5H3.75a3 3 0 0 1-3-3v-5a3 3 0 0 1 3-3h8.5a3 3 0 0 1 3 3v5a3 3 0 0 1-3 3H8.1" />
      <path d="M10.2 10.3 8 12.5l2.2 2.2" />
    </g>
  ),
  'repeat-one': (
    <g {...LINE}>
      <path d="M5 12.5H3.75a3 3 0 0 1-3-3v-5a3 3 0 0 1 3-3h0.9" />
      <path d="M11.4 1.5h0.85a3 3 0 0 1 3 3v5a3 3 0 0 1-3 3H8.1" />
      <path d="M10.2 10.3 8 12.5l2.2 2.2" />
      <path d="M6.7 2.6c0.9-0.1 1.5-0.6 1.7-1.4h0.4v6.3" strokeWidth={1.4} />
    </g>
  ),
  sound: (
    <>
      <path d="M1.4 5.7h2.5l4-3.1v10.8l-4-3.1H1.4z" fill="currentColor" stroke="currentColor" strokeWidth={1.2} strokeLinejoin="round" />
      <path d="M10.6 5.3a3.9 3.9 0 0 1 0 5.4M12.6 3.3a6.7 6.7 0 0 1 0 9.4" {...LINE} />
    </>
  ),
  // (Home, where it is the page that is open: the house filled in, as Spotify fills it)
  home: <path d="M8.5 1.3a0.8 0.8 0 0 0-1 0L1.6 6.1a0.8 0.8 0 0 0-0.3 0.6v7.2a0.8 0.8 0 0 0 0.8 0.8h3.7v-4.5h4.4v4.5h3.7a0.8 0.8 0 0 0 0.8-0.8V6.7a0.8 0.8 0 0 0-0.3-0.6z" fill="currentColor" />,
}

const Glyph = ({ is, size = 16 }: { is: Mark; size?: number }) => (
  <svg className="sp-g" width={size} height={size} viewBox="0 0 16 16" aria-hidden>
    {MARKS[is]}
  </svg>
)

/** The bars that rise and fall beside what is playing. */
const Bars = () => (
  <span className="sp-eq" aria-hidden>
    <i />
    <i />
    <i />
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
  /** The Now playing view, at the right: where Spotify's own player for the episode is. (On a small screen it starts shut, and the bar's switch opens it.) */
  const [side, setSide] = useState(() => typeof window === 'undefined' || window.innerWidth >= 1240)
  /** How the episode's player is here: not yet; Spotify's player with its controller; its plain frame; or not at all. */
  const [mode, setMode] = useState<'wait' | 'api' | 'frame' | 'failed'>('wait')
  /** What the player last said: playing or not, where it is, how long the episode is. */
  const [beat, setBeat] = useState<Beat>(STILL)
  /** Whether the playlist's player (in the main pane) did not arrive. */
  const [failed, setFailed] = useState(false)
  const [again, setAgain] = useState(0)
  const main = useRef<HTMLElement>(null)
  const room = useRef<HTMLDivElement>(null)
  const host = useRef<HTMLDivElement>(null)
  // A window made narrow gives the Now playing view's room to the pages (the bar's switch brings the view
  // back): it is put away as the window goes under the width at which the pages have too little left
  useEffect(() => {
    const el = room.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const NARROW = 940
    let was = el.clientWidth
    const watch = new ResizeObserver(() => {
      const now = el.clientWidth
      // (a window out of sight has no width: that is not a narrow window)
      if (!now) return
      if (now < NARROW && was >= NARROW) setSide(false)
      was = now
    })
    watch.observe(el)
    return () => watch.disconnect()
  }, [])
  const ctl = useRef<Controller | null>(null)
  /** What the controller has loaded, and whether it is to play as soon as it can. */
  const loaded = useRef<string | null>(null)
  const want = useRef(false)
  /** Shuffle, and Repeat (nothing, the whole list, or the one episode): the bar's two switches, as Spotify's are. */
  const [shuffle, setShuffle] = useState(false)
  const [repeat, setRepeat] = useState<'off' | 'all' | 'one'>('off')
  /** With Shuffle on: what has been played on this pass through the list, in the order it was, the one in
   * the bar last. Next takes one that is not in it; Previous goes back along it. */
  const heard = useRef<string[]>(FIRST ? [FIRST] : [])
  /** What the player said last, and whether this time through the episode has been seen to end. */
  const last = useRef({ at: 0, paused: true })
  const over = useRef(false)
  /** What is done when an episode ends (as it is now: the listener below is made once and calls this). */
  const ended = useRef<() => void>(() => {})

  // What each is called, and its cover: written on its row, or as Spotify says (asked when the window opens)
  const says = useStore(spotifySays, (all) => all)
  useEffect(() => {
    if (shown) askSpotify()
  }, [shown])
  const titleOf = (e: Episode) => e.title ?? (e.link ? says[e.link]?.title : undefined) ?? `Episode ${inList(e.list).indexOf(e) + 1}`
  const nameOf = (p: Playlist) => p.name ?? (p.link ? says[p.link]?.title : undefined) ?? `Playlist ${PLAYLISTS.indexOf(p) + 1}`
  const coverOf = (row: { link: string | null; cover: string | null }) => row.cover ?? (row.link ? (says[row.link]?.cover ?? null) : null)

  const q = query.trim().toLowerCase()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const episodes = useMemo(() => EPISODES.filter((e) => !q || [titleOf(e), e.show].some((text) => !!text && text.toLowerCase().includes(q))), [q, says])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const playlists = useMemo(() => PLAYLISTS.filter((p) => !q || nameOf(p).toLowerCase().includes(q)), [q, says])
  const episode = playing ? (EPISODES.find((e) => e.id === playing) ?? null) : null
  const playlist = at.is === 'playlist' ? (PLAYLISTS.find((p) => p.id === at.id) ?? null) : null
  const uri = episode ? uriOf(episode.link) : null
  const uriNow = useRef(uri)
  uriNow.current = uri

  // Spotify's player for the episode, and its controller. Nothing plays in a window that cannot be seen:
  // closed or minimized, the player is taken away, and made again (not playing) when the window is back
  useEffect(() => {
    if (!shown) return
    let gone = false
    let made: Controller | null = null
    setMode('wait')
    void spotifyApi().then((api) => {
      if (gone) return
      const first = uriNow.current
      if (!api || !host.current || !first) return setMode('frame')
      const el = document.createElement('div')
      host.current.replaceChildren(el)
      api.createController(el, { uri: first, width: '100%', height: 352 }, (controller) => {
        if (gone) return controller.destroy()
        made = controller
        ctl.current = controller
        loaded.current = first
        setMode('api')
        controller.addListener('playback_update', (e) => {
          const d = e.data ?? {}
          const num = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0)
          if (gone) return
          const now = { paused: d.isPaused !== false, at: num(d.position), of: num(d.duration) }
          setBeat({ ...now, buffering: !!d.isBuffering })
          // The end of an episode: the player says it is at its end, or it has stopped and gone back to the
          // start from within a few seconds of the end. Acted on once for each time through
          const was = last.current
          last.current = now
          if (!now.of) return
          const atEnd = now.at >= now.of - 400
          const fellBack = now.paused && now.at < 1000 && !was.paused && was.at >= now.of - 3000
          if (atEnd || fellBack) {
            if (over.current) return
            over.current = true
            setTimeout(() => !gone && ended.current(), 0)
          } else if (now.at < now.of - 3000) over.current = false
        })
        controller.addListener('ready', () => {
          if (gone) return
          // (an episode picked while the player was on its way is the one it is given)
          const now = uriNow.current
          if (now && now !== loaded.current) {
            loaded.current = now
            controller.loadUri(now)
          }
          if (want.current) controller.play()
        })
      })
    })
    return () => {
      gone = true
      made?.destroy()
      if (ctl.current === made) ctl.current = null
      loaded.current = null
      want.current = false
      last.current = { at: 0, paused: true }
      over.current = false
      host.current?.replaceChildren()
      setBeat(STILL)
    }
  }, [shown, again])

  // Another episode: the player is given it, and plays it if it was asked for by name
  useEffect(() => {
    const controller = ctl.current
    if (!controller || !uri || loaded.current === uri) return
    loaded.current = uri
    last.current = { at: 0, paused: true }
    over.current = false
    setBeat(STILL)
    controller.loadUri(uri)
    if (want.current) controller.play()
  }, [uri])

  /** Play and pause. With no controller, Spotify's own player is in the Now playing view: that is shown. */
  const toggle = () => {
    const controller = ctl.current
    if (!controller) return setSide(true)
    want.current = beat.paused
    controller.togglePlay()
  }
  /** An episode asked for by name: it plays. Asked for again while it is the one in the bar, it is play and pause. */
  const play = (e: Episode) => {
    if (e.id === playing && ctl.current) return toggle()
    want.current = true
    // (one asked for by name is where a shuffled pass through its list starts)
    heard.current = [e.id]
    setPlaying(e.id)
    if (!ctl.current) setSide(true)
  }
  /** A list, played: the episode of it that is in the bar, or its first. */
  const playList = (n: number) => {
    const to = episode && episode.list === n ? episode : inList(n)[0]
    if (to) play(to)
  }
  const seek = (to: number) => {
    const controller = ctl.current
    if (!controller || !beat.of) return
    const at = Math.max(0, Math.min(beat.of - 1000, to))
    setBeat((b) => ({ ...b, at }))
    controller.seek(Math.round(at / 1000))
  }
  const near = episode ? inList(episode.list) : []
  const first = !!episode && near.indexOf(episode) <= 0
  const final = !!episode && near.indexOf(episode) >= near.length - 1
  /** The episode in the bar, from its start again. */
  const restart = () => {
    const controller = ctl.current
    if (!controller || !uri) return
    last.current = { at: 0, paused: true }
    over.current = false
    want.current = true
    setBeat(STILL)
    controller.loadUri(uri)
    controller.play()
  }
  /** What comes after an episode. In order, it is the next in its list, and after the last the first again
   * if the list repeats. Shuffled, it is one of those not yet heard on this pass; when all have been, a
   * new pass starts if the list repeats, or if it was Next that asked. */
  const following = (e: Episode, pressed: boolean): Episode | null => {
    const list = inList(e.list)
    if (!shuffle) return list[list.indexOf(e) + 1] ?? (repeat === 'all' ? (list[0] ?? null) : null)
    let left = list.filter((x) => x.id !== e.id && !heard.current.includes(x.id))
    if (!left.length) {
      if (repeat !== 'all' && !pressed) return null
      heard.current = [e.id]
      left = list.filter((x) => x.id !== e.id)
    }
    return left[Math.floor(Math.random() * left.length)] ?? null
  }
  /** On to another episode of the list, playing if this one was. */
  const hop = (to: Episode, sounding = want.current || !beat.paused) => {
    want.current = sounding
    setPlaying(to.id)
  }
  const next = () => {
    if (!episode) return
    const to = following(episode, true)
    if (!to) return
    if (shuffle) heard.current.push(to.id)
    hop(to)
  }
  /** Previous: well into an episode it is back to its start, as Spotify's is; at its start, the one before
   * (shuffled: the one that was played before it). */
  const prev = () => {
    if (!episode) return
    if (beat.at > 3000) return seek(0)
    let to: Episode | undefined
    if (shuffle) {
      const trail = heard.current
      if (trail.length > 1) {
        trail.pop()
        to = near.find((x) => x.id === trail[trail.length - 1])
      }
    } else to = near[near.indexOf(episode) - 1] ?? (repeat === 'all' ? near[near.length - 1] : undefined)
    if (to && to.id !== episode.id) hop(to)
  }
  const canPrev = !!episode && (beat.at > 3000 || (shuffle ? heard.current.length > 1 : !first || (repeat === 'all' && near.length > 1)))
  const canNext = !!episode && near.length > 1 && (shuffle || !final || repeat === 'all')
  // An episode that has played to its end: again, if it is the one that repeats; or on to what follows it;
  // or, with nothing to follow, it stops there
  ended.current = () => {
    const controller = ctl.current
    if (!controller || !episode) return
    if (repeat === 'one') return restart()
    const to = following(episode, false)
    if (to && to.id !== episode.id) {
      if (shuffle) heard.current.push(to.id)
      return hop(to, true)
    }
    if (to) return restart()
    want.current = false
    controller.pause()
  }
  const shuffleIt = () => {
    // (a shuffled pass starts from what is in the bar)
    heard.current = playing ? [playing] : []
    setShuffle((on) => !on)
  }

  const go = (to: At) => {
    setFailed(false)
    // (a search is of the whole room, and is shown on Home: a page gone to from it is shown whole, not
    // through what was being looked for)
    if (to.is !== 'home') setQuery('')
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
          {at.is === 'home' ? <Glyph is="home" size={24} /> : <House size={24} strokeWidth={1.7} aria-hidden />}
        </button>
        <label className="sp-search">
          <Search size={24} strokeWidth={1.7} aria-hidden />
          <input
            type="text"
            value={query}
            placeholder="What do you want to play?"
            aria-label="Search the listening room"
            spellCheck={false}
            autoComplete="off"
            onChange={(e) => (at.is !== 'home' && e.target.value && go({ is: 'home' }), setQuery(e.target.value))}
            onKeyDown={(e) => {
              // Escape empties the field, as it does Spotify's
              if (e.key === 'Escape' && query) e.stopPropagation(), setQuery('')
            }}
          />
          {query && (
            <button type="button" className="sp-search__x" aria-label="Clear the search" onClick={(e) => (setQuery(''), e.currentTarget.parentElement?.querySelector('input')?.focus())}>
              <X size={18} strokeWidth={1.9} aria-hidden />
            </button>
          )}
        </label>
      </span>
      <span className="spbar__end" />
    </div>
  )

  /** A row of the table: an episode, to be played. */
  const rowOf = (e: Episode, i: number) => (
    <li key={e.id}>
      <button type="button" className={`sp-row${playing === e.id ? ' on' : ''}`} aria-pressed={playing === e.id} onClick={(press) => press.detail < 2 && play(e)}>
        {/* (its number; under the pointer, what pressing it does: play, or pause where it is the one playing) */}
        <span className="num">
          {playing === e.id && !beat.paused ? <Bars /> : <span className="n">{i + 1}</span>}
          <Glyph is={playing === e.id && !beat.paused ? 'pause' : 'play'} size={14} />
        </span>
        <Cover tone={e.tone} size={40} src={coverOf(e)} />
        <span className="t">
          <b>{titleOf(e)}</b>
          <span>{e.show ?? 'Podcast episode'}</span>
        </span>
        <span className="when">{e.date}</span>
        <span className="num">{e.length}</span>
      </button>
    </li>
  )
  const table = (list: Episode[]) => (
    <ol className="sp-rows">
      <li className="sp-row head" aria-hidden>
        <span>#</span>
        <span />
        <span>Title</span>
        <span className="when">Released</span>
        <span className="num">
          <Clock size={16} strokeWidth={1.6} />
        </span>
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
      <div
        ref={room}
        className="sp"
        onKeyDown={(e) => {
          // Space plays and pauses, as it does in Spotify, wherever the keyboard is but in something of its own
          if (e.key !== ' ' || e.metaKey || e.ctrlKey || e.altKey || (e.target as HTMLElement).closest('input, textarea, button, a, [role="slider"]')) return
          e.preventDefault()
          toggle()
        }}
      >
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
                  {/* (the list that what is in the bar is from is named in green, as Spotify names it, with the speaker beside it while it sounds) */}
                  <button type="button" className="sp-item" aria-current={(at.is === 'podcasts' && at.list === n) || undefined} data-playing={episode?.list === n || undefined} onClick={() => go({ is: 'podcasts', list: n })}>
                    <Mosaic list={n} size={48} />
                    <span>
                      <b>{list.name}</b>
                      <small>Podcasts • {inList(n).length} episodes</small>
                    </span>
                    {episode?.list === n && !beat.paused && <Glyph is="sound" />}
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
                  {/* A tile is the way to its page. Under the pointer a list of podcasts has Spotify's green
                      button too, which plays it from here; while it sounds, the bars are there instead. (A
                      playlist of songs has none: its songs are played by Spotify's own player, on its page) */}
                  {LISTS.map((list, n) => {
                    const sounding = episode?.list === n && !beat.paused
                    return (
                      <li key={list.id} data-sounding={sounding || undefined}>
                        <button type="button" className="sp-tile" onClick={() => go({ is: 'podcasts', list: n })}>
                          <Mosaic list={n} size={48} />
                          <b>{list.name}</b>
                        </button>
                        {sounding && <Bars />}
                        {inList(n)[0] && (
                          <button type="button" className="sp-tile__play" aria-label={`${sounding ? 'Pause' : 'Play'} ${list.name}`} onClick={() => playList(n)}>
                            <Glyph is={sounding ? 'pause' : 'play'} size={14} />
                          </button>
                        )}
                      </li>
                    )
                  })}
                  {PLAYLISTS.map((p) => (
                    <li key={p.id}>
                      <button type="button" className="sp-tile" onClick={() => go({ is: 'playlist', id: p.id })}>
                        <Cover tone={toneOf(p)} size={48} list src={coverOf(p)} />
                        <b>{nameOf(p)}</b>
                      </button>
                    </li>
                  ))}
                  {EPISODES.slice(0, Math.max(0, 8 - LISTS.length - PLAYLISTS.length)).map((e) => {
                    const sounding = playing === e.id && !beat.paused
                    return (
                      <li key={e.id} data-sounding={sounding || undefined}>
                        {/* (an episode's tile plays it: the green button under the pointer is a picture of what the tile does) */}
                        <button type="button" className="sp-tile" onClick={(press) => press.detail < 2 && play(e)}>
                          <Cover tone={e.tone} size={48} src={coverOf(e)} />
                          <b>{titleOf(e)}</b>
                          {sounding && <Bars />}
                          <span className="sp-tile__play" aria-hidden>
                            <Glyph is={sounding ? 'pause' : 'play'} size={14} />
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
              {q && !(only !== 'playlists' && episodes.length) && !(only !== 'podcasts' && playlists.length) && none}
              {only !== 'playlists' &&
                (q
                  ? // (a search looks through every list at once, and has a section only for what it found)
                    episodes.length
                    ? [{ n: -1, found: episodes }]
                    : []
                  : LISTS.map((_, n) => ({ n, found: episodes.filter((e) => e.list === n) }))
                ).map(({ n, found }) => (
                  <div key={n}>
                    <header className="sp-sect">
                      <span>
                        <small>Podcasts</small>
                        <h1>{n < 0 ? 'Episodes' : listName(n)}</h1>
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
              {only !== 'podcasts' && (!q || playlists.length > 0) && (
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
              <header className="sp-hero" style={{ ['--tone' as string]: '#3a5a4a', ['--n' as string]: Math.max(4, listName(at.list).length) }}>
                <Mosaic list={at.list} />
                <span>
                  <small>Podcasts</small>
                  <h1>{listName(at.list)}</h1>
                  <p>
                    <b>Shrug</b> • {inList(at.list).length} episodes
                  </p>
                </span>
              </header>
              <div className="sp-under" style={{ ['--tone' as string]: '#3a5a4a' }}>
                {/* Under the head, as on a playlist's page in Spotify: the green button that plays the list, and Shuffle beside it (the same switch as the bar's) */}
                {inList(at.list)[0] && (
                  <div className="sp-acts">
                    <button type="button" className="sp-play" aria-label={`${episode?.list === at.list && !beat.paused ? 'Pause' : 'Play'} ${listName(at.list)}`} onClick={() => playList(at.list)}>
                      <Glyph is={episode?.list === at.list && !beat.paused ? 'pause' : 'play'} size={24} />
                    </button>
                    <button type="button" className="sp-act" aria-label={`Shuffle ${listName(at.list)}`} aria-pressed={shuffle} onClick={shuffleIt}>
                      <Glyph is="shuffle" size={32} />
                    </button>
                  </div>
                )}
                {episodes.some((e) => e.list === at.list) ? table(episodes.filter((e) => e.list === at.list)) : none}
              </div>
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
              <header className="sp-hero" style={{ ['--tone' as string]: toneOf(playlist), ['--n' as string]: Math.max(4, nameOf(playlist).length) }}>
                <Cover tone={toneOf(playlist)} list src={coverOf(playlist)} />
                <span>
                  <small>Public Playlist</small>
                  <h1>{nameOf(playlist)}</h1>
                  {playlist.line && <p>{playlist.line}</p>}
                </span>
              </header>
              <div className="sp-under" style={{ ['--tone' as string]: toneOf(playlist) }}>
                {embedOf(playlist.link) && !failed ? (
                  <Player key={`${playlist.id}-${again}`} src={embedOf(playlist.link)!} title={`${nameOf(playlist)}, in Spotify’s player`} tall onFailed={() => setFailed(true)} />
                ) : (
                  <div className="sp-stand">
                    <span className="sp-play" aria-hidden>
                      <Glyph is="play" size={24} />
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
        {/* The Now playing view: Spotify's own player for the episode in the bar. Shut, it is kept (the episode
            goes on playing) and only put out of sight */}
        <aside className="sp-side" aria-label="Now playing" data-shut={!side || undefined} {...(side ? {} : { inert: '' })}>
          <header>
            <b>{episode ? listName(episode.list) : 'Now playing'}</b>
            <button type="button" aria-label="Hide the Now playing view" onClick={() => setSide(false)}>
              <X size={18} strokeWidth={2} aria-hidden />
            </button>
          </header>
          <div className="sp-player">
            <div ref={host} className="sp-host" hidden={mode === 'frame' || mode === 'failed'} />
            {mode === 'frame' && episode && embedOf(episode.link) && <Player key={`${episode.id}-${again}`} src={embedOf(episode.link)!} title={`${titleOf(episode)}, in Spotify’s player`} tall onFailed={() => setMode('failed')} />}
            {(mode === 'failed' || (episode && !episode.link)) && (
              <p className="sp-lost" role="status">
                <b>{episode && !episode.link ? 'This episode has no link to Spotify yet' : 'Spotify’s player didn’t load'}</b>
                {episode?.link && (
                  <span>
                    <button type="button" className="sp-pill" onClick={() => setAgain((n) => n + 1)}>
                      Try Again
                    </button>
                    <Out href={episode.link} />
                  </span>
                )}
              </p>
            )}
          </div>
          {episode && (
            <div className="sp-about">
              <b>{titleOf(episode)}</b>
              <span>{episode.show ?? 'Podcast episode'}</span>
              {(episode.date || episode.length) && <small>{[episode.date, episode.length].filter(Boolean).join(' • ')}</small>}
            </div>
          )}
        </aside>
      </div>
      {/* The bar at the foot: what is playing, and the buttons that play it */}
      <footer className="sp-now">
        <div className="sp-what">
          {episode ? <Cover tone={episode.tone} size={56} src={coverOf(episode)} /> : <Cover tone="#333" size={56} />}
          <span>
            <b>{episode ? titleOf(episode) : 'Pick something to play'}</b>
            <small>{episode ? (episode.show ?? 'Podcast episode') : 'An episode, or a playlist.'}</small>
          </span>
        </div>
        <div className="sp-ctl" role="group" aria-label="Player controls">
          {/* Each says what it does when the pointer rests on it, as Spotify's do (data-tip) */}
          <span className="sp-keys">
            <button type="button" aria-label="Shuffle" aria-pressed={shuffle} data-tip={shuffle ? 'Disable shuffle' : 'Enable shuffle'} onClick={shuffleIt}>
              <Glyph is="shuffle" />
            </button>
            <button type="button" aria-label="Previous episode" aria-disabled={!canPrev || undefined} data-tip="Previous" onClick={prev}>
              <Glyph is="prev" />
            </button>
            <button type="button" className="sp-go" aria-label={beat.paused ? 'Play' : 'Pause'} aria-disabled={!episode?.link || undefined} data-tip={beat.paused ? 'Play' : 'Pause'} onClick={toggle}>
              <Glyph is={beat.paused ? 'play' : 'pause'} />
            </button>
            <button type="button" aria-label="Next episode" aria-disabled={!canNext || undefined} data-tip="Next" onClick={next}>
              <Glyph is="next" />
            </button>
            <button
              type="button"
              aria-label={repeat === 'one' ? 'Repeat: this episode' : repeat === 'all' ? 'Repeat: the list' : 'Repeat'}
              aria-pressed={repeat !== 'off'}
              data-tip={repeat === 'off' ? 'Enable repeat' : repeat === 'all' ? 'Enable repeat one' : 'Disable repeat'}
              onClick={() => setRepeat(repeat === 'off' ? 'all' : repeat === 'all' ? 'one' : 'off')}
            >
              <Glyph is={repeat === 'one' ? 'repeat-one' : 'repeat'} />
            </button>
          </span>
          <span className="sp-line">
            <small>{clock(beat.at)}</small>
            <input
              type="range"
              min={0}
              max={Math.max(1, Math.round(beat.of / 1000))}
              step={1}
              value={Math.round(beat.at / 1000)}
              disabled={!beat.of}
              aria-label="Where the episode is"
              aria-valuetext={`${clock(beat.at)} of ${beat.of ? clock(beat.of) : (episode?.length ?? 'the episode')}`}
              style={{ ['--at' as string]: beat.of ? `${(beat.at / beat.of) * 100}%` : '0%' }}
              onChange={(e) => seek(Number(e.target.value) * 1000)}
              onKeyDown={(e) => {
                // The arrows move it five seconds, as they do Spotify's line
                if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
                e.preventDefault()
                seek(beat.at + (e.key === 'ArrowRight' ? 5000 : -5000))
              }}
            />
            <small>{beat.of ? clock(beat.of) : (episode?.length ?? '-:--')}</small>
          </span>
        </div>
        <div className="sp-end">
          <button type="button" aria-label="Now playing view" aria-pressed={side} data-tip="Now playing view" onClick={() => setSide((was) => !was)}>
            <SquarePlay size={16} strokeWidth={1.6} aria-hidden />
          </button>
          {episode?.link && (
            <a href={episode.link} target="_blank" rel="noopener noreferrer" aria-label="Open this episode in Spotify" data-tip="Open in Spotify">
              <ArrowUpRight size={16} strokeWidth={1.7} aria-hidden />
            </a>
          )}
        </div>
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
