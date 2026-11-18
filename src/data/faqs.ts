// The FAQs. The questions are from the design canvas; the answers have not
// been written yet, so each is `null`. A visitor is told so in a line written
// for them, with a way on; the editor's view (`?draft`) shows the note that
// says what goes there.

import { reach, SITE } from './site'

export interface Faq {
  question: string
  /** Shrug's answer. `null` until it is written. */
  answer: string | null
}

/** The editor's note in an answer's place. Shown with `?draft` only. */
export const ANSWER_PLACEHOLDER = '[Shrug’s answer goes here. Two or three sentences, in your own voice.]'

/** What a visitor reads where an answer has still to be written. */
export const ANSWER_PENDING = 'Shrug hasn’t written this one down yet.'

/** The same, as the line under a question in a list. */
export const ANSWER_PENDING_LINE = 'Answer on its way'

export interface WayOn {
  label: string
  href: string
  /** It opens in a new tab (the one-pager), not in the visitor's mail or messages. */
  leaves: boolean
}

/** Where a question with no answer yet sends its reader: to Shrug, with the
 * question going along, once there is an address to write to (`reach` in
 * site.ts), and always to the one-pager. */
export function waysOn(question: string): WayOn[] {
  // An email carries the question as its subject, a text as its words
  const way = reach().kind === 'sms' ? reach(question) : reach('', question)
  const onePager: WayOn = { label: 'Read the One-pager', href: SITE.onePager, leaves: true }
  return way.kind === 'doc' ? [onePager] : [{ label: way.label, href: way.href, leaves: false }, onePager]
}

export const FAQS: Faq[] = [
  { question: 'What does Shrug invest in?', answer: null },
  { question: 'How early, and how much?', answer: null },
  { question: 'What happens after the check?', answer: null },
  { question: 'How do I get in front of you?', answer: null },
  { question: 'What are drops?', answer: null },
  { question: 'What is VIP?', answer: null },
  { question: 'Why is it called Shrug?', answer: null },
]
