import { keepFor, keptFor } from '../apps/chat'
import { finder, inbox, notes, openConversation, pickCompany, setFinderView, showNote, showVertical } from '../apps/state'
import { EGGS } from '../data/eggs'
import { FAQS } from '../data/faqs'
import { COMPANIES, VERTICALS } from '../data/portfolio'
import { ONE_PAGER, paperKept, preview } from './papers'
import { keptWins, restoreWins, wm, type KeptWins } from './wm'

// The desktop, kept for the tab. A reload (or Back to the page from somewhere
// else) brings the desk back as it was left: which windows are open and where,
// which is in front, which are in the Dock, and what each is showing. It is
// kept in the tab's own storage, as the conversation's progress is: a new visit
// in another tab starts as any visit does, and where there is no storage to
// keep it in a reload starts over.

interface Kept {
  windows: KeptWins
  finder: { vertical: number; view: string; picked: string | null }
  notes: { note: number }
  inbox: { open: string }
  /** The document Preview has open, by what it goes by (os/papers.ts). */
  paper?: string | null
}

const NAME = 'desk'

const now = (): Kept => ({
  windows: keptWins(),
  finder: { vertical: finder.get().vertical, view: finder.get().view, picked: finder.get().picked },
  notes: { note: notes.get().note },
  inbox: { open: inbox.get().open },
  paper: paperKept(),
})

/** Keeps the desk as it changes, from now on. Returns what stops it. */
export function keepDesk() {
  let last = ''
  let timer: ReturnType<typeof setTimeout> | undefined
  const save = () => {
    const text = JSON.stringify(now())
    if (text === last) return
    last = text
    keepFor(NAME, JSON.parse(text))
  }
  // A window being dragged changes many times a second: what is kept is where it comes to rest
  const soon = () => {
    clearTimeout(timer)
    timer = setTimeout(save, 250)
  }
  const stops = [wm, finder, notes, inbox, preview].map((store) => store.subscribe(soon))
  // A reload within that quarter of a second still finds the last move kept
  window.addEventListener('pagehide', save)
  soon()
  return () => {
    clearTimeout(timer)
    window.removeEventListener('pagehide', save)
    stops.forEach((stop) => stop())
  }
}

/** This page load is a reload, or a return to the page through the browser's history: the visit it
 * belongs to was already under way. A link followed or an address typed is a visit beginning. */
export function returning() {
  try {
    const entry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
    return entry?.type === 'reload' || entry?.type === 'back_forward'
  } catch {
    return false
  }
}

/** Puts the desk back as it was kept. Says whether there was a desk to put back. */
export function restoreDesk(): boolean {
  const kept = keptFor(NAME) as Partial<Kept> | null
  if (!kept || typeof kept !== 'object') return false
  // What each window was showing, where it still names something
  const f = kept.finder
  if (f && typeof f === 'object') {
    if (Number.isInteger(f.vertical) && f.vertical >= -1 && f.vertical < VERTICALS.length) showVertical(f.vertical)
    if (f.view === 'icons' || f.view === 'list') setFinderView(f.view)
    if (typeof f.picked === 'string' && COMPANIES.some((company) => company.key === f.picked)) pickCompany(f.picked)
  }
  const note = kept.notes?.note
  if (typeof note === 'number' && Number.isInteger(note) && note >= 0 && note < FAQS.length) showNote(note)
  const open = kept.inbox?.open
  if (typeof open === 'string' && (open === 'group' || EGGS.some((egg) => egg.id === open))) openConversation(open)
  // A document of someone's own that Preview had open is gone back to once it is known who is logged in
  // (src/apps/Preview.tsx); with none kept, Preview has the one-pager
  if (typeof kept.paper === 'string' && kept.paper !== ONE_PAGER && /^update:[\w-]+$/.test(kept.paper)) preview.set({ paper: null, wanted: kept.paper })
  // A desk with every window closed is a desk too: it comes back empty, not with the conversation opened again
  const had = kept.windows && typeof kept.windows === 'object'
  restoreWins(kept.windows)
  return !!had
}
