import type { ReactNode } from 'react'
import { Search, X } from 'lucide-react'
import { Face } from '../os/icons'

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

/** A search field that really filters: the kit's field shape around a real input. */
export function SearchField({ value, onChange, placeholder = 'Search', label }: { value: string; onChange: (value: string) => void; placeholder?: string; label: string }) {
  return (
    <label className="search" data-filled={value ? '' : undefined}>
      <Search size={13} strokeWidth={2} className="search__glass" aria-hidden />
      <input className="search__input" type="text" inputMode="search" autoComplete="off" spellCheck={false} placeholder={placeholder} aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} />
      {value && (
        <button type="button" className="search__clear" aria-label="Clear search" onClick={() => onChange('')}>
          <X size={9} strokeWidth={2.6} aria-hidden />
        </button>
      )}
    </label>
  )
}

/** Shrug in a conversation: the face from the shrug on a black disc. */
export function ShrugAvatar({ size = 28 }: { size?: number }) {
  return (
    <span className="shrug-avatar" style={{ width: size, height: size }} aria-hidden>
      <Face size={Math.round(size * 0.62)} stroke={2.2} />
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
