// YouTube: one playlist, "Videos the team loves" (design/v1, "YouTube"). Each is played by YouTube's own
// embedded player.
//
// The list is templated for now, as the design has it: twelve rows whose titles and channels are in [square
// brackets], none with a video behind it yet. To put one in: `id` is the video's id on YouTube (the part
// after watch?v=), with its title, its channel, its length, and one line from whoever picked it on why.

export interface Video {
  /** Its id on YouTube. Null until it is supplied: a row with none cannot be played. */
  id: string | null
  title: string
  channel: string
  length: string
  /** One line from whoever on the team picked it. */
  why: string
  /** The color its thumbnail stands on until YouTube's own is shown. */
  tone: string
}

export const PLAYLIST = { name: 'Videos the team loves', by: 'Shrug' }

const TONES = ['#8a6a2a', '#35508f', '#7a3f2f', '#3f7a4a', '#4a3b8f', '#2f6f7a', '#8f3b55', '#5a5f6a', '#8a6a2a', '#35508f', '#7a3f2f', '#3f7a4a']

export const VIDEOS: Video[] = TONES.map((tone) => ({ id: null, title: '[Video title]', channel: '[Channel]', length: '[0:00]', why: '[One line from whoever on the team picked it.]', tone }))
