// Spotify's own embedded player, driven from the page: its iFrame API (open.spotify.com/embed/iframe-api/v1),
// which Spotify offers for podcast episodes. The API makes the player's frame and hands back a controller:
// load another episode in it, play, pause, seek; and the player says, as it goes, where it is and how long
// the episode is. The Spotify window's bar at the foot is drawn from that, and its buttons are these calls.
//
// The script is Spotify's, fetched when the window is first opened and not before. Where it does not arrive
// (no network, a blocker), the window falls back to the plain embedded player, which needs none of this.

export interface Beat {
  paused: boolean
  buffering: boolean
  /** Where it is, and how long the episode is, in milliseconds. */
  at: number
  of: number
}

export interface Controller {
  loadUri(uri: string): void
  play(): void
  pause(): void
  resume(): void
  togglePlay(): void
  /** To a point in the episode, in seconds. */
  seek(seconds: number): void
  destroy(): void
  addListener(event: 'ready', heard: () => void): void
  addListener(event: 'playback_update', heard: (e: { data?: { isPaused?: boolean; isBuffering?: boolean; duration?: number; position?: number } }) => void): void
}

export interface SpotifyApi {
  createController(at: HTMLElement, options: { uri: string; width?: string | number; height?: string | number }, made: (controller: Controller) => void): void
}

/** How long the script is waited for. */
const WAIT = 12_000

let asked: Promise<SpotifyApi | null> | null = null

/** Spotify's iFrame API, fetched once. Null where it did not arrive. */
export function spotifyApi(): Promise<SpotifyApi | null> {
  return (asked ??= new Promise<SpotifyApi | null>((done) => {
    const page = window as unknown as { onSpotifyIframeApiReady?: (api: SpotifyApi) => void }
    const timer = setTimeout(() => done(null), WAIT)
    page.onSpotifyIframeApiReady = (api) => {
      clearTimeout(timer)
      done(api && typeof api.createController === 'function' ? api : null)
    }
    const script = document.createElement('script')
    script.src = 'https://open.spotify.com/embed/iframe-api/v1'
    script.async = true
    script.onerror = () => {
      clearTimeout(timer)
      done(null)
    }
    document.head.append(script)
  }).then((api) => {
    // (not had: the next opening of the window asks again)
    if (!api) asked = null
    return api
  }))
}

/** An episode's link (https://open.spotify.com/episode/<id>) as the uri the controller is given. */
export function uriOf(link: string | null): string | null {
  const found = link ? /^https:\/\/open\.spotify\.com\/(?:intl-[a-z-]+\/)?(episode|show)\/([A-Za-z0-9]+)/.exec(link) : null
  return found ? `spotify:${found[1]}:${found[2]}` : null
}

/** 63000 as 1:03; 4380000 as 1:13:00. */
export function clock(ms: number): string {
  const all = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(all / 3600)
  const m = Math.floor((all % 3600) / 60)
  const s = String(all % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`
}
