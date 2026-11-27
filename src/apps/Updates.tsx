import { useState, type KeyboardEvent, type ReactNode } from 'react'
import { FolderOpen, Lock } from 'lucide-react'
import { UPDATE_GROUPS } from '../../store/shared/rules'
import { Window } from '../kit/window'
import { account, askLogIn, docsOf, isLP, requestDoc, type Doc } from '../os/account'
import { formatter } from '../os/dates'
import { PdfIcon } from '../os/icons'
import { launchApp } from '../os/launch'
import { openPaper, paperOf } from '../os/papers'
import { useStore } from '../os/store'
import '../styles/desk/v1.css'
import '../styles/desk/updates.css'

/** What the folder says to anyone it is not for, where there is nothing in it they are shown. */
export const LOCKED = 'This folder is for Shrug LPs only. Please log in with your LP email to access its contents.'
/** And where there is: under the list, what the locks on its rows mean. */
export const SOME_LOCKED = 'Updates with a lock are for Shrug LPs only.'

// The Updates folder on the desk, opened (design/v1, "Updates"): a Finder's list of documents, under Funds and
// SPVs, each row naming who it was written for. Which someone is shown, and what they may do with each, is
// decided by the store's server from Airtable (os/account.ts; the rule is updateOf, store/shared/rules.ts):
// an update for the LPs of one fund is theirs to read, and one written for another fund's may be asked for.
// A document opens in Preview.
//
// It opens for anyone (Dom, 27 Nov: it was shut to all but LPs, who alone were shown what was in it). An
// update may be for everyone, and that one anyone reads, logged in or not. An update written for a fund's
// LPs is named to anyone else with a lock on it, and is not theirs to open: the way in is to log in as an
// LP, or to ask about becoming one, which opens Accredited Investors Only (src/apps/Investors.tsx).

/** The day a document is dated: Nov 14, 2026, as the desk writes its days. One still to come says when in words. */
export function dayOf(date: string) {
  const t = Date.parse(date)
  if (!date || Number.isNaN(t)) return date
  const parts = (day ??= formatter({ day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })).formatToParts(t)
  const of = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ''
  return `${of('month')} ${of('day')}, ${of('year')}`
}
let day: Intl.DateTimeFormat | undefined

/** "LP · Shrug 1, 2, 4": the funds someone is in, said once where they share a name. */
export function fundsOf(funds: string[]) {
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
        <small>{failed ? 'That didn’t send. Try again.' : `Written for ${doc.forWhom.replace(/^(All|Everyone)\b/, (word) => word.toLowerCase())}`}</small>
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
          // One with a price in points: what is a member's is in My VIP, so that is where it is unlocked
          <button type="button" className="v-btn v-btn--grey v-btn--pill" aria-label={`Unlock ${doc.name} in My VIP`} onClick={() => (onPick(), launchApp('myvip'))}>
            Unlock
          </button>
        ) : doc.state === 'closed' ? (
          // Written for a fund's LPs, and this is not one of them: it is named, and that is all
          <span className="t upd-kept">
            <Lock size={11} strokeWidth={2.6} aria-hidden />
            LPs only
          </span>
        ) : (
          <span className="t">{doc.state === 'requested' ? 'Requested' : 'Coming soon'}</span>
        )}
      </span>
    </li>
  )
}

function List({ docs, name, aside }: { docs: Doc[]; /** Whose it was prepared for: nobody's, logged out. */ name: string | null; /** Under the list, for someone some of it is locked to. */ aside?: ReactNode }) {
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
      {aside}
      <div className="upd-foot">
        <span>
          {docs.length === 1 ? '1 document' : `${docs.length} documents`}
          {name ? ` · Prepared for ${name}` : ''}
        </span>
        <span>Opens in Preview</span>
      </div>
    </div>
  )
}

/** For someone the folder, or some of it, is locked to: the way to ask Shrug about becoming an LP (Niv, 27
 * Nov). It opens Accredited Investors Only, which is a few questions and is sent to Shrug (Dom, 27 Nov: it
 * opened a message to Shrug in Messages). */
function Enquire() {
  return (
    <button type="button" className="updates__enquire" onClick={() => launchApp('investors')}>
      Enquire about becoming an LP
    </button>
  )
}

export function UpdatesApp() {
  const who = useStore(account, (s) => s)
  const lp = isLP(who)
  const docs = docsOf(who)
  const anon = who.status !== 'member'
  const bar = (
    <div className="updbar">
      <b className="updbar__title">Updates</b>
      <span className="updbar__grow" />
      {lp && who.status === 'member' ? (
        <span className="v-chip v-chip--blue">LP{who.funds.length ? ` · ${fundsOf(who.funds)}` : ''}</span>
      ) : docs.some((doc) => doc.state === 'open') ? null : (
        <span className="v-chip v-chip--lock">
          <Lock size={10} strokeWidth={2.6} aria-hidden />
          Locked
        </span>
      )}
    </div>
  )
  return (
    <Window className="app v1 updwin" lightsSize="large" lead={bar} body={{ className: 'updwin__body' }}>
      {who.status === 'checking' ? (
        <div className="v-empty updates__locked">
          <Lock size={38} strokeWidth={1.6} aria-hidden />
          <p>One moment…</p>
        </div>
      ) : docs.length === 0 && !lp ? (
        // Nothing in it that they are shown: it is locked, and says who it is for
        <div className="v-empty updates__locked">
          <Lock size={38} strokeWidth={1.6} aria-hidden />
          <p>{LOCKED}</p>
          {anon && (
            <button type="button" className="v-btn v-btn--lg" onClick={() => askLogIn('updates')}>
              Log In
            </button>
          )}
          <Enquire />
        </div>
      ) : docs.length === 0 ? (
        <div className="v-empty">
          <FolderOpen size={38} strokeWidth={1.6} aria-hidden />
          <h3>Nothing here yet</h3>
          <p>Updates written for your funds will appear in this folder. We’ll email you when the first one does.</p>
        </div>
      ) : (
        <List
          docs={docs}
          name={who.status === 'member' ? who.name || who.email : null}
          aside={
            // Someone who is not an LP: what the locks mean, and the two ways past them
            !lp && docs.some((doc) => doc.state === 'closed') ? (
              <div className="upd-note">
                <p>
                  <Lock size={12} strokeWidth={2.4} aria-hidden />
                  {SOME_LOCKED}
                  {anon ? ' Log in with your LP email to open them.' : ''}
                </p>
                <span className="upd-note__ways">
                  {anon && (
                    <button type="button" className="v-btn v-btn--pill" onClick={() => askLogIn('updates')}>
                      Log In
                    </button>
                  )}
                  <Enquire />
                </span>
              </div>
            ) : undefined
          }
        />
      )}
    </Window>
  )
}
