import { faceOf } from '../../store/shared/faces'
import type { Picture } from '../../store/shared/rules'

// Someone's picture, in a circle: a photo of theirs, one of Shrug's faces (an emoji on a soft ground:
// store/shared/faces.ts), or, where they have neither yet, the first letter of their name on grey, as a Mac
// draws a contact with no picture.

export function Face({ picture, name = '', size }: { picture: Picture | null; name?: string; size: number }) {
  const box = { width: size, height: size }
  if (picture && 'url' in picture) return <img className="face face--photo" src={picture.url} alt="" draggable={false} style={box} />
  if (picture) {
    const face = faceOf(picture.face)
    return (
      <span className="face face--emoji" style={{ ...box, fontSize: Math.round(size * 0.56), background: `linear-gradient(${face.ground[0]}, ${face.ground[1]})` }} aria-hidden>
        {face.emoji}
      </span>
    )
  }
  return (
    <span className="face face--mono" style={{ ...box, fontSize: Math.round(size * 0.5) }} aria-hidden>
      {(name.trim()[0] ?? '').toUpperCase()}
    </span>
  )
}
