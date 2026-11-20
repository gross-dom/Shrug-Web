// The FAQs, in Shrug's own words. An answer is written as a note-taker would
// type it: a blank line between paragraphs, a line that starts "- " for each
// thing in a list, [words](address) for a link ([words](app:messages) for one
// of the site's own apps), *words* for stress and ~words~ for words crossed
// out and left to be read. `answerBlocks` reads those marks for the places
// that draw an answer; `answerWords` gives it as bare words, for a search, a
// list's preview and a tile. A question whose answer is still to be written
// has `null`: a visitor is told so in a line written for them, with a way on,
// and the editor's view (`?draft`) shows the note that says what goes there.

import type { AppId } from '../os/apps'
import { reach, SITE } from './site'

export interface Faq {
  question: string
  /** Shrug's answer, with the marks above. `null` until it is written. */
  answer: string | null
}

/** A run of an answer's words: plain, stressed, crossed out, a link to a page, or one to an app of the site's. */
export type Inline = string | { em: string } | { struck: string } | { label: string; href: string } | { label: string; app: AppId }

/** A paragraph of an answer, or a list in it. */
export type Block = { kind: 'p'; parts: Inline[] } | { kind: 'list'; items: Inline[][] }

/** A link, stressed words, or words crossed out. None runs over a line's end, so a lone asterisk is an
 * asterisk. A tilde is a mark only with words hard against it on the inside, so that two that each mean
 * "about" (~2,000 here, ~3,000 there) stay tildes. */
const MARK = /\[([^\]\n]+)\]\(([^)\n]+)\)|\*([^*\n]+)\*|~([^~\s](?:[^~\n]*[^~\s])?)~/g

function inline(text: string): Inline[] {
  const parts: Inline[] = []
  let at = 0
  for (const mark of text.matchAll(MARK)) {
    if (mark.index > at) parts.push(text.slice(at, mark.index))
    const [, label, address, stressed, struck] = mark
    if (stressed !== undefined) parts.push({ em: stressed })
    else if (struck !== undefined) parts.push({ struck })
    else if (address!.startsWith('app:')) parts.push({ label: label!, app: address!.slice(4) as AppId })
    else parts.push({ label: label!, href: address! })
    at = mark.index + mark[0].length
  }
  if (at < text.length) parts.push(text.slice(at))
  return parts
}

/** An answer as what is drawn: its paragraphs and its lists, in order. */
export function answerBlocks(answer: string): Block[] {
  return answer.split(/\n{2,}/).map((chunk): Block => {
    const lines = chunk.split('\n')
    return lines.every((line) => line.startsWith('- ')) ? { kind: 'list', items: lines.map((line) => inline(line.slice(2))) } : { kind: 'p', parts: inline(lines.join(' ')) }
  })
}

/** An answer as bare words: a link is its words, a list is its lines, and what is crossed out is still said. */
export const answerWords = (answer: string) => answer.replace(MARK, (_, label, __, stressed, struck) => label ?? stressed ?? struck).replace(/^- /gm, '')

/** How an answer begins: its first paragraph, as bare words, for the line under a question in a list. */
export const answerOpening = (answer: string) => answerWords(answer.split(/\n{2,}/)[0]!)

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
  {
    question: 'Why is it called Shrug V?',
    answer: 'Shrug V is the fifth fund, and the name says exactly that.',
  },
  {
    question: 'Why do founders like working with Shrug?',
    answer:
      'We are a small team that can move mountains for the right opportunities. We’ve built up a strong reputation with founders and investors who see the outsized value we can bring, leading to more founders recommending us to their peers, and other investors to want us in their deals. Reputation is everything in venture, and Shrug is in a very privileged position.',
  },
  {
    question: 'What are you investing in?',
    answer: `Founders taking big swings where technology meets culture. Factories in orbit (Varda). Small nuclear reactors (Antares). Software-run factories for aerospace parts (Hadrian). A new handheld for old cartridges (ModRetro). A YouTuber’s chocolate on the supermarket shelf (Feastables).

Huge industries are being rebuilt with technology, sped up by AI, without AI valuations. We think that’s good news, and we put money behind it.`,
  },
  {
    question: 'Where do you find opportunities?',
    answer: `We spend a lot of time thinking about this. First, we make sure that we’re in the right circles of people who are in and around the type of companies we want to be investing in. These are close trusted relationships with a highly curated group of people, who founders make sure to seek out when they’re starting a company in their field. Second, we make sure to be top of mind with them, and share everything, going above and beyond, adding value, sharing deals, dinners, catch-ups, strategic marketing drops around companies we’re in, among other things.

We believe that meeting people in person is essential for building close relationships, and for truly getting to know people. We go out of our way to make non-obvious connections, looking for places to make things happen, especially when it’s least expected, often as soon as we meet people. Eventually, one thing leads to another that leads to “proprietary” deal-flow. Doing these things repeatedly when working with good people is key to seeing the truly unique opportunities where alpha exists.`,
  },
  {
    question: 'How do you do marketing?',
    answer: `We are ~pleased to announce~ our go-to marketing checklist:

- We don’t go on podcasts
- We don’t do press
- We decline all reporter requests
- We don’t hire ghostwriters
- We don’t have a newsletter (we do frequently write to our investors)
- We don’t tweet about everything in tech
- We don’t TikTok about all the world’s events
- We don’t do swag with our company name*
- Our website looks different than other vc homepages

Our rules of engagement:

- We don’t talk about ourselves publicly
- We avoid taking pictures with celebrities
- We don’t organize happy hours for networking
- We don’t speak at conferences or attend them
- There are no photos of Shrug dinners anywhere
- We always come with gifts!`,
  },
  {
    question: 'What does it mean to come with gifts?',
    answer: `One of our key principles is to *always come with gifts* which is our way of always trying to leave a positive touch point when asking for someone’s attention. It may also mean sending a physical gift that shows up on people’s doorsteps, but that is for the next section.

Always striving for a positive touchpoint hopefully means that people look forward to hearing from us across different mediums. We want people to have a positive association when Shrug is brought up in conversation, and a key part of that comes down to how we interact with people. We are very curated, and try to suggest things that people are genuinely excited about saying Yes to. We want people to look forward to seeing our name whenever they see an email/text from us, and for that time to be well spent if they took us up on it. It also means coming through with what we commit to doing, if we said we are going to do it.`,
  },
  {
    question: 'What areas are you excited to be investing in?',
    answer: `Shrug Capital backs culturally relevant companies. We are drawn to founders who are going after massive industries that have seen little to no innovation and are primed for technological change. We are particularly excited about space and the companies that are now viable with the lower cost of getting to orbit. Alternative forms of energy, including nuclear are also seeing significant tailwinds and technological breakthroughs as a viable form of clean energy.

The next household consumer brands are being built around creators, who have a deep understanding and trust of their audience as an initial wedge, and a massive distribution advantage. The biggest creators in the world are entrepreneurs, they are businesses, and they are starting tomorrow’s iconic companies. We are uniquely positioned to see these opportunities at the earliest stages given a variety of nodes in our network, and help guide their capital raises. These tend to be capital-efficient businesses, with very small cap tables.

We are excited about personalized health, manufacturing, defense, and artificial intelligence when AI is an enabler and not central to why people should care about it. We care about partnering with founders solving real problems, for customers that do not want to be sold, they need the solution today. We believe in backing great founders going after massive markets that have been stale. We believe in backing founders on [Good Quests](https://foundersfund.com/2023/06/choose-good-quests/).`,
  },
  {
    question: 'What’s different about Shrug V?',
    answer: `Three things. Shrug is now two partners: Niv Dror, who started it in 2017, and Dom Santry, a founder Shrug backed at Daisie.

The focus is sharper. We back founders taking big swings in massive industries that had gone stale: defense, space, energy, manufacturing, and the consumer brands taking shelf space from companies a hundred years older.

And the gifts we used to make by instinct are now a system, with a product of our own planned for Q3 2027.`,
  },
  {
    question: 'Why should a founder make room for a small fund?',
    // The wall is the group chat: on the site itself the link opens it
    answer:
      'Money is easy to find. What arrives with our check isn’t. We introduce founders to the people who change their odds: the next investor, the hardest hire, the customer they couldn’t reach, the name their market already knows. 56 of the 90 people on our wall at [shrug.vc](app:messages) describe an introduction we made. Double opt-in, always.',
  },
  {
    question: 'Do you lead rounds or take board seats?',
    answer:
      'Rarely. We look to be the second-largest check in an early round, and the one the founder made room for. We don’t usually sit on boards, so founders tell us more. We want to be the first call when something goes wrong, and when something goes right.',
  },
]

/** The question that says what has changed with the fund Shrug is on now. It is where "What’s New" leads:
 * in the menu of the desktop's mark, and in the phone's search. -1 once the question is gone or reworded,
 * and then neither offers it. */
export const WHATS_NEW = FAQS.findIndex((faq) => /\bdifferent about shrug v\b/i.test(faq.question))

// ---- Quoted elsewhere ----
//
// Two places on the site say a line of Shrug's that is in an answer above (the
// terminal's hidden file, the foot of a company's card on the phone). They
// read it from the answer, so that it is said once and in Shrug's words: when
// an answer is reworded they follow, and when it no longer says the thing
// they say nothing.

/** The words of a run of an answer, bare. */
const wordsOf = (parts: Inline[]) => parts.map((part) => (typeof part === 'string' ? part : 'em' in part ? part.em : 'struck' in part ? part.struck : part.label)).join('')

/** A list in one of the answers, found by the line that leads into it ("Our rules of engagement:"): its
 * lines as bare words, exactly as they are written. Empty where no answer has such a list. */
export function listUnder(lead: RegExp): string[] {
  for (const faq of FAQS) {
    const blocks = faq.answer ? answerBlocks(faq.answer) : []
    const at = blocks.findIndex((block) => block.kind === 'p' && lead.test(wordsOf(block.parts)))
    const list = at < 0 ? undefined : blocks[at + 1]
    if (list?.kind === 'list') return list.items.map(wordsOf)
  }
  return []
}

/** A sentence of one of the answers that says something (`says`), as bare words, exactly as it is
 * written. Null where no answer says it. */
export function sentenceSaying(says: RegExp): string | null {
  for (const faq of FAQS) {
    if (!faq.answer) continue
    // A sentence ends at a full stop that a space or the line's end follows: the one in "shrug.vc" ends nothing
    const sentences = answerWords(faq.answer)
      .split('\n')
      .flatMap((line) => line.match(/.*?[.!?]+(?=\s|$)|.+$/g) ?? [])
    const found = sentences.find((sentence) => says.test(sentence))
    if (found) return found.trim()
  }
  return null
}
