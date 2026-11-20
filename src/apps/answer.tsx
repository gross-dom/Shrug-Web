import { answerBlocks, type Inline } from '../data/faqs'
import { launchApp, showGroup } from '../os/launch'

// An answer, drawn: its paragraphs and its lists, with the links, the stress
// and the crossings-out in them. The notes window and the iPhone's Notes both
// show an answer with this, each sized by the class it gives it (styles:
// `.answer` in apps.css).

function Run({ part }: { part: Inline }) {
  if (typeof part === 'string') return <>{part}</>
  if ('em' in part) return <em>{part.em}</em>
  if ('struck' in part) {
    // Words crossed out and left to be read. The line through them is all an eye needs; a screen reader
    // says nothing of a line, so it is told where the crossing-out starts and where it stops
    return (
      <s className="answer__struck">
        <span className="sr-only">crossed out: </span>
        {part.struck}
        <span className="sr-only">, end of crossing out,</span>
      </s>
    )
  }
  if ('app' in part) {
    // One of the site's own apps: it opens where the reader is. What an answer says of the conversation is
    // said of the group itself (everyone "on our wall"), so that is what opens, not the list of conversations
    return (
      <button type="button" className="answer__link" onClick={() => (part.app === 'messages' ? showGroup() : launchApp(part.app))}>
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
