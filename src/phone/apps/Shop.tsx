import { useEffect } from 'react'
import { soldOut } from '../../../store/shared/rules'
import { shotsOf } from '../../../store/src/pictures'
import { badgeOf, owned } from '../../../store/src/words'
import { useShelf, wantShop } from '../../os/shop'
import { push } from '../system'
import { NavStack, Screen, useApp } from '../ui'
import { StoreSheets } from './Buying'
import { ProductPage } from './Product'
import { drawnOn, Pic, StoreCard } from './storebits'
import { Wallet } from './Wallet'
import '../../styles/phone/shop.css'

// ArtStore, on the phone: the pieces in single file under a large title, each a card as Apple's own store
// sets one out (Dom, 27 Nov: that store is the basis for the design of ours), and each piece's own page
// (Product.tsx). It is drawn here, as every screen of the phone's is: it was the store's own pages in a
// frame, which a phone's browser would not scroll, kept the keyboard from, and painted in a colour of its
// own. What there is and what it costs is the store's to say (os/shop.ts); buying is the tray every store
// has (Buying.tsx).

const PIECE = 'p:'

// (A piece's card on the shelf says its name and no price: a price is on its own page, once it is opened. Dom, 27 Nov.)

function Shelf() {
  const shelf = useShelf('art')
  const pieces = shelf?.products ?? []
  return (
    <Screen title="ArtStore" large tone="grouped" trailing={<Wallet />} className="st">
      {!shelf ? (
        <ol className="st-list" aria-busy="true" aria-label="Opening ArtStore">
          {[0, 1].map((n) => (
            <li key={n} aria-hidden>
              <span className="st-card st-card--wait">
                <span className="st-card__pic" />
              </span>
            </li>
          ))}
        </ol>
      ) : shelf.down ? (
        <p className="st-none" role="status">
          ArtStore isn’t answering. Nothing was charged. Close it and open it again in a moment.
        </p>
      ) : pieces.length === 0 ? (
        <p className="st-none">Nothing here yet. New pieces land here first.</p>
      ) : (
        <ol className="st-list">
          {pieces.map((piece, n) => {
            const shot = shotsOf(piece)[0]
            const badge = badgeOf(piece, shelf.orders)
            const out = soldOut(piece)
            return (
              <li key={piece.id}>
                <StoreCard
                  pic={
                    shot ? (
                      <Pic src={shot.small} srcSet={shot.set} sizes="90vw" alt="" loading={n < 2 ? 'eager' : 'lazy'} decoding="async" draggable={false} data-whole={shot.ground ? '' : undefined} style={shot.at && !shot.ground ? { objectPosition: shot.at } : undefined} />
                    ) : (
                      <span className="st-drawn" style={{ background: drawnOn(pieces, piece) }} aria-hidden>
                        {piece.name}
                      </span>
                    )
                  }
                  note={badge?.text}
                  tone={badge?.tone}
                  name={piece.name}
                  action={out ? 'Sold Out' : owned(shelf.orders, piece) ? 'View' : piece.status === 'Pre-order' ? 'Pre-order' : 'Buy'}
                  quiet={out}
                  more={`. ${n + 1} of ${pieces.length}`}
                  onOpen={() => push(PIECE + piece.id)}
                />
              </li>
            )
          })}
        </ol>
      )}
    </Screen>
  )
}

export function ArtStoreApp() {
  const { active } = useApp()
  useEffect(() => {
    if (active) wantShop()
  }, [active])
  return (
    <>
      <NavStack>{(view) => (view?.startsWith(PIECE) ? <ProductPage id={view.slice(PIECE.length)} back="ArtStore" /> : <Shelf />)}</NavStack>
      <StoreSheets />
    </>
  )
}
