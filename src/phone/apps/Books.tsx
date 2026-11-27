import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { BookOpen, Library, List } from 'lucide-react'
import { soldOut, wayOf, type Order, type Product } from '../../../store/shared/rules'
import { shotsOf } from '../../../store/src/pictures'
import { shipsWhen } from '../../../store/src/words'
import { ReaderPages, useReading } from '../../apps/Reader'
import { editionOf, EDITIONS } from '../../data/editions'
import { useShelf, wantShop } from '../../os/shop'
import { pop, push } from '../system'
import { BackButton, GlassGroup, GroupButton, Menu, NavStack, Screen, useApp } from '../ui'
import { StoreSheets } from './Buying'
import { ProductPage } from './Product'
import { Pic, StoreCard } from './storebits'
import { Wallet } from './Wallet'
// (the reader's pages are the desk's own: desk/books.css)
import '../../styles/desk/books.css'
import '../../styles/phone/shop.css'
import '../../styles/phone/books.css'

// Books on the phone (Dom, 27 Nov: it was the store's shelf of books in a tab of its own, and is to be the
// thing the desk has). At the screen's foot are the two places it has, Book Store and Library.
//
// The Book Store is a shelf set out as Apple's own store sets one out (its listing is the basis for the
// three stores): the books two to a row, each a card with its cover, its name, what it costs and a small
// button. A book opens on its own page (Product.tsx, the same screen a piece has in ArtStore), where it is
// bought through the tray every store has. The Library is the books that can be read here (src/data/
// editions.ts): one opens in the reader, a page at a time, turned by a swipe or a tap at either side of the
// page, with the contents and the size of the letters in its bar.
//
// What there is and what it costs is the store's to say (os/shop.ts). A cover is the book's own photograph
// where Shrug has supplied one, and is drawn from its title where it has not, as on the desk.

const BOOK = 'b:'
const READ = 'r:'

/** What a book's cover is marked with: nothing for a book that is simply for sale, and otherwise how it stands. */
function tabOf(book: Product, mine: Order | undefined): string | null {
  if (mine) return mine.status === 'Pre-order' ? 'Pre-ordered' : mine.status === 'Requested' ? 'Requested' : 'You own this'
  if (soldOut(book)) return 'Sold out'
  return book.status === 'Pre-order' || wayOf(book) === 'reserve' ? 'Pre-order' : null
}

const TONES = ['#1f3a5f', '#5a2a3c', '#2f4a3a', '#4a3a6a', '#6a4a22']
/** A book's cover, standing in its card: its photograph, or its title drawn where there is none. */
function Cover({ book, n, title }: { book: Product | null; n: number; title: string }) {
  const shot = book ? shotsOf(book)[0] : undefined
  if (shot) return <Pic src={shot.small} srcSet={shot.set} sizes="45vw" alt="" loading="lazy" decoding="async" draggable={false} data-whole={shot.ground ? '' : undefined} style={shot.at && !shot.ground ? { objectPosition: shot.at } : undefined} />
  return (
    <span className="st-cover" aria-hidden style={{ background: `linear-gradient(160deg, ${TONES[n % TONES.length]}, #101114)` }}>
      <b>{title}</b>
      <small>Shrug</small>
    </span>
  )
}

function Shelves() {
  const shelf = useShelf('books')
  const [side, setSide] = useState<'store' | 'library'>('store')
  const books = shelf?.products ?? []
  const orderOf = (book: Product) => shelf?.orders.find((order) => order.productId === book.id && order.status !== 'Refunded')
  const bookOf = (of: string) => books.find((b) => b.name.trim().toLowerCase() === of) ?? null
  // (a new place begins at its top)
  const scroller = useRef<HTMLDivElement>(null)
  useEffect(() => {
    scroller.current?.scrollTo(0, 0)
  }, [side])

  return (
    <Screen
      title={side === 'library' ? 'Library' : 'Book Store'}
      large
      tone="grouped"
      trailing={<Wallet />}
      className="st bkp"
      scrollRef={scroller}
      foot={
        <div className="ios-glass bkp-tabs" role="tablist" aria-label="Books">
          <button type="button" role="tab" aria-selected={side === 'store'} onClick={() => setSide('store')}>
            <BookOpen size={21} strokeWidth={1.9} aria-hidden />
            Book Store
          </button>
          <button type="button" role="tab" aria-selected={side === 'library'} onClick={() => setSide('library')}>
            <Library size={21} strokeWidth={1.9} aria-hidden />
            Library
          </button>
        </div>
      }
    >
      {side === 'library' ? (
        EDITIONS.length === 0 ? (
          <p className="st-none">Nothing to read here yet. A book that can be read on screen is kept here.</p>
        ) : (
          <ol className="st-list st-list--two">
            {EDITIONS.map((edition, n) => {
              const of = bookOf(edition.of)
              return (
                <li key={edition.of}>
                  <StoreCard small pic={<Cover book={of} n={of ? books.indexOf(of) : n} title={edition.title} />} note="Preview" name={edition.title} action="Read" more={`. Read the preview. ${n + 1} of ${EDITIONS.length}`} onOpen={() => push(READ + edition.of)} />
                </li>
              )
            })}
          </ol>
        )
      ) : !shelf ? (
        <ol className="st-list st-list--two" aria-busy="true" aria-label="Opening the Book Store">
          {[0, 1, 2, 3].map((n) => (
            <li key={n} aria-hidden>
              <span className="st-card st-card--small st-card--wait">
                <span className="st-card__pic" />
              </span>
            </li>
          ))}
        </ol>
      ) : shelf.down ? (
        <p className="st-none" role="status">
          The Book Store isn’t answering. Nothing was charged. Close Books and open it again in a moment.
        </p>
      ) : books.length === 0 ? (
        <p className="st-none">No books just now. New ones land here first.</p>
      ) : (
        <ol className="st-list st-list--two">
          {books.map((b, n) => {
            const mine = orderOf(b)
            const tab = tabOf(b, mine)
            const out = soldOut(b)
            return (
              <li key={b.id}>
                <StoreCard
                  small
                  pic={<Cover book={b} n={n} title={b.name} />}
                  note={tab}
                  tone={mine ? 'on' : tab === 'Pre-order' ? 'gold' : undefined}
                  name={b.name}
                  under={shipsWhen(b, true) ? `Ships ${shipsWhen(b, true)}` : null}
                  action={out ? 'Sold Out' : mine ? 'View' : tab === 'Pre-order' ? 'Pre-order' : 'Buy'}
                  quiet={out}
                  more={`. ${n + 1} of ${books.length}`}
                  onOpen={() => push(BOOK + b.id)}
                />
              </li>
            )
          })}
        </ol>
      )}
    </Screen>
  )
}

/** The reader: a book of the Library, a page at a time. */
function Reader({ of }: { of: string }) {
  const read = useReading(editionOf(of))
  // A swipe turns the page, and so does a tap at either side of it
  const from = useRef<{ x: number; y: number; t: number } | null>(null)
  const down = (e: ReactPointerEvent) => {
    from.current = { x: e.clientX, y: e.clientY, t: e.timeStamp }
  }
  const up = (e: ReactPointerEvent<HTMLDivElement>) => {
    const was = from.current
    from.current = null
    if (!was || !read || (e.target as HTMLElement).closest('a, button')) return
    const dx = e.clientX - was.x
    const dy = e.clientY - was.y
    if (Math.abs(dx) > 34 && Math.abs(dx) > Math.abs(dy)) return read.turn(dx < 0 ? 1 : -1)
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8 || e.timeStamp - was.t > 500) return
    const box = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - box.left) / box.width
    if (x > 0.66) read.turn(1)
    else if (x < 0.34) read.turn(-1)
  }
  if (!read)
    return (
      <Screen title="Library" tone="dark" leading={<BackButton label="Library" />}>
        <p className="bkp-none">That book is not in the Library.</p>
      </Screen>
    )
  const chapters = read.edition.leaves.filter((leaf) => leaf.kind === 'chapter')
  return (
    <Screen
      title={read.edition.title}
      tone="dark"
      fixed
      className="bkp-reader"
      leading={<BackButton label="Library" />}
      trailing={
        <GlassGroup label="Reading">
          {chapters.length > 1 && (
            <Menu label="Contents" part items={chapters.map((leaf) => ({ label: leaf.kind === 'chapter' ? leaf.title : '', onSelect: () => leaf.kind === 'chapter' && read.goTo(leaf.id) }))}>
              <List size={21} strokeWidth={2} aria-hidden />
            </Menu>
          )}
          <GroupButton label={`Text size: ${['small', 'medium', 'large'][read.size]}. Change it`} onClick={read.resize}>
            <span className="bkp-aa" aria-hidden>
              <small>A</small>A
            </span>
          </GroupButton>
        </GlassGroup>
      }
    >
      <div
        className="bkp-pages"
        onPointerDown={down}
        onPointerUp={up}
        onPointerCancel={() => (from.current = null)}
        // (with a keyboard: the arrows, Page Up and Down and Space turn the pages, as they do on the desk)
        onKeyDown={(e) => {
          if (e.metaKey || e.ctrlKey || e.altKey || (e.target as HTMLElement).closest('a, button')) return
          if (e.key === 'ArrowRight' || e.key === 'PageDown' || (e.key === ' ' && !e.shiftKey)) e.preventDefault(), read.turn(1)
          else if (e.key === 'ArrowLeft' || e.key === 'PageUp' || (e.key === ' ' && e.shiftKey)) e.preventDefault(), read.turn(-1)
        }}
      >
        <ReaderPages reading={read} onBack={pop} />
      </div>
    </Screen>
  )
}

export function BooksApp() {
  const { active } = useApp()
  useEffect(() => {
    if (active) wantShop()
  }, [active])
  return (
    <>
      <NavStack>{(view) => (view?.startsWith(BOOK) ? <ProductPage id={view.slice(BOOK.length)} back="Book Store" /> : view?.startsWith(READ) ? <Reader of={view.slice(READ.length)} /> : <Shelves />)}</NavStack>
      <StoreSheets />
    </>
  )
}

