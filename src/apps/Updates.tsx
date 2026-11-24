import { useState, type KeyboardEvent } from 'react'
import { FolderOpen, Lock } from 'lucide-react'
import { UPDATE_GROUPS } from '../../store/shared/rules'
import { Window } from '../kit/window'
import { account, askLogIn, isLP, requestDoc, type Doc } from '../os/account'
import { formatter } from '../os/dates'
import { PdfIcon } from '../os/icons'
import { launchApp } from '../os/launch'
import { openPaper, paperOf } from '../os/papers'
import { useStore } from '../os/store'
import { openProduct } from './Store'
import '../styles/desk/v1.css'
import '../styles/desk/updates.css'

// The Updates folder on the desk, opened (design/v1, "Updates"): a Finder's list of the documents that are
// this LP's to read, under Funds and SPVs, each row naming the fund it was written for. Which those are is
// decided by the store's server from Airtable (os/account.ts): an update for the LPs of one fund is theirs,
// and one written for another fund may be listed to them to ask for. A document opens in Preview.
//
// The folder is always on the desk, with a lock. Nobody but an LP is shown what is in it, not even the names
// of the files: someone logged in who is not an LP is told who it is for.

/** The day a document is dated: 14 Nov 2026, day first, as the desk writes its days. One still to come says when in words. */
function dayOf(date: string) {
  const t = Date.parse(date)
  if (!date || Number.isNaN(t)) return date
  const parts = (day ??= formatter({ day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })).formatToParts(t)
  const of = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ''
  return `${of('day')} ${of('month')} ${of('year')}`
}
let day: Intl.DateTimeFormat | undefined

/** "LP · Shrug 1, 2, 4": the funds someone is in, said once where they share a name. */
function fundsOf(funds: string[]) {
  const shared = funds.length > 1 && funds.every((fund) => /^Shrug \S+$/.test(fund))
  return shared ? `Shrug ${funds.map((fund) => fund.replace(/^Shrug /, '')).join(', ')}` : funds.join(', ')
}

function Row({ doc, picked, onPick }: { doc: Doc; picked: boolean; onPick: () => void }) {
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const open = () => {
    onPick()
    openPaper(paperOf(doc))
  }
  const ask = async () => {
    if (busy) return
    onPick()
    setBusy(true)
    setFailed(false)
    const sent = await requestDoc(doc)
    setBusy(false)
    if (sent !== true) setFailed(true)
  }
  return (
    // A row is picked with a click and opened with two, as a file is in a Finder window. (Its button does the same in one.)
    <li className={`upd-row${picked ? ' on' : ''}`} data-doc={doc.id} data-state={doc.state} onPointerDown={onPick} onDoubleClick={() => (doc.state === 'open' || doc.state === 'request' || doc.state === 'requested') && open()}>
      <span aria-hidden>
        <PdfIcon />
      </span>
      <span>
        <b>{doc.name}</b>
        <small>{failed ? 'That didn’t send. Try again.' : `Written for ${doc.forWhom}`}</small>
      </span>
      <span className="v-chip">{doc.tag}</span>
      <span className="d">{dayOf(doc.date)}</span>
      <span className="s">
        {doc.state === 'open' ? (
          <button type="button" className="v-btn v-btn--pill" aria-label={`Open ${doc.name}`} onClick={open}>
            Open
          </button>
        ) : doc.state === 'request' ? (
          <button type="button" className="v-btn v-btn--grey v-btn--pill" aria-label={`Request ${doc.name}`} aria-disabled={busy || undefined} onClick={ask}>
            {busy ? 'Requesting…' : 'Request'}
          </button>
        ) : doc.state === 'locked' ? (
          // One with a price in points: buying is the VIP Store's, so that is where it is unlocked
          <button type="button" className="v-btn v-btn--grey v-btn--pill" aria-label={`Unlock ${doc.name} in VIP Store`} onClick={() => (onPick(), openProduct(doc.id), launchApp('store'))}>
            Unlock
          </button>
        ) : (
          <span className="t">{doc.state === 'requested' ? 'Requested' : 'Coming soon'}</span>
        )}
      </span>
    </li>
  )
}

function List({ docs, name }: { docs: Doc[]; name: string }) {
  const [picked, setPicked] = useState<string | null>(null)
  const groups = [...UPDATE_GROUPS, ...docs.map((doc) => doc.group).filter((group) => !UPDATE_GROUPS.includes(group))].filter((group, i, all) => all.indexOf(group) === i && docs.some((doc) => doc.group === group))
  const inOrder = groups.flatMap((group) => docs.filter((doc) => doc.group === group))
  /** Up and down the list with the arrows, and Return opens the one it is on. */
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget || e.altKey || e.ctrlKey || e.metaKey) return
    const at = inOrder.findIndex((doc) => doc.id === picked)
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const to = at < 0 ? (e.key === 'ArrowDown' ? 0 : inOrder.length - 1) : Math.max(0, Math.min(inOrder.length - 1, at + (e.key === 'ArrowDown' ? 1 : -1)))
      setPicked(inOrder[to]?.id ?? null)
    } else if (e.key === 'Enter' && at >= 0) {
      e.preventDefault()
      e.currentTarget.querySelector<HTMLElement>(`[data-doc="${inOrder[at]!.id}"] button`)?.click()
    }
  }
  return (
    <div className="upd" data-autofocus tabIndex={0} role="group" aria-label={`Updates: ${docs.length === 1 ? 'one document' : `${docs.length} documents`}`} onKeyDown={onKey}>
      <div className="upd-list">
        {groups.map((group) => (
          <section key={group}>
            <h2>{group}</h2>
            <ul>
              {docs
                .filter((doc) => doc.group === group)
                .map((doc) => (
                  <Row key={doc.id} doc={doc} picked={picked === doc.id} onPick={() => setPicked(doc.id)} />
                ))}
            </ul>
          </section>
        ))}
      </div>
      <div className="upd-foot">
        <span>
          {docs.length === 1 ? '1 document' : `${docs.length} documents`} · Prepared for {name}
        </span>
        <span>Opens in Preview</span>
      </div>
    </div>
  )
}

export function UpdatesApp() {
  const who = useStore(account, (s) => s)
  const lp = isLP(who)
  const docs = who.status === 'member' ? who.docs : []
  const bar = (
    <div className="updbar">
      <b className="updbar__title">Updates</b>
      <span className="updbar__grow" />
      {lp && who.status === 'member' ? (
        <span className="v-chip v-chip--blue">LP{who.funds.length ? ` · ${fundsOf(who.funds)}` : ''}</span>
      ) : (
        <span className="v-chip v-chip--lock">
          <Lock size={10} strokeWidth={2.6} aria-hidden />
          Locked
        </span>
      )}
    </div>
  )
  return (
    <Window className="app v1 updwin" lightsSize="large" lead={bar} body={{ className: 'updwin__body' }}>
      {who.status !== 'member' ? (
        // Nobody logged in. (The folder on the desk lets down Log In instead of opening this: it is reached
        // by an address that names it, or by logging out while it is open)
        <div className="v-empty updates__locked">
          <Lock size={38} strokeWidth={1.6} aria-hidden />
          <h3>For Shrug’s LPs</h3>
          <p>{who.status === 'checking' ? 'One moment…' : 'This folder holds documents written for the people in Shrug’s funds. Log in to open it.'}</p>
          {who.status !== 'checking' && (
            <button type="button" className="v-btn v-btn--lg" onClick={() => askLogIn('updates')}>
              Log In
            </button>
          )}
        </div>
      ) : !lp ? (
        // Logged in, and not an LP: still locked. They are told who it is for, and shown nothing of what is in it
        <div className="v-empty updates__locked">
          <Lock size={38} strokeWidth={1.6} aria-hidden />
          <h3>For Shrug’s LPs</h3>
          <p>
            You’re logged in as {who.name || who.email}. This folder holds documents written for the people in Shrug’s funds, and nothing in it is shown to anyone else. An LP who used a different email can log in with that one.
          </p>
          <button type="button" className="v-btn v-btn--grey v-btn--lg" onClick={() => launchApp('messages')}>
            Message Shrug
          </button>
        </div>
      ) : docs.length === 0 ? (
        <div className="v-empty">
          <FolderOpen size={38} strokeWidth={1.6} aria-hidden />
          <h3>Nothing here yet</h3>
          <p>Updates written for your funds will appear in this folder. We’ll email you when the first one does.</p>
        </div>
      ) : (
        <List docs={docs} name={who.name || who.email} />
      )}
    </Window>
  )
}
