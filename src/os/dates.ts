// One language on a screen. The site is written in English, so its dates and
// times are too, whatever language the visitor's browser speaks; what is kept
// of theirs is the clock they read (12 hours or 24) and, where their own
// English has one, its order of day and month.

const theirs = () => {
  try {
    const { locale, hourCycle } = new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).resolvedOptions()
    return { locale, h24: hourCycle === 'h23' || hourCycle === 'h24' }
  } catch {
    return { locale: 'en-US', h24: false }
  }
}

const visitor = theirs()

/** The visitor reads a 24-hour clock. */
export const H24 = visitor.h24

/** The English the site's dates are written in: the visitor's own if they have one, otherwise the one that goes with their clock. */
export const LOCALE = /^en\b/i.test(visitor.locale) ? visitor.locale : H24 ? 'en-GB' : 'en-US'

const DAY = () => formatter({ weekday: 'short', day: 'numeric', month: 'short' })
let day: Intl.DateTimeFormat | undefined

/** A day where there is little room for one, as a menu bar and a Lock Screen write it: Wed 18 Nov.
 * The words are the visitor's English; the order is this one wherever they are. */
export function shortDay(t: number | Date) {
  const parts = (day ??= DAY()).formatToParts(t)
  const of = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ''
  return `${of('weekday')} ${of('day')} ${of('month')}`
}

/** A date or time formatter in the site's language. An hour asked for as `numeric` is written with
 * two digits on a 24-hour clock, as those are: 09:41, 00:30. */
export function formatter(options: Intl.DateTimeFormatOptions) {
  const asked = { ...options }
  if (H24 && asked.hour) {
    asked.hour = '2-digit'
    asked.hourCycle = 'h23'
  }
  return new Intl.DateTimeFormat(LOCALE, asked)
}
