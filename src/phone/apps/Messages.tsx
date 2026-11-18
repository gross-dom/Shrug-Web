import { memo, useEffect, useId, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react'
import { ArrowUp, ChevronLeft, ChevronRight, ListFilter, Mic, Plus, SquarePen, Video } from 'lucide-react'
import { chat, deleteMessage, finishChat, replayChat, sendMessage, sentMessage, setUnsent, toggleChat, TOTAL, unsent } from '../../apps/chat'
import { ConversationAvatar, conversationName, GROUP_NAME, keepsCaret, NOT_DELIVERED, PersonAvatar, relationsOf, Transcript, useConversationRows, useMenuKeys, type ListRow } from '../../apps/chat-ui'
import { inbox, openConversation, seeGroup, setInboxQuery, showInGroup, type Conversation } from '../../apps/state'
import { eggOf } from '../../data/eggs'
import { PEOPLE } from '../../data/people'
import { reach, SITE } from '../../data/site'
import { Popover } from '../../kit/motion/Popover'
import { Row } from '../../kit/parts/Row'
import { APPS, type AppId } from '../../os/apps'
import { prefersReducedMotion } from '../../os/dom'
import { focusLost, holdFocus } from '../../os/focus'
import { useStore } from '../../os/store'
import { OnePagerIcon, PhoneIcon } from '../icons'
import { closeSheet, launch, launchAt, openSheet, pop, push, sys, topOf } from '../system'
import { useNewCount } from '../unread'
import { BackButton, Cell, Empty, GlassButton, List, Menu, NavStack, scaleOf, Screen, SearchBar, Section, Sheet, SheetHost, Switch, useApp } from '../ui'
import { conversationView, GROUP_VIEW } from './routes'
import '../../styles/phone/messages.css'

// Messages, as the iPhone has it. It is Shrug's own phone, as the desktop is
// Shrug's own Mac: the list of conversations (Shrug Family, where every reply
// is, and then a handful of others to find, from src/data/eggs.ts), a
// conversation with its header floating over the thread and the message field
// at its foot, and the group's details sheet behind its name.
// The conversation itself, its bubbles and the script that plays it are the
// desktop's (src/apps/chat.ts, chat-ui.tsx); the chrome here is iOS's.

// ---- Which conversation is which ----

/** The conversation a screen's name stands for: `c:group` is Shrug Family and
 * `c:mom` one of the others. Any other name (a person's own thread, from when
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

type Filter = 'all' | 'unread'

function ListScreen() {
  const [filter, setFilter] = useState<Filter>('all')
  const query = useStore(inbox, (s) => s.query)
  const all = useConversationRows()
  // Only Shrug Family is ever unread: the others were read long ago
  const rows = filter === 'unread' ? all.filter((row) => row.unread) : all
  /** The conversation that is open over the list, if one is. */
  const picked = useStore(sys, (s) => s.stacks.messages[0] ?? null)
  const q = query.trim()
  const talks = rows.filter((row) => row.person === undefined)
  // While something is being looked for: the people in the group it finds
  const people = rows.filter((row) => row.person !== undefined)

  return (
    <Screen
      title={filter === 'unread' ? 'Unread' : 'Messages'}
      large
      className="msg-list"
      trailing={
        <Menu
          label="Filter conversations"
          items={[
            { label: 'Messages', checked: filter === 'all', onSelect: () => setFilter('all') },
            { label: 'Unread', checked: filter === 'unread', onSelect: () => setFilter('unread') },
          ]}
        >
          <ListFilter size={22} strokeWidth={2.2} aria-hidden />
        </Menu>
      }
      foot={
        <>
          <SearchBar value={query} onChange={setInboxQuery} label="Search conversations" />
          <GlassButton
            label="New message"
            onClick={() => {
              // A new message goes to the family: its conversation opens with the field ready
              primeKeyboard()
              push(GROUP_VIEW)
            }}
          >
            <SquarePen size={21} strokeWidth={2.1} aria-hidden style={{ marginTop: -1, marginLeft: 1 }} />
          </GlassButton>
        </>
      }
    >
      <div className="msg-rows">
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
      {rows.length === 0 && (q ? <Empty title="No Results">for “{q}”</Empty> : <Empty title="No Unread Messages" />)}
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

/** The rest of the site, behind the plus: where Messages keeps its apps. */
const MORE: AppId[] = ['finder', 'notes', 'terminal', 'photos']

function More() {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLSpanElement>(null)
  // The arrows, Home and End move through it and Escape gives the keyboard back to the plus, as in any menu
  const menu = useMenuKeys(open, setOpen)
  useEffect(() => {
    if (!open) return
    const away = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    const key = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return
      // The menu closes; the screen behind it stays
      e.preventDefault()
      setOpen(false)
    }
    document.addEventListener('pointerdown', away, true)
    window.addEventListener('keydown', key, true)
    return () => {
      document.removeEventListener('pointerdown', away, true)
      window.removeEventListener('keydown', key, true)
    }
  }, [open])
  return (
    <span ref={root} className="msg-more">
      <button ref={menu.button} type="button" className="ios-glass ios-button msg-more__button" aria-label="More from Shrug" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)} onKeyDown={menu.onButtonKey}>
        <Plus size={23} strokeWidth={2.2} aria-hidden />
      </button>
      <Popover show={open} origin="bottom left" className="ios-menu__list msg-more__list" role="menu" aria-label="More from Shrug" onKeyDown={menu.onMenuKey} {...(open ? null : ({ inert: '' } as object))}>
        {MORE.map((id) => (
          <button
            key={id}
            type="button"
            className="ios-menu__item msg-more__item"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              launch(id)
            }}
          >
            <span className="msg-more__icon" aria-hidden>
              <PhoneIcon id={id} />
            </span>
            <span className="ios-menu__label">{APPS[id].name}</span>
          </button>
        ))}
        <a className="ios-menu__item msg-more__item" role="menuitem" href={SITE.onePager} target="_blank" rel="noreferrer" onClick={() => setOpen(false)}>
          <span className="msg-more__icon" aria-hidden>
            <OnePagerIcon />
          </span>
          <span className="ios-menu__label">
            One-pager
            <span className="sr-only">, opens in a new tab</span>
          </span>
        </a>
      </Popover>
    </span>
  )
}

/** The message field. The script types Shrug's own messages into it; anything
 * the visitor types is theirs to send, and is marked as not having gone. */
function Field({ conversation, target, showing }: { conversation: Conversation; target: string; showing: boolean }) {
  // Kept with the conversation, not in this field: still there after a turn of the screen, or a look at another conversation
  const text = useStore(unsent, (s) => s[conversation] ?? '')
  const draft = useStore(chat, (s) => (conversation === 'group' ? s.draft : null))
  const input = useRef<HTMLInputElement>(null)
  const ready = text.trim().length > 0
  const ghost = draft !== null && !text

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
      <More />
      <form className="ios-glass msg-field" onSubmit={submit}>
        {/* Where the words start: a sent bubble forms out of this spot */}
        <span className="msg-field__origin" data-target={target} aria-hidden />
        {ghost && (
          <span className="msg-field__ghost" aria-hidden>
            {draft}
            <i className="msg-field__caret" />
          </span>
        )}
        <input ref={input} className="msg-field__input" type="text" dir="auto" placeholder={ghost ? '' : 'iMessage'} aria-label="iMessage" autoComplete="off" autoCorrect="on" enterKeyHint="send" value={text} onChange={(e) => setUnsent(conversation, e.target.value)} />
        <span className="msg-field__mic" data-off={ready || ghost || undefined} aria-hidden>
          <Mic size={20} strokeWidth={2} />
        </span>
        <button type="submit" className="msg-field__send" aria-label="Send" data-ready={ready || undefined} aria-disabled={!ready} tabIndex={ready ? 0 : -1} {...keepsCaret}>
          <ArrowUp size={19} strokeWidth={3} aria-hidden />
        </button>
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
      className={group ? 'msg-convo' : 'msg-convo msg-convo--person'}
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
        <Transcript conversation={conversation} source={target} active={showing} onFailed={(key) => openSheet(whyOf(key))} />
      </Thread>
    </Screen>
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
              <Section footer={`${first} replied in the group. This goes to that reply.`}>
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
            </List>
          ) : (
            <p className="msg-card__note">{first} hasn’t replied yet.</p>
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

/** The names two alerts go by in the phone's history, where a sheet's name goes (`sys.sheet`). */
const FACETIME = 'facetime'
const whyOf = (key: string) => `undelivered:${key}`

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

/** A message that didn't go, asked why: the truth (nothing typed here leaves
 * the page), and where to take the words instead: to Shrug for real, when
 * there is a way (they go along as the message), and to the one-pager. */
function Undelivered({ name }: { name: string }) {
  const key = name.slice(whyOf('').length)
  // Its words, as they were when it opened: deleted from here, it is still what this alert was about while it fades
  const [message] = useState(() => sentMessage(key))
  // A message that is no longer there (the page was loaded again) has nothing to say: the alert goes
  useEffect(() => {
    if (!message) closeSheet(false)
  }, [message])
  if (!message) return null
  const way = reach(message.text)
  const actions: AlertAction[] = [
    ...(way.kind === 'doc' ? [] : [{ label: way.label, href: way.href }]),
    { label: 'Read the One-pager', href: SITE.onePager, newTab: true },
    { label: 'Delete Message', destructive: true, onSelect: () => deleteMessage(key) },
    { label: 'Cancel', bold: true },
  ]
  return <Alert name={name} title={NOT_DELIVERED.title} message={NOT_DELIVERED.message} actions={actions} />
}

// ---- The app ----

export function MessagesApp() {
  // Flicked out of the App Switcher, the app starts over the next time: nothing is still being looked for
  useEffect(() => () => setInboxQuery(''), [])
  return (
    <>
      <NavStack>
        {(view) => {
          const conversation = conversationOf(view)
          return view === null || conversation === null ? <ListScreen /> : <ConversationScreen conversation={conversation} view={view} />
        }}
      </NavStack>
      <SheetHost>{(name) => (name === 'details' ? <DetailsSheet /> : name === FACETIME ? <FaceTime /> : name.startsWith(whyOf('')) ? <Undelivered key={name} name={name} /> : null)}</SheetHost>
    </>
  )
}
