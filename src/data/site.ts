// Site-wide facts and links.
export const SITE = {
  name: 'Shrug',
  legalName: 'Shrug Capital',
  mark: '¯\\_(ツ)_/¯',
  face: 'ツ',
  /** What Shrug is, in a sentence: under the name in About Shrug, and what a
   * search engine, a link preview or a browser that cannot draw the site
   * reads. This one says no more than the site's own testimonials
   * do; Shrug's own sentence belongs here. */
  line: 'Shrug Capital is an early-stage venture fund.',
  /** Where the site lives. The link preview's addresses are written from this (vite.config.ts). */
  url: 'https://www.shrug.vc/',
  onePager: 'https://docsend.com/view/4659mp7f5ci9zdxa',
  /** The points site: a member's card, and the store their points are spent in. (Its testing address,
   * until it has a domain of its own.) It is where VIP leads: VIP is a link to it wherever it appears,
   * in the Dock of the desktop and of the iPhone, and opens in a tab of its own. */
  points: 'https://shrug-store.vercel.app/',
  store: 'https://shrug-store.vercel.app/store/',
  /** How a visitor gets hold of Shrug for real: a number to text
   * (international form, '+1...') or an address to email. Neither is known
   * yet, so both are null and `reach` falls back on the one-pager. The day
   * one is written here, every place that offers a way to Shrug uses it.
   *
   * `inbox` is where a message written to Shrug on the phone is sent, with the
   * files that go with it (a deck, a one-pager: Messages, the compose button):
   * an address that takes a form by POST, the words as `text` and each file as
   * `files`, and answers 2xx once it has them. Shrug means these to reach a
   * forwarding number linked to an email account, to be built later. There is
   * none yet, so a message written there says it was not delivered, and
   * nothing leaves the page. */
  contact: { sms: null as string | null, email: null as string | null, inbox: null as string | null },
}

/** What About Shrug says of the firm (the window on the desktop). Each is said in Shrug's own FAQs
 * (faqs.ts): if one changes there, it changes here. */
export const ABOUT = {
  facts: [
    { label: 'Started', value: '2017' },
    { label: 'Partners', value: 'Niv Dror, Dom Santry' },
    { label: 'Fund', value: 'Shrug V, the fifth' },
  ],
  /** What it backs: a row of its own, under the others. */
  backs: 'Defense, space, energy, manufacturing and consumer brands',
}

export interface Reach {
  /** email: a message in the visitor's mail app. sms: a text. doc: neither is known, so the one-pager. */
  kind: 'email' | 'sms' | 'doc'
  /** What the button that goes there says. */
  label: string
  href: string
}

/** The way to Shrug, best first: an email, a text, and with neither the one-pager.
 * `words` go with the visitor as the message's body; `subject` is an email's. */
export function reach(words = '', subject = ''): Reach {
  const { email, sms } = SITE.contact
  const body = encodeURIComponent(words)
  if (email) {
    const query = [subject && `subject=${encodeURIComponent(subject)}`, words && `body=${body}`].filter(Boolean).join('&')
    return { kind: 'email', label: 'Email Shrug', href: `mailto:${email}${query ? `?${query}` : ''}` }
  }
  // "?&body=" is the one spelling both iOS and Android read
  if (sms) return { kind: 'sms', label: 'Text Shrug', href: `sms:${sms}${words ? `?&body=${body}` : ''}` }
  return { kind: 'doc', label: 'Read the One-pager', href: SITE.onePager }
}

/** There is a real way to write to Shrug (not only the one-pager). */
export const reachable = () => reach().kind !== 'doc'

/** The address asks for the editor's view (`?draft`): what Shrug has still to
 * supply (an FAQ's answer) is drawn as the note that says so.
 * Without it a visitor is shown a line written for them instead. */
export const DRAFT = typeof window !== 'undefined' && /[?&]draft(?![^&=]*=(0|false|off|no)(&|$))/i.test(window.location.search)
