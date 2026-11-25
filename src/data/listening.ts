// The listening room: what the Spotify window has to play (design/v1, "Spotify"). Podcast episodes Shrug's
// network is on, and playlists from the team. Each is played by Spotify's own embedded player, from its link.
//
// A row is its link: the address Spotify gives for it (Share, Copy Episode Link:
// https://open.spotify.com/episode/…; for a playlist, …/playlist/…), without the "?si=…" a shared link ends in,
// which says who shared it. These are the ones Dom supplied on 25 Nov: three lists of podcast episodes (eleven,
// ten and ten: each list is a playlist of podcasts, to be named) and two playlists of songs.
//
// What an episode or a playlist is called, and its cover, are Spotify's to say: the window asks Spotify for
// them when it opens (src/os/listening.ts), so a row needs nothing written here to be shown under its own
// name. What Spotify's answer does not have can be written on a row and is shown where it is: the show an
// episode is from, who is on it, its date and its length, and a line from the team on a playlist. A title or
// a name written here is used in place of Spotify's.

export interface Episode {
  id: string
  /** Which of the lists it is in (LISTS), from 0. */
  list: number
  /** Its address on Spotify. Null: a row with none cannot be played. */
  link: string | null
  /** Written here, it is used in place of the title Spotify gives. */
  title: string | null
  /** The show it is an episode of. */
  show: string | null
  /** Who is on it, and where they are from. */
  guest: string | null
  date: string | null
  length: string | null
  /** The color its cover stands on until Spotify's own is shown. */
  tone: string
}

export interface Playlist {
  id: string
  /** Written here, it is used in place of the name Spotify gives. */
  name: string | null
  /** One line from the team on why this one. */
  line: string | null
  link: string | null
}

const TONES = ['#4a3b8f', '#8f3b55', '#2f6f7a', '#8a6a2a', '#3f7a4a', '#7a3f2f', '#35508f']

/** The episodes, in the lists Dom sent them in, each in his order. */
const LISTED: string[][] = [
  ['4HK2X8EhWMW9PuyEWdf90F', '5rRgN3DwsHNjZpGrdInLYw', '2IFu3Y5z2WfjZVieQc8a72', '5qLTZzOf0pVGygIykWXGcj', '2EiWVVdQHRPZbdQpbb8aZp', '0ikZdBHgcFOo9n3dGVzQQT', '4t4LWvh0CH6S1HhSmLQfbN', '6wjGJqLanbcTcbdJJCIVIN', '4397tg1Wr4LbaFNThOOTWB', '3S9UP1SfvTc3tujDM8nlxY', '5GJyVcnKBw3JyY2keRgBMZ'],
  ['0CaOGo6xSN51B2aLAQa1kU', '5Pe6juMsSbnI5VAxWgys8y', '5qRZfBYlAcB3MzUvIoTb9y', '4gM8DgmtvhhdQK9qMiAdBj', '1ghSy67sofPxvFXuhzGdau', '5uleWCH6jJJqtGMQyK7KTY', '5DfHxsu2KifFjODzv2cGtS', '3nmsmeBqqfak3tMLDCSJIk', '0cZIfoL14UMpeGjcE4mNTu', '06mQkei7yTTrXe4NrPVtBr'],
  ['08dZwrpUgUQeR8UNlgjTFJ', '2ddciNLzkoFW6iem6N4jBc', '6G85ReuFsSkqIuwwwEhJeG', '0SF6oXn0z9UiT299AWAJJU', '5oz34AZkMSpzXAhdLpGVqm', '6Qkmqrw8iqHwkmsVIcWCKW', '1oE4laROa7cS6YnRFXYraZ', '4NejDAapH8JFosPuU5d46i', '2J4P6Iwib7x7LthUf8NaMx', '7naOOba8SwiUNobGz8mQEL'],
]
const PLAYLIST_IDS = ['2rKHh4STBORoX8HARfmB0r', '2UDAoEBddY0XvO9oXcI87S']

/** A list of episodes: a playlist of podcasts. Its name is Shrug's to give; until it has one it goes by its
 * number (Podcasts 1, Podcasts 2). */
export interface EpisodeList {
  id: string
  name: string | null
}

export const LISTS: EpisodeList[] = LISTED.map((_, n) => ({ id: `podcasts-${n + 1}`, name: null }))

export const EPISODES: Episode[] = LISTED.flatMap((ids, list) => ids.map((id) => ({ id: `episode-${id}`, list, link: `https://open.spotify.com/episode/${id}`, title: null, show: null, guest: null, date: null, length: null, tone: '' }))).map((episode, i) => ({ ...episode, tone: TONES[i % TONES.length]! }))

export const PLAYLISTS: Playlist[] = PLAYLIST_IDS.map((id, i) => ({ id: `playlist-${i + 1}`, name: null, line: null, link: `https://open.spotify.com/playlist/${id}` }))

/** The address of Spotify's embedded player for a link to an episode, a show or a playlist; null for anything else. */
export function embedOf(link: string | null): string | null {
  const found = link ? /^https:\/\/open\.spotify\.com\/(?:intl-[a-z-]+\/)?(episode|show|playlist|album|track)\/([A-Za-z0-9]+)/.exec(link) : null
  return found ? `https://open.spotify.com/embed/${found[1]}/${found[2]}?utm_source=generator&theme=0` : null
}
