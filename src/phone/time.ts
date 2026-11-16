import { useEffect, useState } from 'react'

// The time, as the phone shows it: in the status bar and on the lock screen.

const DATE = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
const TIME = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })

/** The hour and minute alone, as the status bar and the lock screen write them: 9:41, never 9:41 AM. */
export const clockOf = (t: number) =>
  TIME.formatToParts(t)
    .filter((p) => p.type === 'hour' || p.type === 'minute' || (p.type === 'literal' && p.value.trim() !== ''))
    .map((p) => p.value)
    .join('')
    .trim()

/** The day, as the lock screen writes it: Monday, November 16. */
export const dateOf = (t: number) => DATE.format(t)

/** Now, to the minute: it changes when the minute does. */
export function useNow() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const tick = () => {
      setNow(Date.now())
      timer = setTimeout(tick, 60_000 - (Date.now() % 60_000) + 50)
    }
    timer = setTimeout(tick, 60_000 - (Date.now() % 60_000) + 50)
    return () => clearTimeout(timer)
  }, [])
  return now
}
