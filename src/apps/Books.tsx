import { useEffect, useRef, useState } from 'react'
import { BookOpen, ChevronLeft, Library } from 'lucide-react'
import { fmtCents, priceCents, soldOut, wayOf, type Order, type Product } from '../../store/shared/rules'
import { shotsOf } from '../../store/src/pictures'
import { Window } from '../kit/window'
import { account, askLogIn } from '../os/account'
import { useShelf, wantShop } from '../os/shop'
import { useStore } from '../os/store'
import { wm } from '../os/wm'
import { Balance, StoreFrame, type FrameHandle } from './storefront'
import '../styles/desk/books.css'

// Books: Shrug's books, in a window after the Mac's own Books.
//
// A sidebar (Book Store, and Library: what they already have), and a shelf of covers. A book opens on its
// own page, which is the store's (store/, in a frame: storefront.tsx): its photographs, what it costs in
// dollars, their points to bring that down, and the same checkout as everywhere, with the address already
// on file. Nothing else is sold here: art is in ArtStore and the chair in Workspace.
//
// What there is and what it costs is the store's to say (os/shop.ts). The covers are the books' own
// photographs where Shrug has supplied them (store/public/pictures), and a cover drawn from the title
// where it has not.

/** What a book's button says, as the Mac's Books says a price: the price, or how it is got. */
function tagOf(book: Product, mine: Order | undefined): string {
  if (mine) return mine.status === 'Pre-order' ? 'Pre-ordered' : mine.status === 'Requested' ? 'Requested' : 'Yours'
  if (soldOut(book)) return 'Sold out'
  const way = wayOf(book)
  if (way === 'reserve') return 'Reserve'
  if (way === 'request') return 'Request'
  const price = fmtCents(priceCents(book))
  return book.status === 'Pre-order' ? `Pre-order ${price}` : price
}

/** A cover for a book that has no photograph yet: its title, set on a color of its own. */
const TONES = ['#1f3a5f', '#5a2a3c', '#2f4a3a', '#4a3a6a', '#6a4a22']
function Cover({ book, n }: { book: Product; n: number }) {
  const shot = shotsOf(book)[0]
  if (shot) return <img src={shot.small} alt="" loading="lazy" decoding="async" draggable={false} style={shot.at ? { objectPosition: shot.at } : undefined} />
  return (
    <span className="bk-drawn" style={{ background: `linear-gradient(160deg, ${TONES[n % TONES.length]}, #101114)` }}>
      <b>{book.name}</b>
      <small>Shrug</small>
    </span>
  )
}

export function BooksApp() {
  const open = useStore(wm, (s) => s.wins.books.open)
  useEffect(() => {
    if (open) wantShop()
  }, [open])
  const shelf = useShelf('books')
  const member = useStore(account, (s) => s.status === 'member')
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
  const mine = books.filter((book) => orderOf(book))
  const book = books.find((b) => b.id === reading) ?? null
  const list = side === 'library' ? mine : books

  const bar = (
    <div className="bkbar">
      {reading ? (
        <button type="button" className="bkbar__back" onClick={() => setReading(null)}>
          <ChevronLeft size={18} strokeWidth={2.2} aria-hidden />
          {side === 'library' ? 'Library' : 'Book Store'}
        </button>
      ) : (
        <span className="bkbar__back" aria-hidden />
      )}
      <b className="bkbar__title">{book ? book.name : 'Books'}</b>
      <Balance className="storebar__wallet bkbar__wallet" />
    </div>
  )

  return (
    <Window className="app bkwin" lightsSize="large" lead={bar} body={{ className: 'bkwin__body' }}>
      <div className="bk" hidden={!!reading}>
        <nav className="bk-side" aria-label="Books">
          <h2>Books</h2>
          <button type="button" aria-current={side === 'store' ? 'page' : undefined} onClick={() => setSide('store')}>
            <BookOpen size={16} strokeWidth={1.9} aria-hidden />
            Book Store
          </button>
          <button type="button" aria-current={side === 'library' ? 'page' : undefined} onClick={() => setSide('library')}>
            <Library size={16} strokeWidth={1.9} aria-hidden />
            Library
            {mine.length > 0 && <small>{mine.length}</small>}
          </button>
        </nav>
        <section className="bk-main" aria-label={side === 'library' ? 'Library' : 'Book Store'} data-autofocus tabIndex={-1}>
          <header className="bk-head">
            <h1>{side === 'library' ? 'Library' : 'Book Store'}</h1>
            <p>{side === 'library' ? 'The books you’ve bought or pre-ordered.' : 'Five books from Shrug. Prices in dollars; your points bring them down.'}</p>
          </header>
          {!shelf ? (
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
          ) : side === 'library' && !member ? (
            <div className="bk-none">
              <p>Log in to see your library.</p>
              <button type="button" className="bk-pill" onClick={() => askLogIn(null)}>
                Log In
              </button>
            </div>
          ) : list.length === 0 ? (
            <p className="bk-none">{side === 'library' ? 'Nothing yet. A book you buy or pre-order in the Book Store is kept here.' : 'No books just now. New ones land here first.'}</p>
          ) : (
            <ol className="bk-shelf">
              {list.map((b, n) => (
                <li key={b.id} className="bk-book">
                  <button type="button" className="bk-open" onClick={() => openBook(b.id)}>
                    <span className="bk-cover">
                      <Cover book={b} n={books.indexOf(b)} />
                    </span>
                    <b>{b.name}</b>
                    <small>{b.status === 'Pre-order' ? 'Pre-order' : 'Shrug'}</small>
                    <span className="bk-pill" data-mine={orderOf(b) ? '' : undefined}>
                      {tagOf(b, orderOf(b))}
                    </span>
                    <span className="sr-only">
                      {n + 1} of {list.length}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
      {/* A book's own page: the store's, where it is bought. "View all" on it comes back to the shelf */}
      {made && (
        <div className="bk-page" hidden={!reading}>
          <StoreFrame ref={frame} room="books" title="Books: a book" first={`/vip/store/?k=books&p=${encodeURIComponent(reading ?? '')}`} onAt={(place) => setReading(place.product)} />
        </div>
      )}
    </Window>
  )
}
