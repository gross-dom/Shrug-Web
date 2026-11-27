import type { ComponentType } from 'react'
import type { Ground, Tone } from '../chrome'
import type { PhoneApp } from '../system'
import { BooksApp } from './Books'
import { ContactsApp, contactsFirst } from './Contacts'
import { MessagesApp } from './Messages'
import { NotesApp } from './Notes'
import { OnePagerApp, UpdatesApp } from './Papers'
import { MyVipApp } from './MyVip'
import { ArtStoreApp } from './Shop'
import { TerminalApp } from './Terminal'
import { WorkspaceApp, workspaceFirst } from './Workspace'

// The apps on the phone: each of the desktop's windows, as the iPhone app it
// corresponds to, under that app's own name. What is in each (the portfolio,
// the FAQs) is named on its widget: the portfolio is kept in Contacts, a
// company to a row and a section to a vertical. Case Studies is Shrug's own
// app and keeps its own name. (VIP is in the Dock beside these and is not one
// of them: it is a link to the points site, drawn by Springboard.tsx.)

/** What a screen is drawn on, as the status bar and the browser's bars are told it (src/phone/chrome.ts). */
export interface FirstScreen {
  tone: Tone
  ground?: Ground
  over?: Tone
}

export interface PhoneAppSpec {
  /** Under its icon on the Home Screen. */
  label: string
  Root: ComponentType
  /** What the app is drawn on at the screen it is opening at (`top` is that screen, null for its first):
   * the colour of its launch screen, shown while its own screens are put together (Springboard.tsx). */
  first?: (top: string | null) => FirstScreen
  /** Its screens are put together with it, not a moment after on a launch screen: it takes typing the
   * instant it opens, and whatever was typed before its screens were there would be lost. */
  eager?: boolean
}

export const PHONE: Record<PhoneApp, PhoneAppSpec> = {
  messages: { label: 'Messages', Root: MessagesApp },
  finder: { label: 'Contacts', Root: ContactsApp, first: contactsFirst },
  // A note is a white page; the lists of them are on the gray that inset lists sit on
  notes: { label: 'Notes', Root: NotesApp, first: (top) => ({ tone: top && /^[nu]:/.test(top) ? 'plain' : 'grouped' }) },
  terminal: { label: 'Case Studies', Root: TerminalApp, first: () => ({ tone: 'dark' }), eager: true },
  // Workspace is the studio: paper, then whichever color is picked (apps/Workspace.tsx)
  workspace: { label: 'Workspace', Root: WorkspaceApp, first: workspaceFirst },
  // The stores are black, every screen of them: ArtStore's shelf and a piece's page (apps/Shop.tsx,
  // Product.tsx), Books' shelf and reader (apps/Books.tsx), and My VIP (apps/MyVip.tsx)
  store: { label: 'ArtStore', Root: ArtStoreApp, first: () => ({ tone: 'dark' }) },
  books: { label: 'Books', Root: BooksApp, first: () => ({ tone: 'dark' }) },
  myvip: { label: 'My VIP', Root: MyVipApp, first: () => ({ tone: 'dark' }) },
  // Documents, on the gray they lie on: the one-pager (the desk's Preview: here the app is the document), and
  // the folder kept for Shrug's LPs (apps/Papers.tsx)
  preview: { label: 'One-pager', Root: OnePagerApp, first: () => ({ tone: 'grouped' }) },
  updates: { label: 'Updates', Root: UpdatesApp, first: () => ({ tone: 'grouped' }) },
}

/** In the Dock, left to right: the apps that are always to hand. Workspace is the fourth (where VIP's link was). */
export const DOCKED: PhoneApp[] = ['messages', 'finder', 'notes', 'workspace']

/** On the Home Screen itself, under the widgets: Case Studies, the one-pager, ArtStore and Books, which fill the row. */
export const ON_HOME: PhoneApp[] = ['terminal', 'preview', 'store', 'books']

/** The apps with no icon on the Home Screen: My VIP and Updates. It has no place left for them on a phone as
 * short as most are with a browser's bars about them (a sixth row runs into the Dock), so they are opened from
 * where they are wanted: search, which has every app at its head as an iPhone's does; the balance in a
 * store's bar, for My VIP; and the account's sheet, which leads to both. */
export const OFF_HOME: PhoneApp[] = ['myvip', 'updates']
