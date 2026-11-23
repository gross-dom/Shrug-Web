import { ANSWER_PENDING, answerBlocks, FAQS, type Inline } from '@data/faqs'
import { EMAIL } from '../content'
import { PageLink, type Path } from '../router'

// The FAQs, in Shrug's own words (src/data/faqs.ts): every question with its answer beside it, all of them
// open. A link in an answer that points at one of the desktop site's apps points here at the page that
// holds the same thing. The last row is where to write with any other question.

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

export function Faq() {
  return (
    <div className="faq">
      {FAQS.map((faq) => (
        <section key={faq.question} className="qa">
          <h2 className="qa__q">{faq.question}</h2>
          <div className="qa__a">
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
        </section>
      ))}
      <section className="qa qa--last">
        <h2 className="qa__q">Anything else?</h2>
        <p className="qa__a qa__a--write">
          <a href={`mailto:${EMAIL}`}>{EMAIL}</a>
        </p>
      </section>
    </div>
  )
}
