import { finder, inbox, notes, openConversation, pickCompany, showInGroup, showNote } from '../apps/state'
import { FAQS } from '../data/faqs'
import { companyOf, contactsFor, conversationView, FAQS_FOLDER, noteView } from '../phone/apps/routes'
import { arriveIn, onPhone, sys, topOf, unlock } from '../phone/system'
import { APP_IDS } from './apps'
import { dockPoint } from './dom'
import { atCompany, atConversation, atQuestion, companyAt, conversationAt, personAt, questionAt, type Spot } from './place'
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
    return { stack: contactsFor(picked) }
  }
  return {}
}

/** Now the iPhone: its app is the window that was in front, at the same place. */
function toPhone() {
  const front = activeApp(wm.get())
  // No window in front, or one the phone has no app for (About Shrug): the Home Screen. The same app
  // already open on the phone: as the phone left it
  if (!front || !onPhone(front) || sys.get().app === front) return unlock()
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
    // The company whose card is open in Contacts is the one picked in the window
    const company = app === 'finder' ? companyOf(top) : null
    if (company) pickCompany(company)
    return openApp(app, dockPoint(app))
  }
  // A desktop that has never had a window opens the conversation, as an arrival does
  const { wins } = wm.get()
  if (!APP_IDS.some((id) => wins[id].mounted)) openApp('messages', dockPoint('messages'))
}

// ---- The desktop as a spot (src/os/place.ts): what its address says, and what a link to it opens ----

/** Where the desktop is: the window in front and what it is showing. The desk as a visit finds it
 * (the conversation in front, or nothing open) is nowhere in particular: the site's plain address. */
export function spotOfDesk(): Spot | null {
  const front = activeApp(wm.get())
  if (!front) return null
  if (front === 'messages') {
    const at = atConversation(inbox.get().open)
    return at ? { app: front, at } : null
  }
  if (front === 'finder') return { app: front, at: atCompany(finder.get().picked) }
  // The FAQs window always shows a question; the first is where it opens anyway
  if (front === 'notes') return { app: front, at: notes.get().note > 0 ? atQuestion(notes.get().note) : null }
  return { app: front, at: null }
}

/** Has a window show what a link names (the window is opened by whoever calls this). */
export function showOnDesk(spot: Spot) {
  if (spot.app === 'messages') {
    openConversation(conversationAt(spot.at) ?? 'group')
    // One person's reply: the group, at what they said
    const who = personAt(spot.at)
    if (who !== null) showInGroup(who)
  }
  if (spot.app === 'finder' && companyAt(spot.at)) pickCompany(companyAt(spot.at))
  if (spot.app === 'notes' && questionAt(spot.at) !== null) showNote(questionAt(spot.at)!)
}

/** The layout has just changed to the iPhone (`compact`) or to the desktop. */
export const cross = (compact: boolean) => (compact ? toPhone() : toDesk())
