import { ArrowUpRight } from 'lucide-react'
import { hostOf } from '../../apps/portfolio-ui'
import { ShrugAvatar } from '../../apps/ui'
import { CASE_STUDIES } from '../../data/caseStudies'
import { DROPS } from '../../data/drops'
import { FAQS } from '../../data/faqs'
import { PEOPLE } from '../../data/people'
import { COMPANY_COUNT, VERTICALS } from '../../data/portfolio'
import { SITE } from '../../data/site'
import '../../styles/phone/about.css'
import { launch, type PhoneApp } from '../system'
import { Cell, List, NavStack, Screen, Section } from '../ui'

// About Shrug, as Settings keeps About for a phone: who it is, then what is on
// it, as rows of counts. Every figure is counted from the site's own data, and
// each row opens the app it counts.

const FACTS: { label: string; value: number; app: PhoneApp }[] = [
  { label: 'Replies', value: PEOPLE.length, app: 'messages' },
  { label: 'Companies', value: COMPANY_COUNT, app: 'finder' },
  { label: 'Verticals', value: VERTICALS.length, app: 'finder' },
  { label: 'FAQs', value: FAQS.length, app: 'notes' },
  { label: 'Case Studies', value: CASE_STUDIES.length, app: 'terminal' },
  { label: 'Drops', value: DROPS.length, app: 'photos' },
]

/** A row that leaves the site says so with an arrow, where a row that stays has a chevron. */
const out = <ArrowUpRight className="about-out" size={18} strokeWidth={2.4} aria-hidden />

export function AboutApp() {
  return (
    <NavStack>
      {() => (
        <Screen title="About" large tone="grouped" className="about-screen">
          <div className="about-card">
            <ShrugAvatar size={64} />
            <div className="about-card__name">{SITE.legalName}</div>
            <div className="about-card__mark" aria-hidden>
              {SITE.mark}
            </div>
          </div>
          <List>
            <Section>
              <Cell title="Name" value={SITE.name} />
              {FACTS.map((fact) => (
                <Cell key={fact.label} title={fact.label} value={fact.value} chevron onClick={() => launch(fact.app)} />
              ))}
            </Section>
            <Section footer="Every figure here is counted from what is on the site.">
              <Cell title="One-pager" href={SITE.onePager} trailing={out} />
              <Cell title="Website" value={hostOf(SITE.url)} href={SITE.url} trailing={out} />
            </Section>
          </List>
        </Screen>
      )}
    </NavStack>
  )
}
