import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject } from 'react'
import { flushSync } from 'react-dom'
import { ArrowUpDown, Check, ChevronRight, Clock, Ellipsis, Heart, Image as ImageIcon, Images, Info, Play, Search, Share, Video, X } from 'lucide-react'
import { DROPS, hasFile, hueOf, MEDIA, type MediaKind } from '../../data/drops'
import { DRAFT } from '../../data/site'
import { prefersReducedMotion } from '../../os/dom'
import { createStore, useStore } from '../../os/store'
import { haptic, share } from '../native'
import { launchAt, openSheet, pop, push, swap, sys, topOf } from '../system'
import { Cell, Empty, GlassButton, GlassGroup, GroupButton, List, Menu, NavStack, Screen, SearchBar, Section, Sheet, SheetHost, TabBar, scaleOf, useApp, type MenuItem, type Tab } from '../ui'
import { albumView, mediaView } from './routes'
import '../../styles/phone/photos.css'

// VIP on the phone: the Photos app, laid out as iOS lays it out. The Library
// tab is every photo and video from the people who got a drop, as a grid of
// squares; Collections has each drop as an album, with the media types and the
// utilities under them; Search is the round button beside the tabs; a tap on a
// square opens it full screen, to swipe through. None of the media has been
// supplied yet: fill in a `src` in src/data/drops.ts and the picture takes its
// slot's place. Until then a visitor is shown a quiet tile in the drop's own
// colour with its name on it ("On its way" when opened), and nothing is
// counted that is not there; with `?draft` in the address (`DRAFT`) every
// empty slot is drawn as the note that says what is missing, and counted, for
// whoever is filling them in. Nothing here has a date, so the parts of Photos
// that are made of dates (Years, Months, the date over a picture) are left
// out, not made up.

type TabId = 'library' | 'collections'

/** What the Library shows: all of it, or what Sort and Filter narrows it to. */
type Filter = 'all' | 'favorites' | MediaKind

/** Screens of the app's own, beside an album (`a:<drop>`) and the viewer (`m:<i>`). */
const ALBUMS = 'albums'
const FAVORITES = 'favorites'
const VIDEOS_VIEW = 'videos'
const RECENT = 'recent'
const TYPES = 'types'
const UTILITIES = 'utilities'

interface Mine {
  /** The tab that is showing, or that search was started from. */
  tab: TabId
  /** Search is showing, in the tabs' place. */
  searching: boolean
  /** A tab has been turned to since the app opened: the next one fades in. */
  swapped: boolean
  filter: Filter
  query: string
  /** What has been favorited. */
  loved: number[]
  /** What has been opened in the viewer this visit, the most recent first. */
  recent: number[]
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
const mine = createStore<Mine>({ tab: 'library', searching: false, swapped: false, filter: 'all', query: '', loved: keptLoved(), recent: [], run: null, bare: false })

const showTab = (tab: TabId) => mine.set((s) => (s.tab === tab && !s.searching ? s : { ...s, tab, searching: false, query: '', swapped: true }))
const leaveSearch = () => mine.set((s) => (s.searching ? { ...s, searching: false, query: '', swapped: true } : s))
const setFilter = (filter: Filter) => mine.set((s) => (s.filter === filter ? s : { ...s, filter }))
const setQuery = (query: string) => mine.set((s) => (s.query === query ? s : { ...s, query }))
const toggleLoved = (index: number) => {
  mine.set((s) => ({ ...s, loved: s.loved.includes(index) ? s.loved.filter((i) => i !== index) : [...s.loved, index] }))
  keepLoved(mine.get().loved)
}
const viewed = (index: number) => mine.set((s) => (s.recent[0] === index ? s : { ...s, recent: [index, ...s.recent.filter((i) => i !== index)] }))

/** Every item, by its place in MEDIA. */
const EVERYTHING = MEDIA.map((_, i) => i)
const inDrop = (drop: string) => EVERYTHING.filter((i) => MEDIA[i]!.drop === drop)
const ofKind = (kind: MediaKind) => EVERYTHING.filter((i) => MEDIA[i]!.kind === kind)
/** The favorites, in the library's order. */
const lovedOf = (loved: number[]) => EVERYTHING.filter((i) => loved.includes(i))

const ALL_VIDEOS = ofKind('video')

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

/** What stands in for a count while what it would count is still to come. */
const waiting = (indices: number[]) => (indices.length === 1 ? 'On its way' : 'On their way')

/** The app's own element: what a press outside React's reach (the search field's focus, a tab's scroll to the top) is found in. */
const RootContext = createContext<RefObject<HTMLDivElement>>({ current: null })

/** Back to the app's first screen, from however deep. One screen in, that is a
 * step back; from further in it is a step on, as pressing a tab is. */
const toRoot = () => (sys.get().stacks.photos.length === 1 ? pop() : launchAt('photos', []))

// ---- Glyphs ----

/** The Library tab's: one photo in front of another, solid, as a tab bar's glyphs are. */
function LibraryGlyph({ size = 27 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden>
      <path d="M9 6.4V6a2.8 2.8 0 0 1 2.8-2.8h11.4A2.8 2.8 0 0 1 26 6v8.4a2.8 2.8 0 0 1-2.8 2.8" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <path fillRule="evenodd" fill="currentColor" d="M4.8 8.6h13.4A2.8 2.8 0 0 1 21 11.4v10.4a2.8 2.8 0 0 1-2.8 2.8H4.8A2.8 2.8 0 0 1 2 21.8V11.4a2.8 2.8 0 0 1 2.8-2.8zM7.6 11.6a1.9 1.9 0 1 0 0 3.8 1.9 1.9 0 0 0 0-3.8zM4.6 21.6l4-4.3 2.5 2.4 3.6-4.5 4.1 6.4z" />
    </svg>
  )
}

/** The Collections tab's: a card with two more behind it. */
function CollectionsGlyph({ size = 27 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="currentColor" aria-hidden>
      <rect x="8.5" y="2.6" width="11" height="1.9" rx="0.95" />
      <rect x="5.5" y="6.4" width="17" height="1.9" rx="0.95" />
      <rect x="2.5" y="10.4" width="23" height="15" rx="3.4" />
    </svg>
  )
}

const TABS: Tab<TabId>[] = [
  { id: 'library', label: 'Library', icon: <LibraryGlyph /> },
  { id: 'collections', label: 'Collections', icon: <CollectionsGlyph /> },
]

// ---- A tile ----

/** One photo or video as a square: the picture, or the tile that keeps its
 * place. A video carries a play mark in its corner, where Photos writes its
 * length; a favorite, a heart. A tile without its picture is named for its
 * drop, except where that is already said: an album's `cover` has the name
 * under it, and `within` an album every tile is from the one drop, so each
 * says that it is on its way instead (or, to the editor, what kind of slot it
 * is). */
function Picture({ index, loved, cover, within }: { index: number; loved?: boolean; cover?: boolean; within?: boolean }) {
  const slot = MEDIA[index]!
  const video = slot.kind === 'video'
  const words = DRAFT ? (within ? (video ? 'Video slot' : 'Photo slot') : slot.drop) : within ? 'On its way' : slot.drop
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
          {!cover && <span className="photos-pic__name">{words}</span>}
        </span>
      )}
      {video && <Play className="photos-pic__play" size={13} strokeWidth={0} fill="currentColor" aria-hidden />}
      {loved && <Heart className="photos-pic__heart" size={13} strokeWidth={0} fill="currentColor" aria-hidden />}
    </span>
  )
}

/** What a tile is, for someone who is told it and not shown it. It holds the
 * words the tile shows (its drop's name; within an album, "On its way"). */
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
function Grid({ indices, within }: { indices: number[]; within?: boolean }) {
  const loved = useStore(mine, (s) => s.loved)
  return (
    <div className="photos-grid" role="list">
      {indices.map((i) => (
        <div key={i} role="listitem">
          <button type="button" className="photos-tile" aria-label={describe(i)} onClick={() => view(i, indices)}>
            <Picture index={i} loved={loved.includes(i)} within={within} />
          </button>
        </div>
      ))}
    </div>
  )
}

// ---- What floats at the foot: the tabs, and search beside them ----

/** Library and Collections in their short bar, and the round Search button in
 * the far corner. A tab's own button scrolls its screen back to the top;
 * pressed from deeper in, it goes back to the tab's first screen. */
function Tabs({ deep }: { deep?: boolean }) {
  const tab = useStore(mine, (s) => s.tab)
  const root = useContext(RootContext)
  const onTab = (id: TabId) => {
    if (deep) {
      showTab(id)
      toRoot()
    } else if (id === tab) root.current?.querySelector('.photos-tab[data-on] .ios-screen__scroll')?.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
    else showTab(id)
  }
  const search = () => {
    // The field is drawn and focused inside the tap itself: a phone only raises its keyboard for that
    flushSync(() => mine.set((s) => ({ ...s, searching: true, swapped: true })))
    if (deep) toRoot()
    else root.current?.querySelector<HTMLInputElement>('.photos-search .ios-search__input')?.focus({ preventScroll: true })
  }
  return (
    <>
      <TabBar label="Photos" tabs={TABS} value={tab} onChange={onTab} />
      <span className="photos-gap" aria-hidden />
      <GlassButton label="Search" onClick={search}>
        <Search size={25} strokeWidth={2.2} aria-hidden />
      </GlassButton>
    </>
  )
}

/** The tabs stay at the foot of every screen under them, as a tab bar does. A
 * screen reached from search has none: its way back is Back. */
function useTabsFoot() {
  const searching = useStore(mine, (s) => s.searching)
  return searching ? undefined : <Tabs deep />
}

// ---- Library ----

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

function Library() {
  const filter = useStore(mine, (s) => s.filter)
  const loved = useStore(mine, (s) => s.loved)
  const shown = useMemo(() => shownBy(filter, loved), [filter, loved])
  const items: MenuItem[] = FILTERS.map((f) => ({ label: f.label, icon: f.icon, checked: f.value === filter, divided: f.value === 'favorites', onSelect: () => setFilter(f.value) }))
  const none = filter === 'all' ? NOTHING.photo : NOTHING[filter]
  return (
    <Screen
      title="Library"
      large
      className="photos-library"
      trailing={
        // Blue while it is narrowing the library, as the button is in Photos
        <Menu label="Sort and Filter" items={items} tint={filter !== 'all'}>
          <ArrowUpDown size={21} strokeWidth={2.4} aria-hidden />
        </Menu>
      }
      foot={<Tabs />}
    >
      {shown.length ? (
        <>
          <Grid indices={shown} />
          {/* How Photos ends its library: what is in it, and a quieter line under that. Nothing is
              counted that has not arrived: until something has, the quieter line says so by itself */}
          {tally(shown) ? (
            <p className="photos-note">
              {tally(shown)}
              <br />
              From the people who got a drop.
            </p>
          ) : (
            <p className="photos-note photos-note--plain">From the people who got a drop. The first ones are on their way.</p>
          )}
        </>
      ) : (
        <Empty icon={none.icon} title={none.title}>
          {none.text}
        </Empty>
      )}
    </Screen>
  )
}

// ---- Collections ----

/** A section's name in Collections: pressed, it opens the whole of the section. */
function Head({ children, onOpen }: { children: string; onOpen: () => void }) {
  return (
    <h3 className="photos-head">
      <button type="button" onClick={onOpen}>
        {children}
        <ChevronRight size={17} strokeWidth={3.2} aria-hidden />
      </button>
    </h3>
  )
}

interface AlbumSpec {
  name: string
  /** The screen it opens. */
  view: string
  items: number[]
  /** Favorites: marked with a heart, as Photos marks it. */
  heart?: boolean
}

/** Every album: Favorites first, then one for each drop. */
function useAlbums(): AlbumSpec[] {
  const loved = useStore(mine, (s) => s.loved)
  return useMemo(() => [{ name: 'Favorites', view: FAVORITES, items: lovedOf(loved), heart: true }, ...DROPS.map((drop) => ({ name: drop, view: albumView(drop), items: inDrop(drop) }))], [loved])
}

/** An album as Photos shows one: its cover, its name, how much is in it. */
function AlbumCard({ album }: { album: AlbumSpec }) {
  const n = album.items.length
  // Favorites holds what the visitor put there, whatever it is; a drop's album, what has arrived from it
  const held = album.heart ? n : there(album.items).length
  return (
    <button type="button" className="photos-album" onClick={() => push(album.view)}>
      <span className="photos-album__cover">
        {n > 0 && <Picture index={album.items[0]!} cover />}
        {album.heart && <Heart className="photos-album__heart" data-alone={n === 0 || undefined} size={n ? 15 : 34} strokeWidth={0} fill="currentColor" aria-hidden />}
      </span>
      <span className="photos-album__name">{album.name}</span>
      <span className="photos-album__count">
        {held > 0 || album.heart ? (
          <>
            {held}
            <span className="sr-only"> {held === 1 ? 'item' : 'items'}</span>
          </>
        ) : (
          // Nothing from this drop yet: no nought under it, and the line keeps its height
          <>
            {'\u00a0'}
            <span className="sr-only">{waiting(album.items).toLowerCase()}</span>
          </>
        )}
      </span>
    </button>
  )
}

/** A finger scrolls a row sideways by itself. A mouse has no such thing, so it drags the row. */
function useDragScroll() {
  const drag = useRef<{ x: number; left: number; k: number; moved: boolean } | null>(null)
  const dragged = useRef(false)
  const end = () => {
    const d = drag.current
    drag.current = null
    if (!d?.moved) return
    // The click that ends a drag is not a press on the album under it
    dragged.current = true
    setTimeout(() => (dragged.current = false), 0)
  }
  return {
    onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return
      drag.current = { x: e.clientX, left: e.currentTarget.scrollLeft, k: scaleOf(e.currentTarget), moved: false }
    },
    onPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => {
      const d = drag.current
      if (!d) return
      const dx = (e.clientX - d.x) / d.k
      if (!d.moved) {
        if (Math.abs(dx) < 5) return
        d.moved = true
        e.currentTarget.setPointerCapture(e.pointerId)
      }
      e.currentTarget.scrollLeft = d.left - dx
    },
    onPointerUp: end,
    onPointerCancel: end,
    onClickCapture: (e: ReactMouseEvent) => {
      if (!dragged.current) return
      e.preventDefault()
      e.stopPropagation()
    },
  }
}

/** Media Types: the kinds Photos sorts a library into. Here there is one beside photos. */
function TypeRows() {
  return (
    <List className="photos-rows">
      <Section>
        <Cell lead={<Video size={23} strokeWidth={2} aria-hidden />} title="Videos" value={there(ALL_VIDEOS).length || undefined} chevron onClick={() => push(VIDEOS_VIEW)} />
      </Section>
    </List>
  )
}

/** Utilities: what Photos keeps track of by itself. */
function UtilityRows() {
  const seen = useStore(mine, (s) => s.recent.length)
  return (
    <List className="photos-rows">
      <Section>
        <Cell lead={<Clock size={22} strokeWidth={2} aria-hidden />} title="Recently Viewed" value={seen} chevron onClick={() => push(RECENT)} />
      </Section>
    </List>
  )
}

function Collections() {
  const albums = useAlbums()
  const row = useDragScroll()
  return (
    <Screen title="Collections" large className="photos-collections" foot={<Tabs />}>
      <Head onOpen={() => push(ALBUMS)}>Albums</Head>
      <div className="photos-row" role="list" {...row}>
        {albums.map((album) => (
          <div key={album.view} role="listitem">
            <AlbumCard album={album} />
          </div>
        ))}
      </div>
      <Head onOpen={() => push(TYPES)}>Media Types</Head>
      <TypeRows />
      <Head onOpen={() => push(UTILITIES)}>Utilities</Head>
      <UtilityRows />
    </Screen>
  )
}

/** Every album, two across: what the Albums heading opens. */
function Albums() {
  const albums = useAlbums()
  const foot = useTabsFoot()
  return (
    <Screen title="Albums" large className="photos-screen" foot={foot}>
      <div className="photos-albums" role="list">
        {albums.map((album) => (
          <div key={album.view} role="listitem">
            <AlbumCard album={album} />
          </div>
        ))}
      </div>
    </Screen>
  )
}

/** A section of Collections on a screen of its own: what its heading opens. */
function RowsScreen({ title, children }: { title: string; children: ReactNode }) {
  const foot = useTabsFoot()
  return (
    <Screen title={title} large className="photos-screen" foot={foot}>
      {children}
    </Screen>
  )
}

// ---- A grid on a screen of its own: an album, the videos, what was looked at ----

function GridScreen({ title, indices, within, none }: { title: string; indices: number[]; within?: boolean; none: { icon: ReactNode; title: string; text: string } }) {
  const foot = useTabsFoot()
  return (
    <Screen title={title} large subtitle={indices.length ? tally(indices) || waiting(indices) : undefined} className="photos-screen" foot={foot}>
      {indices.length ? (
        <Grid indices={indices} within={within} />
      ) : (
        <Empty icon={none.icon} title={none.title}>
          {none.text}
        </Empty>
      )}
    </Screen>
  )
}

function Album({ drop }: { drop: string }) {
  const items = useMemo(() => inDrop(drop), [drop])
  return <GridScreen title={drop} indices={items} within none={{ icon: <Images size={44} strokeWidth={1.5} />, title: 'No Photos or Videos', text: 'Nothing from this drop yet.' }} />
}

function Favorites() {
  const loved = useStore(mine, (s) => s.loved)
  const items = useMemo(() => lovedOf(loved), [loved])
  return <GridScreen title="Favorites" indices={items} none={NOTHING.favorites} />
}

function RecentlyViewed() {
  const recent = useStore(mine, (s) => s.recent)
  return <GridScreen title="Recently Viewed" indices={recent} none={{ icon: <Clock size={44} strokeWidth={1.5} />, title: 'No Photos or Videos', text: 'Photos and videos you open will show up here.' }} />
}

// ---- Search ----

/** Whether an item is found by what was typed: by its drop, by who sent it, or by what kind of thing it is. */
function found(index: number, q: string) {
  const slot = MEDIA[index]!
  return slot.drop.toLowerCase().includes(q) || (slot.from?.toLowerCase().includes(q) ?? false) || `${slot.kind}s`.startsWith(q)
}

/** An album as a row: what search lists, to jump to. */
function AlbumRow({ drop }: { drop: string }) {
  const items = inDrop(drop)
  const held = there(items).length
  return (
    <Cell
      lead={<span className="photos-thumb">{items.length > 0 && <Picture index={items[0]!} cover />}</span>}
      title={drop}
      value={
        held > 0 ? (
          <>
            {held}
            <span className="sr-only"> {held === 1 ? 'item' : 'items'}</span>
          </>
        ) : undefined
      }
      chevron
      onClick={() => push(albumView(drop))}
    />
  )
}

/** Search, in the tabs' place: the tab bar folds down to the one button that
 * leads back to it, and the field takes the room, as iOS does it. Until
 * something is typed it lists the albums; then what matches. */
function SearchPane() {
  const query = useStore(mine, (s) => s.query)
  const tab = useStore(mine, (s) => s.tab)
  // The field has the keyboard. A field that is covered or put away isn't always told it has lost it, so that is seen to here
  const [typing, setTyping] = useState(false)
  const first = useStore(sys, (s) => s.app === 'photos' && !s.stacks.photos.length)
  const searching = useStore(mine, (s) => s.searching)
  useEffect(() => {
    if (!first || !searching) setTyping(false)
  }, [first, searching])
  const q = query.trim().toLowerCase()
  const albums = useMemo(() => (q ? DROPS.filter((drop) => drop.toLowerCase().includes(q)) : DROPS), [q])
  const tiles = useMemo(() => (q ? EVERYTHING.filter((i) => found(i, q)) : []), [q])

  const onKey = (e: ReactKeyboardEvent) => {
    // Return in the field puts the keyboard away and leaves what was found
    if (e.key === 'Enter' && e.target instanceof HTMLInputElement) e.target.blur()
  }
  const clear = () => {
    setQuery('')
    ;(document.activeElement as HTMLElement | null)?.blur?.()
    setTyping(false)
  }

  return (
    <Screen
      title="Search"
      large
      leading={null}
      className="photos-search"
      foot={
        <span className="photos-searchbar" onKeyDown={onKey}>
          {/* While the field has the keyboard the bar is the field and the button that puts it away;
              otherwise, the field and the one button the tab bar has folded down to */}
          {!typing && (
            <GlassButton label={tab === 'library' ? 'Library' : 'Collections'} onClick={leaveSearch}>
              {tab === 'library' ? <LibraryGlyph size={25} /> : <CollectionsGlyph size={25} />}
            </GlassButton>
          )}
          <SearchBar value={query} onChange={setQuery} label="Search photos and videos" placeholder="Search" onFocus={() => setTyping(true)} onBlur={() => setTyping(false)} />
          {typing && (
            // Pressing it doesn't first take the keyboard from the field: the press is what puts it away
            <span className="photos-searchbar__close" onMouseDown={(e) => e.preventDefault()}>
              <GlassButton label="Close search" onClick={clear}>
                <X size={22} strokeWidth={2.4} aria-hidden />
              </GlassButton>
            </span>
          )}
        </span>
      }
    >
      {albums.length + tiles.length === 0 ? (
        <Empty icon={<Search size={44} strokeWidth={1.8} />} title="No Results">
          Nothing in the library matches “{query.trim()}”. Check the spelling or try a new search.
        </Empty>
      ) : (
        <>
          {albums.length > 0 && (
            <>
              <h3 className="photos-head">Albums</h3>
              <List className="photos-rows photos-rows--albums">
                <Section>
                  {albums.map((drop) => (
                    <AlbumRow key={drop} drop={drop} />
                  ))}
                </Section>
              </List>
            </>
          )}
          {tiles.length > 0 && (
            <>
              <h3 className="photos-head">{tally(tiles) || 'Photos and Videos'}</h3>
              <Grid indices={tiles} />
            </>
          )}
        </>
      )}
    </Screen>
  )
}

/** The two tabs, and search. All three stay drawn, so each is where it was left when its turn comes round again. */
function Home() {
  const tab = useStore(mine, (s) => s.tab)
  const searching = useStore(mine, (s) => s.searching)
  const swapped = useStore(mine, (s) => s.swapped)
  const on = searching ? 'search' : tab
  const pane = (id: TabId | 'search', body: JSX.Element) => (
    <div className="photos-tab" data-on={on === id || undefined} data-swapped={swapped || undefined} {...(on === id ? null : ({ inert: '' } as object))}>
      {body}
    </div>
  )
  return (
    <>
      {pane('library', <Library />)}
      {pane('collections', <Collections />)}
      {pane('search', <SearchPane />)}
    </>
  )
}

// ---- The viewer ----

/** How far apart two neighbours sit while one is swiped to the next. */
const GAP = 16

/** A menu is open in the app: the keys are the menu's until it closes. */
const menuOpen = () => !!document.querySelector('.sb-app[data-app="photos"] .ios-menu > [aria-expanded="true"]')

function Viewer({ index, under }: { index: number; under: string | null }) {
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

  // Opened is looked at: Recently Viewed keeps it
  useEffect(() => {
    viewed(index)
  }, [index])

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

  // Where else it is: its drop's album, unless that is the screen underneath; the library, unless it was opened from there
  const album = albumView(slot.drop)
  const items: MenuItem[] = []
  if (under !== album) items.push({ label: 'Show in Album', icon: <CollectionsGlyph size={20} />, onSelect: () => push(album) })
  if (under !== null) {
    items.push({
      label: 'Show in Library',
      icon: <LibraryGlyph size={20} />,
      onSelect: () => {
        mine.set((s) => ({ ...s, tab: 'library', searching: false, query: '', filter: 'all' }))
        launchAt('photos', [])
      },
    })
  }

  return (
    <Screen
      title={`${slot.drop}, ${video ? 'video' : 'photo'}`}
      tone="dark"
      fixed
      className={`photos-viewer${bare ? ' photos-viewer--bare' : ''}`}
      center={
        <span className="photos-viewer__title">
          <b>{slot.drop}</b>
          <span>{video ? 'Video' : 'Photo'}</span>
        </span>
      }
      trailing={
        <Menu label="More" items={items}>
          <Ellipsis size={24} strokeWidth={2.2} aria-hidden />
        </Menu>
      }
      foot={
        <div className="photos-tools">
          <GlassGroup label={video ? 'Video' : 'Photo'}>
            {/* Nothing to share until the picture is there */}
            {(slot.src || DRAFT) && (
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
            )}
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
        <Section footer={slot.src ? undefined : DRAFT ? 'Nothing has been supplied for this slot yet. The picture takes its place when it is.' : 'This one hasn’t come in yet. It shows here when it does.'}>
          <Cell title="Drop" value={slot.drop} />
          <Cell title="Kind" value={slot.kind === 'video' ? 'Video' : 'Photo'} />
          {/* Who sent it, once that is known (the editor is shown that it is not) */}
          {(slot.from || DRAFT) && <Cell title="From" value={slot.from ?? 'Not supplied yet'} />}
        </Section>
      </List>
    </Sheet>
  )
}

// ---- The app ----

/** What a view in the app's stack shows. */
function Page({ view: name, under }: { view: string | null; under: string | null }) {
  if (name === null) return <Home />
  if (name === ALBUMS) return <Albums />
  if (name === FAVORITES) return <Favorites />
  if (name === RECENT) return <RecentlyViewed />
  if (name === VIDEOS_VIEW) return <GridScreen title="Videos" indices={ALL_VIDEOS} none={NOTHING.video} />
  if (name === TYPES)
    return (
      <RowsScreen title="Media Types">
        <TypeRows />
      </RowsScreen>
    )
  if (name === UTILITIES)
    return (
      <RowsScreen title="Utilities">
        <UtilityRows />
      </RowsScreen>
    )
  if (name.startsWith('a:')) return <Album drop={name.slice(2)} />
  const index = name.startsWith('m:') ? Number(name.slice(2)) : NaN
  if (Number.isInteger(index) && MEDIA[index]) return <Viewer index={index} under={under} />
  return (
    <Screen title="Not Found" className="photos-screen">
      <Empty icon={<Images size={44} strokeWidth={1.5} />} title="No Longer Here">
        That isn’t in the library.
      </Empty>
    </Screen>
  )
}

export function PhotosApp() {
  const { active } = useApp()
  const root = useRef<HTMLDivElement>(null)
  const stack = useStore(sys, (s) => s.stacks.photos)
  const first = stack[0]
  const viewing = stack.some((name) => name.startsWith('m:'))

  // Escape leaves search: what was typed first, then search itself. It is heard
  // ahead of the phone's own Escape, which would take that for leaving the app;
  // a screen deeper in is left to that one, which goes back a screen.
  useEffect(() => {
    if (!active) return
    const key = (e: KeyboardEvent) => {
      const s = sys.get()
      const m = mine.get()
      if (e.key !== 'Escape' || e.defaultPrevented || s.app !== 'photos' || s.locked || s.switcher || s.spotlight || s.sheet || s.stacks.photos.length || !m.searching || menuOpen()) return
      e.preventDefault()
      if (m.query) setQuery('')
      else {
        ;(document.activeElement as HTMLElement | null)?.blur?.()
        leaveSearch()
      }
    }
    window.addEventListener('keydown', key, true)
    return () => window.removeEventListener('keydown', key, true)
  }, [active])

  // Out of the viewer (once it has slid away) its buttons are back for next time, and what it swiped through is let go
  useEffect(() => {
    if (viewing) return
    const t = setTimeout(() => mine.set((s) => (s.bare || s.run ? { ...s, bare: false, run: null } : s)), 600)
    return () => clearTimeout(t)
  }, [viewing])

  // An album arrived at from outside (a reload, the Home Screen's search) is under Collections: that is the tab Back leads to
  useEffect(() => {
    if (first && !first.startsWith('m:')) mine.set((s) => (s.searching || s.tab === 'collections' ? s : { ...s, tab: 'collections' }))
  }, [first])

  // Closed for good (flicked out of the App Switcher), it starts over on the Library next time.
  // What was favorited and looked at stays, and the filter, as Photos keeps them.
  useEffect(() => () => mine.set((s) => ({ ...s, tab: 'library', searching: false, swapped: false, query: '', run: null, bare: false })), [])

  return (
    <div ref={root} className="photos-app">
      <RootContext.Provider value={root}>
        <NavStack>{(name, depth) => <Page view={name} under={depth >= 2 ? (stack[depth - 2] ?? null) : null} />}</NavStack>
        <SheetHost>{(name) => (name === 'info' ? <InfoSheet /> : null)}</SheetHost>
      </RootContext.Provider>
    </div>
  )
}
