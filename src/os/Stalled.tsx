import { useCallback, useEffect, useState } from 'react'
import { SITE } from '../data/site'
import { Logo } from './icons'

// What is on screen when the site itself cannot be: half of it did not arrive
// (the desktop and the iPhone are separate downloads, fetched when a screen
// first shows them), or it fell over while drawing. Either way there is a way
// on: another go, and the one-pager. The loading screen in index.html is the
// same for everything before this file has arrived.

/** A file that did not arrive, as each browser words it (and Vite, for a stylesheet). */
export const unfetched = (error: unknown) =>
  error instanceof Error && /dynamically imported module|importing a module script failed|unable to preload css|failed to fetch|load failed/i.test(error.message)

const online = () => typeof navigator === 'undefined' || navigator.onLine !== false

/** Whether the site can be reached right now. */
const reachable = () =>
  fetch(window.location.href, { cache: 'no-store' }).then(
    (answer) => answer.ok,
    () => false,
  )

interface Props {
  /** fetch: a file did not arrive. crash: the site fell over while drawing. */
  kind: 'fetch' | 'crash'
  /** Draws what failed again, in place. */
  onRetry: () => void
}

export function Stalled({ kind, onRetry }: Props) {
  const [connected, setConnected] = useState(online)
  /** Another go is under way. */
  const [trying, setTrying] = useState(false)
  /** Another go got nowhere. */
  const [missed, setMissed] = useState(false)

  // A file that failed to arrive stays failed for as long as the page is open
  // (a browser remembers it), and after a new version of the site has gone up
  // the old file is no longer there to fetch at all. So another go is the page
  // loaded afresh: but only once the site answers, since a reload with no
  // connection would swap this card for the browser's own error page.
  const again = useCallback(async () => {
    if (kind === 'crash') return onRetry()
    setTrying(true)
    if (await reachable()) return window.location.reload()
    setTrying(false)
    setMissed(true)
  }, [kind, onRetry])

  // Back on the network: another go, without being asked
  useEffect(() => {
    const back = () => {
      setConnected(true)
      if (kind === 'fetch') void again()
    }
    const gone = () => setConnected(false)
    window.addEventListener('online', back)
    window.addEventListener('offline', gone)
    return () => {
      window.removeEventListener('online', back)
      window.removeEventListener('offline', gone)
    }
  }, [kind, again])

  const words =
    kind === 'crash'
      ? { title: 'Something went wrong', say: 'Try again. If it keeps happening, reload the page.' }
      : !connected
        ? { title: 'You’re offline', say: 'This will load when you’re back.' }
        : missed
          ? { title: 'Still can’t reach Shrug', say: 'Check your connection and try again.' }
          : { title: 'This didn’t load', say: 'Check your connection and try again.' }

  return (
    <div className="stalled" role="alert">
      <p className="stalled__mark" aria-hidden>
        <Logo size={44} />
      </p>
      <h2 className="stalled__title">{words.title}</h2>
      <p className="stalled__say">{words.say}</p>
      <div className="stalled__go">
        <button type="button" className="stalled__button stalled__button--lead" aria-disabled={trying || undefined} onClick={() => !trying && void again()}>
          {trying ? 'Trying…' : 'Try Again'}
        </button>
        <a className="stalled__button" href={SITE.onePager} target="_blank" rel="noreferrer">
          Read the one-pager
        </a>
      </div>
    </div>
  )
}

/** Half of the site on its way: nothing for a moment, so a quick arrival shows nothing, then a spinner. */
export function Arriving() {
  return (
    <div className="arriving" role="status">
      <span className="arriving__spin" aria-hidden />
      <span className="sr-only">Loading</span>
    </div>
  )
}
