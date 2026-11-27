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

/** A product's first photograph, small, in a rounded square. */
export function Thumb({ product, size = 52 }: { product: Pick<Product, 'name' | 'picture' | 'pictures'> | null | undefined; size?: number }) {
  const shot = product ? shotsOf(product)[0] : undefined
  return (
    <span className="co-thumb" style={{ width: size, height: size, background: shot?.ground }}>
      {shot && <img src={shot.small} alt="" decoding="async" draggable={false} data-whole={shot.ground ? '' : undefined} style={shot.at && !shot.ground ? { objectPosition: shot.at } : undefined} />}
    </span>
  )
}
