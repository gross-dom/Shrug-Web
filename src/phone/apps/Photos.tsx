import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode, type Ref } from 'react'
import { Check, Heart, Image as ImageIcon, Images, Info, Layers, ListFilter, Play, Video } from 'lucide-react'
import { PUBLIC_CASE_STUDIES } from '../../data/caseStudies'
import { hasFile, hueOf, MEDIA, type MediaKind } from '../../data/drops'
import { DRAFT } from '../../data/site'
import { prefersReducedMotion } from '../../os/dom'
import { createStore, useStore } from '../../os/store'
import type { Ground, Tone } from '../chrome'
import { haptic, share } from '../native'
import { goHome, openSheet, pop, push, swap, sys, topOf } from '../system'
import { BackButton, Cell, Empty, GlassButton, GlassGroup, GroupButton, List, Menu, NavStack, Screen, Section, ShareGlyph, Sheet, SheetHost, scaleOf, useApp, usePageHeadingId, type MenuItem } from '../ui'
import { mediaView } from './routes'
import '../../styles/phone/photos.css'

// VIP on the phone: one screen of photos and videos from the people who got a
// drop, laid out as Photos lays out a collection: the first picture large at
// its head with the name and the count over its foot, then a grid of squares,
// and what sorts and filters them floating at the foot. Nothing else to find
// one's way round: no tabs, no albums, no search. A tap on a square opens it
// full screen, to swipe through the rest, with the row of small pictures and
// the toolbar Photos puts under one. None of the media has been supplied yet:
// fill in a `src` in src/data/drops.ts and the picture takes its slot's place.
// Until then a visitor is shown a quiet tile in the drop's own colour with its
// name on it ("On its way" when opened), and nothing is counted that is not
// there; with `?draft` in the address (`DRAFT`) every empty slot is drawn as
// the note that says what is missing, and counted, for whoever is filling them
// in. Nothing here has a date, so the parts of Photos that are made of dates
// are left out, not made up.

/** What the grid shows: all of it, or what Sort and Filter narrows it to. */
type Filter = 'all' | 'favorites' | MediaKind

interface Mine {
  filter: Filter
  /** What has been favorited. */
  loved: number[]
  /** What the viewer swipes through: the grid a picture was opened from, as it was then. */
  run: number[] | null
  /** The viewer's buttons are put away. */
  bare: boolean
}

/** What has been favorited is kept for the tab, so a reload (or a phone bringing the tab back by
 * itself) finds it again: in the tab's own storage, which nothing but this page reads and which goes
 * when the tab does. A frame that is refused storage simply starts with none. */
const KEPT = 'shrug:vip:loved'

function keptLoved(): number[] {
  try {
    const list: unknown = JSON.parse(window.sessionStorage.getItem(KEPT) ?? '[]')
    return Array.isArray(list) ? list.filter((i): i is number => Number.isInteger(i) && i >= 0 && i < MEDIA.length) : []
  } catch {
    return []
  }
}

function keepLoved(loved: number[]) {
  try {
    window.sessionStorage.setItem(KEPT, JSON.stringify(loved))
  } catch {
    // No storage here: it is kept for as long as the page is, as before
  }
}

/** What the app keeps while it is in the background. It lasts as long as the page does (the favorites, as long as the tab). */
const mine = createStore<Mine>({ filter: 'all', loved: keptLoved(), run: null, bare: false })

const setFilter = (filter: Filter) => mine.set((s) => (s.filter === filter ? s : { ...s, filter }))
const toggleLoved = (index: number) => {
  mine.set((s) => ({ ...s, loved: s.loved.includes(index) ? s.loved.filter((i) => i !== index) : [...s.loved, index] }))
  keepLoved(mine.get().loved)
}

/** Every item, by its place in MEDIA. */
const EVERYTHING = MEDIA.map((_, i) => i)
const ofKind = (kind: MediaKind) => EVERYTHING.filter((i) => MEDIA[i]!.kind === kind)
/** The favorites, in the library's order. */
const lovedOf = (loved: number[]) => EVERYTHING.filter((i) => loved.includes(i))

const shownBy = (filter: Filter, loved: number[]) => (filter === 'all' ? EVERYTHING : filter === 'favorites' ? lovedOf(loved) : ofKind(filter))

const count = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`

/** What there is to count: for a visitor, the photos and videos that have arrived; for the editor, every slot. */
const there = (indices: number[]) => (DRAFT ? indices : indices.filter((i) => hasFile(MEDIA[i]!)))

/** How many of each kind, as Photos writes it: 8 Photos, 4 Videos. Nothing at all, when none of them is there yet. */
function tally(indices: number[]) {
  const real = there(indices)
  const p = real.filter((i) => MEDIA[i]!.kind === 'photo').length
  const v = real.length - p
  return [p ? count(p, 'Photo') : '', v ? count(v, 'Video') : ''].filter(Boolean).join(', ')
}

// ---- A tile ----

/** One photo or video as a square: the picture, or the tile that keeps its
 * place, named for its drop. A video carries a play mark in its corner, where
 * Photos writes its length; a favorite, a heart. */
function Picture({ index, loved }: { index: number; loved?: boolean }) {
  const slot = MEDIA[index]!
  const video = slot.kind === 'video'
  return (
    <span className="photos-pic" data-kind={slot.kind} data-empty={!slot.src || undefined} data-draft={DRAFT || undefined} style={{ '--hue': hueOf(slot.drop) } as CSSProperties}>
      {slot.src ? (
        video ? (
          <video className="photos-pic__media" src={slot.src} muted playsInline preload="metadata" tabIndex={-1} />
        ) : (
          <img className="photos-pic__media" src={slot.src} alt="" loading="lazy" decoding="async" draggable={false} />
        )
      ) : (
        <span className="photos-pic__slot">
          {video ? <Video size={22} strokeWidth={1.7} aria-hidden /> : <ImageIcon size={22} strokeWidth={1.7} aria-hidden />}
          <span className="photos-pic__name">{slot.drop}</span>
        </span>
      )}
      {video && <Play className="photos-pic__play" size={13} strokeWidth={0} fill="currentColor" aria-hidden />}
      {loved && <Heart className="photos-pic__heart" size={13} strokeWidth={0} fill="currentColor" aria-hidden />}
    </span>
  )
}

/** What a tile is, for someone who is told it and not shown it. It holds the words the tile shows (its drop's name). */
const describe = (index: number) => {
  const slot = MEDIA[index]!
  const kind = slot.kind === 'video' ? 'Video' : 'Photo'
  if (slot.src) return `${kind} from ${slot.drop}${slot.from ? `, sent by ${slot.from}` : ''}`
  return DRAFT ? `${kind} slot from ${slot.drop}` : `${kind} from ${slot.drop}, on its way`
}

/** Opens one in the viewer, to swipe through the rest of the grid it was in. */
function view(index: number, run: number[]) {
  mine.set((s) => ({ ...s, run }))
  push(mediaView(index))
}

/** Photos' grid: equal squares, three across, edge to edge. */
function Grid({ indices }: { indices: number[] }) {
  const loved = useStore(mine, (s) => s.loved)
  return (
    <div className="photos-grid" role="list">
      {indices.map((i) => (
        <div key={i} role="listitem">
          <button type="button" className="photos-tile" aria-label={describe(i)} onClick={() => view(i, indices)}>
            <Picture index={i} loved={loved.includes(i)} />
          </button>
        </div>
      ))}
    </div>
  )
}

// ---- The grid ----

const FILTERS: { value: Filter; label: string; icon: ReactNode }[] = [
  { value: 'all', label: 'All Items', icon: <Images size={19} strokeWidth={2} /> },
  { value: 'favorites', label: 'Favorites', icon: <Heart size={19} strokeWidth={2} /> },
  { value: 'photo', label: 'Photos', icon: <ImageIcon size={19} strokeWidth={2} /> },
  { value: 'video', label: 'Videos', icon: <Video size={20} strokeWidth={2} /> },
]

/** What a filter says when nothing passes it. */
const NOTHING: Record<Exclude<Filter, 'all'>, { icon: ReactNode; title: string; text: string }> = {
  favorites: { icon: <Heart size={44} strokeWidth={1.5} />, title: 'No Favorites', text: 'Tap the heart on a photo or video to keep it here.' },
  photo: { icon: <ImageIcon size={44} strokeWidth={1.5} />, title: 'No Photos', text: 'Photos from the drops will show up here.' },
  video: { icon: <Video size={44} strokeWidth={1.5} />, title: 'No Videos', text: 'Videos from the drops will show up here.' },
}

/** Two colours mixed: `share` of the first, the rest the second. */
function mixed(a: string, b: string, share: number) {
  const part = (hex: string, at: number) => parseInt(hex.slice(at, at + 2), 16)
  return `#${[1, 3, 5].map((at) => Math.round(part(a, at) * share + part(b, at) * (1 - share)).toString(16).padStart(2, '0')).join('')}`
}

/** What is along the top edge of the picture that heads the library, which the status bar is over: a slot's
 * is its drop's colour in the dark (photos.css draws it the same); a picture that has arrived is taken as dark. */
const headTop = (index: number) => (MEDIA[index]!.src ? (MEDIA[index]!.edge ?? '#1c1c1e') : mixed(hueOf(MEDIA[index]!.drop), '#17171c', 0.5))

/** Whether the top of the head is pale enough that the status bar over it wants dark ink (a post on white paper, not a photograph). */
const paleTop = (index: number) => {
  const [r, g, b] = [1, 3, 5].map((at) => parseInt(headTop(index).slice(at, at + 2), 16) / 255) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.6
}

/** The head of the library, as a collection's is in Photos: its first picture, large, with the name and the
 * count over its foot. The name is the page's heading. The picture is pressed as its square in the grid is,
 * and opens the same: the button is laid over it and not round it, so that the heading stays a heading. */
function Head({ index, line, innerRef, onOpen }: { index: number; line: ReactNode; innerRef: Ref<HTMLDivElement>; onOpen: () => void }) {
  const headingId = usePageHeadingId()
  const slot = MEDIA[index]!
  return (
    <div ref={innerRef} className="photos-head" data-empty={!slot.src || undefined} style={{ '--hue': hueOf(slot.drop) } as CSSProperties}>
      {slot.src &&
        (slot.kind === 'video' ? (
          <video className="photos-head__media" src={slot.src} muted playsInline preload="metadata" tabIndex={-1} aria-hidden />
        ) : (
          <img className="photos-head__media" src={slot.src} alt="" decoding="async" draggable={false} />
        ))}
      <div className="photos-head__words">
        <h2 id={headingId} className="photos-head__title">
          VIP
        </h2>
        <p className="photos-head__line">{line}</p>
      </div>
      {/* After the words, so that the page's name is read before the picture under it is offered */}
      <button type="button" className="photos-head__open" aria-label={describe(index)} onClick={onOpen} />
    </div>
  )
}

/** What VIP is opening on, before its screens are there to say: the library, under the dark of the picture
 * at its head (which is what the status bar is over, and is read against), or one picture in its white room. */
export function photosFirst(top: string | null): { tone: Tone; ground?: Ground } {
  if (top?.startsWith('m:')) return { tone: 'plain' }
  const first = shownBy(mine.get().filter, mine.get().loved)[0]
  return first === undefined ? { tone: 'plain' } : { tone: paleTop(first) ? 'plain' : 'dark', ground: headTop(first) }
}

function Library() {
  const filter = useStore(mine, (s) => s.filter)
  const loved = useStore(mine, (s) => s.loved)
  const shown = useMemo(() => shownBy(filter, loved), [filter, loved])
  const items: MenuItem[] = FILTERS.map((f) => ({ label: f.label, icon: f.icon, checked: f.value === filter, divided: f.value === 'favorites', onSelect: () => setFilter(f.value) }))
  const none = filter === 'all' ? NOTHING.photo : NOTHING[filter]
  const first = shown[0]
  // The status bar is over the picture at the head until the page has scrolled it away
  const scroll = useRef<HTMLDivElement>(null)
  const head = useRef<HTMLDivElement>(null)
  const [past, setPast] = useState(false)
  const headed = first !== undefined
  useEffect(() => {
    const page = scroll.current
    if (!page || !headed) return setPast(false)
    const on = () => setPast(page.scrollTop > (head.current?.offsetHeight ?? 0) - 44)
    on()
    page.addEventListener('scroll', on, { passive: true })
    return () => page.removeEventListener('scroll', on)
  }, [headed])
  // Blue while it is narrowing the library, as the button is in Photos
  const sorter = (
    <Menu label="Sort and Filter" items={items} tint={filter !== 'all'} rise>
      <ListFilter size={24} strokeWidth={2.2} aria-hidden />
    </Menu>
  )

  // The way out, where a collection in Photos has Back to the rest of the app: VIP goes no further back than
  // this, and the Home Screen is next
  const home = <BackButton label="Home Screen" onClick={goHome} />

  if (first === undefined)
    return (
      <Screen title="VIP" className="photos-library" leading={home} foot={sorter}>
        <Empty icon={none.icon} title={none.title}>
          {none.text}
        </Empty>
      </Screen>
    )

  // Under the name: how many there are, once any have arrived (nothing is counted that is not there);
  // what is being shown, where it is not everything
  const real = there(shown).length
  const narrowed = filter === 'all' ? '' : FILTERS.find((f) => f.value === filter)!.label
  const line = real ? (
    <>
      <Layers size={15} strokeWidth={2.3} aria-hidden />
      {[narrowed, count(real, 'Item')].filter(Boolean).join(' · ')}
    </>
  ) : (
    narrowed
  )
  return (
    <Screen
      title="VIP"
      // The name is over the picture at the head of the page, and the bar is clear
      center={<></>}
      ownHeading
      className={`photos-library photos-library--headed${past ? ' photos-library--past' : ''}`}
      scrollRef={scroll}
      under={past ? undefined : paleTop(first) ? 'pale' : 'dark'}
      ground={past ? undefined : { top: headTop(first), foot: '#ffffff' }}
      leading={home}
      foot={sorter}
    >
      <Head innerRef={head} index={first} line={line} onOpen={() => view(first, shown)} />
      <Grid indices={shown} />
      {/* How Photos ends its library: what is in it, and a quieter line under that. Nothing is
          counted that has not arrived: until something has, nothing is said here */}
      {tally(shown) ? (
        <p className="photos-note">
          {tally(shown)}
        </p>
      ) : null}
    </Screen>
  )
}

// ---- The viewer ----

/** How far apart two neighbours sit while one is swiped to the next. */
const GAP = 16

/** How far down a picture is pulled, in points, before letting go of it closes the viewer. */
const PULLED_AWAY = 90

/** A menu is open in the app: the keys are the menu's until it closes. */
const menuOpen = () => !!document.querySelector('.sb-app[data-app="photos"] .ios-menu > [aria-expanded="true"]')

/** The row of small pictures over the toolbar, as Photos has one: every picture in the run, the one showing a
 * little wider and set apart from its neighbours, in the middle. A press on one turns to it. It says again
 * what the pictures themselves say, so it is the pointer's alone: the arrow keys and a swipe turn the pages. */
function Strip({ set, at, onPick }: { set: number[]; at: number; onPick: (page: number) => void }) {
  return (
    <div className="photos-strip" aria-hidden>
      <div className="photos-strip__row" style={{ '--at': at } as CSSProperties}>
        {set.map((i, page) => {
          const item = MEDIA[i]!
          return (
            <button key={i} type="button" tabIndex={-1} className="photos-strip__one" data-on={page === at || undefined} data-kind={item.kind} style={{ '--hue': hueOf(item.drop) } as CSSProperties} onClick={() => onPick(page)}>
              {item.src && item.kind === 'photo' && <img src={item.src} alt="" loading="lazy" decoding="async" draggable={false} />}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Viewer({ index }: { index: number }) {
  const { active } = useApp()
  const slot = MEDIA[index]!
  const loved = useStore(mine, (s) => s.loved.includes(index))
  const bare = useStore(mine, (s) => s.bare)
  const [copied, setCopied] = useState(false)
  const pager = useRef<HTMLDivElement>(null)
  const held = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout>>()
  // What a swipe goes through is the grid this was opened from, as it was then:
  // taking the heart off a favorite doesn't pull the picture from under the finger
  const [set] = useState(() => {
    const run = mine.get().run
    return run?.includes(index) ? run : EVERYTHING
  })
  const at = set.indexOf(index)
  const video = slot.kind === 'video'

  const stride = () => (pager.current ? pager.current.clientWidth + GAP : 1)
  const onTop = () => {
    const s = sys.get()
    return s.app === 'photos' && !s.sheet && topOf(s, 'photos') === mediaView(index)
  }

  // It opens on the one that was tapped, and stays on it when the screen changes size
  useLayoutEffect(() => {
    const el = pager.current
    if (!el) return
    const place = () => {
      el.scrollLeft = at * stride()
    }
    place()
    const ro = new ResizeObserver(place)
    ro.observe(el)
    return () => ro.disconnect()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /** The swipe has come to rest on a neighbour: that is the one this screen is showing now. */
  const settle = () => {
    const el = pager.current
    if (!el || held.current) return
    // A mouse's drag had the pages loose; they catch again now
    el.style.scrollSnapType = ''
    if (!onTop()) return
    const next = set[Math.round(el.scrollLeft / stride())]
    if (next !== undefined && next !== index) swap(mediaView(next))
  }

  const settleSoon = () => {
    clearTimeout(timer.current)
    timer.current = setTimeout(settle, 140)
  }

  useEffect(() => () => clearTimeout(timer.current), [])

  const glideTo = (page: number) => {
    pager.current?.scrollTo({ left: Math.max(0, Math.min(set.length - 1, page)) * stride(), behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
    settleSoon()
  }

  const step = (by: -1 | 1) => glideTo(at + by)

  // What a pointer does to the picture. Sideways it turns the pages: a finger scrolls them itself (the
  // browser's own scrolling, which photos.css leaves it, and that way only), and a mouse, which has no such
  // thing, drags them, to land on the next one after a fair pull. Downward, either pulls the picture off
  // the page, as Photos has it: the picture follows, and let go far enough down the viewer closes; let go
  // sooner, it springs back. Which of the two a movement is, is settled by its first few points and holds
  // until the pointer lifts, so that neither can turn into the other half-way.
  const drag = useRef<{ x: number; y: number; left: number; k: number; mouse: boolean; doing: 'turning' | 'pulling' | null; down: number } | null>(null)
  const dragged = useRef(false)

  /** What a pull moves: the picture that is showing (not its page, which the pages' own scrolling places). */
  const picture = () => pager.current?.children[at]?.firstElementChild as HTMLElement | null | undefined
  const room = () => pager.current?.closest<HTMLElement>('.ios-screen')

  /** The picture is `by` points down from where it sits, a little smaller the further it goes; the bars fade as it leaves. */
  const pullTo = (by: number) => {
    const el = picture()
    if (!el) return
    el.style.transition = 'none'
    el.style.transform = `translateY(${by}px) scale(${1 - Math.min(0.2, by / 1400)})`
    room()?.setAttribute('data-pulled', '')
    room()?.style.setProperty('--pulled', String(Math.min(1, by / 140)))
  }

  /** Back where it sits: at once, or on the spring everything here settles on. */
  const putBack = (spring: boolean) => {
    const el = picture()
    if (!el) return
    el.style.transition = spring && !prefersReducedMotion() ? 'transform 0.4s var(--spring), opacity 0.2s ease' : 'none'
    el.style.transform = ''
    el.style.opacity = ''
    room()?.removeAttribute('data-pulled')
    room()?.style.removeProperty('--pulled')
  }

  /** Let go far enough down: the picture carries on out of sight and the viewer goes, as Back would take it. */
  const pullAway = (from: number) => {
    const el = picture()
    if (el) {
      el.style.transition = prefersReducedMotion() ? 'none' : 'transform 0.3s ease-in, opacity 0.22s ease'
      el.style.transform = `translateY(${from + 220}px) scale(0.8)`
      el.style.opacity = '0'
    }
    pop()
    // Should the phone not have gone back (it takes one move at a time), the picture is not left out of sight
    setTimeout(() => onTop() && putBack(true), 700)
  }

  const down = (e: ReactPointerEvent<HTMLDivElement>) => {
    const el = pager.current
    // (A second finger is a pinch: whatever the first had begun is let go of)
    if (!e.isPrimary) return up(e)
    if (!el || (e.pointerType === 'mouse' && e.button !== 0) || (e.target as HTMLElement).closest('video')) return
    drag.current = { x: e.clientX, y: e.clientY, left: el.scrollLeft, k: scaleOf(el), mouse: e.pointerType === 'mouse', doing: null, down: 0 }
  }

  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current
    const el = pager.current
    if (!d || !el || !e.isPrimary) return
    const dx = (e.clientX - d.x) / d.k
    const dy = (e.clientY - d.y) / d.k
    if (!d.doing) {
      // Downward, and plainly so: a pull, if the pages are at rest on this picture. Sideways: a mouse's
      // drag (a finger's is the browser's, which says so by taking the pointer away: `up`, below)
      if (dy > 8 && dy > Math.abs(dx) * 1.5 && Math.abs(el.scrollLeft - at * stride()) < 2) d.doing = 'pulling'
      else if (d.mouse && Math.abs(dx) >= 5) d.doing = 'turning'
      else return
      held.current = true
      el.setPointerCapture(e.pointerId)
      if (d.doing === 'turning') el.style.scrollSnapType = 'none'
    }
    if (d.doing === 'turning') el.scrollLeft = d.left - dx
    else pullTo((d.down = Math.max(0, dy)))
  }

  const up = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current
    const el = pager.current
    drag.current = null
    if (!d?.doing || !el) return
    held.current = false
    // The click that ends a drag is not a tap on the picture
    dragged.current = true
    setTimeout(() => (dragged.current = false), 0)
    if (d.doing === 'pulling') {
      // (taken away, not lifted: the browser had another use for the pointer, and nothing is closed by that)
      if (e.type === 'pointerup' && d.down > PULLED_AWAY) pullAway(d.down)
      else putBack(true)
      return
    }
    const dx = (e.clientX - d.x) / d.k
    const from = Math.round(d.left / stride())
    glideTo(Math.abs(dx) > el.clientWidth * 0.16 ? from + (dx < 0 ? 1 : -1) : from)
  }

  // The arrow keys turn to the next one
  useEffect(() => {
    if (!active) return
    const key = (e: KeyboardEvent) => {
      if ((e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') || !onTop() || menuOpen() || (e.target as HTMLElement).closest?.('input, textarea')) return
      e.preventDefault()
      step(e.key === 'ArrowRight' ? 1 : -1)
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [active, at, set]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Screen
      title={`${slot.drop}, ${video ? 'video' : 'photo'}`}
      // A white room for the picture, as Photos shows one; with the buttons put away it is a black one
      tone={bare ? 'dark' : 'plain'}
      fixed
      className={`photos-viewer${bare ? ' photos-viewer--bare' : ''}`}
      center={
        // What it is, in two small lines on a piece of glass, where Photos writes the day and the hour
        <span className="ios-glass photos-viewer__title">
          <b>{slot.drop}</b>
          <span>{video ? 'Video' : 'Photo'}</span>
        </span>
      }
      foot={
        <>
          <Strip set={set} at={at} onPick={glideTo} />
          {/* The toolbar's own things, as one set (they are laid out by the foot itself: this box is not one) */}
          <div className="photos-tools">
          {/* Nothing to share until the picture is there */}
          {slot.src || DRAFT ? (
            <GlassButton
              label={copied ? 'Link copied' : 'Share'}
              onClick={async () => {
                const how = await share({ title: slot.drop, text: `${video ? 'A video' : 'A photo'} from ${slot.drop}, a Shrug drop.` })
                if (how !== 'copied') return
                setCopied(true)
                setTimeout(() => setCopied(false), 1700)
              }}
            >
              {copied ? <Check size={22} strokeWidth={2.6} aria-hidden /> : <ShareGlyph />}
            </GlassButton>
          ) : (
            <span aria-hidden />
          )}
          <GlassGroup label={video ? 'Video' : 'Photo'}>
            <GroupButton
              label={loved ? 'Unfavorite' : 'Favorite'}
              onClick={() => {
                haptic()
                toggleLoved(index)
              }}
            >
              <Heart className="photos-heart" data-on={loved || undefined} size={25} strokeWidth={2} fill={loved ? 'currentColor' : 'none'} aria-hidden />
            </GroupButton>
            <GroupButton label="Info" onClick={() => openSheet('info')}>
              <Info size={25} strokeWidth={2} aria-hidden />
            </GroupButton>
          </GlassGroup>
          <span aria-hidden />
          </div>
        </>
      }
    >
      <div
        ref={pager}
        className="photos-pager"
        role="group"
        aria-roledescription="carousel"
        tabIndex={0}
        aria-label={`${describe(index)}. ${at + 1} of ${set.length}.`}
        onScroll={settleSoon}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        // A tap on the picture puts the buttons away, and brings them back
        onClick={(e) => !dragged.current && !(e.target as HTMLElement).closest('video') && mine.set((s) => ({ ...s, bare: !s.bare }))}
        onTouchStart={() => {
          held.current = true
          clearTimeout(timer.current)
        }}
        onTouchEnd={() => {
          held.current = false
          settleSoon()
        }}
        onTouchCancel={() => {
          held.current = false
          settleSoon()
        }}
      >
        {set.map((i) => {
          const item = MEDIA[i]!
          const film = item.kind === 'video'
          return (
            // The neighbours are there to be swiped to, and for nothing else until they are the one showing
            <div key={i} className="photos-page" aria-hidden={i === index ? undefined : true} {...(i === index ? null : ({ inert: '' } as object))}>
              {item.src ? (
                film ? (
                  <video className="photos-page__media" src={item.src} controls playsInline preload="metadata" />
                ) : (
                  <img className="photos-page__media" src={item.src} alt={describe(i)} loading={i === index ? 'eager' : 'lazy'} decoding="async" draggable={false} />
                )
              ) : (
                <div className="photos-big" data-kind={item.kind} data-draft={DRAFT || undefined} style={{ '--hue': hueOf(item.drop) } as CSSProperties}>
                  {film ? <Video size={40} strokeWidth={1.4} aria-hidden /> : <ImageIcon size={40} strokeWidth={1.4} aria-hidden />}
                  {/* The tile it was opened from, large: its drop, and that it is on its way (to the editor: which slot it is) */}
                  {DRAFT && <b>{film ? 'Video slot' : 'Photo slot'}</b>}
                  <span>{item.drop}</span>
                  {!DRAFT && <b>On its way</b>}
                  {film && <Play className="photos-pic__play" size={18} strokeWidth={0} fill="currentColor" aria-hidden />}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </Screen>
  )
}

/** The public case study that goes with a drop: the one of the company the drop is named for (“Alt x Shrug” is Alt's). */
const studyOf = (drop: string) => PUBLIC_CASE_STUDIES.find((study) => drop.toLowerCase().startsWith(study.name.toLowerCase() + ' ')) ?? null

/** What Info brings up: where the picture is from. */
function InfoSheet() {
  const top = useStore(sys, (s) => topOf(s, 'photos'))
  // The sheet outlives the screen it was opened on by a moment: it keeps what it was showing
  const last = useRef<number | null>(null)
  if (top?.startsWith('m:')) last.current = Number(top.slice(2))
  const slot = last.current === null ? undefined : MEDIA[last.current]
  if (!slot) return null
  const study = studyOf(slot.drop)
  return (
    <Sheet label="Info" title="Info" detent="medium">
      <List>
        <Section footer={slot.src ? undefined : DRAFT ? 'Nothing has been supplied for this slot yet. The picture takes its place when it is.' : 'This one hasn’t come in yet. It shows here when it does.'}>
          <Cell title="Drop" value={slot.drop} />
          <Cell title="Kind" value={slot.kind === 'video' ? 'Video' : 'Photo'} />
          {/* The case study of the company the drop was made with, where Shrug has one anyone can read */}
          {study && <Cell title="Case Study" value={study.name} href={study.url} chevron />}
          {/* Who sent it, once that is known (the editor is shown that it is not) */}
          {(slot.from || DRAFT) && <Cell title="From" value={slot.from ?? 'Not supplied yet'} />}
        </Section>
      </List>
    </Sheet>
  )
}

// ---- The app ----

/** What a view in the app's stack shows: the grid, or one of its pictures in the viewer. */
function Page({ view: name }: { view: string | null }) {
  if (name === null) return <Library />
  const index = name.startsWith('m:') ? Number(name.slice(2)) : NaN
  if (Number.isInteger(index) && MEDIA[index]) return <Viewer index={index} />
  return (
    <Screen title="Not Found" className="photos-screen">
      <Empty icon={<Images size={44} strokeWidth={1.5} />} title="No Longer Here">
        That isn’t in the library.
      </Empty>
    </Screen>
  )
}

export function PhotosApp() {
  const viewing = useStore(sys, (s) => s.stacks.photos.some((name) => name.startsWith('m:')))

  // Out of the viewer (once it has slid away) its buttons are back for next time, and what it swiped through is let go
  useEffect(() => {
    if (viewing) return
    const t = setTimeout(() => mine.set((s) => (s.bare || s.run ? { ...s, bare: false, run: null } : s)), 600)
    return () => clearTimeout(t)
  }, [viewing])

  // Closed for good (flicked out of the App Switcher), it starts over next time. What was favorited
  // stays, and the filter, as Photos keeps them.
  useEffect(() => () => mine.set((s) => ({ ...s, run: null, bare: false })), [])

  return (
    <div className="photos-app">
      <NavStack>{(name) => <Page view={name} />}</NavStack>
      <SheetHost>{(name) => (name === 'info' ? <InfoSheet /> : null)}</SheetHost>
    </div>
  )
}
