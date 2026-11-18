import { useEffect, useRef, useState } from 'react'
import { chat } from '../apps/chat'
import { inbox } from '../apps/state'
import { PEOPLE, type Person } from '../data/people'
import { formatter } from './dates'
import { useReturnFocus } from './focus'
import { idleSeconds, saver, startSaver, startsItself, wakeSaver } from './saver'
import { useStore } from './store'
import { isShowing, wm } from './wm'

// The screen saver. A dark screen: the clock sits where a lock screen keeps
// it, and the people from the group chat pass by one at a time, each with
// what they said. Any key, press
// or movement wakes the desk, and whatever woke it does nothing else. It
// waits for a still desk: a conversation that is arriving where it can be
// read is not one. A phone has none: nobody should be locked out of a page
// for reading it.

const DATE = formatter({ weekday: 'long', day: 'numeric', month: 'long' })
const TIME = formatter({ hour: 'numeric', minute: '2-digit' })

/** The hour and the minute alone, as a lock screen writes them: no AM or PM, wherever a language puts it. */
const clockOf = (now: Date) =>
  TIME.formatToParts(now)
    .filter((part) => part.type !== 'dayPeriod')
    .map((part) => part.value)
    .join('')
    .trim()

/** The most of what someone said that can be read as it passes. */
const SHORT = 140

/** What a person said, if it can be read in passing: all of it, or its first sentence. */
function saidBy(person: Person): string | null {
  const quote = person.quote
  if (!quote) return null
  if (quote.length <= SHORT) return quote
  const first = /^.*?[.!?](?=\s|$)/.exec(quote)?.[0]
  return first && first.length >= 24 && first.length <= SHORT ? first : null
}

/** How long a person stays up: longer with words to read. */
const stayFor = (said: string | null) => (said ? Math.max(5200, 2400 + said.length * 60) : 4200)

export function ScreenSaver() {
  const on = useStore(saver, (s) => s.on)
  const compact = useStore(wm, (s) => s.compact)
  const [now, setNow] = useState(() => new Date())
  const [who, setWho] = useState(0)
  const turned = useRef(0)
  turned.current = who
  /** The main pointer is a finger: there is nothing to move and no key to press. */
  const [finger] = useState(() => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches)
  const root = useRef<HTMLDivElement>(null)
  const clock = useRef<HTMLDivElement>(null)
  const foot = useRef<HTMLDivElement>(null)

  // Whatever had the keyboard when it came on gets it back when the desk
  // wakes; if that has gone (a menu item, the menu now shut), the window in
  // front does, or the mark's menu
  useReturnFocus(on, () => document.querySelector('.wf[data-active]') ?? document.querySelector('[data-menu-title="mark"]'))

  // Starts itself once the desk has been still long enough
  useEffect(() => {
    const wait = idleSeconds() * 1000
    let timer: ReturnType<typeof setTimeout>
    const arm = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        // Not behind another tab, not on the iPhone, and not if the visitor has said never
        if (!document.hidden && !wm.get().compact && startsItself()) startSaver()
      }, wait)
    }

    // The conversation arriving where it can be read is the site's own show:
    // whatever happens in it (a question typed, someone's dots, a reply)
    // starts the wait again, so the saver comes on only once the desk has
    // been still since the last of it
    const watching = () => {
      const talk = chat.get()
      return isShowing(wm.get().wins.messages) && inbox.get().open === 'group' && talk.started && !talk.paused
    }
    const unwatch = chat.subscribe(() => {
      if (watching()) arm()
    })

    // A finger's press goes on to become a click, and by then the saver has
    // gone: the click would land on whatever was hidden under it (close a
    // window, open an app, follow a link). That click is not the visitor's.
    let eating: ReturnType<typeof setTimeout> | undefined
    const eat = (e: Event) => {
      e.preventDefault()
      e.stopPropagation()
      spit()
    }
    const spit = () => {
      clearTimeout(eating)
      eating = undefined
      window.removeEventListener('click', eat, true)
    }
    const stir = (e: Event) => {
      if (saver.get().on && wakeSaver() && e.type === 'pointerdown' && (e as PointerEvent).pointerType !== 'mouse') {
        spit()
        window.addEventListener('click', eat, true)
        eating = setTimeout(spit, 700)
      }
      arm()
    }
    // The key that wakes it is swallowed: it must not also type into, or
    // press, whatever had the keyboard underneath. A key held with Ctrl, Cmd
    // or Alt is the browser's or the system's (reload, another tab) and is
    // left alone.
    const key = (e: KeyboardEvent) => {
      if (saver.get().on) {
        if (e.ctrlKey || e.metaKey || e.altKey) return
        e.preventDefault()
        e.stopPropagation()
        wakeSaver()
      }
      arm()
    }
    const shown = () => {
      if (!document.hidden) arm()
    }
    const events = ['pointermove', 'pointerdown', 'wheel', 'touchstart'] as const
    window.addEventListener('keydown', key, true)
    events.forEach((name) => window.addEventListener(name, stir, { passive: true }))
    document.addEventListener('visibilitychange', shown)
    arm()
    return () => {
      clearTimeout(timer)
      spit()
      unwatch()
      window.removeEventListener('keydown', key, true)
      events.forEach((name) => window.removeEventListener(name, stir))
      document.removeEventListener('visibilitychange', shown)
    }
  }, [])

  // While it's on: it has the keyboard (so a screen reader is where a sighted
  // visitor is), the clock ticks and the people turn over
  useEffect(() => {
    if (!on) return
    root.current?.focus({ preventScroll: true })
    setNow(new Date())
    const tick = setInterval(() => setNow(new Date()), 5000)
    let turn: ReturnType<typeof setTimeout>
    const next = () => {
      turn = setTimeout(
        () => {
          setWho((turned.current + 1) % PEOPLE.length)
          turned.current = (turned.current + 1) % PEOPLE.length
          next()
        },
        stayFor(saidBy(PEOPLE[turned.current]!)),
      )
    }
    next()
    return () => {
      clearInterval(tick)
      clearTimeout(turn)
    }
  }, [on, compact])

  if (compact) return null

  const person = PEOPLE[who]!
  const said = saidBy(person)

  return (
    <div
      ref={root}
      className="saver"
      role="dialog"
      aria-modal="true"
      aria-label="Screen saver"
      aria-describedby="saver-hint"
      tabIndex={-1}
      data-on={on || undefined}
      aria-hidden={!on}
      // A press that assistive tech makes for someone arrives as a click and nothing else
      onClick={() => wakeSaver()}
      {...(on ? null : ({ inert: '' } as object))}
    >
      <div className="saver__sky" />
      <div ref={clock} className="saver__clock">
        <div className="saver__date">{DATE.format(now)}</div>
        <div className="saver__time">{clockOf(now)}</div>
      </div>
      <div ref={foot} className="saver__foot">
        <div className="saver__who" key={who} style={{ animationDuration: `${stayFor(said)}ms` }}>
          {said && <span className="saver__said">{/^[“"]/.test(said) ? said : `“${said}”`}</span>}
          <span className="saver__name">{person.name}</span>
          <span className="saver__role">{person.role}</span>
        </div>
        <div className="saver__hint" id="saver-hint">
          {finger ? 'Tap to wake' : 'Move, click or press a key to wake'}
        </div>
      </div>
    </div>
  )
}
