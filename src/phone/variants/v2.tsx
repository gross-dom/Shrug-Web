import '../../styles/variants/v2.css'
import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { ArrowUp, Check, Image as ImageIcon, Lock, Play, Plus, UsersRound } from 'lucide-react'
import { TOTAL } from '../../apps/chat'
import { clock, GROUP_NAME, PersonAvatar, Scroller } from '../../apps/chat-ui'
import { companiesIn, companyNamed, CompanyLogo, hostOf } from '../../apps/portfolio-ui'
import { clearJump, inbox, showInGroup } from '../../apps/state'
import { isEmail, term } from '../../apps/Terminal'
import { CASE_STUDIES } from '../../data/caseStudies'
import { MEDIA } from '../../data/drops'
import { FAQS } from '../../data/faqs'
import { PEOPLE } from '../../data/people'
import { COMPANY_COUNT, VERTICALS } from '../../data/portfolio'
import { SITE } from '../../data/site'
import { prefersReducedMotion } from '../../os/dom'
import { AppIcon, DocumentIcon } from '../../os/icons'
import { useStore } from '../../os/store'
import { answered, askCase, askFaq, bring, convo, isHere, pick, say, sendOnePager, sendSticker, showMedia, startConvo, suggestions, type Chip } from '../convo'
import { haptic } from '../native'
import { Field, placeOrigin, Replies, ThreadBar, threadNodes, useLoveTap } from '../Thread'
import { Chips } from '../ui'

// Version 2: Messages, with apps where the keyboard is. The conversation is
// the whole screen, as before. The plus beside the field swaps the keyboard's
// place for the site itself, the way iMessage keeps its apps: the people to
// ask by name, the portfolio as a sheet of stickers, the questions, the locked
// case studies, the drops and the one-pager. Whatever is tapped there is sent
// as the visitor's own message, and answered in the thread.

type AppId = 'people' | 'portfolio' | 'faqs' | 'cases' | 'vip' | 'onepager'

const APPS: { id: AppId; label: string; name: string; icon: ReactNode }[] = [
  {
    id: 'people',
    label: 'People',
    name: 'People',
    icon: (
      <span className="v2-glyph">
        <UsersRound size={19} strokeWidth={2.3} aria-hidden />
      </span>
    ),
  },
  { id: 'portfolio', label: 'Portfolio', name: 'Portfolio', icon: <AppIcon id="finder" /> },
  { id: 'faqs', label: 'FAQs', name: 'FAQs', icon: <AppIcon id="notes" /> },
  { id: 'cases', label: 'Cases', name: 'Case studies', icon: <AppIcon id="terminal" /> },
  { id: 'vip', label: 'VIP', name: 'VIP', icon: <AppIcon id="photos" /> },
  { id: 'onepager', label: 'One-pager', name: 'One-pager', icon: <DocumentIcon /> },
]

/** A first name, or two: "Dennis Xu & Kevin Moody" is "Dennis & Kevin". */
const first = (name: string) =>
  name
    .split(' & ')
    .map((n) => n.split(' ')[0])
    .join(' & ')

/** Where something tapped has its words: what its bubble forms out of. */
type Send = (words: Element | null, run: () => void) => void

// ---- The apps ----

/** Everyone in the conversation. A tap asks one of them by name; someone who has answered is shown instead. */
function People({ here, onPick }: { here: Set<number>; onPick: (index: number, el: HTMLElement) => void }) {
  return (
    <ul className="v2-people">
      {PEOPLE.map((person, i) => (
        <li key={i}>
          <button type="button" className="v2-person" data-here={here.has(i) || undefined} aria-label={`${person.name}, ${person.role}. ${here.has(i) ? 'Show their reply.' : 'Ask them.'}`} onClick={(e) => onPick(i, e.currentTarget)}>
            <span className="v2-person__face">
              <PersonAvatar index={i} size={46} />
            </span>
            <span className="v2-person__name">{first(person.name)}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

const VERTICAL_OPTIONS = [{ value: -1, label: 'All' }, ...VERTICALS.map((v, i) => ({ value: i, label: v.name }))]

/** The portfolio as a sheet of stickers: a tap peels one off and sends it. */
function Stickers({ send }: { send: Send }) {
  const [vertical, setVertical] = useState(-1)
  const shown = useMemo(() => companiesIn(vertical, ''), [vertical])
  const sheet = useRef<HTMLUListElement>(null)
  // Another vertical starts from its top
  useEffect(() => {
    sheet.current?.parentElement?.scrollTo({ top: 0 })
  }, [vertical])
  return (
    <>
      <div className="v2-apps__pinned">
        <Chips label="Verticals" value={vertical} options={VERTICAL_OPTIONS} onChange={setVertical} />
      </div>
      <ul ref={sheet} className="v2-stickers" aria-label={`${vertical === -1 ? COMPANY_COUNT : shown.length} companies`}>
        {shown.map((company) => (
          <li key={company.name}>
            <button type="button" className="v2-sticker" aria-label={`Send the ${company.name} sticker`} onClick={() => send(null, () => sendSticker(company.name))}>
              <span className="v2-sticker__logo" data-sticker-source={company.name}>
                <CompanyLogo company={company} size={58} />
              </span>
              <span className="v2-sticker__name">{company.name}</span>
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}

/** The questions, ready to send. */
function Questions({ asked, send }: { asked: number[]; send: Send }) {
  return (
    <ul className="v2-faqs">
      {FAQS.map((faq, i) => {
        const done = asked.includes(i)
        return (
          <li key={i}>
            <button type="button" className="v2-faq" data-asked={done || undefined} aria-label={`Ask: ${faq.question}${done ? ' (asked)' : ''}`} onClick={(e) => send(e.currentTarget.querySelector('.v2-faq__q'), () => askFaq(i))}>
              <span className="v2-faq__q">{faq.question}</span>
              <span className="v2-faq__go" aria-hidden>
                {done ? <Check size={15} strokeWidth={3} /> : <ArrowUp size={16} strokeWidth={2.8} />}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

/** The case studies, locked, and the one thing that opens them: an email. */
function Cases({ send, onTyping }: { send: Send; onTyping: (typing: boolean) => void }) {
  const step = useStore(term, (t) => t.step)
  const [email, setEmail] = useState('')
  const [wrong, setWrong] = useState(false)
  const [nudged, setNudged] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const done = step === 'done'
  const ready = email.trim().length > 0

  useEffect(() => () => onTyping(false), []) // eslint-disable-line react-hooks/exhaustive-deps

  /** The field gives a shake: this is where the key goes. */
  const nudge = () => {
    haptic([8, 50, 8])
    setNudged((n) => n + 1)
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!ready) return
    if (!isEmail(email)) {
      setWrong(true)
      return nudge()
    }
    send(input.current, () => say(email, 'chip'))
    setEmail('')
    input.current?.blur()
  }

  return (
    <div className="v2-cases">
      <ul className="v2-cases__list">
        {CASE_STUDIES.map((name) => {
          const company = companyNamed(name)
          return (
            <li key={name}>
              <button
                type="button"
                className="v2-case"
                aria-label={`${name} case study, locked. Ask for it.`}
                onClick={(e) => {
                  // Asked already, and Niv is waiting on an email: the field says so
                  if (convo.get().awaiting === 'email' && !done) return nudge()
                  send(e.currentTarget.querySelector('.v2-case__name'), () => askCase(name))
                }}
              >
                <span className="v2-case__logo">
                  {company ? <CompanyLogo company={company} size={30} /> : <span className="logo" data-empty style={{ width: 30, height: 30, fontSize: 13 }} aria-hidden>{name[0]}</span>}
                  <span className="v2-case__lock" aria-hidden>
                    <Lock size={9} strokeWidth={3} />
                  </span>
                </span>
                <span className="v2-case__name">{name}</span>
              </button>
            </li>
          )
        })}
      </ul>
      {done ? (
        <p className="v2-cases__done" role="status">
          <Check size={17} strokeWidth={2.8} aria-hidden />
          Request noted
        </p>
      ) : (
        <form key={nudged} className="v2-cases__form" data-nudged={nudged ? '' : undefined} noValidate onSubmit={submit}>
          <Lock className="v2-cases__key" size={15} strokeWidth={2.4} aria-hidden />
          <input
            ref={input}
            className="v2-cases__input"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="send"
            placeholder="Your email, for access"
            aria-label="Your email, to ask for access"
            aria-invalid={wrong || undefined}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              setWrong(false)
            }}
            onFocus={() => onTyping(true)}
            onBlur={() => onTyping(false)}
          />
          {/* Kept from taking the focus, so the keyboard doesn't drop away under the tap */}
          <button type="submit" className="v2-cases__send" aria-label="Send request" data-ready={ready || undefined} aria-disabled={!ready} tabIndex={ready ? 0 : -1} onMouseDown={(e) => e.preventDefault()}>
            <ArrowUp size={18} strokeWidth={2.8} aria-hidden />
          </button>
        </form>
      )}
    </div>
  )
}

/** The drops' photos and videos. A tap asks Niv for one. */
function Media({ send }: { send: Send }) {
  return (
    <ul className="v2-media">
      {MEDIA.map((slot, i) => {
        const video = slot.kind === 'video'
        return (
          <li key={i}>
            <button type="button" className="v2-tile" data-kind={slot.kind} aria-label={`${slot.drop}, a ${slot.kind}. Ask Niv for it.`} onClick={(e) => send(e.currentTarget.querySelector('.v2-tile__cap'), () => showMedia(i))}>
              {slot.src && !video ? (
                <img src={slot.src} alt="" loading="lazy" />
              ) : (
                <span className="v2-tile__slot" aria-hidden>
                  {video ? <Play size={20} strokeWidth={1.7} /> : <ImageIcon size={20} strokeWidth={1.7} />}
                </span>
              )}
              <span className="v2-tile__cap">{slot.drop}</span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

/** The one-pager: one thing to ask for. */
function OnePager({ send }: { send: Send }) {
  return (
    <div className="v2-pager">
      <span className="v2-pager__art" aria-hidden>
        <DocumentIcon />
      </span>
      <span className="v2-pager__text">
        <b>Shrug one-pager</b>
        <span>{hostOf(SITE.onePager)}</span>
      </span>
      <button type="button" className="ph-button" onClick={(e) => send(e.currentTarget.querySelector('span'), sendOnePager)}>
        <span>Send me the one-pager</span>
      </button>
    </div>
  )
}

// ---- The times, behind the right edge ----

/** As far as the thread pulls across before it starts to resist. */
const REVEAL = 74
/** The room a time takes at the right edge, once it is in. */
const ROOM = 66

interface Time {
  key: string
  top: number
  text: string
}

/** Something that moves over as the times come in, and how far for each point of the pull. */
interface Moved {
  el: HTMLElement
  k: number
}

/** Drag the thread left and each message's time comes in from the right edge,
 * as in Messages: the visitor's own bubbles move over to make room, everyone
 * else's stay put (unless they would sit under their time), and it all
 * springs back on letting go. */
function useTimes() {
  const wrap = useRef<HTMLDivElement>(null)
  const layer = useRef<HTMLDivElement>(null)
  const [times, setTimes] = useState<Time[] | null>(null)
  const drag = useRef<{ id: number; x: number; y: number; on: boolean; moved: Moved[] } | null>(null)
  const settling = useRef<{ moved: Moved[]; timer: ReturnType<typeof setTimeout> } | null>(null)

  const finish = () => {
    const s = settling.current
    if (!s) return
    clearTimeout(s.timer)
    for (const { el } of s.moved) el.style.transition = el.style.transform = ''
    settling.current = null
    setTimes(null)
  }

  useEffect(() => finish, []) // eslint-disable-line react-hooks/exhaustive-deps

  /** Which messages are on screen, where each one's time goes, and what has to move for them. */
  const measure = (): Moved[] => {
    const scroller = wrap.current?.querySelector<HTMLElement>('.chat__scroll')
    const flow = wrap.current?.querySelector<HTMLElement>('.chat__flow')
    if (!scroller || !flow) return []
    const view = scroller.getBoundingClientRect()
    const base = flow.getBoundingClientRect()
    const seen = (el: Element) => {
      const r = el.getBoundingClientRect()
      return r.bottom > view.top - 60 && r.top < view.bottom + 60 ? r : null
    }
    const out: Time[] = []
    flow.querySelectorAll<HTMLElement>('[data-at]').forEach((el, i) => {
      const r = el.hasAttribute('data-typing') ? null : seen(el)
      if (r) out.push({ key: `${i}`, top: r.top - base.top + r.height / 2, text: clock(Number(el.dataset.at)) })
    })
    setTimes(out)
    const moved: Moved[] = []
    flow.querySelectorAll<HTMLElement>('.ss-bubble-row, .chat-attach, .ss-receipt').forEach((el) => {
      if (!seen(el)) return
      if (el.matches('[data-from="me"], .chat-attach--me, .ss-receipt')) return void moved.push({ el, k: 1 })
      // Someone else's: only as far as it takes to keep clear of its time
      const body = el.matches('.ss-bubble-row') ? el.querySelector('.ss-bubble') : el.lastElementChild
      const over = body ? body.getBoundingClientRect().right - (view.right - ROOM) : 0
      if (over > 0) moved.push({ el, k: Math.min(1, over / REVEAL) })
    })
    return moved
  }

  const place = (moved: Moved[], by: number) => {
    for (const { el, k } of moved) el.style.transform = `translate3d(${(-by * k).toFixed(1)}px, 0, 0)`
    if (layer.current) layer.current.style.transform = `translate3d(${-by}px, 0, 0)`
  }

  const down = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return
    finish()
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, on: false, moved: [] }
  }

  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    const dx = e.clientX - d.x
    const dy = e.clientY - d.y
    if (!d.on) {
      if (Math.abs(dx) < 9 && Math.abs(dy) < 9) return
      // Up, down or to the right: not this
      if (dx > 0 || Math.abs(dy) > Math.abs(dx) * 0.8) return void (drag.current = null)
      d.on = true
      d.x = e.clientX
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        // The pointer has already gone
      }
      d.moved = measure()
      return
    }
    const pull = Math.max(0, d.x - e.clientX)
    place(d.moved, pull <= REVEAL ? pull : REVEAL + (pull - REVEAL) * 0.16)
  }

  const up = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    drag.current = null
    if (!d.on) return
    const moved = layer.current ? [...d.moved, { el: layer.current, k: 1 }] : d.moved
    const still = prefersReducedMotion()
    for (const { el } of moved) {
      el.style.transition = still ? 'none' : 'transform 0.46s cubic-bezier(0.2, 0.9, 0.25, 1)'
      el.style.transform = 'translate3d(0, 0, 0)'
    }
    settling.current = { moved, timer: setTimeout(finish, still ? 0 : 480) }
  }

  const foot = times && (
    <div ref={layer} className="v2-times" aria-hidden>
      {times.map((t) => (
        <span key={t.key} style={{ top: t.top }}>
          {t.text}
        </span>
      ))}
    </div>
  )

  return { wrap, foot, handlers: { onPointerDown: down, onPointerMove: move, onPointerUp: up, onPointerCancel: up } }
}

// ---- The screen ----

/** The suggested replies, kept short: whatever steers, and the next few things to say. */
function slim(all: Chip[], apps: boolean) {
  let said = 0
  return all.filter((chip) => {
    if (chip.kind === 'resume' || chip.kind === 'decline') return true
    // With the apps up, they are the things to say
    if (apps) return false
    return chip.kind === 'others' || ++said <= 3
  })
}

export default function V2({ active }: { active: boolean }) {
  useEffect(() => startConvo(), [])

  const state = useStore(convo, (s) => s)
  const jump = useStore(inbox, (s) => s.jump)
  const root = useRef<HTMLDivElement>(null)
  const origin = useRef<HTMLSpanElement>(null)
  /** The apps are up, where the keyboard would be. */
  const [open, setOpen] = useState(false)
  /** They have been up at least once: until then there is nothing to draw. */
  const [used, setUsed] = useState(false)
  const [app, setApp] = useState<AppId>('portfolio')
  /** The email field among the apps has the keyboard. */
  const [typing, setTyping] = useState(false)
  const [height, setHeight] = useState(336)

  const nodes = useMemo(() => threadNodes(state.items, state.startedAt, state.loved), [state.items, state.startedAt, state.loved])
  const chips = useMemo(() => slim(suggestions(state), open), [state, open])
  const here = useMemo(() => new Set(state.items.flatMap((i) => (i.kind === 'person' ? [i.index] : []))), [state.items])
  const times = useTimes()
  const onTap = useLoveTap(() => haptic())

  // The apps take the keyboard's share of the screen
  useEffect(() => {
    const el = root.current
    if (!el) return
    const fit = () => setHeight(Math.round(Math.max(Math.min(el.clientHeight * 0.46, 420), Math.min(228, el.clientHeight * 0.6))))
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Escape puts them away, as it would a keyboard
  useEffect(() => {
    if (!open) return
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [open])

  // A tick when an answer to the visitor lands: Niv's, or someone asked for by
  // name. The group's own replies come in quietly.
  const spoke = state.items.some((i) => i.kind === 'you' || i.kind === 'sticker')
  const landed = state.items.reduce((n, i) => n + ((i.kind === 'niv' && !i.typing) || i.kind === 'shot' || i.kind === 'link' || i.kind === 'company' || i.kind === 'media' || i.kind === 'action' || (i.kind === 'person' && !i.typing && state.early.includes(i.index)) ? 1 : 0), 0)
  const before = useRef(landed)
  useEffect(() => {
    if (landed > before.current && spoke && !document.hidden) haptic(8)
    before.current = landed
  }, [landed, spoke])

  /** Something was tapped to say it: a tick, and its bubble forms out of the words that were tapped. */
  const send: Send = (words, run) => {
    if (words) placeOrigin(origin.current, root.current, words)
    haptic()
    run()
  }

  const toggle = () => {
    haptic()
    if (!open) {
      // The keyboard, if it is up, makes way
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
      setUsed(true)
    }
    setOpen(!open)
  }

  const onPerson = (index: number, el: HTMLElement) => {
    // Already said their piece: there it is
    if (isHere(index)) {
      haptic()
      return showInGroup(index)
    }
    send(el.querySelector('.v2-person__name'), () => bring(index, true))
  }

  /** A swipe down across the strip puts the apps away, as one does a keyboard. */
  const swipe = useRef<{ id: number; x: number; y: number } | null>(null)
  const swiped = useRef(0)
  const strip = {
    onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.isPrimary) swipe.current = { id: e.pointerId, x: e.clientX, y: e.clientY }
    },
    onPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => {
      const d = swipe.current
      if (!d || d.id !== e.pointerId) return
      const dy = e.clientY - d.y
      if (dy < 26 || dy < Math.abs(e.clientX - d.x) * 1.2) return
      swipe.current = null
      swiped.current = e.timeStamp
      haptic()
      setOpen(false)
    },
    onPointerUp: () => (swipe.current = null),
    onPointerCancel: () => (swipe.current = null),
  }

  const current = APPS.find((a) => a.id === app)!

  return (
    <div className="v2" data-apps={open || undefined} data-typing={(open && typing) || undefined}>
      <div ref={root} className="ph-page ph-thread" data-fixed>
        <ThreadBar />
        <div className="ph-page__content">
          <div ref={times.wrap} className="v2-thread" {...times.handlers}>
            <Scroller label={GROUP_NAME} nodes={nodes} jump={jump} onJumped={clearJump} active={active} onTap={onTap} foot={times.foot} />
          </div>
          <Replies
            chips={chips}
            left={TOTAL - answered(state)}
            onPick={(chip, el) =>
              send(el.querySelector('span') ?? el, () => pick(chip))
            }
          />
          <Field
            leading={
              <button type="button" className="v2-plus" aria-label={open ? 'Close apps' : 'Apps'} aria-expanded={open} aria-controls="v2-apps" aria-disabled={!state.ready || undefined} onClick={state.ready ? toggle : undefined}>
                <Plus size={20} strokeWidth={2.5} aria-hidden />
              </button>
            }
            onFocus={() => setOpen(false)}
            onSent={() => haptic()}
          />
          <div className="v2-apps" id="v2-apps" data-open={open || undefined} style={{ '--apps-h': `${height}px` } as CSSProperties} {...(open ? null : ({ inert: '' } as object))}>
            {used && (
              <div className="v2-apps__inner">
                <div className="v2-strip" role="tablist" aria-label="Apps" {...strip}>
                  {APPS.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      role="tab"
                      className="v2-strip__app"
                      id={`v2-tab-${a.id}`}
                      aria-selected={a.id === app}
                      aria-controls="v2-app"
                      aria-label={a.name}
                      onClick={(e) => {
                        // The end of a swipe down, not a tap
                        if (a.id === app || e.timeStamp - swiped.current < 400) return
                        haptic(6)
                        setApp(a.id)
                      }}
                    >
                      <span className="v2-strip__icon">{a.icon}</span>
                      <span className="v2-strip__label" aria-hidden>
                        {a.label}
                      </span>
                    </button>
                  ))}
                </div>
                <div key={app} className="v2-apps__body" id="v2-app" role="tabpanel" aria-label={current.name} data-app={app}>
                  {app === 'people' && <People here={here} onPick={onPerson} />}
                  {app === 'portfolio' && <Stickers send={send} />}
                  {app === 'faqs' && <Questions asked={state.faqs} send={send} />}
                  {app === 'cases' && <Cases send={send} onTyping={setTyping} />}
                  {app === 'vip' && <Media send={send} />}
                  {app === 'onepager' && <OnePager send={send} />}
                </div>
              </div>
            )}
          </div>
        </div>
        {/* Wherever the thing that was tapped had its words: a bubble forms out of here */}
        <span ref={origin} className="chip-origin" data-target="chip-origin" aria-hidden />
      </div>
    </div>
  )
}
