import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { Check, Ellipsis, Heart, Image as ImageIcon, Images, Info, LayoutGrid, Play, Share, Video } from 'lucide-react'
import { photos, setMediaFilter, type MediaFilter } from '../../apps/state'
import { DROPS, MEDIA } from '../../data/drops'
import { prefersReducedMotion } from '../../os/dom'
import { createStore, useStore } from '../../os/store'
import { haptic, share } from '../native'
import { openSheet, pop, push, swap, sys, topOf } from '../system'
import { Cell, Empty, GlassGroup, GroupButton, List, Menu, NavStack, Screen, Section, Segments, Sheet, SheetHost, TabBar, scaleOf, useApp, type Tab } from '../ui'
import { albumView, mediaView } from './routes'
import '../../styles/phone/photos.css'

// VIP on the phone: the Photos app. The Library is every photo and video from
// the people who got a drop, as a grid of squares; Collections has each drop
// as an album; a tap opens one full screen, to swipe through. None of the
// media has been supplied yet, so every tile is the slot one will go in: fill
// in a `src` in src/data/drops.ts and the picture takes its slot's place.

type TabId = 'library' | 'collections'

/** What the app keeps while it is in the background: the tab that is showing,
 * what has been favorited, and whether the viewer's buttons are put away. */
const mine = createStore<{ tab: TabId; swapped: boolean; loved: number[]; bare: boolean }>({ tab: 'library', swapped: false, loved: [], bare: false })

const showTab = (tab: TabId) => mine.set((s) => (s.tab === tab ? s : { ...s, tab, swapped: true }))
const toggleLoved = (index: number) => mine.set((s) => ({ ...s, loved: s.loved.includes(index) ? s.loved.filter((i) => i !== index) : [...s.loved, index] }))

const TABS: Tab<TabId>[] = [
  { id: 'library', label: 'Library', icon: <Images size={25} strokeWidth={2} /> },
  { id: 'collections', label: 'Collections', icon: <LayoutGrid size={24} strokeWidth={2} /> },
]

const FILTERS: { value: MediaFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'photo', label: 'Photos' },
  { value: 'video', label: 'Videos' },
]

/** Every item, by its place in MEDIA. */
const EVERYTHING = MEDIA.map((_, i) => i)
const inDrop = (drop: string) => EVERYTHING.filter((i) => MEDIA[i]!.drop === drop)
const ofKind = (filter: MediaFilter) => (filter === 'all' ? EVERYTHING : EVERYTHING.filter((i) => MEDIA[i]!.kind === filter))

const PHOTOS = ofKind('photo').length
const VIDEOS = ofKind('video').length

const count = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`

/** How many of each kind, as Photos writes it: 8 Photos, 4 Videos. */
function tally(indices: number[]) {
  const p = indices.filter((i) => MEDIA[i]!.kind === 'photo').length
  const v = indices.length - p
  return [p ? count(p, 'Photo') : '', v ? count(v, 'Video') : ''].filter(Boolean).join(', ') || 'No Items'
}

/** A slot's ground takes its colour from its drop, so a drop looks the same
 * wherever it turns up and the grid doesn't read as a gray wall. */
const HUES = ['#3f8cff', '#8a6dff', '#ff66b8', '#ffa63d', '#2bbfa4', '#ff5a3c', '#2b55cf', '#3fb8e0']
const hueOf = (drop: string) => HUES[Math.max(0, DROPS.indexOf(drop)) % HUES.length]!

// ---- A tile ----

/** One photo or video as a square: the picture, or the slot it will go in. A
 * video carries a play mark in its corner, as Photos marks one; a favorite, a
 * heart. A slot is named for its drop, except where that is already said: an
 * album's `cover` has the name under it, and `within` an album every slot is
 * from the one drop, so each says what kind of slot it is instead. */
function Picture({ index, loved, cover, within }: { index: number; loved?: boolean; cover?: boolean; within?: boolean }) {
  const slot = MEDIA[index]!
  const video = slot.kind === 'video'
  return (
    <span className="photos-pic" data-kind={slot.kind} data-empty={!slot.src || undefined} style={{ '--hue': hueOf(slot.drop) } as CSSProperties}>
      {slot.src ? (
        video ? (
          <video className="photos-pic__media" src={slot.src} muted playsInline preload="metadata" tabIndex={-1} />
        ) : (
          <img className="photos-pic__media" src={slot.src} alt="" loading="lazy" decoding="async" draggable={false} />
        )
      ) : (
        <span className="photos-pic__slot">
          {video ? <Video size={22} strokeWidth={1.7} aria-hidden /> : <ImageIcon size={22} strokeWidth={1.7} aria-hidden />}
          {!cover && <span className="photos-pic__name">{within ? (video ? 'Video slot' : 'Photo slot') : slot.drop}</span>}
        </span>
      )}
      {video && <Play className="photos-pic__play" size={13} strokeWidth={0} fill="currentColor" aria-hidden />}
      {loved && <Heart className="photos-pic__heart" size={13} strokeWidth={0} fill="currentColor" aria-hidden />}
    </span>
  )
}

const describe = (index: number) => {
  const slot = MEDIA[index]!
  const kind = slot.kind === 'video' ? 'Video' : 'Photo'
  return `${kind} from ${slot.drop}${slot.from ? `, sent by ${slot.from}` : slot.src ? '' : ', not supplied yet'}`
}

/** Photos' grid: equal squares, three across, edge to edge. */
function Grid({ indices, album }: { indices: number[]; album?: boolean }) {
  const loved = useStore(mine, (s) => s.loved)
  return (
    <div className="photos-grid" role="list">
      {indices.map((i) => (
        <div key={i} role="listitem">
          <button type="button" className="photos-tile" aria-label={describe(i)} onClick={() => push(mediaView(i))}>
            <Picture index={i} loved={loved.includes(i)} within={album} />
          </button>
        </div>
      ))}
    </div>
  )
}

// ---- The tab bar ----

/** Library and Collections, floating at the foot. A tab's own button, pressed
 * from deeper in, goes back to its first screen, as a tab bar's does. */
function Tabs({ deep }: { deep?: boolean }) {
  const tab = useStore(mine, (s) => s.tab)
  return (
    <TabBar
      label="Photos"
      tabs={TABS}
      value={tab}
      onChange={(id) => {
        showTab(id)
        if (deep) pop()
      }}
    />
  )
}

// ---- Library ----

function Library() {
  const filter = useStore(photos, (s) => s.filter)
  const shown = useMemo(() => ofKind(filter), [filter])
  return (
    <Screen
      title="Library"
      large
      className="photos-library"
      header={<p className="photos-sub">{tally(EVERYTHING)}</p>}
      foot={
        <div className="photos-foot">
          {/* Where Photos keeps Years, Months and All: here it is the kind */}
          <div className="ios-glass photos-seg">
            <Segments label="Show" value={filter} options={FILTERS} onChange={setMediaFilter} />
          </div>
          <Tabs />
        </div>
      }
    >
      {shown.length ? (
        <>
          <Grid indices={shown} />
          <p className="photos-note">
            {tally(shown)}
            <br />
            From the people who got a drop.
          </p>
        </>
      ) : (
        <Empty icon={filter === 'video' ? <Video size={44} strokeWidth={1.5} /> : <ImageIcon size={44} strokeWidth={1.5} />} title={filter === 'video' ? 'No Videos' : 'No Photos'}>
          {filter === 'video' ? 'Videos' : 'Photos'} from the drops will show up here.
        </Empty>
      )}
    </Screen>
  )
}

// ---- Collections ----

function Collections() {
  const kind = (filter: MediaFilter) => {
    setMediaFilter(filter)
    showTab('library')
  }
  return (
    <Screen
      title="Collections"
      large
      className="photos-collections"
      foot={
        <div className="photos-foot">
          <Tabs />
        </div>
      }
    >
      <h3 className="photos-head">
        Drops <span>{DROPS.length}</span>
      </h3>
      <div className="photos-albums" role="list">
        {DROPS.map((drop) => {
          const items = inDrop(drop)
          return (
            <div key={drop} role="listitem">
              <button type="button" className="photos-album" aria-label={`${drop}, ${count(items.length, 'item')}`} onClick={() => push(albumView(drop))}>
                <span className="photos-album__cover">{items.length > 0 && <Picture index={items[0]!} cover />}</span>
                <span className="photos-album__name">{drop}</span>
                <span className="photos-album__count">{items.length}</span>
              </button>
            </div>
          )
        })}
      </div>
      <h3 className="photos-head">Media Types</h3>
      <List className="photos-types">
        <Section>
          <Cell lead={<Video size={22} strokeWidth={2} aria-hidden />} title="Videos" value={VIDEOS} chevron onClick={() => kind('video')} />
          <Cell lead={<ImageIcon size={22} strokeWidth={2} aria-hidden />} title="Photos" value={PHOTOS} chevron onClick={() => kind('photo')} />
        </Section>
      </List>
    </Screen>
  )
}

/** The two tabs. Both stay drawn, so each is where it was left when its turn comes round again. */
function Home() {
  const tab = useStore(mine, (s) => s.tab)
  const swapped = useStore(mine, (s) => s.swapped)
  const pane = (id: TabId, body: JSX.Element) => (
    <div className="photos-tab" data-on={tab === id || undefined} data-swapped={swapped || undefined} {...(tab === id ? null : ({ inert: '' } as object))}>
      {body}
    </div>
  )
  return (
    <>
      {pane('library', <Library />)}
      {pane('collections', <Collections />)}
    </>
  )
}

// ---- An album ----

function Album({ drop, depth }: { drop: string; depth: number }) {
  const items = useMemo(() => inDrop(drop), [drop])
  return (
    <Screen
      title={drop}
      className="photos-album-screen"
      // The tab bar stays through an album opened from Collections, as it does in Photos
      foot={
        depth === 1 ? (
          <div className="photos-foot">
            <Tabs deep />
          </div>
        ) : undefined
      }
    >
      {items.length ? (
        <>
          <Grid indices={items} album />
          <p className="photos-note">{tally(items)}</p>
        </>
      ) : (
        <Empty icon={<Images size={44} strokeWidth={1.5} />} title="No Photos or Videos">
          Nothing from this drop yet.
        </Empty>
      )}
    </Screen>
  )
}

// ---- The viewer ----

/** How far apart two neighbours sit while one is swiped to the next. */
const GAP = 16

/** A menu is open in the app: the keys are the menu's until it closes. */
const menuOpen = () => !!document.querySelector('.sb-app[data-app="photos"] .ios-menu > [aria-expanded="true"]')

/** What a swipe goes through: the album the item was opened from, or the library as it was filtered. */
function setFor(index: number, under: string | null, filter: MediaFilter) {
  const set = under?.startsWith('a:') ? inDrop(under.slice(2)) : ofKind(filter)
  return set.includes(index) ? set : EVERYTHING
}

function Viewer({ index, under }: { index: number; under: string | null }) {
  const { active } = useApp()
  const slot = MEDIA[index]!
  const filter = useStore(photos, (s) => s.filter)
  const loved = useStore(mine, (s) => s.loved.includes(index))
  const bare = useStore(mine, (s) => s.bare)
  const [copied, setCopied] = useState(false)
  const pager = useRef<HTMLDivElement>(null)
  const held = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout>>()
  const set = useMemo(() => setFor(index, under, filter), [index, under, filter])
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

  // A finger scrolls the pages itself. A mouse has no such thing, so it drags them:
  // the pages follow it, and land on the next one after a fair pull
  const drag = useRef<{ x: number; left: number; k: number; moved: boolean } | null>(null)
  const dragged = useRef(false)

  const down = (e: ReactPointerEvent<HTMLDivElement>) => {
    const el = pager.current
    if (!el || e.pointerType !== 'mouse' || e.button !== 0 || (e.target as HTMLElement).closest('video')) return
    drag.current = { x: e.clientX, left: el.scrollLeft, k: scaleOf(el), moved: false }
  }

  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current
    const el = pager.current
    if (!d || !el) return
    const dx = (e.clientX - d.x) / d.k
    if (!d.moved) {
      if (Math.abs(dx) < 5) return
      d.moved = true
      held.current = true
      el.setPointerCapture(e.pointerId)
      el.style.scrollSnapType = 'none'
    }
    el.scrollLeft = d.left - dx
  }

  const up = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current
    const el = pager.current
    drag.current = null
    if (!d?.moved || !el) return
    held.current = false
    // The click that ends a drag is not a tap on the picture
    dragged.current = true
    setTimeout(() => (dragged.current = false), 0)
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

  const album = albumView(slot.drop)
  return (
    <Screen
      title={`${slot.drop}, ${video ? 'video' : 'photo'}`}
      tone="dark"
      fixed
      className={`photos-viewer${bare ? ' photos-viewer--bare' : ''}`}
      center={
        <span className="photos-viewer__title">
          <b>{slot.drop}</b>
          <span>
            {video ? 'Video' : 'Photo'} · {at + 1} of {set.length}
          </span>
        </span>
      }
      trailing={
        <Menu
          label="More"
          items={[
            // From its own album, that is the screen underneath
            { label: 'Show in Collections', icon: <LayoutGrid size={19} strokeWidth={2} />, onSelect: () => (under === album ? pop() : push(album)) },
            { label: loved ? 'Unfavorite' : 'Favorite', icon: <Heart size={19} strokeWidth={2} fill={loved ? 'currentColor' : 'none'} />, onSelect: () => toggleLoved(index) },
          ]}
        >
          <Ellipsis size={24} strokeWidth={2.2} aria-hidden />
        </Menu>
      }
      foot={
        <div className="photos-tools">
          <GlassGroup label="Photo">
            <GroupButton
              label={copied ? 'Link copied' : 'Share'}
              onClick={async () => {
                const how = await share({ title: slot.drop, text: `${video ? 'A video' : 'A photo'} from ${slot.drop}, a Shrug drop.` })
                if (how !== 'copied') return
                setCopied(true)
                setTimeout(() => setCopied(false), 1700)
              }}
            >
              {copied ? <Check size={22} strokeWidth={2.6} aria-hidden /> : <Share size={21} strokeWidth={2.1} aria-hidden />}
            </GroupButton>
            <GroupButton
              label={loved ? 'Unfavorite' : 'Favorite'}
              onClick={() => {
                haptic()
                toggleLoved(index)
              }}
            >
              <Heart className="photos-heart" data-on={loved || undefined} size={22} strokeWidth={2.1} fill={loved ? 'currentColor' : 'none'} aria-hidden />
            </GroupButton>
            <GroupButton label="Info" onClick={() => openSheet('info')}>
              <Info size={22} strokeWidth={2.1} aria-hidden />
            </GroupButton>
          </GlassGroup>
        </div>
      }
    >
      <div
        ref={pager}
        className="photos-pager"
        role="group"
        aria-roledescription="carousel"
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
                <div className="photos-big" data-kind={item.kind} style={{ '--hue': hueOf(item.drop) } as CSSProperties}>
                  {film ? <Video size={40} strokeWidth={1.4} aria-hidden /> : <ImageIcon size={40} strokeWidth={1.4} aria-hidden />}
                  <b>{film ? 'Video slot' : 'Photo slot'}</b>
                  <span>{item.drop}</span>
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

/** What Info brings up: where the picture is from. */
function InfoSheet() {
  const top = useStore(sys, (s) => topOf(s, 'photos'))
  // The sheet outlives the screen it was opened on by a moment: it keeps what it was showing
  const last = useRef<number | null>(null)
  if (top?.startsWith('m:')) last.current = Number(top.slice(2))
  const slot = last.current === null ? undefined : MEDIA[last.current]
  if (!slot) return null
  return (
    <Sheet label="Info" title="Info" detent="medium">
      <List>
        <Section footer={slot.src ? undefined : 'Nothing has been supplied for this slot yet. The picture takes its place when it is.'}>
          <Cell title="Drop" value={slot.drop} />
          <Cell title="Kind" value={slot.kind === 'video' ? 'Video' : 'Photo'} />
          <Cell title="From" value={slot.from ?? 'Not supplied yet'} />
        </Section>
      </List>
    </Sheet>
  )
}

// ---- The app ----

export function PhotosApp() {
  const { active } = useApp()
  const stack = useStore(sys, (s) => s.stacks.photos)
  const viewing = stack[stack.length - 1]?.startsWith('m:') ?? false

  // Escape goes back a screen: out of the viewer, out of an album. A sheet or a menu that is open takes it first.
  useEffect(() => {
    if (!active) return
    const key = (e: KeyboardEvent) => {
      const s = sys.get()
      if (e.key !== 'Escape' || e.defaultPrevented || s.app !== 'photos' || s.sheet || !s.stacks.photos.length || menuOpen()) return
      e.preventDefault()
      pop()
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [active])

  // Out of the viewer, its buttons are back for next time (once it has slid away)
  useEffect(() => {
    if (viewing) return
    const t = setTimeout(() => mine.set((s) => (s.bare ? { ...s, bare: false } : s)), 600)
    return () => clearTimeout(t)
  }, [viewing])

  // Come back to (a reload) inside an album: that album is under Collections, so that is the tab Back leads to
  useEffect(() => {
    if (sys.get().stacks.photos[0]?.startsWith('a:')) mine.set((s) => (s.tab === 'collections' ? s : { ...s, tab: 'collections' }))
  }, [])

  return (
    <>
      <NavStack>
        {(view, depth) => {
          if (view === null) return <Home />
          if (view.startsWith('a:')) return <Album drop={view.slice(2)} depth={depth} />
          const index = view.startsWith('m:') ? Number(view.slice(2)) : NaN
          if (Number.isInteger(index) && MEDIA[index]) return <Viewer index={index} under={depth >= 2 ? (stack[depth - 2] ?? null) : null} />
          return (
            <Screen title="Not Found">
              <Empty icon={<Images size={44} strokeWidth={1.5} />} title="No Longer Here">
                That photo isn’t in the library.
              </Empty>
            </Screen>
          )
        }}
      </NavStack>
      <SheetHost>{(name) => (name === 'info' ? <InfoSheet /> : null)}</SheetHost>
    </>
  )
}
