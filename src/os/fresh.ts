// The demo keeps what a visitor did in their own browser (the account they made, the points, the desk as
// they left it, light or dark), so that a second visit finds it. Whoever is trying the demo needs the first
// visit again: `?reset` in the address forgets all of it, and the desk starts as new.
//
// Only in the demo. In a live build what is kept is the visitor's own, and no link takes it from them.
//
// This is the first thing the page runs (main.tsx imports it before the desk), because the stores read
// what was kept as they load.

const DEMO = import.meta.env.VITE_ACCOUNT !== 'live'

function forget(kept: Storage) {
  const ours: string[] = []
  for (let i = 0; i < kept.length; i++) {
    const name = kept.key(i)
    if (name?.startsWith('shrug')) ours.push(name)
  }
  for (const name of ours) kept.removeItem(name)
}

if (DEMO && typeof window !== 'undefined') {
  try {
    const url = new URL(window.location.href)
    const asked = [...url.searchParams.keys()].filter((key) => key.toLowerCase() === 'reset')
    if (asked.length && !/^(0|false|off|no)$/i.test((url.searchParams.get(asked[0]!) ?? '').trim())) {
      forget(window.localStorage)
      forget(window.sessionStorage)
      // (and the address no longer asks, so that loading the page again keeps what is done from here)
      for (const key of asked) url.searchParams.delete(key)
      window.history.replaceState(window.history.state, '', url)
    }
  } catch {
    // (a browser that keeps nothing has nothing to forget)
  }
}

export {}
