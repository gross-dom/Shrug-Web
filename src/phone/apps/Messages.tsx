import { memo, useEffect, useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react'
import { ArrowUp, ChevronLeft, ChevronRight, ListFilter, Mic, Plus, SquarePen, Video } from 'lucide-react'
import { chat, finishChat, replayChat, sendMessage, sentAt, toggleChat, TOTAL } from '../../apps/chat'
import { clock, ConversationAvatar, conversationName, GROUP_NAME, relationsOf, rowTime, Transcript } from '../../apps/chat-ui'
import { inbox, openConversation, setInboxQuery, showInGroup, useUnread, type Conversation } from '../../apps/state'
import { PEOPLE } from '../../data/people'
import { SITE } from '../../data/site'
import { Popover } from '../../kit/motion/Popover'
import { Row } from '../../kit/parts/Row'
import { APPS, type AppId } from '../../os/apps'
import { prefersReducedMotion } from '../../os/dom'
import { AppIcon } from '../../os/icons'
import { createStore, useStore } from '../../os/store'
import { OnePagerIcon } from '../icons'
import { closeSheet, launch, launchAt, openSheet, pop, push, sys, topOf } from '../system'
import { Cell, Empty, GlassButton, List, Menu, NavStack, scaleOf, Screen, SearchBar, Section, Sheet, SheetHost, Switch, useApp } from '../ui'
import { conversationView, GROUP_VIEW } from './routes'
import '../../styles/phone/messages.css'

// Messages, as the iPhone has it. It is Shrug's own phone, as the desktop is
// Shrug's own Mac: the list of conversations (Shrug Family, then everyone's
// own message), a conversation with its header floating over the thread and
// the message field at its foot, and the details sheet behind the name.
// The conversation itself, its bubbles and the script that plays it are the
// desktop's (src/apps/chat.ts, chat-ui.tsx); the chrome here is iOS's.

// ---- Which conversation is which ----

/** The conversation a screen's name stands for: `c:group`, `c:12`. */
function conversationOf(view: string | null): Conversation | null {
  if (view === GROUP_VIEW) return 'group'
  const index = view?.startsWith('c:') ? Number(view.slice(2)) : NaN
  return Number.isInteger(index) && index >= 0 && index < TOTAL ? index : null
}

/** How many replies had landed when Shrug Family was last on screen: later ones make its row unread. */
const seen = createStore({ group: 0 })

// Played again from the start, nothing has been seen
chat.subscribe(() => {
  const replied = chat.get().replied
  if (replied < seen.get().group) seen.set({ group: replied })
})

/** Conversations with something unread in them: everyone not yet opened, and the group if it has moved on. */
function useUnreadCount() {
  const people = useUnread()
  const group = useStore(chat, (s) => s.replied) > useStore(seen, (s) => s.group)
  return people + (group ? 1 : 0)
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

interface ListRow {
  conversation: Conversation
  name: string
  preview: ReactNode
  /** When it last heard something, as the row says it. */
  when: string
  unread: boolean
}

const ConversationRow = memo(
  function ConversationRow({ row, picked }: { row: ListRow; picked: boolean }) {
    const open = () => push(conversationView(row.conversation))
    return (
      <Row
        className="msg-row"
        role="button"
        tabIndex={0}
        data-conversation={row.conversation}
        // The row that was tapped stays lit while its conversation is open, and fades on the way back
        data-picked={picked || undefined}
        unread={row.unread}
        lead={<ConversationAvatar conversation={row.conversation} size={46} />}
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
  (a, b) => a.picked === b.picked && a.row.conversation === b.row.conversation && a.row.unread === b.row.unread && a.row.when === b.row.when && a.row.preview === b.row.preview,
)

type Filter = 'all' | 'unread'

function ListScreen() {
  const [filter, setFilter] = useState<Filter>('all')
  const query = useStore(inbox, (s) => s.query)
  const read = useStore(inbox, (s) => s.read)
  const replied = useStore(chat, (s) => s.replied)
  const repliedAt = useStore(chat, (s) => s.repliedAt)
  const startedAt = useStore(chat, (s) => s.startedAt)
  const groupSeen = useStore(seen, (s) => s.group)
  /** The conversation that is open over the list, if one is. */
  const picked = useStore(sys, (s) => s.stacks.messages[0] ?? null)
  // The newest thing said in the group: its row's preview
  const last = useStore(chat, (s) => {
    for (let i = s.items.length - 1; i >= 0; i--) {
      const item = s.items[i]!
      if (item.kind === 'me') return item.text
      if (!item.typing) return PEOPLE[item.index]!.quote ?? ''
    }
    return ''
  })
  const q = query.trim().toLowerCase()

  const rows = useMemo(() => {
    const out: ListRow[] = []
    const groupUnread = replied > groupSeen
    if ((!q || GROUP_NAME.toLowerCase().includes(q)) && (filter === 'all' || groupUnread))
      out.push({ conversation: 'group', name: GROUP_NAME, preview: last || ' ', when: clock(replied ? repliedAt[replied - 1]! : startedAt), unread: groupUnread })
    PEOPLE.forEach((person, i) => {
      const unread = !read.includes(i)
      if (filter === 'unread' && !unread) return
      if (q && !person.name.toLowerCase().includes(q) && !person.role.toLowerCase().includes(q) && !(person.quote ?? '').toLowerCase().includes(q)) return
      out.push({ conversation: i, name: person.name, preview: person.quote ?? [150, 96], when: rowTime(sentAt(i, startedAt)), unread })
    })
    return out
  }, [q, filter, last, replied, repliedAt, startedAt, read, groupSeen])

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
        {rows.map((row) => (
          <ConversationRow key={row.conversation} row={row} picked={picked === conversationView(row.conversation)} />
        ))}
      </div>
      {rows.length === 0 && (q ? <Empty title="No Results">for “{query.trim()}”</Empty> : <Empty title="No Unread Messages" />)}
    </Screen>
  )
}

// ---- A conversation ----

/** Back to the list, with how many conversations there still have something unread, as Messages counts them beside the chevron. */
function Back() {
  const count = useUnreadCount()
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
      <button type="button" className="ios-glass ios-button msg-more__button" aria-label="More from Shrug" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Plus size={23} strokeWidth={2.2} aria-hidden />
      </button>
      <Popover show={open} origin="bottom left" className="ios-menu__list msg-more__list" role="menu" aria-label="More from Shrug" {...(open ? null : ({ inert: '' } as object))}>
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
              <AppIcon id={id} />
            </span>
            <span className="ios-menu__label">{APPS[id].name}</span>
          </button>
        ))}
        <a className="ios-menu__item msg-more__item" role="menuitem" href={SITE.onePager} target="_blank" rel="noreferrer" onClick={() => setOpen(false)}>
          <span className="msg-more__icon" aria-hidden>
            <OnePagerIcon />
          </span>
          <span className="ios-menu__label">One-pager</span>
        </a>
      </Popover>
    </span>
  )
}

/** The message field. The script types Shrug's own messages into it; anything
 * the visitor types is theirs to send, and is marked as not having gone. */
function Field({ conversation, target, showing }: { conversation: Conversation; target: string; showing: boolean }) {
  const [text, setText] = useState('')
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
    // A message of your own is always sent from the end of the conversation:
    // if the reader had scrolled back, the thread goes there first
    e.currentTarget.closest('.msg-convo')?.querySelector<HTMLButtonElement>('.chat__new[data-show]')?.click()
    sendMessage(text, conversation)
    setText('')
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
        <input ref={input} className="msg-field__input" type="text" placeholder={ghost ? '' : 'iMessage'} aria-label="iMessage" autoComplete="off" autoCorrect="on" enterKeyHint="send" value={text} onChange={(e) => setText(e.target.value)} />
        <span className="msg-field__mic" data-off={ready || ghost || undefined} aria-hidden>
          <Mic size={20} strokeWidth={2} />
        </span>
        <button type="submit" className="msg-field__send" aria-label="Send" data-ready={ready || undefined} aria-disabled={!ready} tabIndex={ready ? 0 : -1}>
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

function ConversationScreen({ conversation }: { conversation: Conversation }) {
  const { active } = useApp()
  const view = conversationView(conversation)
  const onTop = useStore(sys, (s) => topOf(s, 'messages') === view)
  const showing = active && onTop
  const replied = useStore(chat, (s) => s.replied)
  const target = `msg-field-${useId().replace(/:/g, '')}`
  const name = conversationName(conversation)

  // On screen, a conversation is read: a person's dot goes, and the group has been seen this far
  useEffect(() => {
    if (!showing) return
    if (inbox.get().open !== conversation) openConversation(conversation)
    if (conversation === 'group') seen.set((s) => (s.group === replied ? s : { group: replied }))
  }, [showing, conversation, replied])

  return (
    <Screen
      title={name}
      fixed
      className={typeof conversation === 'number' ? 'msg-convo msg-convo--person' : 'msg-convo'}
      leading={<Back />}
      center={
        <button type="button" className="msg-head" aria-label={`${name}. Details`} aria-haspopup="dialog" onClick={() => openSheet('details')}>
          <span className="msg-head__face">
            <ConversationAvatar conversation={conversation} size={50} />
          </span>
          <span className="ios-glass msg-head__name">
            {name}
            <ChevronRight size={11} strokeWidth={3} aria-hidden />
          </span>
        </button>
      }
      trailing={
        <GlassButton label={`${name}: details`} onClick={() => openSheet('details')}>
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

// ---- Details ----

/** What is behind a conversation's name: for the group, the replies' own
 * controls and everyone in it; for a person, who they are and the way to
 * their reply in the group. */
function DetailsSheet() {
  // The conversation it was opened over, however the screens move while it closes
  const [conversation] = useState<Conversation>(() => conversationOf(topOf(sys.get(), 'messages')) ?? 'group')
  const paused = useStore(chat, (s) => s.paused)
  const done = useStore(chat, (s) => s.done)
  const replied = useStore(chat, (s) => s.replied)

  if (typeof conversation === 'number') {
    const person = PEOPLE[conversation]!
    const tags = relationsOf(conversation)
    return (
      <Sheet label={`${person.name}: details`} className="msg-details">
        <div className="msg-card">
          <ConversationAvatar conversation={conversation} size={96} />
          <div className="msg-card__name">{person.name}</div>
          {person.role && <div className="msg-card__sub">{person.role}</div>}
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
        {conversation < replied && (
          <List>
            <Section footer={`${person.name.split(' ')[0]} replied in the group. This goes to that reply.`}>
              <Cell
                title={`Show in ${GROUP_NAME}`}
                tint
                onClick={() => {
                  // One move: the sheet goes, and the group arrives on their reply
                  showInGroup(conversation)
                  launchAt('messages', [GROUP_VIEW])
                }}
              />
            </Section>
          </List>
        )}
      </Sheet>
    )
  }

  return (
    <Sheet label={`${GROUP_NAME}: details`} className="msg-details">
      <div className="msg-card">
        <ConversationAvatar conversation="group" size={96} />
        <div className="msg-card__name">{GROUP_NAME}</div>
        <div className="msg-card__sub">{TOTAL} People</div>
      </div>
      <List>
        <Section footer={done ? 'Everyone has replied.' : `${replied} of ${TOTAL} have replied so far.`}>
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
          {PEOPLE.map((person, i) => (
            <Cell
              key={i}
              className="msg-person"
              lead={<ConversationAvatar conversation={i} size={40} />}
              title={person.name}
              subtitle={person.role || undefined}
              chevron
              // The sheet goes, and their own conversation comes in over the group
              onClick={() => launchAt('messages', [GROUP_VIEW, conversationView(i)])}
            />
          ))}
        </Section>
      </List>
    </Sheet>
  )
}

// ---- The app ----

export function MessagesApp() {
  return (
    <>
      <NavStack>
        {(view) => {
          const conversation = conversationOf(view)
          return conversation === null ? <ListScreen /> : <ConversationScreen conversation={conversation} />
        }}
      </NavStack>
      <SheetHost>{(name) => (name === 'details' ? <DetailsSheet /> : null)}</SheetHost>
    </>
  )
}
