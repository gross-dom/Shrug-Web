import '../../styles/variants/v6.css'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { ArrowUpRight, Heart, RotateCcw, Share, Undo2, X } from 'lucide-react'
import { GROUP_NAME, PersonAvatar, relationsOf } from '../../apps/chat-ui'
import { ALL, CompanyLogo, visitLabel } from '../../apps/portfolio-ui'
import { ANSWER_PLACEHOLDER, FAQS } from '../../data/faqs'
import { PEOPLE } from '../../data/people'
import { SITE } from '../../data/site'
import { haptic, share } from '../native'
import { openApp, openSheet } from '../nav'

// Version 6: the deck. Ninety replies as a deck of cards on a table: pick the
// top one up and it follows the finger and turns with it; flick it right to
// keep it, left for the next, up to share it. The ones you keep are your hand,
// to look through and send on. There are two more decks, the companies and the
// questions (those turn over for their answers), and every flick has a button.

type DeckId = 'people' | 'companies' | 'questions'

const DECKS: { id: DeckId; label: string; count: number }[] = [
  { id: 'people', label: 'People', count: PEOPLE.length },
  { id: 'companies', label: 'Companies', count: ALL.length },
  { id: 'questions', label: 'Questions', count: FAQS.length },
]

const countOf = (deck: DeckId) => DECKS.find((d) => d.id === deck)!.count
const keyOf = (deck: DeckId, index: number) => `${deck}:${index}`
const nameOf = (deck: DeckId, index: number) => (deck === 'people' ? PEOPLE[index]!.name : deck === 'companies' ? ALL[index]!.name : FAQS[index]!.question)

/** What a card says when it is sent on. */
function wordsOf(deck: DeckId, index: number): { title: string; text: string; url?: string } {
  if (deck === 'people') {
    const p = PEOPLE[index]!
    return { title: GROUP_NAME, text: `“${p.quote ?? ''}” ${p.name}, ${p.role}.` }
  }
  if (deck === 'companies') {
    const c = ALL[index]!
    return { title: c.name, text: `${c.name}${c.blurb ? `: ${c.blurb}` : ''}`, url: c.url ?? undefined }
  }
  return { title: `${SITE.name} FAQs`, text: FAQS[index]!.question }
}

/** A card as a line of a list: for sending the hand on. */
function lineOf(key: string) {
  const [deck, raw] = key.split(':') as [DeckId, string]
  const index = Number(raw)
  if (deck === 'people') return `${PEOPLE[index]!.name}, ${PEOPLE[index]!.role}: “${PEOPLE[index]!.quote ?? ''}”`
  if (deck === 'companies') return `${ALL[index]!.name} (${ALL[index]!.vertical})${ALL[index]!.blurb ? `: ${ALL[index]!.blurb}` : ''}`
  return FAQS[index]!.question
}

/** Brings up the page about a card: the shared ones, over this version. */
function lookAt(deck: DeckId, index: number) {
  if (deck === 'people') openSheet(`person:${index}`)
  else if (deck === 'companies') openSheet(`company:${ALL[index]!.name}`)
}

const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v))

/** Each card has a colour of its own, from the wallpaper's. */
const TINTS = ['#3f8cff', '#8a6dff', '#ff66b8', '#ffc56e', '#ff5a3c', '#3fe0ee', '#2b55cf']
const tintOf = (index: number) => ({ '--tint': TINTS[index % TINTS.length] }) as CSSProperties

/** Shows one of a card's stamps (keep, next, send), or none. */
function stamp(card: HTMLElement, way: 'keep' | 'next' | 'send' | null, show = 1) {
  if (way) card.setAttribute('data-way', way)
  else card.removeAttribute('data-way')
  card.style.setProperty('--show', clamp(show).toFixed(3))
}

/** How far across a card has to be let go to leave, as a share of the deck's width. */
const FAR = 1 / 3
/** How far up it has to be let go to be sent on. */
const HIGH = 140

/** The biggest a card's words go, by how many of them there are. */
const sizeFor = (length: number) => (length <= 70 ? 40 : length <= 130 ? 32 : length <= 220 ? 26 : length <= 340 ? 21.5 : length <= 500 ? 18.5 : 16.5)
const LEAST = 14

/** Sets the words as large as fit their box, down to the least; past that they scroll inside it. */
function Quote({ words }: { words: string }) {
  const ref = useRef<HTMLQuoteElement>(null)
  const [over, setOver] = useState(false)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const tall = () => el.scrollHeight > el.clientHeight + 1
    const fit = () => {
      let size = sizeFor(words.length)
      el.style.fontSize = `${size}px`
      // A long word that pokes out of the side is a reason to go smaller too
      while (size > LEAST && (tall() || el.scrollWidth > el.clientWidth + 1)) {
        size -= 0.5
        el.style.fontSize = `${size}px`
      }
      setOver(tall())
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [words])
  return (
    <blockquote ref={ref} className="v6-quote" data-over={over || undefined} tabIndex={over ? 0 : undefined}>
      <span>{words}</span>
    </blockquote>
  )
}

// ---- The faces of the cards ----

function Face({ deck, index, flipped }: { deck: DeckId; index: number; flipped: boolean }) {
  if (deck === 'people') {
    const person = PEOPLE[index]!
    return (
      <div className="v6-face v6-face--person">
        <header className="v6-person">
          <PersonAvatar index={index} size={46} />
          <span className="v6-person__name">
            <b>{person.name}</b>
            <i>{person.role}</i>
          </span>
        </header>
        {person.relations.length > 0 && (
          <div className="v6-tags">
            {relationsOf(index).map((label) => (
              <em key={label}>{label}</em>
            ))}
          </div>
        )}
        <Quote words={person.quote ?? ''} />
        <footer className="v6-face__foot">
          <span>{GROUP_NAME}</span>
          <span>
            {index + 1} / {PEOPLE.length}
          </span>
        </footer>
      </div>
    )
  }
  if (deck === 'companies') {
    const company = ALL[index]!
    const visit = visitLabel(company)
    return (
      <div className="v6-face v6-face--company">
        <CompanyLogo company={company} size={96} />
        <p className="v6-company__kind">{company.vertical}</p>
        <h3 className="v6-company__name">{company.name}</h3>
        {company.blurb && <p className="v6-company__blurb">{company.blurb}</p>}
        {company.url && visit && (
          <a className="v6-company__visit" href={company.url} target="_blank" rel="noreferrer">
            {visit}
            <ArrowUpRight size={16} strokeWidth={2.4} aria-hidden />
          </a>
        )}
        <footer className="v6-face__foot">
          <span>Portfolio</span>
          <span>
            {index + 1} / {ALL.length}
          </span>
        </footer>
      </div>
    )
  }
  const faq = FAQS[index]!
  return (
    <div className="v6-flip" data-flipped={flipped || undefined}>
      <div className="v6-face v6-face--question" aria-hidden={flipped}>
        <p className="v6-question__n">
          Question {index + 1} of {FAQS.length}
        </p>
        <h3 className="v6-question__q">{faq.question}</h3>
        <p className="v6-question__hint">
          <RotateCcw size={14} strokeWidth={2.4} aria-hidden />
          Tap to turn it over
        </p>
      </div>
      <div className="v6-face v6-face--answer" aria-hidden={!flipped}>
        <p className="v6-question__back">{faq.question}</p>
        {faq.answer ? <p className="v6-question__a">{faq.answer}</p> : <p className="v6-question__todo">{ANSWER_PLACEHOLDER}</p>}
        <p className="v6-question__hint">
          <RotateCcw size={14} strokeWidth={2.4} aria-hidden />
          Tap to turn it back
        </p>
      </div>
    </div>
  )
}

// ---- The hand: what has been kept ----

function Hand({ kept, onDrop, onClose }: { kept: string[]; onDrop: (key: string) => void; onClose: () => void }) {
  const [said, setSaid] = useState<string | null>(null)
  const [leaving, setLeaving] = useState(false)
  const panel = useRef<HTMLDivElement>(null)
  const pull = useRef<{ id: number; y: number; dy: number; t: number; v: number } | null>(null)

  const close = useCallback(() => {
    const el = panel.current
    if (!el || reduced()) return onClose()
    el.style.transition = 'transform 0.24s cubic-bezier(0.4, 0, 1, 1)'
    el.style.transform = 'translateY(105%)'
    setLeaving(true)
    setTimeout(onClose, 230)
  }, [onClose])

  useEffect(() => {
    panel.current?.focus({ preventScroll: true })
    const key = (e: globalThis.KeyboardEvent) => {
      // Not while a page is open over it: that closes first
      if (e.key === 'Escape' && !panel.current?.closest('[inert]')) close()
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [close])

  // The sheet pulls down by its top to put it away
  const pullDown = (e: ReactPointerEvent<HTMLElement>) => {
    if ((e.target as HTMLElement).closest('button') || !panel.current) return
    pull.current = { id: e.pointerId, y: e.clientY, dy: 0, t: e.timeStamp, v: 0 }
    e.currentTarget.setPointerCapture(e.pointerId)
    panel.current.style.transition = 'none'
  }
  const pullMove = (e: ReactPointerEvent<HTMLElement>) => {
    const p = pull.current
    if (!p || p.id !== e.pointerId || !panel.current) return
    const dy = Math.max(0, e.clientY - p.y)
    p.v = p.v * 0.5 + ((dy - p.dy) / Math.max(1, e.timeStamp - p.t)) * 0.5
    p.dy = dy
    p.t = e.timeStamp
    panel.current.style.transform = `translateY(${dy}px)`
  }
  const pullUp = (e: ReactPointerEvent<HTMLElement>) => {
    const p = pull.current
    if (!p || p.id !== e.pointerId || !panel.current) return
    pull.current = null
    if (e.type === 'pointerup' && (p.dy > 110 || (p.v > 0.5 && p.dy > 16))) return close()
    panel.current.style.transition = reduced() ? 'none' : 'transform 0.3s cubic-bezier(0.2, 1.1, 0.3, 1)'
    panel.current.style.transform = ''
  }

  return (
    <div className="v6-hand" role="dialog" aria-modal="true" aria-label="Your hand" data-leaving={leaving || undefined}>
      <button type="button" className="v6-hand__shade" aria-label="Close" tabIndex={-1} onClick={close} />
      <div ref={panel} className="v6-hand__panel" tabIndex={-1}>
        <header className="v6-hand__bar" onPointerDown={pullDown} onPointerMove={pullMove} onPointerUp={pullUp} onPointerCancel={pullUp}>
          <h3>
            Your hand
            {kept.length > 0 && <i>{kept.length}</i>}
          </h3>
          <button type="button" className="v6-hand__close" aria-label="Close" onClick={close}>
            <X size={16} strokeWidth={2.8} aria-hidden />
          </button>
        </header>
        {kept.length === 0 ? (
          <p className="v6-hand__none">Nothing kept yet. Flick a card to the right, or tap Keep, and it lands here.</p>
        ) : (
          <>
            <ul className="v6-hand__list">
              {kept.map((key) => {
                const [deck, raw] = key.split(':') as [DeckId, string]
                const index = Number(raw)
                const inside = (
                  <>
                    <span className="v6-hand__lead">
                      {deck === 'people' ? <PersonAvatar index={index} size={38} /> : deck === 'companies' ? <CompanyLogo company={ALL[index]!} size={38} /> : <span className="v6-hand__q">?</span>}
                    </span>
                    <span className="v6-hand__text">
                      <b>{nameOf(deck, index)}</b>
                      {deck === 'people' && <span>{PEOPLE[index]!.quote}</span>}
                      {deck === 'companies' && <span>{ALL[index]!.blurb ?? ALL[index]!.vertical}</span>}
                      {deck === 'questions' && <span>{FAQS[index]!.answer ?? ANSWER_PLACEHOLDER}</span>}
                    </span>
                  </>
                )
                return (
                  <li key={key} className="v6-hand__item">
                    {deck === 'questions' ? (
                      <span className="v6-hand__open">{inside}</span>
                    ) : (
                      <button type="button" className="v6-hand__open" onClick={() => lookAt(deck, index)}>
                        {inside}
                      </button>
                    )}
                    <button type="button" className="v6-hand__drop" aria-label={`Put ${nameOf(deck, index)} back`} onClick={() => onDrop(key)}>
                      <X size={14} strokeWidth={2.8} aria-hidden />
                    </button>
                  </li>
                )
              })}
            </ul>
            <button
              type="button"
              className="ph-button v6-hand__share"
              onClick={async () => {
                haptic()
                const sent = await share({ title: `My hand from ${GROUP_NAME}`, text: `My hand from ${GROUP_NAME}:\n${kept.map((k) => `• ${lineOf(k)}`).join('\n')}\n` })
                if (sent !== 'copied') return
                setSaid('Copied')
                setTimeout(() => setSaid(null), 1700)
              }}
            >
              <Share size={18} strokeWidth={2.3} aria-hidden />
              <span role="status">{said ?? 'Share your hand'}</span>
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ---- The table ----

interface Dealt {
  deck: DeckId
  index: number
  kept: boolean
  /** The side it left by: -1 left, 1 right. */
  side: -1 | 1
}

/** A card that has been thrown and is still in the air. */
interface Gone {
  id: number
  deck: DeckId
  index: number
  flipped: boolean
}

interface Held {
  id: number
  x: number
  y: number
  dx: number
  dy: number
  vx: number
  vy: number
  t: number
  /** The deck's width when it was picked up. */
  w: number
  /** Picked up by its lower part: it turns the other way. */
  low: boolean
  moved: boolean
  /** Far enough that letting go now does something: 1 keep, -1 next, 2 share. */
  armed: number
}

/** Whether the first card has shown that it moves: once a visit is enough. */
let shown = false

export default function V6({ active }: { active: boolean }) {
  const [deck, setDeck] = useState<DeckId>('people')
  const [at, setAt] = useState<Record<DeckId, number>>({ people: 0, companies: 0, questions: 0 })
  const [kept, setKept] = useState<string[]>([])
  const [trail, setTrail] = useState<Dealt[]>([])
  /** Cards on their way off the table. The deck has already moved on under them, so the next can be picked up at once. */
  const [gone, setGone] = useState<Gone[]>([])
  const [flipped, setFlipped] = useState(false)
  const [hand, setHand] = useState(false)
  const [said, setSaid] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  /** A card on its way back onto the deck, and the side it comes from. */
  const [back, setBack] = useState<{ key: string; side: -1 | 1 } | null>(null)

  const decks = useRef<HTMLDivElement>(null)
  const counter = useRef<HTMLButtonElement>(null)
  const stack = useRef<HTMLDivElement>(null)
  const top = useRef<HTMLDivElement>(null)
  const drag = useRef<Held | null>(null)
  /** The card was just moved: the click that a mouse sends after letting go isn't a tap on it. */
  const dragged = useRef(false)
  const flights = useRef(0)
  const toastTimer = useRef(0)

  /** A word on the table for a moment: where sharing could only copy, it says so. */
  const tell = (words: string) => {
    setToast(words)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 1700)
  }
  useEffect(() => () => window.clearTimeout(toastTimer.current), [])

  const index = at[deck]
  const count = countOf(deck)
  const finished = index >= count
  const topKey = finished ? `${deck}:end` : keyOf(deck, index)

  /** Where the top card is, and how far the ones under it have risen to meet the gap. */
  const place = (dx: number, dy: number, low = false) => {
    const card = top.current
    const pile = stack.current
    if (!card || !pile) return
    const up = dy < 0 && Math.abs(dy) > Math.abs(dx)
    card.style.transform = `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0) rotate(${(dx * 0.055 * (low ? -1 : 1)).toFixed(2)}deg)`
    // Which stamp shows, and how strongly. One that isn't showing is taken out altogether
    // rather than left at no opacity: Safari doesn't always repaint what has faded to nothing.
    stamp(card, up ? 'send' : dx > 0 ? 'keep' : dx < 0 ? 'next' : null, up ? -dy / 100 : Math.abs(dx) / 90)
    pile.style.setProperty('--lift', clamp(Math.hypot(dx, dy) / 170).toFixed(3))
  }

  /** Back to the middle of the table, with a little spring. */
  const settle = () => {
    const card = top.current
    const pile = stack.current
    if (!card || !pile) return
    card.style.transition = reduced() ? 'none' : 'transform 0.42s cubic-bezier(0.2, 1.3, 0.3, 1)'
    card.removeAttribute('data-armed')
    pile.setAttribute('data-anim', '')
    place(0, 0)
  }

  /** The top card leaves by a side, carrying on the way it was going. The deck moves up one
      straight away, under it, so the next card can be picked up without waiting for this one to land. */
  const fly = (side: -1 | 1, from = { dy: 0, vx: 0, vy: 0, low: false }) => {
    const card = top.current
    const pile = stack.current
    if (!card || !pile || finished) return
    shown = true
    haptic(side === 1 ? 14 : 8)
    if (!reduced()) {
      const far = pile.offsetWidth + 220
      const y = clamp(from.dy + (from.vy / Math.max(0.9, Math.abs(from.vx))) * far * 0.5, -260, 260)
      card.style.transition = 'transform 0.32s cubic-bezier(0.25, 0.6, 0.4, 1), opacity 0.22s ease 0.08s'
      card.setAttribute('data-armed', '')
      stamp(card, side === 1 ? 'keep' : 'next')
      card.style.transform = `translate3d(${side * far}px, ${y.toFixed(1)}px, 0) rotate(${side * 20 * (from.low ? -1 : 1)}deg)`
      card.style.opacity = '0'
      // It stays drawn, as it is, until it has gone
      const id = ++flights.current
      setGone((g) => [...g, { id, deck, index, flipped }])
      window.setTimeout(() => setGone((g) => g.filter((x) => x.id !== id)), 340)
    }
    const key = keyOf(deck, index)
    setTrail((t) => [...t, { deck, index, kept: side === 1, side }])
    if (side === 1) setKept((k) => (k.includes(key) ? k : [...k, key]))
    setAt((a) => ({ ...a, [deck]: index + 1 }))
    setSaid(side === 1 ? `Kept ${nameOf(deck, index)}.` : `Passed ${nameOf(deck, index)}.`)
  }

  const undo = () => {
    const last = trail[trail.length - 1]
    if (!last) return
    haptic()
    const key = keyOf(last.deck, last.index)
    setTrail((t) => t.slice(0, -1))
    if (last.kept) setKept((k) => k.filter((x) => x !== key))
    // Still in the air: it turns round where it is
    setGone((g) => g.filter((x) => keyOf(x.deck, x.index) !== key))
    setDeck(last.deck)
    setAt((a) => ({ ...a, [last.deck]: last.index }))
    setBack({ key, side: last.side })
    setSaid(`${nameOf(last.deck, last.index)} is back.`)
  }

  const send = async () => {
    if (finished) return
    haptic()
    const sent = await share(wordsOf(deck, index))
    if (sent === 'copied') tell('Copied')
  }

  /** A tap on the top card: a question turns over, the others open the page about them. */
  const open = () => {
    if (finished) return
    haptic()
    if (deck === 'questions') setFlipped((f) => !f)
    else lookAt(deck, index)
  }

  // A new card on top: the pile closes up under it, each card moving to its new place.
  // One that was brought back comes in from the side it left by.
  useLayoutEffect(() => {
    const pile = stack.current
    if (!pile) return
    const card = top.current
    const still = reduced()
    pile.toggleAttribute('data-anim', !still)
    pile.style.setProperty('--lift', '0')
    // Not the ones in the air: those are where the throw left them
    for (const el of pile.querySelectorAll<HTMLElement>('.v6-card:not([data-pos="-1"])')) {
      el.style.transition = ''
      el.style.transform = ''
      el.style.opacity = ''
      el.style.removeProperty('--show')
      el.removeAttribute('data-way')
      el.removeAttribute('data-armed')
      el.removeAttribute('data-held')
    }
    setFlipped(false)
    if (card && back && back.key === topKey && !still) {
      // It is thrown back whole: it doesn't fade in the way a card dealt under the pile does
      card.style.animation = 'none'
      card.style.transition = 'none'
      card.style.transform = `translate3d(${back.side * (pile.offsetWidth + 220)}px, 30px, 0) rotate(${back.side * 20}deg)`
      void card.offsetWidth
      card.style.transition = 'transform 0.44s cubic-bezier(0.2, 1.1, 0.3, 1)'
      card.style.transform = ''
    }
    if (back) setBack(null)
  }, [topKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // The switch's white pill sits under the chosen deck's name, whatever widths the names come to
  useLayoutEffect(() => {
    const el = decks.current
    if (!el) return
    const mark = () => {
      const on = el.querySelector<HTMLElement>('[aria-selected="true"]')
      if (!on) return
      el.style.setProperty('--x', `${on.offsetLeft}px`)
      el.style.setProperty('--w', `${on.offsetWidth}px`)
    }
    mark()
    const ro = new ResizeObserver(mark)
    ro.observe(el)
    return () => ro.disconnect()
  }, [deck])

  // The first card of a visit leans each way once, to show that it moves and what the sides mean
  useEffect(() => {
    if (!active || shown || reduced()) return
    const from = performance.now() + 900
    let frame = requestAnimationFrame(function step(now) {
      const t = (now - from) / 1250
      if (drag.current || shown) {
        shown = true
        return
      }
      if (t >= 1) {
        shown = true
        return place(0, 0)
      }
      if (t > 0) {
        // Moved by hand, a frame at a time: nothing is to ease it
        stack.current?.removeAttribute('data-anim')
        place(t < 0.56 ? Math.sin((t / 0.56) * Math.PI) * 54 : -Math.sin(((t - 0.56) / 0.44) * Math.PI) * 30, 0)
      }
      frame = requestAnimationFrame(step)
    })
    return () => cancelAnimationFrame(frame)
  }, [active]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Picking the top card up ----

  const down = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!active || drag.current || (e.pointerType === 'mouse' && e.button !== 0)) return
    if ((e.target as HTMLElement).closest('a, button')) return
    const box = e.currentTarget.getBoundingClientRect()
    drag.current = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      dx: 0,
      dy: 0,
      vx: 0,
      vy: 0,
      t: e.timeStamp,
      w: stack.current?.offsetWidth ?? 320,
      low: e.clientY > box.top + box.height * 0.62,
      moved: false,
      armed: 0,
    }
    dragged.current = false
    e.currentTarget.setPointerCapture(e.pointerId)
    e.currentTarget.style.transition = 'none'
    e.currentTarget.setAttribute('data-held', '')
    stack.current?.removeAttribute('data-anim')
  }

  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    const dx = e.clientX - d.x
    const dy = e.clientY - d.y
    const dt = Math.max(1, e.timeStamp - d.t)
    // How fast it is going, eased so one jumpy sample doesn't decide where it lands
    d.vx = d.vx * 0.5 + ((dx - d.dx) / dt) * 0.5
    d.vy = d.vy * 0.5 + ((dy - d.dy) / dt) * 0.5
    d.dx = dx
    d.dy = dy
    d.t = e.timeStamp
    if (!d.moved && Math.hypot(dx, dy) > 7) d.moved = true
    if (!d.moved) return
    place(dx, dy, d.low)
    // A tick, and the stamp fills in, at the point where letting go does something
    const up = dy < 0 && Math.abs(dy) > Math.abs(dx)
    const armed = up ? (dy < -HIGH ? 2 : 0) : dx > d.w * FAR ? 1 : dx < -d.w * FAR ? -1 : 0
    if (armed === d.armed) return
    d.armed = armed
    e.currentTarget.toggleAttribute('data-armed', armed !== 0)
    if (armed) haptic(6)
  }

  const up = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    drag.current = null
    dragged.current = d.moved
    e.currentTarget.removeAttribute('data-held')
    // Not moved: a tap, which the click that follows deals with
    if (!d.moved) return
    if (e.type !== 'pointerup') return settle()
    // A finger that came to rest before letting go wasn't flicking
    const still = e.timeStamp - d.t > 90
    const vx = still ? 0 : d.vx
    const vy = still ? 0 : d.vy
    const upward = d.dy < 0 && Math.abs(d.dy) > Math.abs(d.dx)
    if (upward) {
      if (d.dy < -HIGH || (vy < -0.6 && d.dy < -24)) void send()
      return settle()
    }
    if (d.dx > d.w * FAR || (vx > 0.45 && d.dx > 24)) return fly(1, { dy: d.dy, vx, vy, low: d.low })
    if (d.dx < -d.w * FAR || (vx < -0.45 && d.dx < -24)) return fly(-1, { dy: d.dy, vx, vy, low: d.low })
    settle()
  }

  // A tap is taken from the click, not from the finger lifting: a page opened as the
  // finger lifts would be under that same click, and close again.
  const onTap = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (dragged.current) {
      dragged.current = false
      return
    }
    if ((e.target as HTMLElement).closest('a, button')) return
    open()
  }

  const onKey = (e: KeyboardEvent) => {
    // Not from the links and buttons inside a card: those keys are theirs
    if (e.target !== e.currentTarget) return
    if (e.key === 'ArrowRight') fly(1)
    else if (e.key === 'ArrowLeft') fly(-1)
    else if (e.key === 'ArrowUp') void send()
    else if (e.key === 'Backspace') undo()
    else if (e.key === ' ' || e.key === 'Enter') open()
    else return
    e.preventDefault()
  }

  const restart = () => {
    haptic()
    setAt((a) => ({ ...a, [deck]: 0 }))
    setTrail((t) => t.filter((d) => d.deck !== deck))
  }

  const closeHand = useCallback(() => setHand(false), [])
  // The hand put away: back to the button that brought it up
  const hadHand = useRef(false)
  useEffect(() => {
    if (hadHand.current && !hand) counter.current?.focus({ preventScroll: true })
    hadHand.current = hand
  }, [hand])

  // What is on the table, from the bottom up: the two under the top card, the top card, and
  // over those any that are in the air (pos -1). One list, keyed by card, so that a card
  // keeps its element from the bottom of the pile to the moment it has flown.
  const lying = finished ? [] : [2, 1, 0].filter((n) => index + n < count).map((n) => ({ deck, index: index + n, pos: n, flipped: n === 0 && flipped }))
  const flying = gone
    .filter((g) => !lying.some((c) => c.deck === g.deck && c.index === g.index))
    .reverse()
    .map((g) => ({ deck: g.deck, index: g.index, pos: -1, flipped: g.flipped }))

  return (
    <div className="v6 ph-wallpaper">
      <div className="v6-felt" {...(hand ? ({ inert: '' } as object) : null)}>
        <header className="v6-top">
          <div ref={decks} className="v6-switch" role="tablist" aria-label="Decks">
            {DECKS.map((d) => (
              <button
                key={d.id}
                type="button"
                role="tab"
                className="v6-switch__deck"
                aria-selected={d.id === deck}
                onClick={() => {
                  if (d.id === deck) return
                  haptic()
                  setDeck(d.id)
                }}
              >
                {d.label}
                <i>{d.count}</i>
              </button>
            ))}
          </div>
          <button
            ref={counter}
            type="button"
            className="v6-kept"
            aria-label={`Your hand: ${kept.length} kept`}
            onClick={() => {
              haptic()
              setHand(true)
            }}
          >
            <Heart size={17} strokeWidth={2.4} fill={kept.length ? 'currentColor' : 'none'} aria-hidden />
            <b key={kept.length}>{kept.length}</b>
          </button>
        </header>

        <div className="v6-table">
          <div
            ref={stack}
            className="v6-stack"
            tabIndex={0}
            role="group"
            aria-roledescription="deck"
            aria-label={`${DECKS.find((d) => d.id === deck)!.label}: ${finished ? 'no cards left' : `card ${index + 1} of ${count}`}`}
            onKeyDown={onKey}
          >
            {finished && (
              <div className="v6-end">
                <div className="v6-end__mark" aria-hidden>
                  {SITE.mark}
                </div>
                <p className="v6-end__text">That’s all {count}.</p>
                <button type="button" className="v6-end__again" onClick={restart}>
                  <RotateCcw size={16} strokeWidth={2.4} aria-hidden />
                  Start again
                </button>
                <div className="v6-end__others">
                  {DECKS.filter((d) => d.id !== deck).map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => {
                        haptic()
                        setDeck(d.id)
                      }}
                    >
                      {d.label} <i>{d.count}</i>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {[...lying, ...flying].map((c) => {
              const isTop = c.pos === 0
              return (
                <div
                  key={keyOf(c.deck, c.index)}
                  ref={isTop ? top : undefined}
                  className="v6-card"
                  data-pos={c.pos}
                  data-deck={c.deck}
                  style={tintOf(c.index)}
                  aria-hidden={isTop ? undefined : true}
                  {...(isTop ? { onPointerDown: down, onPointerMove: move, onPointerUp: up, onPointerCancel: up, onClick: onTap } : ({ inert: '' } as object))}
                >
                  <Face deck={c.deck} index={c.index} flipped={c.flipped} />
                  {c.pos <= 0 && (
                    <>
                      <span className="v6-stamp v6-stamp--keep" aria-hidden>
                        Keep
                      </span>
                      <span className="v6-stamp v6-stamp--next" aria-hidden>
                        Next
                      </span>
                      <span className="v6-stamp v6-stamp--send" aria-hidden>
                        Share
                      </span>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div className="v6-actions">
          <button type="button" className="v6-act v6-act--next" disabled={finished} aria-label="Next card" onClick={() => fly(-1)}>
            <span className="v6-act__disc">
              <X size={27} strokeWidth={2.8} aria-hidden />
            </span>
            <span className="v6-act__label" aria-hidden>
              ← Next
            </span>
          </button>
          <button type="button" className="v6-act v6-act--small" disabled={!trail.length} aria-label="Undo" onClick={undo}>
            <span className="v6-act__disc">
              <Undo2 size={20} strokeWidth={2.4} aria-hidden />
            </span>
            <span className="v6-act__label" aria-hidden>
              Undo
            </span>
          </button>
          <button type="button" className="v6-act v6-act--small" disabled={finished} aria-label="Share this card" onClick={() => void send()}>
            <span className="v6-act__disc">
              <Share size={19} strokeWidth={2.3} aria-hidden />
            </span>
            <span className="v6-act__label" aria-hidden>
              ↑ Share
            </span>
          </button>
          <button type="button" className="v6-act v6-act--keep" disabled={finished} aria-label="Keep this card" onClick={() => fly(1)}>
            <span className="v6-act__disc">
              <Heart size={26} strokeWidth={2.5} fill="currentColor" aria-hidden />
            </span>
            <span className="v6-act__label" aria-hidden>
              Keep →
            </span>
          </button>
        </div>

        <nav className="v6-links" aria-label="More">
          <button type="button" onClick={() => openSheet('request')}>
            Case studies
          </button>
          <button type="button" data-shot="photos" onClick={() => openApp('photos')}>
            VIP
          </button>
          <a href={SITE.onePager} target="_blank" rel="noreferrer">
            One-pager
            <ArrowUpRight size={13} strokeWidth={2.6} aria-hidden />
          </a>
        </nav>
      </div>

      <div className="sr-only" role="status">
        {said}
      </div>
      {toast && (
        <div className="v6-toast" role="status">
          {toast}
        </div>
      )}
      {hand && <Hand kept={kept} onDrop={(key) => setKept((k) => k.filter((x) => x !== key))} onClose={closeHand} />}
    </div>
  )
}
