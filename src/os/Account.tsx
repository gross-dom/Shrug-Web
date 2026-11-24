import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Plus } from 'lucide-react'
import { FACES } from '../../store/shared/faces'
import { hidden, phoneOf, POINTS_PER_DOLLAR, type Picture } from '../../store/shared/rules'
import { account, ACCOUNT_DEMO, addPhone, askLogIn, closeLogIn, demoLink, isLP, logIn, logOut, provePhone, refreshAccount, saveProfile, start, textTo, unlocked, verify, type Failed, type Member, type Why } from './account'
import { asked } from './address'
import { Face } from './Face'
import { launchApp } from './launch'
import { useStore } from './store'
import { closeApp } from './wm'

// Log In, at the right of the menu bar, and the one sheet it lets down (design/v1: SignIn-*, SignedIn-*).
// Nothing else on the desk has a login of its own: something locked opens this same sheet, which then says
// what it was opened for.
//
// Logging in is an email first. An address nobody has goes straight to a phone number and six digits by
// text. An address on the list is confirmed by six digits to its inbox, and is then asked for a number to
// use from then on. Someone who has a number is texted. The first time, a display name and a picture are
// asked for. Logged in, the bar shows their picture and first name, and the sheet their points, the ways to
// the store and to Updates, and Log Out.

const SAID: Record<string, string> = {
  email: 'That doesn’t look like an email address.',
  phone: 'That doesn’t look like a phone number. Start with the country code if it isn’t a US number.',
  mail: 'We couldn’t send to that address. Check it and try again.',
  text: 'We couldn’t text that number. Check it and try again.',
  wait: 'One was sent a moment ago. Give it a minute, then ask again.',
  expired: 'That code has run out. Send a new one.',
  taken: 'That number is on another account. Log in with it instead.',
  start: 'That address has an account. Start again with it.',
  confirm: 'To change your number, confirm your email first.',
  offline: 'No connection.',
  name: 'Add a name first.',
  picture: 'That picture didn’t work. Try another.',
}
const said = (error: string) => SAID[error] ?? 'That didn’t work. Try again.'

/** What the sheet says at its head, for whatever opened it. */
const HEADS: Record<NonNullable<Why> | 'plain', { head: string; lead: string }> = {
  plain: { head: 'Log in to Shrug VIP', lead: 'Start with your email. New here? This makes your account.' },
  updates: { head: 'Log in to open Updates', lead: 'Updates is for Shrug’s LPs. Start with your email.' },
  request: { head: 'Log in to request', lead: 'Start with your email. New here? This makes your account.' },
  post: { head: 'Log in to post', lead: 'Every photo on the wall has a name behind it. Yours is kept while you log in.' },
}

const COUNT = ['No', 'One', 'Two', 'Three', 'Four', 'Five']
const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

/** A number as it is read: +1 (415) 555 0134. One from another country is left as it is dialed. */
const pretty = (phone: string) => {
  const us = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(phone)
  return us ? `+1 (${us[1]}) ${us[2]} ${us[3]}` : phone
}

/** A number as it is typed, set out as it goes. An American number is the one the page expects; any other begins with a plus. */
function shaped(typed: string): string {
  const plus = typed.trim().startsWith('+')
  const digits = typed.replace(/\D/g, '')
  if (!digits) return plus ? '+' : ''
  if (plus && !digits.startsWith('1')) return `+${digits.slice(0, 15)}`
  const n = (plus || (digits.length > 10 && digits.startsWith('1')) ? digits.slice(1) : digits).slice(0, 10)
  const [a, b, c] = [n.slice(0, 3), n.slice(3, 6), n.slice(6)]
  return `+1${a ? ` (${a}` : ''}${b ? `) ${b}` : ''}${c ? ` ${c}` : ''}`
}

/** The seconds left until a moment, counted down as they pass. */
function useLeft(until: number) {
  const left = () => Math.max(0, Math.ceil((until - Date.now()) / 1000))
  const [seconds, setSeconds] = useState(left)
  useEffect(() => {
    setSeconds(left())
    if (until <= Date.now()) return
    const timer = setInterval(() => setSeconds(left()), 500)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [until])
  return seconds
}

/** A photo made small and square before it is sent: the middle of it, 512 across. */
async function squared(file: File): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const image = await new Promise<HTMLImageElement>((done, failed) => {
      const el = new Image()
      el.onload = () => done(el)
      el.onerror = () => failed(new Error('picture'))
      el.src = url
    })
    const side = Math.min(image.naturalWidth, image.naturalHeight)
    const canvas = Object.assign(document.createElement('canvas'), { width: 512, height: 512 })
    canvas.getContext('2d')!.drawImage(image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2, side, side, 0, 0, 512, 512)
    return canvas.toDataURL('image/jpeg', 0.86)
  } finally {
    URL.revokeObjectURL(url)
  }
}

function Note({ children }: { children: ReactNode }) {
  return ACCOUNT_DEMO ? <p className="account__note">{children}</p> : null
}

/** Six digits, in six boxes: one field under them takes the typing, a paste, or the code a phone offers from its texts. */
function Code({ value, bad, busy, label, onChange }: { value: string; bad: boolean; busy: boolean; label: string; onChange: (code: string) => void }) {
  const field = useRef<HTMLInputElement>(null)
  useEffect(() => field.current?.focus(), [])
  // A wrong code stays in its boxes to be seen; the next digit typed begins a new one
  useEffect(() => {
    if (bad) field.current?.select()
  }, [bad])
  useEffect(() => {
    if (!busy) field.current?.focus()
  }, [busy])
  return (
    <label className="account__code" data-bad={bad || undefined}>
      <span className="sr-only">{label}</span>
      <input ref={field} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={6} value={value} disabled={busy} aria-invalid={bad || undefined} onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))} />
      <span className="account__boxes" aria-hidden>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <span key={i} data-cur={(!bad && i === Math.min(value.length, 5)) || undefined}>
            {value[i] ?? ''}
          </span>
        ))}
      </span>
    </label>
  )
}

/** Where the sheet is. */
type Stage =
  | { at: 'email' }
  /** Someone new: their number. */
  | { at: 'phone' }
  /** Six digits: texted to a number just given (`phone`), texted to the number on file, emailed, or texted to a number being added. */
  | { at: 'code'; kind: 'new' | 'text' | 'inbox' | 'add'; phone?: string; to?: string; byInbox?: boolean; again: number }
  | { at: 'paused'; until: number; what: 'number' | 'address' }
  /** Logged in, by their inbox or their link: the number they will use from now on. */
  | { at: 'addphone' }
  | { at: 'profile'; first: boolean }
  | { at: 'menu' }

function Sheet({ who, why, onDone }: { who: Member | null; why: Why; onDone: () => void }) {
  const [at, setStage] = useState<Stage>(() => (who ? (who.via === 'link' && who.needs.phone ? { at: 'addphone' } : { at: 'menu' }) : { at: 'email' }))
  // What is only for someone logged in is not shown to nobody: should they be logged out under it, it begins again
  const stage: Stage = !who && (at.at === 'menu' || at.at === 'profile' || at.at === 'addphone') ? { at: 'email' } : at
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [told, setTold] = useState('')
  /** Wrong guesses at the code that is out, where the server does not count them for the page (a texted code has five). */
  const [wrongs, setWrongs] = useState(0)
  const field = useRef<HTMLInputElement>(null)
  useEffect(() => {
    field.current?.focus()
  }, [stage.at])

  const go = (next: Stage) => {
    setTold('')
    setCode('')
    setWrongs(0)
    setStage(next)
  }
  const fail = (failed: Failed, what: 'number' | 'address') => {
    if (failed.error === 'locked') return go({ at: 'paused', until: Date.now() + (failed.retryIn ?? 600) * 1000, what })
    setTold(said(failed.error))
  }
  /** What comes after getting in: a number for someone who came by their inbox or link, then a name and picture the first time. */
  const onward = () => {
    const now = account.get()
    if (now.status !== 'member') return go({ at: 'email' })
    if (now.needs.phone && now.via !== 'text') return go({ at: 'addphone' })
    if (now.needs.profile) return go({ at: 'profile', first: true })
    onDone()
  }

  // ---- An email
  const sendEmail = async (e: FormEvent, byInbox = false) => {
    e.preventDefault()
    setBusy(true)
    setTold('')
    const address = (who?.email ?? email).trim()
    const started = await start(address, byInbox)
    setBusy(false)
    if ('error' in started) {
      // One sent a moment ago is still good: on to its six digits
      if (started.error === 'wait' && started.step) return go({ at: 'code', kind: started.step, to: started.to, byInbox, again: Date.now() + (started.retryIn ?? 45) * 1000 })
      return fail(started, 'address')
    }
    if (started.step === 'phone') return go({ at: 'phone' })
    go({ at: 'code', kind: started.step, to: started.step === 'text' ? started.to : undefined, byInbox, again: Date.now() + started.resendIn * 1000 })
  }

  // ---- A number: someone new's, or one being added to an account
  const sendPhone = async (e: FormEvent) => {
    e.preventDefault()
    if (!phoneOf(phone)) return setTold(said('phone'))
    setBusy(true)
    setTold('')
    const adding = stage.at === 'addphone'
    const sent = adding ? await addPhone(phone) : await textTo(email.trim(), phone)
    setBusy(false)
    if ('error' in sent) return fail(sent, 'number')
    go({ at: 'code', kind: adding ? 'add' : 'new', phone: sent.phone, again: Date.now() + sent.resendIn * 1000 })
  }

  // ---- Six digits
  const check = async (given: string) => {
    if (stage.at !== 'code') return
    setBusy(true)
    setTold('')
    const checked = stage.kind === 'add' ? await provePhone(stage.phone!, given) : await verify({ email: (who?.email ?? email).trim(), code: given, phone: stage.kind === 'new' ? stage.phone : undefined, byInbox: stage.byInbox })
    setBusy(false)
    if ('ok' in checked) return onward()
    if (checked.error === 'wrong') {
      const left = checked.left ?? Math.max(0, 4 - wrongs)
      setWrongs((n) => n + 1)
      return setTold(`That code isn’t right. ${COUNT[left] ?? left} ${left === 1 ? 'try' : 'tries'} left.`)
    }
    fail(checked, stage.kind === 'inbox' ? 'address' : 'number')
  }
  const typed = (next: string) => {
    // After a wrong one, whatever is typed begins the next
    setTold((was) => (was && next.length < 6 ? '' : was))
    setCode(next)
    if (next.length === 6) check(next)
  }
  const again = async () => {
    if (stage.at !== 'code') return
    setBusy(true)
    setTold('')
    setCode('')
    const sent = stage.kind === 'add' ? await addPhone(stage.phone!) : stage.kind === 'new' ? await textTo(email.trim(), stage.phone!) : await start((who?.email ?? email).trim(), stage.byInbox)
    setBusy(false)
    if ('error' in sent && sent.error !== 'wait') return fail(sent, stage.kind === 'inbox' ? 'address' : 'number')
    setWrongs(0)
    setStage({ ...stage, again: Date.now() + ('resendIn' in sent ? sent.resendIn : ('retryIn' in sent && sent.retryIn) || 45) * 1000 })
  }

  if (stage.at === 'email') {
    const words = HEADS[why ?? 'plain']
    return (
      <form className="account__form" onSubmit={sendEmail} noValidate>
        <h3 className="account__head">{words.head}</h3>
        <p className="account__lead">{words.lead}</p>
        <label className="account__field">
          <span className="sr-only">Email address</span>
          <input ref={field} type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <button type="submit" className="account__go" disabled={busy || !email.trim()}>
          {busy ? 'One moment…' : 'Continue'}
        </button>
        {told && (
          <p className="account__said" role="alert">
            {told}
          </p>
        )}
        <Note>Demo: nothing is sent. An address beginning “lp” is on the list; any other is new.</Note>
      </form>
    )
  }

  if (stage.at === 'phone' || stage.at === 'addphone') {
    const adding = stage.at === 'addphone'
    const linked = adding && who?.via === 'link'
    return (
      <form className="account__form" onSubmit={sendPhone} noValidate>
        <h3 className="account__head">{!adding ? 'What’s your number?' : linked ? `Welcome${who?.first ? `, ${who.first}` : ''}` : who?.needs.phone ? 'Email confirmed' : 'A new number'}</h3>
        <p className="account__lead">
          {!adding
            ? 'We’ll text you a six-digit code. This number is how you’ll log in from now on.'
            : linked
              ? `Your link confirmed ${who!.email}. Add a phone number to finish. It’s how you’ll log in next time.`
              : 'Add a phone number. It’s how you’ll log in next time, with a texted code.'}
        </p>
        <label className="account__field">
          <span className="sr-only">Phone number</span>
          <input
            ref={field}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="+1 (___) ___ ____"
            value={phone}
            onChange={(e) => {
              // Set out as it is typed, while the typing is at its end; an edit in its middle is left alone
              const el = e.target
              setPhone(el.selectionStart === el.value.length ? shaped(el.value) : el.value)
            }}
          />
        </label>
        <button type="submit" className="account__go" disabled={busy || phone.replace(/\D/g, '').length < 8}>
          {busy ? 'Texting…' : 'Text Me a Code'}
        </button>
        {told && (
          <p className="account__said" role="alert">
            {told}
          </p>
        )}
        {!adding && (
          <button type="button" className="account__link" onClick={() => go({ at: 'email' })}>
            Use a different email
          </button>
        )}
        {adding && told === SAID.confirm && (
          <button type="button" className="account__link" onClick={(e) => sendEmail(e, true)}>
            Email me a code
          </button>
        )}
        <Note>Demo: no text is sent.</Note>
      </form>
    )
  }

  if (stage.at === 'code') return <CodeStep stage={stage} who={who} email={email} code={code} busy={busy} told={told} onTyped={typed} onAgain={again} />

  if (stage.at === 'paused') return <Paused until={stage.until} what={stage.what} onOver={() => go(who ? { at: 'menu' } : { at: 'email' })} onHelp={onDone} />

  if (stage.at === 'profile') return <Profile who={who!} first={stage.first} onSaved={() => (stage.first ? onDone() : go({ at: 'menu' }))} />

  // ---- Logged in
  const me = who!
  const dollars = me.points / POINTS_PER_DOLLAR
  return (
    <div className="account__form account__menu">
      <div className="account__who">
        <Face picture={me.picture} name={me.name} size={36} />
        <div>
          <b>{me.name || me.email}</b>
          <small>{me.roles.length ? `${me.roles.join(' · ')}${me.funds.length ? ` · ${me.funds.join(', ')}` : ''}` : 'Member'}</small>
        </div>
      </div>
      <hr />
      <div className="account__row account__row--still">
        Points
        <small>
          {me.points.toLocaleString('en-US')} pts · ${dollars.toLocaleString('en-US', { maximumFractionDigits: 2 })}
          {ACCOUNT_DEMO ? ' · demo' : ''}
        </small>
      </div>
      <button type="button" className="account__row" onClick={() => (onDone(), launchApp('store'))}>
        Open VIP Store
      </button>
      {isLP(account.get()) && (
        <button type="button" className="account__row" onClick={() => (onDone(), launchApp('updates'))}>
          Open Updates
        </button>
      )}
      {me.needs.phone && (
        <button type="button" className="account__row" onClick={() => go({ at: 'addphone' })}>
          Add a Phone Number…
        </button>
      )}
      <button type="button" className="account__row" onClick={() => go({ at: 'profile', first: false })}>
        Edit Name and Picture…
      </button>
      <hr />
      <button
        type="button"
        className="account__row"
        onClick={async () => {
          onDone()
          closeApp('updates')
          await logOut()
        }}
      >
        Log Out
      </button>
    </div>
  )
}

function CodeStep({ stage, who, email, code, busy, told, onTyped, onAgain }: { stage: Extract<Stage, { at: 'code' }>; who: Member | null; email: string; code: string; busy: boolean; told: string; onTyped: (code: string) => void; onAgain: () => void }) {
  const wait = useLeft(stage.again)
  const inbox = stage.kind === 'inbox'
  return (
    <div className="account__form">
      <h3 className="account__head">{inbox ? 'Check your inbox' : 'Enter the code'}</h3>
      <p className="account__lead">{inbox ? `We emailed six digits to ${hidden((who?.email ?? email).trim())} to confirm it’s you.` : stage.phone ? `Texted to ${pretty(stage.phone)}.` : `Texted to your number ending in ${stage.to ?? '••'}.`}</p>
      <Code value={code} bad={!!told && code.length === 6} busy={busy} label={inbox ? 'The six digits we emailed' : 'The six digits we texted'} onChange={onTyped} />
      {told && (
        <p className="account__said" role="alert">
          {told}
        </p>
      )}
      {wait > 0 && !told ? (
        <p className="account__wait">Send it again in {clock(wait)}</p>
      ) : (
        <button type="button" className="account__link" disabled={busy} onClick={onAgain}>
          Send a new code
        </button>
      )}
      <Note>Demo: any six digits will do. 000000 is a wrong code.</Note>
    </div>
  )
}

function Paused({ until, what, onOver, onHelp }: { until: number; what: 'number' | 'address'; onOver: () => void; onHelp: () => void }) {
  const left = useLeft(until)
  return (
    <div className="account__form">
      <h3 className="account__head">Too many tries</h3>
      <p className="account__lead">To keep your account safe, new codes are paused for this {what}.</p>
      <button type="button" className="account__go" disabled={left > 0} onClick={onOver}>
        {left > 0 ? `Try again in ${clock(left)}` : 'Try Again'}
      </button>
      <button type="button" className="account__link" onClick={() => (onHelp(), launchApp('messages'))}>
        Message Shrug for help
      </button>
    </div>
  )
}

/** Make it yours: a display name, and a picture from Shrug's faces or a photo of their own. */
function Profile({ who, first, onSaved }: { who: Member; first: boolean; onSaved: () => void }) {
  const [name, setName] = useState(who.name)
  // Someone with no picture yet is offered one of the faces, theirs to change
  const [picture, setPicture] = useState<Picture>(() => who.picture ?? { face: FACES[Math.floor(Math.random() * FACES.length)]!.id })
  const [photo, setPhoto] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [told, setTold] = useState('')
  const field = useRef<HTMLInputElement>(null)
  const file = useRef<HTMLInputElement>(null)
  useEffect(() => field.current?.focus(), [])

  const chosen = async (picked: File | undefined) => {
    if (!picked) return
    try {
      const made = await squared(picked)
      setPhoto(made)
      setPicture({ url: made })
      setTold('')
    } catch {
      setTold(said('picture'))
    }
  }
  const save = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setTold('')
    const changed = JSON.stringify(picture) !== JSON.stringify(who.picture)
    const saved = await saveProfile({ name, ...(changed ? ('face' in picture ? { face: picture.face } : photo ? { photo } : {}) : {}) })
    setBusy(false)
    if ('error' in saved) return setTold(said(saved.error))
    onSaved()
  }
  const mine = 'url' in picture ? picture.url : null
  return (
    <form className="account__form" onSubmit={save} noValidate>
      <h3 className="account__head">{first ? 'Make it yours' : 'Name and picture'}</h3>
      <label className="account__field">
        <span className="account__label">Display name</span>
        <input ref={field} type="text" autoComplete="nickname" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <p className="account__lead">Shown on your card and on anything you post.</p>
      <div>
        <span className="account__label" id="account-picture">
          Picture
        </span>
        <div className="account__faces" role="radiogroup" aria-labelledby="account-picture">
          {FACES.map((face) => {
            const on = 'face' in picture && picture.face === face.id
            return (
              <button key={face.id} type="button" role="radio" aria-checked={on} aria-label={face.says} data-on={on || undefined} onClick={() => setPicture({ face: face.id })}>
                <Face picture={{ face: face.id }} size={60} />
              </button>
            )
          })}
          <button type="button" role="radio" aria-checked={!!mine} aria-label={mine ? 'Your photo. Choose another' : 'Upload a photo'} data-on={!!mine || undefined} data-upload={!mine || undefined} onClick={() => file.current?.click()}>
            {mine ? <Face picture={{ url: mine }} size={60} /> : <Plus size={22} strokeWidth={2} aria-hidden />}
          </button>
        </div>
        <input ref={file} type="file" accept="image/*" style={{ display: 'none' }} tabIndex={-1} aria-hidden onChange={(e) => (chosen(e.target.files?.[0]), (e.target.value = ''))} />
      </div>
      <button type="submit" className="account__go" disabled={busy || !name.trim()}>
        {busy ? 'Saving…' : 'Done'}
      </button>
      {told && (
        <p className="account__said" role="alert">
          {told}
        </p>
      )}
    </form>
  )
}

export function AccountItem() {
  const who = useStore(account, (s) => s)
  const sheet = useStore(logIn, (s) => s)
  const box = useRef<HTMLDivElement>(null)
  const title = useRef<HTMLButtonElement>(null)
  /** Whether nobody was logged in when the sheet was let down: so that what it unlocks is said once they are. */
  const came = useRef(false)

  useEffect(() => {
    // Arriving by a personal link (the server sends them to ?login=1, with their email confirmed), or asked
    // to log in by an address: the sheet is let down. The switch is then taken out of the address
    const arrived = asked('login')
    if (arrived === 'link') demoLink()
    refreshAccount().then(() => {
      if (arrived === null) return
      askLogIn()
      const url = new URL(window.location.href)
      for (const key of [...url.searchParams.keys()]) if (key.toLowerCase() === 'login') url.searchParams.delete(key)
      window.history.replaceState(window.history.state, '', url)
    })
  }, [])
  // Away from it, or Escape, puts the sheet away
  useEffect(() => {
    if (!sheet.open) return
    const away = (e: PointerEvent) => !box.current?.contains(e.target as Node) && closeLogIn()
    const keys = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      closeLogIn()
      title.current?.focus()
    }
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', keys, true)
    return () => {
      document.removeEventListener('pointerdown', away)
      document.removeEventListener('keydown', keys, true)
    }
  }, [sheet.open])

  const member = who.status === 'member' ? who : null
  useEffect(() => {
    if (sheet.open) came.current = !member
    // Only as it opens: who they are by the time it closes is the point
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet.open])

  const done = () => {
    const now = account.get()
    // An LP who has just come in is told their folder is open to them
    if (came.current && isLP(now) && now.status === 'member') unlocked.set({ at: Date.now(), docs: now.docs.filter((doc) => doc.state === 'open').length })
    came.current = false
    closeLogIn()
  }

  return (
    <div ref={box} className="menubar__account">
      <button ref={title} type="button" className="menubar__title menubar__login" data-open={sheet.open || undefined} data-in={member ? '' : undefined} aria-haspopup="dialog" aria-expanded={sheet.open} onClick={() => (sheet.open ? closeLogIn() : askLogIn())}>
        {member ? (
          <>
            <Face picture={member.picture} name={member.name} size={18} />
            {member.first || 'Account'}
          </>
        ) : (
          'Log In'
        )}
      </button>
      {sheet.open && who.status !== 'checking' && (
        <div className="account" role="dialog" aria-label={member ? 'Your account' : 'Log in'}>
          <Sheet who={member} why={sheet.why} onDone={done} />
        </div>
      )}
    </div>
  )
}
