import { useState } from 'react'
import { Download, Lock } from 'lucide-react'
import { SITE } from '../data/site'
import { Window } from '../kit/window'
import { account, askLogIn, downloadDoc, isLP, type Doc } from '../os/account'
import { DocumentIcon } from '../os/icons'
import { launchApp } from '../os/launch'
import { useStore } from '../os/store'

// The Updates folder on the desk, opened: the documents that are this LP's to read. Which those are is
// decided by the store's server from Airtable (os/account.ts): an update for the LPs of one fund is shown to
// them and to nobody else. The folder is always on the desk, with a lock. Nobody but an LP is shown what is
// in it, not even the names of the files: someone logged in who is not an LP is told who it is for.

function Row({ doc }: { doc: Doc }) {
  const [busy, setBusy] = useState(false)
  const [said, setSaid] = useState('')
  const get = async () => {
    setBusy(true)
    setSaid('')
    const got = await downloadDoc(doc)
    setBusy(false)
    if (got !== true) setSaid(got.error === 'no-file' ? 'Not added yet. It will be here soon.' : got.error === 'offline' ? 'No connection.' : 'That didn’t download. Try again.')
  }
  return (
    <li className="updates__row">
      <span className="updates__icon">
        <DocumentIcon />
      </span>
      <span className="updates__what">
        <b>{doc.name}</b>
        <span>
          PDF{doc.keptTo.length ? ` · ${doc.keptTo.join(', ')} only` : ''}
          {said ? ` · ${said}` : ''}
        </span>
      </span>
      {doc.open ? (
        <button type="button" className="updates__get" disabled={busy} onClick={get} aria-label={`Download ${doc.name}`}>
          <Download size={14} strokeWidth={2.4} aria-hidden />
          {busy ? 'Fetching…' : 'Download'}
        </button>
      ) : (
        <a className="updates__get" href={`${SITE.store}?s=updates`} target="_blank" rel="noreferrer">
          On the points site
          <span className="sr-only">, opens in a new tab</span>
        </a>
      )}
    </li>
  )
}

export function UpdatesApp() {
  const who = useStore(account, (s) => s)
  const lp = isLP(who)
  const docs = who.status === 'member' ? who.docs : []
  return (
    <Window className="app vip updates" title="Updates" lightsSize="large" barSize="tall" body={{ className: 'vip__body scrolls', tabIndex: 0, role: 'group', 'aria-label': 'Updates' }}>
      {who.status !== 'member' ? (
        // Nobody logged in. (The folder on the desk lets down Log In instead of opening this: it is reached
        // by an address that names it, or by logging out while it is open)
        <div className="updates__locked">
          <Lock size={30} strokeWidth={2} aria-hidden />
          <h2 className="vip__title">Locked</h2>
          <p className="vip__sub">{who.status === 'checking' ? 'One moment…' : 'This folder is for Shrug’s LPs.'}</p>
          {who.status !== 'checking' && (
            <button type="button" className="updates__get updates__get--lead" onClick={() => askLogIn('updates')}>
              Log In
            </button>
          )}
        </div>
      ) : !lp ? (
        // Logged in, and not an LP: still locked. They are told who it is for, and shown nothing of what is in it
        <div className="updates__locked">
          <Lock size={30} strokeWidth={2} aria-hidden />
          <h2 className="vip__title">For Shrug’s LPs</h2>
          <p className="vip__sub">
            You’re logged in as {who.name || who.email}. This folder holds documents written for the people in Shrug’s funds, and nothing in it is shown to anyone else. An LP who used a different email can log in with that one.
          </p>
          <button type="button" className="updates__get updates__get--lead" onClick={() => launchApp('messages')}>
            Message Shrug
          </button>
        </div>
      ) : (
        <>
          <div className="vip__head">
            <h2 className="vip__title">Updates</h2>
            <p className="vip__sub">{docs.length ? `${docs.length === 1 ? 'One document' : `${docs.length} documents`}, for you.` : 'Nothing here yet. Updates written for your funds will appear in this folder.'}</p>
          </div>
          <ul className="updates__list">
            {docs.map((doc) => (
              <Row key={doc.id} doc={doc} />
            ))}
          </ul>
        </>
      )}
    </Window>
  )
}
