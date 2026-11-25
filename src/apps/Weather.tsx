import { useEffect, useState } from 'react'
import { ArrowUpRight, CalendarDays, Cloud, CloudRain, Droplet, Droplets, Moon as MoonGlyph, PanelLeft, Search, Sunrise, Sunset, Thermometer, Wind } from 'lucide-react'
import { Window } from '../kit/window'
import { useStore } from '../os/store'
import { degrees, FAHRENHEIT, feelsLike, forecastPage, moonOf, PLACES, readWeather, skyKind, skyLight, sunOf, type Day, type Hour, type Moon, type Place, type SkyKind, type SkyLight, type Told } from '../os/weather'
import { wm } from '../os/wm'
import { HorizonGlyph, SkyGlyph } from './weather/Glyph'
import { Sky } from './weather/Sky'
import '../styles/desk/weather.css'

// Weather, after the Mac's own as Dom's screenshots show it (macOS 26): a window that is the sky of the place
// that is picked, moving, as that sky is (apps/weather/Sky.tsx); the places down a pane of glass at the
// left, each a card with a sky of its own; and the place at length: its name, the temperature set large and
// thin, how it feels and the day's high and low, and under them tiles of darker glass. Feels Like, Wind
// and the hours ahead (which can be read as the sky, the rain or the wind) across the first row; then
// humidity, rain, the moon and the sun beside the week. The widget on the desk opens it.
//
// Everything it says is the National Weather Service's (os/weather.ts), asked by the visitor's browser when
// the window is open, or is worked out from that and from where the place is: how it feels (the Service's
// own wind chill and heat index), the sun's rising and setting, the moon's phase. What the Service does not
// give in these answers (air quality, UV, gusts, pressure, visibility, the moon's rising) has no tile and no
// line: nothing here is made up. A place whose forecast did not arrive says so, with a way to ask again.

type Got = { told: Told } | { failed: true } | null

const clockIn = (zone: string, more: Intl.DateTimeFormatOptions = {}) => new Intl.DateTimeFormat(undefined, { timeZone: zone, hour: 'numeric', minute: '2-digit', ...more })
const hourIn = (zone: string) => new Intl.DateTimeFormat(undefined, { timeZone: zone, hour: 'numeric' })
const dayIn = (zone: string) => new Intl.DateTimeFormat(undefined, { timeZone: zone, weekday: 'short' })
const dateIn = (zone: string) => new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' })

const COMPASS: Record<string, number> = { N: 0, NNE: 22.5, NE: 45, ENE: 67.5, E: 90, ESE: 112.5, SE: 135, SSE: 157.5, S: 180, SSW: 202.5, SW: 225, WSW: 247.5, W: 270, WNW: 292.5, NW: 315, NNW: 337.5 }
const UNIT = FAHRENHEIT ? '°F' : '°C'

/** The sky a place is under: what is in it, and the light it is in. Before its forecast has arrived, a clear day. */
const skyOf = (place: Place, now: Hour | undefined): { kind: SkyKind; light: SkyLight } => (now ? { kind: skyKind(now.says), light: skyLight(place, Date.now(), now.day) } : { kind: 'clear', light: 'day' })

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
  const [side, setSide] = useState(true)
  const [find, setFind] = useState('')
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
  const sky = skyOf(place, told?.now)
  const q = find.trim().toLowerCase()
  const places = PLACES.filter((p) => !q || p.name.toLowerCase().includes(q))

  return (
    <Window className="app wtwin" lightsSize="large" body={{ className: 'wtwin__body' }}>
      <div className="wt-app" data-kind={sky.kind} data-light={sky.light} data-side={side || undefined}>
        <Sky kind={sky.kind} light={sky.light} live={shown} />
        {side && (
          <nav className="wt-side" aria-label="Places">
            <label className="wt-find">
              <Search size={15} strokeWidth={2.2} aria-hidden />
              <input type="text" value={find} placeholder="Search" aria-label="Search the places" spellCheck={false} autoComplete="off" onChange={(e) => setFind(e.target.value)} />
            </label>
            <ul>
              {places.map((p) => (
                <Card key={p.id} place={p} got={got[p.id] ?? null} on={p.id === place.id} onPick={() => setAt(p.id)} />
              ))}
              {!places.length && <li className="wt-none">No place here is called that.</li>}
            </ul>
          </nav>
        )}
        {/* The pane of places is put away and brought back by the button at its head, where the Mac's is */}
        <button type="button" className="wt-fold" aria-label={side ? 'Hide the places' : 'Show the places'} aria-pressed={side} onClick={() => setSide((was) => !was)}>
          <PanelLeft size={17} strokeWidth={1.9} aria-hidden />
        </button>
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
      </div>
    </Window>
  )
}

/** A place, in the pane at the left: its name and the time there, its sky in a word or two, the temperature, and the day's high and low, on a sky of its own. */
function Card({ place, got, on, onPick }: { place: Place; got: Got; on: boolean; onPick: () => void }) {
  const told = got && 'told' in got ? got.told : null
  const range = told ? rangeOf(told, place.zone) : null
  const sky = skyOf(place, told?.now)
  return (
    <li>
      <button type="button" className="wt-card" aria-current={on || undefined} onClick={onPick}>
        <Sky kind={sky.kind} light={sky.light} still />
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

type Reading = 'sky' | 'rain' | 'wind'

function Forecast({ place, told }: { place: Place; told: Told }) {
  const { now, hours, days } = told
  const [reading, setReading] = useState<Reading>('sky')
  const range = rangeOf(told, place.zone)
  const hour = hourIn(place.zone)
  const clock = clockIn(place.zone)
  const at = Date.now()
  const sun = sunOf(place, at)
  const tomorrow = sunOf(place, at + 86_400_000)
  // Whichever the sun does next is the one that is said large
  const next = sun && at < sun.rise ? { is: 'rise' as const, at: sun.rise, then: sun.set } : sun && at < sun.set ? { is: 'set' as const, at: sun.set, then: tomorrow?.rise ?? null } : tomorrow ? { is: 'rise' as const, at: tomorrow.rise, then: tomorrow.set } : null
  const feels = feelsLike(now)
  const apart = degrees(feels) - degrees(now.temp)
  const moon = moonOf(at)
  const rains = hours.filter((h) => h.rain !== null)
  const wettest = rains.reduce<Hour | null>((most, h) => (!most || (h.rain ?? 0) > (most.rain ?? 0) ? h : most), null)
  // The week's coldest and warmest: every day's bar is drawn against them
  const lows = days.map((d) => d.low ?? d.high).filter((n): n is number => n !== null)
  const highs = days.map((d) => d.high ?? d.low).filter((n): n is number => n !== null)
  const floor = Math.min(...lows, range.low)
  const roof = Math.max(...highs, range.high)
  const along = (temp: number) => (roof > floor ? ((temp - floor) / (roof - floor)) * 100 : 50)

  // The hours ahead, with the sun's rising and setting set among them where they fall
  const ahead = hours.slice(0, 13)
  const suns = [sun, tomorrow].flatMap((s) => (s ? [{ is: 'rise' as const, at: s.rise }, { is: 'set' as const, at: s.set }] : [])).filter((s) => ahead.length > 1 && s.at > at && s.at < ahead[ahead.length - 1]!.end)
  const line: ({ hour: Hour; first: boolean } | { sun: 'rise' | 'set'; at: number })[] = []
  ahead.forEach((h, i) => {
    line.push({ hour: h, first: i === 0 })
    for (const s of suns) if (s.at >= Math.max(h.at, at) && s.at < h.end) line.push({ sun: s.is, at: s.at })
  })

  return (
    <div className="wt-col">
      <header className="wt-head">
        <h1>{place.name}</h1>
        <p className="wt-temp">
          {degrees(now.temp)}°<span className="sr-only">{FAHRENHEIT ? ' Fahrenheit' : ' Celsius'}</span>
        </p>
        <p className="wt-feel">
          <span className="sr-only">{now.says}. </span>
          Feels Like: {degrees(feels)}°
        </p>
        <p className="wt-range">
          H:{degrees(range.high)}° L:{degrees(range.low)}°
        </p>
      </header>
      <div className="wt-tiles">
        <section className="wt-tile" aria-label="Feels like">
          <h2>
            <Thermometer size={12} strokeWidth={2.2} aria-hidden />
            Feels like
          </h2>
          <b className="wt-big">{degrees(feels)}°</b>
          <b className="wt-mid">Actual: {degrees(now.temp)}°</b>
          {/* The gap between the two, on a line: the chip is how far, and which way */}
          <span className="wt-gap" data-way={apart < 0 ? 'down' : apart > 0 ? 'up' : 'same'} aria-hidden>
            <i>{apart === 0 ? '=' : `${apart < 0 ? '↓' : '↑'}${Math.abs(apart)}°`}</i>
          </span>
          <p>{apart < 0 ? 'Wind is making it feel colder.' : apart > 0 ? 'Humidity is making it feel warmer.' : 'Similar to the actual temperature.'}</p>
        </section>
        {now.wind !== null && (
          <section className="wt-tile" aria-label="Wind">
            <h2>
              <Wind size={12} strokeWidth={2.2} aria-hidden />
              Wind
            </h2>
            {/* The ring of ticks; and over it the letters, an arrow from where the wind is coming to where it is going, and the speed */}
            <div className="wt-compass" aria-hidden />
            <div className="wt-dial" aria-hidden>
              <i>N</i>
              <i>E</i>
              <i>S</i>
              <i>W</i>
              {now.from && now.from in COMPASS && (
                <svg viewBox="0 0 100 100" style={{ transform: `rotate(${COMPASS[now.from]!}deg)` }}>
                  {/* (from the ring's edge, outside the letters, to an arrowhead at the edge opposite) */}
                  <circle cx="50" cy="6" r="4.2" fill="#fff" />
                  <path d="M50 10V30M50 70V92M43.5 84 50 92.5l6.5-8.5" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
              <b>
                {now.wind}
                <small>mph</small>
              </b>
            </div>
            <p className="wt-centre">{now.from ? `From the ${now.from}` : `${now.wind} mph`}</p>
          </section>
        )}
        <section className="wt-tile wt-tile--wide" aria-label="The hours ahead">
          <header className="wt-cond">
            <span>
              <b>Conditions</b>
              <small>{reading === 'sky' ? `Temperature (${UNIT})` : reading === 'rain' ? 'Chance of rain' : 'Wind (mph)'}</small>
            </span>
            {/* Read as the sky, as the rain, or as the wind */}
            <span className="wt-seg" role="group" aria-label="Show">
              {(
                [
                  ['sky', 'Conditions', <Cloud key="sky" size={17} strokeWidth={0} fill="currentColor" aria-hidden />],
                  ['rain', 'Chance of rain', <Droplet key="rain" size={15} strokeWidth={0} fill="currentColor" aria-hidden />],
                  ['wind', 'Wind', <Wind key="wind" size={16} strokeWidth={2} aria-hidden />],
                ] as const
              ).map(([id, label, glyph]) => (
                <button key={id} type="button" aria-label={label} aria-pressed={reading === id} onClick={() => setReading(id)}>
                  {glyph}
                </button>
              ))}
            </span>
          </header>
          {/* (it runs on to the right: it takes the keyboard, so that the arrow keys can scroll it) */}
          <ol className="wt-hours" tabIndex={0} aria-label="Hour by hour">
            {line.map((entry) => {
              if ('sun' in entry)
                return (
                  <li key={`sun-${entry.at}`}>
                    <span>{clock.format(entry.at)}</span>
                    <HorizonGlyph is={entry.sun} />
                    <b>{entry.sun === 'set' ? 'Sunset' : 'Sunrise'}</b>
                  </li>
                )
              const h = entry.hour
              return (
                <li key={h.at}>
                  <span>{entry.first ? 'Now' : hour.format(h.at)}</span>
                  {reading === 'wind' ? (
                    <Wind size={22} strokeWidth={2} aria-hidden />
                  ) : reading === 'rain' ? (
                    <Droplet size={20} strokeWidth={0} fill="currentColor" aria-hidden />
                  ) : (
                    <SkyGlyph says={h.says} day={h.day} />
                  )}
                  <b>{reading === 'wind' ? (h.wind !== null ? h.wind : '–') : reading === 'rain' ? (h.rain !== null ? `${Math.round(h.rain)}%` : '–') : `${degrees(h.temp)}°`}</b>
                </li>
              )
            })}
          </ol>
        </section>
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
              <CloudRain size={12} strokeWidth={2.2} aria-hidden />
              Precipitation
            </h2>
            <b className="wt-big">{Math.round(now.rain)}%</b>
            <b className="wt-mid">this hour</b>
            <p>{wettest && (wettest.rain ?? 0) > now.rain ? `Up to ${Math.round(wettest.rain!)}% by ${hour.format(wettest.at)}.` : 'No likelier in the hours to come.'}</p>
          </section>
        )}
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
        <section className="wt-tile" aria-label={`The moon: ${moon.name}`}>
          <h2>
            <MoonGlyph size={12} strokeWidth={2.2} aria-hidden />
            {moon.name}
          </h2>
          <MoonFace moon={moon} />
          <p className="wt-centre">Illumination: {Math.round(moon.lit * 100)}%</p>
        </section>
        {next && (
          <section className="wt-tile" aria-label={next.is === 'set' ? 'Sunset' : 'Sunrise'}>
            <h2>
              {next.is === 'set' ? <Sunset size={12} strokeWidth={2.2} aria-hidden /> : <Sunrise size={12} strokeWidth={2.2} aria-hidden />}
              {next.is === 'set' ? 'Sunset' : 'Sunrise'}
            </h2>
            <b className="wt-big">{clock.format(next.at)}</b>
            <SunPath sun={sun} at={at} />
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
  const low = d.low ?? d.high
  const high = d.high ?? d.low
  return (
    <li>
      <span>{name}</span>
      <span className="wt-days__sky">
        <SkyGlyph says={d.says} day={d.day} size={21} />
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

/** The moon's face, as much of it lit as is lit tonight, and on the side it is lit from. */
function MoonFace({ moon }: { moon: Moon }) {
  // The lit part is a half disc and, beside it, an ellipse as wide as the terminator bulges: added before
  // the half (a gibbous moon), taken from it after (a crescent)
  const waxing = moon.phase < 0.5
  const bulge = Math.abs(Math.cos(2 * Math.PI * moon.phase)) * 40
  const gibbous = moon.lit > 0.5
  const half = waxing ? 'M50 10a40 40 0 0 1 0 80Z' : 'M50 10a40 40 0 0 0 0 80Z'
  // Its lit face: paler where the light falls full on it, with its seas, darker and soft at the edges
  const face = (
    <>
      <circle cx="50" cy="50" r="40" fill="url(#wt-moon-light)" />
      <g fill="#8f8c88" opacity="0.42" filter="url(#wt-moon-soft)">
        <ellipse cx="36" cy="33" rx="11" ry="9" />
        <ellipse cx="55" cy="30" rx="8" ry="6" />
        <ellipse cx="62" cy="43" rx="9" ry="8" />
        <ellipse cx="33" cy="52" rx="8" ry="11" />
        <ellipse cx="50" cy="62" rx="7" ry="5" />
        <ellipse cx="68" cy="58" rx="5" ry="6" />
      </g>
    </>
  )
  return (
    <svg className="wt-moon" viewBox="0 0 100 100" aria-hidden>
      <defs>
        <clipPath id="wt-moon-disc">
          <circle cx="50" cy="50" r="40" />
        </clipPath>
        {/* The lit part is the half and, for a gibbous moon, the bulge beside it */}
        <clipPath id="wt-moon-half">
          <path d={half} />
        </clipPath>
        <clipPath id="wt-moon-bulge">
          <ellipse cx="50" cy="50" rx={bulge} ry="40" />
        </clipPath>
        <radialGradient id="wt-moon-light" cx="42%" cy="38%" r="70%">
          <stop offset="0" stopColor="#f6f4ee" />
          <stop offset="0.7" stopColor="#dedbd2" />
          <stop offset="1" stopColor="#bdb9b0" />
        </radialGradient>
        <filter id="wt-moon-soft" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.2" />
        </filter>
      </defs>
      <circle cx="50" cy="50" r="40" fill="rgba(10, 16, 40, 0.5)" />
      <g clipPath="url(#wt-moon-disc)">
        <g clipPath="url(#wt-moon-half)">{face}</g>
        {gibbous ? <g clipPath="url(#wt-moon-bulge)">{face}</g> : <ellipse cx="50" cy="50" rx={bulge} ry="40" fill="rgb(22, 28, 54)" />}
      </g>
    </svg>
  )
}

/** The sun's day as a rise and a fall over the horizon, with the sun where it is on it now. */
function SunPath({ sun, at }: { sun: { rise: number; set: number } | null; at: number }) {
  if (!sun) return null
  // The sun's height through the day is a cosine about noon, which crosses the horizon at its rising and
  // its setting; the picture runs from an hour and a half before the one to as long after the other
  const DAY = 86_400_000
  const noon = (sun.rise + sun.set) / 2
  const edge = Math.cos((Math.PI * (sun.set - sun.rise)) / DAY)
  const from = sun.rise - 5_400_000
  const to = sun.set + 5_400_000
  const HORIZON = 30
  const y = (t: number) => Math.min(42, HORIZON - (22 * (Math.cos((2 * Math.PI * (t - noon)) / DAY) - edge)) / (1 - edge))
  const points = Array.from({ length: 41 }, (_, i) => `${(i / 40) * 100},${y(from + (i / 40) * (to - from)).toFixed(1)}`).join(' ')
  const now = Math.max(from, Math.min(to, at))
  return (
    <span className="wt-sunpath" aria-hidden>
      <svg viewBox="0 0 100 44" preserveAspectRatio="none">
        <polyline points={points} fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2.4" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        <line x1="0" y1={HORIZON} x2="100" y2={HORIZON} stroke="rgba(255,255,255,0.45)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      </svg>
      <i style={{ left: `${((now - from) / (to - from)) * 100}%`, top: `${(y(now) / 44) * 100}%` }} />
    </span>
  )
}
