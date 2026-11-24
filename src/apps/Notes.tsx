import { useEffect, useId, useLayoutEffect, useMemo, useRef } from 'react'
import { ArrowUpRight, ChevronDown, ChevronUp } from 'lucide-react'
import { ANSWER_PENDING, ANSWER_PENDING_LINE, ANSWER_PLACEHOLDER, answerOpening, answerWords, FAQS, waysOn } from '../data/faqs'
import { DRAFT } from '../data/site'
import { Row } from '../kit/parts/Row'
import { Window } from '../kit/window'
import { openOnePager } from '../os/papers'
import { useStore } from '../os/store'
import { isShowing, wm } from '../os/wm'
import { Answer } from './answer'
import { folded } from './fold'
import { notes, setNotesQuery, showNote, sought } from './state'
import { SearchField, SideLabel, ToolSet, ToolSetButton } from './ui'

// The FAQs as a notes window: each question is a note, and its answer is
// Shrug's own (src/data/faqs.ts). Should a question be added before its answer
// is written, a visitor is told so, in a line written for them, and given the
// way on (Shrug itself once there is an address to write to, and the
// one-pager); the editor's view (`?draft`) shows the slot the answer goes in,
// as the canvas drew it.

/** The editor's view: how long the stand-in preview line runs under a question with no answer yet. */
const PREVIEW = [148, 132, 156, 120, 144, 136, 152]

export function NotesApp() {
  const note = useStore(notes, (s) => s.note)
  const compact = useStore(wm, (s) => s.compact)
  const query = useStore(notes, (s) => s.query)
  // Read as a search reads words: the answers are typeset, and a keyboard types plain apostrophes
  const q = folded(query.trim())
  const shown = useMemo(() => FAQS.map((faq, i) => ({ faq, i })).filter(({ faq }) => !q || folded(faq.question).includes(q) || folded(faq.answer ? answerWords(faq.answer) : '').includes(q)), [q])
  const current = FAQS[note]!
  const step = (by: number) => showNote((note + by + FAQS.length) % FAQS.length)
  const list = useRef<HTMLDivElement>(null)
  const titleId = useId()

  // The window follows the search as it is typed: when the question that is open
  // is not among those found, the first of them is shown. (Only a change to
  // the search does this: Next and Previous still go where they say.)
  const open = useRef(note)
  open.current = note
  useEffect(() => {
    if (q && shown.length && !shown.some(({ i }) => i === open.current)) showNote(shown[0]!.i)
  }, [q, shown])

  // The list follows the note. Whatever changed it (Next and Previous, which
  // go round from the last question to the first; a link in an answer; the
  // menu bar; the address), its row is brought into sight: by the list's own
  // scrolling and nothing else's, and the keyboard is left where it was. A
  // window that was not showing does the same as it is shown
  const showing = useStore(wm, (s) => isShowing(s.wins.notes))
  useLayoutEffect(() => {
    const box = list.current
    const row = box?.querySelector<HTMLElement>('[aria-current]')
    if (!box || !row || !box.offsetHeight) return
    const frame = box.getBoundingClientRect()
    const at = row.getBoundingClientRect()
    // (As it is drawn: a window still opening out of its icon is drawn small)
    const k = frame.height / box.offsetHeight || 1
    if (at.top < frame.top) box.scrollTop -= (frame.top - at.top) / k + 6
    else if (at.bottom > frame.bottom) box.scrollTop += (at.bottom - frame.bottom) / k + 6
  }, [note, shown, showing])

  /** From the search field into what it found: the first question is shown, and its row takes the keyboard. */
  const intoResults = () => {
    const first = shown[0]
    if (!first) return
    showNote(first.i)
    list.current?.querySelector<HTMLElement>('.faq-row')?.focus()
  }

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
            <SearchField value={query} onChange={setNotesQuery} label="Search the FAQs" onEnter={intoResults} onArrowDown={intoResults} />
          </div>
          <SideLabel count={q ? `${shown.length} of ${FAQS.length}` : FAQS.length}>Questions</SideLabel>
          <div ref={list} className="side__list scrolls">
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
                preview={faq.answer ? answerOpening(faq.answer) : DRAFT ? [PREVIEW[i % PREVIEW.length]!] : ANSWER_PENDING_LINE}
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
            {shown.length === 0 && (
              <div className="side-empty" role="status">
                <b>No Results for “{sought(query)}”</b>
                <span>Check the spelling or try a new search.</span>
              </div>
            )}
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
      // An answer is read, and with the questions in the sidebar there is nothing in it to press: the page
      // itself takes the keyboard, so that a long answer can be scrolled with the arrows, Space and Page Down
      body={{ className: 'faq__body scrolls', tabIndex: 0, role: 'group', 'aria-labelledby': titleId }}
    >
      <article className="faq__note" key={note}>
        <p className="faq__meta">
          Question {note + 1} of {FAQS.length}
        </p>
        <h2 id={titleId} className="faq__title">
          {current.question}
        </h2>
        {current.answer ? (
          <Answer text={current.answer} className="faq__answer" />
        ) : DRAFT ? (
          <p className="faq__todo">{ANSWER_PLACEHOLDER}</p>
        ) : (
          <div className="faq__pending">
            <p>{ANSWER_PENDING}</p>
            <p className="faq__ways">
              {waysOn(current.question).map((way) =>
                // The one-pager is a file here, and opens in Preview: nothing leaves for a tab of its own
                way.leaves && !compact ? (
                  <button key={way.label} type="button" className="faq__way" onClick={openOnePager}>
                    {way.label}
                  </button>
                ) : (
                  <a key={way.label} className="faq__way" href={way.href} draggable={false} {...(way.leaves ? { target: '_blank', rel: 'noreferrer' } : null)}>
                    {way.label}
                    {way.leaves && (
                      <>
                        <ArrowUpRight size={13} strokeWidth={2.2} aria-hidden />
                        <span className="sr-only">, opens in a new tab</span>
                      </>
                    )}
                  </a>
                ),
              )}
            </p>
          </div>
        )}
      </article>
      {/* With the sidebar folded away, the questions are listed under the note */}
      <nav className="faq__more" aria-label="More questions">
        <div className="faq__more-label">More questions</div>
        {FAQS.map((faq, i) =>
          i === note ? null : (
            <button key={i} type="button" className="faq__more-item" onClick={() => showNote(i)}>
              {faq.question}
            </button>
          ),
        )}
      </nav>
    </Window>
  )
}
