import { useEffect, useState } from 'react'
import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudMoon, CloudRain, CloudSnow, CloudSun, Moon, Sun, Wind, type LucideIcon } from 'lucide-react'
import { formatter } from './dates'
import { launchApp } from './launch'
import { degrees as shown, FAHRENHEIT, isGray, readWeather } from './weather'

// A widget on the desk, where a Mac keeps them: San Francisco. The time there,
// how far that is from the visitor's own, and the weather.
//
// The time needs nothing but the visitor's own clock. The weather is asked of
// the United States' National Weather Service (os/weather.ts), by the
// visitor's browser, when the desk is drawn and every twenty minutes while it
// is looked at. If the answer does not come, or is not what was expected, the
// widget says the day in its place: it is never shown a weather it was not
// told. Pressed, it opens the Weather window, as a Mac's own does.

const ZONE = 'America/Los_Angeles'

interface Weather {
  /** Degrees Fahrenheit, as the service gives them. */
  temp: number
  /** In its words: Mostly Cloudy. */
  says: string
  day: boolean
}

/** The picture for a sky, by what the service calls it. */
export function glyphOf(says: string, day: boolean): LucideIcon {
  if (/thunder/i.test(says)) return CloudLightning
  if (/snow|sleet|ice|flurr/i.test(says)) return CloudSnow
  if (/drizzle|light rain|showers?/i.test(says)) return CloudDrizzle
  if (/rain/i.test(says)) return CloudRain
  if (/fog|haze|mist|smoke/i.test(says)) return CloudFog
  if (/partly|mostly (sunny|clear)/i.test(says)) return day ? CloudSun : CloudMoon
  if (/cloud|overcast/i.test(says)) return Cloud
  if (/wind|breez/i.test(says)) return Wind
  return day ? Sun : Moon
}

const TIME = formatter({ hour: 'numeric', minute: '2-digit', timeZone: ZONE })
const DAY = new Intl.DateTimeFormat('en-US', { timeZone: ZONE, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' })

/** San Francisco's clock against the visitor's: which day it is there (as against here), how many hours apart the two are, and the hour there. */
function there(now: Date) {
  const part = Object.fromEntries(DAY.formatToParts(now).map((p) => [p.type, Number(p.value)])) as Record<string, number>
  const asIfUtc = Date.UTC(part.year!, part.month! - 1, part.day!, part.hour!, part.minute!)
  // How far its clock is from the visitor's, in hours (the visitor's own is `getTimezoneOffset`, the other way round)
  const apart = Math.round(((asIfUtc - Math.floor(now.getTime() / 60_000) * 60_000) / 60_000 + now.getTimezoneOffset()) / 30) / 2
  const here = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  const days = Math.round((Date.UTC(part.year!, part.month! - 1, part.day!) - here) / 86_400_000)
  return { day: days < 0 ? 'Yesterday' : days > 0 ? 'Tomorrow' : 'Today', apart, hour: part.hour! }
}

const count = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))

export function SanFrancisco() {
  const [now, setNow] = useState(() => new Date())
  const [weather, setWeather] = useState<Weather | null>(null)

  // The clock, on the minute
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const tick = () => {
      setNow(new Date())
      timer = setTimeout(tick, 60_000 - (Date.now() % 60_000) + 50)
    }
    timer = setTimeout(tick, 60_000 - (Date.now() % 60_000) + 50)
    return () => clearTimeout(timer)
  }, [])

  // The weather: when the desk is drawn, and every twenty minutes while it is being looked at
  useEffect(() => {
    let here = true
    let last = 0
    const ask = () => {
      if (document.hidden || Date.now() - last < 19 * 60_000) return
      last = Date.now()
      readWeather().then(
        // (An answer that comes once the desk has gone is not used; the asking itself is left to finish)
        (told) => here && setWeather(told.now),
        () => {
          // Not told: nothing is shown in its place but the time (below)
        },
      )
    }
    ask()
    const every = setInterval(ask, 20 * 60_000)
    document.addEventListener('visibilitychange', ask)
    return () => {
      here = false
      clearInterval(every)
      document.removeEventListener('visibilitychange', ask)
    }
  }, [])

  const { day, apart, hour } = there(now)
  const light = weather ? weather.day : hour >= 7 && hour < 18
  const Glyph = weather ? glyphOf(weather.says, weather.day) : light ? Sun : Moon
  const degrees = weather ? shown(weather.temp) : null
  const gray = !!weather && isGray(weather.says)
  return (
    // Pressed, it opens Weather: the same forecast, at length
    <button type="button" className="sf" aria-label="San Francisco: the time and the weather there. Opens Weather" data-sky={light ? (gray ? 'gray' : 'day') : 'night'} onClick={() => launchApp('weather')}>
      <span className="sf__head">
        <span className="sf__city">San Francisco</span>
        {weather && <Glyph className="sf__glyph" size={19} strokeWidth={2.1} aria-hidden />}
      </span>
      {/* As a Mac's clock widget says it (Today, -8HRS), and in words for whoever has it read to them */}
      <span className="sf__apart">
        {day}
        {apart !== 0 && (
          <>
            <span aria-hidden>
              , {apart < 0 ? '\u2212' : '+'}
              {count(Math.abs(apart))}
              <small>HRS</small>
            </span>
            <span className="sr-only">
              , {count(Math.abs(apart))} {Math.abs(apart) === 1 ? 'hour' : 'hours'} {apart < 0 ? 'behind' : 'ahead'}
            </span>
          </>
        )}
      </span>
      <span className="sf__time">
        {/* (AM and PM are set small beside the hour, as a Mac's clock widget sets them: at the hour's own size
            a time after ten ran to the widget's edge) */}
        <time dateTime={now.toISOString()}>{TIME.formatToParts(now).map((part, i) => (part.type === 'dayPeriod' ? <small key={i}>{part.value}</small> : part.value))}</time>
      </span>
      {weather ? (
        <span className="sf__weather">
          <b>
            {degrees}°<span className="sr-only">{FAHRENHEIT ? ' Fahrenheit' : ' Celsius'}</span>
          </b>{' '}
          {weather.says}
        </span>
      ) : (
        <span className="sf__weather">Pacific Time</span>
      )}
    </button>
  )
}
