import type { ComponentType } from 'react'
import type { PhoneApp } from '../system'
import { AboutApp } from './About'
import { FilesApp } from './Files'
import { MessagesApp } from './Messages'
import { NotesApp } from './Notes'
import { PhotosApp } from './Photos'
import { TerminalApp } from './Terminal'

// The apps on the phone: each of the desktop's windows, redrawn as the iPhone
// app it corresponds to. The names under the icons say what is in them.

export interface PhoneAppSpec {
  /** Under its icon on the Home Screen. */
  label: string
  Root: ComponentType
}

export const PHONE: Record<PhoneApp, PhoneAppSpec> = {
  messages: { label: 'Messages', Root: MessagesApp },
  finder: { label: 'Portfolio', Root: FilesApp },
  notes: { label: 'FAQs', Root: NotesApp },
  terminal: { label: 'Case Studies', Root: TerminalApp },
  photos: { label: 'VIP', Root: PhotosApp },
  about: { label: 'About', Root: AboutApp },
}

/** In the Dock, left to right. */
export const DOCKED: PhoneApp[] = ['messages', 'finder', 'notes', 'photos']

/** On the Home Screen itself, under the widgets. */
export const ON_HOME: PhoneApp[] = ['terminal', 'about']
