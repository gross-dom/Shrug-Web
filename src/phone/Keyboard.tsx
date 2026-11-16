import { useEffect, useRef, useState, type RefObject } from 'react'
import { Keyboard } from '../kit/ios'
import { useStore } from '../os/store'
import { COLOR, chrome } from './chrome'
import { sys } from './system'

// The iOS keyboard, for the iPhone drawn in a frame on a computer. A real
// phone brings its own; here there is only the computer's, so while a field on
// the phone has the keyboard the kit's iOS one comes up from the foot of the
// screen, the screen keeps to the space above it as it would on a phone, and
// its keys pop as the computer's are typed.

type Field = HTMLInputElement | HTMLTextAreaElement

const isField = (el: EventTarget | null): el is Field => el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && !['checkbox', 'radio', 'button', 'submit', 'range', 'file'].includes(el.type))

/** The three words over the keys: the one being typed, quoted, as iOS offers it back. */
function suggestions(typed: string): [string, string, string] {
  const word = typed.split(/\s/).pop() ?? ''
  // Something long (an address) isn't a word to offer back
  return word && word.length <= 14 ? [`“${word}”`, word.toLowerCase(), word[0]!.toUpperCase() + word.slice(1)] : ['I', 'The', 'I’m']
}

export function SoftKeyboard({ screen }: { screen: RefObject<HTMLDivElement> }) {
  const box = useRef<HTMLDivElement>(null)
  const field = useRef<Field | null>(null)
  const [up, setUp] = useState(false)
  const [typed, setTyped] = useState('')
  const tone = useStore(chrome, (s) => s[sys.get().app ?? 'messages'])
  const app = useStore(sys, (s) => s.app)

  useEffect(() => {
    const el = screen.current
    // Only where the typing is done on a real keyboard: a touch screen brings up its own
    if (!el || !matchMedia('(pointer: fine)').matches) return
    const onIn = (e: FocusEvent) => {
      if (!isField(e.target)) return
      field.current = e.target
      setTyped(e.target.value)
      setUp(true)
    }
    const onOut = () => {
      // The keyboard may only be moving to another field
      setTimeout(() => {
        const now = document.activeElement
        if (now && el.contains(now) && isField(now)) return
        field.current = null
        setUp(false)
      }, 0)
    }
    const onInput = (e: Event) => {
      if (e.target === field.current) setTyped(field.current!.value)
    }
    el.addEventListener('focusin', onIn)
    el.addEventListener('focusout', onOut)
    el.addEventListener('input', onInput)
    return () => {
      el.removeEventListener('focusin', onIn)
      el.removeEventListener('focusout', onOut)
      el.removeEventListener('input', onInput)
    }
  }, [screen])

  // The screen keeps to what is left above the keys
  useEffect(() => {
    const el = screen.current
    if (!el) return
    el.toggleAttribute('data-softkb', up)
    if (up && box.current) el.style.setProperty('--kb', `${box.current.offsetHeight}px`)
  }, [up, screen])

  return (
    <div ref={box} className="ph-kb" data-up={up || undefined} style={{ background: COLOR[app ? tone : 'plain'] }} aria-hidden>
      <Keyboard typed={typed} suggestions={suggestions(typed)} dark={!!app && tone === 'dark'} />
    </div>
  )
}
