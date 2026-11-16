import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { ArrowUpRight, Check, ChevronDown, ChevronLeft, Lock } from 'lucide-react'
import { Details, type ReplyStream } from '../apps/chat-ui'
import { MediaFilterControl, MediaGrid } from '../apps/Photos'
import { companiesIn, companyNamed, CompanyLogo, visitLabel, type Listed } from '../apps/portfolio-ui'
import { finder, notes, photos, setDrop, setFinderQuery, showNote, showVertical, type Conversation } from '../apps/state'
import { answer, isEmail, term, TerminalLog } from '../apps/Terminal'
import { CASE_STUDIES } from '../data/caseStudies'
import { DROPS } from '../data/drops'
import { ANSWER_PLACEHOLDER, FAQS } from '../data/faqs'
import { COMPANY_COUNT, VERTICALS } from '../data/portfolio'
import { useStore } from '../os/store'
import { convo, finishConvo, hold, replayConvo, resume, type ShotApp } from './convo'
import { closeSheet, openSheet } from './nav'
import { Chips, Group, Page, PhoneSearch, Sheet } from './ui'

// What the screenshots in the conversation open into: each window of Niv's Mac
// laid out for a phone. They share their content and state with the desktop's
// windows, but not their shape: a library of logos, a page of questions, a
// locked folder with a way to ask for the key, and a photo library. Each is
// one screen; anything more comes up over it as a sheet, as the conversation's
// own details do.

// ---- The conversation's details ----

/** Who is in the conversation, and the replies' own controls. A person opens inside the same sheet. */
function DetailsSheet({ closing }: { closing: boolean }) {
  const [who, setWho] = useState<Conversation>('group')
  const state = useStore(convo, (c) => c)
  // The group's replies in the phone's conversation, for the panel's controls to work
  const stream: ReplyStream = {
    replied: state.replied,
    paused: !state.flowing && !state.done,
    done: state.done,
    toggle: () => (convo.get().flowing ? hold() : resume()),
    finish: () => {
      finishConvo()
      closeSheet()
    },
    replay: () => {
      replayConvo()
      closeSheet()
    },
  }
  return (
    <Sheet
      label="Details"
      closing={closing}
      leading={
        who !== 'group' && (
          <button type="button" className="ph-sheet__back" aria-label="Everyone" onClick={() => setWho('group')}>
            <ChevronLeft size={22} strokeWidth={2.4} aria-hidden />
          </button>
        )
      }
    >
      <div className="ph-details" key={String(who)}>
        <Details conversation={who} onPick={(next) => setWho(next)} onDone={() => closeSheet()} tap="details" stream={stream} />
      </div>
    </Sheet>
  )
}

// ---- Portfolio: a library of logos ----

const VERTICAL_OPTIONS = [{ value: -1, label: 'All' }, ...VERTICALS.map((v, i) => ({ value: i, label: v.name }))]

function LogoGrid({ companies }: { companies: Listed[] }) {
  return (
    <ul className="ph-logos">
      {companies.map((c) => (
        <li key={c.name}>
          <button type="button" className="ph-logo" onClick={() => openSheet(`company:${c.name}`)}>
            <CompanyLogo company={c} size={60} />
            <span className="ph-logo__name">{c.name}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

function PortfolioApp() {
  const vertical = useStore(finder, (s) => s.vertical)
  const query = useStore(finder, (s) => s.query)
  const shown = useMemo(() => companiesIn(vertical, query), [vertical, query])
  const sections = vertical === -1 && !query.trim()
  return (
    <Page title="Portfolio" className="ph-portfolio">
      <PhoneSearch value={query} onChange={setFinderQuery} label="Search the portfolio" placeholder={`Search ${COMPANY_COUNT} companies`} />
      <Chips label="Verticals" value={vertical} options={VERTICAL_OPTIONS} onChange={showVertical} />
      {shown.length === 0 ? (
        <p className="ph-empty">Nothing in the portfolio matches “{query.trim()}”</p>
      ) : sections ? (
        VERTICALS.map((v) => (
          <section key={v.name} className="ph-logos-section" aria-label={v.name}>
            <h3 className="ph-section-title">
              {v.name} <span>{v.companies.length}</span>
            </h3>
            <LogoGrid companies={shown.filter((c) => c.vertical === v.name)} />
          </section>
        ))
      ) : (
        <LogoGrid companies={shown} />
      )}
    </Page>
  )
}

function CompanySheet({ name, closing }: { name: string; closing: boolean }) {
  const company = companyNamed(name)
  if (!company) return null
  const visit = visitLabel(company)
  return (
    <Sheet label={company.name} closing={closing}>
      <div className="ph-company">
        <CompanyLogo company={company} size={84} />
        <h3 className="ph-company__name">{company.name}</h3>
        <div className="ph-company__kind">{company.vertical}</div>
        {company.blurb && <p className="ph-company__blurb">{company.blurb}</p>}
        {company.url && visit && (
          <a className="ph-button" href={company.url} target="_blank" rel="noreferrer">
            {visit}
            <ArrowUpRight size={17} strokeWidth={2.4} aria-hidden />
          </a>
        )}
      </div>
    </Sheet>
  )
}

// ---- FAQs: one note, each question opening where it is ----

function FaqsApp() {
  const [open, setOpen] = useState<number | null>(() => notes.get().note)
  return (
    <Page title="FAQs" className="ph-faqs">
      <p className="ph-lede">{FAQS.length} questions. Tap one for its answer.</p>
      <div className="ph-faq-list">
        {FAQS.map((faq, i) => {
          const on = open === i
          return (
            <section key={i} className="ph-faq" data-open={on || undefined}>
              <h3>
                <button
                  type="button"
                  className="ph-faq__question"
                  aria-expanded={on}
                  aria-controls={`faq-${i}`}
                  onClick={() => {
                    setOpen(on ? null : i)
                    if (!on) showNote(i)
                  }}
                >
                  <span>{faq.question}</span>
                  <ChevronDown className="ph-faq__chevron" size={20} strokeWidth={2.4} aria-hidden />
                </button>
              </h3>
              <div className="ph-faq__answer" id={`faq-${i}`} role="region" aria-label={faq.question} {...(on ? null : ({ inert: '' } as object))}>
                <div>{faq.answer ? <p>{faq.answer}</p> : <p className="faq__todo">{ANSWER_PLACEHOLDER}</p>}</div>
              </div>
            </section>
          )
        })}
      </div>
    </Page>
  )
}

// ---- Case studies: locked, with a way to ask ----

function CasesApp() {
  const step = useStore(term, (t) => t.step)
  const done = step === 'done'
  return (
    <Page title="Case Studies" tone="grouped" className="ph-cases">
      <p className="ph-lede">They’re private. Ask nicely.</p>
      {/* What the desktop's terminal has to say about it, as it said it */}
      <div className="ph-term-card term ss-term">
        <TerminalLog />
      </div>
      {done ? (
        <p className="ph-cases__done" role="status">
          <Check size={18} strokeWidth={2.8} aria-hidden />
          Request noted
        </p>
      ) : (
        <button type="button" className="ph-button" onClick={() => openSheet('request')}>
          Request access
        </button>
      )}
      <Group label={`${CASE_STUDIES.length} case studies`}>
        {CASE_STUDIES.map((name) => {
          const company = companyNamed(name)
          return (
            <button key={name} type="button" className="ph-row" aria-label={`${name}, locked. Request access.`} onClick={() => openSheet('request')}>
              {company && (
                <span className="ph-row__icon">
                  <CompanyLogo company={company} size={30} />
                </span>
              )}
              <span className="ph-row__title">{name}</span>
              <Lock className="ph-row__chevron" size={16} strokeWidth={2.4} aria-hidden />
            </button>
          )
        })}
      </Group>
    </Page>
  )
}

function RequestSheet({ closing }: { closing: boolean }) {
  const step = useStore(term, (t) => t.step)
  const [email, setEmail] = useState('')
  const [wrong, setWrong] = useState(false)
  /** The address the request went in under, once it has. */
  const [sent, setSent] = useState<string | null>(null)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!isEmail(email)) return setWrong(true)
    // Said to the same terminal the desktop has, so the two tell one story
    if (term.get().step === 'ask') answer('y')
    answer(email)
    setSent(email.trim())
  }

  return (
    <Sheet label="Request access" closing={closing}>
      {sent || step === 'done' ? (
        <div className="ph-request">
          <span className="ph-request__mark" data-done>
            <Check size={30} strokeWidth={2.6} aria-hidden />
          </span>
          <h3 className="ph-request__title">Request noted</h3>
          <p className="ph-request__text">
            {sent ? <>For {sent}. </> : null}
            This is a prototype: nothing has been sent.
          </p>
          <button type="button" className="ph-button" onClick={() => closeSheet()}>
            Done
          </button>
        </div>
      ) : (
        <form className="ph-request" noValidate onSubmit={submit}>
          <span className="ph-request__mark">
            <Lock size={28} strokeWidth={2.2} aria-hidden />
          </span>
          <h3 className="ph-request__title">Request access</h3>
          <p className="ph-request__text">Leave an email and Shrug will be in touch about the case studies.</p>
          <input
            className="ph-field"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="send"
            placeholder="you@example.com"
            aria-label="Your email"
            aria-invalid={wrong || undefined}
            aria-describedby={wrong ? 'request-wrong' : undefined}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              setWrong(false)
            }}
          />
          {wrong && (
            <p className="ph-request__wrong" id="request-wrong" role="alert">
              That doesn’t look like an email.
            </p>
          )}
          <button type="submit" className="ph-button">
            Send request
          </button>
        </form>
      )}
    </Sheet>
  )
}

// ---- VIP: a photo library ----

const DROP_OPTIONS: { value: string | null; label: string }[] = [{ value: null, label: 'All drops' }, ...DROPS.map((name) => ({ value: name, label: name }))]

function VipApp() {
  const drop = useStore(photos, (s) => s.drop)
  return (
    <Page title="VIP" className="ph-vip">
      <p className="ph-lede">When the drops landed. Photos and videos from the people who got one.</p>
      <Chips label="Drops" value={drop} options={DROP_OPTIONS} onChange={setDrop} />
      <div className="ph-vip__filter">
        <MediaFilterControl />
      </div>
      <MediaGrid />
    </Page>
  )
}

// ---- Which screen an app is, and which sheet a name is ----

const SCREENS: Record<ShotApp, () => ReactNode> = {
  finder: PortfolioApp,
  notes: FaqsApp,
  terminal: CasesApp,
  photos: VipApp,
}

export function AppScreen({ app }: { app: ShotApp }) {
  const Screen = SCREENS[app]
  return <Screen />
}

export function SheetScreen({ sheet, closing }: { sheet: string; closing: boolean }) {
  const [name, ...rest] = sheet.split(':')
  if (name === 'details') return <DetailsSheet closing={closing} />
  if (name === 'company') return <CompanySheet name={rest.join(':')} closing={closing} />
  if (name === 'request') return <RequestSheet closing={closing} />
  return null
}
