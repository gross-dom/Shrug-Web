import { useEffect, useState } from 'react'
import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudMoon, CloudRain, CloudSnow, CloudSun, Moon, Sun, Wind, type LucideIcon } from 'lucide-react'
import { formatter } from './dates'

// A widget on the desk, where a Mac keeps them: San Francisco. The time there,
// how far that is from the visitor's own, and the weather.
//
// The time needs nothing but the visitor's own clock. The weather is asked of
// the United States' National Weather Service (api.weather.gov: public, free
// and needing no key), by the visitor's browser, when the desk is drawn and
// every twenty minutes while it is looked at. If the answer does not come, or
// is not what was expected, the widget says the day in its place: it is never
// shown a weather it was not told.

const ZONE = 'America/Los_Angeles'

/** Where the service is asked what it has for the middle of the city: it answers with the address of its forecast, hour by hour. */
const POINT = 'https://api.weather.gov/points/37.7749,-122.4194'

interface Weather {
  /** Degrees Fahrenheit, as the service gives them. */
  temp: number
  /** In its words: Mostly Cloudy. */
  says: string
  day: boolean
}

const asJson = async (url: string) => {
  const answer = await fetch(url, { headers: { Accept: 'application/geo+json' } })
  if (!answer.ok) throw new Error(`weather: ${answer.status}`)
  return (await answer.json()) as unknown
}

/** What the service says the sky is doing, without how likely it thinks that is: "Slight Chance Light
 * Rain" is Light Rain, "Rain Showers Likely" is Rain Showers. A widget this size has the room to say what,
 * not how sure. Its other words are the weather itself and are kept: Mostly Cloudy, Patchy Fog. */
const plainly = (says: string) =>
  says
    .replace(/^(?:slight\s+)?chance\s+(?:of\s+)?/i, '')
    .replace(/\s+likely$/i, '')
    .trim() || says

/** The weather now: the hour that is running, from the service's forecast by the hour. */
async function readWeather(): Promise<Weather> {
  const point = (await asJson(POINT)) as { properties?: { forecastHourly?: unknown } }
  const hourly = point.properties?.forecastHourly
  // Only ever its own address
  if (typeof hourly !== 'string' || !hourly.startsWith('https://api.weather.gov/')) throw new Error('weather: no forecast')
  const forecast = (await asJson(hourly)) as { properties?: { periods?: unknown } }
  const periods = Array.isArray(forecast.properties?.periods) ? (forecast.properties!.periods as Record<string, unknown>[]) : []
  const now = periods.find((p) => typeof p.endTime === 'string' && Date.parse(p.endTime) > Date.now()) ?? periods[0]
  if (!now || typeof now.temperature !== 'number' || typeof now.shortForecast !== 'string') throw new Error('weather: unread')
  const temp = now.temperatureUnit === 'C' ? (now.temperature * 9) / 5 + 32 : now.temperature
  // "Slight Chance Light Rain then Mostly Cloudy": what it is doing now is the first of those, said plainly
  const says = plainly(now.shortForecast.split(/\s+then\s+/i)[0]!.trim()).slice(0, 40)
  return { temp, says, day: now.isDaytime !== false }
}

/** The picture for a sky, by what the service calls it. */
function glyphOf(says: string, day: boolean): LucideIcon {
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

/** Whether the visitor reads temperatures in Fahrenheit: those whose own English comes from where it is used. */
const FAHRENHEIT = (() => {
  try {
    return /-(US|BS|BZ|KY|PW|LR|MH|FM|PR|GU|VI)\b/i.test(new Intl.Locale(navigator.language).maximize().baseName)
  } catch {
    return true
  }
})()

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
        (told) => here && setWeather(told),
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
  const degrees = weather ? Math.round(FAHRENHEIT ? weather.temp : ((weather.temp - 32) * 5) / 9) : null
  const gray = !!weather && /cloud|overcast|fog|rain|drizzle|shower|haze|mist|snow|thunder/i.test(weather.says) && !/partly|mostly (sunny|clear)/i.test(weather.says)
  return (
    <aside className="sf" aria-label="San Francisco" data-sky={light ? (gray ? 'gray' : 'day') : 'night'}>
      <p className="sf__head">
        <span className="sf__city">San Francisco</span>
        {weather && <Glyph className="sf__glyph" size={19} strokeWidth={2.1} aria-hidden />}
      </p>
      {/* As a Mac's clock widget says it (Today, -8HRS), and in words for whoever has it read to them */}
      <p className="sf__apart">
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
      </p>
      <p className="sf__time">
        <time dateTime={now.toISOString()}>{TIME.format(now)}</time>
      </p>
      {weather ? (
        <p className="sf__weather">
          <b>
            {degrees}°<span className="sr-only">{FAHRENHEIT ? ' Fahrenheit' : ' Celsius'}</span>
          </b>{' '}
          {weather.says}
        </p>
      ) : (
        <p className="sf__weather">Pacific Time</p>
      )}
    </aside>
  )
}
