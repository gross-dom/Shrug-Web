import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Info, SquarePen, UserRound, X } from 'lucide-react'
import { Popover } from '../kit/motion/Popover'
import { Avatar } from '../kit/parts/Avatar'
import { Row } from '../kit/parts/Row'
import { Window } from '../kit/window'
import { useReturnFocus } from '../os/focus'
import { useStore } from '../os/store'
import { outbox, setDraft, unpick } from '../phone/apps/outbox'
import { discardWriting, stopWriting, writeToShrug, writing } from '../os/write'
import { geometry, isShowing, wm, type WM } from '../os/wm'
import { chat } from './chat'
import { ConversationAvatar, ConversationList, conversationName, ConversationPane, ConversationSearch, Details, GroupAvatar, type ListControl } from './chat-ui'
import { inbox, seeGroup } from './state'
import { Tool } from './ui'
import { Write, WriteTo } from './Write'

// The group chat, as Messages on a Mac: two panes side by side. The conversations down the sidebar
// (the group, where every reply is, and then a handful of others to find,
// from src/data/eggs.ts), the conversation that's open beside it, and the
// group's details behind its name. This is Shrug's own Messages: Shrug's
// bubbles are the blue ones on the right.

/** `onPick` is told when a conversation is chosen: a window folded down to one pane goes back to the conversation. */
function Sidebar({ onPick }: { onPick: () => void }) {
  // The search field and the list under it: Return in the field opens the first thing found, the down arrow goes into the list
  const list = useRef<ListControl | null>(null)
  const on = useStore(writing, (s) => s.on)
  const kept = useStore(writing, (s) => s.kept)
  const last = useStore(outbox, (s) => s.sent[s.sent.length - 1] ?? null)
  // (a message that was begun is in the list until its x is pressed: one with words in it, after a reload too)
  const begun = useStore(outbox, (s) => s.draft.trim().length > 0 || s.picked.length > 0)
  const start = () => (writeToShrug(), onPick())
  /** The x: the new message is put away, and what was typed in it goes with it. */
  const discard = () => {
    for (const file of outbox.get().picked) unpick(file.id)
    setDraft('')
    discardWriting()
  }
  return (
    <div className="chat-side" data-writing={on || undefined}>
      <div className="chat-side__top">
        <ConversationSearch control={list} />
      </div>
      {/* The message to Shrug is a conversation at the head of the list, once it has been started: a row as the
          others are. Before anything has been sent it is "New Message", with the plain face Messages gives a
          recipient it has no picture of, and a way to put it away again. It stays there while another
          conversation is looked at: only its x puts it away */}
      {(on || kept || begun || last) && (
        <div className="conv-write">
          <Row
            className="conv"
            pad={8}
            role="button"
            tabIndex={0}
            aria-current={on || undefined}
            selected={on}
            lead={
              last ? (
                <GroupAvatar size={40} />
              ) : (
                <span className="chat-face" style={{ width: 40, height: 40 }} aria-hidden>
                  <Avatar tone="ios" size={40} />
                  <UserRound className="chat-face__glyph" size={23} strokeWidth={0} fill="currentColor" aria-hidden />
                </span>
              )
            }
            title={last ? 'Shrug' : 'New Message'}
            preview={last ? (last.state === 'failed' ? 'Not Delivered' : `${last.state === 'sent' ? 'You: ' : ''}${last.subject ?? last.text}`) : undefined}
            onClick={start}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), start())}
          />
          {!last && (
            <button type="button" className="conv-write__x" aria-label="Discard the new message" onClick={discard}>
              <X size={13} strokeWidth={2.2} aria-hidden />
            </button>
          )}
        </div>
      )}
      {/* Passed over with the arrow keys, a conversation is only being looked at: the list stays until one is pressed */}
      <ConversationList control={list} onPick={(_, by) => (stopWriting(), by === 'press' && onPick())} />
    </div>
  )
}

/** Whether the conversation's window can be seen at all: open, not put away,
 * and not wholly behind a window that is in front of it. Replies that land
 * where nobody can see them are new, whatever the window's state says. */
function inSight(s: WM) {
  const win = s.wins.messages
  if (!isShowing(win)) return false
  const mine = geometry(win, s.viewport, s.compact)
  return !s.order.slice(s.order.indexOf('messages') + 1).some((id) => {
    const other = s.wins[id]
    if (!isShowing(other)) return false
    const r = geometry(other, s.viewport, s.compact)
    return r.x <= mine.x && r.y <= mine.y && r.x + r.w >= mine.x + mine.w && r.y + r.h >= mine.y + mine.h
  })
}

export function MessagesApp() {
  const open = useStore(inbox, (s) => s.open)
  const write = useStore(writing, (s) => s.on)
  const group = open === 'group' && !write
  const [details, setDetails] = useState(false)
  /** A narrow window has one pane: this is whether it is showing the list (see the narrow rules in styles/apps.css). */
  const [listing, setListing] = useState(false)

  // While the group is where it can be seen, what comes in to it has been
  // seen: only replies that land with the window shut, put away or wholly
  // covered, or with another conversation showing, are new (and counted on the Dock)
  const showing = useStore(wm, inSight)
  // Closed (not minimised): its conversation opens again at the newest message
  const shut = useStore(wm, (s) => !s.wins.messages.open)
  const replied = useStore(chat, (s) => s.replied)
  useEffect(() => {
    if (showing && group) seeGroup()
  }, [showing, group, replied])

  // Details close on a click anywhere else, on Escape, and with the conversation.
  // Open, they take the keyboard in (see Details); closed, it goes back to what opened them
  useEffect(() => setDetails(false), [open])
  useReturnFocus(details && group)
  useEffect(() => {
    if (!details) return
    const away = (e: PointerEvent) => {
      if (!(e.target as HTMLElement).closest('.chat-details, .chat-id, .chat-info')) setDetails(false)
    }
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDetails(false)
    }
    document.addEventListener('pointerdown', away, true)
    window.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('pointerdown', away, true)
      window.removeEventListener('keydown', key)
    }
  }, [details])

  // A conversation asked for from anywhere (a row in the list, a reply's notification, a link to someone's
  // words) is what the window shows: the message to Shrug gives way to it, and is kept as it was
  const jump = useStore(inbox, (s) => s.jump)
  const asked = useRef(false)
  useEffect(() => {
    if (asked.current) stopWriting()
    asked.current = true
  }, [open, jump])

  const name = conversationName(open)

  return (
    <Window
      className="app chat"
      data-listing={listing || undefined}
      sidebar={<Sidebar onPick={() => setListing(false)} />}
      sidebarWidth={292}
      lightsSize="large"
      barSize="tall"
      lead={
        <>
          {/* With the sidebar folded away, this is the way to it: the list of conversations, in the conversation's place */}
          <button type="button" className="chat-back" aria-label="Conversations" onClick={() => setListing(true)}>
            <ChevronLeft size={18} strokeWidth={2} aria-hidden />
          </button>
          {/* The pencil: a new message, whose only recipient is Shrug. It is at the head of the conversation's
              side, where Messages has it */}
          <button type="button" className="im-pencil" aria-label="New message to Shrug" aria-pressed={write} onClick={() => (writeToShrug(), setListing(false))}>
            <SquarePen size={15} strokeWidth={2} aria-hidden />
          </button>
          {write ? (
            <WriteTo />
          ) : group ? (
            <button type="button" className="chat-id" aria-haspopup="dialog" aria-expanded={details} aria-label={`${name}. Details`} onClick={() => setDetails((d) => !d)}>
              <ConversationAvatar conversation={open} size={32} />
              <span className="chat-id__name">
                <span>{name}</span>
                <ChevronRight size={10} strokeWidth={2.4} aria-hidden />
              </span>
            </button>
          ) : (
            // One of the others: who it is with, and nothing behind the name
            <span className="chat-id chat-id--plain">
              <ConversationAvatar conversation={open} size={32} />
              <span className="chat-id__name">
                <span>{name}</span>
              </span>
            </span>
          )}
        </>
      }
      toolbar={
        group ? (
          <span className="tools chat-info">
            <Tool label="Details" pressed={details} onClick={() => setDetails((d) => !d)}>
              <Info size={16} strokeWidth={1.8} aria-hidden />
            </Tool>
          </span>
        ) : undefined
      }
      body={{ className: 'chat__body' }}
    >
      {write ? <Write /> : <ConversationPane key={open} conversation={open} shut={shut} />}
      <Popover show={details && group} origin="top right" className="chat-details" role="dialog" aria-label={`${name} details`} {...(details && group ? null : ({ inert: '' } as object))}>
        <Details shown={details && group} onDone={() => setDetails(false)} />
      </Popover>
    </Window>
  )
}
