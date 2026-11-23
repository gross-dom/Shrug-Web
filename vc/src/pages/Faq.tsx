import { useState } from 'react'
import { ANSWER_PENDING, answerBlocks, FAQS, type Inline } from '@data/faqs'
import { Arrow } from '../Brand'
import { SITE } from '../content'
import { PageLink, type Path } from '../router'

// The FAQs, in Shrug's own words (src/data/faqs.ts). Each question opens its answer under it. A link in an
// answer that points at one of the desktop site's apps points here at the page that holds the same thing.

const PAGE_OF: Record<string, Path> = { messages: '/', finder: '/portfolio', photos: '/vip', notes: '/faq', about: '/', terminal: '/', wallpapers: '/' }

function Words({ parts }: { parts: Inline[] }) {
  return (
    <>
      {parts.map((part, i) =>
        typeof part === 'string' ? (
          part
        ) : 'em' in part ? (
          <em key={i}>{part.em}</em>
        ) : 'struck' in part ? (
          <s key={i}>{part.struck}</s>
        ) : 'app' in part ? (
          <PageLink key={i} to={PAGE_OF[part.app] ?? '/'} className="textlink">
            {part.label}
          </PageLink>
        ) : (
          <a key={i} className="textlink" href={part.href} target="_blank" rel="noreferrer">
            {part.label}
          </a>
        ),
      )}
    </>
  )
}

export function Faq() {
  const [open, setOpen] = useState<number | null>(0)
  return (
    <>
      <section className="hero hero--page">
        <p className="label">FAQ</p>
        <h1 className="h1">Questions, answered.</h1>
        <p className="lead">
          The short version is in the{' '}
          <a className="textlink" href={SITE.onePager} target="_blank" rel="noreferrer">
            one-pager
            <Arrow className="arrow arrow--out" />
          </a>
          .
        </p>
      </section>
      <section className="faq" aria-label="Questions">
        {FAQS.map((faq, n) => {
          const on = open === n
          return (
            <div key={faq.question} className="qa" data-open={on || undefined}>
              <h2 className="qa__q">
                <button type="button" aria-expanded={on} aria-controls={`answer-${n}`} id={`question-${n}`} onClick={() => setOpen(on ? null : n)}>
                  <span className="qa__n label">{String(n + 1).padStart(2, '0')}</span>
                  <span>{faq.question}</span>
                  <Arrow className="arrow qa__arrow" />
                </button>
              </h2>
              <div className="qa__a" id={`answer-${n}`} role="region" aria-labelledby={`question-${n}`} hidden={!on}>
                {faq.answer === null ? (
                  <p>{ANSWER_PENDING}</p>
                ) : (
                  answerBlocks(faq.answer).map((block, i) =>
                    block.kind === 'p' ? (
                      <p key={i}>
                        <Words parts={block.parts} />
                      </p>
                    ) : (
                      <ul key={i}>
                        {block.items.map((item, j) => (
                          <li key={j}>
                            <Words parts={item} />
                          </li>
                        ))}
                      </ul>
                    ),
                  )
                )}
              </div>
            </div>
          )
        })}
      </section>
    </>
  )
}
