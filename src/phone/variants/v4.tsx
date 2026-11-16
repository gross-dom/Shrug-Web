import '../../styles/variants/v4.css'
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'
import { ArrowUpRight, Check, FileText, Heart, Image as ImageIcon, Play, Search, Share, X } from 'lucide-react'
import { QUESTION, TOTAL } from '../../apps/chat'
import { GROUP_NAME, PersonAvatar } from '../../apps/chat-ui'
import { companyNamed, CompanyLogo, visitLabel } from '../../apps/portfolio-ui'
import { term, TerminalLog } from '../../apps/Terminal'
import { ShrugAvatar } from '../../apps/ui'
import { CASE_STUDIES } from '../../data/caseStudies'
import { DROPS, MEDIA } from '../../data/drops'
import { ANSWER_PLACEHOLDER, FAQS } from '../../data/faqs'
import { PEOPLE } from '../../data/people'
import { COMPANY_COUNT, VERTICALS } from '../../data/portfolio'
import { SITE } from '../../data/site'
import { prefersReducedMotion } from '../../os/dom'
import { AppIcon } from '../../os/icons'
import { useStore } from '../../os/store'
import { openApp, openSheet } from '../nav'
import { haptic, share } from '../native'

// Version 4, stories: everyone in the family is a ring. Tap one and what they
// said fills the screen; tap on for the next, hold to read, swipe sideways for
// the next person, swipe down to put it away. The rest of the site is the
// highlights: the portfolio a vertical at a time, the questions, the case
// studies, the drops.

type Slide =
  /** One of Niv's own lines. */
  | { kind: 'line'; text: string }
  | { kind: 'quote'; person: number }
  | { kind: 'company'; name: string }
  | { kind: 'faq'; index: number }
  | { kind: 'cases' }
  | { kind: 'media'; index: number }

type App = 'finder' | 'notes' | 'terminal' | 'photos'

interface Reel {
  id: string
  name: string
  sub: string
  slides: Slide[]
  /** A person, whose card opens from the name at the top. */
  person?: number
  /** A part of the site, drawn as the app it is on a desktop. */
  app?: App
}

type List = 'people' | 'highlights'

/** Niv, then everyone, in the order they answered. */
const PEOPLE_REELS: Reel[] = [
  { id: 'niv', name: 'Niv', sub: GROUP_NAME, slides: QUESTION.map((text) => ({ kind: 'line', text })) },
  ...PEOPLE.map((p, i): Reel => ({ id: `p-${i}`, name: p.name, sub: p.role, slides: [{ kind: 'quote', person: i }], person: i })),
]

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** The rest of the site, as highlights: each vertical, then the questions, the case studies, the drops. */
const HIGHLIGHT_REELS: Reel[] = [
  ...VERTICALS.map((v): Reel => ({ id: `v-${v.name}`, name: v.name, sub: `Portfolio · ${count(v.companies.length, 'company', 'companies')}`, app: 'finder', slides: v.companies.map((c) => ({ kind: 'company', name: c.name })) })),
  { id: 'faqs', name: 'FAQs', sub: count(FAQS.length, 'question', 'questions'), app: 'notes', slides: FAQS.map((_, index) => ({ kind: 'faq', index })) },
  { id: 'cases', name: 'Case studies', sub: `${CASE_STUDIES.length} private`, app: 'terminal', slides: [{ kind: 'cases' }] },
  { id: 'vip', name: 'VIP', sub: count(DROPS.length, 'drop', 'drops'), app: 'photos', slides: MEDIA.map((_, index) => ({ kind: 'media', index })) },
]

const LISTS: Record<List, Reel[]> = { people: PEOPLE_REELS, highlights: HIGHLIGHT_REELS }

/** The colour a story is set on: Niv's on the wallpaper, the terminal's on the dark, the rest in turn. */
const sheetOf = (list: List, index: number, reel: Reel) => (reel.id === 'niv' ? 'wall' : reel.id === 'cases' ? 'night' : String((list === 'people' ? index - 1 : index) % 6))

function Face({ reel, size }: { reel: Reel; size: number }) {
  if (reel.person !== undefined) return <PersonAvatar index={reel.person} size={size} />
  if (!reel.app) return <ShrugAvatar size={size} />
  return (
    <span className="v4-app" style={{ width: size, height: size }}>
      <AppIcon id={reel.app} />
    </span>
  )
}

/** How long a slide stays: longer for more to read. */
function stay(slide: Slide) {
  switch (slide.kind) {
    case 'quote':
      return Math.max(4000, Math.min(12000, 2200 + (PEOPLE[slide.person]!.quote?.length ?? 0) * 30))
    case 'line':
      return 3400
    case 'faq':
      return 6500
    case 'cases':
      return 10000
    case 'media':
      return 4200
    default:
      return 5200
  }
}

const startSize = (chars: number) => (chars <= 60 ? 46 : chars <= 100 ? 40 : chars <= 150 ? 34 : chars <= 230 ? 29 : chars <= 340 ? 25 : chars <= 480 ? 22 : chars <= 640 ? 19 : 17)

/** Words set as large as the room they have allows. */
function Fit({ text, className }: { text: string; className: string }) {
  const ref = useRef<HTMLQuoteElement>(null)
  const [room, setRoom] = useState(0)
  // A turned or resized screen is different room to fit
  useEffect(() => {
    const again = () => setRoom((n) => n + 1)
    window.addEventListener('resize', again)
    return () => window.removeEventListener('resize', again)
  }, [])
  useLayoutEffect(() => {
    const el = ref.current
    const box = el?.parentElement
    if (!el || !box) return
    const pad = getComputedStyle(box)
    const free = box.clientHeight - parseFloat(pad.paddingTop) - parseFloat(pad.paddingBottom)
    // A narrow phone starts smaller; from there, down until it fits
    let size = Math.round(startSize(text.length) * Math.max(0.8, Math.min(1.06, box.clientWidth / 390)))
    el.style.fontSize = `${size}px`
    while (size > 12 && el.offsetHeight > free) el.style.fontSize = `${--size}px`
  }, [text, room])
  return (
    <blockquote ref={ref} className={className} data-long={text.length > 300 || undefined}>
      {text}
    </blockquote>
  )
}

function SlideView({ slide, at, of }: { slide: Slide; at: number; of: number }) {
  const requested = useStore(term, (t) => t.step === 'done')
  switch (slide.kind) {
    case 'line':
      return (
        <div className="v4-slide">
          <Fit className="v4-quote v4-quote--line" text={slide.text} />
        </div>
      )
    case 'quote':
      return (
        <div className="v4-slide">
          <Fit className="v4-quote" text={PEOPLE[slide.person]!.quote ?? ''} />
        </div>
      )
    case 'company': {
      const company = companyNamed(slide.name)!
      const visit = visitLabel(company)
      return (
        <div className="v4-slide v4-slide--center">
          <CompanyLogo company={company} size={112} />
          <h3 className="v4-title">{company.name}</h3>
          {company.blurb && <p className="v4-text">{company.blurb}</p>}
          {company.url && visit && (
            <a className="v4-pill" href={company.url} target="_blank" rel="noreferrer">
              {visit}
              <ArrowUpRight size={17} strokeWidth={2.4} aria-hidden />
            </a>
          )}
        </div>
      )
    }
    case 'faq': {
      const faq = FAQS[slide.index]!
      return (
        <div className="v4-slide v4-slide--faq">
          <p className="v4-kicker">
            Question {at + 1} of {of}
          </p>
          <h3 className="v4-title v4-title--question">{faq.question}</h3>
          {faq.answer ? <p className="v4-text v4-text--answer">{faq.answer}</p> : <p className="v4-todo">{ANSWER_PLACEHOLDER}</p>}
        </div>
      )
    }
    case 'cases':
      return (
        <div className="v4-slide v4-slide--cases">
          <div className="v4-term term ss-term">
            <TerminalLog />
          </div>
          {requested ? (
            <p className="v4-pill v4-pill--done" role="status">
              <Check size={18} strokeWidth={2.8} aria-hidden />
              Request noted
            </p>
          ) : (
            <button type="button" className="v4-pill" onClick={() => openSheet('request')}>
              Request access
            </button>
          )}
        </div>
      )
    case 'media': {
      const slot = MEDIA[slide.index]!
      return (
        <div className="v4-slide v4-slide--center">
          <figure className="v4-slot" data-kind={slot.kind}>
            {slot.src ? (
              slot.kind === 'video' ? (
                <video src={slot.src} playsInline muted autoPlay loop />
              ) : (
                <img src={slot.src} alt={`${slot.drop}${slot.from ? `, from ${slot.from}` : ''}`} draggable={false} />
              )
            ) : (
              <span className="v4-slot__empty">
                {slot.kind === 'video' ? <Play size={26} strokeWidth={1.6} aria-hidden /> : <ImageIcon size={26} strokeWidth={1.6} aria-hidden />}
                {slot.kind === 'video' ? 'Video slot' : 'Photo slot'}
              </span>
            )}
            <figcaption>
              <b>{slot.from ?? '[Name]'}</b>
              <span>{slot.drop}</span>
            </figcaption>
          </figure>
        </div>
      )
    }
  }
}

/** What a slide says, for sending it on. */
function words(reel: Reel, slide: Slide) {
  if (slide.kind === 'quote') return `“${PEOPLE[slide.person]!.quote}” ${reel.name}, ${reel.sub}`
  if (slide.kind === 'line') return QUESTION.join(' ')
  if (slide.kind === 'company') return [slide.name, companyNamed(slide.name)?.blurb].filter(Boolean).join(': ')
  if (slide.kind === 'faq') return FAQS[slide.index]!.question
  return `${GROUP_NAME}: ${reel.name}`
}

/** One story, whole: its bars, whose it is, what it says, what can be done with it. */
function Panel({
  reel,
  list,
  index,
  slide,
  place,
  fill,
  hint,
  loved,
  said,
  stopped,
  onStop,
  onClose,
  onLove,
  onShare,
  onStep,
}: {
  reel: Reel
  list: List
  index: number
  slide: number
  /** The one on screen (0), or the one waiting to either side of it. */
  place: -1 | 0 | 1
  fill?: RefObject<HTMLSpanElement>
  hint?: boolean
  loved?: boolean
  said?: boolean
  stopped?: boolean
  onStop?: () => void
  onClose?: () => void
  onLove?: () => void
  onShare?: () => void
  onStep?: (by: 1 | -1) => void
}) {
  const here = place === 0
  const who = (
    <>
      <Face reel={reel} size={36} />
      <span className="v4-who__text">
        <b>{reel.name}</b>
        <span>{reel.sub}</span>
      </span>
    </>
  )
  return (
    <section className={`v4-panel${reel.id === 'niv' ? ' ph-wallpaper' : ''}`} data-at={place} data-sheet={sheetOf(list, index, reel)} aria-hidden={!here || undefined} {...(here ? null : ({ inert: '' } as object))}>
      <div className="v4-bars" aria-hidden>
        {reel.slides.map((_, i) => (
          <span key={i} className="v4-bar" data-done={(here && i < slide) || undefined}>
            {here && i === slide && <span ref={fill} className="v4-bar__fill" />}
          </span>
        ))}
      </div>
      <header className="v4-who">
        {reel.person !== undefined ? (
          <button type="button" className="v4-who__id" aria-label={`About ${reel.name}`} onClick={() => openSheet(`person:${reel.person}`)}>
            {who}
          </button>
        ) : (
          <div className="v4-who__id">{who}</div>
        )}
        <button type="button" className="v4-close" aria-label="Close" onClick={onClose}>
          <X size={24} strokeWidth={2.3} aria-hidden />
        </button>
      </header>
      <div className="v4-stage">
        <SlideView key={slide} slide={reel.slides[slide]!} at={slide} of={reel.slides.length} />
      </div>
      {hint && here && (
        <p className="v4-hint" aria-hidden>
          Tap for the next · hold to pause · swipe down to close
        </p>
      )}
      <footer className="v4-acts">
        <span className="v4-acts__where">{list === 'people' ? (index === 0 ? `${TOTAL} replies follow` : `${index} of ${TOTAL}`) : `${slide + 1} of ${reel.slides.length}`}</span>
        {onStop && (
          <button type="button" className="sr-only" aria-pressed={!!stopped} onClick={onStop}>
            Pause
          </button>
        )}
        <button type="button" className="sr-only" onClick={() => onStep?.(-1)}>
          Previous story
        </button>
        <button type="button" className="sr-only" onClick={() => onStep?.(1)}>
          Next story
        </button>
        <button type="button" className="v4-act" aria-label="Love this" aria-pressed={!!loved} onClick={onLove}>
          <Heart size={24} strokeWidth={2.1} fill={loved ? 'currentColor' : 'none'} aria-hidden />
        </button>
        <button type="button" className="v4-act" aria-label={said ? 'Link copied' : 'Share this'} onClick={onShare}>
          {said ? <Check size={23} strokeWidth={2.5} aria-hidden /> : <Share size={22} strokeWidth={2.1} aria-hidden />}
        </button>
      </footer>
      {/* The side of the box turned away from the light */}
      <span className="v4-shade" aria-hidden />
    </section>
  )
}

/** How far a story has to be dragged, or how fast flicked (px a millisecond), to go. */
const AWAY = { down: 110, across: 70, flick: 0.5 }
/** How long the turn from one person to the next takes, and the way out. */
const TURN = 340
const OUT = 300

/** Whether the gestures have been shown yet: once is enough. */
let hinted = false

interface Press {
  id: number
  x: number
  y: number
  t: number
  mode: '' | 'down' | 'across'
  /** How far it has been dragged along its way, after any give at an end. */
  d: number
  /** How fast, smoothed. */
  v: number
  last: number
  w: number
}

/** A place on the stage: the middle of something, and how wide it is as a share of the stage. */
interface Spot {
  x: number
  y: number
  scale: number
}

function Viewer({
  start,
  active,
  loved,
  onLove,
  onSeen,
  onClose,
  landing,
}: {
  start: { list: List; reel: number; from: Spot | null }
  active: boolean
  loved: string[]
  onLove: (key: string) => void
  onSeen: (id: string) => void
  onClose: () => void
  /** Where a story goes back to: the ring it belongs to, brought into view. */
  landing: (list: List, reel: number) => Spot | null
}) {
  const [at, setAt] = useState({ list: start.list, reel: start.reel, slide: 0, turn: 0 })
  const [held, setHeld] = useState(false)
  /** Held long enough that it is being read: everything but the words steps back. */
  const [reading, setReading] = useState(false)
  const [turning, setTurning] = useState(false)
  const [closing, setClosing] = useState(false)
  const [said, setSaid] = useState(false)
  /** Stopped by its own button, for anyone who can't hold a finger down. */
  const [stopped, setStopped] = useState(false)
  const [hint, setHint] = useState(!hinted)
  const root = useRef<HTMLDivElement>(null)
  const deck = useRef<HTMLDivElement>(null)
  const fill = useRef<HTMLSpanElement>(null)
  const elapsed = useRef(0)
  const press = useRef<Press | null>(null)
  /** Mid-turn or settling: nothing else starts until it is done. */
  const busy = useRef(false)
  /** The turn in the air, and a tap that came during it, to follow when it lands. */
  const flight = useRef<{ by: 1 | -1; land: () => void; timer: number } | null>(null)
  const queued = useRef<0 | 1 | -1>(0)
  const reads = useRef(0)
  const waits = useRef<number[]>([])
  const born = useRef(performance.now())

  const reels = LISTS[at.list]
  const reel = reels[at.reel]!
  const slide = reel.slides[at.slide]!
  const key = `${reel.id}/${at.slide}`
  const still = prefersReducedMotion()

  const later = (run: () => void, ms: number) => void waits.current.push(window.setTimeout(run, ms))
  useEffect(
    () => () => {
      waits.current.forEach((id) => clearTimeout(id))
      clearTimeout(flight.current?.timer)
      clearTimeout(reads.current)
    },
    [],
  )

  const panels = () => Array.from(deck.current?.children ?? []) as HTMLElement[]

  /** The three stories as faces of a box, turned p of a quarter turn: at -1 the next has come all the way round. */
  const turn = (p: number, ms = 0) => {
    for (const el of panels()) {
      // A face never turns past edge-on: beyond that it would show its back
      const k = Math.max(-1, Math.min(1, Number(el.dataset.at) + p))
      const shade = el.lastElementChild as HTMLElement
      el.style.transition = ms ? `transform ${ms}ms cubic-bezier(0.3, 0.75, 0.1, 1)` : 'none'
      shade.style.transition = ms ? `opacity ${ms}ms linear` : 'none'
      el.style.visibility = ms || Math.abs(k) < 1 ? 'visible' : 'hidden'
      // Each hinges on the edge it shares with the one beside it
      if (k) el.style.transformOrigin = k > 0 ? '0 50%' : '100% 50%'
      el.style.transform = `translateX(${(k * 100).toFixed(2)}%) rotateY(${(k * 90).toFixed(2)}deg)`
      shade.style.opacity = (Math.abs(k) * 0.5).toFixed(3)
    }
  }

  /** Back to how they stand at rest: one on screen, the others out of sight. */
  const rest = () => {
    for (const el of panels()) {
      const shade = el.lastElementChild as HTMLElement
      el.style.transition = 'none'
      el.style.transform = ''
      el.style.visibility = ''
      shade.style.transition = 'none'
      shade.style.opacity = ''
    }
  }

  const done = () => {
    hinted = true
    setHint(false)
  }

  const close = () => {
    if (closing) return
    setClosing(true)
    done()
    if (still) return onClose()
    const el = deck.current
    const box = root.current
    if (el && box) {
      // Back into the ring it belongs to, wherever that has got to
      const to = landing(at.list, at.reel)
      const w = box.clientWidth
      const h = box.clientHeight
      el.style.transition = `transform ${OUT}ms cubic-bezier(0.4, 0, 0.6, 1), opacity ${OUT}ms cubic-bezier(0.6, 0, 0.9, 0.5), border-radius ${OUT}ms ease`
      el.style.transform = to ? `translate(${(to.x - w / 2).toFixed(1)}px, ${(to.y - h / 2).toFixed(1)}px) scale(${Math.max(0.1, to.scale).toFixed(3)})` : `translateY(${Math.round(h * 0.6)}px) scale(0.8)`
      el.style.opacity = '0'
      el.style.borderRadius = '56px'
    }
    later(onClose, OUT)
  }

  /** The reel to one side: turned to, as the next face of the box. */
  const go = (by: 1 | -1, from = 0) => {
    if (busy.current) return
    if (!reels[at.reel + by]) {
      // Nobody after the last: that is the end of it. Nobody before the first: it starts again.
      if (from) turn(0, 200)
      if (by === 1) close()
      else setAt((v) => ({ ...v, slide: 0, turn: v.turn + 1 }))
      return
    }
    done()
    const land = () => {
      flight.current = null
      setAt((v) => ({ ...v, reel: v.reel + by, slide: 0, turn: 0 }))
      setTurning(false)
    }
    if (still) return land()
    busy.current = true
    setTurning(true)
    if (!from) {
      turn(0)
      void deck.current?.offsetWidth
    }
    const ms = Math.max(180, Math.round(TURN * (1 - Math.abs(from))))
    turn(-by, ms)
    flight.current = { by, land, timer: window.setTimeout(land, ms + 30) }
  }

  /** A tap while the box is still turning: the turn hurries, and the tap follows it. */
  const hurry = (by: 1 | -1) => {
    const f = flight.current
    if (!f || queued.current) return
    queued.current = by
    clearTimeout(f.timer)
    turn(-f.by, 110)
    f.timer = window.setTimeout(f.land, 120)
  }

  /** The next slide; after a reel's last, the next reel. */
  const step = (by: 1 | -1) => {
    if (closing) return
    if (busy.current) return hurry(by)
    done()
    if (by === 1 && at.slide < reel.slides.length - 1) return setAt((v) => ({ ...v, slide: v.slide + 1 }))
    if (by === -1 && at.slide > 0) return setAt((v) => ({ ...v, slide: v.slide - 1 }))
    go(by)
  }

  // A new reel on screen: the faces stand at rest again, and a tap that was waiting for it goes on
  useLayoutEffect(() => {
    rest()
    busy.current = false
    const by = queued.current
    queued.current = 0
    if (by) step(by)
  }, [at.list, at.reel]) // eslint-disable-line react-hooks/exhaustive-deps

  // The next company's logo is fetched while this one is read
  useEffect(() => {
    const next = reel.slides[at.slide + 1]
    const logo = next?.kind === 'company' ? companyNamed(next.name)?.logo : null
    if (logo) new Image().src = `${import.meta.env.BASE_URL}logos/${logo}`
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    onSeen(reel.id)
  }, [reel.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // A slide starts from nothing
  useLayoutEffect(() => {
    elapsed.current = 0
    if (fill.current) fill.current.style.transform = 'scaleX(0)'
  }, [key, at.turn])

  // Its bar fills while nothing holds it; full, it moves on. With motion turned down it waits to be tapped.
  const paused = held || stopped || turning || closing || !active || still
  useEffect(() => {
    if (paused) return
    const total = stay(slide)
    let frame = 0
    let last = performance.now()
    const tick = (now: number) => {
      // A tab left in the background doesn't run its stories down
      if (!document.hidden) elapsed.current += Math.min(100, now - last)
      last = now
      const part = Math.min(1, elapsed.current / total)
      if (fill.current) fill.current.style.transform = `scaleX(${part.toFixed(4)})`
      if (part >= 1) return step(1)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [key, at.turn, paused]) // eslint-disable-line react-hooks/exhaustive-deps

  // It takes the keyboard while it is up, and keys do what taps do
  useEffect(() => {
    root.current?.focus({ preventScroll: true })
  }, [])
  useEffect(() => {
    if (!active) return
    const on = (e: KeyboardEvent) => {
      const control = (e.target as HTMLElement | null)?.closest?.('button, a')
      if (e.key === 'Escape') close()
      else if (e.key === 'ArrowRight' || (e.key === ' ' && !control)) step(1)
      else if (e.key === 'ArrowLeft') step(-1)
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  })

  /** Let go short of going anywhere: back to where it was. */
  const settle = (mode: 'down' | 'across') => {
    if (still) return
    busy.current = true
    if (mode === 'down') {
      const el = deck.current
      if (el) {
        el.style.transition = 'transform 0.3s cubic-bezier(0.3, 0.75, 0.1, 1), border-radius 0.3s ease'
        el.style.transform = ''
        el.style.borderRadius = ''
      }
      root.current?.style.removeProperty('--dim')
    } else turn(0, 240)
    later(() => {
      if (mode === 'across') rest()
      busy.current = false
    }, 250)
  }

  const down = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (closing || press.current || (e.pointerType === 'mouse' && e.button !== 0)) return
    if ((e.target as HTMLElement).closest('button, a')) return
    // The second tap of a double tap on a ring is not a tap on the story it opened
    if (performance.now() - born.current < 360) return
    if (busy.current) {
      // Tapping on through people faster than the box turns
      const box = e.currentTarget.getBoundingClientRect()
      return hurry(e.clientX - box.left < box.width * 0.3 ? -1 : 1)
    }
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // The finger has already gone
    }
    press.current = { id: e.pointerId, x: e.clientX, y: e.clientY, t: e.timeStamp, mode: '', d: 0, v: 0, last: e.timeStamp, w: e.currentTarget.clientWidth || 1 }
    setHeld(true)
    reads.current = window.setTimeout(() => setReading(true), 240)
  }

  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    const p = press.current
    if (!p || e.pointerId !== p.id) return
    const dx = e.clientX - p.x
    const dy = e.clientY - p.y
    if (!p.mode) {
      if (Math.abs(dx) < 9 && Math.abs(dy) < 9) return
      p.mode = Math.abs(dy) > Math.abs(dx) ? 'down' : 'across'
      clearTimeout(reads.current)
      setReading(false)
      if (p.mode === 'down') root.current?.setAttribute('data-pull', '')
    }
    const dt = Math.max(1, e.timeStamp - p.last)
    // At either end there is nobody further: it gives, but not far. Upwards there is nothing at all.
    const d = p.mode === 'down' ? (dy > 0 ? dy : dy * 0.12) : (dx > 0 && !reels[at.reel - 1]) || (dx < 0 && !reels[at.reel + 1]) ? dx * 0.28 : dx
    p.v = p.v * 0.5 + ((d - p.d) / dt) * 0.5
    p.d = d
    p.last = e.timeStamp
    // With motion turned down it is read when the finger lifts, and nothing follows it about
    if (still) return
    if (p.mode === 'across') return turn(Math.max(-1, Math.min(1, d / p.w)))
    const el = deck.current
    const far = Math.max(0, d)
    if (el) {
      // It comes away under the finger, a little smaller, with everyone showing behind
      el.style.transition = 'none'
      el.style.transform = `translateY(${d.toFixed(1)}px) scale(${(1 - Math.min(0.16, far / 1800)).toFixed(4)})`
      el.style.borderRadius = `${Math.min(40, far / 3).toFixed(1)}px`
    }
    root.current?.style.setProperty('--dim', Math.max(0.3, 1 - far / 480).toFixed(3))
  }

  const up = (e: ReactPointerEvent<HTMLDivElement>) => {
    const p = press.current
    if (!p || e.pointerId !== p.id) return
    press.current = null
    clearTimeout(reads.current)
    setHeld(false)
    setReading(false)
    root.current?.removeAttribute('data-pull')
    if (e.type === 'pointercancel') return p.mode ? settle(p.mode) : undefined
    // A drag that stopped before it was let go is not a flick
    const flick = e.timeStamp - p.last < 90 ? p.v : 0
    if (p.mode === 'down') {
      if (p.d > AWAY.down || (p.d > 24 && flick > AWAY.flick)) return close()
      return settle('down')
    }
    if (p.mode === 'across') {
      const by = p.d < 0 ? 1 : -1
      const far = Math.abs(e.clientX - p.x) > Math.min(AWAY.across, p.w * 0.2) || (Math.abs(p.d) > 16 && flick * -by > AWAY.flick)
      if (!far || (by === -1 && !reels[at.reel - 1])) return settle('across')
      haptic()
      return go(by, still ? 0 : Math.max(-1, Math.min(1, p.d / p.w)))
    }
    // Held long enough to have been reading: not a tap
    if (e.timeStamp - p.t > 320) return
    const box = e.currentTarget.getBoundingClientRect()
    step(e.clientX - box.left < box.width * 0.3 ? -1 : 1)
  }

  // It opens out of whatever was tapped, from that size
  const origin = start.from ? ({ '--ox': `${start.from.x.toFixed(1)}px`, '--oy': `${start.from.y.toFixed(1)}px`, '--os': Math.max(0.12, Math.min(0.5, start.from.scale)).toFixed(3) } as CSSProperties) : undefined

  return (
    <div ref={root} className="v4-viewer" data-closing={closing || undefined} data-reading={reading || undefined} role="dialog" aria-modal="true" aria-label={`${reel.name}, ${reel.sub}. Story ${at.slide + 1} of ${reel.slides.length}.`} tabIndex={-1} style={origin}>
      <p className="sr-only" aria-live="polite">
        {reel.name}, {reel.sub}
      </p>
      <div ref={deck} className="v4-deck" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onContextMenu={(e) => e.preventDefault()}>
        {([-1, 0, 1] as const).map((d) => {
          const r = reels[at.reel + d]
          if (!r) return null
          if (d) return <Panel key={r.id} reel={r} list={at.list} index={at.reel + d} slide={0} place={d} />
          return (
            <Panel
              key={r.id}
              reel={r}
              list={at.list}
              index={at.reel}
              slide={at.slide}
              place={0}
              fill={fill}
              hint={hint}
              loved={loved.includes(key)}
              said={said}
              stopped={stopped}
              onStop={still ? undefined : () => setStopped((s) => !s)}
              onClose={close}
              onStep={step}
              onLove={() => {
                haptic()
                onLove(key)
              }}
              onShare={async () => {
                setHeld(true)
                const how = await share({ title: GROUP_NAME, text: words(reel, slide) })
                setHeld(false)
                if (how !== 'copied') return
                setSaid(true)
                later(() => setSaid(false), 1600)
              }}
            />
          )
        })}
      </div>
    </div>
  )
}

const first = (name: string) => name.split(' ')[0]!

function Ring({ reel, at, seen, loved, size, onOpen }: { reel: Reel; at: number; seen: boolean; loved: boolean; size: number; onOpen: (el: HTMLElement) => void }) {
  return (
    <button type="button" className="v4-ring" data-reel={`people:${at}`} data-seen={seen || undefined} aria-label={`${reel.name}, ${reel.sub}${seen ? '. Seen.' : ''}`} onClick={(e) => onOpen(e.currentTarget)}>
      <span className="v4-ring__halo" data-spot="" style={{ width: size + 10, height: size + 10 }}>
        <Face reel={reel} size={size} />
        {loved && (
          <span className="v4-ring__loved">
            <Heart size={11} strokeWidth={0} fill="currentColor" aria-hidden />
          </span>
        )}
      </span>
      <span className="v4-ring__name">{first(reel.name)}</span>
    </button>
  )
}

const ONLY_VERTICALS = VERTICALS.length

export default function V4({ active }: { active: boolean }) {
  const [seen, setSeen] = useState<string[]>([])
  const [loved, setLoved] = useState<string[]>([])
  const [open, setOpen] = useState<{ list: List; reel: number; from: Spot | null; n: number } | null>(null)
  const [copied, setCopied] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const opener = useRef<HTMLElement | null>(null)
  const turn = useRef(0)
  /** Whether the story on screen has a step of its own in the browser's history. */
  const stepped = useRef(false)

  /** Where something is on the stage: its face, if it has one marked. */
  const spot = (el: HTMLElement): Spot | null => {
    const stage = root.current?.getBoundingClientRect()
    if (!stage?.width) return null
    const box = (el.querySelector<HTMLElement>('[data-spot]') ?? el).getBoundingClientRect()
    return { x: box.left + box.width / 2 - stage.left, y: box.top + box.height / 2 - stage.top, scale: Math.min(box.width, box.height) / stage.width }
  }

  const show = (list: List, reel: number, el: HTMLElement) => {
    haptic()
    opener.current = el
    // A story is a step in the browser's history, as the pages and sheets are, so the phone's own back puts it away
    const entry = history.state as { n?: number } | null
    history.pushState({ ...entry, n: (entry?.n ?? 0) + 1, story: true }, '')
    stepped.current = true
    setOpen({ list, reel, from: spot(el), n: ++turn.current })
  }

  /** Put away by its own close, a swipe, or running out: the step it took is taken back. */
  const shut = () => {
    if (stepped.current) history.back()
    stepped.current = false
    setOpen(null)
  }

  // Put away by the browser's back: at once, as the browser has already moved
  const up = open !== null
  useEffect(() => {
    if (!up) return
    const onPop = (e: PopStateEvent) => {
      if ((e.state as { story?: boolean } | null)?.story) return
      stepped.current = false
      setOpen(null)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [up])

  /** The ring a story goes back into: brought into view along its row, if its row is on screen. */
  const landing = (list: List, reel: number): Spot | null => {
    const stage = root.current
    if (!stage) return null
    const edge = stage.getBoundingClientRect()
    for (const el of stage.querySelectorAll<HTMLElement>(`[data-reel="${list}:${reel}"]`)) {
      const row = el.closest<HTMLElement>('.v4-rail, .v4-shelf')
      if (row) row.scrollLeft += el.getBoundingClientRect().left + el.offsetWidth / 2 - (row.getBoundingClientRect().left + row.clientWidth / 2)
      const to = spot(el)
      if (to && to.y > 24 && to.y < edge.height - 24) return to
    }
    return null
  }

  // Put away, the keyboard goes back to what opened it
  useEffect(() => {
    if (!open) opener.current?.focus({ preventScroll: true })
  }, [open])

  const unseen = PEOPLE_REELS.filter((r, i) => i > 0 && !seen.includes(r.id)).length
  const next = unseen && unseen < TOTAL ? PEOPLE_REELS.findIndex((r, i) => i > 0 && !seen.includes(r.id)) : 0

  return (
    <div ref={root} className="v4">
      <div className="v4-home" {...(open ? ({ inert: '' } as object) : null)}>
        <header className="v4-top">
          <h2>{GROUP_NAME}</h2>
          <p>
            {TOTAL} replies · {COMPANY_COUNT} companies
          </p>
        </header>

        <div className="v4-rail" role="group" aria-label="Stories">
          {PEOPLE_REELS.map((reel, i) => (
            <Ring key={reel.id} reel={reel} at={i} seen={seen.includes(reel.id)} loved={loved.some((k) => k.startsWith(`${reel.id}/`))} size={62} onOpen={(el) => show('people', i, el)} />
          ))}
        </div>

        {/* Niv's question, and the way to watch everyone answer it */}
        <button type="button" className="v4-ask ph-wallpaper" onClick={(e) => show('people', next, e.currentTarget)}>
          <span className="v4-ask__who">
            <ShrugAvatar size={24} />
            Niv asked
          </span>
          <span className="v4-ask__line">{QUESTION[1]}</span>
          <span className="v4-ask__go">
            <Play size={12} fill="currentColor" strokeWidth={0} aria-hidden />
            {unseen === TOTAL ? `Watch all ${TOTAL} replies` : unseen ? `Watch the ${unseen} you haven’t seen` : 'Watch them again'}
          </span>
        </button>

        <div className="v4-label">
          <h3>Highlights</h3>
          <button type="button" className="v4-label__link" data-shot="finder" onClick={() => openApp('finder')}>
            <Search size={14} strokeWidth={2.6} aria-hidden />
            All {COMPANY_COUNT}
          </button>
        </div>
        <div className="v4-shelf" role="group" aria-label="Portfolio, by vertical">
          {VERTICALS.map((v, i) => {
            const reel = HIGHLIGHT_REELS[i]!
            // Four of its logos on the cover; the ones with no logo yet only if it comes to that
            const four = [...v.companies.filter((c) => c.logo), ...v.companies.filter((c) => !c.logo)].slice(0, 4)
            return (
              <button key={reel.id} type="button" className="v4-cover" data-reel={`highlights:${i}`} data-sheet={sheetOf('highlights', i, reel)} aria-label={`${v.name}: ${count(v.companies.length, 'company', 'companies')}`} onClick={(e) => show('highlights', i, e.currentTarget)}>
                <span className="v4-cover__logos">
                  {four.map((c) => (
                    <CompanyLogo key={c.name} company={c} size={40} />
                  ))}
                </span>
                <span className="v4-cover__text">
                  <b>{v.name}</b>
                  <span>{count(v.companies.length, 'company', 'companies')}</span>
                </span>
              </button>
            )
          })}
        </div>
        <div className="v4-tiles" role="group" aria-label="More highlights">
          {HIGHLIGHT_REELS.slice(ONLY_VERTICALS).map((reel, i) => (
            <button key={reel.id} type="button" className="v4-tile" data-reel={`highlights:${ONLY_VERTICALS + i}`} onClick={(e) => show('highlights', ONLY_VERTICALS + i, e.currentTarget)}>
              <span className="v4-tile__icon" data-spot="">
                <Face reel={reel} size={44} />
              </span>
              <b>{reel.name}</b>
              <span>{reel.sub}</span>
            </button>
          ))}
        </div>

        <div className="v4-label">
          <h3>Everyone</h3>
          <span>{TOTAL}</span>
        </div>
        <div className="v4-wall" role="group" aria-label="Everyone">
          {PEOPLE_REELS.slice(1).map((reel, i) => (
            <Ring key={reel.id} reel={reel} at={i + 1} seen={seen.includes(reel.id)} loved={loved.some((k) => k.startsWith(`${reel.id}/`))} size={54} onOpen={(el) => show('people', i + 1, el)} />
          ))}
        </div>

        <footer className="v4-end">
          <a className="v4-end__link" href={SITE.onePager} target="_blank" rel="noreferrer">
            <FileText size={17} strokeWidth={2.2} aria-hidden />
            One-pager
          </a>
          <button
            type="button"
            className="v4-end__link"
            onClick={async () => {
              if ((await share({ title: GROUP_NAME, text: QUESTION.join(' ') })) !== 'copied') return
              setCopied(true)
              setTimeout(() => setCopied(false), 1600)
            }}
          >
            {copied ? <Check size={17} strokeWidth={2.6} aria-hidden /> : <Share size={17} strokeWidth={2.2} aria-hidden />}
            {copied ? 'Link copied' : 'Share'}
          </button>
          <p className="v4-end__mark">
            <span aria-hidden>{SITE.mark}</span> {SITE.legalName}
          </p>
        </footer>
      </div>

      {open && <Viewer key={open.n} start={open} active={active} loved={loved} onLove={(key) => setLoved((l) => (l.includes(key) ? l.filter((k) => k !== key) : [...l, key]))} onSeen={(id) => setSeen((s) => (s.includes(id) ? s : [...s, id]))} onClose={shut} landing={landing} />}
    </div>
  )
}
