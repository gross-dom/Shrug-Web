import type { AppId } from '../os/apps'
import { SITE } from './site'

// The other conversations in Shrug's Messages: a handful of easter eggs, there
// to be found beside the group chat. The words are placeholders, written to be
// edited: change them, take one out or add another here and Messages follows
// (the desktop's sidebar and the iPhone's list, each conversation, and search).

/** Something in a bubble that goes somewhere: a page in a new tab, or one of the site's own apps. */
export type EggLink = { label: string; href: string } | { label: string; app: AppId }

/** One bubble: Shrug's own (`me`, blue, on the right) or the other side's (`them`, gray, on the left). */
export type EggMessage = { from: 'me' | 'them'; text: string } | { from: 'me' | 'them'; link: EggLink }

export interface Egg {
  /** What the conversation is called in an address and in the phone's history (`c:mom`). */
  id: string
  /** Who it is with. A name gets a monogram; a number gets the plain face Messages gives a sender it doesn't know. */
  name: string
  /** How long ago its last message was, in minutes: where it sits in the list, and what its row says. */
  ago: number
  messages: EggMessage[]
}

const HOUR = 60
const DAY = 24 * HOUR

export const EGGS: Egg[] = [
  {
    id: 'founder',
    name: 'A Founder',
    ago: 7 * HOUR,
    messages: [
      { from: 'them', text: 'you up?' },
      { from: 'me', text: 'always' },
      { from: 'them', text: 'we just closed our first customer' },
      { from: 'me', text: 'LET’S GO. calling you' },
    ],
  },
  {
    id: 'unknown',
    name: '+1 (555) 010-0142',
    ago: 21 * HOUR,
    messages: [
      { from: 'them', text: 'hi! got your number from a friend. can i send you what we’re building?' },
      { from: 'me', text: 'please do. here’s a bit about us first' },
      { from: 'me', link: { label: 'Shrug one-pager', href: SITE.onePager } },
    ],
  },
  {
    id: 'mom',
    name: 'Mom',
    ago: 30 * HOUR,
    messages: [
      { from: 'them', text: 'so what is it you do again' },
      { from: 'me', text: 'we back founders early' },
      { from: 'them', text: 'like shark tank' },
      { from: 'me', text: SITE.mark },
      { from: 'them', text: 'ok. wear a jacket' },
    ],
  },
  {
    id: 'drops',
    name: 'Drops',
    ago: 3 * DAY,
    messages: [
      { from: 'them', text: 'Your drop is out for delivery.' },
      { from: 'them', link: { label: 'See who got one in VIP', app: 'photos' } },
    ],
  },
  {
    id: 'code',
    name: '72975',
    ago: 5 * DAY,
    messages: [
      { from: 'them', text: 'Your Shrug verification code is 000000. Don’t share it with anyone.' },
      { from: 'them', text: 'We’ll never ask for it. We might ask what you’re building.' },
    ],
  },
]

/** The conversation with this id, or null if there is none. */
export const eggOf = (id: string) => EGGS.find((egg) => egg.id === id) ?? null

/** What a conversation's row shows of it: the words of its last message. */
export const lastWords = (egg: Egg) => {
  const last = egg.messages[egg.messages.length - 1]
  return !last ? '' : 'link' in last ? last.link.label : last.text
}
