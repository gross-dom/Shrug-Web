import { useEffect, useState } from 'react'
import { UPDATE_GROUPS, type Update } from '../shared/rules'
import type { Backend, Shop } from './backend'
import { DocIcon } from './icons'

// Updates: what Shrug has written to its LPs. They are not for sale, so they are not in the store. One list,
// in groups, and each update in one of four states: open (theirs to read), to request, requested, or coming
// soon. Opening one shows it in the page, in the place of its preview. The markup is the design's
// (store/design/screens: Updates, PhoneUpdates).

const WHEN = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

/** What is at the right of a row: the thing to press, or what it is waiting on. */
function Stand({ update }: { update: Update }) {
  if (update.state === 'open') return <span className="ui-btn sec sm">Open</span>
  if (update.state === 'request') return <span className="ui-btn sec sm">Request</span>
  return <span className="t-sm t-3">{update.state === 'requested' ? 'Requested' : 'Coming soon'}</span>
}

export function UpdatesView({ shop, phone, backend, onChange }: { shop: Shop; phone: boolean; backend: Backend; onChange: () => void }) {
  const updates = shop.updates
  const [at, setAt] = useState<string | null>(updates.find((u) => u.state === 'open')?.id ?? updates[0]?.id ?? null)
  /** The one being read in the page, and where its file is. */
  const [reading, setReading] = useState<{ id: string; url: string } | null>(null)
  const [busy, setBusy] = useState('')
  const [said, setSaid] = useState('')
  const chosen = updates.find((u) => u.id === at) ?? null
  // The name of each heading that has something under it, in their order, and any other after them
  const groups = [...UPDATE_GROUPS, ...updates.map((u) => u.group).filter((g) => !UPDATE_GROUPS.includes(g))].filter((g, n, all) => all.indexOf(g) === n && updates.some((u) => u.group === g))

  // A file made up for the demo is let go of when it is no longer shown
  useEffect(() => () => void (reading?.url.startsWith('blob:') && URL.revokeObjectURL(reading.url)), [reading])

  const open = async (update: Update) => {
    setBusy(update.id)
    setSaid('')
    const url = await backend.view(update)
    setBusy('')
    if (typeof url !== 'string') return setSaid(url.error === 'offline' ? 'No connection.' : 'That did not open. Try again.')
    // A phone has no room beside the list: there it opens as a page of its own
    if (phone) window.open(url, '_blank', 'noopener')
    else setReading({ id: update.id, url })
  }
  const request = async (update: Update) => {
    setBusy(update.id)
    setSaid('')
    const asked = await backend.order({ product: update.id })
    setBusy('')
    if ('error' in asked && asked.error !== 'already') return setSaid(asked.error === 'offline' ? 'No connection.' : 'That did not send. Try again.')
    onChange()
  }
  const download = async (update: Update) => {
    setBusy(update.id)
    setSaid('')
    const got = await backend.download(update)
    setBusy('')
    if (got !== true) setSaid(got.error === 'no-file' ? 'The file has not been added yet.' : got.error === 'offline' ? 'No connection.' : 'That did not download. Try again.')
  }
  /** A row pressed: on a desktop it is chosen, and shown at the side; on a phone it does what its button says. */
  const press = (update: Update) => {
    setAt(update.id)
    if (reading && reading.id !== update.id) setReading(null)
    if (!phone) return
    if (update.state === 'open') open(update)
    else if (update.state === 'request') request(update)
  }

  const list = groups.map((group) => (
    <div key={group} style={{ display: 'contents' }}>
      <h2 className="ui-sect">{group}</h2>
      <ol className="ui-list">
        {updates
          .filter((u) => u.group === group)
          .map((update) => (
            <li key={update.id}>
              <a
                className={`ui-row ui-upd${!phone && update.id === at ? ' on' : ''}`}
                href={`?s=updates#${encodeURIComponent(update.id)}`}
                aria-current={!phone && update.id === at ? 'true' : undefined}
                onClick={(e) => (e.preventDefault(), press(update))}
              >
                {!phone && (
                  <span className="ui-thumb lg">
                    <DocIcon />
                  </span>
                )}
                <span className="who">
                  <b>{update.name}</b>
                  <span>{update.state === 'soon' ? ' ' : phone ? update.forWhom : `PDF · ${update.forWhom}`}</span>
                </span>
                <span className="r">
                  <Stand update={update} />
                </span>
              </a>
            </li>
          ))}
      </ol>
    </div>
  ))

  if (!updates.length)
    return (
      <main className={phone ? 'up-body' : 'ui-display'}>
        <div className="ui-gate">
          <h2 className="t-h2">Nothing here for you yet.</h2>
          <p className="t-words">An update opens for the people it was written for.</p>
        </div>
      </main>
    )

  if (phone)
    return (
      <main className="up-body" style={{ gap: 0 }}>
        <h1 className="t-title">Updates</h1>
        {said && (
          <p className="ui-note" role="alert" style={{ marginTop: 12 }}>
            {said}
          </p>
        )}
        {list}
      </main>
    )

  return (
    <main className="ui-page">
      <div>
        <div className="ui-head" style={{ paddingBottom: 6 }}>
          <h1 className="t-title">Updates</h1>
        </div>
        <p className="t-words">What Shrug has written to its LPs. Each one opens for the people it was written for.</p>
        {list}
      </div>
      {chosen && (
        <aside className="ui-side" aria-label={chosen.name}>
          {reading?.id === chosen.id ? (
            <>
              <iframe className="ui-view" src={reading.url} title={chosen.name} />
              <p className="t-sm t-3">
                Prepared for {shop.member.name} · {WHEN.format(new Date())}
              </p>
            </>
          ) : (
            <figure className="ui-paper">
              <b>Shrug</b>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <h3>{chosen.name}</h3>
                <small>
                  Prepared for {shop.member.name}
                  <br />
                  {chosen.state === 'open' ? WHEN.format(new Date()) : chosen.forWhom}
                </small>
              </div>
            </figure>
          )}
          {said && (
            <p className="ui-note" role="alert">
              {said}
            </p>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 8 }}>
            {chosen.state === 'open' && reading?.id !== chosen.id && (
              <button type="button" className="ui-btn" data-busy={busy === chosen.id || undefined} disabled={busy === chosen.id} onClick={() => open(chosen)}>
                Open
              </button>
            )}
            {chosen.state === 'open' && (
              <button type="button" className="ui-btn sec" disabled={busy === chosen.id} onClick={() => download(chosen)}>
                Download PDF
              </button>
            )}
            {chosen.state === 'request' && (
              <button type="button" className="ui-btn" data-busy={busy === chosen.id || undefined} disabled={busy === chosen.id} onClick={() => request(chosen)}>
                Request
              </button>
            )}
            {chosen.state === 'requested' && (
              <button type="button" className="ui-btn off" disabled>
                Requested
              </button>
            )}
            {chosen.state === 'soon' && (
              <button type="button" className="ui-btn off" disabled>
                Coming soon
              </button>
            )}
          </div>
        </aside>
      )}
    </main>
  )
}
