import type { ComponentType } from 'react'
import type { PhoneApp } from '../system'
import { MessagesApp } from './Messages'
import { NotesApp } from './Notes'
import { PhotosApp } from './Photos'
import { TerminalApp } from './Terminal'
import { WalletApp } from './Wallet'

// The apps on the phone: each of the desktop's windows, as the iPhone app it
// corresponds to, under that app's own name. What is in each (the portfolio,
// the FAQs) is named inside it, and on its widget: the portfolio is kept in
// Wallet, a card to a vertical. Case Studies and VIP are Shrug's own apps and
// keep their own names: VIP is laid out as Photos is.

export interface PhoneAppSpec {
  /** Under its icon on the Home Screen. */
  label: string
  Root: ComponentType
}

export const PHONE: Record<PhoneApp, PhoneAppSpec> = {
  messages: { label: 'Messages', Root: MessagesApp },
  finder: { label: 'Wallet', Root: WalletApp },
  notes: { label: 'Notes', Root: NotesApp },
  terminal: { label: 'Case Studies', Root: TerminalApp },
  photos: { label: 'VIP', Root: PhotosApp },
}

/** In the Dock, left to right. */
export const DOCKED: PhoneApp[] = ['messages', 'finder', 'notes']

/** On the Home Screen itself, under the widgets. The one-pager's link goes after the first. */
export const ON_HOME: PhoneApp[] = ['terminal', 'photos']
