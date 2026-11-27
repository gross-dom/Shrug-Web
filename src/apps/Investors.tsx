import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Check, ChevronLeft } from 'lucide-react'
import { APPLICATION, PREFERENCES, type Question, type Survey } from '../data/investors'
import { Window } from '../kit/window'
import { account, askLogIn, isLP } from '../os/account'
import { AppIcon } from '../os/icons'
import { launchApp } from '../os/launch'
import { useStore } from '../os/store'
import { closeApp } from '../os/wm'
import { CAN_POST, mailtoShrug, postToShrug } from '../phone/apps/outbox'
import '../styles/desk/investors.css'

// Accredited Investors Only (Dom, 27 Nov): a few questions, one to a page, set out as Apple sets a setup
// out: a large question, its choices as rows to press, one button. There are two sets (data/investors.ts).
// Someone logged in as one of Shrug's LPs is asked which deals they want to see, and its last page opens
// their Updates folder. Anyone else is asked what an application to become an LP, or to receive SPVs, asks;
// it is sent to Shrug, and ends "Thank you, we’ll be in touch." The Updates folder's "Enquire about becoming
// an LP" opens this (it opened a message to Shrug in Messages).
//
// What is sent goes where a letter written in Mail goes (src/phone/apps/outbox.ts): Shrug's inbox takes it
// as a form, with who to answer. The demo sends nothing and says so; a live site with no inbox yet hands it
// to the visitor's own mail app. Only the desktop has it.

type Answers = Record<string, string[]>
type Typed = Record<'name' | 'email' | 'note', string>

const ADDRESS = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Whether a question has been answered well enough to go on from. */
function answered(q: Question, answers: Answers, typed: Typed): boolean {
  if (q.kind !== 'fields') return (answers[q.id]?.length ?? 0) > 0
  return (q.fields ?? []).every((field) => field.optional || (field.kind === 'email' ? ADDRESS.test(typed[field.id].trim()) : typed[field.id].trim().length > 0))
}

/** What is sent to Shrug: each question by its name and what was answered, a line each. */
export function written(survey: Survey, answers: Answers, typed: Typed): string {
  return survey.questions
    .map((q) => (q.kind === 'fields' ? (q.fields ?? []).filter((field) => typed[field.id].trim()).map((field) => `${field.label}: ${typed[field.id].trim()}`) : [`${q.label}: ${(answers[q.id] ?? []).join(', ')}`]))
    .flat()
    .join('\n')
}

function Choices({ q, picked, onPick }: { q: Question; picked: string[]; onPick: (next: string[]) => void }) {
  const many = q.kind === 'many'
  const press = (choice: string) => onPick(many ? (picked.includes(choice) ? picked.filter((c) => c !== choice) : [...picked, choice]) : [choice])
  /** Up and down the rows with the arrows, as a list is gone along. */
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    const rows = [...e.currentTarget.querySelectorAll<HTMLElement>('button')]
    const at = rows.indexOf(document.activeElement as HTMLElement)
    if (at < 0) return
    e.preventDefault()
    rows[Math.max(0, Math.min(rows.length - 1, at + (e.key === 'ArrowDown' ? 1 : -1)))]?.focus()
  }
  return (
    <div className="inv-choices" role={many ? 'group' : 'radiogroup'} aria-label={q.title} data-many={many || undefined} data-long={(q.choices?.length ?? 0) > 6 || undefined} onKeyDown={onKey}>
      {(q.choices ?? []).map((choice) => {
        const on = picked.includes(choice)
        return (
          <button key={choice} type="button" className="inv-choice" role={many ? 'checkbox' : 'radio'} aria-checked={on} onClick={() => press(choice)}>
            <span>{choice}</span>
            <i aria-hidden>{on && <Check size={13} strokeWidth={3.4} />}</i>
          </button>
        )
      })}
    </div>
  )
}

function Fields({ q, typed, onType }: { q: Question; typed: Typed; onType: (next: Typed) => void }) {
  return (
    <div className="inv-fields">
      {(q.fields ?? []).map((field) => (
        <label key={field.id} className="inv-field">
          <span>{field.label}</span>
          {field.kind === 'words' ? (
            <textarea rows={3} placeholder={field.hint} value={typed[field.id]} onChange={(e) => onType({ ...typed, [field.id]: e.target.value })} />
          ) : (
            <input
              type={field.kind === 'email' ? 'email' : 'text'}
              inputMode={field.kind === 'email' ? 'email' : undefined}
              autoComplete={field.kind === 'email' ? 'email' : 'name'}
              autoCapitalize={field.kind === 'email' ? 'none' : 'words'}
              spellCheck={false}
              placeholder={field.hint}
              value={typed[field.id]}
              onChange={(e) => onType({ ...typed, [field.id]: e.target.value })}
            />
          )}
        </label>
      ))}
    </div>
  )
}

/** One of the two sets of questions, gone through. `first` is who is asked, by their first name; `from` is what is known of them already. */
function Flow({ survey, first, from, anon }: { survey: Survey; first: string; from: { name: string; email: string }; anon: boolean }) {
  // -1 is its first page, the questions are 0 and up, and the last is the page after them
  const [step, setStep] = useState(-1)
  const [dir, setDir] = useState<1 | -1>(1)
  const [answers, setAnswers] = useState<Answers>({})
  const [typed, setTyped] = useState<Typed>({ name: from.name, email: from.email, note: '' })
  const [state, setState] = useState<'asking' | 'sending' | 'failed'>('asking')
  const [how, setHow] = useState<'sent' | 'demo' | 'handed' | null>(null)
  const total = survey.questions.length
  const q = step >= 0 && step < total ? survey.questions[step]! : null
  const done = step >= total
  const last = step === total - 1
  const ready = !q || answered(q, answers, typed)
  const go = (to: number) => (setDir(to > step ? 1 : -1), setStep(to), setState('asking'))
  const page = useRef<HTMLDivElement>(null)

  // Each page, as it comes in, has the keyboard: its fields if it has any, or else its heading is what is read
  useLayoutEffect(() => {
    const el = page.current
    if (!el) return
    const field = el.querySelector<HTMLElement>('input, textarea')
    ;(field && !typed[q?.fields?.[0]?.id ?? 'name'] ? field : (el.querySelector<HTMLElement>('h1') ?? el)).focus({ preventScroll: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  // The LP's last page opens their Updates folder, which is what the questions were the way to
  useEffect(() => {
    if (!done || survey.id !== 'preferences') return
    const timer = setTimeout(() => (launchApp('updates'), closeApp('investors')), 1600)
    return () => clearTimeout(timer)
  }, [done, survey.id])

  const text = written(survey, answers, typed)
  const send = () => {
    if (state === 'sending') return
    setState('sending')
    void postToShrug({ via: 'accredited', kind: survey.id, from: (typed.name || from.name).trim(), email: (typed.email || from.email).trim(), subject: survey.subject, text }).then((went) => {
      if (went === 'failed') return setState('failed')
      setHow(went)
      go(total)
    })
  }
  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (done) return survey.id === 'preferences' ? (launchApp('updates'), closeApp('investors')) : closeApp('investors')
    if (!ready) return
    if (!last) return go(step + 1)
    // (a live site with no inbox yet: the button is a link to their own mail app, and this is not reached)
    if (CAN_POST) send()
  }

  return (
    <form className="inv" onSubmit={onSubmit} noValidate>
      <div className="inv-top">
        {step >= 0 && !done && (
          <button type="button" className="inv-back" aria-label="Back" onClick={() => go(step - 1)}>
            <ChevronLeft size={19} strokeWidth={2.4} aria-hidden />
          </button>
        )}
        {q && (
          <div className="inv-steps" role="img" aria-label={`Question ${step + 1} of ${total}`}>
            {survey.questions.map((one, i) => (
              <i key={one.id} data-on={i <= step || undefined} />
            ))}
          </div>
        )}
      </div>

      <div ref={page} key={step} className="inv-page" data-dir={dir} data-kind={q ? q.kind : done ? 'done' : 'intro'}>
        {step < 0 ? (
          <>
            <span className="inv-icon" aria-hidden>
              <AppIcon id="investors" />
            </span>
            <h1 tabIndex={-1}>{survey.intro.title.replace('{first}', first || 'there')}</h1>
            <p>{survey.intro.says}</p>
          </>
        ) : q ? (
          <>
            <h1 tabIndex={-1}>{q.title}</h1>
            {q.says && <p>{q.says}</p>}
            {q.kind === 'fields' ? <Fields q={q} typed={typed} onType={(next) => (setTyped(next), setState('asking'))} /> : <Choices q={q} picked={answers[q.id] ?? []} onPick={(next) => (setAnswers({ ...answers, [q.id]: next }), setState('asking'))} />}
          </>
        ) : (
          <>
            <span className="inv-tick" aria-hidden>
              <Check size={34} strokeWidth={3} />
            </span>
            <h1 tabIndex={-1}>{survey.done.title}</h1>
            <p>{survey.done.says}</p>
            {how === 'demo' && <p className="inv-demo">Demo: nothing was sent.</p>}
          </>
        )}
      </div>

      <div className="inv-foot">
        <p className="inv-said" role="status" aria-live="polite">
          {state === 'failed' ? 'That didn’t send. Check your connection and try again.' : ''}
        </p>
        {last && !CAN_POST ? (
          // No inbox on this site yet: it is handed to their own mail app, written out
          <a className="inv-go" aria-disabled={!ready || undefined} href={ready ? mailtoShrug(survey.subject, text) : undefined} onClick={() => ready && (setHow('handed'), go(total))}>
            Send from your mail app
          </a>
        ) : (
          <button type="submit" className="inv-go" aria-disabled={!ready || state === 'sending' || undefined}>
            {done ? (survey.id === 'preferences' ? 'Open Updates' : 'Done') : step < 0 ? survey.intro.go : last ? (state === 'sending' ? 'Sending…' : survey.id === 'preferences' ? 'Save' : 'Submit') : 'Continue'}
          </button>
        )}
        {step < 0 && anon && (
          <button type="button" className="inv-link" onClick={() => askLogIn('invest')}>
            Already an LP? Log In
          </button>
        )}
      </div>
    </form>
  )
}

export function InvestorsApp() {
  const who = useStore(account, (s) => s)
  const lp = isLP(who)
  const member = who.status === 'member' ? who : null
  const survey = lp ? PREFERENCES : APPLICATION
  return (
    <Window className="app invwin" lightsSize="large" body={{ className: 'invwin__body' }}>
      {who.status === 'checking' ? (
        <div className="inv inv--wait" role="status">
          One moment…
        </div>
      ) : (
        // (whoever is asked is asked from the start: logging in part-way begins the questions that are theirs)
        <Flow key={`${survey.id}:${member?.email ?? ''}`} survey={survey} first={member?.first ?? ''} from={{ name: member?.name ?? '', email: member?.email ?? '' }} anon={!member} />
      )}
    </Window>
  )
}
