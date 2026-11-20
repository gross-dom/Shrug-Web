import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { chat } from '../apps/chat'
import { GROUP_NAME } from '../apps/chat-ui'
import { inbox, showInGroup } from '../apps/state'
import { PEOPLE } from '../data/people'
import { AppIcon } from './icons'
import { launchApp } from './launch'
import { saver } from './saver'
import { useStore } from './store'
import { activeApp, wm } from './wm'

// Notifications. A reply that lands while the conversation is not the window
// in front (another window is, or none is, or another conversation is showing
// in it) drops in at the top of the screen, beside the desk's icons, the way a
// Mac says that a message has come in for an app that is not the one in use:
// who it is from, the group's name, and how the reply begins. (The Dock's
// count keeps its own, stricter rule: a reply is new only where the
// conversation could not be seen at all.) Pressed, it opens the conversation
// at that reply; left alone, it goes after a few seconds, and it waits while
// the pointer is on it. One at a time, and seldom: with this many replies on
// their way the corner would never be clear, and the Dock's count says how
// many there have been.
//
// It lands over whatever is at the top of the window in front, so it never
// lands under the pointer: a press meant for what was there would be taken by
// the news. While the pointer is where one would come down, none does; the
// first reply after the pointer has left brings one.
//
// It is a picture of news the Dock's count already carries, and the
// conversation tells a screen reader of its replies itself, so the banner is
// not read out a second time and stays out of the keyboard's way.

/** How long one stays, the least time from one to the next, and how long it takes to leave. */
const NOTE = { stay: 5200, apart: 30_000, leave: 300 }

/** As tall as one gets (a name, the group and two lines of what was said), and how far round where it
 * lands the pointer is still in its way. */
const LANDING = { tall: 92, near: 16 }

export function Notifications() {
  const replied = useStore(chat, (s) => s.replied)
  const [shown, setShown] = useState<{ index: number; leaving: boolean } | null>(null)
  const [held, setHeld] = useState(false)
  // When the last one dropped in. There has been none yet, so the first reply to land out of sight gets one
  const last = useRef({ replied, at: -Infinity })
  const place = useRef<HTMLDivElement>(null)
  /** Where the pointer was last seen resting: a mouse's or a pen's. A finger rests nowhere. */
  const pointer = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const seen = (e: PointerEvent) => {
      pointer.current = e.pointerType === 'touch' ? null : { x: e.clientX, y: e.clientY }
    }
    const gone = () => {
      pointer.current = null
    }
    window.addEventListener('pointermove', seen, { passive: true })
    window.addEventListener('pointerdown', seen, { passive: true })
    // Out of the page altogether
    document.documentElement.addEventListener('pointerleave', gone)
    return () => {
      window.removeEventListener('pointermove', seen)
      window.removeEventListener('pointerdown', seen)
      document.documentElement.removeEventListener('pointerleave', gone)
    }
  }, [])

  useEffect(() => {
    const before = last.current.replied
    last.current.replied = replied
    // One reply, just landed: not the whole conversation set down at once, nor one that is being played over
    if (replied !== before + 1) return
    const desk = wm.get()
    if (desk.compact || saver.get().on || document.hidden) return
    // The conversation is the window in front: the reply is there, being read
    if (activeApp(desk) === 'messages' && inbox.get().open === 'group') return
    if (performance.now() - last.current.at < NOTE.apart) return
    // The pointer is where it would land: not now. The clock is left as it was, so the next reply tries again
    const at = pointer.current
    const box = place.current?.getBoundingClientRect()
    if (at && box && at.x >= box.left - LANDING.near && at.x <= box.right + LANDING.near && at.y >= box.top - LANDING.near && at.y <= box.top + LANDING.tall + LANDING.near) return
    last.current.at = performance.now()
    setHeld(false)
    setShown({ index: replied - 1, leaving: false })
  }, [replied])

  useEffect(() => {
    if (!shown || (held && !shown.leaving)) return
    const t = setTimeout(() => setShown((note) => (note ? (note.leaving ? null : { ...note, leaving: true }) : note)), shown.leaving ? NOTE.leave : NOTE.stay)
    return () => clearTimeout(t)
  }, [shown, held])

  // The conversation has come to the front, the screen saver is on, or the screen is a phone's now: the news is old
  const watched = useStore(wm, (s) => activeApp(s) === 'messages')
  const group = useStore(inbox, (s) => s.open === 'group')
  const saving = useStore(saver, (s) => s.on)
  const compact = useStore(wm, (s) => s.compact)
  const stale = (watched && group) || saving || compact
  useEffect(() => {
    if (stale) setShown((note) => (note && !note.leaving ? { ...note, leaving: true } : note))
  }, [stale])

  const person = shown ? PEOPLE[shown.index]! : null
  const leave = () => setShown((note) => (note && !note.leaving ? { ...note, leaving: true } : note))
  // Where one lands is always there, empty, to be measured against the pointer
  return (
    <div ref={place} className="notify" aria-hidden>
      {shown && person && (
        <div key={shown.index} className="notify__card" data-leaving={shown.leaving || undefined} onPointerEnter={() => setHeld(true)} onPointerLeave={() => setHeld(false)}>
          <button
            type="button"
            className="notify__open"
            tabIndex={-1}
            onClick={() => {
              showInGroup(shown.index)
              launchApp('messages')
              leave()
            }}
          >
            <span className="notify__icon">
              <AppIcon id="messages" />
            </span>
            <span className="notify__text">
              <span className="notify__head">
                <span className="notify__name">{person.name}</span>
                <span className="notify__time">now</span>
              </span>
              <span className="notify__from">{GROUP_NAME}</span>
              <span className="notify__said">{person.quote ?? person.role}</span>
            </span>
          </button>
          <button type="button" className="notify__close" tabIndex={-1} onClick={leave}>
            <X size={11} strokeWidth={3.2} />
          </button>
        </div>
      )}
    </div>
  )
}
