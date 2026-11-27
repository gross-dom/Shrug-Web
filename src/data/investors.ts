import { VERTICALS } from './portfolio'

// Accredited Investors Only: what its two sets of questions ask (Dom, 27 Nov). One is for someone logged in as
// an LP, about the deals they want to see; the other is for anyone else, and is an application to become an
// LP or to receive SPVs. They are template questions, here to be rewritten: change a title, a line under it
// or a choice and the window, what is sent to Shrug and the checks follow. Nothing here is a promise about a
// fund or its terms, and nothing should become one without Shrug writing it.

export interface Question {
  id: string
  /** The question, set large. */
  title: string
  /** A line under it. */
  says?: string
  /** One choice of several, any number of several, or words typed into its fields. */
  kind: 'one' | 'many' | 'fields'
  choices?: string[]
  fields?: Field[]
  /** What it is called in what is sent to Shrug: "Stages". */
  label: string
}

export interface Field {
  id: 'name' | 'email' | 'note'
  label: string
  /** What stands in it, empty. */
  hint: string
  kind: 'text' | 'email' | 'words'
  /** It may be left empty. */
  optional?: boolean
}

export interface Survey {
  /** Which of the two it is, as it is sent to Shrug. */
  id: 'preferences' | 'application'
  /** Its first page: who it is for. `title` may greet them by their first name, where `{first}` is written. */
  intro: { title: string; says: string; go: string }
  questions: Question[]
  /** Its last page. */
  done: { title: string; says: string }
  /** The subject it is sent to Shrug under. */
  subject: string
}

/** The categories asked about are the portfolio's own verticals, less the two that are not kinds of deal. */
const CATEGORIES = VERTICALS.map((vertical) => vertical.name).filter((name) => name !== 'Other' && !/Social is Hard/.test(name))

/** For an LP: which deals they want to be sent. It ends by opening their Updates folder. */
export const PREFERENCES: Survey = {
  id: 'preferences',
  intro: { title: 'Welcome back, {first}.', says: 'Tell us which deals you want to see, and we’ll send you the ones that fit.', go: 'Get Started' },
  questions: [
    { id: 'stage', label: 'Stages', title: 'Which stages do you want to see?', says: 'Choose as many as you like.', kind: 'many', choices: ['Pre-seed', 'Seed', 'Series A', 'Series B and later', 'Secondaries'] },
    { id: 'category', label: 'Categories', title: 'Which categories?', says: 'Choose as many as you like.', kind: 'many', choices: CATEGORIES },
    { id: 'channel', label: 'Send by', title: 'How should we send them?', kind: 'one', choices: ['Email', 'Text message', 'Either'] },
  ],
  done: { title: 'You’re all set.', says: 'We’ll send you the deals that fit. Your Updates folder is open.' },
  subject: 'LP deal preferences',
}

/** For anyone else: an application to become an LP, or to receive SPVs. It is sent to Shrug. */
export const APPLICATION: Survey = {
  id: 'application',
  intro: { title: 'Accredited Investors Only', says: 'Apply to invest with Shrug: as an LP in a fund, or deal by deal in SPVs. It takes about a minute.', go: 'Get Started' },
  questions: [
    { id: 'interest', label: 'Interested in', title: 'What are you interested in?', says: 'Choose one or both.', kind: 'many', choices: ['Becoming an LP in a Shrug fund', 'Receiving SPVs, deal by deal'] },
    { id: 'accredited', label: 'Accredited investor', title: 'Are you an accredited investor?', kind: 'one', choices: ['Yes', 'No', 'I’m not sure'] },
    { id: 'amount', label: 'Looking to invest (next 12 months)', title: 'How much are you looking to invest over the next 12 months?', kind: 'one', choices: ['Under $25,000', '$25,000 to $100,000', '$100,000 to $250,000', '$250,000 to $1 million', 'Over $1 million'] },
    {
      id: 'contact',
      label: 'Contact',
      title: 'Where can we reach you?',
      kind: 'fields',
      fields: [
        { id: 'name', label: 'Name', hint: 'Your name', kind: 'text' },
        { id: 'email', label: 'Email', hint: 'name@example.com', kind: 'email' },
        { id: 'note', label: 'Anything we should know?', hint: 'Optional', kind: 'words', optional: true },
      ],
    },
  ],
  done: { title: 'Thank you, we’ll be in touch.', says: 'Your application is with Shrug.' },
  subject: 'Application: Accredited Investors Only',
}
