import { FILMS } from '../data/films'
import { EPISODES, PLAYLISTS } from '../data/listening'
import { EXCHANGES } from '../data/mail'
import { TEMPLATED } from '../data/site'
import { VIDEOS } from '../data/videos'
import { DOCK_APPS, type AppId } from './apps'

// What is left out of the live site for now. Several of the v1 apps are built before what goes in them has
// been supplied: Mail's exchanges, the films, the episodes and playlists, the videos. The design gives those
// as rows whose words are in [square brackets]. A visitor never reads a note written for Shrug, so on the
// live site an app with nothing real in it yet has no icon: it is there the day its first real row is. The
// demo, which is built to be looked at before it is live, and the editor's view (?draft) have every app
// (data/site.ts, TEMPLATED). Only the desktop reads this: a phone has none of these apps.

const HELD: Partial<Record<AppId, boolean>> = TEMPLATED
  ? { workspace: true }
  : {
      workspace: true,
      mail: EXCHANGES.every((exchange) => exchange.from.startsWith('[')),
      // (a film is its file, and a row to be listened to or watched is its link: with none supplied there is nothing to play)
      quicktime: FILMS.every((film) => !film.src),
      spotify: EPISODES.every((episode) => !episode.link) && PLAYLISTS.every((playlist) => !playlist.link),
      youtube: VIDEOS.every((video) => !video.id),
    }

// Workspace is left out everywhere for now, for another reason: it is a first draft (the studio, and a
// placeholder for the chair) that has not been looked at or put through its checks yet. It is built, and an
// address that names it opens it (?open=workspace); it has no icon in the Dock until it has been checked.

/** Whether an app is left out for now. */
export const held = (id: AppId) => !!HELD[id]

/** The Dock's apps, less any that is left out. */
export const DOCK = DOCK_APPS.filter((id) => !held(id))
