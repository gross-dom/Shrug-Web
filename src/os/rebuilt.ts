// The parts of the site that are fetched when they are first wanted (a window's own code, the chair in 3D,
// the store's stand-in) go by names that change with every build. A page that was opened before the site
// was put up again asks for a part by its old name and is told there is none: the window that wanted it
// then has nothing to show (Workspace had no 3D chair and no prices, for one).
//
// The build's own loader says when a part could not be had (vite:preloadError). That is also what it says
// of a visitor who has gone offline, and for them the page must stay as it is (it says what it lacks, and
// what it already has goes on working: tests/checks/arriving.cjs). So the site is asked first whether it
// has been put up again: its page is fetched, and the first script it names is set beside the one this
// page was opened with. Only where they differ is the page loaded again, which brings the new build, and
// the desk comes back as it was, as a reload always brings it back. No answer (offline) is not a new
// build. And once only in a minute: a part that is missing for another reason must not keep the page
// loading itself forever.

const KEPT = 'shrug:rebuilt'

/** The first script this page was opened with: its name changes with every build. */
const opened = () => document.querySelector('script[type="module"][src]')?.getAttribute('src') ?? null

/** Whether the site has been put up again since this page was opened. Not known is no. */
async function putUpAgain(): Promise<boolean> {
  const mine = opened()
  if (!mine) return false
  try {
    const answer = await fetch('/', { cache: 'no-store' })
    if (!answer.ok) return false
    const theirs = /<script[^>]+type="module"[^>]+src="([^"]+)"/.exec(await answer.text())?.[1]
    return !!theirs && theirs !== mine
  } catch {
    return false
  }
}

if (typeof window !== 'undefined')
  window.addEventListener('vite:preloadError', () => {
    void putUpAgain().then((is) => {
      if (!is) return
      try {
        const last = Number(window.sessionStorage.getItem(KEPT) ?? 0)
        if (Date.now() - last < 60_000) return
        window.sessionStorage.setItem(KEPT, String(Date.now()))
      } catch {
        // (nowhere to note that it was tried: it is not tried, and the window says what it lacks)
        return
      }
      window.location.reload()
    })
  })

export {}
