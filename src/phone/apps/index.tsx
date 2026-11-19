import type { ComponentType } from 'react'
import type { Ground, Tone } from '../chrome'
import type { PhoneApp } from '../system'
import { ContactsApp, contactsFirst } from './Contacts'
import { MessagesApp } from './Messages'
import { NotesApp } from './Notes'
import { PhotosApp } from './Photos'
import { TerminalApp } from './Terminal'

// The apps on the phone: each of the desktop's windows, as the iPhone app it
// corresponds to, under that app's own name. What is in each (the portfolio,
// the FAQs) is named on its widget: the portfolio is kept in Contacts, a
// company to a row and a section to a vertical. Case Studies and VIP are
// Shrug's own apps and keep their own names: VIP is laid out as Photos is.

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
}

export const PHONE: Record<PhoneApp, PhoneAppSpec> = {
  messages: { label: 'Messages', Root: MessagesApp },
  finder: { label: 'Contacts', Root: ContactsApp, first: contactsFirst },
  // A note is a white page; the lists of them are on the gray that inset lists sit on
  notes: { label: 'Notes', Root: NotesApp, first: (top) => ({ tone: top && /^[nu]:/.test(top) ? 'plain' : 'grouped' }) },
  terminal: { label: 'Case Studies', Root: TerminalApp, first: () => ({ tone: 'dark' }) },
  photos: { label: 'VIP', Root: PhotosApp },
}

/** In the Dock, left to right: the four that are always to hand. */
export const DOCKED: PhoneApp[] = ['messages', 'finder', 'notes', 'photos']

/** On the Home Screen itself, under the widgets. The one-pager's link goes after it. */
export const ON_HOME: PhoneApp[] = ['terminal']
