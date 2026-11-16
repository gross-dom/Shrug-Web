import { closeApp, openApp as openPhoneApp } from '../phone/nav'
import type { AppId } from './apps'
import { dockPoint } from './dom'
import { focusWindow, openApp, wm } from './wm'

/** Opens an app the way the screen it is on opens things: a window out of the
 * Dock on a desktop; on a phone, out of the conversation (which is where About
 * and the group chat already are). */
export function launchApp(id: AppId) {
  if (wm.get().compact) return id === 'about' || id === 'messages' ? closeApp() : openPhoneApp(id)
  openApp(id, dockPoint(id))
  focusWindow(id)
}
