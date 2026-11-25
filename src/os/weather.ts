// The weather, for the widget on the desk and for the Weather window it opens.
//
// It is asked of the United States' National Weather Service (api.weather.gov: public, free and needing no
// key), by the visitor's browser. The service answers for places in the United States, which is where these
// are. What it says is shown as it says it; if an answer does not come, or is not what was expected, nothing
// is shown in its place: nobody is shown a weather that was not told.
//
// What it gives: the forecast hour by hour (the temperature, the sky in its words, the wind, the humidity,
// the dew point and how likely rain is) and day by day for a week. The sun's rising and setting are worked
// out from where the place is, as any almanac does. It gives no air quality, UV, pressure or visibility in
// these answers, so the window has no tiles for those.

export interface Place {
  id: string
  name: string
  lat: number
  lon: number
  /** Its clock. */
  zone: string
}

/** The places the window has. The first is the widget's. */
export const PLACES: Place[] = [
  { id: 'san-francisco', name: 'San Francisco', lat: 37.7749, lon: -122.4194, zone: 'America/Los_Angeles' },
  { id: 'los-angeles', name: 'Los Angeles', lat: 34.0522, lon: -118.2437, zone: 'America/Los_Angeles' },
  { id: 'new-york', name: 'New York', lat: 40.7128, lon: -74.006, zone: 'America/New_York' },
]

export interface Hour {
  /** When it starts and ends. */
  at: number
  end: number
  /** Degrees Fahrenheit, as the service gives them. */
  temp: number
  /** The sky, in its words: Mostly Cloudy. */
  says: string
  day: boolean
  /** How likely rain is, in a hundred; null where it does not say. */
  rain: number | null
  humidity: number | null
  /** The dew point, in degrees Fahrenheit. */
  dew: number | null
  /** The wind, in miles an hour, and where it is from (NE). */
  wind: number | null
  from: string | null
}

export interface Day {
  at: number
  says: string
  day: boolean
  high: number | null
  low: number | null
  rain: number | null
}

export interface Told {
  now: Hour
  hours: Hour[]
  /** Day by day. Empty where the service did not give its week. */
  days: Day[]
  at: number
}

/** The service's own page for a place, for a person to read. */
export const forecastPage = (place: Place) => `https://forecast.weather.gov/MapClick.php?lat=${place.lat}&lon=${place.lon}`

const asJson = async (url: string) => {
  const answer = await fetch(url, { headers: { Accept: 'application/geo+json' } })
  if (!answer.ok) throw new Error(`weather: ${answer.status}`)
  return (await answer.json()) as unknown
}

/** What the service says the sky is doing, without how likely it thinks that is: "Slight Chance Light
 * Rain" is Light Rain, "Rain Showers Likely" is Rain Showers. Its other words are the weather itself and
 * are kept: Mostly Cloudy, Patchy Fog. */
export const plainly = (says: string) =>
  says
    .replace(/^(?:slight\s+)?chance\s+(?:of\s+)?/i, '')
    .replace(/\s+likely$/i, '')
    .trim() || says

/** "Slight Chance Light Rain then Mostly Cloudy": what it is doing is the first of those, said plainly. */
const skyOf = (says: string) => plainly(says.split(/\s+then\s+/i)[0]!.trim()).slice(0, 40)

type Raw = Record<string, unknown>
const valueOf = (thing: unknown): number | null => {
  const value = (thing as { value?: unknown } | null)?.value
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}
const toF = (celsius: number | null) => (celsius === null ? null : (celsius * 9) / 5 + 32)
/** "12 mph", "5 to 10 mph": the most it says. */
const mphOf = (says: unknown): number | null => {
  const found = typeof says === 'string' ? says.match(/\d+/g) : null
  return found ? Math.max(...found.map(Number)) : null
}

function hourOf(p: Raw): Hour | null {
  if (typeof p.temperature !== 'number' || typeof p.shortForecast !== 'string') return null
  const temp = p.temperatureUnit === 'C' ? (p.temperature * 9) / 5 + 32 : p.temperature
  return {
    at: typeof p.startTime === 'string' ? Date.parse(p.startTime) : Date.now(),
    end: typeof p.endTime === 'string' ? Date.parse(p.endTime) : Date.now() + 3_600_000,
    temp,
    says: skyOf(p.shortForecast),
    day: p.isDaytime !== false,
    rain: valueOf(p.probabilityOfPrecipitation),
    humidity: valueOf(p.relativeHumidity),
    dew: toF(valueOf(p.dewpoint)),
    wind: mphOf(p.windSpeed),
    from: typeof p.windDirection === 'string' && /^[NESW]{1,3}$/.test(p.windDirection) ? p.windDirection : null,
  }
}

const periodsOf = (answer: unknown): Raw[] => {
  const periods = (answer as { properties?: { periods?: unknown } } | null)?.properties?.periods
  return Array.isArray(periods) ? (periods as Raw[]) : []
}
/** Only ever the service's own address. */
const own = (url: unknown): url is string => typeof url === 'string' && url.startsWith('https://api.weather.gov/')

/** The week, from the service's forecast by the half day: each day's high is its day's, its low its night's. */
function daysOf(periods: Raw[], zone: string): Day[] {
  const dateIn = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' })
  const days = new Map<string, Day>()
  for (const p of periods) {
    if (typeof p.startTime !== 'string' || typeof p.temperature !== 'number') continue
    const at = Date.parse(p.startTime)
    const key = dateIn.format(at)
    const temp = p.temperatureUnit === 'C' ? (p.temperature * 9) / 5 + 32 : p.temperature
    const day = days.get(key) ?? { at, says: '', day: true, high: null, low: null, rain: null }
    const rain = valueOf(p.probabilityOfPrecipitation)
    if (rain !== null) day.rain = Math.max(day.rain ?? 0, rain)
    if (p.isDaytime !== false) {
      day.high = temp
      if (typeof p.shortForecast === 'string') day.says = skyOf(p.shortForecast)
    } else {
      day.low = temp
      if (!day.says && typeof p.shortForecast === 'string') (day.says = skyOf(p.shortForecast)), (day.day = false)
    }
    days.set(key, day)
  }
  return [...days.values()].slice(0, 7)
}

const kept = new Map<string, { told: Promise<Told>; at: number }>()
/** How long an answer is good for before the service is asked again. */
const FRESH = 10 * 60_000

/** What the service has for a place: now, hour by hour, and (with `week`) day by day. Asked again no more than every ten minutes. */
export function readWeather(place: Place = PLACES[0]!, week = false): Promise<Told> {
  const key = `${place.id}${week ? ':week' : ''}`
  const had = kept.get(key) ?? (week ? undefined : kept.get(`${place.id}:week`))
  if (had && Date.now() - had.at < FRESH) return had.told
  const told = (async (): Promise<Told> => {
    const point = (await asJson(`https://api.weather.gov/points/${place.lat},${place.lon}`)) as { properties?: { forecastHourly?: unknown; forecast?: unknown } }
    const hourly = point.properties?.forecastHourly
    if (!own(hourly)) throw new Error('weather: no forecast')
    const daily = point.properties?.forecast
    const [byHour, byDay] = await Promise.all([asJson(hourly), week && own(daily) ? asJson(daily).catch(() => null) : null])
    const hours = periodsOf(byHour)
      .map(hourOf)
      .filter((h): h is Hour => !!h)
    const upcoming = hours.filter((h) => h.end > Date.now())
    const now = upcoming[0] ?? hours[0]
    if (!now) throw new Error('weather: unread')
    return { now, hours: (upcoming.length ? upcoming : hours).slice(0, 25), days: daysOf(periodsOf(byDay), place.zone), at: Date.now() }
  })()
  kept.set(key, { told, at: Date.now() })
  // (an asking that failed is not kept: the next one asks again)
  told.catch(() => kept.get(key)?.told === told && kept.delete(key))
  return told
}

/** Whether the visitor reads temperatures in Fahrenheit: those whose own English comes from where it is used. */
export const FAHRENHEIT = (() => {
  try {
    return /-(US|BS|BZ|KY|PW|LR|MH|FM|PR|GU|VI)\b/i.test(new Intl.Locale(navigator.language).maximize().baseName)
  } catch {
    return true
  }
})()

/** A temperature as the visitor reads them, to the degree. */
export const degrees = (fahrenheit: number) => Math.round(FAHRENHEIT ? fahrenheit : ((fahrenheit - 32) * 5) / 9)

/** Whether a sky is a grey one: cloud, fog or rain, and not merely some cloud. */
export const isGray = (says: string) => /cloud|overcast|fog|rain|drizzle|shower|haze|mist|snow|thunder/i.test(says) && !/partly|mostly (sunny|clear)/i.test(says)

/** When the sun rises and sets at a place on the day of `at`, worked out from where it is (the usual
 * almanac sums, good to a minute or two). Null where it does neither that day. */
export function sunOf(place: Place, at: number): { rise: number; set: number } | null {
  const rad = Math.PI / 180
  const DAY = 86_400_000
  const J1970 = 2440588
  const J2000 = 2451545
  const d = at / DAY - 0.5 + J1970 - J2000
  const lw = -place.lon * rad
  const phi = place.lat * rad
  const n = Math.round(d - 0.0009 - lw / (2 * Math.PI))
  const ds = 0.0009 + lw / (2 * Math.PI) + n
  const M = rad * (357.5291 + 0.98560028 * ds)
  const C = rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M))
  const L = M + C + rad * 102.9372 + Math.PI
  const dec = Math.asin(Math.sin(L) * Math.sin(rad * 23.4397))
  const noon = J2000 + ds + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L)
  const cos = (Math.sin(-0.833 * rad) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec))
  if (cos < -1 || cos > 1) return null
  const w = Math.acos(cos)
  const set = J2000 + 0.0009 + (w + lw) / (2 * Math.PI) + n + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L)
  const toMs = (j: number) => (j + 0.5 - J1970) * DAY
  return { rise: toMs(noon - (set - noon)), set: toMs(set) }
}

// ---- What is worked out from what the service gives

/** How it feels, in degrees Fahrenheit, by the Weather Service's own two sums: its wind chill where it is
 * cold and there is wind (50° or under, over 3 mph), its heat index where it is hot and the humidity is
 * known (80° or over); otherwise it feels as it is. */
export function feelsLike(h: Pick<Hour, 'temp' | 'wind' | 'humidity'>): number {
  const t = h.temp
  if (t <= 50 && h.wind !== null && h.wind > 3) {
    const v = Math.pow(h.wind, 0.16)
    return 35.74 + 0.6215 * t - 35.75 * v + 0.4275 * t * v
  }
  if (t >= 80 && h.humidity !== null) {
    const r = h.humidity
    const index = -42.379 + 2.04901523 * t + 10.14333127 * r - 0.22475541 * t * r - 0.00683783 * t * t - 0.05481717 * r * r + 0.00122874 * t * t * r + 0.00085282 * t * r * r - 0.00000199 * t * t * r * r
    return Math.max(t, index)
  }
  return t
}

export interface Moon {
  /** Its phase, as it is called: Waning Gibbous. */
  name: string
  /** How far through its month it is, 0 (new) to 1 (new again): 0.5 is full. */
  phase: number
  /** How much of its face is lit, 0 to 1. */
  lit: number
}

const MONTH = 29.530588853
/** A new moon to count from: 6 January 2000, 18:14 UTC. */
const NEW_MOON = Date.UTC(2000, 0, 6, 18, 14)
const PHASES = ['New Moon', 'Waxing Crescent', 'First Quarter', 'Waxing Gibbous', 'Full Moon', 'Waning Gibbous', 'Last Quarter', 'Waning Crescent']

/** The moon at a moment, reckoned from the length of its month (good to within some hours, which is closer than its name needs). */
export function moonOf(at: number): Moon {
  const days = (at - NEW_MOON) / 86_400_000
  const phase = (((days % MONTH) + MONTH) % MONTH) / MONTH
  // (the four named moments are a day about each quarter; the rest of the month is the four spans between them)
  const eighth = phase * 8
  const near = Math.round(eighth) % 8
  const name = Math.abs(eighth - Math.round(eighth)) < 0.27 && near % 2 === 0 ? PHASES[near]! : PHASES[(Math.floor(eighth / 2) * 2 + 1) % 8]!
  return { name, phase, lit: (1 - Math.cos(2 * Math.PI * phase)) / 2 }
}

/** The sky, as the window draws it: what is in it, and what light it is in. */
export type SkyKind = 'clear' | 'some' | 'cloud' | 'fog' | 'rain' | 'snow' | 'storm'
export type SkyLight = 'day' | 'dusk' | 'night'

/** What is in the sky, from the service's words for it. */
export function skyKind(says: string): SkyKind {
  if (/thunder|t-?storm/i.test(says)) return 'storm'
  if (/snow|sleet|flurr|blizzard|ice|wintry/i.test(says)) return 'snow'
  if (/rain|drizzle|shower/i.test(says)) return 'rain'
  if (/fog|haze|mist|smoke/i.test(says)) return 'fog'
  if (/partly|mostly (sunny|clear)|few clouds/i.test(says)) return 'some'
  if (/cloud|overcast/i.test(says)) return 'cloud'
  return 'clear'
}

/** What light a place is in at a moment: day, night, or the three quarters of an hour about the sun's rising and setting. */
export function skyLight(place: Place, at: number, day: boolean): SkyLight {
  const sun = sunOf(place, at)
  const NEAR = 45 * 60_000
  if (sun && (Math.abs(at - sun.rise) < NEAR || Math.abs(at - sun.set) < NEAR)) return 'dusk'
  if (sun) return at > sun.rise && at < sun.set ? 'day' : 'night'
  return day ? 'day' : 'night'
}
