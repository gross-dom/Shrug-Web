import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { BookOpen, Library, List } from 'lucide-react'
import { fmtCents, priceCents, soldOut, wayOf, type Order, type Product } from '../../../store/shared/rules'
import { shotsOf } from '../../../store/src/pictures'
import { shipsWhen } from '../../../store/src/words'
import { ReaderPages, useReading } from '../../apps/Reader'
import { StoreFrame, type FrameHandle } from '../../apps/storefront'
import { editionOf, EDITIONS } from '../../data/editions'
import { useShelf, wantShop } from '../../os/shop'
import { LOGIN, LogInSheet } from '../LogIn'
import { pop, push } from '../system'
import { BackButton, GlassGroup, GroupButton, Menu, NavStack, Screen, SheetHost, useApp } from '../ui'
import { Wallet } from './Shop'
import '../../styles/desk/books.css'
import '../../styles/phone/shop.css'
import '../../styles/phone/books.css'

// Books on the phone (Dom, 27 Nov: it was the store's shelf of books in a tab of its own, and is to be the
// thing the desk has). It is the desk's Books (src/apps/Books.tsx) as an iPhone has its own: a shelf of
// covers under a large title, and at the screen's foot the two places it has, Book Store and Library.
//
// In the Book Store a book opens on its own page, which is the store's (in this app's frame: Shop.tsx): its
// photographs, what it costs, how many, and the same checkout as everywhere. The Library is the books that
// can be read here (src/data/editions.ts): one opens in the reader, a page at a time, turned by a swipe or a
// tap at either side of the page, with the contents and the size of the letters in its bar.
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

/** What a book costs, as its row on the shelf says it. */
function priceOf(book: Product): string | null {
  const way = wayOf(book)
  if (soldOut(book) || way === 'reserve' || way === 'request' || book.priceHidden) return null
  return fmtCents(priceCents(book))
}

const TONES = ['#1f3a5f', '#5a2a3c', '#2f4a3a', '#4a3a6a', '#6a4a22']
const Drawn = ({ title, n }: { title: string; n: number }) => (
  <span className="bk-drawn" aria-hidden style={{ background: `linear-gradient(160deg, ${TONES[n % TONES.length]}, #101114)` }}>
    <b>{title}</b>
    <small>Shrug</small>
  </span>
)
function Cover({ book, n }: { book: Product; n: number }) {
  const shot = shotsOf(book)[0]
  if (shot) return <img src={shot.small} srcSet={shot.set} sizes="50vw" alt="" loading="lazy" decoding="async" draggable={false} style={shot.at ? { objectPosition: shot.at } : undefined} />
  return <Drawn title={book.name} n={n} />
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
      tone="dark"
      leading={null}
      trailing={<Wallet />}
      className="bkp"
      scrollRef={scroller}
      foot={
        <div className="ios-glass bkp-tabs" data-dark role="tablist" aria-label="Books">
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
          <p className="bkp-none">Nothing to read here yet. A book that can be read on screen is kept here.</p>
        ) : (
          <ol className="bkp-shelf">
            {EDITIONS.map((edition, n) => {
              const of = bookOf(edition.of)
              return (
                <li key={edition.of}>
                  <button type="button" className="bkp-book" onClick={() => push(READ + edition.of)}>
                    <span className="bk-cover">
                      {of ? <Cover book={of} n={books.indexOf(of)} /> : <Drawn title={edition.title} n={n} />}
                      <i className="bk-tab">Preview</i>
                    </span>
                    <b>{edition.title}</b>
                    <small>Made by Shrug</small>
                    <span className="sr-only">
                      . Read the preview. {n + 1} of {EDITIONS.length}
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
        )
      ) : !shelf ? (
        <ol className="bkp-shelf" aria-busy="true" aria-label="Opening the Book Store">
          {[0, 1, 2, 3].map((n) => (
            <li key={n} aria-hidden>
              <span className="bkp-book bkp-book--wait">
                <span className="bk-cover" />
              </span>
            </li>
          ))}
        </ol>
      ) : shelf.down ? (
        <p className="bkp-none" role="status">
          The Book Store isn’t answering. Nothing was charged. Close Books and open it again in a moment.
        </p>
      ) : books.length === 0 ? (
        <p className="bkp-none">No books just now. New ones land here first.</p>
      ) : (
        <ol className="bkp-shelf">
          {books.map((b, n) => {
            const tab = tabOf(b, orderOf(b))
            const price = priceOf(b)
            return (
              <li key={b.id}>
                <button type="button" className="bkp-book" onClick={() => push(BOOK + b.id)}>
                  <span className="bk-cover">
                    <Cover book={b} n={n} />
                    {tab && (
                      <i className="bk-tab" data-mine={orderOf(b) ? '' : undefined}>
                        {tab}
                      </i>
                    )}
                  </span>
                  <b>{b.name}</b>
                  <small>
                    Made by Shrug{price ? ` · ${price}` : ''}
                  </small>
                  {shipsWhen(b, true) && <small className="bkp-ships">Ships {shipsWhen(b, true)}</small>}
                  <span className="sr-only">
                    {n + 1} of {books.length}
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      )}
    </Screen>
  )
}

/** A book's own page: the store's, where it is bought. "View all" on it comes back to the shelf. */
function BookPage({ id }: { id: string }) {
  const frame = useRef<FrameHandle>(null)
  const shelf = useShelf('books')
  const [at, setAt] = useState(id)
  const book = shelf?.products.find((b) => b.id === at) ?? null
  return (
    <Screen title={book?.name ?? 'Books'} tone="dark" fixed className="shop-ios" leading={<BackButton label="Book Store" />} trailing={<Wallet />}>
      <StoreFrame ref={frame} room="books" title="Books: a book" first={`/vip/store/?k=books&p=${encodeURIComponent(id)}`} onAt={(place) => (place.product ? setAt(place.product) : pop())} />
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
      <NavStack>{(view) => (view?.startsWith(BOOK) ? <BookPage id={view.slice(BOOK.length)} /> : view?.startsWith(READ) ? <Reader of={view.slice(READ.length)} /> : <Shelves />)}</NavStack>
      <SheetHost>{(name) => (name === LOGIN ? <LogInSheet /> : null)}</SheetHost>
    </>
  )
}

