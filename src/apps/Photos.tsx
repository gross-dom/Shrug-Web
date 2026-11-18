import { useEffect, useLayoutEffect, useRef, type CSSProperties, type KeyboardEvent } from 'react'
import { ChevronLeft, ChevronRight, Image as ImageIcon, Images, Play, Video, X } from 'lucide-react'
import { arrived, DROPS, hasFile, hueOf, MEDIA, type MediaSlot } from '../data/drops'
import { DRAFT } from '../data/site'
import { Segmented } from '../kit/controls/Segmented'
import { Window } from '../kit/window'
import { focusFirst } from '../os/focus'
import { useStore } from '../os/store'
import { lookAt, photos, setDrop, setMediaFilter, type MediaFilter } from './state'
import { SideLabel } from './ui'

// VIP as a photo library: photos and videos from the people who got a drop,
// with each drop as an album down the sidebar. None of the media has been
// supplied yet. Until a slot has its file a visitor is shown a quiet tile in
// the drop's own colour, with its name on it, and nothing is counted that is
// not there; with `?draft` in the address every empty slot is drawn as the
// note that says what is missing, for whoever is filling them in. A tile that
// has its file opens large in the window (arrows step, Escape closes).

const FILTERS: { id: MediaFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'photo', label: 'Photos' },
  { id: 'video', label: 'Videos' },
]

const glyph = { size: 15, strokeWidth: 1.7 }

/** What a photo or video is, for someone who is told it and not shown it. */
const describe = (slot: MediaSlot) => `${slot.kind === 'video' ? 'Video' : 'Photo'} from ${slot.drop}${slot.from ? `, sent by ${slot.from}` : ''}`

function Tile({ slot, index }: { slot: MediaSlot; index: number }) {
  const video = slot.kind === 'video'
  const span = slot.span || undefined

  // Arrived: a press opens it large
  if (hasFile(slot))
    return (
      <button type="button" className="vip-tile vip-tile--open" data-kind={slot.kind} data-span={span} data-tile={index} onClick={() => lookAt(index)}>
        {video ? <video className="vip-tile__media" src={slot.src!} muted playsInline preload="metadata" tabIndex={-1} /> : <img className="vip-tile__media" src={slot.src!} alt="" loading="lazy" draggable={false} />}
        {video && <Play className="vip-tile__play" size={16} strokeWidth={0} fill="currentColor" aria-hidden />}
        {/* What it is called is what its caption says, then what kind of thing it is and what a press does */}
        <span className="vip-tile__cap">
          {slot.from && (
            <b>
              {slot.from}
              <span className="sr-only">, </span>
            </b>
          )}
          <span>
            {slot.drop}
            <span className="sr-only">: {video ? 'video' : 'photo'}. Open it.</span>
          </span>
        </span>
      </button>
    )

  // The editor's view: the slot, and what it is waiting for
  if (DRAFT)
    return (
      <figure className="vip-tile" data-kind={slot.kind} data-span={span} data-empty>
        <div className="vip-tile__slot">
          {video ? <Play size={22} strokeWidth={1.6} aria-hidden /> : <ImageIcon size={22} strokeWidth={1.6} aria-hidden />}
          <span>{video ? 'Video slot' : 'Photo slot'}</span>
        </div>
        <figcaption className="vip-tile__cap">
          <b>{slot.from ?? '[Name]'}</b>
          <span>{slot.drop}</span>
        </figcaption>
      </figure>
    )

  // A visitor's: the drop's name on its own colour. Nothing to open, so not a button
  return (
    <figure className="vip-tile vip-tile--quiet" data-kind={slot.kind} data-span={span} style={{ '--hue': hueOf(slot.drop) } as CSSProperties}>
      {video ? <Video size={18} strokeWidth={1.9} aria-hidden /> : <ImageIcon size={18} strokeWidth={1.9} aria-hidden />}
      <figcaption className="vip-tile__name">
        {slot.drop}
        <span className="sr-only">, {video ? 'video' : 'photo'} on its way</span>
      </figcaption>
    </figure>
  )
}

/** How many a row or a part of the filter says it holds: what has arrived (and nothing at all rather
 * than a nought), or for the editor every slot. */
const counted = (slots: MediaSlot[]) => (DRAFT ? slots.length : slots.filter(hasFile).length || null)

function Sidebar() {
  const drop = useStore(photos, (s) => s.drop)
  const row = (value: string | null, label: string, count: number | null, icon: JSX.Element) => (
    <button key={label} type="button" className="side-item" aria-current={drop === value || undefined} onClick={() => setDrop(value)}>
      <span className="side-item__icon">{icon}</span>
      <span className="side-item__name">{label}</span>
      {count !== null && <span className="side-item__count">{count}</span>}
    </button>
  )
  return (
    <nav className="side scrolls" aria-label="Drops">
      <SideLabel>Library</SideLabel>
      {/* How many drops there are, as About counts them: not how many tiles */}
      {row(null, 'All Drops', DROPS.length, <Images {...glyph} aria-hidden />)}
      <SideLabel>Drops</SideLabel>
      {DROPS.map((name) =>
        row(
          name,
          name,
          counted(MEDIA.filter((m) => m.drop === name)),
          <ImageIcon {...glyph} aria-hidden />,
        ),
      )}
    </nav>
  )
}

/** What the filters leave showing (each with its place in MEDIA), and how many of each kind the drop holds. */
export function useMedia() {
  const { filter, drop, look } = useStore(photos, (s) => s)
  const all = MEDIA.map((slot, index) => ({ slot, index }))
  const inDrop = drop ? all.filter((m) => m.slot.drop === drop) : all
  const shown = filter === 'all' ? inDrop : inDrop.filter((m) => m.slot.kind === filter)
  const slots = inDrop.map((m) => m.slot)
  const counts = { all: counted(slots), photo: counted(slots.filter((m) => m.kind === 'photo')), video: counted(slots.filter((m) => m.kind === 'video')) }
  return { filter, drop, look, shown, counts }
}

/** All, Photos or Videos: the kit's segmented control, made to really switch. */
export function MediaFilterControl() {
  const { filter, counts } = useMedia()
  const at = FILTERS.findIndex((f) => f.id === filter)
  return (
    <div
      className="seg"
      role="radiogroup"
      aria-label="Show"
      tabIndex={0}
      // The group has the keyboard, not its parts: this says which of them the arrows are on
      aria-activedescendant={`vip-show-${filter}`}
      onClick={(e) => {
        const hit = (e.target as HTMLElement).closest<HTMLElement>('[data-target]')
        if (hit) setMediaFilter(hit.dataset.target as MediaFilter)
      }}
      onKeyDown={(e) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
        e.preventDefault()
        setMediaFilter(FILTERS[(at + (e.key === 'ArrowRight' ? 1 : FILTERS.length - 1)) % FILTERS.length]!.id)
      }}
    >
      <Segmented
        value={at}
        targets={FILTERS.map((f) => f.id)}
        items={FILTERS.map((f) => (
          <span key={f.id} id={`vip-show-${f.id}`} role="radio" aria-checked={f.id === filter}>
            {f.label}
            {counts[f.id] !== null && <span className="seg__count"> {counts[f.id]}</span>}
          </span>
        ))}
      />
    </div>
  )
}

/** The photos and videos showing, or a line saying there are none. */
export function MediaGrid() {
  const { filter, drop, shown } = useMedia()
  const kind = filter === 'video' ? 'Videos' : 'Photos'
  return (
    <>
      <div className="vip__grid">
        {shown.map(({ slot, index }) => (
          <Tile key={index} slot={slot} index={index} />
        ))}
      </div>
      {shown.length === 0 && (
        <div className="vip__none">
          {filter === 'video' ? <Video size={20} strokeWidth={1.6} aria-hidden /> : <ImageIcon size={20} strokeWidth={1.6} aria-hidden />}
          <b>No {kind}</b>
          <span>
            {kind} from {drop ? 'this drop' : 'the drops'} will show up here.
          </span>
        </div>
      )}
    </>
  )
}

/** One photo or video, large, in the grid's place: what a press on a tile that has its file opens.
 * The arrows (the keys, and the two at its sides) step through the rest of what the grid was showing;
 * Escape, or Close, goes back to the grid, to the tile it was. */
function Look({ index, run }: { index: number; run: number[] }) {
  const slot = MEDIA[index]!
  const video = slot.kind === 'video'
  const at = run.indexOf(index)
  const panel = useRef<HTMLDivElement>(null)

  // Opened, it has the keyboard: the arrows and Escape are heard here
  useEffect(() => {
    focusFirst(panel.current?.querySelector('.vip-look__close'))
  }, [])

  const step = (by: -1 | 1) => {
    const next = run[at + by]
    if (next !== undefined) lookAt(next)
  }

  const keys = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      lookAt(null)
    } else if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && !(e.target as HTMLElement).closest('video')) {
      // (On the video itself the arrows are its own: they move through it)
      e.preventDefault()
      step(e.key === 'ArrowRight' ? 1 : -1)
    }
  }

  return (
    <div ref={panel} className="vip-look" role="dialog" aria-label={`${describe(slot)}. ${at + 1} of ${run.length}.`} onKeyDown={keys}>
      <div className="vip-look__bar">
        <button type="button" className="vip-look__button vip-look__close" aria-label="Close" onClick={() => lookAt(null)}>
          <X size={17} strokeWidth={2.4} aria-hidden />
        </button>
        <span className="vip-look__title">
          <b>{slot.drop}</b>
          {slot.from && <span>From {slot.from}</span>}
        </span>
        <span className="vip-look__count" aria-hidden>
          {at + 1} of {run.length}
        </span>
      </div>
      <div className="vip-look__stage">
        {video ? <video key={slot.src} className="vip-look__media" src={slot.src!} controls playsInline preload="metadata" /> : <img key={slot.src} className="vip-look__media" src={slot.src!} alt={describe(slot)} draggable={false} />}
        {run.length > 1 && (
          <>
            <button type="button" className="vip-look__button vip-look__step" data-side="back" aria-label="Previous" aria-disabled={at === 0 || undefined} onClick={() => step(-1)}>
              <ChevronLeft size={20} strokeWidth={2.4} aria-hidden />
            </button>
            <button type="button" className="vip-look__button vip-look__step" data-side="on" aria-label="Next" aria-disabled={at === run.length - 1 || undefined} onClick={() => step(1)}>
              <ChevronRight size={20} strokeWidth={2.4} aria-hidden />
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export function PhotosApp() {
  const { drop, look, shown } = useMedia()
  const browse = useRef<HTMLDivElement>(null)
  /** The window's body, which is what scrolls. */
  const scroller = () => browse.current?.parentElement ?? null
  /** How far down the grid was when a picture was opened, and which tile it was last on. */
  const left = useRef({ top: 0, tile: -1 })
  // What the arrows step through: everything the grid was showing that has its file
  const run = shown.filter((m) => hasFile(m.slot)).map((m) => m.index)
  const looking = look !== null && run.includes(look)

  // Something that is no longer showing cannot be looked at (a reload of the data, a filter from the menu bar)
  useEffect(() => {
    if (look !== null && !looking) lookAt(null)
  }, [look, looking])

  // Back at the grid: where it was, with the keyboard on the tile that was open
  useLayoutEffect(() => {
    const el = scroller()
    if (!el) return
    if (looking) {
      left.current.tile = look!
      return
    }
    if (left.current.tile < 0) return
    el.scrollTop = left.current.top
    focusFirst(el.querySelector(`[data-tile="${left.current.tile}"]`))
    left.current.tile = -1
  }, [looking, look])

  const none = !DRAFT && arrived() === 0

  return (
    <Window
      className="app vip"
      title={drop ?? 'All Drops'}
      sidebar={<Sidebar />}
      sidebarWidth={212}
      sidebarStyle="floating"
      lightsSize="large"
      barSize="tall"
      toolbar={<MediaFilterControl />}
      body={{
        className: `vip__body scrolls${looking ? ' vip__body--look' : ''}`,
        // The grid can be scrolled from the keyboard in every browser, not only the ones that make a scroller a Tab stop themselves
        tabIndex: looking ? undefined : 0,
        role: 'group',
        'aria-label': 'Photos and videos',
      }}
    >
      <div
        ref={browse}
        className="vip__browse"
        style={looking ? { display: 'none' } : undefined}
        // A press on a tile is about to put a picture in the grid's place: where the grid was is kept, to come back to
        onClickCapture={() => {
          left.current.top = scroller()?.scrollTop ?? 0
        }}
      >
        {/* With the sidebar folded away, the drops ride along the top */}
        <div className="vip__chips" role="group" aria-label="Drops">
          <button type="button" className="chip" aria-pressed={drop === null} onClick={() => setDrop(null)}>
            All Drops
          </button>
          {DROPS.map((name) => (
            <button key={name} type="button" className="chip" aria-pressed={drop === name} onClick={() => setDrop(name)}>
              {name}
            </button>
          ))}
        </div>
        <div className="vip__head">
          <h2 className="vip__title">When the drops landed.</h2>
          <p className="vip__sub">{none ? 'From the people who got a drop. The first ones are on their way.' : 'Photos and videos from the people who got one.'}</p>
        </div>
        <MediaGrid />
      </div>
      {looking && <Look index={look!} run={run} />}
    </Window>
  )
}
