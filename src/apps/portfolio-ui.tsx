import { COMPANIES, VERTICALS, type Company } from '../data/portfolio'

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

/** A company's logo as an app icon: its own mark on a rounded tile, or its
 * initial where no logo could be confirmed. */
export function CompanyLogo({ company, size = 56 }: { company: Company; size?: number }) {
  return (
    <span className="logo" data-empty={company.logo ? undefined : ''} style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }} aria-hidden>
      {company.logo ? <img src={`${import.meta.env.BASE_URL}logos/${company.logo}`} width={size} height={size} alt="" loading="lazy" decoding="async" draggable={false} /> : company.name.trim()[0]?.toUpperCase()}
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

export function openCompany(company: Company) {
  if (company.url) window.open(company.url, '_blank', 'noopener,noreferrer')
}
