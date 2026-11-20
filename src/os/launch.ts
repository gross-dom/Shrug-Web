import { MY_CARD } from '../phone/apps/routes'
import { launch, launchAt, onPhone } from '../phone/system'
import type { AppId } from './apps'
import { dockPoint } from './dom'
import { focusWindow, openApp, wm } from './wm'

/** Opens an app the way the screen it is on opens things: a window out of the
 * Dock on a desktop; on a phone, the app itself. About Shrug is a window of the
 * desktop's and the phone has no app of that name: who Shrug is, there, is on
 * Shrug's own card in Contacts, so that is what opens. */
export function launchApp(id: AppId) {
  if (wm.get().compact) return onPhone(id) ? launch(id) : launchAt('finder', [MY_CARD])
  openApp(id, dockPoint(id))
  focusWindow(id)
}
