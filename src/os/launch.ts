import { launch } from '../phone/system'
import type { AppId } from './apps'
import { dockPoint } from './dom'
import { focusWindow, openApp, wm } from './wm'

/** Opens an app the way the screen it is on opens things: a window out of the
 * Dock on a desktop; on a phone, the app itself. */
export function launchApp(id: AppId) {
  if (wm.get().compact) return launch(id)
  openApp(id, dockPoint(id))
  focusWindow(id)
}
