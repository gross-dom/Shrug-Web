import { ALIASES, APP_IDS, type AppId } from './apps'

// What the address asks for, read forgivingly: a link is typed, pasted, cut
// short and passed on by people, so the switches answer in any case
// (`?OPEN=portfolio`), a switch can be turned off (`?phone=0`), and the apps a
// link names can be set apart with commas, semicolons, plus signs or spaces,
// or given as a path (`/portfolio`) or after a hash (`#portfolio`).

const params = (): [string, string][] => (typeof window === 'undefined' ? [] : [...new URLSearchParams(window.location.search)].map(([key, value]) => [key.toLowerCase(), value]))

/** What the address gives a switch (`?idle=5` gives "5", a bare `?still` gives ""); null if it is not there. */
export const asked = (name: string) => params().find(([key]) => key === name)?.[1] ?? null

/** The switch is on: it is in the address, and not as `=0`, `=false`, `=off` or `=no`. */
export function isOn(name: string) {
  const value = asked(name)
  return value !== null && !/^(0|false|off|no)$/i.test(value.trim())
}

const appNamed = (name: string): AppId | null => {
  const id = ALIASES[name] ?? name
  return (APP_IDS as string[]).includes(id) ? (id as AppId) : null
}

/** The apps the address names, in the order it names them. */
export function opens(): AppId[] {
  if (typeof window === 'undefined') return []
  const last = (text: string) => decodeURIComponent(text).split('/').filter(Boolean).pop() ?? ''
  const names = [...(asked('open') ?? '').split(/[,;+\s]+/), safely(() => last(window.location.pathname)), safely(() => last(window.location.hash.replace(/^#/, '')))]
  const apps = names.map((name) => appNamed(name.trim().toLowerCase())).filter((id): id is AppId => id !== null)
  return [...new Set(apps)]
}

/** A path or a hash that is not valid text names nothing. */
function safely(read: () => string) {
  try {
    return read()
  } catch {
    return ''
  }
}
