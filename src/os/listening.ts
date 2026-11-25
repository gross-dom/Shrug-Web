import { EPISODES, PLAYLISTS } from '../data/listening'
import { createStore } from './store'

// What Spotify says of each thing in the listening room: its title and its cover. The Spotify window asks
// when it opens, of Spotify's own oEmbed (open.spotify.com/oembed: public, and needing no key or login), from
// the visitor's browser. What is told is kept for the visit, so that opening the window again asks nothing.
// A link Spotify does not answer for is shown under a plain name (Episode 3, Playlist 1) and still plays: the
// player is Spotify's own, and has the title in it.

export interface Told {
  title: string
  cover: string | null
}

const KEPT = 'shrug:listening.v1'

function kept(): Record<string, Told> {
  try {
    const was = JSON.parse(window.sessionStorage.getItem(KEPT) ?? '{}') as Record<string, Told>
    return was && typeof was === 'object' ? was : {}
  } catch {
    return {}
  }
}

/** By link: what Spotify said of it. */
export const told = createStore<Record<string, Told>>(typeof window === 'undefined' ? {} : kept())

let asked = false

/** Asks Spotify what each link in the room is called, once a visit. */
export function askSpotify() {
  if (asked) return
  asked = true
  const links = [...EPISODES, ...PLAYLISTS].map((row) => row.link).filter((link): link is string => !!link && !told.get()[link])
  for (const link of links)
    fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(link)}`)
      .then((answer) => (answer.ok ? (answer.json() as Promise<{ title?: unknown; thumbnail_url?: unknown }>) : null))
      .then((said) => {
        if (!said || typeof said.title !== 'string' || !said.title.trim()) return
        // (a cover is only ever a picture of Spotify's own)
        const cover = typeof said.thumbnail_url === 'string' && /^https:\/\/[a-z0-9.-]+\.(scdn\.co|spotifycdn\.com)\//.test(said.thumbnail_url) ? said.thumbnail_url : null
        told.set((all) => ({ ...all, [link]: { title: said.title!.toString().trim().slice(0, 200), cover } }))
        try {
          window.sessionStorage.setItem(KEPT, JSON.stringify(told.get()))
        } catch {
          // No storage: it is asked again on the next visit to the page
        }
      })
      .catch(() => {
        // Not told: the row keeps its plain name
      })
}
