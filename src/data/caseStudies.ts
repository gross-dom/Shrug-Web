import { COMPANIES } from './portfolio'

// Case studies are private: the terminal lists them and asks for an access
// request instead of showing them.

export const CASE_STUDIES = ['Varda', 'RTFKT', 'Eight Sleep', 'Feastables', 'Superplastic', 'Superhuman']

export const caseDir = (name: string) => name.toLowerCase().split(' ').join('-') + '/'

/** The case studies anyone can read: the companies whose link in the portfolio
 * is their case study (a page of Shrug's own on Notion) and not their site.
 * The two lists are kept apart on purpose: a private case study need not be
 * of a portfolio company, and a public one is not listed among the private. */
export const PUBLIC_CASE_STUDIES = COMPANIES.filter((company) => company.url?.startsWith('https://shrug.notion.site/'))
  .map((company) => ({ name: company.name, dir: caseDir(company.name), url: company.url! }))
  .sort((a, b) => a.name.localeCompare(b.name))
