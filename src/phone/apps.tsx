import { useEffect, useMemo, type ReactNode } from 'react'
import { ArrowUpRight, ChevronDown, ChevronRight, ChevronUp } from 'lucide-react'
import { TOTAL } from '../apps/chat'
import { ConversationAvatar, ConversationList, conversationName, ConversationPane, Details } from '../apps/chat-ui'
import { MediaFilterControl, MediaGrid } from '../apps/Photos'
import { companiesIn, companyNamed, CompanyLogo, visitLabel, type Listed } from '../apps/portfolio-ui'
import { finder, inbox, notes, openConversation, photos, setDrop, setFinderQuery, setInboxQuery, setNotesQuery, showNote, showVertical, useUnread, type Conversation } from '../apps/state'
import { TerminalScreen } from '../apps/Terminal'
import { DROPS } from '../data/drops'
import { ANSWER_PLACEHOLDER, FAQS } from '../data/faqs'
import { PEOPLE } from '../data/people'
import { COMPANY_COUNT, VERTICALS } from '../data/portfolio'
import { SITE } from '../data/site'
import type { AppId } from '../os/apps'
import { AppIcon } from '../os/icons'
import { startSaver } from '../os/saver'
import { useStore } from '../os/store'
import { openPhoneApp, popTo, pushView, replaceView } from './nav'
import { Chips, Group, Page, PhoneSearch, Sheet, useView } from './ui'

// Each app as it is on a phone: the same content and the same state as its
// window on the desktop, in the screens iOS would give it.

export interface View {
  /** A page slides in from the right; a sheet comes up from the bottom over the page under it. */
  kind: 'page' | 'sheet'
  node: ReactNode
}

// ---- Group chat: the list of conversations, one conversation, its details ----

const conversationOf = (raw: string): Conversation => (raw === 'group' ? 'group' : Number(raw))

function MessagesList() {
  const query = useStore(inbox, (s) => s.query)
  return (
    <Page title="Messages" large className="ph-messages">
      <PhoneSearch value={query} onChange={setInboxQuery} label="Search conversations" />
      <ConversationList selectable={false} avatar={45} onPick={(c) => pushView(`thread:${c}`)} />
    </Page>
  )
}

function MessagesThread({ conversation }: { conversation: Conversation }) {
  const { top } = useView()
  const unread = useUnread()
  const name = conversationName(conversation)
  // On screen, this is the conversation that's open: its replies are read
  useEffect(() => {
    if (top) openConversation(conversation)
  }, [top, conversation])
  return (
    <Page
      fixed
      className="ph-thread"
      backLabel="Messages"
      badge={unread > 0 ? unread : undefined}
      center={
        <button type="button" className="ph-thread-id" aria-label={`${name}: details`} onClick={() => pushView(`details:${conversation}`)}>
          <ConversationAvatar conversation={conversation} size={44} />
          <span className="ph-thread-id__name">
            <span>{name}</span>
            <ChevronRight size={11} strokeWidth={2.6} aria-hidden />
          </span>
        </button>
      }
    >
      <ConversationPane conversation={conversation} active={top} />
    </Page>
  )
}

function MessagesDetails({ conversation }: { conversation: Conversation }) {
  return (
    <Page tone="grouped" className="ph-details">
      <Details
        conversation={conversation}
        onPick={(next) => {
          if (next !== 'group') return pushView(`thread:${next}`)
          // Back to the group conversation if it is under this one, or on to it
          if (!popTo((view) => view === 'thread:group')) pushView('thread:group')
        }}
      />
    </Page>
  )
}

// ---- Portfolio ----

const VERTICAL_OPTIONS = [{ value: -1, label: 'All' }, ...VERTICALS.map((v, i) => ({ value: i, label: v.name }))]

function LogoGrid({ companies }: { companies: Listed[] }) {
  return (
    <ul className="ph-logos">
      {companies.map((c) => (
        <li key={c.name}>
          <button type="button" className="ph-logo" onClick={() => pushView(`company:${c.name}`)}>
            <CompanyLogo company={c} size={60} />
            <span className="ph-logo__name">{c.name}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

function Portfolio() {
  const vertical = useStore(finder, (s) => s.vertical)
  const query = useStore(finder, (s) => s.query)
  const shown = useMemo(() => companiesIn(vertical, query), [vertical, query])
  const sections = vertical === -1 && !query.trim()
  return (
    <Page title="Portfolio" large className="ph-portfolio">
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

function CompanySheet({ name }: { name: string }) {
  const company = companyNamed(name)
  if (!company) return null
  const visit = visitLabel(company)
  return (
    <Sheet label={company.name}>
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

// ---- FAQs ----

function FaqList() {
  const query = useStore(notes, (s) => s.query)
  const q = query.trim().toLowerCase()
  const shown = FAQS.map((faq, i) => ({ faq, i })).filter(({ faq }) => !q || faq.question.toLowerCase().includes(q) || (faq.answer ?? '').toLowerCase().includes(q))
  return (
    <Page title="FAQs" large tone="grouped" className="ph-faqs">
      <PhoneSearch value={query} onChange={setNotesQuery} label="Search the FAQs" />
      {shown.length === 0 ? (
        <p className="ph-empty">No question matches</p>
      ) : (
        <Group footer={`${FAQS.length} questions`}>
          {shown.map(({ faq, i }) => (
            <button
              key={i}
              type="button"
              className="ph-row ph-row--note"
              onClick={() => {
                showNote(i)
                pushView(`note:${i}`)
              }}
            >
              <span className="ph-row__text">
                <span className="ph-row__title">{faq.question}</span>
                <span className="ph-row__sub">{faq.answer ?? 'Answer to come'}</span>
              </span>
              <ChevronRight className="ph-row__chevron" size={16} strokeWidth={2.6} aria-hidden />
            </button>
          ))}
        </Group>
      )}
    </Page>
  )
}

function FaqNote({ index }: { index: number }) {
  const faq = FAQS[index]
  if (!faq) return null
  const step = (by: number) => {
    const next = (index + by + FAQS.length) % FAQS.length
    showNote(next)
    replaceView(`note:${next}`)
  }
  return (
    <Page
      backLabel="FAQs"
      className="ph-note"
      trailing={
        <span className="ph-bar-pair" role="group" aria-label="Question">
          <button type="button" aria-label="Previous question" onClick={() => step(-1)}>
            <ChevronUp size={21} strokeWidth={2.2} aria-hidden />
          </button>
          <button type="button" aria-label="Next question" onClick={() => step(1)}>
            <ChevronDown size={21} strokeWidth={2.2} aria-hidden />
          </button>
        </span>
      }
    >
      <article className="ph-note__body" key={index}>
        <p className="ph-note__meta">
          Question {index + 1} of {FAQS.length}
        </p>
        <h2 className="ph-note__title">{faq.question}</h2>
        {faq.answer ? <p className="ph-note__answer">{faq.answer}</p> : <p className="faq__todo">{ANSWER_PLACEHOLDER}</p>}
      </article>
    </Page>
  )
}

// ---- Case studies ----

function CaseStudies() {
  return (
    <Page title="shrug — case-studies" tone="dark" fixed className="ph-term term">
      <div className="ss-term ph-term__screen">
        <TerminalScreen />
      </div>
    </Page>
  )
}

// ---- VIP ----

const DROP_OPTIONS: { value: string | null; label: string }[] = [{ value: null, label: 'All drops' }, ...DROPS.map((name) => ({ value: name, label: name }))]

function Vip() {
  const drop = useStore(photos, (s) => s.drop)
  return (
    <Page title="VIP" large className="ph-vip">
      <p className="ph-lede">When the drops landed. Photos and videos from the people who got one.</p>
      <Chips label="Drops" value={drop} options={DROP_OPTIONS} onChange={setDrop} />
      <div className="ph-vip__filter">
        <MediaFilterControl />
      </div>
      <MediaGrid />
    </Page>
  )
}

// ---- About ----

const FACTS: { label: string; value: string; app: AppId }[] = [
  { label: 'Group chat', value: `${TOTAL} people`, app: 'messages' },
  { label: 'Portfolio', value: `${COMPANY_COUNT} companies`, app: 'finder' },
  { label: 'FAQs', value: `${FAQS.length} questions`, app: 'notes' },
  { label: 'VIP', value: `${DROPS.length} drops`, app: 'photos' },
]

function About() {
  return (
    <Page title="About" tone="grouped" className="ph-about">
      <div className="ph-about__head">
        <span className="ph-about__icon">
          <AppIcon id="about" />
        </span>
        <h2 className="ph-about__name">{SITE.name}</h2>
        <div className="ph-about__kind">{SITE.legalName}</div>
      </div>
      <Group>
        {FACTS.map((fact) => (
          <button key={fact.label} type="button" className="ph-row" onClick={() => openPhoneApp(fact.app)}>
            <span className="ph-row__icon">
              <AppIcon id={fact.app} />
            </span>
            <span className="ph-row__title">{fact.label}</span>
            <span className="ph-row__value">{fact.value}</span>
            <ChevronRight className="ph-row__chevron" size={16} strokeWidth={2.6} aria-hidden />
          </button>
        ))}
      </Group>
      <Group>
        <a className="ph-row ph-row--link" href={SITE.onePager} target="_blank" rel="noreferrer">
          <span className="ph-row__title">One-pager</span>
          <ArrowUpRight className="ph-row__chevron" size={17} strokeWidth={2.4} aria-hidden />
        </a>
        <button type="button" className="ph-row ph-row--link" onClick={startSaver}>
          <span className="ph-row__title">Lock Screen</span>
        </button>
      </Group>
      <p className="ph-about__mark" aria-hidden>
        {SITE.mark}
      </p>
    </Page>
  )
}

// ---- Which screen a view is ----

export function viewOf(app: AppId, view: string): View {
  const [name, ...rest] = view.split(':')
  const arg = rest.join(':')
  switch (app) {
    case 'messages':
      if (name === 'thread') return { kind: 'page', node: <MessagesThread conversation={conversationOf(arg)} /> }
      if (name === 'details') return { kind: 'page', node: <MessagesDetails conversation={conversationOf(arg)} /> }
      return { kind: 'page', node: <MessagesList /> }
    case 'finder':
      if (name === 'company') return { kind: 'sheet', node: <CompanySheet name={arg} /> }
      return { kind: 'page', node: <Portfolio /> }
    case 'notes':
      if (name === 'note') return { kind: 'page', node: <FaqNote index={Number(arg)} /> }
      return { kind: 'page', node: <FaqList /> }
    case 'terminal':
      return { kind: 'page', node: <CaseStudies /> }
    case 'photos':
      return { kind: 'page', node: <Vip /> }
    default:
      return { kind: 'page', node: <About /> }
  }
}

/** The people whose replies a lock screen or a banner shows: the newest first. */
export const latestReplies = (replied: number, count: number) => Array.from({ length: Math.min(count, replied) }, (_, n) => replied - 1 - n).filter((i) => PEOPLE[i])
