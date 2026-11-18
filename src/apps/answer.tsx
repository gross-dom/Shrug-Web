import { answerBlocks, type Inline } from '../data/faqs'
import { launchApp } from '../os/launch'

// An answer, drawn: its paragraphs and its lists, with the links and the
// stress in them. The notes window and the iPhone's Notes both show an answer
// with this, each sized by the class it gives it (styles: `.answer` in apps.css).

function Run({ part }: { part: Inline }) {
  if (typeof part === 'string') return <>{part}</>
  if ('em' in part) return <em>{part.em}</em>
  if ('app' in part) {
    // One of the site's own apps: it opens where the reader is
    return (
      <button type="button" className="answer__link" onClick={() => launchApp(part.app)}>
        {part.label}
      </button>
    )
  }
  return (
    <a className="answer__link" href={part.href} target="_blank" rel="noreferrer" draggable={false}>
      {part.label}
      <span className="sr-only">, opens in a new tab</span>
    </a>
  )
}

const runs = (parts: Inline[]) => parts.map((part, i) => <Run key={i} part={part} />)

export function Answer({ text, className }: { text: string; className?: string }) {
  return (
    <div className={`answer${className ? ` ${className}` : ''}`}>
      {answerBlocks(text).map((block, i) =>
        block.kind === 'list' ? (
          <ul key={i} className="answer__list">
            {block.items.map((item, j) => (
              <li key={j}>{runs(item)}</li>
            ))}
          </ul>
        ) : (
          <p key={i}>{runs(block.parts)}</p>
        ),
      )}
    </div>
  )
}
