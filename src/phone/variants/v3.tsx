import '../../styles/variants/v3.css'
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { ArrowUpRight, Check, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, FileText, Folder, Lock, Search, Share, Star, X } from 'lucide-react'
import { QUESTION, TOTAL } from '../../apps/chat'
import { clock, GROUP_NAME, PersonAvatar, Scroller } from '../../apps/chat-ui'
import { ALL, companiesIn, CompanyLogo, hostOf, visitLabel, type Listed } from '../../apps/portfolio-ui'
import { clearJump, inbox, showInGroup } from '../../apps/state'
import { term } from '../../apps/Terminal'
import { CASE_STUDIES } from '../../data/caseStudies'
import { DROPS, MEDIA } from '../../data/drops'
import { ANSWER_PLACEHOLDER, FAQS } from '../../data/faqs'
import { PEOPLE } from '../../data/people'
import { COMPANY_COUNT, VERTICALS } from '../../data/portfolio'
import { SITE } from '../../data/site'
import { prefersReducedMotion } from '../../os/dom'
import { useStore } from '../../os/store'
import { answered, bring, convo, isHere, startConvo } from '../convo'
import { haptic, share } from '../native'
import { openApp, openSheet } from '../nav'
import { ThreadBar, threadNodes, useLoveTap } from '../Thread'
import { Chips } from '../ui'

// Version 3: the sheet. The conversation plays on its own behind, the whole
// screen and nothing to type into; everything else is one sheet over it, the
// kind a thumb pulls up. It rests in three places: a peek (a search field and
// four shortcuts), half the screen, and all of it but the conversation's bar.
// It follows the finger, pulls taut past its ends, and lets go to the nearest
// of the three by where it is and how fast it was moving.

// ---- The sheet's physics ----

/** Where the sheet rests: 0 the peek, 1 half, 2 full. */
type Detent = 0 | 1 | 2

/** How much of the sheet shows at the peek, before the home indicator's share. */
const PEEK = 96
/** How much of the screen stays above the sheet at full: the conversation's bar. */
const ABOVE = 60
/** The spring it settles on: a little under critically damped, so it lands with the faintest give. */
const STIFF = 230
const DAMP = 27

const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v))

/** Past an end the sheet follows less and less, the way a scroll view pulls taut. */
const taut = (over: number, room = 220) => (1 - 1 / ((over * 0.55) / room + 1)) * room

interface Drag {
  x: number
  y: number
  /** The sheet's height when the drag took hold of it. */
  from: number
  /** Where the finger has been over the last tenth of a second: [when, y]. */
  trail: [number, number][]
  /** pending: not yet known whose drag it is. sheet: ours. other: the content's own scroll, or a sideways one. */
  mode: 'pending' | 'sheet' | 'other'
  /** Began on content that can scroll natively: there is no waiting to see which way it goes. */
  native: boolean
  /** The detent it was nearest when last looked at, to tick on passing one. */
  near: Detent
  began: Detent
}

function useSheet() {
  const stage = useRef<HTMLDivElement>(null)
  const sheet = useRef<HTMLDivElement>(null)
  /** The conversation: it rides up on the sheet as far as half, so its newest message stays in view. */
  const pane = useRef<HTMLDivElement>(null)
  const dim = useRef<HTMLDivElement>(null)
  const head = useRef<HTMLDivElement>(null)
  const status = useRef<HTMLDivElement>(null)
  const rest = useRef<HTMLDivElement>(null)
  const body = useRef<HTMLDivElement>(null)
  const safe = useRef<HTMLSpanElement>(null)
  /** Where it rests, or is on its way to. */
  const [detent, setDetent] = useState<Detent>(0)

  const m = useRef({ stops: [PEEK, 380, 670] as [number, number, number], h: PEEK, to: 0 as Detent, frame: 0, drag: null as Drag | null, draggedAt: 0, touched: false, slack: 0 })

  /** Puts the sheet at a height, and everything that goes with it: the conversation behind, its dimming, the head's shape. */
  const apply = useCallback((h: number) => {
    const s = m.current
    const [peek, half, full] = s.stops
    s.h = h
    if (sheet.current) sheet.current.style.transform = `translate3d(0, ${(full - h).toFixed(2)}px, 0)`
    const p = clamp((h - peek) / Math.max(1, half - peek))
    const q = clamp((h - peek) / Math.max(1, full - peek))
    // The conversation is lifted only as far as it takes to keep its newest message clear of the sheet
    if (pane.current) pane.current.style.transform = `translate3d(0, ${(-Math.max(0, Math.min(h, half) - peek - s.slack)).toFixed(2)}px, 0)`
    if (dim.current) dim.current.style.opacity = (Math.pow(q, 1.3) * 0.36).toFixed(3)
    if (head.current) head.current.style.setProperty('--p', p.toFixed(3))
    if (status.current) status.current.style.opacity = clamp(1 - p * 3).toFixed(3)
    if (rest.current) rest.current.style.opacity = clamp(p * 2.4 - 0.2).toFixed(3)
  }, [])

  const nearest = (h: number): Detent => {
    const { stops } = m.current
    let best: Detent = 0
    for (const i of [1, 2] as const) if (Math.abs(stops[i] - h) < Math.abs(stops[best] - h)) best = i
    return best
  }

  /** Lets go of it: a spring from where it is, at the speed it has, to a resting place. */
  const settle = useCallback(
    (target: number, speed: number) => {
      const s = m.current
      cancelAnimationFrame(s.frame)
      s.frame = 0
      if (pane.current) pane.current.style.transition = ''
      if (prefersReducedMotion()) return apply(target)
      let x = s.h
      let v = clamp(speed, -3200, 3200)
      let last = 0
      const step = (now: number) => {
        // As much time as has really passed, in small steps: a slow frame
        // makes the spring coarser to watch, never slower or unsteady
        let left = last ? Math.min(0.1, (now - last) / 1000) : 1 / 60
        last = now
        while (left > 0) {
          const dt = Math.min(left, 0.008)
          v += (-STIFF * (x - target) - DAMP * v) * dt
          x += v * dt
          left -= dt
        }
        if (Math.abs(x - target) < 0.4 && Math.abs(v) < 14) {
          s.frame = 0
          return apply(target)
        }
        apply(x)
        s.frame = requestAnimationFrame(step)
      }
      s.frame = requestAnimationFrame(step)
    },
    [apply],
  )

  /** Sends it to one of its resting places. */
  const go = useCallback(
    (to: Detent, speed = 0) => {
      const s = m.current
      s.to = to
      s.touched = true
      setDetent(to)
      settle(s.stops[to], speed)
    },
    [settle],
  )

  // The resting places follow the screen: its height, the home indicator, the keyboard
  useLayoutEffect(() => {
    const el = stage.current
    if (!el) return
    const fit = () => {
      const s = m.current
      const height = el.clientHeight
      const peek = PEEK + (safe.current?.offsetHeight ?? 0)
      const full = Math.max(peek + 150, height - ABOVE)
      const half = Math.min(full - 60, Math.max(peek + 90, Math.round(height * 0.52)))
      // The sheet hangs from the top of the screen: when the screen's height
      // changes under it (the keyboard), it is the same place on screen at a different height
      const shift = full - s.stops[2]
      s.stops = [peek, half, full]
      s.h += shift
      if (s.drag?.mode === 'sheet') return void (s.drag.from += shift)
      if (s.frame) return settle(s.stops[s.to], 0)
      apply(s.stops[s.to])
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    if (safe.current) ro.observe(safe.current)
    return () => {
      ro.disconnect()
      cancelAnimationFrame(m.current.frame)
    }
  }, [apply, settle])

  // The conversation starts at the top of the screen and grows down. Until it
  // has grown as far as the sheet there is room under it, and that much less to lift.
  useEffect(() => {
    const root = pane.current
    const scroller = root?.querySelector<HTMLElement>('.chat__scroll')
    const thread = root?.querySelector<HTMLElement>('.chat__thread')
    const flow = thread?.parentElement
    if (!root || !scroller || !thread || !flow) return
    const pad = parseFloat(getComputedStyle(flow).paddingBottom) || 0
    const read = () => {
      const s = m.current
      const slack = Math.max(0, scroller.clientHeight - (thread.offsetTop + thread.offsetHeight + pad))
      if (Math.abs(slack - s.slack) < 0.5) return
      s.slack = slack
      if (s.frame || s.drag?.mode === 'sheet') return
      // A message landing under a raised sheet: the conversation eases up for it, as its own scrolling would
      root.style.transition = prefersReducedMotion() ? '' : 'transform 0.5s cubic-bezier(0.25, 1, 0.5, 1)'
      apply(s.h)
    }
    read()
    const ro = new ResizeObserver(read)
    ro.observe(thread)
    ro.observe(scroller)
    return () => ro.disconnect()
  }, [apply])

  // Lifted, the conversation's first messages sit above the top of the screen,
  // where no scrolling can bring them. A reader who scrolls back that far has
  // come for the conversation: the sheet gets out of its way.
  useEffect(() => {
    const scroller = pane.current?.querySelector<HTMLElement>('.chat__scroll')
    if (!scroller) return
    let last = scroller.scrollTop
    let touching = false
    let let_go = 0
    const scrolled = () => {
      const s = m.current
      const top = scroller.scrollTop
      const back = top < last
      last = top
      if (!back || s.to === 0 || s.drag) return
      // Only the reader's own scrolling, or what it coasts on to: never the conversation following itself
      if (!touching && performance.now() - let_go > 1500) return
      const [peek, half] = s.stops
      if (top < Math.max(0, Math.min(s.h, half) - peek - s.slack)) go(0)
    }
    const down = () => (touching = true)
    const up = () => {
      touching = false
      let_go = performance.now()
    }
    scroller.addEventListener('scroll', scrolled, { passive: true })
    scroller.addEventListener('touchstart', down, { passive: true })
    scroller.addEventListener('touchend', up, { passive: true })
    scroller.addEventListener('touchcancel', up, { passive: true })
    scroller.addEventListener('wheel', up, { passive: true })
    return () => {
      scroller.removeEventListener('scroll', scrolled)
      scroller.removeEventListener('touchstart', down)
      scroller.removeEventListener('touchend', up)
      scroller.removeEventListener('touchcancel', up)
      scroller.removeEventListener('wheel', up)
    }
  }, [go])

  // Once, soon after arriving: the sheet gives a small lift, to say it can be
  useEffect(() => {
    const timer = setTimeout(() => {
      const s = m.current
      if (!s.touched && !s.drag && s.to === 0 && !document.hidden) settle(s.stops[0], 520)
    }, 2600)
    return () => clearTimeout(timer)
  }, [settle])

  // The drag itself. Touches are listened to natively, so the one that turns
  // out to be ours can be kept from scrolling anything.
  useEffect(() => {
    const el = sheet.current
    if (!el) return
    const s = m.current

    const begin = (x: number, y: number, t: number, target: EventTarget | null) => {
      // Caught on its way somewhere: it stops under the finger
      cancelAnimationFrame(s.frame)
      s.frame = 0
      s.touched = true
      const inBody = !!body.current && target instanceof Node && body.current.contains(target)
      s.drag = { x, y, from: s.h, trail: [[t, y]], mode: 'pending', native: inBody && s.to === 2, near: nearest(s.h), began: s.to }
    }

    const move = (x: number, y: number, t: number, e?: TouchEvent) => {
      const d = s.drag
      if (!d || d.mode === 'other') return
      const dx = x - d.x
      const dy = y - d.y
      if (d.mode === 'pending') {
        const scroller = body.current
        if (d.native && scroller) {
          // Over content that scrolls by itself there is no waiting: the first move says whose it is
          if (!dx && !dy) return
          const sideways = Math.abs(dx) > Math.abs(dy)
          const can = dy < 0 ? scroller.scrollTop < scroller.scrollHeight - scroller.clientHeight - 1 : scroller.scrollTop > 0
          if (sideways || can) return void (d.mode = 'other')
        } else {
          if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return
          if (Math.abs(dx) > Math.abs(dy) * 1.1) return void (d.mode = 'other')
        }
        d.mode = 'sheet'
        d.y = y
        d.from = s.h
        el.setAttribute('data-dragging', '')
        if (pane.current) pane.current.style.transition = ''
      }
      if (e?.cancelable) e.preventDefault()
      const [peek, , full] = s.stops
      const raw = d.from + (d.y - y)
      const h = raw > full ? full + taut(raw - full) : raw < peek ? peek - taut(peek - raw, 120) : raw
      d.trail.push([t, y])
      while (d.trail.length > 2 && t - d.trail[0]![0] > 100) d.trail.shift()
      apply(h)
      // Passing a resting place gives a tick
      const near = nearest(h)
      if (near !== d.near) {
        d.near = near
        haptic(6)
      }
    }

    const end = (t: number) => {
      const d = s.drag
      s.drag = null
      el.removeAttribute('data-dragging')
      if (!d || d.mode !== 'sheet') {
        // Let go of mid-flight without moving it: carry on to where it was going
        if (!s.frame && Math.abs(s.h - s.stops[s.to]) > 0.5) settle(s.stops[s.to], 0)
        return
      }
      s.draggedAt = performance.now()
      // How fast it was going, upward, over its last tenth of a second: measured
      // across that whole stretch, so two moves arriving at once can't read as a
      // flick. A finger that came to rest before letting go wasn't flicking.
      const [t0, y0] = d.trail[0]!
      const [t1, y1] = d.trail[d.trail.length - 1]!
      const v = t - t1 > 90 ? 0 : (y0 - y1) / Math.max(24, t1 - t0)
      // Where it would coast to decides where it rests
      let to = nearest(s.h + v * 200)
      // And a flick always gets somewhere: at least the next resting place the way it was going
      if (Math.abs(v) > 0.4) {
        const half = s.stops[1]
        if (v > 0) to = Math.max(to, s.h < half - 8 ? 1 : 2) as Detent
        else to = Math.min(to, s.h > half + 8 ? 1 : 0) as Detent
      }
      if (to !== d.began) haptic()
      go(to, v * 1000)
    }

    const touchStart = (e: TouchEvent) => {
      // A second finger: whatever the first was doing is over, and the sheet goes to rest
      if (e.touches.length !== 1) return end(e.timeStamp)
      const t = e.touches[0]!
      begin(t.clientX, t.clientY, e.timeStamp, e.target)
    }
    const touchMove = (e: TouchEvent) => {
      const t = e.touches[0]
      if (t) move(t.clientX, t.clientY, e.timeStamp, e)
    }
    const touchEnd = (e: TouchEvent) => end(e.timeStamp)

    // A mouse or a pen drags it the same way
    const pointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'touch' || e.button !== 0) return
      begin(e.clientX, e.clientY, e.timeStamp, e.target)
      const moved = (ev: PointerEvent) => move(ev.clientX, ev.clientY, ev.timeStamp)
      const up = (ev: PointerEvent) => {
        window.removeEventListener('pointermove', moved)
        window.removeEventListener('pointerup', up)
        window.removeEventListener('pointercancel', up)
        end(ev.timeStamp)
      }
      window.addEventListener('pointermove', moved)
      window.addEventListener('pointerup', up)
      window.addEventListener('pointercancel', up)
    }

    // A drag that began on a button isn't a tap on it
    const click = (e: MouseEvent) => {
      if (performance.now() - s.draggedAt > 350) return
      e.preventDefault()
      e.stopPropagation()
    }

    el.addEventListener('touchstart', touchStart, { passive: true })
    el.addEventListener('touchmove', touchMove, { passive: false })
    el.addEventListener('touchend', touchEnd)
    el.addEventListener('touchcancel', touchEnd)
    el.addEventListener('pointerdown', pointerDown)
    el.addEventListener('click', click, true)
    return () => {
      el.removeEventListener('touchstart', touchStart)
      el.removeEventListener('touchmove', touchMove)
      el.removeEventListener('touchend', touchEnd)
      el.removeEventListener('touchcancel', touchEnd)
      el.removeEventListener('pointerdown', pointerDown)
      el.removeEventListener('click', click, true)
    }
  }, [apply, go, settle]) // eslint-disable-line react-hooks/exhaustive-deps

  return { stage, sheet, pane, dim, head, status, rest, body, safe, detent, go }
}

// ---- What the sheet holds ----

type Tab = 'people' | 'portfolio' | 'faqs' | 'more'

const TABS: { id: Tab; label: string }[] = [
  { id: 'people', label: 'People' },
  { id: 'portfolio', label: 'Portfolio' },
  { id: 'faqs', label: 'FAQs' },
  { id: 'more', label: 'More' },
]

/** When each person's reply landed in the conversation, or that they are writing it. */
type Replies = Map<number, { at: number; typing: boolean }>

const PersonRow = memo(function PersonRow({ index, when, onPick }: { index: number; when: string; onPick: (index: number) => void }) {
  const person = PEOPLE[index]!
  return (
    <li>
      <button type="button" className="v3-person" aria-label={`${person.name}, ${person.role}. Show their reply.`} onClick={() => onPick(index)}>
        <PersonAvatar index={index} size={42} />
        <span className="v3-person__text">
          <span className="v3-person__top">
            <b>{person.name}</b>
            <span className="v3-person__role">{person.role}</span>
            {when && <span className="v3-person__when">{when}</span>}
          </span>
          <span className="v3-person__line">{person.quote ?? 'Reply to come'}</span>
        </span>
      </button>
    </li>
  )
})

function PeopleList({ people, replies, onPick }: { people: number[]; replies: Replies; onPick: (index: number) => void }) {
  return (
    <ul className="v3-list">
      {people.map((i) => {
        const r = replies.get(i)
        return <PersonRow key={i} index={i} when={r ? (r.typing ? 'writing…' : clock(r.at)) : ''} onPick={onPick} />
      })}
    </ul>
  )
}

function Logos({ companies, onPick }: { companies: Listed[]; onPick: (name: string) => void }) {
  return (
    <ul className="ph-logos">
      {companies.map((c) => (
        <li key={c.name}>
          <button type="button" className="ph-logo" onClick={() => onPick(c.name)}>
            <CompanyLogo company={c} size={58} />
            <span className="ph-logo__name">{c.name}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

const VERTICAL_OPTIONS = [{ value: -1, label: 'All' }, ...VERTICALS.map((v, i) => ({ value: i, label: v.name }))]

function Portfolio({ vertical, onVertical, onPick }: { vertical: number; onVertical: (v: number) => void; onPick: (name: string) => void }) {
  const shown = useMemo(() => companiesIn(vertical, ''), [vertical])
  return (
    <div className="v3-portfolio">
      <Chips label="Verticals" value={vertical} options={VERTICAL_OPTIONS} onChange={onVertical} />
      {vertical === -1 ? (
        VERTICALS.map((v) => (
          <section key={v.name} aria-label={v.name}>
            <h3 className="v3-title">
              {v.name} <span>{v.companies.length}</span>
            </h3>
            <Logos companies={shown.filter((c) => c.vertical === v.name)} onPick={onPick} />
          </section>
        ))
      ) : (
        <Logos companies={shown} onPick={onPick} />
      )}
    </div>
  )
}

/** One company, inside the sheet: what it is, and the way to it. */
function Company({ company }: { company: Listed }) {
  const visit = visitLabel(company)
  const step = useStore(term, (t) => t.step)
  const study = CASE_STUDIES.includes(company.name)
  return (
    <div className="v3-company">
      <div className="v3-company__head">
        <CompanyLogo company={company} size={68} />
        <div className="v3-company__id">
          <h3>{company.name}</h3>
          <p>{company.vertical}</p>
        </div>
      </div>
      {company.blurb && <p className="v3-company__blurb">{company.blurb}</p>}
      {company.url && visit && (
        <a className="ph-button" href={company.url} target="_blank" rel="noreferrer">
          {visit}
          <ArrowUpRight size={17} strokeWidth={2.4} aria-hidden />
        </a>
      )}
      {study && (
        <button type="button" className="v3-company__study" onClick={() => openSheet('request')}>
          <Lock size={15} strokeWidth={2.4} aria-hidden />
          <span>{step === 'done' ? 'Case study: request noted' : 'Case study: private. Request access'}</span>
          <ChevronRight size={16} strokeWidth={2.6} aria-hidden />
        </button>
      )}
    </div>
  )
}

function Faqs({ questions, open, onOpen }: { questions: number[]; open: number | null; onOpen: (index: number | null) => void }) {
  return (
    <div className="ph-faq-list v3-faqs">
      {questions.map((i) => {
        const faq = FAQS[i]!
        const on = open === i
        return (
          <section key={i} className="ph-faq" data-open={on || undefined}>
            <h3>
              <button type="button" className="ph-faq__question" aria-expanded={on} aria-controls={`v3-faq-${i}`} onClick={() => onOpen(on ? null : i)}>
                <span>{faq.question}</span>
                <ChevronDown className="ph-faq__chevron" size={20} strokeWidth={2.4} aria-hidden />
              </button>
            </h3>
            <div className="ph-faq__answer" id={`v3-faq-${i}`} role="region" aria-label={faq.question} {...(on ? null : ({ inert: '' } as object))}>
              <div>{faq.answer ? <p>{faq.answer}</p> : <p className="faq__todo">{ANSWER_PLACEHOLDER}</p>}</div>
            </div>
          </section>
        )
      })}
    </div>
  )
}

/** A round mark in one of the desktop's own colours: a shortcut on the peek, an icon in a list. */
const MARKS = {
  portfolio: { tone: '#2f86e6', icon: <Folder size={17} strokeWidth={2.4} aria-hidden /> },
  faqs: { tone: '#f2a400', icon: <CircleHelp size={18} strokeWidth={2.4} aria-hidden /> },
  cases: { tone: '#1d1d1f', icon: <Lock size={16} strokeWidth={2.6} aria-hidden /> },
  vip: { tone: '#7447e6', icon: <Star size={17} strokeWidth={2.4} fill="currentColor" aria-hidden /> },
  onepager: { tone: '#8e8e93', icon: <FileText size={16} strokeWidth={2.4} aria-hidden /> },
  share: { tone: '#34c759', icon: <Share size={15} strokeWidth={2.6} aria-hidden /> },
} satisfies Record<string, { tone: string; icon: ReactNode }>

const Mark = ({ of }: { of: keyof typeof MARKS }) => (
  <span className="v3-mark" style={{ '--tone': MARKS[of].tone } as CSSProperties} aria-hidden>
    {MARKS[of].icon}
  </span>
)

function More() {
  const step = useStore(term, (t) => t.step)
  const [copied, setCopied] = useState(false)
  const row = (mark: keyof typeof MARKS, title: string, sub: string, end: ReactNode) => (
    <>
      <Mark of={mark} />
      <span className="v3-row__text">
        <b>{title}</b>
        <span>{sub}</span>
      </span>
      {end}
    </>
  )
  const chevron = <ChevronRight className="v3-row__end" size={17} strokeWidth={2.6} aria-hidden />
  return (
    <ul className="v3-list v3-more">
      <li>
        <button type="button" className="v3-row" onClick={() => openSheet('request')}>
          {row('cases', 'Case studies', step === 'done' ? 'Request noted' : `${CASE_STUDIES.length} private · Request access`, step === 'done' ? <Check className="v3-row__end" size={17} strokeWidth={2.8} aria-hidden /> : chevron)}
        </button>
      </li>
      <li>
        <button type="button" className="v3-row" onClick={() => openApp('photos')}>
          {row('vip', 'VIP', `${DROPS.length} drops, ${MEDIA.length} photos and videos`, chevron)}
        </button>
      </li>
      <li>
        <a className="v3-row" href={SITE.onePager} target="_blank" rel="noreferrer">
          {row('onepager', 'One-pager', hostOf(SITE.onePager), <ArrowUpRight className="v3-row__end" size={17} strokeWidth={2.4} aria-hidden />)}
        </a>
      </li>
      <li>
        <button
          type="button"
          className="v3-row"
          onClick={async () => {
            if ((await share({ title: GROUP_NAME, text: QUESTION.join(' ') })) !== 'copied') return
            setCopied(true)
            setTimeout(() => setCopied(false), 1800)
          }}
        >
          {row('share', `Share ${GROUP_NAME}`, copied ? 'Link copied' : 'Pass the conversation on', copied ? <Check className="v3-row__end" size={17} strokeWidth={2.8} aria-hidden /> : null)}
        </button>
      </li>
    </ul>
  )
}

/** Everything a search finds, grouped by what it is. */
function Results({ query, replies, onPerson, onCompany, onFaq }: { query: string; replies: Replies; onPerson: (index: number) => void; onCompany: (name: string) => void; onFaq: (index: number) => void }) {
  const q = query.trim().toLowerCase()
  const people = useMemo(() => PEOPLE.flatMap((p, i) => (`${p.name} ${p.role}`.toLowerCase().includes(q) ? [i] : [])), [q])
  const companies = useMemo(() => companiesIn(-1, q), [q])
  const faqs = useMemo(() => FAQS.flatMap((f, i) => (`${f.question} ${f.answer ?? ''}`.toLowerCase().includes(q) ? [i] : [])), [q])
  if (!people.length && !companies.length && !faqs.length) return <p className="v3-none">Nothing in {GROUP_NAME} matches “{query.trim()}”</p>
  return (
    <div className="v3-results">
      {people.length > 0 && (
        <section aria-label="People">
          <h3 className="v3-title">
            People <span>{people.length}</span>
          </h3>
          <PeopleList people={people} replies={replies} onPick={onPerson} />
        </section>
      )}
      {companies.length > 0 && (
        <section aria-label="Portfolio">
          <h3 className="v3-title">
            Portfolio <span>{companies.length}</span>
          </h3>
          <ul className="v3-list">
            {companies.map((c) => (
              <li key={c.name}>
                <button type="button" className="v3-row" onClick={() => onCompany(c.name)}>
                  <CompanyLogo company={c} size={36} />
                  <span className="v3-row__text">
                    <b>{c.name}</b>
                    <span>{c.blurb ?? c.vertical}</span>
                  </span>
                  <ChevronRight className="v3-row__end" size={17} strokeWidth={2.6} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {faqs.length > 0 && (
        <section aria-label="FAQs">
          <h3 className="v3-title">
            FAQs <span>{faqs.length}</span>
          </h3>
          <ul className="v3-list">
            {faqs.map((i) => (
              <li key={i}>
                <button type="button" className="v3-row" onClick={() => onFaq(i)}>
                  <Mark of="faqs" />
                  <span className="v3-row__text">
                    <b>{FAQS[i]!.question}</b>
                  </span>
                  <ChevronRight className="v3-row__end" size={17} strokeWidth={2.6} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

// ---- The screen ----

const EVERYONE = PEOPLE.map((_, i) => i)
const QUESTIONS = FAQS.map((_, i) => i)

export default function V3({ active }: { active: boolean }) {
  useEffect(() => startConvo(), [])

  const state = useStore(convo, (s) => s)
  const jump = useStore(inbox, (s) => s.jump)
  const { stage, sheet, pane, dim, head, status, rest, body, safe, detent, go } = useSheet()
  const field = useRef<HTMLInputElement>(null)
  const [tab, setTab] = useState<Tab>('people')
  const [vertical, setVertical] = useState(-1)
  /** The company open inside the sheet, by name. */
  const [company, setCompany] = useState<string | null>(null)
  const [faq, setFaq] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  /** The search field has the keyboard. */
  const [focused, setFocused] = useState(false)
  /** Room on the peek for the whole placeholder. */
  const [wide, setWide] = useState(true)
  /** Where the list was scrolled to when a company was opened out of it. */
  const kept = useRef(0)

  const nodes = useMemo(() => threadNodes(state.items, state.startedAt, state.loved), [state.items, state.startedAt, state.loved])
  const onTap = useLoveTap(() => haptic())
  const replies = useMemo(() => {
    const map: Replies = new Map()
    for (const item of state.items) if (item.kind === 'person') map.set(item.index, { at: item.at ?? state.startedAt, typing: item.typing })
    return map
  }, [state.items, state.startedAt])

  const searching = query.trim().length > 0
  const shown = company ? ALL.find((c) => c.name === company) ?? null : null
  const writing = state.items.find((i) => i.kind === 'person' && i.typing)
  const count = answered(state)

  useEffect(() => {
    const el = stage.current
    if (!el) return
    const fit = () => setWide(el.clientWidth >= 372)
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [stage])

  // The conversation has been asked to show someone's reply (from here, or from
  // its details): the sheet gets out of the way of it
  useEffect(() => {
    if (jump !== null && active) go(0)
  }, [jump, active, go])

  // Lowered from full, the search field lets go of the keyboard
  useEffect(() => {
    if (detent < 2 && document.activeElement === field.current) field.current?.blur()
  }, [detent])

  // Escape lowers it, a step at a time
  useEffect(() => {
    if (detent === 0) return
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (company) return setCompany(null)
      field.current?.blur()
      go(0)
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [detent, company, go])

  const top = () => body.current?.scrollTo({ top: 0 })

  /** Shows one of the sheet's pages, raising it off the peek if that is where it is. */
  const show = (next: Tab) => {
    haptic(6)
    setTab(next)
    setCompany(null)
    setQuery('')
    top()
    if (detent === 0) go(1)
  }

  /** Someone was picked: the sheet gets out of the way and the conversation goes to what they said. */
  const onPerson = useCallback(
    (index: number) => {
      haptic()
      // Not reached yet: they answer now
      if (!isHere(index)) bring(index)
      showInGroup(index)
      // Found by searching: the search has done its job
      setQuery('')
      go(0)
    },
    [go],
  )

  const onCompany = (name: string) => {
    haptic(6)
    kept.current = body.current?.scrollTop ?? 0
    setCompany(name)
    field.current?.blur()
    top()
    if (detent === 0) go(1)
  }

  const back = () => {
    haptic(6)
    setCompany(null)
    // Back to where the list was
    requestAnimationFrame(() => body.current?.scrollTo({ top: kept.current }))
  }

  const onFaq = (index: number) => {
    haptic(6)
    setQuery('')
    setTab('faqs')
    setFaq(index)
    field.current?.blur()
    top()
  }

  const cancel = () => {
    setQuery('')
    field.current?.blur()
    if (detent === 2) go(1)
  }

  const page = shown ? 'company' : searching ? 'results' : tab

  return (
    <div
      ref={stage}
      className="v3"
      data-detent={detent}
      onScroll={(e) => {
        // The sheet hangs below the screen; a browser that scrolls down to it (to show something focused) is put back
        if (e.target === e.currentTarget) e.currentTarget.scrollTop = 0
      }}
    >
      <span ref={safe} className="v3-safe" aria-hidden />
      <div className="ph-page ph-thread" data-fixed {...(detent === 2 ? ({ inert: '' } as object) : null)}>
        <ThreadBar sharing={false} />
        <div className="ph-page__content">
          <div ref={pane} className="v3-pane">
            <Scroller label={GROUP_NAME} nodes={nodes} jump={jump} onJumped={clearJump} active={active} onTap={onTap} />
          </div>
        </div>
      </div>
      {/* The conversation dims as the sheet rises; with the sheet at full, a tap on what is left of it lowers the sheet */}
      <div ref={dim} className="v3-dim" data-on={detent === 2 || undefined} onClick={() => go(1)} aria-hidden />
      <section
        ref={sheet}
        className="v3-sheet"
        aria-label={`Browse ${GROUP_NAME}`}
        onClick={(e) => {
          // On the peek, a tap anywhere that isn't a control raises it
          if (detent !== 0 || (e.target as HTMLElement).closest('button, a, label, input')) return
          haptic()
          go(1)
        }}
      >
        <div className="v3-sheet__inner">
          <button
            type="button"
            className="v3-grabber"
            aria-label={detent === 2 ? 'Lower the sheet' : 'Raise the sheet'}
            aria-expanded={detent > 0}
            onClick={() => {
              haptic()
              go(detent === 0 ? 1 : detent === 1 ? 2 : 0)
            }}
            onKeyDown={(e) => {
              if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
              e.preventDefault()
              go(clamp(detent + (e.key === 'ArrowUp' ? 1 : -1), 0, 2) as Detent)
            }}
          >
            <span aria-hidden />
          </button>
          <div ref={head} className="v3-head" data-searching={focused || searching || undefined}>
            <label className="v3-search">
              <Search size={17} strokeWidth={2.3} aria-hidden />
              <input
                ref={field}
                type="text"
                inputMode="search"
                enterKeyHint="search"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                placeholder={wide || detent > 0 ? `Search ${GROUP_NAME}` : 'Search'}
                aria-label={`Search ${GROUP_NAME}: people, companies and questions`}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setCompany(null)
                  top()
                }}
                onFocus={() => {
                  setFocused(true)
                  if (detent !== 2) go(2)
                }}
                onBlur={() => setFocused(false)}
              />
              {query && (
                <button
                  type="button"
                  className="ph-search__clear"
                  aria-label="Clear search"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setQuery('')
                    field.current?.focus()
                  }}
                >
                  <X size={11} strokeWidth={3} aria-hidden />
                </button>
              )}
            </label>
            <div className="v3-shortcuts" role="group" aria-label="Shortcuts" {...(detent === 0 && !focused && !searching ? null : ({ inert: '' } as object))}>
              <button type="button" className="v3-shortcut" aria-label="Portfolio" onClick={() => show('portfolio')}>
                <Mark of="portfolio" />
              </button>
              <button type="button" className="v3-shortcut" aria-label="FAQs" onClick={() => show('faqs')}>
                <Mark of="faqs" />
              </button>
              <button type="button" className="v3-shortcut" aria-label="Case studies" onClick={() => show('more')}>
                <Mark of="cases" />
              </button>
              <button
                type="button"
                className="v3-shortcut"
                aria-label="VIP"
                onClick={() => {
                  haptic(6)
                  openApp('photos')
                }}
              >
                <Mark of="vip" />
              </button>
            </div>
            <button type="button" className="v3-cancel" onMouseDown={(e) => e.preventDefault()} onClick={cancel} {...(focused || searching ? null : ({ inert: '' } as object))}>
              Cancel
            </button>
          </div>
          {/* On the peek, under the field: how the conversation behind is getting on */}
          <div ref={status} className="v3-status" aria-hidden={detent > 0}>
            <span className="v3-status__dot" data-live={(!state.done && state.flowing) || undefined} />
            <span>
              {state.done ? `All ${TOTAL} have replied` : `${count} of ${TOTAL} have replied`}
              {writing && writing.kind === 'person' ? ` · ${PEOPLE[writing.index]!.name} is writing…` : ''}
            </span>
          </div>
          <div ref={rest} className="v3-rest" {...(detent === 0 ? ({ inert: '' } as object) : null)}>
            <div className="v3-nav">
              {shown ? (
                <button type="button" className="v3-back" onClick={back}>
                  <ChevronLeft size={20} strokeWidth={2.6} aria-hidden />
                  <span>{searching ? 'Search' : 'Portfolio'}</span>
                </button>
              ) : searching ? null : (
                <div className="v3-tabs" role="tablist" aria-label="Sections" style={{ '--at': TABS.findIndex((t) => t.id === tab) } as CSSProperties}>
                  <span className="v3-tabs__thumb" aria-hidden />
                  {TABS.map((t) => (
                    <button key={t.id} type="button" role="tab" className="v3-tab" aria-selected={t.id === tab} aria-controls="v3-body" onClick={() => t.id !== tab && show(t.id)}>
                      {t.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div ref={body} className="v3-body" id="v3-body" role={shown || searching ? 'region' : 'tabpanel'} aria-label={shown ? shown.name : searching ? 'Search results' : TABS.find((t) => t.id === tab)!.label} data-page={page}>
              <div key={page + (shown?.name ?? '')} className="v3-page">
                {shown ? (
                  <Company company={shown} />
                ) : searching ? (
                  <Results query={query} replies={replies} onPerson={onPerson} onCompany={onCompany} onFaq={onFaq} />
                ) : tab === 'people' ? (
                  <>
                    <p className="v3-lede">Tap anyone to go to their reply.</p>
                    <PeopleList people={EVERYONE} replies={replies} onPick={onPerson} />
                  </>
                ) : tab === 'portfolio' ? (
                  <>
                    <p className="v3-lede">
                      {COMPANY_COUNT} companies in {VERTICALS.length} verticals.
                    </p>
                    <Portfolio vertical={vertical} onVertical={setVertical} onPick={onCompany} />
                  </>
                ) : tab === 'faqs' ? (
                  <Faqs questions={QUESTIONS} open={faq} onOpen={setFaq} />
                ) : (
                  <More />
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
