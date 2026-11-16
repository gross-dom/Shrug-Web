import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { CornerDownLeft, Ellipsis, Eraser, KeyRound, RotateCcw } from 'lucide-react'
import { answer, isEmail, term, TerminalLog } from '../../apps/Terminal'
import { Caret } from '../../kit/window'
import { useStore } from '../../os/store'
import { Menu, NavStack, Screen, useApp } from '../ui'
import '../../styles/phone/terminal.css'

// Case Studies on the phone. iOS has no terminal of its own, so this is the
// one a current iPhone would have: black from edge to edge, monospaced, with
// the glass floating over it. The session is the desktop's own (the same
// listing, the same refusal, the same question, kept in the same store), and a
// row of keys floats at the foot, as terminal apps put one over the keyboard,
// so nobody has to type to get through it.

/** One key of the row at the foot. It never takes the keyboard from the line being typed. */
function Key({ label, onPress, wide, prominent, disabled, children }: { label: string; onPress: () => void; wide?: boolean; prominent?: boolean; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      className="ios-glass term-ios-key"
      data-wide={wide || undefined}
      data-prominent={prominent || undefined}
      aria-label={label}
      aria-disabled={disabled || undefined}
      // Pressing a key leaves the cursor where it is, so the phone's keyboard stays up
      onMouseDown={(e) => e.preventDefault()}
      onClick={disabled ? undefined : onPress}
    >
      {children}
    </button>
  )
}

function Session() {
  const { active } = useApp()
  const step = useStore(term, (t) => t.step)
  const lines = useStore(term, (t) => t.log.length)
  const [typed, setTyped] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const screen = useRef<HTMLFormElement>(null)
  /** Reading the newest line, until the reader scrolls back up the log. */
  const pinned = useRef(true)
  /** Where the cursor goes once a key from the row has been typed in. */
  const caret = useRef<number | null>(null)

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

  // With a real keyboard to hand, typing goes straight into it
  useEffect(() => {
    if (active && matchMedia('(hover: hover) and (pointer: fine)').matches) input.current?.focus({ preventScroll: true })
  }, [active])

  // A key from the row has landed in the line: the cursor goes after it
  useLayoutEffect(() => {
    if (caret.current === null) return
    input.current?.setSelectionRange(caret.current, caret.current)
    caret.current = null
  }, [typed])

  // Escape closes the menu and nothing more: without this it would also be
  // taken as leaving the app, which is what Escape means on an app's first screen
  useEffect(() => {
    if (!active) return
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && screen.current?.closest('.term-ios')?.querySelector('.ios-menu > [aria-expanded="true"]')) e.preventDefault()
    }
    window.addEventListener('keydown', key, true)
    return () => window.removeEventListener('keydown', key, true)
  }, [active])

  /** Puts the cursor in the line, with the keyboard for an email. Called from
   * inside a tap, which is the only time a phone will bring its keyboard up. */
  const takeKeyboard = () => {
    const el = input.current
    if (!el) return
    if (term.get().step === 'email') {
      el.inputMode = 'email'
      el.autocomplete = 'email'
    }
    el.focus({ preventScroll: true })
  }

  const say = (text: string) => {
    answer(text)
    setTyped('')
    const now = term.get().step
    if (now === 'email') takeKeyboard()
    // Noted: the keyboard gets out of the way of what it says
    else if (now === 'done') input.current?.blur()
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    say(typed)
  }

  /** Types `text` where the cursor is. */
  const insert = (text: string) => {
    const el = input.current
    const from = el?.selectionStart ?? typed.length
    const to = el?.selectionEnd ?? typed.length
    // `.com` after a stop that is already there is only `com`
    const add = text === '.com' && typed.slice(0, from).endsWith('.') ? 'com' : text
    caret.current = from + add.length
    setTyped(typed.slice(0, from) + add + typed.slice(to))
    el?.focus({ preventScroll: true })
  }

  const startOver = () => {
    term.set({ step: 'ask', log: [] })
    setTyped('')
    input.current?.blur()
  }

  const requestAccess = () => {
    if (term.get().step === 'ask') return say('y')
    takeKeyboard()
  }

  const ready = isEmail(typed)

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
            { label: 'Request Access', icon: <KeyRound size={18} strokeWidth={2.1} />, disabled: step === 'done', onSelect: requestAccess },
            { label: 'Clear', icon: <Eraser size={18} strokeWidth={2.1} />, divided: true, onSelect: startOver },
          ]}
        >
          <Ellipsis size={22} strokeWidth={2.4} aria-hidden />
        </Menu>
      }
      foot={
        <div key={step} className="term-ios-keys" role="group" aria-label={step === 'ask' ? 'Answer' : step === 'email' ? 'Keys for an email' : 'Session'}>
          {step === 'ask' ? (
            <>
              <Key label="y: yes, request access" wide onPress={() => say('y')}>
                y
              </Key>
              <Key label="n: no" wide onPress={() => say('n')}>
                n
              </Key>
            </>
          ) : step === 'email' ? (
            <>
              <Key label="At sign" onPress={() => insert('@')}>
                @
              </Key>
              <Key label="Full stop" onPress={() => insert('.')}>
                .
              </Key>
              <Key label="Dot com" onPress={() => insert('.com')}>
                .com
              </Key>
              <span className="term-ios-keys__gap" />
              <Key label="Return: send the request" prominent disabled={!ready} onPress={() => say(typed)}>
                <CornerDownLeft size={20} strokeWidth={2.4} aria-hidden />
              </Key>
            </>
          ) : (
            <Key label="Start over" wide onPress={startOver}>
              <RotateCcw size={16} strokeWidth={2.4} aria-hidden />
              start over
            </Key>
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
        onPointerUp={() => {
          // A tap anywhere in the terminal types into it, unless text was just selected
          if (!window.getSelection()?.toString()) takeKeyboard()
        }}
      >
        <TerminalLog />
        <label className="term__entry term-ios-entry">
          <span aria-hidden>&gt;</span>
          <span className="term-ios-line">
            <input
              ref={input}
              className="term__input term-ios-input"
              type="text"
              inputMode={step === 'email' ? 'email' : 'text'}
              // A space, so the line can tell it is empty (and show its cursor) without saying anything
              placeholder=" "
              aria-label={step === 'email' ? 'Your email' : step === 'ask' ? 'Request access? y or n' : 'Terminal input'}
              autoComplete={step === 'email' ? 'email' : 'off'}
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="send"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
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
