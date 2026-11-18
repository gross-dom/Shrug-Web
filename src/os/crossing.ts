import { finder, inbox, notes, openConversation, pickCompany, showNote } from '../apps/state'
import { COMPANIES } from '../data/portfolio'
import { FAQS } from '../data/faqs'
import { companySheet, conversationView, FAQS_FOLDER, noteView, PORTFOLIO_FOLDER } from '../phone/apps/routes'
import { arriveIn, sys, topOf, unlock } from '../phone/system'
import { APP_IDS } from './apps'
import { dockPoint } from './dom'
import { activeApp, openApp, wm } from './wm'

// The site changes layout under a visit that is already going: a tablet is
// turned, a window is dragged across the line, a split view opens. The visitor
// stays where they were. The desktop's front window becomes the iPhone's open
// app (unlocked: nobody who is already in gets a Lock Screen), on the same
// conversation, company or question; and the other way about.

/** The desktop's front window, as the screens the iPhone's app would be on. */
function fromDesk(app: (typeof APP_IDS)[number]): { stack?: string[]; sheet?: string | null } {
  if (app === 'messages') return { stack: [conversationView(inbox.get().open)] }
  if (app === 'notes') return { stack: [FAQS_FOLDER, noteView(notes.get().note)] }
  if (app === 'finder') {
    const { picked } = finder.get()
    return { stack: [PORTFOLIO_FOLDER], sheet: picked ? companySheet(picked) : null }
  }
  return {}
}

/** Now the iPhone: its app is the window that was in front, at the same place. */
function toPhone() {
  const front = activeApp(wm.get())
  // No window in front: the Home Screen. The same app already open on the phone: as the phone left it
  if (!front || sys.get().app === front) return unlock()
  const { stack, sheet } = fromDesk(front)
  arriveIn(front, stack, sheet ?? null)
}

/** Now the desktop: the window in front is the app that was open on the iPhone, at the same place. */
function toDesk() {
  const s = sys.get()
  const app = s.app
  if (app) {
    const top = topOf(s, app)
    if (app === 'messages' && top?.startsWith('c:')) openConversation(top.slice(2))
    if (app === 'notes' && top?.startsWith('n:')) {
      const note = Number(top.slice(2))
      if (Number.isInteger(note) && note >= 0 && note < FAQS.length) showNote(note)
    }
    if (app === 'finder' && s.sheet?.startsWith('company:')) {
      const key = s.sheet.slice('company:'.length)
      if (COMPANIES.some((company) => company.key === key)) pickCompany(key)
    }
    return openApp(app, dockPoint(app))
  }
  // A desktop that has never had a window opens the conversation, as an arrival does
  const { wins } = wm.get()
  if (!APP_IDS.some((id) => wins[id].mounted)) openApp('messages', dockPoint('messages'))
}

/** The layout has just changed to the iPhone (`compact`) or to the desktop. */
export const cross = (compact: boolean) => (compact ? toPhone() : toDesk())
