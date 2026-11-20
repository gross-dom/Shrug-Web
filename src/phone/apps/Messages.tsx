import { memo, useEffect, useId, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react'
import { ArrowUp, ChevronLeft, ChevronRight, CircleAlert, FileText, Mic, Plus, Search, Video, X } from 'lucide-react'
import { attach, attached, attachedTo, chat, detach, finishChat, MOST_FILES, replayChat, sendMessage, setUnsent, toggleChat, TOTAL, unsent } from '../../apps/chat'
import { ConversationAvatar, conversationName, GROUP_NAME, keepsCaret, PersonAvatar, relationsOf, Transcript, useConversationRows, type ListRow } from '../../apps/chat-ui'
import { inbox, openConversation, seeGroup, setInboxQuery, showInGroup, sought, type Conversation } from '../../apps/state'
import { eggOf } from '../../data/eggs'
import { COMPANY_OF } from '../../data/founders'
import { PEOPLE } from '../../data/people'
import { COMPANIES } from '../../data/portfolio'
import { SITE } from '../../data/site'
import { Row } from '../../kit/parts/Row'
import { formatter } from '../../os/dates'
import { LogoDisc } from '../../os/icons'
import { prefersReducedMotion } from '../../os/dom'
import { focusLost, holdFocus } from '../../os/focus'
import { showCompany } from '../../os/launch'
import { atPerson, linkTo } from '../../os/place'
import { useStore } from '../../os/store'
import { sheeted } from '../chrome'
import { share } from '../native'
import { closeSheet, goHome, openSheet, pop, push, sys, topOf } from '../system'
import { useNewCount } from '../unread'
import { BackButton, Cell, ComposeGlyph, Empty, GlassButton, List, NavStack, scaleOf, Screen, SearchBar, Section, Sheet, SheetHost, Switch, useApp } from '../ui'
// (The apps' names on this phone. That file draws this one, and this one reads that one's names: each is
// asked of the other only once both are there, when something is drawn)
import { LIMITS, outbox, pick, resend, sendToShrug, setDraft, sizeOf, unpick, type Sent } from './outbox'
import { conversationView, GROUP_VIEW, NEW_MESSAGE } from './routes'
import '../../styles/phone/messages.css'

// Messages, as the iPhone has it. It is Shrug's own phone, as the desktop is
// Shrug's own Mac: the list of conversations (Testimonials, where every reply
// is, and then a handful of others to find, from src/data/eggs.ts), a
// conversation with its header floating over the thread and the message field
// at its foot, and the group's details sheet behind its name.
// The conversation itself, its bubbles and the script that plays it are the
// desktop's (src/apps/chat.ts, chat-ui.tsx); the chrome here is iOS's.

// ---- Which conversation is which ----

/** The conversation a screen's name stands for: `c:group` is the group chat and
 * `c:drops` one of the others. Any other name (a person's own thread, from when
 * there were such things) is the group too: that is where their reply is. */
function conversationOf(view: string | null): Conversation | null {
  if (!view?.startsWith('c:')) return null
  const id = view.slice(2)
  return eggOf(id) ? id : 'group'
}

// ---- The keyboard, on a phone ----

/** Safari only raises the keyboard for a field focused in the tap itself. A
 * field on a screen that is still to be drawn can't be: so the tap focuses a
 * stand-in, and the real field takes the keyboard over from it when it arrives. */
let primer: HTMLInputElement | null = null
let wantsField = false

function primeKeyboard() {
  wantsField = true
  if (typeof matchMedia === 'undefined' || !matchMedia('(pointer: coarse)').matches) return
  dropPrimer()
  const el = document.createElement('input')
  el.type = 'text'
  el.tabIndex = -1
  el.setAttribute('aria-hidden', 'true')
  el.style.cssText = 'position:fixed;left:0;bottom:0;width:1px;height:1px;padding:0;border:0;opacity:0;font-size:16px;pointer-events:none'
  document.body.append(el)
  el.focus({ preventScroll: true })
  primer = el
  // Never left holding the keyboard with nothing to type into
  setTimeout(() => primer === el && dropPrimer(), 1500)
}

function dropPrimer() {
  primer?.remove()
  primer = null
}

// ---- The list of conversations ----

const ConversationRow = memo(
  function ConversationRow({ row, picked }: { row: ListRow; picked: boolean }) {
    const open = () => {
      // Someone found in the group: the group opens on their reply
      if (row.person !== undefined) showInGroup(row.person)
      push(conversationView(row.conversation))
    }
    return (
      <Row
        className="msg-row"
        role="button"
        tabIndex={0}
        data-row={row.key}
        data-conversation={row.person === undefined ? row.conversation : undefined}
        // The row that was tapped stays lit while its conversation is open, and fades on the way back
        data-picked={picked || undefined}
        unread={row.unread}
        lead={row.person === undefined ? <ConversationAvatar conversation={row.conversation} size={46} /> : <PersonAvatar index={row.person} size={46} />}
        title={
          <>
            {row.name}
            {row.unread && <span className="sr-only">, unread</span>}
          </>
        }
        meta={
          <>
            {row.when}
            <ChevronRight size={15} strokeWidth={2.6} aria-hidden />
          </>
        }
        preview={row.preview}
        onClick={open}
        onKeyDown={(e: KeyboardEvent) => {
          if (e.key !== 'Enter' && e.key !== ' ') return
          e.preventDefault()
          open()
        }}
      />
    )
  },
  (a, b) => a.picked === b.picked && a.row.key === b.row.key && a.row.unread === b.row.unread && a.row.when === b.row.when && a.row.preview === b.row.preview,
)

/** What a message to Shrug is in a line: its words, or what went in their place. */
const saidIn = (message: Sent) => message.text || (message.files.length === 1 ? message.files[0]!.name : `${message.files.length} Attachments`)

/** What the list shows of the conversation with Shrug: the message its row speaks for, and that message
 * in a line. With nothing being looked for that is the newest. While something is (`q`: trimmed, in lower
 * case, as the rest of the list is searched) it is the newest too where the conversation's own name has
 * the words; failing that, the newest message that has them, in what was written or in the name of a file
 * sent with it, shown by the words or the name they were found in. Null where nothing has been sent yet,
 * or the search finds nothing here. */
function inShrug(sent: Sent[], q: string): { message: Sent; said: string } | null {
  const last = sent[sent.length - 1]
  if (!last) return null
  const has = (text: string) => text.toLowerCase().includes(q)
  if (!q || has(SITE.name)) return { message: last, said: saidIn(last) }
  for (let i = sent.length - 1; i >= 0; i--) {
    const message = sent[i]!
    if (has(message.text)) return { message, said: message.text }
    const file = message.files.find((f) => has(f.name))
    if (file) return { message, said: file.name }
  }
  return null
}

/** The conversation with Shrug, once something has been written to it: at the head of the list, as the
 * newest is. */
function ShrugRow({ message: last, said, picked }: { message: Sent; said: string; picked: boolean }) {
  const open = () => push(NEW_MESSAGE)
  return (
    <Row
      className="msg-row"
      role="button"
      tabIndex={0}
      data-row="shrug"
      data-picked={picked || undefined}
      lead={<ShrugFace size={46} />}
      title={SITE.name}
      meta={
        <>
          now
          <ChevronRight size={15} strokeWidth={2.6} aria-hidden />
        </>
      }
      preview={last.state === 'failed' ? `Not Delivered: ${said}` : said}
      onClick={open}
      onKeyDown={(e: KeyboardEvent) => {
        if (e.key !== 'Enter' && e.key !== ' ') return
        e.preventDefault()
        open()
      }}
    />
  )
}

function ListScreen() {
  const query = useStore(inbox, (s) => s.query)
  const rows = useConversationRows()
  const sent = useStore(outbox, (s) => s.sent)
  /** The conversation that is open over the list, if one is. */
  const picked = useStore(sys, (s) => s.stacks.messages[0] ?? null)
  const q = query.trim()
  const talks = rows.filter((row) => row.person === undefined)
  // While something is being looked for: the people in the group it finds
  const people = rows.filter((row) => row.person !== undefined)
  // The conversation with Shrug is the phone's own, and not among the rows the two layouts share
  const shrug = inShrug(sent, q.toLowerCase())

  // The list has no search of its own for now (Shrug's choice): whatever a search on the desktop left it
  // narrowed to is let go, so that every conversation is listed
  useEffect(() => {
    if (query) setInboxQuery('')
  }, [query])

  return (
    <Screen
      title="Messages"
      large
      className="msg-list"
      // The way out: this is as far back as the app goes, and the Home Screen is next
      trailing={
        <GlassButton label="Exit to the Home Screen" wide onClick={goHome}>
          Exit
        </GlassButton>
      }
      foot={
        <>
          {/* (The compose button keeps its corner: this takes up the room a search field had) */}
          <span className="msg-foot-gap" aria-hidden />
          <GlassButton
            label="New message"
            onClick={() => {
              // A new message, to Shrug: its screen opens with the field ready
              primeKeyboard()
              push(NEW_MESSAGE)
            }}
          >
            <ComposeGlyph />
          </GlassButton>
        </>
      }
    >
      <div className="msg-rows">
        {shrug && <ShrugRow message={shrug.message} said={shrug.said} picked={picked === NEW_MESSAGE} />}
        {talks.map((row) => (
          <ConversationRow key={row.key} row={row} picked={picked === conversationView(row.conversation)} />
        ))}
      </div>
      {people.length > 0 && (
        <section className="msg-found">
          <h3 className="msg-found__label">In {GROUP_NAME}</h3>
          <div className="msg-rows">
            {people.map((row) => (
              <ConversationRow key={row.key} row={row} picked={false} />
            ))}
          </div>
        </section>
      )}
      {/* Said as Contacts and Notes say it: the words quoted back (cut short where they run on), and what to try */}
      {rows.length === 0 && !shrug && q && (
        <Empty icon={<Search size={44} strokeWidth={1.8} />} title={`No Results for “${sought(query)}”`}>
          Check the spelling or try a new search.
        </Empty>
      )}
    </Screen>
  )
}

// ---- A conversation ----

/** Back to the list, with how many replies there are new, as Messages counts them beside the chevron. */
function Back() {
  const count = useNewCount()
  return (
    <button type="button" className="ios-glass ios-button msg-back" data-count={count > 0 || undefined} aria-label={count ? `Back. ${count} unread` : 'Back'} onClick={pop}>
      <ChevronLeft size={24} strokeWidth={2.3} aria-hidden />
      {count > 0 && <span className="msg-back__count">{count}</span>}
    </button>
  )
}

/** The files waiting in a message field, over its words: a picture small, anything else by its name and
 * size, each with a button that takes it back out. */
function Waiting({ files, drop }: { files: { id: string; file: File; url: string | null }[]; drop: (id: string) => void }) {
  return (
    <ul className="msgn-picked" aria-label="Attached">
      {files.map((p) => (
        <li key={p.id} className="msgn-pick" data-picture={p.url ? '' : undefined}>
          {p.url ? (
            <img src={p.url} alt={p.file.name} draggable={false} />
          ) : (
            <>
              <FileText size={22} strokeWidth={1.8} aria-hidden />
              <span className="msgn-pick__words">
                <b dir="auto">{p.file.name}</b>
                <span>{sizeOf(p.file.size)}</span>
              </span>
            </>
          )}
          <button type="button" className="msgn-pick__drop" aria-label={`Remove ${p.file.name}`} onClick={() => drop(p.id)} {...keepsCaret}>
            <X size={12} strokeWidth={3.4} aria-hidden />
          </button>
        </li>
      ))}
    </ul>
  )
}

/** The message field. The script types Shrug's own messages into it; anything the visitor types is theirs
 * to send. The plus beside it is the browser's own picker (a phone offers its photos, its camera and its
 * files there): what is picked waits in the field, and goes into the conversation with the words. It is
 * shown from where it is on the visitor's own device: nothing is sent anywhere (src/apps/chat.ts). */
function Field({ conversation, target, showing }: { conversation: Conversation; target: string; showing: boolean }) {
  // Kept with the conversation, not in this field: still there after a turn of the screen, or a look at another conversation
  const text = useStore(unsent, (s) => s[conversation] ?? '')
  const draft = useStore(chat, (s) => (conversation === 'group' ? s.draft : null))
  const waiting = useStore(attached, (s) => attachedTo(s, conversation))
  const input = useRef<HTMLInputElement>(null)
  const files = useRef<HTMLInputElement>(null)
  const ready = text.trim().length > 0 || waiting.length > 0
  const ghost = draft !== null && !text && !waiting.length
  const full = waiting.length >= MOST_FILES

  // Asked for by the compose button: the field takes the keyboard as its screen arrives
  useEffect(() => {
    if (!showing || !wantsField || conversation !== 'group') return
    wantsField = false
    input.current?.focus({ preventScroll: true })
    dropPrimer()
  }, [showing, conversation])

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!ready) return
    // (A message of your own is sent from the end of the conversation: the thread sees to that itself)
    sendMessage(text, conversation)
    setUnsent(conversation, '')
    // The arrow goes as the field empties: the caret stays in the field, and the keyboard up
    input.current?.focus({ preventScroll: true })
  }

  return (
    <>
      <input
        ref={files}
        className="msgn-picker"
        type="file"
        multiple
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          attach(conversation, [...(e.target.files ?? [])])
          e.target.value = ''
          input.current?.focus({ preventScroll: true })
        }}
      />
      <button type="button" className="ios-glass ios-button msg-more__button" aria-label="Add files" aria-disabled={full || undefined} onClick={() => !full && files.current?.click()} {...keepsCaret}>
        <Plus size={23} strokeWidth={2.2} aria-hidden />
      </button>
      <form className="ios-glass msg-field msgn-field" onSubmit={submit}>
        {waiting.length > 0 && <Waiting files={waiting} drop={(id) => detach(conversation, id)} />}
        <span className="msgn-field__row">
          {/* Where the words start: a sent bubble forms out of this spot */}
          <span className="msg-field__origin" data-target={target} aria-hidden />
          {ghost && (
            <span className="msg-field__ghost" aria-hidden>
              {draft}
              <i className="msg-field__caret" />
            </span>
          )}
          <input ref={input} className="msg-field__input" type="text" dir="auto" placeholder={ghost ? '' : waiting.length ? 'Add comment or Send' : 'iMessage'} aria-label="iMessage" autoComplete="off" autoCorrect="on" enterKeyHint="send" value={text} onChange={(e) => setUnsent(conversation, e.target.value)} />
          <span className="msg-field__mic" data-off={ready || ghost || undefined} aria-hidden>
            <Mic size={20} strokeWidth={2} />
          </span>
          <button type="submit" className="msg-field__send" aria-label="Send" data-ready={ready || undefined} aria-disabled={!ready} tabIndex={ready ? 0 : -1} {...keepsCaret}>
            <ArrowUp size={19} strokeWidth={3} aria-hidden />
          </button>
        </span>
      </form>
    </>
  )
}

/** The conversation's thread, with a reply that is shown from its details brought down clear of the header. */
function Thread({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = root.current
    if (!el) return
    // A reply brought into view from its details is rung (`data-flash`). The
    // thread puts it where the desktop wants it, which on a phone can be up
    // under the header: once it has arrived, it is brought down clear of it.
    let nudge: ReturnType<typeof setTimeout> | undefined
    const clearOfHeader = (bubble: HTMLElement) => {
      clearTimeout(nudge)
      nudge = setTimeout(() => {
        const scroller = el.querySelector<HTMLElement>('.chat__scroll')
        const flow = scroller?.querySelector<HTMLElement>('.chat__flow')
        if (!scroller || !flow || !bubble.isConnected) return
        const k = scaleOf(scroller)
        // The header covers as much of the thread as the thread leaves clear above its first message
        const clear = parseFloat(getComputedStyle(flow).paddingTop) || 0
        const who = bubble.closest('.ss-bubble-row')?.previousElementSibling
        const first = who?.classList.contains('chat-who') ? who : bubble
        const top = (first.getBoundingClientRect().top - scroller.getBoundingClientRect().top) / k
        if (top < clear) scroller.scrollBy({ top: top - clear, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
      }, 650)
    }
    const rung = new MutationObserver((records) => {
      const bubble = records.map((r) => r.target as HTMLElement).find((b) => b.hasAttribute('data-flash'))
      if (bubble) clearOfHeader(bubble)
    })
    rung.observe(el, { subtree: true, attributes: true, attributeFilter: ['data-flash'] })
    // A conversation that arrives already on a rung reply rang it before this was listening
    const already = el.querySelector<HTMLElement>('.ss-bubble[data-flash]')
    if (already) clearOfHeader(already)

    return () => {
      rung.disconnect()
      clearTimeout(nudge)
    }
  }, [])
  return (
    <div ref={root} className="msg-thread">
      {children}
    </div>
  )
}

/** `view` is the screen's own name in the stack, which for an old address may not be the conversation's. */
function ConversationScreen({ conversation, view }: { conversation: Conversation; view: string }) {
  const { active } = useApp()
  const onTop = useStore(sys, (s) => topOf(s, 'messages') === view)
  const showing = active && onTop
  const replied = useStore(chat, (s) => s.replied)
  const target = `msg-field-${useId().replace(/:/g, '')}`
  const name = conversationName(conversation)
  const group = conversation === 'group'

  // While replies are still to come the thread offers them all at once, on a pill at its head, and keeps
  // room there for it (messages.css): from the start, so that the pill arrives over nothing and the thread
  // does not step down to let it in. The room outlasts the pill for as long as the conversation can be
  // seen: given back there, every message in it would step up under the eyes of whoever is reading. It
  // goes once Messages has been put away for a moment (not while it is a card in the App Switcher, where
  // it is still seen), and a conversation that opens with every reply in it never has it
  const coming = group && replied < TOTAL
  const away = useStore(sys, (s) => s.app !== 'messages' && !s.switcher)
  const [kept, setKept] = useState(false)
  useEffect(() => {
    if (coming) return setKept(true)
    if (!away || !kept) return
    const gone = setTimeout(() => setKept(false), 700)
    return () => clearTimeout(gone)
  }, [coming, away, kept])
  const roomy = coming || kept

  // On screen, the group has been seen as far as it has got: nothing in it is new
  useEffect(() => {
    if (!showing) return
    if (inbox.get().open !== conversation) openConversation(conversation)
    if (group) seeGroup()
  }, [showing, conversation, group, replied])

  return (
    <Screen
      title={name}
      fixed
      className={group ? `msg-convo${roomy ? ' msg-convo--roomy' : ''}` : 'msg-convo msg-convo--person'}
      leading={<Back />}
      center={
        group ? (
          <button type="button" className="msg-head" aria-haspopup="dialog" onClick={() => openSheet('details')}>
            {/* The face is a picture of the name beside it: the name is what is read out */}
            <span className="msg-head__face" aria-hidden>
              <ConversationAvatar conversation={conversation} size={50} />
            </span>
            <span className="ios-glass msg-head__name">
              {name}
              <span className="sr-only">. Details</span>
              <ChevronRight size={11} strokeWidth={3} aria-hidden />
            </span>
          </button>
        ) : (
          // One of the others: who it is with, and nothing behind the name
          <span className="msg-head msg-head--plain">
            <span className="msg-head__face" aria-hidden>
              <ConversationAvatar conversation={conversation} size={50} />
            </span>
            <span className="ios-glass msg-head__name">{name}</span>
          </span>
        )
      }
      trailing={
        // Where Messages keeps FaceTime. Nobody here is taking calls: it says so (see FaceTime below)
        <GlassButton label="FaceTime" onClick={() => openSheet(FACETIME)}>
          <Video size={23} strokeWidth={2} aria-hidden />
        </GlassButton>
      }
      foot={<Field conversation={conversation} target={target} showing={showing} />}
    >
      {/* Older messages blur and fade as they pass up under the header */}
      <div className="msg-edge" aria-hidden />
      <Thread>
        <Transcript conversation={conversation} source={target} active={showing} />
      </Thread>
    </Screen>
  )
}

// ---- A message to Shrug ----

/** Shrug's own face in Messages: its mark, on its black disc. */
function ShrugFace({ size }: { size: number }) {
  return (
    <span className="msgn-face" style={{ width: size, height: size }} aria-hidden>
      <LogoDisc size="100%" />
    </span>
  )
}

/** The name the alert that explains an undelivered message goes by in the phone's history. */
const UNDELIVERED = 'undelivered'

/** Which message that alert is about. */
let asked: string | null = null

// When a message to Shrug was sent, written as a thread's stamp writes it (src/apps/chat-ui.tsx): the day
// as Messages names it, and the time on the visitor's own clock.
const TIME = formatter({ hour: 'numeric', minute: '2-digit' })
const WEEKDAY = formatter({ weekday: 'long' })
const DATE = formatter({ day: 'numeric', month: 'numeric', year: '2-digit' })

/** The day a moment was in: Today, Yesterday, the weekday, then the date. */
function dayOf(t: number) {
  const days = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(t).setHours(0, 0, 0, 0)) / 86_400_000)
  return days <= 0 ? 'Today' : days === 1 ? 'Yesterday' : days < 7 ? WEEKDAY.format(t) : DATE.format(t)
}

/** One message as the conversation shows it: its files, its words, and under them how it went. */
function SentMessage({ message, last }: { message: Sent; last: boolean }) {
  const failed = message.state === 'failed'
  const parts = message.files.map((file, i) =>
    file.url ? (
      <img key={i} className="msgn-pic" src={file.url} alt={file.name} draggable={false} />
    ) : (
      <span key={i} className="msgn-file">
        <FileText size={26} strokeWidth={1.7} aria-hidden />
        <span className="msgn-file__words">
          <b dir="auto">{file.name}</b>
          <span>{sizeOf(file.size)}</span>
        </span>
      </span>
    ),
  )
  if (message.text)
    parts.push(
      <p key="words" className="msgn-bubble" dir="auto">
        {message.text}
      </p>,
    )
  return (
    <div className="msgn-sent" data-state={message.state}>
      <div className="msgn-sent__parts">
        {parts.slice(0, -1)}
        {/* The last of it (the words, or the last file) has the mark beside it when the message has not gone,
            as Messages puts it: beside the bubble that "Not Delivered" is written under */}
        <div className="msgn-sent__last">
          {parts[parts.length - 1]}
          {failed && (
            <button
              type="button"
              className="msgn-alert"
              aria-label="Not delivered. Details"
              onClick={() => {
                asked = message.id
                openSheet(UNDELIVERED)
              }}
            >
              <CircleAlert size={24} strokeWidth={2.2} aria-hidden />
            </button>
          )}
        </div>
      </div>
      {(failed || last) && (
        <p className="msgn-receipt" data-failed={failed || undefined}>
          {failed ? 'Not Delivered' : message.state === 'sent' ? 'Delivered' : message.files.length ? `Sending… ${Math.round(message.part * 100)}%` : 'Sending…'}
        </p>
      )}
    </div>
  )
}

/** A message to Shrug: the one conversation here that is the visitor's to start. The compose button opens
 * it. Shrug is the only one it can be sent to; it can carry files, picked with the browser's own picker
 * (a phone offers its photos, its camera and its files there). Where it goes is in outbox.ts. */
function NewMessageScreen() {
  const { active } = useApp()
  const onTop = useStore(sys, (s) => topOf(s, 'messages') === NEW_MESSAGE)
  const showing = active && onTop
  const { draft, picked, sent, refused } = useStore(outbox, (s) => s)
  const input = useRef<HTMLInputElement>(null)
  const files = useRef<HTMLInputElement>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const started = sent.length > 0
  const ready = draft.trim().length > 0 || picked.length > 0

  // Asked for by the compose button: the field takes the keyboard as its screen arrives
  useEffect(() => {
    if (!showing || !wantsField) return
    wantsField = false
    input.current?.focus({ preventScroll: true })
    dropPrimer()
  }, [showing])

  // The newest is kept in sight: what was just sent, and how it went
  const lastState = sent[sent.length - 1]?.state
  useEffect(() => {
    const el = scroller.current
    if (el) el.scrollTop = el.scrollHeight
  }, [sent.length, lastState, picked.length])

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!ready) return
    sendToShrug()
    input.current?.focus({ preventScroll: true })
  }

  const full = picked.length >= LIMITS.files
  return (
    <Screen
      title={started ? SITE.name : 'New Message'}
      fixed
      className="msg-convo msg-convo--person msgn"
      leading={started ? <Back /> : null}
      center={
        started ? (
          <span className="msg-head msg-head--plain">
            <span className="msg-head__face" aria-hidden>
              <ShrugFace size={50} />
            </span>
            <span className="ios-glass msg-head__name">{SITE.name}</span>
          </span>
        ) : undefined
      }
      trailing={
        started ? undefined : (
          <GlassButton label="Cancel" wide onClick={pop}>
            Cancel
          </GlassButton>
        )
      }
      foot={
        <>
          {/* The browser's own picker: a phone offers its photos, its camera and its files */}
          <input
            ref={files}
            className="msgn-picker"
            type="file"
            multiple
            tabIndex={-1}
            aria-hidden
            onChange={(e) => {
              pick([...(e.target.files ?? [])])
              e.target.value = ''
              input.current?.focus({ preventScroll: true })
            }}
          />
          <button type="button" className="ios-glass ios-button msg-more__button" aria-label="Add files" aria-disabled={full || undefined} onClick={() => !full && files.current?.click()} {...keepsCaret}>
            <Plus size={23} strokeWidth={2.2} aria-hidden />
          </button>
          <form className="ios-glass msg-field msgn-field" onSubmit={submit}>
            {picked.length > 0 && <Waiting files={picked} drop={unpick} />}
            <span className="msgn-field__row">
              <input ref={input} className="msg-field__input" type="text" dir="auto" placeholder={picked.length ? 'Add comment or Send' : 'iMessage'} aria-label={`Message to ${SITE.name}`} autoComplete="off" autoCorrect="on" enterKeyHint="send" value={draft} onChange={(e) => setDraft(e.target.value)} />
              <span className="msg-field__mic" data-off={ready || undefined} aria-hidden>
                <Mic size={20} strokeWidth={2} />
              </span>
              <button type="submit" className="msg-field__send" aria-label="Send" data-ready={ready || undefined} aria-disabled={!ready} tabIndex={ready ? 0 : -1} {...keepsCaret}>
                <ArrowUp size={19} strokeWidth={3} aria-hidden />
              </button>
            </span>
          </form>
        </>
      }
    >
      <div className="msg-edge" aria-hidden />
      {/* Who it is to. There is one answer, so it is said, not asked */}
      {!started && (
        <p className="msgn-to">
          <span>To:</span>
          <b>{SITE.name}</b>
        </p>
      )}
      <div ref={scroller} className="msgn-thread" data-started={started || undefined} role="log" aria-label={`Messages to ${SITE.name}`}>
        {started ? (
          <>
            {/* When it began, as every conversation here says it: the day, and the time the first message was sent */}
            <p className="msgn-stamp">
              <b>iMessage</b>
              <span>
                <b>{dayOf(sent[0]!.at)}</b> {TIME.format(sent[0]!.at)}
              </span>
            </p>
            {sent.map((message, i) => (
              <SentMessage key={message.id} message={message} last={i === sent.length - 1} />
            ))}
          </>
        ) : (
          // What this is for, where an empty conversation has nothing to show
          <p className="msgn-hint">
            <b>Got a deck or a one-pager?</b>
            Send it to {SITE.name} here. Tap + to add files.
          </p>
        )}
      </div>
      {/* Said aloud: a file turned away, and how the last message went. Each in a place of its own: what is
          said of a file is taken back a few seconds on, and that must not say how the message went over again */}
      <span className="sr-only" role="status">
        {refused ?? ''}
      </span>
      <span className="sr-only" role="status">
        {lastState === 'failed' ? 'Not delivered.' : lastState === 'sent' ? 'Delivered.' : ''}
      </span>
      {refused && (
        <p className="msgn-refused" aria-hidden>
          {refused}
        </p>
      )}
    </Screen>
  )
}

/** Why a message to Shrug did not go, behind the mark beside it. */
function Undelivered() {
  const [message] = useState(() => outbox.get().sent.find((m) => m.id === asked) ?? null)
  const closed = message?.why !== 'failed'
  return (
    <Alert
      name={UNDELIVERED}
      title="Not Delivered"
      message={closed ? `${SITE.name} can’t take messages here yet, so this was not sent. Nothing has left your phone.` : 'This message could not be sent. Check your connection and try again.'}
      // With nowhere to send it yet there is still something to do: the one-pager, over the button that closes this
      actions={closed ? [{ label: 'Read the One-pager', href: SITE.onePager, newTab: true }, { label: 'OK', bold: true }] : [{ label: 'Try Again', onSelect: () => message && resend(message.id) }, { label: 'Cancel', bold: true }]}
    />
  )
}

// ---- Details ----

/** What is behind the group's name: the replies' own controls and everyone in
 * it. A person there opens their card inside the sheet: who they are, and the
 * way to their reply in the conversation. */
function DetailsSheet() {
  const paused = useStore(chat, (s) => s.paused)
  const done = useStore(chat, (s) => s.done)
  const replied = useStore(chat, (s) => s.replied)
  const [person, setPerson] = useState<number | null>(null)
  const inner = useRef<HTMLDivElement>(null)
  /** How far down the list of people was, and whose row was pressed, to come back to. */
  const place = useRef({ top: 0, row: -1 })
  /** A link to a reply went to the clipboard (there was no share sheet to hand it to): said for a moment. */
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 1800)
    return () => clearTimeout(t)
  }, [copied])

  // The card starts at its top; the list comes back where it was left, and the keyboard goes with each
  useLayoutEffect(() => {
    const el = inner.current
    const body = el?.closest<HTMLElement>('.ios-sheet__body')
    if (!el || !body) return
    body.scrollTop = person === null ? place.current.top : 0
    if (place.current.row < 0 || document.activeElement !== document.body) return
    const next = person === null ? el.querySelectorAll<HTMLElement>('.msg-person')[place.current.row] : el.closest('.ios-sheet')?.querySelector<HTMLElement>('.ios-sheet__side button')
    next?.focus({ preventScroll: true })
  }, [person])

  if (person !== null) {
    const who = PEOPLE[person]!
    const tags = relationsOf(person)
    const first = who.name.split(' ')[0]
    // The company in the portfolio that is theirs, where their role names one (src/data/founders.ts): a row that goes to its card
    const theirs = COMPANIES.find((company) => company.key === COMPANY_OF[person]) ?? null
    const theirsRow = theirs && <Cell title={`Show ${theirs.name} in Contacts`} tint onClick={() => showCompany(theirs.key)} />
    return (
      <Sheet label={`${who.name} details`} className="msg-details" leading={<BackButton label={`Back to ${GROUP_NAME}`} onClick={() => setPerson(null)} />}>
        <div ref={inner}>
          <div className="msg-card">
            <PersonAvatar index={person} size={96} />
            <div className="msg-card__name">{who.name}</div>
            {who.role && <div className="msg-card__sub">{who.role}</div>}
            {tags.length > 0 && (
              <div className="msg-card__tags">
                {tags.map((tag) => (
                  <span key={tag} className="msg-card__tag">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
          {person < replied ? (
            <List>
              <Section footer={`Opens the conversation at ${first}’s reply.`}>
                <Cell
                  title={`Show in ${GROUP_NAME}`}
                  tint
                  onClick={() => {
                    // The sheet goes, and the conversation behind it is on their reply
                    showInGroup(person)
                    closeSheet()
                  }}
                />
              </Section>
              <Section>
                {/* A link to what they said, to pass on: it opens the conversation at their reply */}
                <Cell title={copied ? 'Link Copied' : 'Share Reply…'} tint onClick={() => void share({ title: who.name, url: linkTo({ app: 'messages', at: atPerson(person) }) }).then((sent) => sent === 'copied' && setCopied(true))} />
                {theirsRow}
              </Section>
            </List>
          ) : (
            <>
              {/* Two people under one name (“Courtne Smith & Filip Diarra”) are spoken of as the two they are */}
              <p className="msg-card__note">{who.name.includes('&') ? `${who.name} haven’t` : `${first} hasn’t`} replied yet.</p>
              {theirsRow && (
                <List>
                  <Section>{theirsRow}</Section>
                </List>
              )}
            </>
          )}
        </div>
      </Sheet>
    )
  }

  return (
    <Sheet label={`${GROUP_NAME} details`} className="msg-details">
      <div ref={inner}>
        <div className="msg-card">
          <ConversationAvatar conversation="group" size={96} />
          <div className="msg-card__name">{GROUP_NAME}</div>
          <div className="msg-card__sub">{TOTAL} People</div>
        </div>
        <List>
          <Section footer={done ? 'Everyone has replied.' : replied === 0 ? 'No one has replied yet.' : `${replied} of ${TOTAL} ${replied === 1 ? 'has' : 'have'} replied so far.`}>
            <Cell title="Pause Replies" className={done ? 'msg-off' : undefined} trailing={<Switch on={paused} label="Pause Replies" onChange={() => !done && toggleChat()} />} />
            <Cell
              title="Show Every Reply"
              tint
              disabled={done}
              onClick={() => {
                finishChat()
                closeSheet()
              }}
            />
            <Cell
              title="Play From the Start"
              tint
              onClick={() => {
                replayChat()
                closeSheet()
              }}
            />
          </Section>
          <Section header={`${TOTAL} People`}>
            {PEOPLE.map((who, i) => (
              <Cell
                key={i}
                className="msg-person"
                lead={<PersonAvatar index={i} size={40} />}
                title={who.name}
                subtitle={who.role || undefined}
                chevron
                // Their card comes in, in the sheet's place
                onClick={() => {
                  place.current = { top: inner.current?.closest<HTMLElement>('.ios-sheet__body')?.scrollTop ?? 0, row: i }
                  setPerson(i)
                }}
              />
            ))}
          </Section>
        </List>
      </div>
    </Sheet>
  )
}

// ---- Alerts ----

/** The name the alert goes by in the phone's history, where a sheet's name goes (`sys.sheet`). */
const FACETIME = 'facetime'

/** How dark the shade an alert lays over the screen is (messages.css draws it: `.msg-alert__shade`). */
const ALERT_SHADE = 0.22

interface AlertAction {
  label: string
  /** It goes somewhere: a link. Without one it is a button. */
  href?: string
  newTab?: boolean
  onSelect?: () => void
  destructive?: boolean
  /** The one that only closes it: iOS sets it bold. */
  bold?: boolean
}

/** An alert, as iOS draws one over whatever is on screen: a title, a line
 * under it, and what can be done, one under another. It is a step in the
 * phone's history like a sheet (`name` is its name there), so the browser's
 * Back closes it too. */
function Alert({ name, title, message, actions }: { name: string; title: string; message: string; actions: AlertAction[] }) {
  /** Still up: the host goes on drawing it for a moment after it has closed, while it fades. */
  const live = useStore(sys, (s) => s.app === 'messages' && s.sheet === name)
  const box = useRef<HTMLDivElement>(null)
  const id = useId()

  /** Gives the keyboard back to what had it when the alert came up. */
  const giveBack = useRef<ReturnType<typeof holdFocus> | null>(null)
  /** The app it is drawn in, where the conversation it is over is too. */
  const host = useRef<HTMLElement | null>(null)

  // As it opens the keyboard goes to the button that only closes it...
  useLayoutEffect(() => {
    // Once: drawn a second time by React's checks, the keyboard would already be on the alert itself
    giveBack.current ??= holdFocus()
    host.current = box.current?.closest<HTMLElement>('.msg-alert')?.parentElement ?? null
    const acts = box.current?.querySelectorAll<HTMLElement>('.msg-alert__act')
    acts?.[acts.length - 1]?.focus({ preventScroll: true })
  }, [])
  // While it is up the screens behind it are shut off, as they are behind a sheet: an alert is answered first
  useLayoutEffect(() => {
    const nav = host.current?.querySelector<HTMLElement>(':scope > .ios-nav')
    if (!live || !nav || nav.hasAttribute('inert')) return
    nav.setAttribute('inert', '')
    return () => nav.removeAttribute('inert')
  }, [live])
  // And the edges of the screen are told of its shade, as a sheet tells them of its own (chrome.ts): the
  // strips along the top and the foot, and the browser's bars over them, are the conversation under that
  // shade, not a pale band left round a screen that has gone dim
  useLayoutEffect(() => {
    if (!live) return
    sheeted.set({ shade: ALERT_SHADE, foot: null })
    return () => sheeted.set({ shade: 0, foot: null })
  }, [live])
  // ...and when it closes, the keyboard goes back to what opened it; or to the thread, if that has gone (a
  // message deleted from here). Asked a frame later, once the screen is open again; by then the screen
  // itself may have taken the keyboard, which is no better a place for it than nowhere
  useEffect(() => {
    if (live) return
    const frame = requestAnimationFrame(() => {
      const on = document.activeElement
      if (focusLost(box.current) || on?.classList.contains('ios-page')) giveBack.current?.(host.current?.querySelector('.ios-page[data-pos="top"] .chat__scroll'))
    })
    return () => cancelAnimationFrame(frame)
  }, [live])

  useEffect(() => {
    if (!live) return
    const key = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Spent on the alert: nothing behind it hears it
        e.preventDefault()
        e.stopPropagation()
        closeSheet()
      } else if (e.key === 'Tab') {
        // Tab stays inside, going round
        const acts = Array.from(box.current?.querySelectorAll<HTMLElement>('.msg-alert__act') ?? [])
        const at = acts.indexOf(document.activeElement as HTMLElement)
        e.preventDefault()
        acts[(at + (e.shiftKey ? -1 : 1) + acts.length) % acts.length]?.focus()
      }
    }
    window.addEventListener('keydown', key, true)
    return () => window.removeEventListener('keydown', key, true)
  }, [live])

  return (
    <div className="msg-alert" data-closing={!live || undefined} {...(live ? null : ({ inert: '' } as object))}>
      <div className="msg-alert__shade" onClick={() => closeSheet()} />
      <div ref={box} className="msg-alert__box" role="alertdialog" aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={`${id}-say`}>
        <h2 className="msg-alert__title" id={`${id}-title`}>
          {title}
        </h2>
        <p className="msg-alert__say" id={`${id}-say`}>
          {message}
        </p>
        <div className="msg-alert__acts">
          {actions.map((action) =>
            action.href ? (
              <a key={action.label} className="msg-alert__act" href={action.href} {...(action.newTab ? { target: '_blank', rel: 'noreferrer' } : null)} onClick={() => closeSheet()}>
                {action.label}
                {action.newTab && <span className="sr-only">, opens in a new tab</span>}
              </a>
            ) : (
              <button
                key={action.label}
                type="button"
                className="msg-alert__act"
                data-destructive={action.destructive || undefined}
                data-bold={action.bold || undefined}
                onClick={() => {
                  action.onSelect?.()
                  closeSheet()
                }}
              >
                {action.label}
              </button>
            ),
          )}
        </div>
      </div>
    </div>
  )
}

/** The camera button, answered in character: nobody in this Messages is taking calls. */
function FaceTime() {
  const [name] = useState(() => conversationName(conversationOf(topOf(sys.get(), 'messages')) ?? 'group'))
  return <Alert name={FACETIME} title="FaceTime Unavailable" message={`${name} is not available for FaceTime.`} actions={[{ label: 'OK', bold: true }]} />
}

// ---- The app ----

export function MessagesApp() {
  // Flicked out of the App Switcher, the app starts over the next time: nothing is still being looked for
  useEffect(() => () => setInboxQuery(''), [])
  return (
    <>
      <NavStack>
        {(view) => {
          if (view === NEW_MESSAGE) return <NewMessageScreen />
          const conversation = conversationOf(view)
          return view === null || conversation === null ? <ListScreen /> : <ConversationScreen conversation={conversation} view={view} />
        }}
      </NavStack>
      <SheetHost>{(name) => (name === 'details' ? <DetailsSheet /> : name === FACETIME ? <FaceTime /> : name === UNDELIVERED ? <Undelivered /> : null)}</SheetHost>
    </>
  )
}
