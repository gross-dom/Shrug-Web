import { openPhoneApp } from '../phone/nav'
import type { AppId } from './apps'
import { dockPoint } from './dom'
import { focusWindow, openApp, wm } from './wm'

/** Opens an app the way the screen it is on opens apps: a window out of the
 * Dock on a desktop, the app itself on a phone. */
export function launchApp(id: AppId) {
  if (wm.get().compact) return openPhoneApp(id)
  openApp(id, dockPoint(id))
  focusWindow(id)
}
