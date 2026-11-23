import { useState } from 'react'
import { Download, Lock } from 'lucide-react'
import { SITE } from '../data/site'
import { Window } from '../kit/window'
import { account, downloadDoc, type Doc } from '../os/account'
import { DocumentIcon } from '../os/icons'
import { useStore } from '../os/store'

// The LP Updates folder on the desk, opened: the documents that are this member's to read. Which those are
// is decided by the points site's server from Airtable (os/account.ts): an update for the LPs of one fund
// is shown to them and to nobody else. The folder is on the desk only for someone logged in; opened by its
// address without that, it says how to get in.

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
        <a className="updates__get" href={SITE.store} target="_blank" rel="noreferrer">
          In the store
          <span className="sr-only">, opens in a new tab</span>
        </a>
      )}
    </li>
  )
}

export function UpdatesApp() {
  const who = useStore(account, (s) => s)
  const docs = who.status === 'member' ? who.docs : []
  return (
    <Window className="app vip updates" title="LP Updates" lightsSize="large" barSize="tall" body={{ className: 'vip__body scrolls', tabIndex: 0, role: 'group', 'aria-label': 'LP Updates' }}>
      {who.status !== 'member' ? (
        <div className="updates__locked">
          <Lock size={30} strokeWidth={2} aria-hidden />
          <h2 className="vip__title">Locked</h2>
          <p className="vip__sub">{who.status === 'checking' ? 'One moment…' : 'This folder is for Shrug’s LPs. Log In, at the right of the menu bar, opens it.'}</p>
        </div>
      ) : (
        <>
          <div className="vip__head">
            <h2 className="vip__title">LP Updates</h2>
            <p className="vip__sub">{docs.length ? `${docs.length === 1 ? 'One document' : `${docs.length} documents`}, for you.` : 'Nothing here for you yet.'}</p>
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
