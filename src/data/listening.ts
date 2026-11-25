// The listening room: what the Spotify window has to play (design/v1, "Spotify"). Podcast episodes Shrug's
// network is on, and playlists from the team. Each is played by Spotify's own embedded player, from its link.
//
// A row is its id on Spotify: the part of its address after /episode/ or /playlist/ (Share, Copy Episode Link:
// https://open.spotify.com/episode/<id>, without the "?si=…" a shared link ends in, which says who shared it).
// These are the ones Dom supplied on 25 Nov: three lists of podcast episodes, which he named Tech, Culture
// and Infrastructure, and two playlists of songs.
//
// What each is called, the show it is from, when it came out, how long it is and its cover are Spotify's own
// words for it, read from Spotify on 25 Nov (its oEmbed, and the page of its embedded player) and written
// here, so that the window has them the moment it opens. A cover is a picture on Spotify's own servers.
// A row added later with no title is still shown and played: the window asks Spotify what it is called when
// it opens (src/os/listening.ts).

export interface Episode {
  id: string
  /** Which of the lists it is in (LISTS), from 0. */
  list: number
  /** Its address on Spotify. Null: a row with none cannot be played. */
  link: string | null
  /** As Spotify has it. Null: Spotify is asked when the window opens. */
  title: string | null
  /** The show it is an episode of. */
  show: string | null
  /** The month it came out: May 2022. */
  date: string | null
  /** 39 min; 1 hr 10 min. */
  length: string | null
  /** Its cover, on Spotify's servers. */
  cover: string | null
  /** The color its cover stands on until the picture has arrived, and where there is none. */
  tone: string
}

export interface Playlist {
  id: string
  /** As Spotify has it. Null: Spotify is asked when the window opens. */
  name: string | null
  /** One line from the team on why this one. */
  line: string | null
  link: string | null
  cover: string | null
}

const TONES = ['#4a3b8f', '#8f3b55', '#2f6f7a', '#8a6a2a', '#3f7a4a', '#7a3f2f', '#35508f']

interface Row {
  id: string
  title: string | null
  show: string | null
  date: string | null
  length: string | null
  cover: string | null
}

/** The episodes, in the lists Dom sent them in, each in his order. */
const LISTED: Row[][] = [
  [
    { id: '4HK2X8EhWMW9PuyEWdf90F', title: '69. Niv Dror (Founder & Managing Partner, Shrug Capital) has “no problem” with cartoon fish', show: 'Non-Technical', date: 'May 2022', length: '39 min', cover: 'https://image-cdn-fa.spotifycdn.com/image/ab67656300005f1f8d6175c3f63895f4785e08ef' },
    { id: '5rRgN3DwsHNjZpGrdInLYw', title: 'Talking Startup Investing on Tesla FSD w/ Niv Dror', show: 'HyperChange', date: 'Apr 2021', length: '43 min', cover: 'https://image-cdn-fa.spotifycdn.com/image/ab67656300005f1f5a14b5e420bd17aae7e87fe8' },
    { id: '2IFu3Y5z2WfjZVieQc8a72', title: 'Consumer Social, The Future of VC and How To Start An Early Stage Fund with Cyan Banister and Niv Dror', show: 'Village Global Podcast', date: 'Mar 2019', length: '56 min', cover: 'https://image-cdn-ak.spotifycdn.com/image/ab67656300005f1f4dbc34d976fdb17acc5177c4' },
    { id: '5qLTZzOf0pVGygIykWXGcj', title: '#2394 - Palmer Luckey', show: 'The Joe Rogan Experience', date: 'Oct 2025', length: '3 hr 4 min', cover: 'https://image-cdn-fa.spotifycdn.com/image/ab6772ab000015bec027a72c875161f0b514d3a8' },
    { id: '2EiWVVdQHRPZbdQpbb8aZp', title: 'Trae Stephens: Choosing Good Quests S2 E19', show: 'Meditations with Zohar', date: 'Nov 2023', length: '1 hr 10 min', cover: 'https://image-cdn-ak.spotifycdn.com/image/ab67656300005f1f8394475d983e8dd571a84298' },
    { id: '0ikZdBHgcFOo9n3dGVzQQT', title: 'Manufacturing in Low Earth Orbit with Delian Asparouhov, Co-Founder of Varda Space Industries', show: 'Founders in Arms', date: 'Jan 2024', length: '1 hr 8 min', cover: 'https://image-cdn-ak.spotifycdn.com/image/ab67656300005f1f6827271bc51945f53f2ff6f5' },
    { id: '4t4LWvh0CH6S1HhSmLQfbN', title: '#245 Trae Stephens - Inside Anduril’s AI Superweapons: Eagle Eye Helmet and Autonomous Tech', show: 'The Shawn Ryan Show', date: 'Oct 2025', length: '2 hr 18 min', cover: 'https://image-cdn-ak.spotifycdn.com/image/ab67656300005f1fe9712ed711cfbd89cd3e3d94' },
    { id: '6wjGJqLanbcTcbdJJCIVIN', title: 'Genies: Akash Nigam, Founder and CEO', show: 'Boardroom Club', date: 'Feb 2025', length: '24 min', cover: 'https://image-cdn-fa.spotifycdn.com/image/ab6772ab000015beee3c68cd333180ad7ffd50f6' },
    { id: '4397tg1Wr4LbaFNThOOTWB', title: 'Jake Paul & Anti Fund: From Creator to Investor', show: 'The a16z Show', date: 'Jun 2026', length: '1 hr 6 min', cover: 'https://image-cdn-fa.spotifycdn.com/image/ab67656300005f1f125adce8ae5071edfeb1f29a' },
    { id: '3S9UP1SfvTc3tujDM8nlxY', title: '20VC: 7 Predictions for How AI Changes the World: Labour, Engineering, Social Media, GrokBots Buying Cybercabs and more with Matteo Franceschetti, Co-Founder @ Eight Sleep', show: 'The Twenty Minute VC (20VC): Venture Capital | Startup Funding | The Pitch', date: 'Sep 2026', length: '1 hr 16 min', cover: 'https://image-cdn-fa.spotifycdn.com/image/ab67656300005f1fc6d8b77517e00ef945c50259' },
    { id: '5GJyVcnKBw3JyY2keRgBMZ', title: 'It took him 4 years to launch—then he hit $1M ARR in 30 days. | Siqi Chen, Founder of Runway', show: 'A Product Market Fit Show | Startup Podcast for Founders', date: 'Jan 2026', length: '57 min', cover: 'https://image-cdn-fa.spotifycdn.com/image/ab67656300005f1f66b43e264a68db664ac8e2a6' },
  ],
  [
    { id: '0CaOGo6xSN51B2aLAQa1kU', title: '#158 The Case of the Missing Hit', show: 'Reply All', date: 'Mar 2020', length: '50 min', cover: 'https://image-cdn-fa.spotifycdn.com/image/ab67656300005f1fb8d998a58b08ab9eca2c1b11' },
    { id: '5Pe6juMsSbnI5VAxWgys8y', title: 'Nintendo\'s Origins', show: 'Acquired', date: 'Mar 2023', length: '3 hr 26 min', cover: 'https://image-cdn-ak.spotifycdn.com/image/ab67656300005f1ff9bd7049cea88c23693d1d1d' },
    { id: '5qRZfBYlAcB3MzUvIoTb9y', title: 'American Ivy: Chapter 1', show: 'Articles of Interest', date: 'Oct 2022', length: '36 min', cover: 'https://image-cdn-fa.spotifycdn.com/image/ab67656300005f1f89af9c1573aecd754f116207' },
    { id: '4gM8DgmtvhhdQK9qMiAdBj', title: 'S4 EP16: Behind The Velvet Ropes ft. Lauren Ezersky', show: 'The Cutting Room Floor', date: 'Apr 2023', length: '20 min', cover: 'https://image-cdn-fa.spotifycdn.com/image/ab67656300005f1f4117575d604bc53ea682c7a7' },
    { id: '1ghSy67sofPxvFXuhzGdau', title: 'André 3000', show: 'Tetragrammaton with Rick Rubin', date: 'May 2025', length: '1 hr 40 min', cover: 'https://image-cdn-ak.spotifycdn.com/image/ab67656300005f1fd628bc1512621d5dbf2847c1' },
    { id: '5uleWCH6jJJqtGMQyK7KTY', title: 'The Postal Service - The District Sleeps Alone Tonight', show: 'Song Exploder', date: 'Jan 2014', length: '13 min', cover: 'https://image-cdn-fa.spotifycdn.com/image/ab67656300005f1fd10df910a507806f8c559542' },
    { id: '5DfHxsu2KifFjODzv2cGtS', title: 'Gregg Araki on Twin Peaks: Fire Walk with Me', show: 'The Film That Blew My Mind', date: 'Oct 2023', length: '48 min', cover: 'https://image-cdn-fa.spotifycdn.com/image/ab67656300005f1ffa8f3540d5cafabe525c491e' },
    { id: '3nmsmeBqqfak3tMLDCSJIk', title: 'Thirty Thousand Square Feet with Kane Parsons & James Wan', show: 'The A24 Podcast', date: 'May 2026', length: '1 hr 2 min', cover: 'https://image-cdn-ak.spotifycdn.com/image/ab6772ab000015be24f46e04891a7f15dc6ad8dc' },
    { id: '0cZIfoL14UMpeGjcE4mNTu', title: 'Tom Sachs on Frank Gehry, Guillotines, and ‘The Tom Sachs Guide’', show: 'The Hatchards Podcast', date: 'Jan 2026', length: '38 min', cover: 'https://image-cdn-ak.spotifycdn.com/image/ab67656300005f1f12a54a517d4ef569fd7fc641' },
    { id: '06mQkei7yTTrXe4NrPVtBr', title: 'The Pool and the Stream', show: '99% Invisible', date: 'Jul 2017', length: '31 min', cover: 'https://image-cdn-fa.spotifycdn.com/image/ab67656300005f1fc6608ed650ee535e0b550515' },
  ],
  [
    { id: '08dZwrpUgUQeR8UNlgjTFJ', title: '#390 Rare Steve Jobs Interview', show: 'Founders', date: 'Jun 2025', length: '41 min', cover: 'https://image-cdn-fa.spotifycdn.com/image/ab6772ab000015be9a818b16e1bfc93f3f9ae8ad' },
    { id: '2ddciNLzkoFW6iem6N4jBc', title: 'Version History: Zune', show: 'The Vergecast', date: 'Nov 2025', length: '1 hr 15 min', cover: 'https://image-cdn-fa.spotifycdn.com/image/ab67656300005f1f905acd9de3324c9f86ddff6a' },
    { id: '6G85ReuFsSkqIuwwwEhJeG', title: 'Nvidia Part I: The GPU Company (1993-2006)', show: 'Acquired', date: 'Mar 2022', length: '2 hr', cover: 'https://image-cdn-fa.spotifycdn.com/image/ab67656300005f1ff9bd7049cea88c23693d1d1d' },
    { id: '0SF6oXn0z9UiT299AWAJJU', title: '45: XBox Underground (Part 1)', show: 'Darknet Diaries', date: 'Aug 2019', length: '1 hr 23 min', cover: 'https://image-cdn-ak.spotifycdn.com/image/ab67656300005f1f328a0e1385804736af40fb49' },
    { id: '5oz34AZkMSpzXAhdLpGVqm', title: '6. Robert Brunner Was the Secret to Beats\' & Apple\'s Success — Now He\'s Redefining AI for the Physical World', show: 'Product Impact Podcast | Secrets to unlocking the value of AI', date: 'Apr 2026', length: '45 min', cover: 'https://image-cdn-fa.spotifycdn.com/image/ab6772ab000015be86d193748c617b71e4721b8e' },
    { id: '6Qkmqrw8iqHwkmsVIcWCKW', title: 'The end of the information superhighway?', show: 'Web 1.0', date: 'Nov 2023', length: '34 min', cover: 'https://image-cdn-ak.spotifycdn.com/image/ab67656300005f1fdcdb38b0707cc0fe36d6f954' },
    { id: '1oE4laROa7cS6YnRFXYraZ', title: '#130 The Snapchat Thief', show: 'Reply All', date: 'Nov 2018', length: '1 hr 6 min', cover: 'https://image-cdn-ak.spotifycdn.com/image/ab67656300005f1fb8d998a58b08ab9eca2c1b11' },
    { id: '4NejDAapH8JFosPuU5d46i', title: 'Ed Catmull, Co-founder of Pixar', show: 'David Senra', date: 'Jun 2026', length: '1 hr 35 min', cover: 'https://image-cdn-fa.spotifycdn.com/image/ab6772ab000015be7e7b4d0b5f6641b47260210a' },
    { id: '2J4P6Iwib7x7LthUf8NaMx', title: '1. Dr Ruja', show: 'The Missing Cryptoqueen', date: 'Sep 2019', length: '24 min', cover: 'https://image-cdn-fa.spotifycdn.com/image/ab67656300005f1f0ef2d35796bae09694104441' },
    { id: '7naOOba8SwiUNobGz8mQEL', title: 'Ilya Sutskever — We\'re moving from the age of scaling to the age of research', show: 'Dwarkesh Podcast', date: 'Nov 2025', length: '1 hr 36 min', cover: 'https://image-cdn-fa.spotifycdn.com/image/ab6772ab000015bea934fe0db8541254b93f02f4' },
  ],
]

const PLAYLIST_ROWS: { id: string; name: string | null; cover: string | null }[] = [
  { id: '2rKHh4STBORoX8HARfmB0r', name: 'Lalala', cover: 'https://mosaic.scdn.co/300/ab67616d00001e022f9f2065515abe3b498d85cdab67616d00001e022fe0c918b42a1a889b532dddab67616d00001e0299e4ded13476a568ef775488ab67616d00001e02b2e24871cbdb8ceaf5285f25' },
  { id: '2UDAoEBddY0XvO9oXcI87S', name: 'portugal', cover: 'https://mosaic.scdn.co/300/ab67616d00001e021bb60b953cfcf692a4593dd0ab67616d00001e024f1dc87f3fafc7d3ff962903ab67616d00001e02cfe4163cbb6d12f3ec15898eab67616d00001e02d419ed4f1e89669ce14bd369' },
]

/** A list of episodes: a playlist of podcasts, under the name Dom gave it. */
export interface EpisodeList {
  id: string
  name: string
}

export const LISTS: EpisodeList[] = [
  { id: 'tech', name: 'Tech' },
  { id: 'culture', name: 'Culture' },
  { id: 'infrastructure', name: 'Infrastructure' },
]

export const EPISODES: Episode[] = LISTED.flatMap((rows, list) => rows.map((row) => ({ ...row, id: `episode-${row.id}`, list, link: `https://open.spotify.com/episode/${row.id}`, tone: '' }))).map((episode, i) => ({ ...episode, tone: TONES[i % TONES.length]! }))

export const PLAYLISTS: Playlist[] = PLAYLIST_ROWS.map((row, i) => ({ id: `playlist-${i + 1}`, name: row.name, line: null, link: `https://open.spotify.com/playlist/${row.id}`, cover: row.cover }))

/** The address of Spotify's embedded player for a link to an episode, a show or a playlist; null for anything else. */
export function embedOf(link: string | null): string | null {
  const found = link ? /^https:\/\/open\.spotify\.com\/(?:intl-[a-z-]+\/)?(episode|show|playlist|album|track)\/([A-Za-z0-9]+)/.exec(link) : null
  return found ? `https://open.spotify.com/embed/${found[1]}/${found[2]}?utm_source=generator&theme=0` : null
}
