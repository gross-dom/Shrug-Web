import '../../styles/variants/v7.css'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type MouseEvent } from 'react'
import { ArrowUpRight, Check, Share } from 'lucide-react'
import { QUESTION, TOTAL } from '../../apps/chat'
import { GROUP_NAME, PersonAvatar, relationsOf } from '../../apps/chat-ui'
import { PEOPLE } from '../../data/people'
import { SITE } from '../../data/site'
import { prefersReducedMotion } from '../../os/dom'
import { AppIcon, DocumentIcon } from '../../os/icons'
import { askMotion, haptic, hasMotion, motionNeedsAsking, share, watchHeld, watchShake } from '../native'
import { openApp, openSheet, type PhoneApp } from '../nav'

// Version 7: Shrug it. Niv's question stays at the top; one answer sits on a
// card in the middle. Shrug the phone (a quick lift, a shake) and the card is
// tossed away and somebody else's answer drops in. The backdrop is the
// wallpaper's sheets of colour, and they lean with the phone, so it feels like
// holding the thing. Without the sensors a tap on the card does all of it.

/** One answer on the table: who, and which toss dealt it (the first is 0). */
interface Deal {
  index: number
  n: number
}

/** The type sizes a quote is tried at, largest first, until it fits its card. */
const SIZES = [38, 34, 31, 28, 26, 24, 22, 20, 19, 18, 17, 16, 15, 14, 13]

const DOORS: { app: PhoneApp; label: string }[] = [
  { app: 'finder', label: 'Portfolio' },
  { app: 'notes', label: 'FAQs' },
  { app: 'terminal', label: 'Cases' },
  { app: 'photos', label: 'VIP' },
]

/** A shrug, in ms: the card goes and the mark has the bare table, the next
 * lands (and ticks), it can be shrugged off in its turn, and the table is cleared. */
const LANDS = 540
const READY = 640
const CLEARED = 1000

function Card({ deal, state, side }: { deal: Deal; state: 'rest' | 'in' | 'out'; side: number }) {
  const person = PEOPLE[deal.index]!
  const quote = useRef<HTMLQuoteElement>(null)
  const [clipped, setClipped] = useState(false)
  const [copied, setCopied] = useState(false)
  const words = person.quote ?? person.role

  // The quote is set as large as its card allows; one too long even at the
  // smallest size is cut short, and the corner opens the whole of it
  useLayoutEffect(() => {
    const el = quote.current
    if (!el) return
    let fits = false
    for (const size of SIZES) {
      el.style.fontSize = `${size}px`
      // A few words are set like a headline; a long answer like a paragraph
      el.dataset.set = size >= 24 ? 'large' : size >= 18 ? 'medium' : 'small'
      if (el.scrollHeight <= el.clientHeight + 1 && el.scrollWidth <= el.clientWidth + 1) {
        fits = true
        break
      }
    }
    setClipped(!fits)
  }, [words])

  const open = () => openSheet(`person:${deal.index}`)

  return (
    <article className="v7__card" data-state={state} style={{ '--side': side } as CSSProperties} aria-label={`${person.name}, ${person.role}`} {...(state === 'out' ? ({ inert: '', 'aria-hidden': true } as object) : null)}>
      <div className="v7__lean">
        <header className="v7__who">
          <PersonAvatar index={deal.index} size={46} />
          <div className="v7__name">
            <b>{person.name}</b>
            <span>{person.role}</span>
          </div>
          <button type="button" className="v7__corner" aria-label={`More about ${person.name}`} onClick={open}>
            <ArrowUpRight size={18} strokeWidth={2.4} aria-hidden />
          </button>
        </header>
        <blockquote ref={quote} className="v7__quote" data-clipped={clipped || undefined}>
          {words}
        </blockquote>
        <footer className="v7__foot">
          {clipped ? (
            <button type="button" className="v7__more" onClick={open}>
              Read all of it
            </button>
          ) : (
            <span className="v7__tags">
              {relationsOf(deal.index).map((label) => (
                <span key={label}>{label}</span>
              ))}
            </span>
          )}
          <button
            type="button"
            className="v7__share"
            aria-label={copied ? 'Copied' : `Share what ${person.name} said`}
            onClick={async () => {
              haptic()
              if ((await share({ title: GROUP_NAME, text: `“${words}” ${person.name}, ${person.role}` })) !== 'copied') return
              setCopied(true)
              setTimeout(() => setCopied(false), 1600)
            }}
          >
            {copied ? <Check size={17} strokeWidth={2.6} aria-hidden /> : <Share size={16} strokeWidth={2.2} aria-hidden />}
          </button>
        </footer>
      </div>
    </article>
  )
}

export default function V7({ active }: { active: boolean }) {
  const root = useRef<HTMLDivElement>(null)
  const [now, setNow] = useState<Deal>({ index: 0, n: 0 })
  const [gone, setGone] = useState<Deal | null>(null)
  const [count, setCount] = useState(1)
  /** ask: the phone has to be asked first. on: it is telling us how it moves. off: there is nothing to ask, or it said no. */
  const [motion, setMotion] = useState<'ask' | 'on' | 'off'>(() => (motionNeedsAsking() ? 'ask' : hasMotion() ? 'on' : 'off'))
  const heard = useRef(new Set([0]))
  const busy = useRef(false)
  const dealt = useRef(now)
  dealt.current = now
  /** How the phone is held, as last reported: null until it has said anything. */
  const held = useRef<{ x: number; y: number } | null>(null)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const still = prefersReducedMotion()

  /** Another answer: from someone not yet heard, until everyone has been. */
  const shrug = useCallback(() => {
    if (busy.current) return
    const was = dealt.current
    let pool = PEOPLE.map((_, i) => i).filter((i) => !heard.current.has(i))
    if (!pool.length) {
      // Everyone has been heard: round again, from anyone but the one showing
      heard.current = new Set()
      pool = PEOPLE.map((_, i) => i).filter((i) => i !== was.index)
    }
    const index = pool[Math.floor(Math.random() * pool.length)]!
    heard.current.add(index)
    setCount(heard.current.size)
    setNow({ index, n: was.n + 1 })
    haptic(8)
    if (still) return
    busy.current = true
    setGone(was)
    // A shrug before the last one was cleared away takes over from it
    timers.current.forEach(clearTimeout)
    timers.current = [
      setTimeout(() => haptic(16), LANDS),
      setTimeout(() => (busy.current = false), READY),
      setTimeout(() => setGone(null), CLEARED),
    ]
  }, [still])

  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  // The phone's own word on how it is held and moved, while this is in front
  useEffect(() => {
    if (!active || motion !== 'on') return
    const stopHeld = watchHeld((h) => (held.current = { x: h.x, y: h.y }))
    const stopShake = watchShake(shrug, 12)
    return () => {
      stopHeld()
      stopShake()
    }
  }, [active, motion, shrug])

  // The backdrop and the card ease toward how the phone is held, every frame.
  // Until the phone says anything they drift a little by themselves.
  useEffect(() => {
    const el = root.current
    if (!el || !active || still) return
    let frame = 0
    let x = 0
    let y = 0
    let wrote = { x: NaN, y: NaN }
    const tick = (t: number) => {
      const to = held.current ?? { x: Math.sin(t / 2700) * 0.32, y: Math.cos(t / 3500) * 0.26 }
      x += (to.x - x) * 0.085
      y += (to.y - y) * 0.085
      if (Math.abs(x - wrote.x) > 0.0015 || Math.abs(y - wrote.y) > 0.0015 || Number.isNaN(wrote.x)) {
        el.style.setProperty('--tx', x.toFixed(4))
        el.style.setProperty('--ty', y.toFixed(4))
        wrote = { x, y }
      }
      frame = requestAnimationFrame(tick)
    }
    const seen = () => {
      cancelAnimationFrame(frame)
      if (!document.hidden) frame = requestAnimationFrame(tick)
    }
    seen()
    document.addEventListener('visibilitychange', seen)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('visibilitychange', seen)
    }
  }, [active, still])

  /** A tap anywhere on the card that isn't one of its buttons is a shrug. */
  const onDeck = (e: MouseEvent) => {
    if (!(e.target as HTMLElement).closest('button, a')) shrug()
  }

  return (
    <div ref={root} className="v7" data-motion={motion}>
      <div className="v7__sky" aria-hidden>
        <i className="v7__glow" />
        <i className="v7__sheet v7__sheet--a" />
        <i className="v7__sheet v7__sheet--b" />
        <i className="v7__sheet v7__sheet--c" />
        <i className="v7__sheet v7__sheet--d" />
        <i className="v7__sheet v7__sheet--e" />
      </div>

      <header className="v7__top">
        <p className="v7__by">Niv, to {GROUP_NAME}</p>
        <h2 className="v7__ask">
          {QUESTION[0]} {QUESTION[1]}
        </h2>
        <p className="v7__count" role="status">
          <b>{count}</b> of {TOTAL} heard
          <span className="sr-only">
            : {PEOPLE[now.index]!.name}, {PEOPLE[now.index]!.role}
          </span>
        </p>
      </header>

      <div className="v7__deck" onClick={onDeck}>
        {/* In the order they are stacked: the mark on the bare table, the answer landing over it, the old one going over both */}
        {gone && (
          <div key={`mark-${gone.n}`} className="v7__mark" aria-hidden>
            {SITE.mark}
          </div>
        )}
        <Card key={now.n} deal={now} state={now.n === 0 || still ? 'rest' : 'in'} side={now.n % 2 ? 1 : -1} />
        {gone && <Card key={`out-${gone.n}`} deal={gone} state="out" side={gone.n % 2 ? -1 : 1} />}
      </div>

      <div className="v7__act">
        <div className="v7__buttons">
          {motion === 'ask' && (
            <button
              type="button"
              className="v7__button v7__button--on"
              onClick={async () => {
                haptic()
                setMotion((await askMotion()) ? 'on' : 'off')
              }}
            >
              Turn on shrugging
            </button>
          )}
          <button type="button" className="v7__button" onClick={shrug}>
            Shrug {motion === 'ask' ? '' : SITE.mark}
          </button>
        </div>
        <p className="v7__hint">{motion === 'on' ? 'Shrug your phone for another answer. Or tap the card.' : motion === 'ask' ? 'Your phone has to be asked before it can feel a shrug.' : 'Tap the card for another answer.'}</p>
      </div>

      <nav className="v7__doors" aria-label="The rest of Shrug">
        {DOORS.map((door) => (
          <button key={door.app} type="button" className="v7__door" onClick={() => openApp(door.app)}>
            <span className="v7__door-icon" data-shot={door.app}>
              <AppIcon id={door.app} />
            </span>
            <span>{door.label}</span>
          </button>
        ))}
        <a className="v7__door" href={SITE.onePager} target="_blank" rel="noreferrer" aria-label="One-pager (opens in a new tab)">
          <span className="v7__door-icon v7__door-icon--doc">
            <DocumentIcon />
          </span>
          <span>One-pager</span>
        </a>
      </nav>
    </div>
  )
}
