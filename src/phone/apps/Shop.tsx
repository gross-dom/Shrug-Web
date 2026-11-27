import { useEffect } from 'react'
import { fmtCents, priceCents, wayOf, type Product } from '../../../store/shared/rules'
import { shotsOf } from '../../../store/src/pictures'
import { badgeOf } from '../../../store/src/words'
import { useShelf, wantShop } from '../../os/shop'
import { push } from '../system'
import { NavStack, Screen, useApp } from '../ui'
import { StoreSheets } from './Buying'
import { ProductPage } from './Product'
import { Wallet } from './Wallet'
import '../../styles/phone/shop.css'

// ArtStore, on the phone: the pieces, two to a row under a large title, and each piece's own page
// (Product.tsx). It is drawn here, as every screen of the phone's is: it was the store's own pages in a
// frame, which a phone's browser would not scroll, kept the keyboard from, and painted in a colour of its
// own. What there is and what it costs is the store's to say (os/shop.ts); buying is the tray every store
// has (Buying.tsx).

const PIECE = 'p:'

/** What a piece costs, as its tile says it. */
export function priceOf(product: Product): string {
  const way = wayOf(product)
  if (way === 'request') return 'On request'
  if (product.priceHidden) return 'Log in for price'
  if (way === 'reserve') return 'Pre-order'
  const cents = priceCents(product)
  return cents === 0 ? 'Free' : fmtCents(cents)
}

function Shelf() {
  const shelf = useShelf('art')
  const pieces = shelf?.products ?? []
  return (
    <Screen title="ArtStore" large tone="dark" trailing={<Wallet />} className="st">
      {!shelf ? (
        <ol className="st-grid" aria-busy="true" aria-label="Opening ArtStore">
          {[0, 1, 2, 3].map((n) => (
            <li key={n} aria-hidden>
              <span className="st-tile st-tile--wait">
                <span className="st-pic" />
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
        <ol className="st-grid">
          {pieces.map((piece, n) => {
            const shot = shotsOf(piece)[0]
            const badge = badgeOf(piece, shelf.orders)
            return (
              <li key={piece.id}>
                <button type="button" className="st-tile" onClick={() => push(PIECE + piece.id)}>
                  <span className="st-pic" style={shot?.ground ? { background: shot.ground } : undefined}>
                    {shot && <img src={shot.small} srcSet={shot.set} sizes="50vw" alt="" loading={n < 4 ? 'eager' : 'lazy'} decoding="async" draggable={false} data-whole={shot.ground ? '' : undefined} style={shot.at && !shot.ground ? { objectPosition: shot.at } : undefined} />}
                    {badge && (
                      <i className="st-badge" data-tone={badge.tone}>
                        {badge.text}
                      </i>
                    )}
                  </span>
                  <b>{piece.name}</b>
                  <small>{priceOf(piece)}</small>
                  <span className="sr-only">
                    . {n + 1} of {pieces.length}
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
