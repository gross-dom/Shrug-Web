// The FAQs. The questions are from the design canvas; the answers have not
// been written yet, so each is `null` and the note shows the placeholder.

export interface Faq {
  question: string
  /** Shrug's answer. `null` until it is written. */
  answer: string | null
}

export const ANSWER_PLACEHOLDER = '[Shrug’s answer goes here. Two or three sentences, in your own voice.]'

export const FAQS: Faq[] = [
  { question: 'What does Shrug invest in?', answer: null },
  { question: 'How early, and how much?', answer: null },
  { question: 'What happens after the check?', answer: null },
  { question: 'How do I get in front of you?', answer: null },
  { question: 'What are drops?', answer: null },
  { question: 'What is VIP?', answer: null },
  { question: 'Why is it called Shrug?', answer: null },
]
