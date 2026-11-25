// YouTube: one playlist, "Videos the team loves" (design/v1, "YouTube"). Each is played by YouTube's own
// embedded player.
//
// A row is its video's id on YouTube (the part after watch?v=). These are the twenty-two Dom supplied on
// 25 Nov, in his order. A video's still is YouTube's own, by its id. What it is called and whose it is are
// YouTube's to say: the player says so once a video is played, and the window keeps what it is told for the
// visit (src/apps/YouTube.tsx). Written here, a title or a channel is used from the start, before anything is
// played, and so is its length and the line from whoever picked it: none of those is written yet.

export interface Video {
  /** Its id on YouTube. Null: a row with none cannot be played. */
  id: string | null
  /** Written here, it is shown from the start; otherwise it is as YouTube's player says, once played. */
  title: string | null
  channel: string | null
  length: string | null
  /** One line from whoever on the team picked it. */
  why: string | null
  /** The color its thumbnail stands on until YouTube's own is shown. */
  tone: string
}

export const PLAYLIST = { name: 'Videos the team loves', by: 'Shrug' }

const TONES = ['#8a6a2a', '#35508f', '#7a3f2f', '#3f7a4a', '#4a3b8f', '#2f6f7a', '#8f3b55', '#5a5f6a']

const IDS = ['MnrJzXM7a6o', 'yU3GUHDf0mk', 'kRNLVUqkzg0', 'oXsQ4NMQ6B8', 'aayZ9ybDTBw', '--APdD6vejI', 'PUv66718DII', 'LK5M0_Blhzc', 'GGa_tbspGpU', 'u404SLJj7ig', 'wKiIroiCvZ0', 'NLlGopyXT_g', 'SuTcavAzopg', 'D7TB8b2t3QE', 'WXuK6gekU1Y', 'qie5VITX6eQ', 'UZHTNBMAfAA', 'LaHcOs7mhfU', 'oz49vQwSoTE', 'eU7V4GyEuXA', 'aNSepdhwnm8', 'qV_t9oyvxG0']

export const VIDEOS: Video[] = IDS.map((id, i) => ({ id, title: null, channel: null, length: null, why: null, tone: TONES[i % TONES.length]! }))
