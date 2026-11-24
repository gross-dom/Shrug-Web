import type { CSSProperties } from 'react'
import { ANSWER_PENDING, answerBlocks, FAQS, type Inline } from '@data/faqs'
import { EMAIL } from '../content'
import { PageLink, type Path } from '../router'

// The FAQs, in Shrug's own words (src/data/faqs.ts), as a stack of sections that are all the same row: a
// small label on the left and what it labels on the right. First a statement in large type, which is the
// page's heading; then one section for each question, numbered, under a hairline, with its answer under it
// and always open; and last, where to write with any other question. A link in an answer that points at
// one of the desktop site's apps points here at the page that holds the same thing.

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
          <PageLink key={i} to={PAGE_OF[part.app] ?? '/'}>
            {part.label}
          </PageLink>
        ) : (
          <a key={i} href={part.href}>
            {part.label}
          </a>
        ),
      )}
    </>
  )
}

/** When a thing comes in, among those in view as the page opens: the higher, the later (styles.css). */
const turn = (i: number) => ({ '--i': Math.min(i, 10) }) as CSSProperties

export function Faq() {
  return (
    <div className="faq">
      <section className="qa qa--open">
        <p className="qa__label mono rise" style={turn(2)}>
          [FAQ]
        </p>
        <h1 className="qa__lead rise" style={turn(3)}>
          Nobody asks these that often. <span>They’re the questions we’d want answered before working closely with someone for the next ten years, so we’ve written them down.</span>
        </h1>
      </section>
      {FAQS.map((faq, n) => (
        <section key={faq.question} className="qa">
          <span className="rule draw" aria-hidden style={turn(4 + n * 2)} />
          <div className="qa__in">
            <p className="qa__label mono rise" style={turn(4 + n * 2)}>
              [{String(n + 1).padStart(2, '0')}]
            </p>
            <div className="qa__body">
              <h2 className="qa__q rise" style={turn(5 + n * 2)}>
                {faq.question}
              </h2>
              <div className="qa__a rise" style={turn(6 + n * 2)}>
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
          </div>
        </section>
      ))}
      <section className="qa qa--last">
        <span className="rule draw" aria-hidden />
        <div className="qa__in">
          <p className="qa__label mono rise">[Anything else]</p>
          <p className="qa__lead qa__lead--write rise">
            <a href={`mailto:${EMAIL}`}>{EMAIL}</a>
          </p>
        </div>
      </section>
    </div>
  )
}
