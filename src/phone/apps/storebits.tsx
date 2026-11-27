import type { ImgHTMLAttributes, ReactNode } from 'react'
import type { Product } from '../../../store/shared/rules'
import { shotsOf } from '../../../store/src/pictures'

// Small things the phone's store screens share: a product's thumbnail, and how an option and an address are said.

/** An option's name without the colour it may carry ("Sand #c8b89a" is Sand). */
export const optionName = (option: string) => option.replace(/\s#[0-9a-f]{3,8}$/i, '').trim()

/** An address in a few words: who, and which city. */
export const brief = (shipTo: string) => {
  const lines = shipTo.split('\n').filter((line) => line.trim())
  const city = (lines.length > 2 ? lines[lines.length - 1]! : '').split(',')[0]!.trim()
  return [lines[0], city].filter(Boolean).join(', ')
}

const TONES = ['#1f3a5f', '#5a2a3c', '#2f4a3a', '#4a3a6a', '#6a4a22']
/** What a thing with no photograph is drawn on: a colour by its place among the things of its kind, as the
 * shelf of Books draws a cover (src/apps/Books.tsx), running down into black. */
export const drawnOn = (products: Pick<Product, 'id' | 'kind'>[], product: Pick<Product, 'id' | 'kind'> | null | undefined): string => {
  const n = product ? Math.max(0, products.filter((p) => p.kind === product.kind).findIndex((p) => p.id === product.id)) : 0
  return `linear-gradient(160deg, ${TONES[n % TONES.length]}, #101114)`
}

/** A product's first photograph, small, in a rounded square; `drawn` is what it is painted with where it has none. */
export function Thumb({ product, size = 52, drawn }: { product: Pick<Product, 'name' | 'picture' | 'pictures'> | null | undefined; size?: number; drawn?: string }) {
  const shot = product ? shotsOf(product)[0] : undefined
  return (
    <span className="co-thumb" style={{ width: size, height: size, background: shot ? shot.ground : drawn }}>
      {shot && <img src={shot.small} alt="" decoding="async" draggable={false} data-whole={shot.ground ? '' : undefined} style={shot.at && !shot.ground ? { objectPosition: shot.at } : undefined} />}
    </span>
  )
}

/** A picture that comes up as it arrives (shop.css): it is marked once it has loaded, and one that was
 * already to hand is marked as it is drawn, so that it is simply there. */
export function Pic(props: ImgHTMLAttributes<HTMLImageElement>) {
  return (
    <img
      {...props}
      ref={(el) => {
        if (el?.complete && el.naturalWidth) el.setAttribute('data-in', '')
      }}
      onLoad={(e) => e.currentTarget.setAttribute('data-in', '')}
    />
  )
}

/** One thing on a shelf, as Apple's own store sets one out (Dom, 27 Nov: its listing is the basis for ours):
 * a white card on the gray, its picture in the middle on its own ground, a quiet line where there is
 * something to say of it (how many are left, that it is a pre-order), its name, what it costs, and a small
 * blue button. The whole card is the way to its page. `small`: two to a row. */
export function StoreCard({ small, pic, note, tone, name, price, under, action, quiet, more, onOpen }: { small?: boolean; pic: ReactNode; note?: string | null; tone?: string; name: string; price?: string | null; under?: string | null; action: string; quiet?: boolean; more?: string; onOpen: () => void }) {
  return (
    <button type="button" className={`st-card${small ? ' st-card--small' : ''}`} onClick={onOpen}>
      <span className="st-card__pic">{pic}</span>
      {note && (
        <small className="st-card__note" data-tone={tone}>
          {note}
        </small>
      )}
      <b className="st-card__name">{name}</b>
      {price && <span className="st-card__price">{price}</span>}
      {under && <small className="st-card__under">{under}</small>}
      <span className="st-card__gap" aria-hidden />
      <span className="st-card__go" data-quiet={quiet || undefined}>
        {action}
      </span>
      {more && <span className="sr-only">{more}</span>}
    </button>
  )
}
