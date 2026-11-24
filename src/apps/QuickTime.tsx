import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { FILMS, type Film } from '../data/films'
import { Window } from '../kit/window'
import { createStore, useStore } from '../os/store'
import { wm } from '../os/wm'
import '../styles/desk/quicktime.css'

// QuickTime Player (design/v1, "QuickTime Player"): the old brushed-metal player, with its controls drawn in
// its own style. A Film file on the desk opens it. It plays the films in src/data/films.ts: a file, in a
// <video> with none of a browser's own controls showing; or, for a film not yet supplied, a stand-in (its
// poster, and the clock running). It pauses when its window is minimized or closed.

type Status = 'poster' | 'loading' | 'playing' | 'paused' | 'ended' | 'failed'

/** Which film the player is on. The desk's Film file asks for the first. */
export const reel = createStore<{ id: string; n: number }>({ id: FILMS[0]!.id, n: 0 })
export const showFilm = (id: string = FILMS[0]!.id) => reel.set((s) => ({ id, n: s.n + 1 }))

const clock = (seconds: number | null) => (seconds === null ? '–:––' : `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`)
/** How long the player waits at a film's end before going on to the next. */
const NEXT_IN = 5

const Glyph = ({ d, size = 14 }: { d: string; size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden>
    <path d={d} />
  </svg>
)
const PLAY = 'M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5z'
const PAUSE = 'M6 4h4v16H6zM14 4h4v16h-4z'
const PREVIOUS = 'M5 4h2.5v16H5zM20 5.2v13.6a.9.9 0 0 1-1.4.75L8.5 12.75a.9.9 0 0 1 0-1.5L18.6 4.45A.9.9 0 0 1 20 5.2z'
const NEXT = 'M16.5 4H19v16h-2.5zM4 5.2v13.6a.9.9 0 0 0 1.4.75l10.1-6.8a.9.9 0 0 0 0-1.5L5.4 4.45A.9.9 0 0 0 4 5.2z'
const FULL = 'M4 4h6v2.2H6.2V10H4zM14 4h6v6h-2.2V6.2H14zM4 14h2.2v3.8H10V20H4zM17.8 14H20v6h-6v-2.2h3.8z'
const VOLUME = 'M3 9.5h3.5L11.5 5v14L6.5 14.5H3zM14.5 8.2a5 5 0 0 1 0 7.6l-1.2-1.3a3.2 3.2 0 0 0 0-5zM17 5.5a8.5 8.5 0 0 1 0 13l-1.2-1.3a6.7 6.7 0 0 0 0-10.4z'
const REPLAY = 'M12 5V2L7.5 6 12 10V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z'
const WARN = 'M12 3 1.8 20.5h20.4zm-1 6.5h2v6h-2zm0 7.5h2v2h-2z'

export function QuickTimeApp() {
  const shown = useStore(wm, (s) => s.wins.quicktime.open && !s.wins.quicktime.minimized)
  const asked = useStore(reel, (s) => s)
  const film = FILMS.find((f) => f.id === asked.id) ?? FILMS[0]!
  const index = FILMS.indexOf(film)
  const after = FILMS[index + 1] ?? null

  const video = useRef<HTMLVideoElement>(null)
  const well = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<Status>('poster')
  const [time, setTime] = useState(0)
  const [length, setLength] = useState<number | null>(film.length)
  const [volume, setVolume] = useState(0.62)
  const [wait, setWait] = useState(NEXT_IN)
  const playing = status === 'playing'

  // A film asked for begins at its poster
  useEffect(() => {
    setStatus('poster')
    setTime(0)
    setLength(film.length)
    setWait(NEXT_IN)
  }, [film.id, asked.n])

  // A stand-in has no file: its clock is run here, a quarter of a second at a time
  useEffect(() => {
    if (film.src || !playing) return
    let last = performance.now()
    const timer = setInterval(() => {
      const now = performance.now()
      const gone = (now - last) / 1000
      last = now
      setTime((t) => {
        const next = t + gone
        if (next < film.length) return next
        setStatus('ended')
        return film.length
      })
    }, 250)
    return () => clearInterval(timer)
  }, [film, playing])

  useEffect(() => {
    if (video.current) video.current.volume = volume
  }, [volume, film.id])

  const play = useCallback(() => {
    if (!film.src) return setStatus('playing')
    const el = video.current
    if (!el) return
    setStatus((s) => (s === 'poster' || s === 'failed' ? 'loading' : s))
    void el.play().catch(() => setStatus('failed'))
  }, [film.src])
  const pause = useCallback(() => {
    if (film.src) video.current?.pause()
    setStatus((s) => (s === 'playing' || s === 'loading' ? 'paused' : s))
  }, [film.src])
  const seek = useCallback(
    (to: number) => {
      const total = length ?? film.length
      const at = Math.max(0, Math.min(total, to))
      if (film.src && video.current) video.current.currentTime = at
      setTime(at)
      setStatus((s) => (s === 'ended' && at < total ? 'paused' : s))
    },
    [film, length],
  )
  const replay = () => {
    seek(0)
    setWait(NEXT_IN)
    if (film.src && video.current) video.current.currentTime = 0
    setStatus('paused')
    // (a moment, so that a stand-in's clock begins from nothing)
    setTimeout(play, 0)
  }
  const go = (to: Film | null) => to && showFilm(to.id)

  // Minimized or closed, it stops: nothing plays that cannot be seen
  useEffect(() => {
    if (!shown) pause()
  }, [shown, pause])

  // At a film's end the next plays by itself, after a count that can be seen
  useEffect(() => {
    if (status !== 'ended' || !after) return
    if (wait <= 0) {
      showFilm(after.id)
      setTimeout(() => setStatus('playing'), 0)
      return
    }
    const timer = setTimeout(() => setWait((w) => w - 1), 1000)
    return () => clearTimeout(timer)
  }, [status, wait, after])
  useEffect(() => {
    if (status !== 'ended') setWait(NEXT_IN)
  }, [status])

  const full = () => {
    const el = well.current
    if (!el) return
    if (document.fullscreenElement === el) void document.exitFullscreen?.().catch(() => {})
    else void el.requestFullscreen?.().catch(() => {})
  }

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.altKey || e.ctrlKey || e.metaKey || (e.target as HTMLElement).closest('input')) return
    if (e.key === ' ' || e.key === 'k') {
      // (a button that has the keyboard answers Space itself)
      if (e.key === ' ' && (e.target as HTMLElement).closest('button')) return
      e.preventDefault()
      return playing ? pause() : status === 'ended' ? replay() : play()
    }
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') return e.preventDefault(), seek(time + (e.key === 'ArrowRight' ? 5 : -5))
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') return e.preventDefault(), setVolume((v) => Math.max(0, Math.min(1, v + (e.key === 'ArrowUp' ? 0.1 : -0.1))))
    if (e.key === 'f') return e.preventDefault(), full()
  }

  const total = length ?? film.length
  const ratio = total ? Math.min(1, time / total) : 0
  const off = status === 'loading' || status === 'failed'
  /** The track and the volume are dragged along: where the pointer is, as a share of the way across. */
  const along = (e: ReactPointerEvent<HTMLElement>, set: (share: number) => void) => {
    const el = e.currentTarget
    const at = (x: number) => {
      const r = el.getBoundingClientRect()
      set(Math.max(0, Math.min(1, (x - r.left) / r.width)))
    }
    at(e.clientX)
    el.setPointerCapture(e.pointerId)
    const move = (ev: PointerEvent) => at(ev.clientX)
    const up = () => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
  }

  return (
    <Window className="app qtwin" lightsSize="large" lead={<b className="qt-name">{film.name}</b>} body={{ className: 'qtwin__body' }}>
      <div className={`qt${off ? ' qt-off' : ''}`} data-autofocus tabIndex={0} role="group" aria-label={`QuickTime Player: ${film.name}`} data-status={status} onKeyDown={onKey}>
        <div ref={well} className="qt-well" onDoubleClick={full}>
          {film.src ? (
            <video
              ref={video}
              key={film.id}
              src={film.src}
              poster={film.poster}
              playsInline
              preload="metadata"
              disablePictureInPicture
              controlsList="nodownload noplaybackrate noremoteplayback"
              onLoadedMetadata={(e) => setLength(Number.isFinite(e.currentTarget.duration) ? e.currentTarget.duration : film.length)}
              onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
              onWaiting={() => setStatus((s) => (s === 'playing' ? 'loading' : s))}
              onPlaying={() => setStatus('playing')}
              onPause={(e) => !e.currentTarget.ended && setStatus((s) => (s === 'playing' ? 'paused' : s))}
              onEnded={() => setStatus('ended')}
              onError={() => setStatus('failed')}
              onClick={() => (playing ? pause() : play())}
            />
          ) : (
            <img src={film.poster} alt="" onClick={() => (playing ? pause() : status !== 'ended' && play())} />
          )}
          {!off && <span className="lab">{status === 'poster' ? 'Poster frame' : film.name}</span>}
          {status === 'poster' && (
            <button type="button" className="qt-big" aria-label={`Play ${film.name}`} onClick={play}>
              <Glyph d={PLAY} size={34} />
            </button>
          )}
          {status === 'ended' && (
            <div className="qt-over">
              <h3>{film.name}</h3>
              <div className="qt-pills">
                <button type="button" className="qt-pill" onClick={replay}>
                  <Glyph d={REPLAY} />
                  Replay
                </button>
                {after && (
                  <button type="button" className="qt-pill" onClick={() => (go(after), setTimeout(() => setStatus('playing'), 0))}>
                    <Glyph d={NEXT} />
                    Next: {after.name}, {clock(after.length)}
                  </button>
                )}
              </div>
              {after && (
                <p role="status">
                  {after.name} plays in {wait === 1 ? '1 second' : `${wait} seconds`}.
                </p>
              )}
            </div>
          )}
          {status === 'loading' && (
            <div className="qt-over qt-over--black" role="status">
              <span className="qt-spin" aria-hidden />
              <p>Loading the film…</p>
            </div>
          )}
          {status === 'failed' && (
            <div className="qt-over qt-over--black" role="alert">
              <Glyph d={WARN} size={30} />
              <h3>The film can’t play right now</h3>
              <p>Check your connection and try again.</p>
              <button type="button" className="qt-pill" onClick={play}>
                Try Again
              </button>
            </div>
          )}
        </div>
        <div className="qt-ctl">
          <div className="qt-lcd">
            <span className="num">{off ? clock(null) : clock(time)}</span>
            <span
              className="qt-track"
              role="slider"
              tabIndex={off ? -1 : 0}
              aria-label="Where the film is"
              aria-valuemin={0}
              aria-valuemax={Math.round(total)}
              aria-valuenow={Math.round(time)}
              aria-valuetext={`${clock(time)} of ${clock(total)}`}
              aria-disabled={off || undefined}
              onPointerDown={(e) => !off && along(e, (share) => seek(share * total))}
            >
              <i style={{ width: `${ratio * 100}%` }} />
              <b style={{ left: `${ratio * 100}%` }} />
            </span>
            <span className="num">{off ? clock(null) : clock(total)}</span>
          </div>
          <div className="qt-vol">
            <Glyph d={VOLUME} size={16} />
            <span role="slider" tabIndex={off ? -1 : 0} aria-label="Volume" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(volume * 100)} aria-disabled={off || undefined} onPointerDown={(e) => !off && along(e, setVolume)}>
              <i style={{ left: `${volume * 100}%` }} />
            </span>
          </div>
          <div className="qt-tr">
            <button type="button" className="qt-b" aria-label="Previous" aria-disabled={off || undefined} onClick={() => !off && (time > 3 || index === 0 ? seek(0) : go(FILMS[index - 1] ?? null))}>
              <Glyph d={PREVIOUS} />
            </button>
            <button type="button" className="qt-b play" aria-label={playing ? 'Pause' : 'Play'} aria-disabled={off || undefined} onClick={() => !off && (playing ? pause() : status === 'ended' ? replay() : play())}>
              <Glyph d={playing ? PAUSE : PLAY} size={20} />
            </button>
            <button type="button" className="qt-b" aria-label="Next" aria-disabled={off || !after || undefined} onClick={() => !off && go(after)}>
              <Glyph d={NEXT} />
            </button>
          </div>
          <div className="qt-end">
            <button type="button" className="qt-b" aria-label="Full screen" aria-disabled={off || undefined} onClick={() => !off && full()}>
              <Glyph d={FULL} />
            </button>
          </div>
        </div>
        <ol className="qt-list" aria-label="Films">
          {FILMS.map((f) => (
            <li key={f.id} className={f.id === film.id ? 'on' : undefined}>
              <button type="button" aria-current={f.id === film.id || undefined} onClick={() => showFilm(f.id)}>
                <span aria-hidden>{f.id === film.id && playing ? <Glyph d={PLAY} size={10} /> : null}</span>
                <span>{f.name}</span>
                <span className="num">{clock(f.length)}</span>
              </button>
            </li>
          ))}
          {/* (the list has room for more: a row stands empty until there is another) */}
          <li aria-hidden />
        </ol>
      </div>
    </Window>
  )
}
