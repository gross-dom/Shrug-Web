import { DROPS } from '../data/drops'
import { EGGS } from '../data/eggs'
import { FAQS } from '../data/faqs'
import { COMPANIES } from '../data/portfolio'
import { SITE } from '../data/site'
import { albumView, companySheet, conversationView, FAQS_FOLDER, noteView, PORTFOLIO_FOLDER } from '../phone/apps/routes'
import { ALIASES, APP_IDS, type AppId } from './apps'

// Where a visitor is, as an address says it: `?open=portfolio&at=varda` is the
// portfolio with Varda open, `?open=faqs&at=4` the fourth question. The address
// is kept in step with the visitor on both layouts (the iPhone as it moves
// through history, src/phone/system.ts; the desktop as its front window
// changes, src/os/Desktop.tsx), so the link in the address bar, or one passed on
// with Share, opens where they were. Whatever else the address carries
// (`?phone`, `?draft`) is left as it was.

/** An app, and what is open in it: a company, a question, a conversation, a drop. */
export interface Spot {
  app: AppId
  at: string | null
}

/** The name each app goes by in an address. */
const NAMES: Record<AppId, string> = { messages: 'chat', finder: 'portfolio', notes: 'faqs', terminal: 'case-studies', photos: 'vip', about: 'about' }

/** A name as an address writes it: "Eight Sleep" is eight-sleep. */
export const slug = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

// ---- What `at` names in each app, and back. Something that names nothing is nothing: the app opens where it would have. ----

export const companyAt = (at: string | null) => (at ? (COMPANIES.find((company) => slug(company.key) === slug(at))?.key ?? null) : null)

/** A question by its number, counted from one as a reader would. */
export const questionAt = (at: string | null) => {
  const index = at && /^\d+$/.test(at) ? Number(at) - 1 : -1
  return index >= 0 && index < FAQS.length ? index : null
}

/** One of the conversations beside the group, by its id. */
export const conversationAt = (at: string | null) => (at && EGGS.some((egg) => egg.id === at.toLowerCase()) ? at.toLowerCase() : null)

export const dropAt = (at: string | null) => (at ? (DROPS.find((drop) => slug(drop) === slug(at)) ?? null) : null)

export const atCompany = (key: string | null) => (key ? slug(key) : null)
export const atQuestion = (index: number | null) => (index === null ? null : String(index + 1))
export const atConversation = (id: string | null) => (id && id !== 'group' ? id : null)
export const atDrop = (drop: string | null) => (drop ? slug(drop) : null)

// ---- The iPhone: its place (the app in front, the screens it is on, a sheet) as a spot, and back ----

interface PhonePlace {
  app: AppId | null
  stacks: Record<AppId, string[]>
  sheet: string | null
}

const innermost = (stack: string[], kind: string) => [...stack].reverse().find((view) => view.startsWith(kind))?.slice(kind.length) ?? null

export function spotOfPlace(place: PhonePlace): Spot | null {
  const app = place.app
  if (!app) return null
  const stack = place.stacks[app]
  if (app === 'finder') return { app, at: atCompany(companyAt(place.sheet?.startsWith('company:') ? place.sheet.slice('company:'.length) : null)) }
  if (app === 'notes') {
    const note = innermost(stack, 'n:')
    return { app, at: note && /^\d+$/.test(note) && Number(note) < FAQS.length ? atQuestion(Number(note)) : null }
  }
  if (app === 'messages') return { app, at: atConversation(conversationAt(innermost(stack, 'c:'))) }
  if (app === 'photos') return { app, at: atDrop(dropAt(innermost(stack, 'a:'))) }
  return { app, at: null }
}

/** The screens an app is on at a spot (none given: as the app was left), and the sheet over them. */
export function placeOfSpot(spot: Spot): { stack?: string[]; sheet: string | null } {
  if (spot.app === 'messages') return { stack: [conversationView(conversationAt(spot.at) ?? 'group')], sheet: null }
  if (spot.app === 'finder') {
    const key = companyAt(spot.at)
    return { stack: [PORTFOLIO_FOLDER], sheet: key ? companySheet(key) : null }
  }
  if (spot.app === 'notes') {
    const question = questionAt(spot.at)
    return { stack: question === null ? [FAQS_FOLDER] : [FAQS_FOLDER, noteView(question)], sheet: null }
  }
  if (spot.app === 'photos') {
    const drop = dropAt(spot.at)
    return { stack: drop ? [albumView(drop)] : undefined, sheet: null }
  }
  return { sheet: null }
}

// ---- The address ----

/** This page has an address of its own to keep in step. One opened from a file, or held in a
 * sandboxed frame, has none it is allowed to change. */
export const addressable = () => typeof window !== 'undefined' && /^https?:$/.test(window.location.protocol)

const appNamed = (name: string) => {
  const id = ALIASES[name.toLowerCase()] ?? name.toLowerCase()
  return (APP_IDS as string[]).includes(id)
}

/** The page's path without a last part that names an app (`/portfolio`): the query says that from now on. */
function root(pathname: string) {
  const parts = pathname.split('/')
  const last = parts.filter(Boolean).pop()
  if (!last || !appNamed(safely(last))) return pathname
  const at = parts.lastIndexOf(last)
  return parts.slice(0, at).join('/') + '/'
}

function safely(text: string) {
  try {
    return decodeURIComponent(text)
  } catch {
    return ''
  }
}

const written = (pairs: [string, string][]) => {
  const text = pairs.map(([key, value]) => (value === '' ? encodeURIComponent(key) : `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)).join('&')
  return text ? `?${text}` : ''
}

const pairsOf = (spot: Spot | null): [string, string][] => (spot ? [['open', NAMES[spot.app]], ...(spot.at ? ([['at', spot.at]] as [string, string][]) : [])] : [])

/** This page's address with the spot in it, and every other switch it carries as it was. */
export function addressOf(spot: Spot | null) {
  const { pathname, search, hash } = window.location
  const others = [...new URLSearchParams(search)].filter(([key]) => !['open', 'at'].includes(key.toLowerCase()))
  // A hash that named an app has been read: the query says it now
  const tail = hash && appNamed(safely(hash.slice(1))) ? '' : hash
  return root(pathname) + written([...others, ...pairsOf(spot)]) + tail
}

/** A link to pass on: the site and the spot, with none of this page's other switches. */
export function linkTo(spot: Spot | null) {
  const site = addressable() ? window.location.origin + root(window.location.pathname) : SITE.url
  return site + written(pairsOf(spot))
}
