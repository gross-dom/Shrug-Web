import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent, type MouseEvent, type ReactElement, type ReactNode } from 'react'
import { ArrowUp, ArrowUpRight, Check, ChevronRight, Image as ImageIcon, Play, Share } from 'lucide-react'
import { QUESTION, TOTAL } from '../apps/chat'
import { GROUP_NAME, GroupAvatar, PersonAvatar, QUOTES, Scroller, stamp } from '../apps/chat-ui'
import { companyNamed, CompanyLogo, hostOf, type Listed } from '../apps/portfolio-ui'
import { clearJump, inbox, setDrop } from '../apps/state'
import { ShrugAvatar } from '../apps/ui'
import { MEDIA } from '../data/drops'
import { PEOPLE } from '../data/people'
import { SITE } from '../data/site'
import { Bubble, Receipt, Stamp } from '../kit/messages'
import { APPS } from '../os/apps'
import { prefersReducedMotion } from '../os/dom'
import { DocumentIcon } from '../os/icons'
import { useStore } from '../os/store'
import { convo, love, pick, say, suggestions, type Chip, type Item } from './convo'
import { openApp, openSheet } from './nav'
import { Shot } from './Shot'

// The phone's one screen: the Shrug Family conversation, with the visitor in
// it. Niv and the group are on the left, the visitor's own replies on the
// right, and under the messages the replies they might send next. The kit
// draws the bubbles; the scrolling is the desktop's.

/** Sends the site on through the phone's own share sheet, or copies its address where there is none. */
async function share(): Promise<'shared' | 'copied' | 'neither'> {
  const url = `${location.origin}${location.pathname}`
  try {
    if (navigator.share) {
      await navigator.share({ title: GROUP_NAME, text: QUESTION.join(' '), url })
      return 'shared'
    }
    await navigator.clipboard.writeText(url)
    return 'copied'
  } catch {
    // Dismissed, or not allowed: nothing to say about it
    return 'neither'
  }
}

/** The real Messages or Mail, with a first line written. Null until Shrug's number or address is known. */
function reachLink() {
  const line = `hey, I found ${GROUP_NAME}.`
  const { sms, email } = SITE.contact
  // iOS takes the first line after an ampersand, everything else after a question mark
  if (sms) return { href: `sms:${sms}${/iP(hone|ad|od)|Macintosh/.test(navigator.userAgent) ? '&' : '?'}body=${encodeURIComponent(line)}`, label: 'Open Messages' }
  if (email) return { href: `mailto:${email}?subject=${encodeURIComponent(GROUP_NAME)}&body=${encodeURIComponent(line)}`, label: 'Open Mail' }
  return null
}

/** Something Niv sent that isn't words: a button that does a real thing. */
function Action({ act }: { act: 'people' | 'share' | 'reach' }) {
  const [said, setSaid] = useState<string | null>(null)
  if (act === 'people')
    return (
      <button type="button" className="chat-card" onClick={() => openSheet('details')}>
        <span className="chat-card__faces" aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <PersonAvatar key={i} index={i} size={26} />
          ))}
        </span>
        <span className="chat-card__label">See all {TOTAL}</span>
        <ChevronRight size={16} strokeWidth={2.6} aria-hidden />
      </button>
    )
  if (act === 'reach') {
    const link = reachLink()
    if (!link) return null
    return (
      <a className="chat-card chat-card--go" href={link.href}>
        <span className="chat-card__label">{link.label}</span>
        <ArrowUpRight size={17} strokeWidth={2.4} aria-hidden />
      </a>
    )
  }
  return (
    <button
      type="button"
      className="chat-card chat-card--go"
      onClick={async () => {
        if ((await share()) !== 'copied') return
        setSaid('Link copied')
        setTimeout(() => setSaid(null), 1800)
      }}
    >
      <span className="chat-card__label" role="status">
        {said ?? `Share ${GROUP_NAME}`}
      </span>
      {said ? <Check size={17} strokeWidth={2.6} aria-hidden /> : <Share size={16} strokeWidth={2.2} aria-hidden />}
    </button>
  )
}

const easeOut = (k: number) => 1 - Math.pow(1 - k, 3)
/** Out past its mark and back: how a sticker presses on. */
const press = (k: number) => 1 + 2.4 * Math.pow(k - 1, 3) + 1.4 * Math.pow(k - 1, 2)

/** A company's logo sent as a sticker: no bubble, only the logo, large. Where
 * the logo it was picked from is on screen (anything marked
 * `data-sticker-source` with the company's name), it peels off that and
 * flies up into the thread; otherwise it arrives as anything else does. */
function Sticker({ name, at }: { name: string; at: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const company = companyNamed(name)

  useLayoutEffect(() => {
    const row = ref.current
    const logo = row?.querySelector<HTMLElement>('.logo')
    const page = row?.closest<HTMLElement>('.ph-page')
    const from = page?.querySelector<HTMLElement>(`[data-sticker-source="${name.replace(/["\\]/g, '\\$&')}"]`)
    if (!row || !logo || !page || !from || prefersReducedMotion()) return
    const start = from.getBoundingClientRect()
    if (!start.width) return
    // A copy makes the journey, over everything, while the real one waits where it will land
    const ghost = logo.cloneNode(true) as HTMLElement
    const full = logo.offsetWidth
    ghost.classList.add('chat-sticker__ghost')
    ghost.style.cssText += ';position:absolute;top:0;left:0;z-index:40;margin:0;pointer-events:none;will-change:transform'
    page.appendChild(ghost)
    logo.style.visibility = 'hidden'
    from.setAttribute('data-peeled', '')
    let frame = 0
    let t0 = 0
    const done = () => {
      cancelAnimationFrame(frame)
      ghost.remove()
      logo.style.visibility = ''
      from.removeAttribute('data-peeled')
    }
    const step = (now: number) => {
      if (!t0) t0 = now
      const k = Math.min(1, (now - t0) / 560)
      // Where it is landing is read as it goes: the thread is still scrolling up to make room
      const box = page.getBoundingClientRect()
      const end = logo.getBoundingClientRect()
      const e = easeOut(k)
      const size = (start.width + (full - start.width) * press(k)) / full
      const x = start.left + start.width / 2 + (end.left + end.width / 2 - start.left - start.width / 2) * e
      const y = start.top + start.height / 2 + (end.top + end.height / 2 - start.top - start.height / 2) * e - Math.sin(Math.PI * k) * 18
      ghost.style.transform = `translate3d(${(x - box.left - full / 2).toFixed(2)}px, ${(y - box.top - full / 2).toFixed(2)}px, 0) scale(${size.toFixed(4)})`
      if (k < 1) frame = requestAnimationFrame(step)
      else done()
    }
    step(performance.now())
    frame = requestAnimationFrame(step)
    return done
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!company) return null
  return (
    <div ref={ref} className="chat-attach chat-attach--me chat-sticker" data-at={at} role="img" aria-label={`${company.name} sticker`}>
      <CompanyLogo company={company} size={96} />
    </div>
  )
}

/** A company as Niv sends one: a link that unfolds into its logo, its name and where it lives. */
function CompanyCard({ company }: { company: Listed }) {
  const inside = (
    <>
      <span className="chat-link__art" aria-hidden>
        <CompanyLogo company={company} size={64} />
      </span>
      <span className="chat-link__text">
        <b>{company.name}</b>
        <span>{company.url ? hostOf(company.url) : company.vertical}</span>
      </span>
    </>
  )
  return company.url ? (
    <a className="chat-link chat-link--company" href={company.url} target="_blank" rel="noreferrer" aria-label={`${company.name}: open ${hostOf(company.url)}`}>
      {inside}
    </a>
  ) : (
    <div className="chat-link chat-link--company">{inside}</div>
  )
}

/** A photo or a video from a drop, as a picture in the thread. It opens the library it is from. */
function Picture({ index }: { index: number }) {
  const slot = MEDIA[index]
  if (!slot) return null
  const video = slot.kind === 'video'
  return (
    <div className="chat-shot">
      <button
        type="button"
        className="chat-media"
        data-kind={slot.kind}
        data-shot="photos"
        aria-label={`${slot.drop}, a ${slot.kind}. Open VIP.`}
        onClick={() => {
          setDrop(slot.drop)
          openApp('photos')
        }}
      >
        {slot.src ? (
          video ? (
            <video src={slot.src} muted playsInline preload="metadata" />
          ) : (
            <img src={slot.src} alt="" loading="lazy" />
          )
        ) : (
          <span className="chat-media__slot">
            {video ? <Play size={26} strokeWidth={1.6} aria-hidden /> : <ImageIcon size={26} strokeWidth={1.6} aria-hidden />}
            <span>{video ? 'Video slot' : 'Photo slot'}</span>
          </span>
        )}
      </button>
      <span className="chat-shot__cap">
        {slot.drop}
        {slot.from ? ` · from ${slot.from}` : ''} · Tap to open VIP
      </span>
    </div>
  )
}

/** Niv's own, of any kind: they run together under one name, with his face on the last. */
const isNiv = (item?: Item) => !!item && (item.kind === 'niv' || item.kind === 'shot' || item.kind === 'link' || item.kind === 'company' || item.kind === 'media' || item.kind === 'action')

/** The conversation as the kit's thread takes it: a row for everything said or
 * sent. Each message carries when it landed (`data-at`), for a version that
 * shows the times. */
export function threadNodes(items: Item[], startedAt: number, loved: string[]): ReactElement[] {
  const nodes: ReactElement[] = [
    stamp(startedAt),
    <Stamp key="named" className="chat-note">
      Niv named the conversation “{GROUP_NAME}”.
    </Stamp>,
    <Stamp key="added" className="chat-note">
      Niv added you to the conversation.
    </Stamp>,
  ]
  let lastYou = ''
  for (const item of items) if (item.kind === 'you' || item.kind === 'sticker') lastYou = item.key
  const receipt = (
    <Receipt key="receipt" show>
      Delivered
    </Receipt>
  )
  items.forEach((item, i) => {
    const at = item.at ?? startedAt
    const first = !isNiv(items[i - 1])
    const last = !isNiv(items[i + 1])
    const face = last ? <ShrugAvatar size={28} /> : <span className="chat-gap" />
    const heart = { emoji: '❤️', show: loved.includes(item.key) }
    if (isNiv(item) && first)
      nodes.push(
        <div key={`${item.key}-who`} className="chat-who">
          Niv
        </div>,
      )
    switch (item.kind) {
      case 'note':
        nodes.push(
          <Stamp key={item.key} className="chat-note">
            {item.text}
          </Stamp>,
        )
        break
      case 'person': {
        const person = PEOPLE[item.index]!
        nodes.push(
          <div key={`${item.key}-who`} className="chat-who">
            {person.name}
            {person.role ? ` · ${person.role}` : ''}
          </div>,
        )
        nodes.push(
          <Bubble key={item.key} from="them" typing={item.typing} tail avatar={<PersonAvatar index={item.index} />} tapback={heart} data-person={item.index} data-key={item.key} data-at={at}>
            {QUOTES[item.index]}
          </Bubble>,
        )
        break
      }
      case 'niv':
        nodes.push(
          <Bubble key={item.key} from="them" typing={item.typing} tail={last} avatar={face} tapback={heart} className={item.todo ? 'chat-todo' : undefined} data-key={item.key} data-at={at}>
            {item.text}
          </Bubble>,
        )
        break
      case 'you':
        nodes.push(
          <Bubble key={item.key} from="me" source={item.from === 'chip' ? 'chip-origin' : 'thread-field'} data-at={at}>
            {item.text}
          </Bubble>,
        )
        if (item.key === lastYou) nodes.push(receipt)
        break
      case 'sticker':
        nodes.push(<Sticker key={item.key} name={item.company} at={at} />)
        if (item.key === lastYou) nodes.push(receipt)
        break
      case 'company': {
        const company = companyNamed(item.company)
        if (!company) break
        nodes.push(
          <div key={item.key} className="chat-attach" data-at={at}>
            {face}
            <CompanyCard company={company} />
          </div>,
        )
        break
      }
      case 'media':
        nodes.push(
          <div key={item.key} className="chat-attach" data-at={at}>
            {face}
            <Picture index={item.index} />
          </div>,
        )
        break
      case 'shot':
        nodes.push(
          <div key={item.key} className="chat-attach" data-at={at}>
            {face}
            <div className="chat-shot">
              <Shot app={item.app} />
              <span className="chat-shot__cap">{APPS[item.app].name} · Tap to open</span>
            </div>
          </div>,
        )
        break
      case 'link':
        nodes.push(
          <div key={item.key} className="chat-attach" data-at={at}>
            {face}
            <a className="chat-link" href={SITE.onePager} target="_blank" rel="noreferrer">
              <span className="chat-link__art" aria-hidden>
                <DocumentIcon />
              </span>
              <span className="chat-link__text">
                <b>Shrug one-pager</b>
                <span>{hostOf(SITE.onePager)}</span>
              </span>
            </a>
          </div>,
        )
        break
      case 'action':
        nodes.push(
          <div key={item.key} className="chat-attach" data-at={at}>
            {face}
            <Action act={item.act} />
          </div>,
        )
        break
    }
  })
  return nodes
}

/** The replies the visitor might send next, in a row above the field. */
export function Replies({ chips, left, onPick }: { chips: Chip[]; left: number; onPick: (chip: Chip, el: HTMLElement) => void }) {
  const row = useRef<HTMLDivElement>(null)
  const set = chips.map((c) => c.kind).join()
  // A different set of replies starts from its beginning
  useEffect(() => {
    row.current?.scrollTo({ left: 0 })
  }, [set])
  return (
    <div ref={row} className="ph-replies" role="group" aria-label="Suggested replies" data-empty={chips.length ? undefined : ''}>
      {chips.map((chip) => (
        <button key={chip.id} type="button" className="ph-reply" data-kind={chip.kind} onClick={(e) => onPick(chip, e.currentTarget)}>
          {chip.kind === 'resume' && <Play size={11} fill="currentColor" strokeWidth={0} aria-hidden />}
          <span>{chip.label}</span>
          {chip.kind === 'resume' && left > 0 && <em>{left} to go</em>}
        </button>
      ))}
    </div>
  )
}

/** The message field. What is typed is said to Niv; while he waits for an email,
 * it takes one. `leading` goes to its left, where Messages keeps its plus. */
export function Field({ leading, onFocus, onSent }: { leading?: ReactNode; onFocus?: () => void; onSent?: () => void }) {
  const [text, setText] = useState('')
  const awaiting = useStore(convo, (s) => s.awaiting)
  const ready = text.trim().length > 0
  const email = awaiting === 'email'
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!ready) return
    say(text)
    setText('')
    onSent?.()
  }
  return (
    <form className="composer" noValidate onSubmit={submit}>
      {leading}
      <div className="composer__field">
        {/* Where the words start: a sent bubble forms out of this spot */}
        <span className="composer__origin" data-target="thread-field" aria-hidden />
        <input
          className="composer__input"
          type={email ? 'email' : 'text'}
          inputMode={email ? 'email' : 'text'}
          autoComplete={email ? 'email' : 'off'}
          autoCapitalize={email ? 'off' : 'sentences'}
          autoCorrect={email ? 'off' : 'on'}
          enterKeyHint="send"
          placeholder={email ? 'Your email' : 'iMessage'}
          aria-label={email ? 'Your email' : 'Message'}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={onFocus}
        />
        <button type="submit" className="composer__send" aria-label="Send" data-ready={ready || undefined} aria-disabled={!ready} tabIndex={ready ? 0 : -1}>
          <ArrowUp size={19} strokeWidth={2.8} aria-hidden />
        </button>
      </div>
    </form>
  )
}

/** The conversation's bar: its face over its name, which open its details, and a way to pass it on. */
export function ThreadBar({ sharing = true }: { sharing?: boolean }) {
  const [copied, setCopied] = useState(false)
  return (
    <header className="ph-nav" data-scrolled data-center>
      <div className="ph-nav__side" />
      <div className="ph-nav__middle">
        <button type="button" className="ph-thread-id" aria-label={`${GROUP_NAME}, ${TOTAL + 2} people: details`} onClick={() => openSheet('details')}>
          <GroupAvatar size={44} />
          <span className="ph-thread-id__name">
            <span>{GROUP_NAME}</span>
            <ChevronRight size={11} strokeWidth={2.6} aria-hidden />
          </span>
        </button>
      </div>
      <div className="ph-nav__side ph-nav__side--end">
        {sharing && (
          <button
            type="button"
            className="ph-bar-button"
            aria-label={copied ? 'Link copied' : `Share ${GROUP_NAME}`}
            onClick={async () => {
              if ((await share()) !== 'copied') return
              setCopied(true)
              setTimeout(() => setCopied(false), 1800)
            }}
          >
            {copied ? <Check size={20} strokeWidth={2.6} aria-hidden /> : <Share size={19} strokeWidth={2.2} aria-hidden />}
          </button>
        )}
      </div>
    </header>
  )
}

/** Puts the spot a bubble forms out of (`data-target="chip-origin"`) on some words: whatever was tapped to say them. */
export function placeOrigin(origin: HTMLElement | null, root: HTMLElement | null, words: Element) {
  const box = root?.getBoundingClientRect()
  const at = words.getBoundingClientRect()
  if (!box || !origin) return
  origin.style.left = `${at.left - box.left}px`
  origin.style.top = `${at.top - box.top}px`
  origin.style.height = `${at.height}px`
}

/** A double tap on a message loves it, as it does in Messages. Returns the thread's tap handler. */
export function useLoveTap(loved?: () => void) {
  /** The last tap on a message, to tell a double tap by. */
  const tapped = useRef({ key: '', at: 0 })
  return (e: MouseEvent<HTMLDivElement>) => {
    const key = (e.target as HTMLElement).closest<HTMLElement>('.ss-bubble[data-key]')?.dataset.key
    if (!key) return
    if (tapped.current.key === key && e.timeStamp - tapped.current.at < 340) {
      love(key)
      loved?.()
      tapped.current = { key: '', at: 0 }
    } else tapped.current = { key, at: e.timeStamp }
  }
}

export function Thread({ active }: { active: boolean }) {
  const state = useStore(convo, (s) => s)
  const jump = useStore(inbox, (s) => s.jump)
  const root = useRef<HTMLDivElement>(null)
  const origin = useRef<HTMLSpanElement>(null)

  const nodes = useMemo(() => threadNodes(state.items, state.startedAt, state.loved), [state.items, state.startedAt, state.loved])
  const chips = useMemo(() => suggestions(state), [state])

  /** A reply was tapped: its words lift out of where they are and become the bubble. */
  const onPick = (chip: Chip, el: HTMLElement) => {
    placeOrigin(origin.current, root.current, el.querySelector('span') ?? el)
    pick(chip)
  }

  const onTap = useLoveTap()

  return (
    <div ref={root} className="ph-page ph-thread" data-fixed>
      <ThreadBar />
      <div className="ph-page__content">
        <Scroller label={GROUP_NAME} nodes={nodes} jump={jump} onJumped={clearJump} active={active} onTap={onTap} />
        <Replies chips={chips} left={TOTAL - state.replied} onPick={onPick} />
        <Field />
      </div>
      {/* Wherever the reply that was tapped had its words: a bubble forms out of here */}
      <span ref={origin} className="chip-origin" data-target="chip-origin" aria-hidden />
    </div>
  )
}
