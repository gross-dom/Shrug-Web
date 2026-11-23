import { useEffect, useRef, useState, type FormEvent } from 'react'
import { SITE } from '../data/site'
import { account, ACCOUNT_DEMO, checkCode, logOut, refreshAccount, sendCode } from './account'
import { launchApp } from './launch'
import { useStore } from './store'
import { closeApp } from './wm'

// Log In, at the right of the menu bar. Pressed, it lets down a small sheet: an email address, then the six
// digits sent to it. Logged in, it shows the member's name; the sheet then has their points, the way to the
// store, and Log Out. Logging in is what puts the LP Updates folder on the desk (Surface.tsx).

const WHY: Record<string, string> = {
  email: 'That doesn’t look like an email address.',
  mail: 'We couldn’t send to that address. Check it and try again.',
  wait: 'We sent one a moment ago. Use that, or try again in a minute.',
  wrong: 'Not that one. Have another go.',
  locked: 'Too many tries. Ask for a new code.',
  expired: 'That code has gone stale. Ask for a new one.',
  offline: 'No connection.',
}
const why = (error: string) => WHY[error] ?? 'That didn’t work. Try again.'

function LogIn({ onIn }: { onIn: () => void }) {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [busy, setBusy] = useState(false)
  const [said, setSaid] = useState('')
  const [note, setNote] = useState('')
  const field = useRef<HTMLInputElement>(null)
  useEffect(() => field.current?.focus(), [step])

  const send = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setSaid('')
    const sent = await sendCode(email.trim())
    setBusy(false)
    // One sent a moment ago is still good: on to the six digits either way
    if ('ok' in sent || sent.error === 'wait') {
      setNote('ok' in sent ? (sent.note ?? '') : why('wait'))
      setStep('code')
    } else setSaid(why(sent.error))
  }
  const check = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setSaid('')
    const checked = await checkCode(email.trim(), code)
    setBusy(false)
    if ('ok' in checked) return onIn()
    setSaid(checked.error === 'wrong' && checked.left && checked.left <= 2 ? `Not that one. ${checked.left} ${checked.left === 1 ? 'try' : 'tries'} left.` : why(checked.error))
    setCode('')
    field.current?.focus()
  }

  return step === 'email' ? (
    <form className="account__form" onSubmit={send}>
      <p className="account__head">Log in to Shrug VIP</p>
      <p className="account__lead">For Shrug’s founders, investors and LPs. We’ll email you a code.</p>
      <label className="account__field">
        <span className="sr-only">Email address</span>
        <input ref={field} type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </label>
      <button type="submit" className="account__go" disabled={busy || !email.trim()}>
        {busy ? 'Sending…' : 'Send Code'}
      </button>
      {said && <p className="account__said" role="alert">{said}</p>}
    </form>
  ) : (
    <form className="account__form" onSubmit={check}>
      <p className="account__head">Enter your code</p>
      <p className="account__lead">Six digits, sent to {email.trim()}.</p>
      <label className="account__field">
        <span className="sr-only">Six-digit code</span>
        <input ref={field} className="account__code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={6} placeholder="000000" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} />
      </label>
      <button type="submit" className="account__go" disabled={busy || code.length !== 6}>
        {busy ? 'Checking…' : 'Log In'}
      </button>
      {note && !said && <p className="account__note">{note}</p>}
      {said && <p className="account__said" role="alert">{said}</p>}
      <button type="button" className="account__link" onClick={() => (setStep('email'), setCode(''), setSaid(''))}>
        Use another email
      </button>
    </form>
  )
}

export function AccountItem() {
  const who = useStore(account, (s) => s)
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const title = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    refreshAccount()
  }, [])
  // Away from it, or Escape, puts the sheet away
  useEffect(() => {
    if (!open) return
    const away = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false)
    const keys = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      setOpen(false)
      title.current?.focus()
    }
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', keys, true)
    return () => {
      document.removeEventListener('pointerdown', away)
      document.removeEventListener('keydown', keys, true)
    }
  }, [open])

  const member = who.status === 'member' ? who : null
  const out = async () => {
    setOpen(false)
    closeApp('updates')
    await logOut()
  }

  return (
    <div ref={box} className="menubar__account">
      <button ref={title} type="button" className="menubar__title menubar__login" data-open={open || undefined} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {member ? member.first || 'Account' : 'Log In'}
      </button>
      {open && (
        <div className="account" role="dialog" aria-label={member ? 'Your account' : 'Log in'}>
          {member ? (
            <div className="account__form">
              <p className="account__head">{member.name}</p>
              <p className="account__lead">
                {member.points.toLocaleString('en-US')} points{ACCOUNT_DEMO ? ' · demo' : ''}
              </p>
              {member.docs.length > 0 && (
                <button type="button" className="account__row" onClick={() => (setOpen(false), launchApp('updates'))}>
                  Open LP Updates
                </button>
              )}
              <a className="account__row" href={SITE.store} target="_blank" rel="noreferrer" onClick={() => setOpen(false)}>
                Spend your points in the store
                <span className="sr-only">, opens in a new tab</span>
              </a>
              <button type="button" className="account__row" onClick={out}>
                Log Out
              </button>
            </div>
          ) : who.status === 'applied' ? (
            <div className="account__form">
              <p className="account__head">You’re not on the list yet</p>
              <p className="account__lead">We’ll write when it’s your time.</p>
              <button type="button" className="account__row" onClick={out}>
                Log Out
              </button>
            </div>
          ) : (
            <LogIn
              onIn={() => {
                setOpen(false)
                const now = account.get()
                // The folder that logging in unlocks is opened, so that it is seen to be there
                if (now.status === 'member' && now.docs.length) setTimeout(() => launchApp('updates'), 350)
              }}
            />
          )}
        </div>
      )}
    </div>
  )
}
