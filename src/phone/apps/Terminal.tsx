import { useEffect, useLayoutEffect, useRef, type FormEvent, type ReactNode } from 'react'
import { Ellipsis, Eraser, KeyRound, RotateCcw } from 'lucide-react'
import { bareClick, LINE_MAX, startOver, term, TerminalLog, useLine } from '../../apps/Terminal'
import { Caret } from '../../kit/window'
import { useStore } from '../../os/store'
import { Menu, NavStack, Screen, useApp } from '../ui'
import '../../styles/phone/terminal.css'

// Case Studies on the phone. iOS has no terminal of its own, so this is the
// one a current iPhone would have: black from edge to edge, monospaced, with
// the glass floating over it. The session is the desktop's own (the same
// listing, the same refusal, the same question, the same answers, kept in the
// same store), and a row of keys floats at the foot, as terminal apps put one
// over the keyboard, so nobody has to type to get through it: y and n while
// the question is waiting, and the commands worth trying once it is answered.

/** One key of the row at the foot. It never takes the keyboard from the line being typed. */
function Key({ label, onPress, wide, children }: { label: string; onPress: () => void; wide?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      className="ios-glass term-ios-key"
      data-wide={wide || undefined}
      aria-label={label}
      // Pressing a key leaves the cursor where it is, so the phone's keyboard stays up
      onMouseDown={(e) => e.preventDefault()}
      onClick={onPress}
    >
      {children}
    </button>
  )
}

function Session() {
  const { active } = useApp()
  const step = useStore(term, (t) => t.step)
  const lines = useStore(term, (t) => t.log.length)
  const { typed, setTyped, type, say: send, onKeyDown } = useLine()
  const input = useRef<HTMLInputElement>(null)
  const screen = useRef<HTMLFormElement>(null)
  /** Reading the newest line, until the reader scrolls back up the log. */
  const pinned = useRef(true)

  const toEnd = () => {
    const el = screen.current
    if (el) el.scrollTop = el.scrollHeight
  }

  // New output keeps the last line in view, as a terminal does
  useLayoutEffect(() => {
    pinned.current = true
    toEnd()
  }, [lines, step])

  // So does the keyboard coming up under it, or the phone being turned
  useEffect(() => {
    const el = screen.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      if (pinned.current) toEnd()
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // With a real keyboard to hand, typing goes straight into the line: the first
  // key pressed while nothing else has the keyboard puts the cursor there, and
  // lands in it. In the first moments after the app is opened the screen is
  // still arriving and cannot take the keyboard: a letter typed then goes into
  // the line all the same, and the cursor follows it once it can
  useEffect(() => {
    if (!active) return
    const key = (e: KeyboardEvent) => {
      if (e.key.length !== 1 || e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return
      const at = document.activeElement
      if (at instanceof HTMLInputElement || at instanceof HTMLTextAreaElement) return
      // Space presses a button that has the keyboard
      if (e.key === ' ' && at instanceof HTMLButtonElement && screen.current?.closest('.sb-app')?.contains(at)) return
      if (screen.current?.closest('.ios-screen')?.querySelector('.ios-menu > [aria-expanded="true"]')) return
      const el = input.current
      if (!el) return
      el.focus({ preventScroll: true })
      if (document.activeElement === el) {
        // After whatever is already in the line
        el.setSelectionRange(el.value.length, el.value.length)
        return
      }
      e.preventDefault()
      type(e.key)
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [active]) // eslint-disable-line react-hooks/exhaustive-deps

  /** Says it, as if typed. A yes brings a few lines and things to press: the keyboard gets out of their way. */
  const say = (text: string) => {
    const waiting = term.get().step === 'ask'
    send(text)
    if (waiting && term.get().step === 'free') input.current?.blur()
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    say(typed)
  }

  const clear = () => {
    startOver()
    setTyped('')
    input.current?.blur()
  }

  return (
    <Screen
      title="Case Studies"
      tone="dark"
      fixed
      className="term-ios"
      trailing={
        <Menu
          label="More"
          items={[
            { label: 'Request Access', icon: <KeyRound size={18} strokeWidth={2.1} />, onSelect: () => say('y') },
            { label: 'Clear', icon: <Eraser size={18} strokeWidth={2.1} />, divided: true, onSelect: clear },
          ]}
        >
          <Ellipsis size={22} strokeWidth={2.4} aria-hidden />
        </Menu>
      }
      foot={
        <div key={step} className="term-ios-keys" role="group" aria-label={step === 'ask' ? 'Answer' : 'Commands'}>
          {step === 'ask' ? (
            <>
              <Key label="y: yes, request access" wide onPress={() => say('y')}>
                y
              </Key>
              <Key label="n: no" wide onPress={() => say('n')}>
                n
              </Key>
            </>
          ) : (
            <>
              <Key label="help: what can be typed" wide onPress={() => say('help')}>
                help
              </Key>
              <Key label="ls: list the case studies" wide onPress={() => say('ls')}>
                ls
              </Key>
              <Key label="clear: start over" wide onPress={clear}>
                <RotateCcw size={16} strokeWidth={2.4} aria-hidden />
                clear
              </Key>
            </>
          )}
        </div>
      }
    >
      <form
        ref={screen}
        className="term-ios-screen term ss-term"
        noValidate
        onSubmit={submit}
        onScroll={(e) => {
          const el = e.currentTarget
          pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24
        }}
        // A tap anywhere in the terminal types into it, unless it was on something of its own or text was just
        // selected. Inside the tap itself, which is the only time a phone will bring its keyboard up
        onClick={(e) => bareClick(e) && input.current?.focus({ preventScroll: true })}
      >
        <TerminalLog />
        <label className="term__entry term-ios-entry">
          {/* The mark and the field are set out at a field's size and drawn at the log's, on one baseline */}
          <span className="term-ios-line">
            <span aria-hidden>&gt;</span>
            <input
              ref={input}
              className="term__input term-ios-input"
              type="text"
              maxLength={LINE_MAX}
              // A space, so the line can tell it is empty (and show its cursor) without saying anything
              placeholder=" "
              aria-label={step === 'ask' ? 'Request access? y or n' : 'Terminal: help lists what can be typed'}
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="send"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={onKeyDown}
            />
            {/* The cursor a terminal shows while nobody is typing */}
            <span className="term-ios-cursor" aria-hidden>
              <Caret />
            </span>
          </span>
        </label>
      </form>
    </Screen>
  )
}

export function TerminalApp() {
  return <NavStack>{() => <Session />}</NavStack>
}
