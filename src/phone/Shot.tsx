import { FinderApp } from '../apps/Finder'
import { NotesApp } from '../apps/Notes'
import { PhotosApp } from '../apps/Photos'
import { TerminalApp } from '../apps/Terminal'
import { APPS } from '../os/apps'
import type { ShotApp } from './convo'
import { openApp } from './nav'

// A screenshot of a window on Niv's Mac, as a message carries a picture. It
// isn't a picture: it is the desktop's own window, drawn at its real size on
// the desktop's wallpaper and scaled down to fit a bubble, so it is always the
// window as it stands. Nothing in it can be touched; a tap on the bubble opens
// what it shows, laid out for a phone.

const WINDOWS: Record<ShotApp, { Body: () => JSX.Element; w: number; h: number }> = {
  finder: { Body: FinderApp, w: 860, h: 540 },
  notes: { Body: NotesApp, w: 760, h: 500 },
  terminal: { Body: TerminalApp, w: 640, h: 400 },
  photos: { Body: PhotosApp, w: 860, h: 560 },
}

/** The piece of desktop a screenshot takes in, and the width it is shown at in the thread. */
const SCREEN = { w: 1000, h: 660 }
export const SHOT_WIDTH = 252

export function Shot({ app }: { app: ShotApp }) {
  const { Body, w, h } = WINDOWS[app]
  const k = SHOT_WIDTH / SCREEN.w
  return (
    <div className="shot" data-shot={app} style={{ width: SHOT_WIDTH, height: Math.round(SCREEN.h * k) }}>
      <div className="shot__screen" style={{ width: SCREEN.w, height: SCREEN.h, transform: `scale(${k})` }} aria-hidden {...({ inert: '' } as object)}>
        <div className="shot__window wf__content" style={{ width: w, height: h }}>
          <Body />
        </div>
      </div>
      <button type="button" className="shot__open" aria-label={`A screenshot of ${APPS[app].name} on Niv’s Mac. Open it.`} onClick={() => openApp(app)} />
    </div>
  )
}
