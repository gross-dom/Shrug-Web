import { launch, onPhone } from '../phone/system'
import type { AppId } from './apps'
import { dockPoint } from './dom'
import { focusWindow, openApp, wm } from './wm'

/** Opens an app the way the screen it is on opens things: a window out of the
 * Dock on a desktop; on a phone, the app itself. About Shrug is a window of the
 * desktop's: on a phone there is nothing of that name to open. */
export function launchApp(id: AppId) {
  if (wm.get().compact) return onPhone(id) ? launch(id) : undefined
  openApp(id, dockPoint(id))
  focusWindow(id)
}
