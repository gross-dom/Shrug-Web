import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type MouseEvent } from 'react'
import { CASE_STUDIES, caseDir, PUBLIC_CASE_STUDIES } from '../data/caseStudies'
import { reach, SITE } from '../data/site'
import { Prompt, Window } from '../kit/window'
import { ALIASES, APP_IDS, type AppId } from '../os/apps'
import { dockPoint } from '../os/dom'
import { createStore, useStore } from '../os/store'
import { openApp, wm } from '../os/wm'
import { launch } from '../phone/system'

// Case studies, in a terminal. They're private: listing them works, reading
// one is refused, and the shell asks whether to request access. It never asks
// for anything it will not use: while Shrug has no address to write to
// (`reach` in src/data/site.ts) a yes is answered with the case studies that
// are public and the one-pager; once there is one, a yes hands over to the
// visitor's own mail or messages app. Nothing typed here is sent anywhere.
//
// It is a shell as far as a curious person will push it: help, ls, cat, open,
// whoami, clear and a few more answer in character, an empty line is just an
// empty line, and Up and Down walk what was typed. There is no state to be
// stuck in: y and n are answers at any time, and n, cancel, exit and Escape
// always come back to the question.

type Line = { kind: 'cmd' | 'out' | 'err' | 'ask' | 'ok' | 'dim' | 'said'; text: string } | { kind: 'link'; text: string; href: string }

const PATH = 'shrug:case-studies'
const dirs = CASE_STUDIES.map(caseDir)

/** As long as a line typed here can be: room for any command or address, and no more. */
export const LINE_MAX = 120

const QUESTION = 'do you want to request access? (y/n)'
const DENIED = 'permission denied. case studies are private.'

const intro: Line[] = [
  { kind: 'cmd', text: 'ls' },
  { kind: 'out', text: dirs.join('  ') },
  { kind: 'cmd', text: `cat ${dirs[0]}README` },
  { kind: 'err', text: DENIED },
  { kind: 'ask', text: QUESTION },
]

interface Term {
  /** ask: a y/n question is waiting for its answer. free: it has had one. Either way every command works. */
  step: 'ask' | 'free'
  /** Everything said since the listing at the top. */
  log: Line[]
  /** What has been typed, oldest first, for Up and Down to walk. It outlives `clear`. */
  typed: string[]
}

/** Where the session has got to, and everything said so far. The phone's Case Studies screen reads and answers the same one. */
export const term = createStore<Term>({ step: 'ask', log: [], typed: [] })

/** Back to the listing and the question, as the terminal opens. */
export const startOver = () => term.set((t) => ({ step: 'ask', log: [], typed: t.typed }))

const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)

const out = (text: string): Line => ({ kind: 'out', text })

/** How many, as a word, for the few numbers it could be. */
const counted = (n: number) => ['no', 'one', 'two', 'three', 'four', 'five', 'six'][n] ?? String(n)

/** The case studies anyone can read, each as a line that opens it. */
const publicOnes = (lead: string): Line[] =>
  PUBLIC_CASE_STUDIES.length ? [out(`${lead}${counted(PUBLIC_CASE_STUDIES.length)} ${PUBLIC_CASE_STUDIES.length === 1 ? 'is' : 'are'} public:`), ...PUBLIC_CASE_STUDIES.map((study): Line => ({ kind: 'link', text: study.dir, href: study.url }))] : []

/** The way to Shrug as a line to press, in the terminal's own case. */
const wayOn = (): Line => {
  const way = reach('', 'Case study access')
  return { kind: 'link', text: way.kind === 'doc' ? 'read the one-pager' : way.label.toLowerCase(), href: way.href }
}

/** A yes. With an address to write to, the request is the visitor's own to send, from their own
 * mail or messages (`handOver` opens it); with none, what there is to read now. */
function yes(): Line[] {
  const way = reach('', 'Case study access')
  if (way.kind === 'doc') return [out('case studies go out by hand.'), ...publicOnes(''), out('for the rest, start with the one-pager:'), wayOn()]
  return [{ kind: 'ok', text: way.kind === 'email' ? 'ok. over to your mail app.' : 'ok. over to your messages.' }, wayOn(), ...publicOnes('meanwhile, ')]
}

const no = (question: string): Line[] => [out(`ok. they’ll be here. ${SITE.mark}`), { kind: 'ask', text: question }]

/** The apps `open` knows, by the names a person would try. */
const OPENS: Record<string, AppId> = { ...Object.fromEntries(APP_IDS.map((id) => [id, id])), ...ALIASES, about: 'about' }
const OPEN_HINT = 'portfolio, faqs, vip, chat, about'

/** A case study that is public, if that is what was named (`alt`, `lula/README`). */
const publicNamed = (arg: string) => PUBLIC_CASE_STUDIES.find((study) => arg.replace(/^\.?\//, '').split('/')[0] === study.dir.slice(0, -1))

const HELP: Line[] = [
  out('y, n          answer the question'),
  out('ls            list the case studies'),
  out('cat <name>    try to read one'),
  out(`open <app>    ${OPEN_HINT}`),
  out('whoami        who is asking'),
  out('clear         start over'),
]

/** What a line typed into the shell gets back, and what it does besides saying it. */
function respond(value: string, step: Term['step']): { lines: Line[]; step?: Term['step']; clear?: boolean; open?: AppId; go?: string } {
  const low = value.toLowerCase()
  const [word = '', ...rest] = low.split(/\s+/)
  const arg = rest.join(' ')

  // An empty line is an empty line
  if (!value) return { lines: [] }

  if (low === 'y' || low === 'yes' || low === 'yep' || low === 'yeah') {
    const way = reach('', 'Case study access')
    return { lines: yes(), step: 'free', go: way.kind === 'doc' ? undefined : way.href }
  }
  if (low === 'n' || low === 'no' || low === 'nope') return { lines: no('changed your mind? (y/n)'), step: 'ask' }
  // Every way of backing out comes back to the question
  if (['cancel', 'back', 'exit', 'quit', 'q', 'logout', 'bye', ':q', ':q!'].includes(low)) return { lines: no(QUESTION), step: 'ask' }

  // An address typed in the hope it is what was wanted: it is not kept, and it is said where it could go
  if (isEmail(value)) {
    const way = reach('', 'Case study access')
    if (way.kind === 'doc') return { lines: [out('nothing is sent from here, so that went nowhere.'), out('start with the one-pager:'), wayOn()] }
    return { lines: [out('nothing is sent from here. write from your own:'), wayOn()] }
  }

  switch (word) {
    case 'help':
    case '?':
    case 'man':
      return { lines: HELP }
    case 'ls':
    case 'll':
    case 'dir':
      return { lines: [out(dirs.join('  '))] }
    case 'cat':
    case 'less':
    case 'more':
    case 'head':
    case 'tail':
    case 'vi':
    case 'vim':
    case 'nano': {
      if (!arg) return { lines: [out(`${word}: which one? try: ${word} ${dirs[0]}README`)] }
      const open = publicNamed(arg)
      if (open) return { lines: [out(`${open.dir} is public:`), { kind: 'link', text: open.dir, href: open.url }] }
      return { lines: [{ kind: 'err', text: DENIED }, { kind: 'ask', text: QUESTION }], step: 'ask' }
    }
    case 'open': {
      if (!arg) return { lines: [out(`open: what? ${OPEN_HINT}.`)] }
      const name = arg.replace(/\s+/g, '-')
      const study = publicNamed(arg)
      if (study) return { lines: [out(`${study.dir} is public:`), { kind: 'link', text: study.dir, href: study.url }] }
      if (name === 'one-pager' || name === 'onepager') return { lines: [{ kind: 'link', text: 'read the one-pager', href: SITE.onePager }] }
      const app = OPENS[name]
      if (app === 'terminal') return { lines: [out('you’re in it.')] }
      if (app) return { lines: [{ kind: 'ok', text: `opening ${arg}.` }], open: app }
      return { lines: [{ kind: 'err', text: `open: nothing called ${arg}. try ${OPEN_HINT}.` }] }
    }
    case 'whoami':
      return { lines: [out('a founder, probably.')] }
    case 'pwd':
      return { lines: [out(PATH)] }
    case 'cd':
      return { lines: [out('there’s nowhere else to go. it’s all in here.')] }
    case 'sudo':
      return { lines: [{ kind: 'err', text: `nice try. ${SITE.mark}` }] }
    case 'echo':
      return { lines: [out(value.slice(4).trim())] }
    case 'clear':
    case 'cls':
    case 'reset':
      return { lines: [], clear: true }
    case 'hi':
    case 'hello':
    case 'hey':
      return { lines: [out('hi.')] }
    case 'thanks':
    case 'thank':
    case 'shrug':
      return { lines: [out(SITE.mark)] }
  }
  return { lines: [{ kind: 'err', text: `command not found: ${word}` }, { kind: 'dim', text: step === 'ask' ? 'y or n answers the question. help lists the rest.' : 'help lists what there is.' }] }
}

/** Opens an app from the shell: its window on the desktop, the app itself on the phone. */
function openIt(app: AppId) {
  if (wm.get().compact) launch(app)
  else openApp(app, dockPoint(app))
}

/** Answers a line typed into the terminal (or a key pressed for it). Both layouts call this one. */
export function answer(raw: string) {
  const value = raw.trim().slice(0, LINE_MAX)
  const reply = respond(value, term.get().step)
  term.set((t) => {
    const typed = value && t.typed[t.typed.length - 1] !== value ? [...t.typed, value] : t.typed
    if (reply.clear) return { step: 'ask', log: [], typed }
    return { step: reply.step ?? t.step, log: [...t.log, { kind: 'said', text: value }, ...reply.lines], typed }
  })
  if (reply.open) openIt(reply.open)
  // The request is the visitor's own to send: their mail or messages app opens on it
  if (reply.go) window.location.href = reply.go
}

/** Escape with nothing typed: back to the question, if it is not what the terminal is already waiting on. */
export function backToQuestion() {
  term.set((t) => {
    const last = t.log[t.log.length - 1]
    if (t.step === 'ask' && (!last || last.kind === 'ask')) return t
    return { ...t, step: 'ask', log: [...t.log, { kind: 'ask', text: QUESTION }] }
  })
}

/** The line being typed, with what a shell gives it: Return sends it, Up and Down walk what was
 * typed before, and Escape empties it. `onEscape` is what Escape does once it is empty. */
export function useLine(onEscape?: () => void) {
  const [typed, setTyped] = useState('')
  /** How far back Up has gone (0 is the last thing typed), and what was being typed before it went. */
  const back = useRef<{ at: number; draft: string } | null>(null)

  const say = (text: string) => {
    back.current = null
    setTyped('')
    answer(text)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      if (typed) {
        // The line is what Escape lets go of first; nothing else hears this one
        e.preventDefault()
        back.current = null
        setTyped('')
      } else onEscape?.()
      return
    }
    if ((e.key !== 'ArrowUp' && e.key !== 'ArrowDown') || e.altKey || e.metaKey || e.ctrlKey) return
    const past = term.get().typed
    if (!past.length) return
    e.preventDefault()
    const now = back.current
    if (e.key === 'ArrowUp') {
      const at = now ? Math.min(now.at + 1, past.length - 1) : 0
      back.current = { at, draft: now ? now.draft : typed }
      setTyped(past[past.length - 1 - at]!)
    } else if (now) {
      // Down past the newest is what was being typed when Up was first pressed
      if (now.at === 0) {
        back.current = null
        setTyped(now.draft)
      } else {
        back.current = { ...now, at: now.at - 1 }
        setTyped(past[past.length - now.at]!)
      }
    }
  }

  const onChange = (value: string) => {
    back.current = null
    setTyped(value.slice(0, LINE_MAX))
  }

  /** Puts `text` at the end of the line, as if typed: for a key pressed before the line could take the keyboard. */
  const type = (text: string) => {
    back.current = null
    setTyped((now) => (now + text).slice(0, LINE_MAX))
  }

  return { typed, setTyped: onChange, type, say, onKeyDown }
}

const CLASS: Record<Exclude<Line['kind'], 'cmd' | 'link'>, string | undefined> = { out: undefined, err: 'err', ask: 'ask', ok: 'ok', dim: 'dim', said: 'said' }

/** A line that goes somewhere: a case study, the one-pager, the visitor's own mail. */
function LinkLine({ text, href }: { text: string; href: string }) {
  const page = /^https?:/.test(href)
  return (
    <div className="term__go">
      <a
        className="term__link"
        href={href}
        // The one-pager is on someone else's site and is told nothing of where the visit came from; Shrug's own pages are
        {...(page ? { target: '_blank', rel: href.startsWith(SITE.onePager) ? 'noreferrer' : 'noopener' } : null)}
      >
        {text}
        {page && <span className="sr-only">, in a new tab</span>}
      </a>
    </div>
  )
}

/** Everything the terminal has printed, top to bottom. */
export function TerminalLog() {
  const log = useStore(term, (t) => t.log)
  return (
    <div className="term__log" role="log" aria-live="polite" aria-label="Case studies terminal">
      {[...intro, ...log].map((line, i) =>
        line.kind === 'cmd' ? (
          <Prompt key={i} path={PATH}>
            {line.text}
          </Prompt>
        ) : line.kind === 'link' ? (
          <LinkLine key={i} text={line.text} href={line.href} />
        ) : (
          <div key={i} className={CLASS[line.kind]}>
            {line.kind === 'said' ? `> ${line.text}`.trimEnd() : line.text}
          </div>
        ),
      )}
    </div>
  )
}

/** A press on the terminal that is not on something of its own (a link, a key) and has not just selected text. */
export const bareClick = (e: MouseEvent) => !(e.target as HTMLElement).closest('a, button') && !window.getSelection()?.toString()

/** The terminal itself, without a window round it: the log and the line being typed. */
export function TerminalScreen() {
  const step = useStore(term, (t) => t.step)
  const lines = useStore(term, (t) => t.log.length)
  const { typed, setTyped, say, onKeyDown } = useLine(backToQuestion)
  const input = useRef<HTMLInputElement>(null)
  const screen = useRef<HTMLFormElement>(null)

  // New output keeps the last line in view, as a terminal does
  useEffect(() => {
    const el = screen.current
    if (el) el.scrollTop = el.scrollHeight
  }, [lines, step])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    say(typed)
  }

  /** A key for a finger: it answers without taking the caret (and the keyboard) from the line. */
  const key = (label: string, text: string, name: string) => (
    <button
      type="button"
      className="term__key"
      aria-label={name}
      onMouseDown={(e) => e.preventDefault()}
      onClick={(e) => {
        // Pressed from the keyboard it has the focus, and is about to be swapped for another key: the line takes it
        const focused = document.activeElement === e.currentTarget
        say(text)
        if (focused) input.current?.focus({ preventScroll: true })
      }}
    >
      {label}
    </button>
  )

  return (
    <form
      ref={screen}
      className="term__screen scrolls"
      noValidate
      onSubmit={submit}
      // A click anywhere in the terminal types into it. On the click and not on the press: after a
      // finger's press the browser sends a mouse press of its own, which hands the caret to the window
      onClick={(e) => bareClick(e) && input.current?.focus({ preventScroll: true })}
    >
      <TerminalLog />
      <label className="term__entry">
        <span aria-hidden>&gt;</span>
        <input
          ref={input}
          className="term__input"
          type="text"
          maxLength={LINE_MAX}
          data-autofocus
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
      </label>
      {/* Where there is a touch screen (the stylesheet shows these only there), nobody has to raise a keyboard to answer */}
      <div className="term__keys" role="group" aria-label={step === 'ask' ? 'Answer' : 'Commands'}>
        {step === 'ask' ? (
          <>
            {key('y', 'y', 'y: yes, request access')}
            {key('n', 'n', 'n: no')}
          </>
        ) : (
          <>
            {key('help', 'help', 'help: what can be typed')}
            {key('clear', 'clear', 'clear: start over')}
          </>
        )}
      </div>
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
