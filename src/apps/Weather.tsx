import { useEffect, useState } from 'react'
import { ArrowUpRight, CalendarDays, Clock, Droplets, Sunrise, Sunset, Umbrella, Wind } from 'lucide-react'
import { Window } from '../kit/window'
import { glyphOf } from '../os/SanFrancisco'
import { useStore } from '../os/store'
import { degrees, FAHRENHEIT, forecastPage, isGray, PLACES, readWeather, sunOf, type Day, type Hour, type Place, type Told } from '../os/weather'
import { wm } from '../os/wm'
import '../styles/desk/weather.css'

// Weather, after the Mac's own as Dom's screenshots show it: the places down a dark sidebar, each a card with
// its own sky; and the place that is picked at length on a sky of its own: its name and the temperature, the
// hours to come, the week, the wind, the humidity, the rain and the sun. The widget on the desk opens it.
//
// Everything it says is the National Weather Service's (os/weather.ts), asked by the visitor's browser when
// the window is open. What that service does not give (air quality, UV, pressure, visibility) has no tile:
// nothing here is made up. A place whose forecast did not arrive says so, with a way to ask again.

type Got = { told: Told } | { failed: true } | null

const clockIn = (zone: string, more: Intl.DateTimeFormatOptions = {}) => new Intl.DateTimeFormat(undefined, { timeZone: zone, hour: 'numeric', minute: '2-digit', ...more })
const hourIn = (zone: string) => new Intl.DateTimeFormat(undefined, { timeZone: zone, hour: 'numeric' })
const dayIn = (zone: string) => new Intl.DateTimeFormat(undefined, { timeZone: zone, weekday: 'short' })
const dateIn = (zone: string) => new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' })

const skyOf = (now: Hour | undefined) => (!now ? 'day' : !now.day ? 'night' : isGray(now.says) ? 'gray' : 'day')
const COMPASS: Record<string, number> = { N: 0, NNE: 22.5, NE: 45, ENE: 67.5, E: 90, ESE: 112.5, SE: 135, SSE: 157.5, S: 180, SSW: 202.5, SW: 225, WSW: 247.5, W: 270, WNW: 292.5, NW: 315, NNW: 337.5 }
const FROM: Record<string, string> = { N: 'north', NE: 'northeast', E: 'east', SE: 'southeast', S: 'south', SW: 'southwest', W: 'west', NW: 'northwest' }
const fromWords = (from: string) => FROM[from] ?? FROM[from.slice(-2)] ?? from

/** Today's high and low for a place: the week's first day where it has them, and otherwise the day's own hours. */
function rangeOf(told: Told, zone: string): { high: number; low: number } {
  const key = dateIn(zone).format(Date.now())
  const today = told.hours.filter((h) => dateIn(zone).format(h.at) === key).map((h) => h.temp)
  const temps = today.length ? today : [told.now.temp]
  const day = told.days[0]
  return { high: Math.max(day?.high ?? -Infinity, ...temps), low: Math.min(day?.low ?? Infinity, ...temps) }
}

export function WeatherApp() {
  const shown = useStore(wm, (s) => s.wins.weather.open && !s.wins.weather.minimized)
  const [at, setAt] = useState(PLACES[0]!.id)
  const [got, setGot] = useState<Record<string, Got>>({})
  const [again, setAgain] = useState(0)
  const [, setTick] = useState(0)
  const place = PLACES.find((p) => p.id === at) ?? PLACES[0]!

  // Asked while the window is open: every place, for its card and for when it is picked
  useEffect(() => {
    if (!shown) return
    let here = true
    for (const p of PLACES)
      readWeather(p, true).then(
        (told) => here && setGot((g) => ({ ...g, [p.id]: { told } })),
        () => here && setGot((g) => ({ ...g, [p.id]: g[p.id] && 'told' in g[p.id]! ? g[p.id]! : { failed: true } })),
      )
    // (the cards' clocks, on the minute)
    const timer = setInterval(() => setTick((n) => n + 1), 30_000)
    return () => {
      here = false
      clearInterval(timer)
    }
  }, [shown, again])

  const mine = got[place.id] ?? null
  const told = mine && 'told' in mine ? mine.told : null
  const sky = skyOf(told?.now)

  return (
    <Window
      className="app wtwin"
      data-sky={sky}
      sidebar={
        <nav className="wt-side" aria-label="Places">
          <ul>
            {PLACES.map((p) => (
              <Card key={p.id} place={p} got={got[p.id] ?? null} on={p.id === place.id} onPick={() => setAt(p.id)} />
            ))}
          </ul>
        </nav>
      }
      sidebarWidth={252}
      lightsSize="large"
      body={{ className: 'wtwin__body' }}
    >
      <div className="wt" data-autofocus tabIndex={-1}>
        {told ? (
          <Forecast place={place} told={told} />
        ) : mine && 'failed' in mine ? (
          <div className="wt-msg" role="status">
            <h1>{place.name}</h1>
            <p>The forecast didn’t arrive.</p>
            <button type="button" className="wt-btn" onClick={() => (setGot((g) => ({ ...g, [place.id]: null })), setAgain((n) => n + 1))}>
              Try Again
            </button>
          </div>
        ) : (
          <div className="wt-msg" role="status">
            <h1>{place.name}</h1>
            <p>Asking the National Weather Service…</p>
          </div>
        )}
      </div>
    </Window>
  )
}

/** A place, in the sidebar: its name and the time there, its sky in a word or two, the temperature, and the day's high and low. */
function Card({ place, got, on, onPick }: { place: Place; got: Got; on: boolean; onPick: () => void }) {
  const told = got && 'told' in got ? got.told : null
  const range = told ? rangeOf(told, place.zone) : null
  return (
    <li>
      <button type="button" className="wt-card" data-sky={skyOf(told?.now)} aria-current={on || undefined} onClick={onPick}>
        <span className="wt-card__top">
          <span>
            <b>{place.name}</b>
            <small>{clockIn(place.zone).format(Date.now())}</small>
          </span>
          {told && (
            <span className="wt-card__temp">
              {degrees(told.now.temp)}°<span className="sr-only">{FAHRENHEIT ? ' Fahrenheit' : ' Celsius'}</span>
            </span>
          )}
        </span>
        <span className="wt-card__foot">
          <span>{told ? told.now.says : got && 'failed' in got ? 'No forecast' : '…'}</span>
          {range && (
            <span>
              H:{degrees(range.high)}° L:{degrees(range.low)}°
            </span>
          )}
        </span>
      </button>
    </li>
  )
}

function Forecast({ place, told }: { place: Place; told: Told }) {
  const { now, hours, days } = told
  const range = rangeOf(told, place.zone)
  const hour = hourIn(place.zone)
  const clock = clockIn(place.zone)
  const sun = sunOf(place, Date.now())
  const tomorrow = sunOf(place, Date.now() + 86_400_000)
  // Whichever the sun does next is the one that is said large
  const next = sun && Date.now() < sun.rise ? { is: 'rise' as const, at: sun.rise, then: sun.set } : sun && Date.now() < sun.set ? { is: 'set' as const, at: sun.set, then: tomorrow?.rise ?? null } : tomorrow ? { is: 'rise' as const, at: tomorrow.rise, then: tomorrow.set } : null
  const rains = hours.filter((h) => h.rain !== null)
  const wettest = rains.reduce<Hour | null>((most, h) => (!most || (h.rain ?? 0) > (most.rain ?? 0) ? h : most), null)
  // The week's coldest and warmest: every day's bar is drawn against them
  const lows = days.map((d) => d.low ?? d.high).filter((n): n is number => n !== null)
  const highs = days.map((d) => d.high ?? d.low).filter((n): n is number => n !== null)
  const floor = Math.min(...lows, range.low)
  const roof = Math.max(...highs, range.high)
  const along = (temp: number) => (roof > floor ? ((temp - floor) / (roof - floor)) * 100 : 50)
  const Now = glyphOf(now.says, now.day)

  return (
    <div className="wt-col">
      <header className="wt-head">
        <h1>{place.name}</h1>
        <p className="wt-temp">
          {degrees(now.temp)}°<span className="sr-only">{FAHRENHEIT ? ' Fahrenheit' : ' Celsius'}</span>
        </p>
        <p className="wt-says">
          <Now size={17} strokeWidth={2.1} aria-hidden />
          {now.says}
        </p>
        <p className="wt-range">
          H:{degrees(range.high)}° L:{degrees(range.low)}°
        </p>
      </header>
      <div className="wt-tiles">
        <section className="wt-tile wt-tile--wide" aria-label="Hour by hour">
          <h2>
            <Clock size={12} strokeWidth={2.2} aria-hidden />
            Hourly forecast
          </h2>
          <ol className="wt-hours">
            {hours.slice(0, 24).map((h, i) => {
              const Glyph = glyphOf(h.says, h.day)
              return (
                <li key={h.at}>
                  <span>{i === 0 ? 'Now' : hour.format(h.at)}</span>
                  <Glyph size={20} strokeWidth={2} aria-label={h.says} role="img" />
                  <small>{h.rain !== null && h.rain >= 30 ? `${Math.round(h.rain)}%` : ''}</small>
                  <b>{degrees(h.temp)}°</b>
                </li>
              )
            })}
          </ol>
        </section>
        {days.length > 1 && (
          <section className="wt-tile wt-tile--tall" aria-label="Day by day">
            <h2>
              <CalendarDays size={12} strokeWidth={2.2} aria-hidden />
              {days.length}-day forecast
            </h2>
            <ol className="wt-days">
              {days.map((d, i) => (
                <Row key={d.at} d={d} name={i === 0 ? 'Today' : dayIn(place.zone).format(d.at)} along={along} now={i === 0 ? now.temp : null} />
              ))}
            </ol>
          </section>
        )}
        {now.wind !== null && (
          <section className="wt-tile" aria-label="Wind">
            <h2>
              <Wind size={12} strokeWidth={2.2} aria-hidden />
              Wind
            </h2>
            <div className="wt-compass" aria-hidden>
              <i>N</i>
              <i>E</i>
              <i>S</i>
              <i>W</i>
              {now.from && now.from in COMPASS && <span className="wt-needle" style={{ transform: `rotate(${COMPASS[now.from]!}deg)` }} />}
              <b>
                {now.wind}
                <small>mph</small>
              </b>
            </div>
            <p>{now.from ? `${now.wind} mph, from the ${fromWords(now.from)}.` : `${now.wind} mph.`}</p>
          </section>
        )}
        {now.humidity !== null && (
          <section className="wt-tile" aria-label="Humidity">
            <h2>
              <Droplets size={12} strokeWidth={2.2} aria-hidden />
              Humidity
            </h2>
            <b className="wt-big">{Math.round(now.humidity)}%</b>
            {now.dew !== null && <p>The dew point is {degrees(now.dew)}° right now.</p>}
          </section>
        )}
        {now.rain !== null && (
          <section className="wt-tile" aria-label="Chance of rain">
            <h2>
              <Umbrella size={12} strokeWidth={2.2} aria-hidden />
              Chance of rain
            </h2>
            <b className="wt-big">{Math.round(now.rain)}%</b>
            <p>{wettest && (wettest.rain ?? 0) > now.rain ? `Up to ${Math.round(wettest.rain!)}% by ${hour.format(wettest.at)}.` : 'No likelier in the hours to come.'}</p>
          </section>
        )}
        {next && (
          <section className="wt-tile" aria-label={next.is === 'set' ? 'Sunset' : 'Sunrise'}>
            <h2>
              {next.is === 'set' ? <Sunset size={12} strokeWidth={2.2} aria-hidden /> : <Sunrise size={12} strokeWidth={2.2} aria-hidden />}
              {next.is === 'set' ? 'Sunset' : 'Sunrise'}
            </h2>
            <b className="wt-big">{clock.format(next.at)}</b>
            {next.then !== null && (
              <p>
                {next.is === 'set' ? 'Sunrise' : 'Sunset'}: {clock.format(next.then)}
              </p>
            )}
          </section>
        )}
      </div>
      <p className="wt-foot">
        Weather for {place.name}, from the{' '}
        <a href={forecastPage(place)} target="_blank" rel="noopener noreferrer">
          National Weather Service
          <ArrowUpRight size={11} strokeWidth={2.4} aria-hidden />
          <span className="sr-only">, opens in a new tab</span>
        </a>
      </p>
    </div>
  )
}

/** A day of the week: its name, its sky, how likely rain is, and its low and high on a bar drawn against the week's. */
function Row({ d, name, along, now }: { d: Day; name: string; along: (temp: number) => number; now: number | null }) {
  const Glyph = glyphOf(d.says, d.day)
  const low = d.low ?? d.high
  const high = d.high ?? d.low
  return (
    <li>
      <span>{name}</span>
      <span className="wt-days__sky">
        <Glyph size={18} strokeWidth={2} aria-label={d.says} role="img" />
        {d.rain !== null && d.rain >= 30 && <small>{Math.round(d.rain)}%</small>}
      </span>
      <span className="wt-days__low">{low !== null ? `${degrees(low)}°` : ''}</span>
      <span className="wt-bar" aria-hidden>
        {low !== null && high !== null && <i style={{ left: `${along(low)}%`, right: `${100 - along(high)}%` }} />}
        {now !== null && <b style={{ left: `${Math.max(0, Math.min(100, along(now)))}%` }} />}
      </span>
      <b>{high !== null ? `${degrees(high)}°` : ''}</b>
    </li>
  )
}
