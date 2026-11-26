import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Camera, ChevronLeft, ChevronRight, Flag, Grid2x2, Lock, RotateCcw, Share, SquareUserRound, Video, VideoOff, X } from 'lucide-react'
import { Window } from '../kit/window'
import { account, askLogIn, logIn } from '../os/account'
import { formatter } from '../os/dates'
import { Face } from '../os/Face'
import { useStore } from '../os/store'
import { flag, post, readWall, remove, wall, type Post } from '../os/wall'
import { wm } from '../os/wm'
import '../styles/desk/photobooth.css'

// Photo Booth (design/v1, "Photo Booth"), after the Mac's own as Dom's screenshots show it: the picture from
// edge to edge, the strip under it, and one bar with the view's switch, the red shutter and Effects. It is
// for someone logged in (Dom's note after testing): a visitor is shown the door, and the camera is not asked
// for until they are in. Then the camera is asked for, and nothing is saved or posted until its taker
// chooses to. A photo is taken after a count of three (the bar turns red and counts), through one of nine
// effects, one at a time or four to a sheet. The strip is the wall: the latest photos from everyone, each
// with a display name and picture. A photo that is posted is on it at once. A photo on it opens large: the
// camera's button in the bar's middle goes back to the camera, Share hands the photo on, its own taker can
// remove it with the x on its corner in the strip (nobody else can), and anyone else logged in can flag it
// for Shrug to look at: it stays on the wall, and whoever flagged it is not shown it again (os/wall.ts).

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

type Stage = 'door' | 'ask' | 'starting' | 'refused' | 'live' | 'effects' | 'count' | 'review' | 'large'

let dayFormat: Intl.DateTimeFormat | undefined
const dayOf = (at: string) => {
  const parts = (dayFormat ??= formatter({ day: 'numeric', month: 'long', year: 'numeric' })).formatToParts(new Date(at))
  const of = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ''
  return `${of('month')} ${of('day')}, ${of('year')}`
}

const fileName = () => `Photo Booth ${new Date().toISOString().slice(0, 10)}.jpg`
function save(src: string) {
  const link = Object.assign(document.createElement('a'), { href: src, download: fileName() })
  document.body.append(link)
  link.click()
  link.remove()
}

/** Hands a photo on: the system's own share sheet where there is one, the clipboard where there is not, and
 * failing both a file to keep. It says which it was, so the bar can say so. */
async function share(src: string): Promise<'shared' | 'copied' | 'saved' | 'stopped'> {
  try {
    const blob = await (await fetch(src)).blob()
    const file = new File([blob], fileName(), { type: blob.type || 'image/jpeg' })
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Photo Booth' })
      return 'shared'
    }
    if (navigator.clipboard && 'ClipboardItem' in window) {
      // (a clipboard takes a PNG: the photo is drawn into one)
      const bitmap = await createImageBitmap(blob)
      const canvas = Object.assign(document.createElement('canvas'), { width: bitmap.width, height: bitmap.height })
      canvas.getContext('2d')?.drawImage(bitmap, 0, 0)
      const png = await new Promise<Blob | null>((done) => canvas.toBlob(done, 'image/png'))
      if (png) {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })])
        return 'copied'
      }
    }
  } catch (e) {
    if ((e as DOMException)?.name === 'AbortError') return 'stopped'
  }
  save(src)
  return 'saved'
}
const SHARED = { shared: null, stopped: null, copied: 'Photo copied. Paste it anywhere.', saved: 'Saved to your downloads.' } as const

export function PhotoBoothApp() {
  const shown = useStore(wm, (s) => s.wins.photobooth.open && !s.wins.photobooth.minimized)
  const who = useStore(account, (s) => s)
  const { posts, loaded } = useStore(wall, (s) => s)
  const sheet = useStore(logIn, (s) => s.open)

  const video = useRef<HTMLVideoElement>(null)
  const stream = useRef<MediaStream | null>(null)
  const [stage, setStage] = useState<Stage>(() => (account.get().status === 'member' ? 'ask' : 'door'))
  /** One photo, or four to a sheet. */
  const [four, setFour] = useState(false)
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

  // Photo Booth is for someone logged in: a visitor is at the door, and whoever logs out is back at it
  const member = who.status === 'member'
  useEffect(() => {
    if (who.status === 'checking') return
    if (!member) {
      stop()
      setPhoto(null)
      setLarge(null)
      setStage('door')
    } else setStage((s) => (s === 'door' ? 'ask' : s))
  }, [member, who.status, stop])

  // The camera is on only while its window can be seen: closed or minimized, it is let go
  useEffect(() => {
    if (shown) return
    stop()
    setStage((s) => (s === 'review' || s === 'large' || s === 'door' ? s : 'ask'))
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
    // The photo is what was framed: the view shows the middle of the camera's picture, cut to its own
    // shape, and that is the part that is kept
    const view = el.getBoundingClientRect()
    const shape = view.width > 0 && view.height > 0 ? view.width / view.height : el.videoWidth / el.videoHeight
    const sw = Math.round(Math.min(el.videoWidth, el.videoHeight * shape))
    const sh = Math.round(Math.min(el.videoHeight, el.videoWidth / shape))
    const sx = Math.round((el.videoWidth - sw) / 2)
    const sy = Math.round((el.videoHeight - sh) / 2)
    const canvas = document.createElement('canvas')
    canvas.width = sw
    canvas.height = sh
    const ctx = canvas.getContext('2d')
    if (!ctx) return setStage('live')
    /** One frame, as it was seen (mirrored, and through the effect), into a part of the sheet. */
    const take = (x: number, y: number, w: number, h: number) => {
      ctx.save()
      ctx.filter = filter
      ctx.translate(x + w, y)
      ctx.scale(-1, 1)
      ctx.drawImage(el, sx, sy, sw, sh, 0, 0, w, h)
      ctx.restore()
      setFlash(true)
      setTimeout(() => setFlash(false), 220)
    }
    const done = () => {
      setPhoto(canvas.toDataURL('image/jpeg', 0.86))
      setStage('review')
    }
    if (!four) {
      take(0, 0, canvas.width, canvas.height)
      return done()
    }
    // Four to a sheet: one after another, a beat apart, each into its quarter
    const timers: ReturnType<typeof setTimeout>[] = []
    for (let n = 0; n < 4; n++) timers.push(setTimeout(() => (take((n % 2) * (canvas.width / 2), Math.floor(n / 2) * (canvas.height / 2), canvas.width / 2, canvas.height / 2), n === 3 && done()), n * 700))
    return () => timers.forEach(clearTimeout)
  }, [stage, count, filter, four])

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
    setSaid('Posted. It’s on the wall.')
    setStage(stream.current ? 'live' : 'ask')
  }, [photo])

  // Logged in with a photo waiting: it is posted, as they asked. The sheet put away without logging in: it waits no longer
  useEffect(() => {
    if (!waiting.current) return
    if (who.status === 'member' && !sheet) void send()
    else if (who.status !== 'member' && !sheet) waiting.current = false
  }, [who.status, sheet, send])

  const mine = (p: Post) => who.status === 'member' && p.by === who.email
  // What the strip has: the wall, oldest first, so that the newest is at its right end, where a Mac's booth
  // puts a photo just taken. A photo is not shown again to someone who has flagged it
  const strip = posts.filter((p) => !(who.status === 'member' && p.flags?.includes(who.email))).reverse()
  const shownLarge = large ? (strip.find((p) => p.id === large) ?? null) : null
  const at = shownLarge ? strip.indexOf(shownLarge) : -1
  // Back to the camera: for someone logged in. A visitor who was looking at the wall is back at the door
  const camera = () => (setLarge(null), setStage(!member ? 'door' : stream.current ? 'live' : 'ask'))
  const hand = (src: string) => void share(src).then((how) => SHARED[how] && setSaid(SHARED[how]))
  const open = (p: Post) => (setLarge(p.id), setStage('large'))
  const me = who.status === 'member' ? who.name || who.first : null

  const counting = stage === 'count'
  // The strip is kept at its right end, where the newest is: more photos than fit run off its left, and
  // are reached by scrolling it
  const row = useRef<HTMLOListElement>(null)
  const newest = strip[strip.length - 1]?.id
  useEffect(() => {
    const el = row.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [newest, strip.length, shown])
  /** In the viewer the arrows go to the photo before and after, and Escape goes back to the camera. */
  const keys = (e: KeyboardEvent<HTMLDivElement>) => {
    if (stage !== 'large' || e.metaKey || e.ctrlKey || e.altKey) return
    if (e.key === 'Escape') return e.preventDefault(), camera()
    const to = e.key === 'ArrowLeft' ? strip[at - 1] : e.key === 'ArrowRight' ? strip[at + 1] : null
    if (to) e.preventDefault(), setLarge(to.id)
  }
  return (
    <Window className="app pbwin" lightsSize="large" lead={<b className="pb-name">Photo Booth</b>} body={{ className: 'pbwin__body' }}>
      <div className="pb" data-stage={stage} onKeyDown={keys}>
        <div className="pb-view">
          {(stage === 'live' || stage === 'count') && stream.current && <video ref={video} className="pb-cam" style={{ filter }} muted playsInline aria-label="The camera" />}
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
                <button type="button" className="pb-nav pb-nav--back" aria-label="Previous" onClick={() => setLarge(strip[at - 1]!.id)}>
                  <ChevronLeft size={18} strokeWidth={1.8} aria-hidden />
                </button>
              )}
              {at < strip.length - 1 && (
                <button type="button" className="pb-nav pb-nav--on" aria-label="Next" onClick={() => setLarge(strip[at + 1]!.id)}>
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
          {flash && <div className="pb-flash" aria-hidden />}
          {stage === 'door' && (
            <div className="pb-msg">
              <Lock size={36} strokeWidth={1.5} aria-hidden />
              <h2>Log in to use Photo Booth</h2>
              <button type="button" className="pb-btn blue pb-btn--tall" onClick={() => askLogIn('booth')}>
                Log In
              </button>
            </div>
          )}
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
          {stage === 'review' && me && <span className="pb-line">Posting shares this photo and your name with everyone.</span>}
          {said && (
            <span className="pb-toast" role="status">
              {said}
            </span>
          )}
        </div>
        {/* The strip: the wall, at the right of the strip as a Mac's booth keeps its own, the newest at its
            end. It stays where it is through the count, so that the picture does not change shape under
            whoever is posing. The one that is open has an x on its corner, for its taker (and nobody else)
            to remove it */}
        {
          (strip.length ? (
            <ol ref={row} className="pb-strip" aria-label="The wall: latest photos from everyone">
              {strip.map((p) => (
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
                  {large === p.id && stage === 'large' && mine(p) && (
                    <button type="button" className="pb-th__x" aria-label="Remove this photo from the wall" onClick={() => void remove(p.id).then((gone) => gone && (camera(), setSaid('Removed from the wall.')))}>
                      <X size={11} strokeWidth={2.6} aria-hidden />
                    </button>
                  )}
                </li>
              ))}
            </ol>
          ) : (
            <div className="pb-strip pb-strip--none">{loaded ? 'No photos yet. Take one and be first on the wall.' : ''}</div>
          ))}
        {counting ? (
          // The count: the bar turns red, and counts three, two, one
          <div className="pb-ctl pb-ctl--count" role="status" aria-label={count ? String(count) : 'Taking the photo'}>
            <span className="pb-count" aria-hidden>
              {[3, 2, 1].map((n) => (
                <b key={n} className={count === n ? 'on' : undefined}>
                  {n}
                </b>
              ))}
            </span>
            <button type="button" className="pb-shutter off" aria-label="Cancel" onClick={() => setStage('live')}>
              <Camera size={20} strokeWidth={2} aria-hidden />
            </button>
          </div>
        ) : (
          <div className="pb-ctl">
            <div>
              {(stage === 'live' || stage === 'effects' || stage === 'ask' || stage === 'starting' || stage === 'refused' || stage === 'door') && (
                <span className="pb-seg" role="group" aria-label="What to take">
                  <button type="button" aria-label="Four to a sheet" aria-pressed={four} onClick={() => setFour(true)}>
                    <Grid2x2 size={15} strokeWidth={1.7} aria-hidden />
                  </button>
                  <button type="button" aria-label="One photo" aria-pressed={!four} onClick={() => setFour(false)}>
                    <SquareUserRound size={15} strokeWidth={1.7} aria-hidden />
                  </button>
                  <button type="button" aria-label="A film: not in this booth" aria-disabled="true" title="Films aren’t taken in this booth">
                    <Video size={15} strokeWidth={1.7} aria-hidden />
                  </button>
                </span>
              )}
              {stage === 'review' && (
                <button type="button" className="pb-btn" onClick={() => (setPhoto(null), (waiting.current = false), setStage(stream.current ? 'live' : 'ask'))}>
                  <RotateCcw size={14} strokeWidth={1.8} aria-hidden />
                  Retake
                </button>
              )}
              {/* Someone else's photo can be flagged, for Shrug to look at: it is theirs to remove, not the
                  flagger's, who is simply not shown it again */}
              {stage === 'large' && shownLarge && !mine(shownLarge) && (
                <button
                  type="button"
                  className="pb-btn"
                  aria-label="Flag this photo as not right for the wall"
                  onClick={() =>
                    void flag(shownLarge.id).then((went) => {
                      if (typeof went === 'object') return askLogIn('booth')
                      if (went) camera(), setSaid('Flagged for Shrug to look at. You won’t be shown it again.')
                    })
                  }
                >
                  <Flag size={14} strokeWidth={1.8} aria-hidden />
                  Flag
                </button>
              )}
            </div>
            {stage === 'review' ? (
              <button type="button" className="pb-btn blue pb-btn--post" onClick={() => void send()}>
                Post to the Wall
              </button>
            ) : stage === 'large' && shownLarge ? (
              // A photo is open: the camera's button, grey, goes back to the camera
              <button type="button" className="pb-shutter back" aria-label="Back to the camera" onClick={camera}>
                <Camera size={20} strokeWidth={2} aria-hidden />
              </button>
            ) : (
              <button type="button" className={`pb-shutter${stage === 'live' ? '' : ' off'}`} aria-label={stage === 'live' ? (four ? 'Take four photos' : 'Take photo') : 'Take photo, unavailable'} aria-disabled={stage !== 'live' || undefined} onClick={() => stage === 'live' && (setCount(3), setStage('count'))}>
                <Camera size={20} strokeWidth={2} aria-hidden />
              </button>
            )}
            <div>
              {(stage === 'live' || stage === 'effects') && (
                <button type="button" className="pb-btn" aria-pressed={stage === 'effects'} onClick={() => setStage(stage === 'effects' ? 'live' : 'effects')}>
                  Effects
                </button>
              )}
              {stage === 'review' && photo && (
                <button type="button" className="pb-btn pb-share" aria-label="Share this photo" onClick={() => hand(photo)}>
                  <Share size={15} strokeWidth={1.8} aria-hidden />
                </button>
              )}
              {stage === 'large' && shownLarge && (
                <button type="button" className="pb-btn pb-share" aria-label="Share this photo" onClick={() => hand(shownLarge.src)}>
                  <Share size={15} strokeWidth={1.8} aria-hidden />
                </button>
              )}
            </div>
          </div>
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
