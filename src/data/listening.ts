// The listening room: what the Spotify window has to play (design/v1, "Spotify"). Podcast episodes Shrug's
// network is on, and playlists from the team. Each is played by Spotify's own embedded player, from its link.
//
// The rows are templated for now, as the design has them: titles, shows and guests are in [square brackets]
// and stand where the real ones will go, and none has a link to play yet. To put one in: its title, the show
// it is an episode of, who is on it, its date and length, and `link`, which is the address Spotify gives for
// it (Share, Copy Episode Link: https://open.spotify.com/episode/…; for a playlist, …/playlist/…).

export interface Episode {
  id: string
  title: string
  show: string
  /** Who is on it, and where they are from. */
  guest: string
  date: string
  length: string
  /** Its address on Spotify. Null until it is supplied: a row with none cannot be played. */
  link: string | null
  /** The color its cover stands on until Spotify's own is shown. */
  tone: string
}

export interface Playlist {
  id: string
  name: string
  /** One line from the team on why this one. */
  line: string
  link: string | null
}

const TONES = ['#4a3b8f', '#8f3b55', '#2f6f7a', '#8a6a2a', '#3f7a4a', '#7a3f2f', '#35508f']

export const EPISODES: Episode[] = TONES.map((tone, i) => ({ id: `episode-${i + 1}`, title: '[Episode title]', show: '[Show name]', guest: '[Guest, Company]', date: '[Date]', length: '[0:00]', link: null, tone }))

export const PLAYLISTS: Playlist[] = [1, 2, 3, 4].map((n) => ({ id: `playlist-${n}`, name: '[Playlist name]', line: '[One line from the team on why this one.]', link: null }))

/** The address of Spotify's embedded player for a link to an episode, a show or a playlist; null for anything else. */
export function embedOf(link: string | null): string | null {
  const found = link ? /^https:\/\/open\.spotify\.com\/(?:intl-[a-z-]+\/)?(episode|show|playlist|album|track)\/([A-Za-z0-9]+)/.exec(link) : null
  return found ? `https://open.spotify.com/embed/${found[1]}/${found[2]}?utm_source=generator&theme=0` : null
}
