import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Info } from 'lucide-react'
import { Popover } from '../kit/motion/Popover'
import { Window } from '../kit/window'
import { useStore } from '../os/store'
import { ConversationAvatar, ConversationList, conversationName, ConversationPane, ConversationSearch, Details } from './chat-ui'
import { inbox, openConversation } from './state'
import { Tool } from './ui'

// The group chat, as Messages on a Mac: the conversations down the sidebar
// (the group, then each person as they reply), the conversation that's open
// beside it, and its details behind the name. This is Shrug's own Messages:
// Shrug's bubbles are the blue ones on the right.

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
  const [details, setDetails] = useState(false)

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
          {open !== 'group' && (
            <button type="button" className="chat-back" aria-label="Back to the group chat" onClick={() => openConversation('group')}>
              <ChevronLeft size={18} strokeWidth={2} aria-hidden />
            </button>
          )}
          <button type="button" className="chat-id" aria-haspopup="dialog" aria-expanded={details} aria-label={`${name}: details`} onClick={() => setDetails((d) => !d)}>
            <ConversationAvatar conversation={open} size={32} />
            <span className="chat-id__name">
              <span>{name}</span>
              <ChevronRight size={10} strokeWidth={2.4} aria-hidden />
            </span>
          </button>
        </>
      }
      toolbar={
        <span className="tools chat-info">
          <Tool label="Details" pressed={details} onClick={() => setDetails((d) => !d)}>
            <Info size={16} strokeWidth={1.8} aria-hidden />
          </Tool>
        </span>
      }
      body={{ className: 'chat__body' }}
    >
      <ConversationPane key={String(open)} conversation={open} />
      <Popover show={details} origin="top right" className="chat-details" role="dialog" aria-label={`${name}: details`} {...(details ? null : ({ inert: '' } as object))}>
        <Details conversation={open} onDone={() => setDetails(false)} />
      </Popover>
    </Window>
  )
}
