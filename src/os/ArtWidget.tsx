import { useEffect, useState } from 'react'
import { ART } from '../../store/src/pictures'
import { openProduct } from '../apps/Store'
import { isOn } from './address'
import { launchApp } from './launch'
import { shop, wantShop } from './shop'

// A second widget on the desk, under San Francisco's: the art. One piece at a time, each of the pieces that
// has its photograph in turn, as a frame on a wall changes what it shows. It is the way into ArtStore from
// the desk (Niv, 27 Nov): pressed, ArtStore opens on the piece that is showing.
//
// It is drawn as Apple's News widget is (Dom, 27 Nov, with one beside it): the picture fills the widget,
// the artwork itself and not its photograph on white; it darkens toward its foot, and there, in white, is
// where it is from (ArtStore) with the piece's name under it, as a headline is under its paper's name.
//
// It shows what the site already has (the pictures in store/public/pictures, by the names Shrug gives the
// pieces), so nothing is asked of the store for it: the catalogue is fetched when it is pressed, as it is
// when any store's window is opened.

/** How long a piece is shown before the next one. */
const EACH = 7000

export function ArtWidget() {
  const [at, setAt] = useState(0)
  useEffect(() => {
    // (on a desk asked to keep still, ?still, nothing moves by itself: it shows the first)
    if (ART.length < 2 || isOn('still')) return
    // (it does not turn while the page is not being looked at, so it is where it was left)
    const every = setInterval(() => !document.hidden && setAt((n) => (n + 1) % ART.length), EACH)
    return () => clearInterval(every)
  }, [])
  if (!ART.length) return null
  const piece = ART[at % ART.length]!
  const open = () => {
    // ArtStore, on the piece that is showing, where the store has it for this visitor (its shelf, where it
    // has not). The catalogue may not have been asked for yet: the window opens at once, and goes to the
    // piece when the store has answered
    const name = piece.name.toLowerCase()
    const go = () => {
      const now = shop.get()
      if (now.status === 'loading') return false
      const product = now.status === 'ready' ? now.products.find((p) => p.name.trim().toLowerCase() === name) : null
      if (product) openProduct(product.id)
      return true
    }
    wantShop()
    if (!go()) {
      const stop = shop.subscribe(() => {
        if (go()) stop()
      })
    }
    launchApp('store')
  }
  return (
    <button type="button" className="aw" aria-label={`ArtStore: ${piece.name}, one of ${ART.length} pieces. Opens ArtStore`} onClick={open}>
      <span className="aw__wall" aria-hidden>
        {ART.map((one, i) => (
          <img key={one.name} className="aw__pic" data-on={i === at % ART.length || undefined} src={one.flat.small} alt="" draggable={false} decoding="async" />
        ))}
      </span>
      <span className="aw__says" aria-hidden>
        <small>ArtStore</small>
        <b key={piece.name}>{piece.name}</b>
      </span>
    </button>
  )
}
