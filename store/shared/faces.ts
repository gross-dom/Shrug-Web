// Shrug's own faces: the pictures a member can have without a photo. Each is an emoji on a soft ground, as
// Contacts on a Mac offers them. Nothing here is artwork: the emoji is drawn by whatever the visitor's
// device draws emoji with, and the ground is two colors.
//
// A member's row keeps only the name of the face they chose (api/profile.ts keeps a file called
// face-shrug.png), so this list can be changed, or swapped for another set, without touching anyone's row.
// A name that is no longer in the list is drawn as the first face.

export interface Face {
  /** As it is kept: face-, then lower-case letters, digits and hyphens (24 at most). */
  id: string
  emoji: string
  /** What it is, for anyone who cannot see it. */
  says: string
  /** The ground it sits on: lighter at the top, deeper at the foot. */
  ground: [string, string]
}

const PEACH: [string, string] = ['#f6d39c', '#e9b571']
const SKY: [string, string] = ['#a9d6f7', '#72b3e9']
const LILAC: [string, string] = ['#cdbdf7', '#a998ea']
const STONE: [string, string] = ['#c3c6cd', '#9094a0']
const LEAF: [string, string] = ['#c8eeb0', '#9ddb82']
const CLAY: [string, string] = ['#f4bb99', '#e69f79']
const ROSE: [string, string] = ['#f7b0cd', '#ea8ab1']

export const FACES: Face[] = [
  { id: 'face-shrug', emoji: '🤷', says: 'A shrug', ground: SKY },
  { id: 'face-grin', emoji: '😀', says: 'A grin', ground: PEACH },
  { id: 'face-rocket', emoji: '🚀', says: 'A rocket', ground: LILAC },
  { id: 'face-unicorn', emoji: '🦄', says: 'A unicorn', ground: LEAF },
  { id: 'face-trophy', emoji: '🏆', says: 'A trophy', ground: CLAY },
  { id: 'face-fire', emoji: '🔥', says: 'Fire', ground: ROSE },
  { id: 'face-donut', emoji: '🍩', says: 'A donut', ground: PEACH },
  { id: 'face-ball', emoji: '⚽', says: 'A soccer ball', ground: LILAC },
  { id: 'face-ghost', emoji: '👻', says: 'A ghost', ground: LEAF },
  { id: 'face-hat', emoji: '🎩', says: 'A top hat', ground: CLAY },
  { id: 'face-taco', emoji: '🌮', says: 'A taco', ground: STONE },
]

/** The face of a name, or the first face where the name is not one of these. */
export const faceOf = (id: string): Face => FACES.find((face) => face.id === id) ?? FACES[0]!
