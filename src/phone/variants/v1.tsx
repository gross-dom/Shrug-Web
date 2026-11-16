import '../../styles/variants/v1.css'
import { memo, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { ArrowUpRight, Check, ChevronDown, Image as ImageIcon, Play, Share } from 'lucide-react'
import { QUESTION, TOTAL } from '../../apps/chat'
import { GROUP_NAME, PersonAvatar } from '../../apps/chat-ui'
import { CompanyLogo } from '../../apps/portfolio-ui'
import { term, TerminalLog } from '../../apps/Terminal'
import { ShrugAvatar } from '../../apps/ui'
import { CASE_STUDIES } from '../../data/caseStudies'
import { DROPS, MEDIA } from '../../data/drops'
import { ANSWER_PLACEHOLDER, FAQS } from '../../data/faqs'
import { PEOPLE } from '../../data/people'
import { COMPANY_COUNT, VERTICALS } from '../../data/portfolio'
import { SITE } from '../../data/site'
import { prefersReducedMotion } from '../../os/dom'
import { useStore } from '../../os/store'
import { openApp, openSheet } from '../nav'
import { haptic, share } from '../native'

// Version 1, the scroll: the site as one long page, the way a phone reads
// most things. It opens on Niv's question; scroll and the ninety replies rise
// into a thread, then the portfolio, the FAQs, the case studies and VIP follow
// as chapters. A bar of chapters stays at the top to jump between them.

const CHAPTERS = [
  { id: 'replies', label: 'Replies' },
  { id: 'portfolio', label: 'Portfolio' },
  { id: 'faqs', label: 'FAQs' },
  { id: 'cases', label: 'Case studies' },
  { id: 'vip', label: 'VIP' },
] as const

type ChapterId = (typeof CHAPTERS)[number]['id']

/** One reply in each dozen is set large on a colour sheet: the shortest of them, so it can be. */
const FEATURED = (() => {
  const picked: number[] = []
  for (let start = 4; start < TOTAL; start += 12) {
    let best = -1
    for (let i = start; i < Math.min(TOTAL, start + 12); i++) {
      const quote = PEOPLE[i]!.quote
      if (!quote || quote.length > 230) continue
      if (best < 0 || quote.length < PEOPLE[best]!.quote!.length) best = i
    }
    if (best >= 0) picked.push(best)
  }
  return picked
})()

const SHEETS = ['azure', 'violet', 'pink', 'coral', 'cyan', 'night'] as const

/** How far down the screen a reply is when it is the one being read. */
const READING_LINE = 0.32

/** The tail of a received bubble, as the kit draws it. */
const Tail = () => (
  <svg className="v1-msg__tail" viewBox="0 0 18 16" aria-hidden>
    <path d="M18 0H6V8.5C6 12.6 4 15 0.5 16C3 16.7 5.8 16.5 8.2 15.3L18 15Z" />
  </svg>
)

function Reply({ index }: { index: number }) {
  const person = PEOPLE[index]!
  const featured = FEATURED.indexOf(index)
  if (featured >= 0) {
    const size = person.quote!.length <= 90 ? 'l' : person.quote!.length <= 150 ? 'm' : 's'
    return (
      <figure className="v1-feature v1-rise" data-reply={index} data-sheet={SHEETS[featured % SHEETS.length]} data-size={size}>
        <blockquote>{person.quote}</blockquote>
        <figcaption>
          <button type="button" className="v1-feature__who" aria-label={`About ${person.name}`} onClick={() => openSheet(`person:${index}`)}>
            <PersonAvatar index={index} size={36} />
            <span>
              <b>{person.name}</b>
              <span>{person.role}</span>
            </span>
          </button>
        </figcaption>
      </figure>
    )
  }
  return (
    <div className="v1-msg v1-rise" data-reply={index}>
      <div className="v1-msg__who">
        {person.name}
        {person.role ? ` · ${person.role}` : ''}
      </div>
      <div className="v1-msg__row">
        <button type="button" className="v1-msg__face" aria-label={`About ${person.name}`} onClick={() => openSheet(`person:${index}`)}>
          <PersonAvatar index={index} size={28} />
        </button>
        <p className="v1-msg__bubble">
          {person.quote}
          <Tail />
        </p>
      </div>
    </div>
  )
}

function Faqs() {
  const [open, setOpen] = useState<number | null>(0)
  return (
    <div className="v1-faqs">
      {FAQS.map((faq, i) => {
        const on = open === i
        return (
          <section key={i} className="v1-faq" data-open={on || undefined}>
            <h3>
              <button type="button" className="v1-faq__q" aria-expanded={on} aria-controls={`v1-faq-${i}`} onClick={() => setOpen(on ? null : i)}>
                <span>{faq.question}</span>
                <ChevronDown className="v1-faq__chevron" size={20} strokeWidth={2.4} aria-hidden />
              </button>
            </h3>
            <div className="v1-faq__a" id={`v1-faq-${i}`} role="region" aria-label={faq.question} {...(on ? null : ({ inert: '' } as object))}>
              <div>{faq.answer ? <p>{faq.answer}</p> : <p className="faq__todo">{ANSWER_PLACEHOLDER}</p>}</div>
            </div>
          </section>
        )
      })}
    </div>
  )
}

// The long parts of the page never change, so each is drawn once: the page
// marking a new chapter as it scrolls is no reason to go through them again.

/** Everything they said, in the order they said it. */
const Thread = memo(function Thread() {
  return (
    <div className="v1-thread">
      {PEOPLE.map((_, i) => (
        <Reply key={i} index={i} />
      ))}
      <div className="v1-msg v1-msg--niv v1-rise">
        <p className="v1-msg__bubble">{SITE.mark}</p>
      </div>
    </div>
  )
})

/** The portfolio: a row of logos to each vertical. */
const Verticals = memo(function Verticals() {
  return (
    <>
      {VERTICALS.map((v) => (
        <div key={v.name} className="v1-vertical">
          <h3 className="v1-vertical__name">
            {v.name} <span>{v.companies.length}</span>
          </h3>
          <ul className="v1-row" aria-label={v.name}>
            {v.companies.map((c) => (
              <li key={c.name}>
                <button type="button" className="v1-tile" onClick={() => openSheet(`company:${c.name}`)}>
                  <CompanyLogo company={c} size={62} />
                  <span>{c.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </>
  )
})

/** The drops: a photo or a video to each place, or the place one goes. */
const Gallery = memo(function Gallery() {
  return (
    <ul className="v1-gallery" aria-label={`${DROPS.length} drops`}>
      {MEDIA.map((slot, i) => (
        <li key={i} className="v1-slot" data-kind={slot.kind}>
          {slot.src ? (
            slot.kind === 'video' ? (
              <video src={slot.src} controls preload="metadata" />
            ) : (
              <img src={slot.src} alt={`${slot.drop}${slot.from ? `, from ${slot.from}` : ''}`} loading="lazy" />
            )
          ) : (
            <span className="v1-slot__empty">
              {slot.kind === 'video' ? <Play size={24} strokeWidth={1.6} aria-hidden /> : <ImageIcon size={24} strokeWidth={1.6} aria-hidden />}
              {slot.kind === 'video' ? 'Video slot' : 'Photo slot'}
            </span>
          )}
          <span className="v1-slot__cap">
            <b>{slot.from ?? '[Name]'}</b>
            <span>{slot.drop}</span>
          </span>
        </li>
      ))}
    </ul>
  )
})

export default function V1(_: { active: boolean }) {
  const scroller = useRef<HTMLDivElement>(null)
  const chips = useRef<HTMLDivElement>(null)
  const bar = useRef<HTMLDivElement>(null)
  const count = useRef<HTMLSpanElement>(null)
  const fill = useRef<HTMLSpanElement>(null)
  const knob = useRef<HTMLSpanElement>(null)
  /** Where each reply starts down the page, and the one being read. */
  const tops = useRef<number[]>([])
  const reading = useRef(-1)
  const drag = useRef<{ x: number; y: number; on: boolean } | null>(null)
  const [chapter, setChapter] = useState<ChapterId | null>(null)
  const [said, setSaid] = useState<string | null>(null)
  const requested = useStore(term, (t) => t.step === 'done')

  // Each reply rises in once, as it comes into view from below. Coming back up
  // the page to one that was jumped past, it is simply there.
  useEffect(() => {
    const root = scroller.current
    if (!root) return
    const rise = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const above = entry.boundingClientRect.top < (entry.rootBounds?.top ?? 0) + 48
          entry.target.setAttribute('data-in', above ? 'now' : '')
          rise.unobserve(entry.target)
        }
      },
      { root, rootMargin: '0px 0px -5% 0px', threshold: 0.04 },
    )
    root.querySelectorAll('.v1-rise').forEach((el) => rise.observe(el))
    return () => rise.disconnect()
  }, [])

  // Where the page is: which chapter the bar marks, and how far through the replies
  useEffect(() => {
    const root = scroller.current
    if (!root) return
    const sections = CHAPTERS.map((c) => root.querySelector<HTMLElement>(`[data-chapter="${c.id}"]`)!)
    const replies = Array.from(root.querySelectorAll<HTMLElement>('[data-reply]'))
    let frame = 0
    let last = { y: root.scrollTop, t: performance.now() }
    const measure = () => {
      const base = root.getBoundingClientRect().top - root.scrollTop
      tops.current = replies.map((el) => el.getBoundingClientRect().top - base)
      read()
    }
    const read = () => {
      frame = 0
      const y = root.scrollTop
      // Flicked through fast, the replies don't take their time arriving
      const t = performance.now()
      if (t - last.t > 30) {
        root.toggleAttribute('data-fast', Math.abs(y - last.y) / (t - last.t) > 1.5)
        last = { y, t }
      }
      // The chapter whose top has passed under the bar
      let now: ChapterId | null = null
      for (let i = 0; i < sections.length; i++) if (sections[i]!.offsetTop - 120 <= y) now = CHAPTERS[i]!.id
      setChapter((was) => (was === now ? was : now))
      // The reply being read: the last one to have come up past the reading line, a third of the way down
      const starts = tops.current
      const line = y + root.clientHeight * READING_LINE
      let lo = 0
      let hi = starts.length
      while (lo < hi) {
        const mid = (lo + hi) >> 1
        if (starts[mid]! <= line) lo = mid + 1
        else hi = mid
      }
      // The first counts from the moment it is on the screen at all
      if (!lo && starts.length && starts[0]! <= y + root.clientHeight) lo = 1
      if (lo === reading.current) return
      // Scrubbed along, each one is felt as it goes by
      if (drag.current?.on && reading.current >= 0) haptic(4)
      reading.current = lo
      if (count.current) count.current.textContent = String(lo)
      if (fill.current) fill.current.style.transform = `scaleX(${lo / TOTAL})`
      if (knob.current) knob.current.style.transform = `translateX(${(lo / TOTAL) * 100}%)`
      bar.current?.setAttribute('aria-valuenow', String(lo))
      bar.current?.setAttribute('aria-valuetext', lo ? `${lo} of ${TOTAL}: ${PEOPLE[lo - 1]!.name}` : `0 of ${TOTAL}`)
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(read)
    }
    const resized = new ResizeObserver(measure)
    resized.observe(root.querySelector('.v1-thread')!)
    resized.observe(root)
    measure()
    root.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      resized.disconnect()
      root.removeEventListener('scroll', onScroll)
    }
  }, [])

  // The chapter that is marked stays in view in the bar
  useEffect(() => {
    const bar = chips.current
    const chip = bar?.querySelector<HTMLElement>('[aria-current]')
    if (bar && chip) bar.scrollTo({ left: Math.max(0, chip.offsetLeft - 16), behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
  }, [chapter])

  /** Straight to one of the replies (1 to 90), set at the reading line. */
  const readAt = (n: number) => {
    const root = scroller.current
    const top = tops.current[Math.max(1, Math.min(TOTAL, n)) - 1]
    if (root && top !== undefined) root.scrollTop = Math.max(0, top - root.clientHeight * READING_LINE + 1)
  }

  // The bar that says how far through is also a way through: drag along it, or tap a place on it
  const scrub = (e: ReactPointerEvent<HTMLDivElement>) => {
    const track = e.currentTarget.firstElementChild!.getBoundingClientRect()
    readAt(Math.round(Math.max(0, Math.min(1, (e.clientX - track.left) / track.width)) * (TOTAL - 1)) + 1)
  }
  const scrubbing = {
    onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      drag.current = { x: e.clientX, y: e.clientY, on: false }
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        // The finger has already gone
      }
    },
    onPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => {
      const d = drag.current
      if (!d) return
      // Sideways is a scrub; up or down is the page being scrolled, and the page keeps that
      if (!d.on && Math.abs(e.clientX - d.x) > 6 && Math.abs(e.clientX - d.x) > Math.abs(e.clientY - d.y)) {
        d.on = true
        e.currentTarget.setAttribute('data-scrub', '')
      }
      if (d.on) scrub(e)
    },
    onPointerUp: (e: ReactPointerEvent<HTMLDivElement>) => {
      const d = drag.current
      drag.current = null
      e.currentTarget.removeAttribute('data-scrub')
      // A tap on the bar goes to that place along it
      if (d && !d.on && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 8) {
        haptic()
        scrub(e)
      }
    },
    onPointerCancel: (e: ReactPointerEvent<HTMLDivElement>) => {
      drag.current = null
      e.currentTarget.removeAttribute('data-scrub')
    },
    onKeyDown: (e: ReactKeyboardEvent<HTMLDivElement>) => {
      const now = Math.max(0, reading.current)
      const to = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? now + 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? now - 1 : e.key === 'Home' ? 1 : e.key === 'End' ? TOTAL : 0
      if (!to) return
      e.preventDefault()
      readAt(to)
    },
  }

  const jump = (id: ChapterId) => {
    const root = scroller.current
    const section = root?.querySelector<HTMLElement>(`[data-chapter="${id}"]`)
    if (!root || !section) return
    const top = section.offsetTop - 43
    if (prefersReducedMotion()) return root.scrollTo({ top })
    // A chapter a long way off: straight to just short of it, then the last of the way at a glide
    const away = top - root.scrollTop
    const reach = root.clientHeight * 0.7
    if (Math.abs(away) > reach * 2) root.scrollTo({ top: top - Math.sign(away) * reach })
    root.scrollTo({ top, behavior: 'smooth' })
  }

  return (
    <div className="v1">
      <div ref={scroller} className="v1__scroll">
        {/* The opening: Niv's question, over the wallpaper */}
        <header className="v1-hero ph-wallpaper">
          <div className="v1-hero__top">
            <span aria-hidden>{SITE.mark}</span>
            <span>{SITE.legalName}</span>
          </div>
          <div className="v1-hero__ask">
            <h2 className="v1-hero__title">{GROUP_NAME}</h2>
            <p className="v1-hero__sub">Niv asked. {TOTAL} people answered.</p>
            <div className="v1-hero__who">Niv</div>
            <p className="v1-hero__bubble">{QUESTION[0]}</p>
            <div className="v1-hero__last">
              <ShrugAvatar size={34} />
              <p className="v1-hero__bubble">
                {QUESTION[1]}
                <Tail />
              </p>
            </div>
          </div>
          <button type="button" className="v1-hero__cue" onClick={() => jump('replies')}>
            <span>What they said</span>
            <ChevronDown size={22} strokeWidth={2.4} aria-hidden />
          </button>
        </header>

        <nav className="v1-chapters" aria-label="Chapters">
          <div ref={chips} className="v1-chapters__row">
            {CHAPTERS.map((c) => (
              <button
                key={c.id}
                type="button"
                className="v1-chapter"
                aria-current={chapter === c.id ? 'true' : undefined}
                onClick={() => {
                  haptic()
                  jump(c.id)
                }}
              >
                {c.label}
              </button>
            ))}
          </div>
        </nav>

        <section className="v1-section v1-replies" data-chapter="replies" aria-label="Replies">
          <header className="v1-head">
            <h2>What they said</h2>
            <p>{TOTAL} people replied to Niv.</p>
          </header>
          <div ref={bar} className="v1-progress" role="slider" tabIndex={0} aria-label="Reply" aria-valuemin={0} aria-valuemax={TOTAL} {...scrubbing}>
            <span className="v1-progress__track">
              <span className="v1-progress__line">
                <span ref={fill} className="v1-progress__fill" />
              </span>
              <span ref={knob} className="v1-progress__knob" />
            </span>
            <span className="v1-progress__count" aria-hidden>
              <span ref={count}>0</span> of {TOTAL}
            </span>
          </div>
          <Thread />
        </section>

        <section className="v1-section" data-chapter="portfolio" aria-label="Portfolio">
          <header className="v1-head">
            <h2>Portfolio</h2>
            <p>
              {COMPANY_COUNT} companies in {VERTICALS.length} verticals.
            </p>
          </header>
          <Verticals />
          <button type="button" className="v1-more" data-shot="finder" onClick={() => openApp('finder')}>
            Search the portfolio
          </button>
        </section>

        <section className="v1-section" data-chapter="faqs" aria-label="FAQs">
          <header className="v1-head">
            <h2>FAQs</h2>
            <p>{FAQS.length} questions.</p>
          </header>
          <Faqs />
        </section>

        <section className="v1-section" data-chapter="cases" aria-label="Case studies">
          <header className="v1-head">
            <h2>Case studies</h2>
            <p>{CASE_STUDIES.length} of them. They’re private. Ask nicely.</p>
          </header>
          <div className="v1-term term ss-term">
            <TerminalLog />
          </div>
          {requested ? (
            <p className="v1-noted" role="status">
              <Check size={18} strokeWidth={2.8} aria-hidden />
              Request noted
            </p>
          ) : (
            <button type="button" className="ph-button v1-request" onClick={() => openSheet('request')}>
              Request access
            </button>
          )}
        </section>

        <section className="v1-section" data-chapter="vip" aria-label="VIP">
          <header className="v1-head">
            <h2>VIP</h2>
            <p>When the drops landed. Photos and videos from the people who got one.</p>
          </header>
          <Gallery />
          <button type="button" className="v1-more" data-shot="photos" onClick={() => openApp('photos')}>
            Browse by drop
          </button>
        </section>

        <footer className="v1-end ph-wallpaper">
          <div className="v1-end__mark" aria-hidden>
            {SITE.mark}
          </div>
          <div className="v1-end__name">{SITE.legalName}</div>
          <a className="v1-end__button" href={SITE.onePager} target="_blank" rel="noreferrer">
            One-pager
            <ArrowUpRight size={17} strokeWidth={2.4} aria-hidden />
          </a>
          <button
            type="button"
            className="v1-end__button v1-end__button--quiet"
            onClick={async () => {
              if ((await share({ title: GROUP_NAME, text: QUESTION.join(' ') })) !== 'copied') return
              setSaid('Link copied')
              setTimeout(() => setSaid(null), 1800)
            }}
          >
            <span role="status">{said ?? `Share ${GROUP_NAME}`}</span>
            {said ? <Check size={17} strokeWidth={2.6} aria-hidden /> : <Share size={16} strokeWidth={2.2} aria-hidden />}
          </button>
        </footer>
      </div>
    </div>
  )
}
