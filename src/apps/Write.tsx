import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowUp, Calendar, Check, FileText, Handshake, Plus, Quote, X } from 'lucide-react'
import { LIMITS, outbox, pick, resend, sendToShrug, setDraft, sizeOf, unpick, type Sent } from '../phone/apps/outbox'
import { account } from '../os/account'
import { formatter } from '../os/dates'
import { useStore } from '../os/store'
import { writing } from '../os/write'
import '../styles/desk/write.css'

// A message to Shrug, in Messages on the desktop (design/v1, "Group Chat: write to Shrug"). The pencil
// starts it. Its only recipient is Shrug, and a subject is picked first: a testimonial to add, an intro or
// a meeting to ask for. Each subject asks for a little of its own, and then it is written as a message is.
//
// It goes where the phone's message to Shrug goes (src/phone/apps/outbox.ts), and delivery is honest: it
// says Delivered only once Shrug's inbox has it, and otherwise Not Delivered, with a way to try again.

type SubjectId = 'testimonial' | 'intro' | 'meeting'
const SUBJECTS: { id: SubjectId; name: string; line: string; icon: ReactNode; ask: string }[] = [
  { id: 'testimonial', name: 'Add a testimonial', line: 'Say what it’s like to work with Shrug.', icon: <Quote size={18} strokeWidth={1.9} aria-hidden />, ask: 'What it’s like to work with Shrug' },
  { id: 'intro', name: 'Request an intro', line: 'Ask to meet someone Shrug knows.', icon: <Handshake size={18} strokeWidth={1.9} aria-hidden />, ask: 'Why you’d like to meet them' },
  { id: 'meeting', name: 'Request a meeting', line: 'Tell Shrug what you’re building.', icon: <Calendar size={18} strokeWidth={1.9} aria-hidden />, ask: 'What it’s about' },
]

let stampFormat: Intl.DateTimeFormat | undefined
const stamp = (at: number) => (stampFormat ??= formatter({ hour: 'numeric', minute: '2-digit' })).format(at)

/** The bar over the message: who it is to. */
export function WriteTo() {
  return (
    <span className="im-to">
      To: <span className="im-tok">Shrug</span>
    </span>
  )
}

function Field({ label, value, onChange, type = 'text', focus }: { label: string; value: string; onChange: (value: string) => void; type?: string; focus?: boolean }) {
  return (
    <label className="im-lbl">
      <span>{label}</span>
      <input type={type} value={value} autoFocus={focus} autoComplete="off" spellCheck={false} onChange={(e) => onChange(e.target.value)} />
    </label>
  )
}

function Message({ m, email }: { m: Sent; email: string }) {
  return (
    <>
      {m.subject && <span className="im-sub">{m.subject}</span>}
      {m.text && <div className={`im-me${m.state === 'sending' ? ' dim' : ''}`}>{m.text}</div>}
      {m.files.map((file, i) => (
        <div key={i} className="im-att">
          <FileText size={22} strokeWidth={1.6} aria-hidden />
          <span>
            {file.name}
            <small>{sizeOf(file.size)}</small>
          </span>
        </div>
      ))}
      {m.state === 'sending' ? (
        <span className="im-stat" role="status">
          <i className="im-ring" aria-hidden />
          Sending…
        </span>
      ) : m.state === 'sent' ? (
        <span className="im-stat" role="status">
          Delivered
        </span>
      ) : (
        <span className="im-stat bad" role="status">
          <span className="im-bang" aria-hidden>
            !
          </span>
          Not Delivered ·{' '}
          <button type="button" onClick={() => resend(m.id)}>
            Try Again
          </button>
        </span>
      )}
      {m.state === 'sent' && email && <p className="im-note">Shrug reads every message. Replies come by email, to {email}.</p>}
    </>
  )
}

export function Write() {
  const box = useStore(outbox, (s) => s)
  const who = useStore(account, (s) => s)
  const about = useStore(writing, (s) => s.about)
  const member = who.status === 'member' ? who : null
  const [subject, setSubject] = useState<SubjectId | null>(null)
  const [name, setName] = useState(member?.name ?? '')
  const [role, setRole] = useState('')
  const [email, setEmail] = useState(member?.email ?? '')
  const [meet, setMeet] = useState('')
  const [publish, setPublish] = useState(true)
  const files = useRef<HTMLInputElement>(null)
  const field = useRef<HTMLTextAreaElement>(null)
  const scroll = useRef<HTMLDivElement>(null)
  const chosen = SUBJECTS.find((s) => s.id === subject) ?? null
  const sent = box.sent
  // Whoever logs in while it is being written is who it is from
  useEffect(() => {
    if (member) {
      setName((was) => was || member.name)
      setEmail((was) => was || member.email)
    }
  }, [member])
  useEffect(() => {
    scroll.current?.scrollTo({ top: scroll.current.scrollHeight })
  }, [sent.length, subject])

  const ready = !!chosen && (box.draft.trim().length > 0 || box.picked.length > 0) && (chosen.id !== 'intro' || meet.trim().length > 0)
  const send = () => {
    if (!chosen || !ready) return
    const details: Record<string, string> =
      chosen.id === 'testimonial' ? { name, role, publish: publish ? 'yes' : 'no' } : chosen.id === 'intro' ? { meet, name, email } : { name, email }
    if (about?.subject) details.about = about.subject
    sendToShrug({ subject: chosen.name, details: Object.fromEntries(Object.entries(details).filter(([, value]) => value.trim())) })
    setSubject(null)
  }
  const add = () => files.current?.click()

  return (
    <div className="chat-write">
      <div ref={scroll} className="im-body">
        {sent.length > 0 && (
          <>
            <span className="im-stamp">
              <b>iMessage</b>
              <br />
              Today {stamp(sent[0]!.at)}
            </span>
            {sent.map((m) => (
              <Message key={m.id} m={m} email={m.details?.email ?? email} />
            ))}
          </>
        )}
        {!chosen ? (
          <div className="im-pick" data-after={sent.length > 0 || undefined}>
            <h3>{sent.length ? 'Something else?' : 'What’s this about?'}</h3>
            <div className="im-opts">
              {SUBJECTS.map((s) => (
                <button key={s.id} type="button" className="im-opt" onClick={() => (setSubject(s.id), setTimeout(() => field.current?.focus(), 0))}>
                  {s.icon}
                  <b>{s.name}</b>
                  {s.line}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="im-form">
            <header>
              <b>
                {chosen.icon}
                {chosen.name}
              </b>
              <button type="button" className="im-link" onClick={() => setSubject(null)}>
                Change subject
              </button>
            </header>
            {chosen.id === 'testimonial' && (
              <>
                <div className="two">
                  <Field label="Your name" value={name} onChange={setName} />
                  <Field label="Role" value={role} onChange={setRole} />
                </div>
                <label className="im-check">
                  <input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} />
                  <span className="im-tick" aria-hidden>
                    {publish && <Check size={12} strokeWidth={3.2} />}
                  </span>
                  Shrug may publish this, with my name and role.
                </label>
                <small>Shrug reads it first. It isn’t added to the group chat automatically.</small>
              </>
            )}
            {chosen.id === 'intro' && (
              <>
                <Field label="Who do you want to meet?" value={meet} onChange={setMeet} />
                <small>Say why in your message. Shrug decides whether to pass it on.</small>
              </>
            )}
            {chosen.id === 'meeting' && (
              <>
                <div className="two">
                  <Field label="Your name" value={name} onChange={setName} />
                  <Field label="Email" type="email" value={email} onChange={setEmail} />
                </div>
                <div>
                  <span className="im-lbl__text">Files, such as a deck</span>
                  <div className="im-files">
                    {box.picked.map((p) => (
                      <span key={p.id} className="im-file">
                        <FileText size={13} strokeWidth={1.9} aria-hidden />
                        {p.file.name} · {sizeOf(p.file.size)}
                        <button type="button" aria-label={`Remove ${p.file.name}`} onClick={() => unpick(p.id)}>
                          <X size={12} strokeWidth={2.4} aria-hidden />
                        </button>
                      </span>
                    ))}
                    <button type="button" className="im-file im-file--add" onClick={add}>
                      <Plus size={13} strokeWidth={2.2} aria-hidden />
                      Add files
                    </button>
                  </div>
                </div>
                <small>Up to ten files, {Math.round(LIMITS.each / (1024 * 1024))} MB each.</small>
              </>
            )}
            {box.refused && (
              <small className="im-said" role="status">
                {box.refused}
              </small>
            )}
          </div>
        )}
      </div>
      <div className="im-field">
        <input
          ref={files}
          type="file"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => {
            pick(Array.from(e.target.files ?? []))
            e.target.value = ''
          }}
        />
        <button type="button" className="plus" aria-label="Add files" aria-disabled={!chosen || undefined} onClick={() => chosen && add()}>
          <Plus size={16} strokeWidth={2.2} aria-hidden />
        </button>
        <textarea
          ref={field}
          className="in"
          rows={1}
          value={box.draft}
          disabled={!chosen}
          aria-label={chosen ? `Message to Shrug: ${chosen.name}` : 'Message to Shrug. Pick a subject to start'}
          placeholder={chosen ? chosen.ask : sent.length ? 'Add to your message' : 'Pick a subject to start'}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) e.preventDefault(), send()
          }}
        />
        {chosen && (
          <button type="button" className="send" aria-label="Send" aria-disabled={!ready || undefined} onClick={send}>
            <ArrowUp size={16} strokeWidth={2.6} aria-hidden />
          </button>
        )}
      </div>
    </div>
  )
}
