import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Info } from 'lucide-react'
import { Popover } from '../kit/motion/Popover'
import { Window } from '../kit/window'
import { useStore } from '../os/store'
import { isShowing, wm } from '../os/wm'
import { chat } from './chat'
import { ConversationAvatar, ConversationList, conversationName, ConversationPane, ConversationSearch, Details } from './chat-ui'
import { inbox, openConversation, seeGroup } from './state'
import { Tool } from './ui'

// The group chat, as Messages on a Mac: the conversations down the sidebar
// (the group, where every reply is, and then a handful of others to find,
// from src/data/eggs.ts), the conversation that's open beside it, and the
// group's details behind its name. This is Shrug's own Messages: Shrug's
// bubbles are the blue ones on the right.

function Sidebar() {
  return (
    <div className="chat-side">
      <div className="chat-side__top">
        <ConversationSearch />
      </div>
      <ConversationList />
    </div>
  )
}

export function MessagesApp() {
  const open = useStore(inbox, (s) => s.open)
  const group = open === 'group'
  const [details, setDetails] = useState(false)

  // While the group is on screen, what comes in to it has been seen: only
  // replies that land with the window shut or put away, or with another
  // conversation showing, are new (and counted on the Dock)
  const showing = useStore(wm, (s) => isShowing(s.wins.messages))
  const replied = useStore(chat, (s) => s.replied)
  useEffect(() => {
    if (showing && group) seeGroup()
  }, [showing, group, replied])

  // Details close on a click anywhere else, on Escape, and with the conversation
  useEffect(() => setDetails(false), [open])
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

  const name = conversationName(open)

  return (
    <Window
      className="app chat"
      sidebar={<Sidebar />}
      sidebarWidth={292}
      sidebarStyle="floating"
      lightsSize="large"
      barSize="tall"
      lead={
        <>
          {/* With the sidebar folded away, this is the way back to the group */}
          {!group && (
            <button type="button" className="chat-back" aria-label="Back to the group chat" onClick={() => openConversation('group')}>
              <ChevronLeft size={18} strokeWidth={2} aria-hidden />
            </button>
          )}
          {group ? (
            <button type="button" className="chat-id" aria-haspopup="dialog" aria-expanded={details} aria-label={`${name}: details`} onClick={() => setDetails((d) => !d)}>
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
      <ConversationPane key={open} conversation={open} />
      <Popover show={details && group} origin="top right" className="chat-details" role="dialog" aria-label={`${name}: details`} {...(details && group ? null : ({ inert: '' } as object))}>
        <Details shown={details && group} onDone={() => setDetails(false)} />
      </Popover>
    </Window>
  )
}
