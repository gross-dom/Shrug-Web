import { useMemo } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { ANSWER_PLACEHOLDER, FAQS } from '../data/faqs'
import { Row } from '../kit/parts/Row'
import { Window } from '../kit/window'
import { useStore } from '../os/store'
import { notes, setNotesQuery, showNote } from './state'
import { SearchField, SideLabel, ToolSet, ToolSetButton } from './ui'

// The FAQs as a notes window: each question is a note. The questions are
// real; the answers haven't been written, so each note holds the slot for one.

/** How long the stand-in preview line runs under a question with no answer yet. */
const PREVIEW = [148, 132, 156, 120, 144, 136, 152]

export function NotesApp() {
  const note = useStore(notes, (s) => s.note)
  const query = useStore(notes, (s) => s.query)
  const q = query.trim().toLowerCase()
  const shown = useMemo(() => FAQS.map((faq, i) => ({ faq, i })).filter(({ faq }) => !q || faq.question.toLowerCase().includes(q) || (faq.answer ?? '').toLowerCase().includes(q)), [q])
  const current = FAQS[note]!
  const step = (by: number) => showNote((note + by + FAQS.length) % FAQS.length)

  return (
    <Window
      className="app faq"
      title="FAQs"
      sidebarWidth={264}
      sidebarStyle="floating"
      lightsSize="large"
      barSize="tall"
      sidebar={
        <div className="side side--notes">
          <div className="side__top">
            <SearchField value={query} onChange={setNotesQuery} label="Search the FAQs" />
          </div>
          <SideLabel count={q ? `${shown.length} of ${FAQS.length}` : FAQS.length}>Questions</SideLabel>
          <div className="side__list scrolls">
            {shown.map(({ faq, i }) => (
              <Row
                key={i}
                className="faq-row"
                pad={10}
                role="button"
                tabIndex={0}
                aria-current={i === note || undefined}
                selected={i === note}
                title={faq.question}
                preview={faq.answer ?? [PREVIEW[i % PREVIEW.length]!]}
                onClick={() => showNote(i)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    showNote(i)
                  } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                    e.preventDefault()
                    const next = (e.currentTarget as HTMLElement)[e.key === 'ArrowDown' ? 'nextElementSibling' : 'previousElementSibling'] as HTMLElement | null
                    next?.focus()
                    next?.click()
                  }
                }}
              />
            ))}
            {shown.length === 0 && <div className="side-empty">No question matches</div>}
          </div>
        </div>
      }
      toolbar={
        <span className="tools">
          <ToolSet label="Question">
            <ToolSetButton label="Previous question" onClick={() => step(-1)}>
              <ChevronUp size={17} strokeWidth={1.9} aria-hidden />
            </ToolSetButton>
            <ToolSetButton label="Next question" onClick={() => step(1)}>
              <ChevronDown size={17} strokeWidth={1.9} aria-hidden />
            </ToolSetButton>
          </ToolSet>
        </span>
      }
      body={{ className: 'faq__body scrolls' }}
    >
      <article className="faq__note" key={note}>
        <p className="faq__meta">
          Question {note + 1} of {FAQS.length}
        </p>
        <h2 className="faq__title">{current.question}</h2>
        {current.answer ? <p className="faq__answer">{current.answer}</p> : <p className="faq__todo">{ANSWER_PLACEHOLDER}</p>}
      </article>
    </Window>
  )
}
