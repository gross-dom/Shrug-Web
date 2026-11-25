import { COMPANIES, VERTICALS, type Company } from '../data/portfolio'
import { createStore, useStore } from '../os/store'
import { folded } from './fold'

// What the Portfolio window and the phone's Portfolio screen share: every
// company in Shrug's order, its logo as an icon, and where its icon opens.

/** A company as the windows list it: every company carries its vertical, so it is the company itself. */
export type Listed = Company

/** Every company, in the order Shrug lists them. */
export const ALL: Listed[] = COMPANIES

/** The company with this key. A key is the company's name, except where two companies share a name (see `key` in the data). */
export const companyKeyed = (key: string | null) => ALL.find((c) => c.key === key) ?? null

/** A search this short finds only what begins with it. Looked for anywhere, two or three letters turn up
 * inside words that have nothing to do with them: "AI" is in "Mountain", and once put a water company at
 * the head of the list. */
const SHORT = 3

/** Whether a word in `text` begins with `q` (which is folded already). A word begins at the start of the
 * text, after anything that is not a letter or a figure, and at a capital or a figure inside a name that
 * runs its words together (PlaygroundAI, Cloud23). */
function beginsWord(text: string, q: string) {
  const whole = folded(text)
  const apart = folded(text.replace(/[a-z](?=[A-Z])|[A-Za-z](?=[0-9])/g, '$& '))
  return [whole, apart].some((words) => {
    for (let at = words.indexOf(q); at >= 0; at = words.indexOf(q, at + 1)) if (at === 0 || !/[a-z0-9]/.test(words[at - 1]!)) return true
    return false
  })
}

/** Whether a company answers a search (`asked`: trimmed): by its name, its vertical or what it does. Both
 * are read as a search reads words (src/apps/fold.ts): a blurb is typeset, and "world's" typed on a keyboard
 * finds the "world’s" in it. It is the one rule for every place the companies are searched: the window's
 * field, the search in Contacts, and the phone's own search. */
export function companyAnswers(company: Company, asked: string) {
  const q = folded(asked)
  const has = q.length <= SHORT ? (text: string) => beginsWord(text, q) : (text: string) => folded(text).includes(q)
  return has(company.name) || has(company.vertical) || has(company.blurb ?? '')
}

/** The companies showing: one vertical or all of them, narrowed by a search. They stay in the order of the list. */
export function companiesIn(vertical: number, query: string) {
  const q = query.trim().toLowerCase()
  const base = vertical === -1 ? ALL : ALL.filter((c) => c.vertical === VERTICALS[vertical]!.name)
  return q ? base.filter((c) => companyAnswers(c, q)) : base
}

// A logo that did not arrive (the line dropped as the folder was opened, say)
// is not left as the browser's broken picture: its company stands as a letter
// tile, like the ones with no logo at all, until the line is back. Then each
// is asked for again.
const missing = createStore<ReadonlySet<string>>(new Set())

if (typeof window !== 'undefined') window.addEventListener('online', () => missing.set((gone) => (gone.size ? new Set() : gone)))

const noteMissing = (logo: string) => missing.set((gone) => (gone.has(logo) ? gone : new Set(gone).add(logo)))

/** A company's logo as a picture to draw: where it is, and what to do if it does not arrive. null for a
 * company with no logo, and for one whose file did not arrive (it is asked for again when the line is back). */
export function useLogo(company: Company) {
  const logo = company.logo
  const gone = useStore(missing, (s) => !!logo && s.has(logo))
  return logo && !gone ? { src: `${import.meta.env.BASE_URL}logos/${logo}`, onError: () => noteMissing(logo) } : null
}

/** The logos that have been fetched ahead of being shown, kept so that the browser keeps them too. */
const warmed: HTMLImageElement[] = []
let warming = false

/** Fetches every company's logo ahead of its being shown, a few at a time and only while nothing else is
 * going on, so that a list of companies opens with its pictures in it instead of filling in row by row.
 * Not for a visitor who has asked their browser to save data. */
export function warmLogos() {
  if (warming || typeof window === 'undefined') return
  if ((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData) return
  warming = true
  const files = [...new Set(COMPANIES.map((company) => company.logo).filter((logo): logo is string => !!logo))]
  const idle = (run: () => void) => ('requestIdleCallback' in window ? window.requestIdleCallback(run, { timeout: 1500 }) : setTimeout(run, 200))
  let at = 0
  const some = () => {
    for (const logo of files.slice(at, at + 6)) {
      const image = new Image()
      image.decoding = 'async'
      image.src = `${import.meta.env.BASE_URL}logos/${logo}`
      warmed.push(image)
    }
    at += 6
    if (at < files.length) idle(some)
  }
  idle(some)
}

/** A company's logo as an app icon: its own mark on a rounded tile, or its
 * initial where no logo could be confirmed, or where the file did not arrive.
 * A logo is asked for when it comes into sight; `eager` asks for it at once,
 * for one that is wanted the moment it is shown (the face at the head of a
 * company's card). */
export function CompanyLogo({ company, size = 56, eager }: { company: Company; size?: number; eager?: boolean }) {
  const logo = company.logo
  const gone = useStore(missing, (s) => !!logo && s.has(logo))
  const shown = logo && !gone
  return (
    <span className="logo" data-empty={shown ? undefined : ''} style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }} aria-hidden>
      {shown ? (
        <img
          src={`${import.meta.env.BASE_URL}logos/${logo}`}
          // (drawn large on a sharp screen, the small file would be soft: the larger one is asked for there, where a logo has one)
          srcSet={company.logoLarge && size >= 80 ? `${import.meta.env.BASE_URL}logos/${logo} 1x, ${import.meta.env.BASE_URL}logos/large/${company.logoLarge} 2x` : undefined}
          width={size}
          height={size}
          alt=""
          loading={eager ? 'eager' : 'lazy'} decoding={eager ? 'sync' : 'async'} draggable={false} onError={() => noteMissing(logo)} />
      ) : (
        company.name.trim()[0]?.toUpperCase()
      )}
    </span>
  )
}

/** A link's host, as it reads in a status bar: no scheme, no www. */
export function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/** What the link to a company is called: its address, or its Shrug case study. */
export const visitLabel = (company: Company) => (!company.url ? null : /notion\.site/.test(company.url) ? 'Read the case study' : `Visit ${hostOf(company.url)}`)

/** For a company with nowhere to send a visitor: what Shrug has written of what became of it (`note` in the
 * data), which stands where its link would be. Null for one that has a site, and for one with neither: that
 * company has no website area at all, and nothing is said in its place. */
export const fateOf = (company: Company) => (company.url ? null : company.note)

/** Two companies can have one name (there are two called Atoms). Where both show, each says which it is. */
export const namesake = (company: Company) => ALL.some((other) => other !== company && other.name === company.name)

/** What tells a company from another of the same name: its site's address. Empty for a company whose name is its own. */
export const tellApart = (company: Company) => (namesake(company) && company.url ? hostOf(company.url) : '')

/** Opens a company's site in a new tab, where it has one. The company it opens for can see where the
 * visit came from (`noopener` alone: the page that opens is still told who sent it). Says whether anything opened. */
export function openCompany(company: Company) {
  if (!company.url) return false
  window.open(company.url, '_blank', 'noopener')
  return true
}
