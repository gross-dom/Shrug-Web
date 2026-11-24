import type { ReactNode } from 'react'
import { account, downloadDoc, readDoc, requestDoc, type Doc, type NotHere } from './account'
import { dockPoint } from './dom'
import { createStore } from './store'
import { closeApp, focusWindow, openApp, wm } from './wm'

// What Preview has open (design/v1, "Preview"). Every document on the desktop opens there: the one-pager,
// which anyone may read, and the documents in the Updates folder, which are an LP's own. A paper is a
// document as Preview needs it: its name, where its pages come from, and what may be done with it.
//
// Nothing of a private document is in the page until its owner opens it: its pages are fetched then, from
// the store's server, which hands them only to someone they are for (os/account.ts, `readDoc`). When
// whoever is logged in changes, a private document is put away with them.

/** A page drawn here, by the site itself (the one-pager's): its size at 100%, and what is on it. */
export interface Sheet {
  w: number
  h: number
  draw: () => ReactNode
}

export interface Paper {
  /** What tells one document from another. */
  id: string
  /** The file's name, as the window's bar has it: One-pager.pdf */
  name: string
  /** Kept to the person it was prepared for: tagged Private, and their name is under its pages. */
  preparedFor: string | null
  /** Where its pages come from: drawn by the site, or a PDF that is fetched when it is opened. */
  pages: { kind: 'sheets'; sheets: Sheet[] } | { kind: 'pdf'; read: () => Promise<Uint8Array | NotHere> }
  /** Saves it. Null where it is to be read here and not saved. */
  download: (() => unknown) | null
  /** For one that is not theirs to open: whose it is ("Shrug 3": it was written for the LPs of that), and how to ask for it. */
  ask?: { forWhom: string; asked: boolean; send: () => Promise<true | { error: string }> }
}

/** What Preview has open. `paper` is the document; with none, it is the one-pager, which is what Preview
 * shows when it is asked for by name. `wanted` is a document to go back to (a reload with one open): it is
 * found again once it is known who is logged in, and if it is not theirs any more the window closes. */
export const preview = createStore<{ paper: Paper | null; wanted: string | null }>({ paper: null, wanted: null })

/** The one-pager, by the name Preview keeps it under. */
export const ONE_PAGER = 'one-pager'

/** What the open document goes by: kept with the desk, so that a reload comes back to it (os/deskmemory.ts). */
export const paperKept = () => (wm.get().wins.preview.open ? (preview.get().paper?.id ?? preview.get().wanted ?? ONE_PAGER) : null)

function show(from: string | null) {
  const el = from ? document.querySelector<HTMLElement>(from) : null
  const r = el?.getBoundingClientRect()
  openApp('preview', r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : dockPoint('preview'))
  focusWindow('preview')
}

/** Opens a document in Preview: its window comes out of the row that was opened, and to the front. */
export function openPaper(paper: Paper) {
  preview.set({ paper, wanted: null })
  show('.wf[data-app="updates"] .upd-row.on')
}

/** Opens the one-pager in Preview, out of its file on the desk. (A desktop's: a phone has no Preview, and keeps its link.) */
export function openOnePager() {
  preview.set({ paper: null, wanted: null })
  show('[data-desk="one-pager"] .desk__icon')
}

/** A document of the Updates folder, as Preview has it. One that is theirs is fetched and read; one written
 * for others says so, and can be asked for from there. */
export function paperOf(doc: Doc): Paper {
  const who = account.get()
  return {
    id: `update:${doc.id}`,
    name: `${doc.name}.pdf`,
    preparedFor: who.status === 'member' ? who.name || who.email : '',
    pages: { kind: 'pdf', read: () => readDoc(doc) },
    download: doc.download && doc.state === 'open' ? () => downloadDoc(doc) : null,
    ask: doc.state === 'request' || doc.state === 'requested' ? { forWhom: doc.tag, asked: doc.state === 'requested', send: () => requestDoc(doc) } : undefined,
  }
}

// A private document goes when the person it was prepared for does: logged out, or someone else logged in.
// (And when what they are shown changes, the paper that is open follows: one just asked for says Requested.)
if (typeof window !== 'undefined') {
  let was = ''
  account.subscribe(() => {
    const who = account.get()
    const now = who.status === 'member' ? who.email : ''
    const { paper } = preview.get()
    if (who.status === 'checking') return
    if (paper?.preparedFor != null && now !== was && was) {
      preview.set({ paper: null, wanted: null })
      if (wm.get().wins.preview.open) closeApp('preview')
    } else if (paper?.id.startsWith('update:') && who.status === 'member') {
      const doc = who.docs.find((d) => `update:${d.id}` === paper.id)
      const next = doc ? paperOf(doc) : null
      // Only where it says something new: the same paper, opened again, would begin its pages over
      if (next && (next.ask?.asked ?? null) !== (paper.ask?.asked ?? null)) preview.set({ paper: { ...paper, ask: next.ask }, wanted: null })
    }
    was = now
  })
}
