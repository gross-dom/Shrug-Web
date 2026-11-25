// The parts of the site that are fetched when they are first wanted (a window's own code, the chair in 3D,
// the store's stand-in) go by names that change with every build. A page that was opened before the site
// was put up again asks for a part by its old name and is told there is none: the window that wanted it
// then has nothing to show (Workspace had no 3D chair and no prices, for one).
//
// The build's own loader says when that happens (vite:preloadError). The page is then loaded again, which
// brings the new build, and the desk comes back as it was, as a reload always brings it back. Once only in
// a minute: a part that is missing for another reason must not keep the page loading itself forever.

const KEPT = 'shrug:rebuilt'

if (typeof window !== 'undefined')
  window.addEventListener('vite:preloadError', (e) => {
    try {
      const last = Number(window.sessionStorage.getItem(KEPT) ?? 0)
      if (Date.now() - last < 60_000) return
      window.sessionStorage.setItem(KEPT, String(Date.now()))
    } catch {
      // (nowhere to note that it was tried: it is not tried, and the window says what it lacks)
      return
    }
    e.preventDefault()
    window.location.reload()
  })

export {}
