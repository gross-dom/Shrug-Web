import { finder, openConversation, showInGroup } from '../apps/state'
import { VERTICALS } from '../data/portfolio'
import { contactsFor, GROUP_VIEW, MY_CARD } from '../phone/apps/routes'
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

/** The group conversation itself, from words that point at it (the FAQs' "our wall"): the conversation, not
 * the list of them that Messages may have been left on. */
export function showGroup() {
  if (wm.get().compact) return launchAt('messages', [GROUP_VIEW])
  openConversation('group')
  openApp('messages', dockPoint('messages'))
  focusWindow('messages')
}

/** Shows one company of the portfolio, from wherever it was named (a person's card, the terminal): its
 * card in Contacts on a phone; on a desktop the Portfolio window with it selected. The window is made to
 * show it: a search that was on is over, and a vertical it is not in gives way to all of them. */
export function showCompany(key: string) {
  if (wm.get().compact) return launchAt('finder', contactsFor(key))
  finder.set((s) => {
    const inSight = s.vertical === -1 || !!VERTICALS[s.vertical]?.companies.some((company) => company.key === key)
    const trail = inSight ? s.trail : [...s.trail.slice(0, s.at + 1), -1]
    return { ...s, query: '', picked: key, vertical: inSight ? s.vertical : -1, trail, at: inSight ? s.at : trail.length - 1 }
  })
  openApp('finder', dockPoint('finder'))
  focusWindow('finder')
}

/** Goes to one person's reply in the group conversation, from wherever they were named (their company's
 * card, the terminal). Someone who has not replied yet is brought in with everyone else (src/apps/chat-ui.tsx). */
export function showReply(person: number) {
  showInGroup(person)
  if (wm.get().compact) return launchAt('messages', [GROUP_VIEW])
  openApp('messages', dockPoint('messages'))
  focusWindow('messages')
}
