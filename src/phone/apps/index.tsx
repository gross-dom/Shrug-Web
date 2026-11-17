import type { ComponentType } from 'react'
import type { PhoneApp } from '../system'
import { FilesApp } from './Files'
import { MessagesApp } from './Messages'
import { NotesApp } from './Notes'
import { PhotosApp } from './Photos'
import { SettingsApp } from './Settings'
import { TerminalApp } from './Terminal'

// The apps on the phone: each of the desktop's windows, as the iPhone app it
// corresponds to, under that app's own name. What is in each (the portfolio,
// the FAQs, the drops) is named inside it, and on its widget.

export interface PhoneAppSpec {
  /** Under its icon on the Home Screen. */
  label: string
  Root: ComponentType
}

export const PHONE: Record<PhoneApp, PhoneAppSpec> = {
  messages: { label: 'Messages', Root: MessagesApp },
  finder: { label: 'Files', Root: FilesApp },
  notes: { label: 'Notes', Root: NotesApp },
  terminal: { label: 'Case Studies', Root: TerminalApp },
  photos: { label: 'Photos', Root: PhotosApp },
  about: { label: 'Settings', Root: SettingsApp },
}

/** In the Dock, left to right. */
export const DOCKED: PhoneApp[] = ['messages', 'finder', 'notes', 'photos']

/** On the Home Screen itself, under the widgets. */
export const ON_HOME: PhoneApp[] = ['terminal', 'about']
