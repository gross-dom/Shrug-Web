import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type MouseEvent } from 'react'
import { CASE_STUDIES, caseDir, PUBLIC_CASE_STUDIES } from '../data/caseStudies'
import { FAQS, listUnder } from '../data/faqs'
import { COMPANY_OF, peopleOf } from '../data/founders'
import { PEOPLE, RELATION_LABEL } from '../data/people'
import { COMPANIES, VERTICALS } from '../data/portfolio'
import { ABOUT, reach, SITE } from '../data/site'
import { Prompt, Window } from '../kit/window'
import { ALIASES, APP_IDS, type AppId } from '../os/apps'
import { formatter } from '../os/dates'
import { dockPoint } from '../os/dom'
import { shrug } from '../os/shrug'
import { createStore, useStore } from '../os/store'
import { openApp, wm } from '../os/wm'
import { launchApp, showCompany, showReply } from '../os/launch'
import { openOnePager } from '../os/papers'
import { folded } from './fold'

// Case studies, in a terminal. Most are private: listing them works, reading
// one is refused, and the shell asks whether to request access. The ones
// anyone can read (src/data/caseStudies.ts) are listed with the rest: a yes, a
// `please` or reading one by name hands over the links to them. The shell
// never asks for anything it will not use: while Shrug has no address to write
// to (`reach` in src/data/site.ts) a yes is answered with the case studies
// that are public and the one-pager; once there is one, a yes hands over to
// the visitor's own mail or messages app. Nothing typed here is sent anywhere.
//
// It is a shell as far as a curious person will push it: help, ls, cat, open,
// whoami, whois, fortune, date, clear and a few more answer in character, an
// empty line is just an empty line, Up and Down walk what was typed and Tab
// finishes a word that has been started. There is no state to be stuck in: y
// and n are answers at any time, and n, cancel, exit and Escape always come
// back to the question.
//
// What it knows of people and companies it reads from the site's own lists:
// `whois` says who someone in the group chat is, or what a company in the
// portfolio does, and `fortune` is something one of them said, as they said
// it. Each ends in lines that go there: to the reply in the conversation, to
// the company in the portfolio.

/** Somewhere in the site a line goes when pressed: a company in the portfolio, a person's reply in the group chat, an app. */
type Place = { company: string } | { person: number } | { app: AppId }

type Line = { kind: 'cmd' | 'out' | 'err' | 'ask' | 'ok' | 'dim' | 'said'; text: string } | { kind: 'link'; text: string; href: string } | { kind: 'go'; text: string; to: Place }

const PATH = 'shrug:case-studies'
const dirs = CASE_STUDIES.map(caseDir)

/** What `ls` lists: the private case studies in Shrug's order, then the ones anyone can read. */
const listed = [...dirs, ...PUBLIC_CASE_STUDIES.map((study) => study.dir)]

/** A file that `ls` shows only when asked for everything (`ls -a`): Shrug's rules of engagement, each a
 * line, read from the answer in the FAQs that gives them (src/data/faqs.ts). It is there for as long as
 * the FAQs have the list. */
const RULES_FILE = '.rules'
const RULES = listUnder(/\brules\b/i)

/** Whether the rules file is what was named (`.rules`, `./.rules`). */
const rulesNamed = (arg: string) => RULES.length > 0 && arg.replace(/^\.\//, '') === RULES_FILE

/** As long as a line typed here can be: room for any command or address, and no more. */
export const LINE_MAX = 120

const QUESTION = 'do you want to request access? (y/n)'
const DENIED = 'permission denied. case studies are private.'

const intro: Line[] = [
  { kind: 'cmd', text: 'ls' },
  { kind: 'out', text: listed.join('  ') },
  { kind: 'cmd', text: `cat ${dirs[0]}README` },
  { kind: 'err', text: DENIED },
  { kind: 'ask', text: QUESTION },
]

interface Term {
  /** ask: a y/n question is waiting for its answer. free: it has had one. Either way every command works. */
  step: 'ask' | 'free'
  /** Everything said since the listing at the top. */
  log: Line[]
  /** What has been typed, oldest first, for Up and Down to walk. It outlives `clear`. */
  typed: string[]
}

/** Where the session has got to, and everything said so far. The phone's Case Studies screen reads and answers the same one. */
export const term = createStore<Term>({ step: 'ask', log: [], typed: [] })

/** Back to the listing and the question, as the terminal opens. */
export const startOver = () => term.set((t) => ({ step: 'ask', log: [], typed: t.typed }))

const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)

const out = (text: string): Line => ({ kind: 'out', text })

/** How many, as a word, for the few numbers it could be. */
const counted = (n: number) => ['no', 'one', 'two', 'three', 'four', 'five', 'six'][n] ?? String(n)

/** The case studies anyone can read, each as a line that opens it. */
const publicOnes = (lead: string): Line[] =>
  PUBLIC_CASE_STUDIES.length ? [out(`${lead}${counted(PUBLIC_CASE_STUDIES.length)} ${PUBLIC_CASE_STUDIES.length === 1 ? 'is' : 'are'} public:`), ...PUBLIC_CASE_STUDIES.map((study): Line => ({ kind: 'link', text: study.dir, href: study.url }))] : []

/** The way to Shrug as a line to press, in the terminal's own case. */
const wayOn = (): Line => {
  const way = reach('', 'Case study access')
  return { kind: 'link', text: way.kind === 'doc' ? 'read the one-pager' : way.label.toLowerCase(), href: way.href }
}

/** A yes. With an address to write to, the request is the visitor's own to send, from their own
 * mail or messages (`go`, in what `respond` gives back, opens it). With none there is nothing to ask
 * with, and nothing is said that would sound like a request taken: only what can be read now, and that
 * the rest cannot. */
function yes(): Line[] {
  const way = reach('', 'Case study access')
  if (way.kind === 'doc') {
    const open = publicOnes('')
    return [...open, out(`${open.length ? 'the rest aren’t. ' : ''}start with the one-pager:`), wayOn()]
  }
  return [{ kind: 'ok', text: way.kind === 'email' ? 'ok. over to your mail app.' : 'ok. over to your messages.' }, wayOn(), ...publicOnes('meanwhile, ')]
}

const no = (question: string): Line[] => [out('ok. they’ll be here.'), { kind: 'ask', text: question }]

/** The apps `open` knows, by the names a person would try. */
const OPENS: Record<string, AppId> = { ...Object.fromEntries(APP_IDS.map((id) => [id, id])), ...ALIASES, about: 'about' }
const OPEN_HINT = 'portfolio, faqs, vip, chat, about'

/** A case study that is public, if that is what was named (`alt`, `lula/README`). */
const publicNamed = (arg: string) => PUBLIC_CASE_STUDIES.find((study) => arg.replace(/^\.?\//, '').split('/')[0] === study.dir.slice(0, -1))

/** What help lists. Each line fits a phone held upright without turning over: a turned line reads as two commands. */
const HELP: Line[] = [
  out('y, n          answer the question'),
  out('ls            list the case studies'),
  out('cat <name>    try to read one'),
  out('please        ask nicely'),
  out('open <app>    try: open portfolio'),
  out('whois <name>  a person, or a company'),
  out('fortune       something one of them said'),
  out('whoami        who is asking'),
  out('date          the time in san francisco'),
  out('clear         start over'),
]

// ---- The people and the companies, as the shell knows them ----

/** A company in the portfolio that a private case study is of, by the case study's directory (`varda/`):
 * the one of that name. Not every case study is of a portfolio company. */
const companyFiled = (dir: string) => {
  const study = CASE_STUDIES.find((name) => caseDir(name) === dir)
  return study ? (COMPANIES.find((company) => company.name === study) ?? null) : null
}

/** A private case study, if that is what was named (`varda`, `eight-sleep/README`): its directory. */
const privateNamed = (arg: string) => dirs.find((dir) => arg.replace(/^\.?\//, '').split('/')[0] === dir.slice(0, -1)) ?? null

/** The line that goes to a company in the portfolio, and the one that goes to a person's reply. */
const toCompany = (key: string): Line => ({ kind: 'go', text: `${COMPANIES.find((company) => company.key === key)?.name ?? key} in the portfolio`, to: { company: key } })
const toReply = (person: number): Line => ({ kind: 'go', text: `${PEOPLE[person]!.name} in the chat`, to: { person } })

/** The replies short enough to be a fortune: a few lines at most, as the ones a terminal hands out are. */
const FORTUNES = PEOPLE.map((person, index) => ({ person, index })).filter(({ person }) => !!person.quote && person.quote.length <= 220)
let lastFortune = -1

/** Something one of the people in the group said, exactly as they said it, and who said it. Never the same one twice running. */
function fortune(): Line[] {
  if (!FORTUNES.length) return [out('nobody has said anything yet.')]
  let at = Math.floor(Math.random() * FORTUNES.length)
  if (at === lastFortune) at = (at + 1) % FORTUNES.length
  lastFortune = at
  const { person, index } = FORTUNES[at]!
  return [out(person.quote!), out(`    — ${person.name}, ${person.role}`), toReply(index)]
}

/** How well a name answers what was typed (both folded): the whole of it, its start, the start of one of
 * its words, or somewhere in it. Lower is better; -1 is not at all. */
function named(name: string, q: string) {
  if (name === q) return 0
  if (name.startsWith(q)) return 1
  if (name.split(/[^\p{L}\p{N}]+/u).some((word) => word.startsWith(q))) return 2
  return q.length > 2 && name.includes(q) ? 3 : -1
}

const SELF = ['shrug', 'shrug capital', 'shrug v', 'us', 'you']

/** Who someone is, or what a company does, from the site's own lists: the best answer to the name, and
 * the names of the others it could have meant. */
function whois(arg: string): { lines: Line[]; lost?: boolean } {
  const q = folded(arg.trim())
  if (!q || SELF.includes(q))
    return { lines: [out(SITE.line), ...ABOUT.facts.map((fact) => out(`${fact.label.toLowerCase().padEnd(10)}${fact.value}`)), { kind: 'go', text: 'about shrug', to: { app: 'about' } }] }
  const found = [
    ...PEOPLE.map((person, index) => ({ how: named(folded(person.name), q), name: person.name, person: index as number | null, company: null as string | null })),
    ...COMPANIES.map((company) => ({ how: named(folded(company.name), q), name: company.name, person: null as number | null, company: company.key as string | null })),
  ]
    .filter((one) => one.how >= 0)
    .sort((a, b) => a.how - b.how)
  const best = found[0]
  if (!best) return { lines: [{ kind: 'err', text: `whois: nobody here called ${arg.trim()}.` }, { kind: 'dim', text: 'the people are in the chat, the companies in the portfolio.' }], lost: true }
  const others = found.slice(1, 6).map((one) => one.name)
  const also: Line[] = others.length ? [{ kind: 'dim', text: `also: ${others.join(', ')}${found.length > 6 ? ', …' : ''}` }] : []
  if (best.person !== null) {
    const person = PEOPLE[best.person]!
    const theirs = COMPANY_OF[best.person]
    return { lines: [out(person.name), out(person.role), ...(person.relations.length ? [out(person.relations.map((r) => RELATION_LABEL[r].toLowerCase()).join(', '))] : []), toReply(best.person), ...(theirs ? [toCompany(theirs)] : []), ...also] }
  }
  const company = COMPANIES.find((one) => one.key === best.company)!
  return { lines: [out(company.name), out(company.vertical), ...(company.blurb ? [out(company.blurb)] : []), toCompany(company.key), ...peopleOf(company.key).map(toReply), ...also] }
}

/** The site, counted: what a terminal prints of the machine it is on, of this one. Every figure is read from the lists. */
const counts = (): Line[] => [
  out(SITE.mark),
  out(SITE.legalName.toLowerCase()),
  out('people     ' + `${PEOPLE.length} in the group chat`),
  // (as About says it: the fund has backed more than the portfolio here lists)
  out('portfolio  ' + `100+ companies, ${VERTICALS.length} verticals`),
  out('faqs       ' + `${FAQS.length}`),
  out('studies    ' + `${CASE_STUDIES.length} private, ${PUBLIC_CASE_STUDIES.length} public`),
  out('shell      please'),
]

// ---- Tab ----

/** The words a line can begin with, as Tab finishes them: the ones help lists, and the few it leaves to be found. */
const COMMANDS = ['cat', 'cd', 'clear', 'date', 'echo', 'exit', 'fortune', 'help', 'ls', 'neofetch', 'open', 'please', 'pwd', 'whoami', 'whois']
const READS = ['cat', 'less', 'more', 'head', 'tail', 'vi', 'vim', 'nano']
const OPEN_NAMES = ['portfolio', 'faqs', 'vip', 'chat', 'about', 'wallpapers', 'one-pager']
const WHO = [...PEOPLE.map((person) => folded(person.name)), ...COMPANIES.map((company) => folded(company.name))]

/** What the word being typed could be finished as: `head` is everything typed before it. */
function candidates(head: string[], word: string): string[] {
  if (!head.length) return COMMANDS
  const command = head[0]!
  if (command === 'whois') return WHO
  const files = word.includes('/') ? listed.map((dir) => `${dir}README`) : [...(word.startsWith('.') && RULES.length ? [RULES_FILE] : []), ...listed]
  if (READS.includes(command) || command === 'ls' || command === 'cd') return files
  if (command === 'open') return word.includes('/') ? files : [...OPEN_NAMES, ...listed]
  return []
}

/** What Tab makes of a line, as a shell's does: the word being typed is finished if only one thing begins
 * that way, taken as far as they all agree if several do, and when that gets it no further `among` is the
 * several. Where nothing begins that way the line is left as it is. Null only where nothing has been
 * typed: Tab is then the page's own. */
export function completed(line: string): { line: string; among: string[] } | null {
  if (!line.trim()) return null
  const low = line.toLowerCase().replace(/^\s+/, '')
  const first = low.split(/\s+/)[0]!
  // A name can be several words: for whois, all that follows it is the word
  const cut = first === 'whois' && low.length > first.length ? first.length + 1 : low.lastIndexOf(' ') + 1
  const head = low.slice(0, cut).trim().split(/\s+/).filter(Boolean)
  const word = folded(low.slice(cut))
  const fits = [...new Set(candidates(head, word).filter((one) => one.startsWith(word)))]
  if (!fits.length) return { line, among: [] }
  // As far as they all agree
  let shared = fits[0]!
  for (const one of fits) while (!one.startsWith(shared)) shared = shared.slice(0, -1)
  const whole = fits.length === 1
  // A directory has more to come after it, and so has a word that could still be one of several
  const next = low.slice(0, cut) + shared + (whole && !shared.endsWith('/') ? ' ' : '')
  return { line: next, among: whole || shared.length > word.length ? [] : fits }
}

let sanFrancisco: Intl.DateTimeFormat | undefined

/** The day and the time in San Francisco, where the desk's widget keeps its clock: the day as the menu
 * bar writes one (Wed 18 Nov), the time on the visitor's own kind of clock, and all of it in the
 * terminal's lower case. */
function dateThere() {
  sanFrancisco ??= formatter({ weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' })
  const of = Object.fromEntries(sanFrancisco.formatToParts(new Date()).map((part) => [part.type, part.value]))
  return `${of.weekday} ${of.month} ${of.day}, ${of.hour}:${of.minute}${of.dayPeriod ? ` ${of.dayPeriod}` : ''} in san francisco.`.toLowerCase()
}

/** What a line typed into the shell gets back, and what it does besides saying it. `lost` is a command
 * the shell does not know: the desk has nothing for it, and its mark shrugs. */
function respond(value: string, step: Term['step']): { lines: Line[]; step?: Term['step']; clear?: boolean; open?: AppId; show?: Place; go?: string; lost?: boolean } {
  const low = value.toLowerCase()
  const [word = '', ...rest] = low.split(/\s+/)
  const arg = rest.join(' ')

  // An empty line is an empty line
  if (!value) return { lines: [] }

  if (low === 'y' || low === 'yes' || low === 'yep' || low === 'yeah') {
    const way = reach('', 'Case study access')
    return { lines: yes(), step: 'free', go: way.kind === 'doc' ? undefined : way.href }
  }
  if (low === 'n' || low === 'no' || low === 'nope') return { lines: no('changed your mind? (y/n)'), step: 'ask' }
  // Every way of backing out comes back to the question
  if (['cancel', 'back', 'exit', 'quit', 'q', 'logout', 'bye', ':q', ':q!'].includes(low)) return { lines: no(QUESTION), step: 'ask' }

  // An address typed in the hope it is what was wanted: it is not kept, and it is said so, with where it could go
  if (isEmail(value)) {
    const way = reach('', 'Case study access')
    if (way.kind === 'doc') return { lines: [out('we don’t take addresses here. that one stays with you.'), out('start with the one-pager:'), wayOn()] }
    return { lines: [out('we don’t take addresses here. write from your own:'), wayOn()] }
  }

  switch (word) {
    case 'help':
    case '?':
    case 'man':
      return { lines: HELP }
    case 'ls':
    case 'll':
    case 'dir': {
      // Asked for everything (-a, -la, --all), the listing has the file it otherwise leaves out, first as ls has them
      const all = RULES.length > 0 && rest.some((flag) => /^-\w*a|^--all$/.test(flag))
      return { lines: [out([...(all ? [RULES_FILE] : []), ...listed].join('  '))] }
    }
    case 'cat':
    case 'less':
    case 'more':
    case 'head':
    case 'tail':
    case 'vi':
    case 'vim':
    case 'nano': {
      if (!arg) return { lines: [out(`${word}: which one? try: ${word} ${dirs[0]}README`)] }
      // The rules are Shrug's own words, a line each as the FAQs have them: said as written, not in the shell's lower case
      if (rulesNamed(arg)) return { lines: RULES.map(out) }
      const open = publicNamed(arg)
      if (open) return { lines: [out(`${open.dir} is public:`), { kind: 'link', text: open.dir, href: open.url }] }
      return { lines: [{ kind: 'err', text: DENIED }, { kind: 'ask', text: QUESTION }], step: 'ask' }
    }
    case 'open': {
      if (!arg) return { lines: [out(`open: what? ${OPEN_HINT}.`)] }
      const name = arg.replace(/\s+/g, '-')
      if (rulesNamed(arg)) return { lines: RULES.map(out) }
      const study = publicNamed(arg)
      if (study) return { lines: [out(`${study.dir} is public:`), { kind: 'link', text: study.dir, href: study.url }] }
      if (name === 'one-pager' || name === 'onepager') return { lines: [{ kind: 'link', text: 'read the one-pager', href: SITE.onePager }] }
      // On the desktop the stores are windows, and open as any app does. A phone has no such apps yet: there
      // each is the store's own page for it, handed over as the one-pager is, a line to press that opens in a
      // tab of its own. (VIP, which was a link to the old points site, is all three of them now.)
      if (wm.get().compact) {
        const shops = name === 'vip' || OPENS[name] === 'myvip' ? SITE.stores : SITE.stores.filter((shop) => shop.app === OPENS[name])
        if (shops.length) return { lines: [out(shops.length > 1 ? 'the stores open in a tab of their own:' : `${shops[0]!.name.toLowerCase()} opens in a tab of its own:`), ...shops.map((shop): Line => ({ kind: 'link', text: `open ${shop.name.toLowerCase()}`, href: shop.href }))] }
      }
      const app = OPENS[name]
      if (app === 'terminal') return { lines: [out('you’re in it.')] }
      // The wallpapers are the desktop's: a phone has one of its own, and no folder of them
      if (app === 'wallpapers' && wm.get().compact) return { lines: [out('the wallpapers are on the desktop. try this on a bigger screen.')] }
      if (app) return { lines: [{ kind: 'ok', text: `opening ${arg}.` }], open: app }
      // One the listing shows and nobody may read: what can be opened is the company itself, where it is in the portfolio
      const shut = privateNamed(arg)
      const company = shut && companyFiled(shut)
      if (shut && company) return { lines: [out(`${shut} is private. here’s ${company.name} in the portfolio.`)], show: { company: company.key } }
      if (shut) return { lines: [{ kind: 'err', text: DENIED }, { kind: 'ask', text: QUESTION }], step: 'ask' }
      return { lines: [{ kind: 'err', text: `open: nothing called ${arg}. try ${OPEN_HINT}.` }] }
    }
    case 'whoami':
      return { lines: [out('a founder, probably.')] }
    case 'whois':
    case 'who':
    case 'finger':
      return whois(arg)
    case 'fortune':
      return { lines: fortune() }
    case 'neofetch':
    case 'fastfetch':
    case 'uname':
      return { lines: counts() }
    case 'date':
      return { lines: [out(dateThere())] }
    case 'please':
      // Asked nicely, as the app's label in the Dock says to: what can be read is handed over. With nothing
      // public there is nothing to hand over, and the word is no command
      if (PUBLIC_CASE_STUDIES.length) return { lines: publicOnes('since you asked nicely. ') }
      break
    case 'pwd':
      return { lines: [out(PATH)] }
    case 'cd':
      return { lines: [out('there’s nowhere else to go. it’s all in here.')] }
    case 'sudo':
      return { lines: [{ kind: 'err', text: 'nice try.' }] }
    case 'echo':
      return { lines: [out(value.slice(4).trim())] }
    case 'clear':
    case 'cls':
    case 'reset':
      return { lines: [], clear: true }
    case 'hi':
    case 'hello':
    case 'hey':
      return { lines: [out('hi.')] }
    case 'thanks':
    case 'thank':
      return { lines: [out('any time.')] }
    case 'shrug':
      return { lines: [out('that’s us.')] }
  }
  return { lines: [{ kind: 'err', text: `command not found: ${word}` }, { kind: 'dim', text: step === 'ask' ? 'y or n answers the question. help lists the rest.' : 'help lists what there is.' }], lost: true }
}

/** Opens an app from the shell: its window on the desktop, the app itself on the phone. Everything `open`
 * knows opens something on both: About Shrug, which the phone has no app for, is Shrug's own card in
 * Contacts there (`launchApp`). */
function openIt(app: AppId) {
  if (wm.get().compact) launchApp(app)
  else openApp(app, dockPoint(app))
}

/** Goes where a line of the terminal's leads: a company in the portfolio, a reply in the conversation, an app. */
function goTo(to: Place) {
  if ('company' in to) showCompany(to.company)
  else if ('person' in to) showReply(to.person)
  else launchApp(to.app)
}

/** Answers a line typed into the terminal (or a key pressed for it). Both layouts call this one. */
export function answer(raw: string) {
  const value = raw.trim().slice(0, LINE_MAX)
  const reply = respond(value, term.get().step)
  term.set((t) => {
    const typed = value && t.typed[t.typed.length - 1] !== value ? [...t.typed, value] : t.typed
    if (reply.clear) return { step: 'ask', log: [], typed }
    return { step: reply.step ?? t.step, log: [...t.log, { kind: 'said', text: value }, ...reply.lines], typed }
  })
  if (reply.open) openIt(reply.open)
  if (reply.show) goTo(reply.show)
  if (reply.lost) shrug()
  // The request is the visitor's own to send: their mail or messages app opens on it
  if (reply.go) window.location.href = reply.go
}

/** Escape with nothing typed: back to the question, if it is not what the terminal is already waiting on. */
export function backToQuestion() {
  term.set((t) => {
    const last = t.log[t.log.length - 1]
    if (t.step === 'ask' && (!last || last.kind === 'ask')) return t
    return { ...t, step: 'ask', log: [...t.log, { kind: 'ask', text: QUESTION }] }
  })
}

/** The line being typed, with what a shell gives it: Return sends it, Up and Down walk what was
 * typed before, and Escape empties it. `onEscape` is what Escape does once it is empty. */
export function useLine(onEscape?: () => void) {
  const [typed, setTyped] = useState('')
  /** How far back Up has gone (0 is the last thing typed), and what was being typed before it went. */
  const back = useRef<{ at: number; draft: string } | null>(null)

  const say = (text: string) => {
    back.current = null
    setTyped('')
    answer(text)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      if (typed) {
        // The line is what Escape lets go of first; nothing else hears this one
        e.preventDefault()
        back.current = null
        setTyped('')
      } else onEscape?.()
      return
    }
    // Tab finishes the word being typed, as a shell's does, and with a line under way it never takes the
    // keyboard elsewhere. With nothing typed it is the page's own key and moves on (and Escape empties a
    // line): the terminal is never somewhere the keyboard cannot leave
    if (e.key === 'Tab' && !e.shiftKey && !e.altKey && !e.metaKey && !e.ctrlKey) {
      const done = completed(typed)
      if (!done) return
      e.preventDefault()
      back.current = null
      setTyped(done.line.slice(0, LINE_MAX))
      // Several it could be, and no further to take it: they are listed, as a shell lists them
      if (done.among.length) {
        const few = done.among.slice(0, 12)
        const more = done.among.length - few.length
        term.set((t) => ({ ...t, log: [...t.log, { kind: 'dim', text: few.join('  ') + (more > 0 ? `  … ${more} more` : '') }] }))
      }
      return
    }
    if ((e.key !== 'ArrowUp' && e.key !== 'ArrowDown') || e.altKey || e.metaKey || e.ctrlKey) return
    const past = term.get().typed
    if (!past.length) return
    e.preventDefault()
    const now = back.current
    if (e.key === 'ArrowUp') {
      const at = now ? Math.min(now.at + 1, past.length - 1) : 0
      back.current = { at, draft: now ? now.draft : typed }
      setTyped(past[past.length - 1 - at]!)
    } else if (now) {
      // Down past the newest is what was being typed when Up was first pressed
      if (now.at === 0) {
        back.current = null
        setTyped(now.draft)
      } else {
        back.current = { ...now, at: now.at - 1 }
        setTyped(past[past.length - now.at]!)
      }
    }
  }

  const onChange = (value: string) => {
    back.current = null
    setTyped(value.slice(0, LINE_MAX))
  }

  /** Puts `text` at the end of the line, as if typed: for a key pressed before the line could take the keyboard. */
  const type = (text: string) => {
    back.current = null
    setTyped((now) => (now + text).slice(0, LINE_MAX))
  }

  return { typed, setTyped: onChange, type, say, onKeyDown }
}

const CLASS: Record<Exclude<Line['kind'], 'cmd' | 'link' | 'go'>, string | undefined> = { out: undefined, err: 'err', ask: 'ask', ok: 'ok', dim: 'dim', said: 'said' }

/** A line that goes somewhere: a case study, the one-pager, the visitor's own mail. */
function LinkLine({ text, href }: { text: string; href: string }) {
  const page = /^https?:/.test(href)
  const compact = useStore(wm, (s) => s.compact)
  // On the desktop the one-pager is a file, and opens in Preview: nothing leaves for a tab of its own
  if (href === SITE.onePager && !compact)
    return (
      <div className="term__go">
        <button type="button" className="term__link" onClick={openOnePager}>
          {text}
        </button>
      </div>
    )
  return (
    <div className="term__go">
      <a
        className="term__link"
        href={href}
        // The one-pager is on someone else's site and is told nothing of where the visit came from; Shrug's own pages are
        {...(page ? { target: '_blank', rel: href.startsWith(SITE.onePager) ? 'noreferrer' : 'noopener' } : null)}
      >
        {text}
        {page && <span className="sr-only">, in a new tab</span>}
      </a>
    </div>
  )
}

/** A line that goes somewhere in the site: a company in the portfolio, a reply in the conversation. */
function GoLine({ text, to }: { text: string; to: Place }) {
  return (
    <div className="term__go">
      <button type="button" className="term__link" onClick={() => goTo(to)}>
        {text}
      </button>
    </div>
  )
}

/** Everything the terminal has printed, top to bottom. */
export function TerminalLog() {
  const log = useStore(term, (t) => t.log)
  return (
    <div className="term__log" role="log" aria-live="polite" aria-label="Case studies terminal">
      {[...intro, ...log].map((line, i) =>
        line.kind === 'cmd' ? (
          <Prompt key={i} path={PATH}>
            {line.text}
          </Prompt>
        ) : line.kind === 'link' ? (
          <LinkLine key={i} text={line.text} href={line.href} />
        ) : line.kind === 'go' ? (
          <GoLine key={i} text={line.text} to={line.to} />
        ) : (
          <div key={i} className={CLASS[line.kind]}>
            {line.kind === 'said' ? `> ${line.text}`.trimEnd() : line.text}
          </div>
        ),
      )}
    </div>
  )
}

/** A press on the terminal that is not on something of its own (a link, a key) and has not just selected text. */
export const bareClick = (e: MouseEvent) => !(e.target as HTMLElement).closest('a, button') && !window.getSelection()?.toString()

/** The terminal itself, without a window round it: the log and the line being typed. */
export function TerminalScreen() {
  const step = useStore(term, (t) => t.step)
  const lines = useStore(term, (t) => t.log.length)
  const { typed, setTyped, say, onKeyDown } = useLine(backToQuestion)
  const input = useRef<HTMLInputElement>(null)
  const screen = useRef<HTMLFormElement>(null)

  // New output keeps the last line in view, as a terminal does
  useEffect(() => {
    const el = screen.current
    if (el) el.scrollTop = el.scrollHeight
  }, [lines, step])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    say(typed)
  }

  /** A key for a finger: it answers without taking the caret (and the keyboard) from the line. */
  const key = (label: string, text: string, name: string) => (
    <button
      type="button"
      className="term__key"
      aria-label={name}
      onMouseDown={(e) => e.preventDefault()}
      onClick={(e) => {
        // Pressed from the keyboard it has the focus, and is about to be swapped for another key: the line takes it
        const focused = document.activeElement === e.currentTarget
        say(text)
        if (focused) input.current?.focus({ preventScroll: true })
      }}
    >
      {label}
    </button>
  )

  return (
    <form
      ref={screen}
      className="term__screen scrolls"
      noValidate
      onSubmit={submit}
      // A click anywhere in the terminal types into it. On the click and not on the press: after a
      // finger's press the browser sends a mouse press of its own, which hands the caret to the window
      onClick={(e) => bareClick(e) && input.current?.focus({ preventScroll: true })}
    >
      <TerminalLog />
      <label className="term__entry">
        <span aria-hidden>&gt;</span>
        <input
          ref={input}
          className="term__input"
          type="text"
          maxLength={LINE_MAX}
          data-autofocus
          aria-label={step === 'ask' ? 'Request access? y or n' : 'Terminal: help lists what can be typed'}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="send"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={onKeyDown}
        />
      </label>
      {/* Where there is a touch screen (the stylesheet shows these only there), nobody has to raise a keyboard to answer */}
      <div className="term__keys" role="group" aria-label={step === 'ask' ? 'Answer' : 'Commands'}>
        {step === 'ask' ? (
          <>
            {key('y', 'y', 'y: yes, request access')}
            {key('n', 'n', 'n: no')}
          </>
        ) : (
          <>
            {key('help', 'help', 'help: what can be typed')}
            {key('clear', 'clear', 'clear: start over')}
          </>
        )}
      </div>
    </form>
  )
}

export function TerminalApp() {
  return (
    <Window className="term" chrome="terminal" lightsSize="large" title="shrug — case-studies" body={{ className: 'term__body' }}>
      <TerminalScreen />
    </Window>
  )
}
