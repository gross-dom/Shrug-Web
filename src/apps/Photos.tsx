import { Image as ImageIcon, Images, Play, Video } from 'lucide-react'
import { DROPS, MEDIA, type MediaSlot } from '../data/drops'
import { Segmented } from '../kit/controls/Segmented'
import { Window } from '../kit/window'
import { useStore } from '../os/store'
import { photos, setDrop, setMediaFilter, type MediaFilter } from './state'
import { SideLabel } from './ui'

// VIP as a photo library: photos and videos from the people who got a drop,
// with each drop as an album down the sidebar. None of the media has been
// supplied yet, so every tile is the slot one will go in.

const FILTERS: { id: MediaFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'photo', label: 'Photos' },
  { id: 'video', label: 'Videos' },
]

const glyph = { size: 15, strokeWidth: 1.7 }

function Tile({ slot }: { slot: MediaSlot }) {
  const video = slot.kind === 'video'
  return (
    <figure className="vip-tile" data-kind={slot.kind} data-span={slot.span || undefined} data-empty={!slot.src || undefined}>
      {slot.src ? (
        video ? (
          <video className="vip-tile__media" src={slot.src} controls preload="metadata" />
        ) : (
          <img className="vip-tile__media" src={slot.src} alt={`${slot.drop}${slot.from ? `, from ${slot.from}` : ''}`} loading="lazy" />
        )
      ) : (
        <div className="vip-tile__slot">
          {video ? <Play size={22} strokeWidth={1.6} aria-hidden /> : <ImageIcon size={22} strokeWidth={1.6} aria-hidden />}
          <span>{video ? 'Video slot' : 'Photo slot'}</span>
        </div>
      )}
      <figcaption className="vip-tile__cap">
        <b>{slot.from ?? '[Name]'}</b>
        <span>{slot.drop}</span>
      </figcaption>
    </figure>
  )
}

function Sidebar() {
  const drop = useStore(photos, (s) => s.drop)
  const row = (value: string | null, label: string, count: number, icon: JSX.Element) => (
    <button key={label} type="button" className="side-item" aria-current={drop === value || undefined} onClick={() => setDrop(value)}>
      <span className="side-item__icon">{icon}</span>
      <span className="side-item__name">{label}</span>
      <span className="side-item__count">{count}</span>
    </button>
  )
  return (
    <nav className="side scrolls" aria-label="Drops">
      <SideLabel>Library</SideLabel>
      {row(null, 'All drops', MEDIA.length, <Images {...glyph} aria-hidden />)}
      <SideLabel>Drops</SideLabel>
      {DROPS.map((name) =>
        row(
          name,
          name,
          MEDIA.filter((m) => m.drop === name).length,
          <ImageIcon {...glyph} aria-hidden />,
        ),
      )}
    </nav>
  )
}

export function PhotosApp() {
  const { filter, drop } = useStore(photos, (s) => s)
  const inDrop = drop ? MEDIA.filter((m) => m.drop === drop) : MEDIA
  const shown = filter === 'all' ? inDrop : inDrop.filter((m) => m.kind === filter)
  const counts = { all: inDrop.length, photo: inDrop.filter((m) => m.kind === 'photo').length, video: inDrop.filter((m) => m.kind === 'video').length }
  const at = FILTERS.findIndex((f) => f.id === filter)

  return (
    <Window
      className="app vip"
      title={drop ?? 'All drops'}
      sidebar={<Sidebar />}
      sidebarWidth={212}
      sidebarStyle="floating"
      lightsSize="large"
      barSize="tall"
      toolbar={
        <div
          className="seg"
          role="radiogroup"
          aria-label="Show"
          tabIndex={0}
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
              <span key={f.id} role="radio" aria-checked={f.id === filter}>
                {f.label} <span className="seg__count">{counts[f.id]}</span>
              </span>
            ))}
          />
        </div>
      }
      body={{ className: 'vip__body scrolls' }}
    >
      <header className="vip__head">
        <h2 className="vip__title">When the drops landed.</h2>
        <p className="vip__sub">Photos and videos from the people who got one.</p>
      </header>
      <div className="vip__grid">
        {shown.map((slot, i) => (
          <Tile key={`${slot.drop}-${slot.kind}-${i}`} slot={slot} />
        ))}
      </div>
      {shown.length === 0 && (
        <div className="vip__none">
          <Video size={20} strokeWidth={1.6} aria-hidden />
          No {filter === 'video' ? 'videos' : 'photos'} from this drop yet
        </div>
      )}
    </Window>
  )
}
