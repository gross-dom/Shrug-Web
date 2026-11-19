import { COMPANIES, VERTICALS, type Company } from '../data/portfolio'
import { createStore, useStore } from '../os/store'

// What the Portfolio window and the phone's Portfolio screen share: every
// company in Shrug's order, its logo as an icon, and where its icon opens.

/** A company as the windows list it: every company carries its vertical, so it is the company itself. */
export type Listed = Company

/** Every company, in the order Shrug lists them. */
export const ALL: Listed[] = COMPANIES

/** The company with this key. A key is the company's name, except where two companies share a name (see `key` in the data). */
export const companyKeyed = (key: string | null) => ALL.find((c) => c.key === key) ?? null

/** The companies showing: one vertical or all of them, narrowed by a search. They stay in the order of the list. */
export function companiesIn(vertical: number, query: string) {
  const q = query.trim().toLowerCase()
  const base = vertical === -1 ? ALL : ALL.filter((c) => c.vertical === VERTICALS[vertical]!.name)
  return q ? base.filter((c) => c.name.toLowerCase().includes(q) || c.vertical.toLowerCase().includes(q) || (c.blurb ?? '').toLowerCase().includes(q)) : base
}

// A logo that did not arrive (the line dropped as the folder was opened, say)
// is not left as the browser's broken picture: its company stands as a letter
// tile, like the ones with no logo at all, until the line is back. Then each
// is asked for again.
const missing = createStore<ReadonlySet<string>>(new Set())

if (typeof window !== 'undefined') window.addEventListener('online', () => missing.set((gone) => (gone.size ? new Set() : gone)))

const noteMissing = (logo: string) => missing.set((gone) => (gone.has(logo) ? gone : new Set(gone).add(logo)))

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
        <img src={`${import.meta.env.BASE_URL}logos/${logo}`} width={size} height={size} alt="" loading={eager ? 'eager' : 'lazy'} decoding="async" draggable={false} onError={() => noteMissing(logo)} />
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

/** What a company with no site says where its link would be, until Shrug has written what became of it (`note` in the data). */
export const NO_SITE = 'No website listed'

/** For a company with nowhere to send a visitor: the line that stands where its link would be. Null for one that has a site. */
export const fateOf = (company: Company) => (company.url ? null : (company.note ?? NO_SITE))

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
