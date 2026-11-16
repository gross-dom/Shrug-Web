import '../../styles/variants/v5.css'
import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react'
import { ArrowUpRight, ChevronUp, Heart, Image as ImageIcon, Lock, Play, Share } from 'lucide-react'
import { QUESTION, TOTAL } from '../../apps/chat'
import { GROUP_NAME, PersonAvatar, relationsOf } from '../../apps/chat-ui'
import { ALL, CompanyLogo, visitLabel } from '../../apps/portfolio-ui'
import { ShrugAvatar } from '../../apps/ui'
import { CASE_STUDIES } from '../../data/caseStudies'
import { MEDIA } from '../../data/drops'
import { ANSWER_PLACEHOLDER, FAQS } from '../../data/faqs'
import { PEOPLE } from '../../data/people'
import { VERTICALS } from '../../data/portfolio'
import { SITE } from '../../data/site'
import { haptic, share } from '../native'
import { openSheet } from '../nav'

// Version 5: the feed. The site as the thing a thumb already knows how to do:
// one reply to a screen, swipe up for the next, sideways for another channel
// (the portfolio, the questions, the drops), double tap to love. Each channel
// is a pager that snaps a screen at a time, and the four sit side by side in a
// pager of their own. With about two hundred screens in all, only the ones
// beside the one on show are filled in.

const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

// ---- A pager: a screen at a time, up and down ----

interface PagerHandle {
  /** Goes to a page: gliding there if it is next door, jumping if it is far. */
  go: (index: number) => void
}

interface PagerProps {
  label: string
  count: number
  /** This channel is the one on show: its neighbours' pages are worth filling in. */
  near: boolean
  kind: (index: number) => string
  look?: (index: number) => CSSProperties | undefined
  render: (index: number) => ReactNode
  onAt?: (index: number) => void
}

const Pager = forwardRef<PagerHandle, PagerProps>(function Pager({ label, count, near, kind, look, render, onAt }, handle) {
  const ref = useRef<HTMLDivElement>(null)
  const [at, setAt] = useState(0)
  const live = useRef(0)
  const settled = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout>>()

  useImperativeHandle(handle, () => ({
    go(index: number) {
      const el = ref.current
      if (!el) return
      const far = Math.abs(index - live.current) > 1
      el.scrollTo({ top: index * el.clientHeight, behavior: far || reduced() ? 'auto' : 'smooth' })
    },
  }))

  useEffect(() => () => clearTimeout(timer.current), [])

  const onScroll = () => {
    const el = ref.current
    if (!el || !el.clientHeight) return
    const index = Math.max(0, Math.min(count - 1, Math.round(el.scrollTop / el.clientHeight)))
    if (index !== live.current) {
      live.current = index
      setAt(index)
      onAt?.(index)
    }
    // Come to rest on a new page: a tick, as a detent gives
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      if (settled.current === live.current) return
      settled.current = live.current
      haptic(8)
    }, 120)
  }

  return (
    <div ref={ref} className="v5-pager" tabIndex={0} role="group" aria-label={label} onScroll={onScroll}>
      {Array.from({ length: count }, (_, i) => (
        // The pages either side are drawn, ready to come in, but only the one on screen can be reached
        <section key={i} className="v5-page" data-kind={kind(i)} style={look?.(i)} aria-hidden={i === at ? undefined : true} {...(i === at ? null : ({ inert: '' } as object))}>
          {Math.abs(i - at) <= (near ? 1 : 0) ? render(i) : null}
        </section>
      ))}
    </div>
  )
})

// ---- Words that fill the room they are given ----

/** The biggest the words go, by how many of them there are. */
const sizeFor = (length: number) => (length <= 70 ? 38 : length <= 120 ? 32 : length <= 190 ? 27 : length <= 280 ? 23 : length <= 400 ? 20 : length <= 560 ? 17.5 : 16)

/** Sets a block of words as large as will fit its box, down to `least`. Reports whether they still spill. */
function useFit(words: string, most: number, least: number) {
  const ref = useRef<HTMLQuoteElement>(null)
  const [over, setOver] = useState(false)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const fit = () => {
      let size = most
      el.style.fontSize = `${size}px`
      // Too tall for the page, or a long word pokes out of the side: a size smaller
      while (size > least && (el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1)) {
        size -= 0.5
        el.style.fontSize = `${size}px`
      }
      setOver(el.scrollHeight > el.clientHeight + 1)
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [words, most, least])
  return { ref, over }
}

// ---- The rail down the right of a page ----

function Rail({ children, at, of }: { children?: ReactNode; at: number; of: number }) {
  return (
    <div className="v5-rail">
      {children}
      <span className="v5-rail__count" aria-label={`${at} of ${of}`}>
        <b>{at}</b>
        <i>/ {of}</i>
      </span>
    </div>
  )
}

function ShareButton({ label, send, onCopied }: { label: string; send: () => Promise<'shared' | 'copied' | 'neither'>; onCopied: () => void }) {
  return (
    <button
      type="button"
      className="v5-rail__button"
      aria-label={label}
      onClick={async () => {
        haptic()
        if ((await send()) === 'copied') onCopied()
      }}
    >
      <Share size={24} strokeWidth={2.1} aria-hidden />
      <span>Share</span>
    </button>
  )
}

// ---- Replies ----

/** The colours a reply's page is built from: a ground of two, and two sheets rising across it. */
const GROUNDS: [string, string, string, string][] = [
  ['#0b1150', '#2b55cf', '#3f8cff', '#8a6dff'],
  ['#1c1470', '#5b3fd6', '#ff66b8', '#ffc56e'],
  ['#07205e', '#2470d8', '#3fe0ee', '#3f8cff'],
  ['#3b0f63', '#a22bb8', '#ff5a3c', '#ffc56e'],
  ['#0a0d44', '#3443c9', '#8a6dff', '#ff66b8'],
  ['#062a52', '#1b84b5', '#3f8cff', '#3fe0ee'],
  ['#4a1238', '#d1437f', '#ffc56e', '#ff5a3c'],
  ['#10103f', '#4a2fd0', '#3fe0ee', '#8a6dff'],
]

const ground = (i: number): CSSProperties => {
  const [a, b, c, d] = GROUNDS[i % GROUNDS.length]!
  return { '--a': a, '--b': b, '--c': c, '--d': d, '--tilt': `${((i * 37) % 17) - 8}deg`, '--lean': `${((i * 53) % 30) - 15}%` } as CSSProperties
}

const Sheets = () => (
  <div className="v5-sheets" aria-hidden>
    <i />
    <i />
  </div>
)

function Ask({ onNext }: { onNext: () => void }) {
  return (
    <div className="v5-ask">
      <Sheets />
      <div className="v5-ask__who">
        <ShrugAvatar size={40} />
        <span>
          <b>Niv</b>
          <i>to {GROUP_NAME}</i>
        </span>
      </div>
      <p className="v5-ask__first">{QUESTION[0]}</p>
      <h2 className="v5-ask__second">{QUESTION[1]}</h2>
      <p className="v5-ask__count">{TOTAL} people answered.</p>
      <button type="button" className="v5-ask__cue" onClick={onNext}>
        <ChevronUp size={22} strokeWidth={2.6} aria-hidden />
        <span>Swipe up</span>
      </button>
    </div>
  )
}

const Reply = memo(function Reply({ index, loved, onLove, onCopied }: { index: number; loved: boolean; onLove: (index: number, on?: boolean) => void; onCopied: () => void }) {
  const person = PEOPLE[index]!
  const quote = person.quote ?? ''
  const { ref, over } = useFit(quote, sizeFor(quote.length), 13)
  const [bursts, setBursts] = useState<{ id: number; x: number; y: number }[]>([])
  const last = useRef({ at: 0, x: 0, y: 0 })

  /** Two taps close together, in one place: loved. */
  const onTap = (e: MouseEvent<HTMLElement>) => {
    if ((e.target as HTMLElement).closest('button, a')) return
    const now = e.timeStamp
    const near = Math.hypot(e.clientX - last.current.x, e.clientY - last.current.y) < 44
    if (now - last.current.at < 330 && near) {
      const box = e.currentTarget.getBoundingClientRect()
      const burst = { id: now, x: e.clientX - box.left, y: e.clientY - box.top }
      setBursts((b) => [...b, burst])
      onLove(index, true)
      haptic(12)
      last.current.at = 0
    } else last.current = { at: now, x: e.clientX, y: e.clientY }
  }

  return (
    <article className="v5-reply" aria-label={`${person.name}, ${person.role}`} onClick={onTap}>
      <Sheets />
      <blockquote ref={ref} className="v5-reply__quote" data-over={over || undefined}>
        <span>{quote}</span>
      </blockquote>
      {over && (
        <button type="button" className="v5-reply__more" onClick={() => openSheet(`person:${index}`)}>
          Read it all
        </button>
      )}
      <div className="v5-reply__foot">
        <button type="button" className="v5-reply__who" aria-label={`${person.name}, ${person.role}. More about them.`} onClick={() => openSheet(`person:${index}`)}>
          <PersonAvatar index={index} size={44} />
          <span className="v5-reply__name">
            <b>{person.name}</b>
            <i>{person.role}</i>
            {person.relations.length > 0 && (
              <span className="v5-reply__tags">
                {relationsOf(index).map((label) => (
                  <em key={label}>{label}</em>
                ))}
              </span>
            )}
          </span>
        </button>
        <Rail at={index + 1} of={TOTAL}>
          <button
            type="button"
            className="v5-rail__button"
            aria-label={loved ? `Loved. Take it back.` : `Love ${person.name}’s reply`}
            aria-pressed={loved}
            onClick={() => {
              haptic()
              onLove(index)
            }}
          >
            <Heart size={26} strokeWidth={2.1} fill={loved ? 'currentColor' : 'none'} aria-hidden />
            <span>{loved ? 'Loved' : 'Love'}</span>
          </button>
          <ShareButton label={`Share ${person.name}’s reply`} send={() => share({ title: GROUP_NAME, text: `“${quote}” ${person.name}, ${person.role}.` })} onCopied={onCopied} />
        </Rail>
      </div>
      {bursts.map((b) => (
        <span key={b.id} className="v5-burst" style={{ left: b.x, top: b.y }} aria-hidden onAnimationEnd={() => setBursts((all) => all.filter((x) => x.id !== b.id))}>
          <Heart size={96} strokeWidth={0} fill="currentColor" />
        </span>
      ))}
    </article>
  )
})

// ---- Portfolio ----

/** Where each vertical's companies begin, in the one long run of them. */
const STARTS = VERTICALS.reduce<number[]>((starts, v, i) => [...starts, i ? starts[i - 1]! + VERTICALS[i - 1]!.companies.length : 0], [])
const verticalAt = (index: number) => {
  let v = 0
  while (v + 1 < STARTS.length && STARTS[v + 1]! <= index) v++
  return v
}

const TINTS = ['#e8eeff', '#efe9ff', '#ffe9f4', '#fff1dc', '#e3f8fb', '#e9f0ff']

const Company = memo(function Company({ index, onCopied }: { index: number; onCopied: () => void }) {
  const company = ALL[index]!
  const visit = visitLabel(company)
  return (
    <article className="v5-company" aria-label={`${company.name}, ${company.vertical}`}>
      <CompanyLogo company={company} size={108} />
      <p className="v5-company__kind">{company.vertical}</p>
      <h2 className="v5-company__name">{company.name}</h2>
      {company.blurb && <p className="v5-company__blurb">{company.blurb}</p>}
      {company.url && visit && (
        <a className="ph-button v5-company__visit" href={company.url} target="_blank" rel="noreferrer">
          {visit}
          <ArrowUpRight size={17} strokeWidth={2.4} aria-hidden />
        </a>
      )}
      <Rail at={index + 1} of={ALL.length}>
        <ShareButton label={`Share ${company.name}`} send={() => share({ title: company.name, text: `${company.name}${company.blurb ? `: ${company.blurb}` : ''}`, url: company.url ?? undefined })} onCopied={onCopied} />
      </Rail>
    </article>
  )
})

function Portfolio({ near, onCopied }: { near: boolean; onCopied: () => void }) {
  const pager = useRef<PagerHandle>(null)
  const chips = useRef<HTMLDivElement>(null)
  const [vertical, setVertical] = useState(0)

  // The vertical on show stays in sight in its own row, moving only that row
  useEffect(() => {
    const row = chips.current
    const chip = row?.children[vertical] as HTMLElement | undefined
    if (!row || !chip) return
    row.scrollTo({ left: chip.offsetLeft - (row.clientWidth - chip.offsetWidth) / 2, behavior: reduced() ? 'auto' : 'smooth' })
  }, [vertical])

  return (
    <>
      <Pager
        ref={pager}
        label="Portfolio"
        count={ALL.length}
        near={near}
        kind={() => 'company'}
        look={(i) => ({ '--tint': TINTS[verticalAt(i) % TINTS.length] }) as CSSProperties}
        render={(i) => <Company index={i} onCopied={onCopied} />}
        onAt={(i) => setVertical(verticalAt(i))}
      />
      <div ref={chips} className="v5-verticals" role="group" aria-label="Verticals">
        {VERTICALS.map((v, i) => (
          <button key={v.name} type="button" className="ph-chip" aria-pressed={i === vertical} onClick={() => pager.current?.go(STARTS[i]!)}>
            {v.name}
          </button>
        ))}
      </div>
    </>
  )
}

// ---- FAQs ----

const Faq = memo(function Faq({ index, onCopied }: { index: number; onCopied: () => void }) {
  const faq = FAQS[index]!
  return (
    <article className="v5-faq" aria-label={faq.question}>
      <p className="v5-faq__n">
        Question {index + 1} of {FAQS.length}
      </p>
      <h2 className="v5-faq__q">{faq.question}</h2>
      {faq.answer ? <p className="v5-faq__a">{faq.answer}</p> : <p className="v5-faq__todo">{ANSWER_PLACEHOLDER}</p>}
      <Rail at={index + 1} of={FAQS.length}>
        <ShareButton label="Share this question" send={() => share({ title: `${SITE.name} FAQs`, text: faq.question })} onCopied={onCopied} />
      </Rail>
    </article>
  )
})

// ---- Drops, and behind them what's kept private ----

const Drop = memo(function Drop({ index }: { index: number }) {
  const slot = MEDIA[index]!
  const video = slot.kind === 'video'
  return (
    <article className="v5-drop" data-media={slot.kind} aria-label={`${slot.drop}: a ${slot.kind} to come`}>
      {slot.src ? (
        video ? (
          <video className="v5-drop__media" src={slot.src} controls playsInline preload="metadata" />
        ) : (
          <img className="v5-drop__media" src={slot.src} alt={`${slot.drop}${slot.from ? `, from ${slot.from}` : ''}`} />
        )
      ) : (
        <div className="v5-drop__slot">
          {video ? <Play size={34} strokeWidth={1.6} aria-hidden /> : <ImageIcon size={34} strokeWidth={1.6} aria-hidden />}
          <span>{video ? 'Video slot' : 'Photo slot'}</span>
        </div>
      )}
      <div className="v5-drop__cap">
        <b>{slot.from ?? '[Name]'}</b>
        <span>{slot.drop}</span>
      </div>
      <Rail at={index + 1} of={MEDIA.length} />
    </article>
  )
})

function Private() {
  return (
    <article className="v5-private" aria-label="Case studies and the one-pager">
      <span className="v5-private__lock" aria-hidden>
        <Lock size={26} strokeWidth={2.2} />
      </span>
      <h2 className="v5-private__title">Case studies</h2>
      <p className="v5-private__sub">They’re private. Ask nicely.</p>
      <ul className="v5-private__list">
        {CASE_STUDIES.map((name) => (
          <li key={name}>{name}</li>
        ))}
      </ul>
      <button type="button" className="ph-button" onClick={() => openSheet('request')}>
        Request access
      </button>
      <a className="v5-private__pager" href={SITE.onePager} target="_blank" rel="noreferrer">
        Or read the one-pager
        <ArrowUpRight size={16} strokeWidth={2.4} aria-hidden />
      </a>
    </article>
  )
}

// ---- The four channels, side by side ----

const CHANNELS = ['Replies', 'Portfolio', 'FAQs', 'Drops']

export default function V5(_: { active: boolean }) {
  const rail = useRef<HTMLDivElement>(null)
  const tabs = useRef<HTMLDivElement>(null)
  const ink = useRef<HTMLSpanElement>(null)
  const replies = useRef<PagerHandle>(null)
  const [channel, setChannel] = useState(0)
  const [loved, setLoved] = useState<ReadonlySet<number>>(() => new Set())
  const [toast, setToast] = useState(false)

  /** Puts the mark under the tabs the sideways scroll is between, as far across as it is. */
  const paint = useCallback(() => {
    const el = rail.current
    const mark = ink.current
    const all = tabs.current?.querySelectorAll<HTMLElement>('[role="tab"]')
    if (!el || !mark || !all?.length || !el.clientWidth) return
    const p = Math.max(0, Math.min(all.length - 1, el.scrollLeft / el.clientWidth))
    const i = Math.min(all.length - 1, Math.floor(p))
    const a = all[i]!
    const b = all[Math.min(all.length - 1, i + 1)]!
    const f = p - i
    mark.style.width = `${a.offsetWidth + (b.offsetWidth - a.offsetWidth) * f}px`
    mark.style.transform = `translateX(${a.offsetLeft + (b.offsetLeft - a.offsetLeft) * f}px)`
    const now = Math.round(p)
    setChannel((c) => (c === now ? c : now))
  }, [])

  useLayoutEffect(() => {
    paint()
    const el = rail.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      // The screen turned or changed size: stay on the channel that was showing
      el.scrollLeft = Math.round(el.scrollLeft / Math.max(1, el.clientWidth)) * el.clientWidth
      paint()
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [paint])

  const show = (i: number) => rail.current?.scrollTo({ left: i * rail.current.clientWidth, behavior: reduced() ? 'auto' : 'smooth' })

  const love = useCallback((index: number, on?: boolean) => {
    setLoved((was) => {
      const next = new Set(was)
      if (on ?? !was.has(index)) next.add(index)
      else next.delete(index)
      return next
    })
  }, [])

  const copied = useCallback(() => {
    setToast(true)
    setTimeout(() => setToast(false), 1700)
  }, [])

  return (
    <div className="v5">
      <div ref={rail} className="v5-channels" onScroll={paint}>
        <section className="v5-channel" aria-label="Replies" {...(channel === 0 ? null : ({ inert: '' } as object))}>
          <Pager
            ref={replies}
            label="Replies, one to a screen"
            count={TOTAL + 1}
            near={channel === 0}
            kind={(i) => (i ? 'reply' : 'ask')}
            look={(i) => (i ? ground(i - 1) : ground(0))}
            render={(i) => (i ? <Reply index={i - 1} loved={loved.has(i - 1)} onLove={love} onCopied={copied} /> : <Ask onNext={() => replies.current?.go(1)} />)}
          />
        </section>
        <section className="v5-channel" aria-label="Portfolio" {...(channel === 1 ? null : ({ inert: '' } as object))}>
          <Portfolio near={channel === 1} onCopied={copied} />
        </section>
        <section className="v5-channel" aria-label="FAQs" {...(channel === 2 ? null : ({ inert: '' } as object))}>
          <Pager label="FAQs, one to a screen" count={FAQS.length} near={channel === 2} kind={() => 'faq'} render={(i) => <Faq index={i} onCopied={copied} />} />
        </section>
        <section className="v5-channel" aria-label="Drops" {...(channel === 3 ? null : ({ inert: '' } as object))}>
          <Pager label="Drops, one to a screen" count={MEDIA.length + 1} near={channel === 3} kind={(i) => (i < MEDIA.length ? 'drop' : 'private')} render={(i) => (i < MEDIA.length ? <Drop index={i} /> : <Private />)} />
        </section>
      </div>
      <div ref={tabs} className="v5-tabs" role="tablist" aria-label="Channels">
        <span ref={ink} className="v5-tabs__ink" aria-hidden />
        {CHANNELS.map((name, i) => (
          <button key={name} type="button" role="tab" className="v5-tab" aria-selected={i === channel} onClick={() => show(i)}>
            {name}
          </button>
        ))}
      </div>
      <div className="v5-toast" role="status" data-show={toast || undefined}>
        {toast ? 'Copied' : ''}
      </div>
    </div>
  )
}
