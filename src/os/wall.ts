import type { Picture } from '../../store/shared/rules'
import { account } from './account'
import { createStore } from './store'

// The wall: the photos people have posted from Photo Booth, newest first, each with the display name and
// picture of whoever posted it (design/v1, "Photo Booth"). Anyone can look; posting needs someone logged in;
// a person can remove their own, and Shrug can remove any. There is a queue (Dom's note after the third
// round): a photo that is posted waits for Shrug to approve it, and until then only whoever took it sees it,
// marked as waiting.
//
// The server for it is not built yet: where the photos are kept is still to be decided (they are too many
// and too large for the store's Airtable base as it stands). Until it is, the site's demo keeps the wall in
// this browser alone, so that taking, posting, looking and removing can all be used: nothing leaves the
// page, and what is posted here is seen here and nowhere else. Approving is Shrug's, from its own side; the
// demo has a stand-in for it (`approve`) so that both states can be seen. A live build shows an empty wall
// and says a post could not be sent.

const LIVE = import.meta.env.VITE_ACCOUNT === 'live'
const KEPT = 'shrug:wall-demo.v1'
/** How many photos the wall keeps in the demo: a browser's storage is small. */
const MOST = 12

export interface Post {
  id: string
  /** The photo, as an address a picture can be drawn from. */
  src: string
  name: string
  picture: Picture | null
  /** Who posted it: only they are offered Remove. */
  by: string
  at: string
  /** Waiting for Shrug to approve it: only whoever took it sees it. (One with no word either way is on the wall.) */
  waiting?: boolean
}

/** Whether this is the demo, where the wall is this browser's own and approving has a stand-in. */
export const WALL_IS_DEMO = !LIVE

export const wall = createStore<{ posts: Post[]; loaded: boolean }>({ posts: [], loaded: false })

function kept(): Post[] {
  try {
    const posts = JSON.parse(window.localStorage.getItem(KEPT) ?? '[]') as Post[]
    return Array.isArray(posts) ? posts.filter((p) => p && typeof p.src === 'string') : []
  } catch {
    return []
  }
}
function keep(posts: Post[]) {
  try {
    window.localStorage.setItem(KEPT, JSON.stringify(posts))
  } catch {
    // No room, or no storage: the wall is as long as the page is open
  }
}

/** Asks for the wall as it is now. */
export async function readWall() {
  wall.set({ posts: LIVE ? [] : kept(), loaded: true })
}

/** Posts a photo, as whoever is logged in. It waits for Shrug's approval, where its taker can see it. */
export async function post(src: string): Promise<Post | { error: 'anon' | 'unsent' }> {
  const who = account.get()
  if (who.status !== 'member') return { error: 'anon' }
  if (LIVE) return { error: 'unsent' }
  const made: Post = { id: `p${Date.now().toString(36)}`, src, name: who.name || who.first || 'Someone', picture: who.picture, by: who.email, at: new Date().toISOString(), waiting: true }
  const posts = [made, ...wall.get().posts].slice(0, MOST)
  keep(posts)
  wall.set({ posts, loaded: true })
  return made
}

/** Takes a photo off the wall. Only whoever posted it may (Shrug removes any, from its own side). */
export async function remove(id: string): Promise<boolean> {
  const who = account.get()
  const mine = wall.get().posts.find((p) => p.id === id && who.status === 'member' && p.by === who.email)
  if (!mine || LIVE) return false
  const posts = wall.get().posts.filter((p) => p.id !== id)
  keep(posts)
  wall.set({ posts, loaded: true })
  return true
}

/** The demo's stand-in for Shrug approving a photo: it is on the wall, for everyone. */
export function approve(id: string) {
  if (LIVE) return
  const posts = wall.get().posts.map((p) => (p.id === id ? { ...p, waiting: false } : p))
  keep(posts)
  wall.set({ posts, loaded: true })
}
