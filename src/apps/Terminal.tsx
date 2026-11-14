import { useEffect, useRef, useState, type FormEvent } from 'react'
import { CASE_STUDIES, caseDir } from '../data/caseStudies'
import { SITE } from '../data/site'
import { Prompt, Window } from '../kit/window'
import { createStore, useStore } from '../os/store'

// Case studies, in a terminal. They're private: listing them works, reading
// one is refused, and the shell offers to take an access request instead.
// This is a prototype: the request is noted on screen and goes nowhere.

type Line = { kind: 'cmd' | 'out' | 'err' | 'ask' | 'ok' | 'dim' | 'said'; text: string }

const PATH = 'shrug:case-studies'
const dirs = CASE_STUDIES.map(caseDir)

const intro: Line[] = [
  { kind: 'cmd', text: 'ls' },
  { kind: 'out', text: dirs.join('  ') },
  { kind: 'cmd', text: `cat ${dirs[0]}README` },
  { kind: 'err', text: 'permission denied. case studies are private.' },
  { kind: 'ask', text: 'do you want to request access? (y/n)' },
]

const term = createStore<{ step: 'ask' | 'email' | 'done'; log: Line[] }>({ step: 'ask', log: [] })

function answer(raw: string) {
  const value = raw.trim()
  const low = value.toLowerCase()
  term.set((t) => {
    const log: Line[] = [...t.log, { kind: 'said', text: value }]
    let step = t.step
    if (step === 'ask') {
      if (low === 'y' || low === 'yes') {
        step = 'email'
        log.push({ kind: 'ask', text: 'what’s your email?' })
      } else if (low === 'n' || low === 'no') {
        log.push({ kind: 'out', text: `ok. they’ll be here. ${SITE.mark}` })
        log.push({ kind: 'ask', text: 'changed your mind? (y/n)' })
      } else log.push({ kind: 'err', text: 'y or n.' })
    } else if (step === 'email') {
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        step = 'done'
        log.push({ kind: 'ok', text: `request noted for ${value}.` })
        log.push({ kind: 'dim', text: 'prototype: nothing has been sent.' })
      } else log.push({ kind: 'err', text: 'that doesn’t look like an email. try again.' })
    } else log.push({ kind: 'out', text: `one request is plenty. ${SITE.mark}` })
    return { step, log }
  })
}

const CLASS: Record<Line['kind'], string | undefined> = { cmd: undefined, out: undefined, err: 'err', ask: 'ask', ok: 'ok', dim: 'dim', said: 'said' }

/** The terminal itself, without a window round it: the log and the line being typed. */
export function TerminalScreen() {
  const { step, log } = useStore(term, (t) => t)
  const [typed, setTyped] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const screen = useRef<HTMLFormElement>(null)
  const lines = [...intro, ...log]

  // New output keeps the last line in view, as a terminal does
  useEffect(() => {
    const el = screen.current
    if (el) el.scrollTop = el.scrollHeight
  }, [log.length])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    answer(typed)
    setTyped('')
  }

  return (
    <form
      ref={screen}
      className="term__screen scrolls"
      noValidate
      onSubmit={submit}
      onPointerUp={() => {
        // A click anywhere in the terminal types into it, unless text was just selected
        if (!window.getSelection()?.toString()) input.current?.focus({ preventScroll: true })
      }}
    >
      <div className="term__log" role="log" aria-live="polite" aria-label="Case studies terminal">
        {lines.map((line, i) =>
          line.kind === 'cmd' ? (
            <Prompt key={i} path={PATH}>
              {line.text}
            </Prompt>
          ) : (
            <div key={i} className={CLASS[line.kind]}>
              {line.kind === 'said' ? `> ${line.text}` : line.text}
            </div>
          ),
        )}
      </div>
      <label className="term__entry">
        <span aria-hidden>&gt;</span>
        <input
          ref={input}
          className="term__input"
          type={step === 'email' ? 'email' : 'text'}
          data-autofocus
          aria-label={step === 'email' ? 'Your email' : step === 'ask' ? 'Request access? y or n' : 'Terminal input'}
          autoComplete={step === 'email' ? 'email' : 'off'}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="send"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
        />
      </label>
    </form>
  )
}

export function TerminalApp() {
  return (
    <Window className="term" chrome="terminal" lightsSize="large" title="shrug — case-studies" body={{ className: 'term__body' }}>
      <TerminalScreen />
    </Window>
  )
}
