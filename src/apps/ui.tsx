import { useRef, type KeyboardEvent, type ReactNode } from 'react'
import { Search, X } from 'lucide-react'
import { LogoDisc } from '../os/icons'

// Parts the app windows share: the glass toolbar buttons of a current macOS
// window (a capsule with its label under it), a real search field in the
// kit's field shape, and Shrug's own avatar.

/** A toolbar button: a glass capsule, its label under it, as the kit's tall bar expects. */
export function Tool({ label, onClick, disabled, pressed, wide, children }: { label: string; onClick?: () => void; disabled?: boolean; pressed?: boolean; wide?: boolean; children: ReactNode }) {
  return (
    <button type="button" className="tool" aria-label={label} aria-pressed={pressed} aria-disabled={disabled || undefined} data-wide={wide || undefined} onClick={disabled ? undefined : onClick}>
      <span className="tool__cap">{children}</span>
      <span className="tool__label" aria-hidden>
        {label}
      </span>
    </button>
  )
}

/** Two or more buttons sharing one capsule (Back and Forward, the view switch). */
export function ToolSet({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="tool">
      <span className="tool__cap tool__cap--set" role="group" aria-label={label}>
        {children}
      </span>
      <span className="tool__label" aria-hidden>
        {label}
      </span>
    </span>
  )
}

export function ToolSetButton({ label, onClick, disabled, pressed, children }: { label: string; onClick?: () => void; disabled?: boolean; pressed?: boolean; children: ReactNode }) {
  return (
    <button type="button" className="tool__part" aria-label={label} aria-pressed={pressed} aria-disabled={disabled || undefined} onClick={disabled ? undefined : onClick}>
      {children}
    </button>
  )
}

interface SearchFieldProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  label: string
  /** Return in the field: the window's to answer, usually by opening the first thing found. */
  onEnter?: () => void
  /** The down arrow in the field: the window's to answer, usually by going into what was found. */
  onArrowDown?: () => void
}

/** A search field that really filters: the kit's field shape around a real input.
 * Escape empties it, and emptying it (by the key or by its button) leaves the caret where it was:
 * in the field, ready for the next search. */
export function SearchField({ value, onChange, placeholder = 'Search', label, onEnter, onArrowDown }: SearchFieldProps) {
  const input = useRef<HTMLInputElement>(null)
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    // A key that is finishing a character being composed is not a command
    if (e.nativeEvent.isComposing) return
    if (e.key === 'Escape' && value) {
      // The Escape is spent on the search: nothing behind the field hears it
      e.preventDefault()
      e.stopPropagation()
      onChange('')
    } else if (e.key === 'Enter' && onEnter) {
      e.preventDefault()
      onEnter()
    } else if (e.key === 'ArrowDown' && onArrowDown) {
      e.preventDefault()
      onArrowDown()
    }
  }
  return (
    <label className="search" data-filled={value ? '' : undefined}>
      <Search size={13} strokeWidth={2} className="search__glass" aria-hidden />
      <input
        ref={input}
        className="search__input"
        type="text"
        inputMode="search"
        autoComplete="off"
        spellCheck={false}
        placeholder={placeholder}
        aria-label={label}
        // What is typed may be in a right-to-left script: the field sets it in its own direction
        dir="auto"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKey}
      />
      {value && (
        <button
          type="button"
          className="search__clear"
          aria-label="Clear search"
          // A press on it never takes the caret (on a touch screen the keyboard would go down with it),
          // and once it has gone from the page the caret is in the field, not nowhere
          onPointerDown={(e) => e.preventDefault()}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            onChange('')
            input.current?.focus()
          }}
        >
          <X size={9} strokeWidth={2.6} aria-hidden />
        </button>
      )}
    </label>
  )
}

/** Shrug in a conversation: the logo in a black disc. */
export function ShrugAvatar({ size = 28 }: { size?: number }) {
  return (
    <span className="shrug-avatar" style={{ width: size, height: size }} aria-hidden>
      <LogoDisc size="100%" />
    </span>
  )
}

/** A section heading inside a sidebar. */
export function SideLabel({ children, count }: { children: ReactNode; count?: ReactNode }) {
  return (
    <div className="side-label">
      <span>{children}</span>
      {count !== undefined && <span className="side-label__count">{count}</span>}
    </div>
  )
}
