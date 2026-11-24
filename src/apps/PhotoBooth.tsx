import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, ChevronLeft, ChevronRight, Download, RotateCcw, Sparkles, Trash2, VideoOff, X } from 'lucide-react'
import { Window } from '../kit/window'
import { account, askLogIn, logIn } from '../os/account'
import { formatter } from '../os/dates'
import { Face } from '../os/Face'
import { useStore } from '../os/store'
import { post, readWall, remove, wall, type Post } from '../os/wall'
import { wm } from '../os/wm'
import '../styles/desk/photobooth.css'

// Photo Booth (design/v1, "Photo Booth"), after the Mac's own. The camera is asked for first, and nothing
// is saved or posted until its taker chooses to. A photo is taken after a count of three, through one of
// nine effects. Anyone can take one and save it; posting it to the wall needs someone logged in, and the
// photo is kept while they log in. The strip along the foot is the wall: the latest photos from everyone,
// each with a display name and picture. A photo on it opens large; its own taker can remove it.

/** The nine effects, in the order their grid has them: Normal is in the middle. */
const EFFECTS = [
  { id: 'mono', name: 'Mono', filter: 'grayscale(1)' },
  { id: 'sepia', name: 'Sepia', filter: 'sepia(1)' },
  { id: 'cool', name: 'Cool', filter: 'hue-rotate(150deg)' },
  { id: 'pop', name: 'Pop', filter: 'saturate(2.2) contrast(1.15)' },
  { id: 'normal', name: 'Normal', filter: 'none' },
  { id: 'negative', name: 'Negative', filter: 'invert(1)' },
  { id: 'warm', name: 'Warm', filter: 'sepia(.5) saturate(1.8)' },
  { id: 'faded', name: 'Faded', filter: 'contrast(.7) brightness(1.15)' },
  { id: 'night', name: 'Night', filter: 'brightness(.55) hue-rotate(200deg)' },
]

type Stage = 'ask' | 'starting' | 'refused' | 'live' | 'effects' | 'count' | 'review' | 'large'

let dayFormat: Intl.DateTimeFormat | undefined
const dayOf = (at: string) => {
  const parts = (dayFormat ??= formatter({ day: 'numeric', month: 'long', year: 'numeric' })).formatToParts(new Date(at))
  const of = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ''
  return `${of('day')} ${of('month')} ${of('year')}`
}

function save(src: string) {
  const link = Object.assign(document.createElement('a'), { href: src, download: `Photo Booth ${new Date().toISOString().slice(0, 10)}.jpg` })
  document.body.append(link)
  link.click()
  link.remove()
}

export function PhotoBoothApp() {
  const shown = useStore(wm, (s) => s.wins.photobooth.open && !s.wins.photobooth.minimized)
  const who = useStore(account, (s) => s)
  const { posts, loaded } = useStore(wall, (s) => s)
  const sheet = useStore(logIn, (s) => s.open)

  const video = useRef<HTMLVideoElement>(null)
  const stream = useRef<MediaStream | null>(null)
  const [stage, setStage] = useState<Stage>('ask')
  const [effect, setEffect] = useState('normal')
  const [count, setCount] = useState(3)
  const [flash, setFlash] = useState(false)
  const [photo, setPhoto] = useState<string | null>(null)
  const [large, setLarge] = useState<string | null>(null)
  const [fresh, setFresh] = useState<string | null>(null)
  const [said, setSaid] = useState<string | null>(null)
  /** A photo waiting to be posted until its taker has logged in. */
  const waiting = useRef(false)
  const filter = EFFECTS.find((e) => e.id === effect)?.filter ?? 'none'

  useEffect(() => {
    if (shown && !loaded) void readWall()
  }, [shown, loaded])

  const stop = useCallback(() => {
    stream.current?.getTracks().forEach((track) => track.stop())
    stream.current = null
  }, [])
  const start = useCallback(async () => {
    setStage('starting')
    try {
      const got = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }, audio: false })
      stream.current = got
      setStage('live')
    } catch {
      setStage('refused')
    }
  }, [])

  // The camera is on only while its window can be seen: closed or minimized, it is let go
  useEffect(() => {
    if (shown) return
    stop()
    setStage((s) => (s === 'review' || s === 'large' ? s : 'ask'))
  }, [shown, stop])
  useEffect(() => stop, [stop])

  // The picture is shown as a mirror shows it
  useEffect(() => {
    const el = video.current
    if (!el || !stream.current) return
    if (el.srcObject !== stream.current) el.srcObject = stream.current
    void el.play().catch(() => {})
  }, [stage])

  // Three, two, one; a flash; and the photo
  useEffect(() => {
    if (stage !== 'count') return
    if (count > 0) {
      const timer = setTimeout(() => setCount((c) => c - 1), 1000)
      return () => clearTimeout(timer)
    }
    const el = video.current
    if (!el || !el.videoWidth) return setStage('live')
    const canvas = document.createElement('canvas')
    canvas.width = el.videoWidth
    canvas.height = el.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return setStage('live')
    // As it was seen: mirrored, and through the effect
    ctx.filter = filter
    ctx.translate(canvas.width, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(el, 0, 0)
    setPhoto(canvas.toDataURL('image/jpeg', 0.86))
    setFlash(true)
    setStage('review')
    const timer = setTimeout(() => setFlash(false), 320)
    return () => clearTimeout(timer)
  }, [stage, count, filter])

  useEffect(() => {
    if (!said) return
    const timer = setTimeout(() => setSaid(null), 3200)
    return () => clearTimeout(timer)
  }, [said])
  useEffect(() => {
    if (!fresh) return
    const timer = setTimeout(() => setFresh(null), 6000)
    return () => clearTimeout(timer)
  }, [fresh])

  const send = useCallback(async () => {
    if (!photo) return
    const made = await post(photo)
    if ('error' in made) {
      if (made.error === 'anon') {
        // Posting needs a name behind it: the menu bar's sheet, and the photo is kept meanwhile
        waiting.current = true
        return askLogIn('post')
      }
      return setSaid('That didn’t post. Try again.')
    }
    waiting.current = false
    setPhoto(null)
    setFresh(made.id)
    setSaid('Posted. You can remove it any time.')
    setStage(stream.current ? 'live' : 'ask')
  }, [photo])

  // Logged in with a photo waiting: it is posted, as they asked. The sheet put away without logging in: it waits no longer
  useEffect(() => {
    if (!waiting.current) return
    if (who.status === 'member' && !sheet) void send()
    else if (who.status !== 'member' && !sheet) waiting.current = false
  }, [who.status, sheet, send])

  const shownLarge = large ? (posts.find((p) => p.id === large) ?? null) : null
  const at = shownLarge ? posts.indexOf(shownLarge) : -1
  const mine = (p: Post) => who.status === 'member' && p.by === who.email
  const camera = () => (setLarge(null), setStage(stream.current ? 'live' : 'ask'))
  const open = (p: Post) => (setLarge(p.id), setStage('large'))
  const me = who.status === 'member' ? who.name || who.first : null

  return (
    <Window className="app pbwin" lightsSize="large" lead={<b className="pb-name">Photo Booth</b>} body={{ className: 'pbwin__body' }}>
      <div className="pb" data-stage={stage}>
        <div className="pb-view">
          {(stage === 'live' || stage === 'count' || stage === 'effects') && stream.current && stage !== 'effects' && <video ref={video} className="pb-cam" style={{ filter }} muted playsInline aria-label="The camera" />}
          {stage === 'effects' && (
            <div className="pb-fx" role="radiogroup" aria-label="Effects">
              {EFFECTS.map((e) => (
                <button key={e.id} type="button" role="radio" aria-checked={effect === e.id} className={effect === e.id ? 'on' : undefined} onClick={() => (setEffect(e.id), setStage('live'))}>
                  <Tile stream={stream.current} filter={e.filter} />
                  <small>{e.name}</small>
                </button>
              ))}
            </div>
          )}
          {stage === 'review' && photo && <img className="pb-photo" src={photo} alt="The photo you took" />}
          {stage === 'large' && shownLarge && (
            <>
              <img className="pb-photo" src={shownLarge.src} alt={`A photo by ${shownLarge.name}`} />
              {at > 0 && (
                <button type="button" className="pb-nav pb-nav--back" aria-label="Previous" onClick={() => setLarge(posts[at - 1]!.id)}>
                  <ChevronLeft size={18} strokeWidth={1.8} aria-hidden />
                </button>
              )}
              {at < posts.length - 1 && (
                <button type="button" className="pb-nav pb-nav--on" aria-label="Next" onClick={() => setLarge(posts[at + 1]!.id)}>
                  <ChevronRight size={18} strokeWidth={1.8} aria-hidden />
                </button>
              )}
              <div className="pb-meta">
                <Face picture={shownLarge.picture} name={shownLarge.name} size={30} />
                <span>
                  <b>{shownLarge.name}</b>
                  <small>{dayOf(shownLarge.at)}</small>
                </span>
              </div>
            </>
          )}
          {stage === 'count' && (
            <div className="pb-count" role="status" aria-label={count ? String(count) : 'Taking the photo'}>
              <b aria-hidden>{count || ''}</b>
              <span aria-hidden>
                {[3, 2, 1].map((n) => (
                  <i key={n} className={count <= n ? 'on' : undefined} />
                ))}
              </span>
            </div>
          )}
          {flash && <div className="pb-flash" aria-hidden />}
          {(stage === 'ask' || stage === 'starting') && (
            <div className="pb-msg">
              <Camera size={40} strokeWidth={1.5} aria-hidden />
              <h2>Photo Booth would like to use your camera</h2>
              <p>Your browser will ask next. Nothing is saved or posted until you choose to.</p>
              <button type="button" className="pb-btn blue pb-btn--tall" aria-disabled={stage === 'starting' || undefined} onClick={() => stage === 'ask' && void start()}>
                {stage === 'starting' ? 'Asking…' : 'Allow Camera'}
              </button>
            </div>
          )}
          {stage === 'refused' && (
            <div className="pb-msg">
              <VideoOff size={40} strokeWidth={1.5} aria-hidden />
              <h2>The camera is off</h2>
              <p>Turn it on for this site in your browser’s settings, then try again. The wall below still works without it.</p>
              <button type="button" className="pb-btn pb-btn--tall" onClick={() => void start()}>
                Try Again
              </button>
            </div>
          )}
          {stage === 'review' && me && <span className="pb-line">Posting shows this photo and your name, {me}, to everyone.</span>}
          {said && (
            <span className="pb-toast" role="status">
              {said}
            </span>
          )}
        </div>
        <div className="pb-ctl">
          <div>
            {(stage === 'live' || stage === 'effects') && (
              <button type="button" className="pb-btn" aria-pressed={stage === 'effects'} onClick={() => setStage(stage === 'effects' ? 'live' : 'effects')}>
                <Sparkles size={14} strokeWidth={1.8} aria-hidden />
                Effects
              </button>
            )}
            {stage === 'review' && (
              <button type="button" className="pb-btn" onClick={() => (setPhoto(null), (waiting.current = false), setStage(stream.current ? 'live' : 'ask'))}>
                <RotateCcw size={14} strokeWidth={1.8} aria-hidden />
                Retake
              </button>
            )}
            {stage === 'large' && (
              <button type="button" className="pb-btn" onClick={camera}>
                <Camera size={14} strokeWidth={1.8} aria-hidden />
                Camera
              </button>
            )}
          </div>
          {stage === 'review' ? (
            <button type="button" className="pb-btn blue pb-btn--post" onClick={() => void send()}>
              Post to the Wall
            </button>
          ) : stage === 'large' && shownLarge ? (
            <button type="button" className="pb-btn pb-btn--tall" onClick={() => save(shownLarge.src)}>
              <Download size={14} strokeWidth={1.8} aria-hidden />
              Save
            </button>
          ) : stage === 'count' ? (
            <button type="button" className="pb-shutter off" aria-label="Cancel" onClick={() => setStage('live')}>
              <X size={22} strokeWidth={2.2} aria-hidden />
            </button>
          ) : (
            <button type="button" className={`pb-shutter${stage === 'live' ? '' : ' off'}`} aria-label={stage === 'live' ? 'Take photo' : 'Take photo, unavailable'} aria-disabled={stage !== 'live' || undefined} onClick={() => stage === 'live' && (setCount(3), setStage('count'))}>
              <Camera size={22} strokeWidth={2} aria-hidden />
            </button>
          )}
          <div>
            {stage === 'review' && photo && (
              <button type="button" className="pb-btn" onClick={() => save(photo)}>
                <Download size={14} strokeWidth={1.8} aria-hidden />
                Save
              </button>
            )}
            {stage === 'large' && shownLarge && mine(shownLarge) && (
              <button type="button" className="pb-btn pb-btn--remove" onClick={() => void remove(shownLarge.id).then((gone) => gone && (camera(), setSaid('Removed from the wall.')))}>
                <Trash2 size={14} strokeWidth={1.8} aria-hidden />
                Remove
              </button>
            )}
          </div>
        </div>
        {posts.length ? (
          <ol className="pb-strip" aria-label="The wall: latest photos from everyone">
            {posts.map((p) => (
              <li key={p.id} className={`pb-th${large === p.id && stage === 'large' ? ' on' : ''}${fresh === p.id ? ' new' : ''}`}>
                <button type="button" aria-label={`A photo by ${p.name}, ${dayOf(p.at)}`} onClick={() => open(p)}>
                  <span>
                    <img src={p.src} alt="" />
                  </span>
                  <small>
                    <Face picture={p.picture} name={p.name} size={14} />
                    {p.name}
                  </small>
                </button>
              </li>
            ))}
          </ol>
        ) : (
          <div className="pb-strip pb-strip--none">{loaded ? 'No photos yet. Take one and be first on the wall.' : ''}</div>
        )}
      </div>
    </Window>
  )
}

/** One effect, in the grid of nine: the camera, small, seen through it. */
function Tile({ stream, filter }: { stream: MediaStream | null; filter: string }) {
  const el = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    if (!el.current || !stream) return
    el.current.srcObject = stream
    void el.current.play().catch(() => {})
  }, [stream])
  return <video ref={el} style={{ filter }} muted playsInline aria-hidden />
}
