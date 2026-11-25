import { useEffect, useRef, useState } from 'react'
import { BookOpen, ChevronLeft, Library } from 'lucide-react'
import { fmtCents, priceCents, soldOut, wayOf, type Order, type Product } from '../../store/shared/rules'
import { editionOf, EDITIONS } from '../data/editions'
import { shotsOf } from '../../store/src/pictures'
import { Window } from '../kit/window'
import { useShelf, wantShop } from '../os/shop'
import { useStore } from '../os/store'
import { wm } from '../os/wm'
import { ReaderBar, ReaderPages, useReading } from './Reader'
import { Balance, StoreFrame, type FrameHandle } from './storefront'
import '../styles/desk/books.css'

// Books: Shrug's books, in a window after the Mac's own Books.
//
// A sidebar (Book Store, and Library), and a shelf of covers. In the Book Store a book opens on its own
// page, which is the store's (store/, in a frame: storefront.tsx): its photographs, what it costs in
// dollars, their points to bring that down, and the same checkout as everywhere, with the address already
// on file. Nothing else is sold here: art is in ArtStore and the chair in Workspace.
//
// The Library is the books that can be read here (src/data/editions.ts): a book there opens in the reader
// (Reader.tsx), a page at a time, as the Mac's Books reads one. It is open to anyone: a preview is.
//
// What there is and what it costs is the store's to say (os/shop.ts). The covers are the books' own
// photographs where Shrug has supplied them (store/public/pictures), and a cover drawn from the title
// where it has not.

/** What a book's cover is marked with, at its top right: nothing for a book that is simply for sale (its
 * price is on its own page), and otherwise how it stands: to be pre-ordered, or already theirs. */
function tabOf(book: Product, mine: Order | undefined): string | null {
  if (mine) return mine.status === 'Pre-order' ? 'Pre-ordered' : mine.status === 'Requested' ? 'Requested' : 'You own this'
  if (soldOut(book)) return 'Sold out'
  return book.status === 'Pre-order' || wayOf(book) === 'reserve' ? 'Pre-order' : null
}

/** What the reader's bar says of a book, on the pill that goes to its page in the Book Store. */
function getOf(book: Product, mine: Order | undefined): string {
  if (mine) return mine.status === 'Pre-order' ? 'Pre-ordered' : 'You own this'
  if (soldOut(book)) return 'Sold out'
  const way = wayOf(book)
  if (way === 'reserve' || way === 'request') return 'Pre-order'
  const price = fmtCents(priceCents(book))
  return book.status === 'Pre-order' ? `Pre-order ${price}` : price
}

/** A cover for a book that has no photograph yet: its title, set on a color of its own. */
const TONES = ['#1f3a5f', '#5a2a3c', '#2f4a3a', '#4a3a6a', '#6a4a22']
function Cover({ book, n }: { book: Product; n: number }) {
  const shot = shotsOf(book)[0]
  if (shot) return <img src={shot.small} alt="" loading="lazy" decoding="async" draggable={false} style={shot.at ? { objectPosition: shot.at } : undefined} />
  return (
    <span className="bk-drawn" aria-hidden style={{ background: `linear-gradient(160deg, ${TONES[n % TONES.length]}, #101114)` }}>
      <b>{book.name}</b>
      <small>Shrug</small>
    </span>
  )
}

/** A cover for a book the store does not list (or has not answered about yet): its title, as above. */
const Plain = ({ title, n }: { title: string; n: number }) => (
  <span className="bk-drawn" aria-hidden style={{ background: `linear-gradient(160deg, ${TONES[n % TONES.length]}, #101114)` }}>
    <b>{title}</b>
    <small>Shrug</small>
  </span>
)

export function BooksApp() {
  const open = useStore(wm, (s) => s.wins.books.open)
  useEffect(() => {
    if (open) wantShop()
  }, [open])
  const shelf = useShelf('books')
  const [side, setSide] = useState<'store' | 'library'>('store')
  /** The book whose page is open, if one is: the store's own page for it, in the frame. */
  const [reading, setReading] = useState<string | null>(null)
  // The frame is made the first time a book is opened, and kept
  const [made, setMade] = useState(false)
  const frame = useRef<FrameHandle>(null)
  const openBook = (id: string) => {
    setReading(id)
    if (made) frame.current?.go(id)
    else setMade(true)
  }

  const books = shelf?.products ?? []
  const orderOf = (book: Product) => shelf?.orders.find((order) => order.productId === book.id && order.status !== 'Refunded')
  const book = books.find((b) => b.id === reading) ?? null
  const bookOf = (of: string) => books.find((b) => b.name.trim().toLowerCase() === of) ?? null

  /** The book that is open in the reader, if one is. */
  const [open1, setOpen1] = useState<string | null>(null)
  const read = useReading(open1 ? editionOf(open1) : null)
  const shut = () => setOpen1(null)
  // Closed with a book open, the window opens on the Library again
  useEffect(() => {
    if (!open) setOpen1(null)
  }, [open])
  const inStore = read ? bookOf(read.edition.of) : null

  const bar = read ? (
    <ReaderBar
      reading={read}
      onBack={shut}
      end={
        inStore && (
          <button type="button" className="rd-get" onClick={() => (shut(), setSide('store'), openBook(inStore.id))}>
            {getOf(inStore, orderOf(inStore))}
            <span className="sr-only">: {inStore.name} in the Book Store</span>
          </button>
        )
      }
    />
  ) : (
    <div className="bkbar">
      {reading ? (
        <button type="button" className="bkbar__back" onClick={() => setReading(null)}>
          <ChevronLeft size={18} strokeWidth={2.2} aria-hidden />
          Book Store
        </button>
      ) : (
        <span className="bkbar__back" aria-hidden />
      )}
      <b className="bkbar__title">{book ? book.name : 'Books'}</b>
      <Balance className="storebar__wallet bkbar__wallet" />
    </div>
  )

  return (
    <Window className="app bkwin" data-reading={read ? '' : undefined} lightsSize="large" lead={bar} body={{ className: 'bkwin__body' }}>
      {read && <ReaderPages reading={read} onBack={shut} />}
      <div className="bk" hidden={!!reading || !!read}>
        <nav className="bk-side" aria-label="Books">
          <h2>Books</h2>
          <button type="button" aria-current={side === 'store' ? 'page' : undefined} onClick={() => setSide('store')}>
            <BookOpen size={16} strokeWidth={1.9} aria-hidden />
            Book Store
          </button>
          <button type="button" aria-current={side === 'library' ? 'page' : undefined} onClick={() => setSide('library')}>
            <Library size={16} strokeWidth={1.9} aria-hidden />
            Library
            {EDITIONS.length > 0 && <small>{EDITIONS.length}</small>}
          </button>
        </nav>
        <section className="bk-main" aria-label={side === 'library' ? 'Library' : 'Book Store'} data-autofocus tabIndex={-1}>
          <header className="bk-head">
            <h1>{side === 'library' ? 'Library' : 'Book Store'}</h1>
          </header>
          {side === 'library' ? (
            // The books that can be read here. They are the reader's own, so they are here whatever the store says
            EDITIONS.length === 0 ? (
              <p className="bk-none">Nothing to read here yet. A book that can be read on screen is kept here.</p>
            ) : (
              <ol className="bk-shelf">
                {EDITIONS.map((edition, n) => {
                  const of = bookOf(edition.of)
                  return (
                    <li key={edition.of} className="bk-book">
                      <button type="button" className="bk-open" onClick={() => setOpen1(edition.of)}>
                        <span className="bk-cover">
                          {of ? <Cover book={of} n={books.indexOf(of)} /> : <Plain title={edition.title} n={n} />}
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
            <ol className="bk-shelf" aria-busy="true" aria-label="Opening the Book Store">
              {[0, 1, 2, 3, 4].map((n) => (
                <li key={n} className="bk-book bk-book--wait" aria-hidden>
                  <span className="bk-cover" />
                </li>
              ))}
            </ol>
          ) : shelf.down ? (
            <p className="bk-none" role="status">
              The Book Store isn’t answering. Nothing was charged. Close this window and open it again in a moment.
            </p>
          ) : books.length === 0 ? (
            <p className="bk-none">No books just now. New ones land here first.</p>
          ) : (
            <ol className="bk-shelf">
              {books.map((b, n) => {
                const tab = tabOf(b, orderOf(b))
                return (
                  <li key={b.id} className="bk-book">
                    <button type="button" className="bk-open" onClick={() => openBook(b.id)}>
                      <span className="bk-cover">
                        <Cover book={b} n={n} />
                        {tab && (
                          <i className="bk-tab" data-mine={orderOf(b) ? '' : undefined}>
                            {tab}
                          </i>
                        )}
                      </span>
                      <b>{b.name}</b>
                      <small>Made by Shrug</small>
                      <span className="sr-only">
                        {n + 1} of {books.length}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ol>
          )}
        </section>
      </div>
      {/* A book's own page: the store's, where it is bought. "View all" on it comes back to the shelf */}
      {made && (
        <div className="bk-page" hidden={!reading || !!read}>
          <StoreFrame ref={frame} room="books" title="Books: a book" first={`/vip/store/?k=books&p=${encodeURIComponent(reading ?? '')}`} onAt={(place) => setReading(place.product)} />
        </div>
      )}
    </Window>
  )
}
