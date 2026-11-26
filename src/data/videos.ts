// YouTube: one playlist, "Daily Inspiration" (Dom's name for it, 26 Nov; design/v1, "YouTube"). Each is played by YouTube's own
// embedded player.
//
// A row is its video's id on YouTube (the part after watch?v=). These are the twenty-two Dom supplied on
// 25 Nov, in his order. A video's still is YouTube's own, by its id. What each is called and whose channel
// it is on are YouTube's own words, read from YouTube on 25 Nov (its oEmbed) and written here. YouTube's
// answer has no length in it, so none is shown; nor is there yet a line from whoever picked each. A row
// added later with no title goes by its number until it is played, when the player says what it is called.

export interface Video {
  /** Its id on YouTube. Null: a row with none cannot be played. */
  id: string | null
  /** As YouTube has it. Null: it is as the player says, once played. */
  title: string | null
  channel: string | null
  length: string | null
  /** One line from whoever on the team picked it. */
  why: string | null
  /** The color its thumbnail stands on until YouTube's own is shown. */
  tone: string
}

export const PLAYLIST = { name: 'Daily Inspiration', by: 'Shrug' }

const TONES = ['#8a6a2a', '#35508f', '#7a3f2f', '#3f7a4a', '#4a3b8f', '#2f6f7a', '#8f3b55', '#5a5f6a']

const ROWS: { id: string; title: string | null; channel: string | null }[] = [
  { id: 'MnrJzXM7a6o', title: 'Steve Jobs introduces iPhone in 2007', channel: 'John Schroter' },
  { id: 'yU3GUHDf0mk', title: 'Jensen Huang-The First Six Months of NVIDIA', channel: 'Entrepreneurship.org' },
  { id: 'kRNLVUqkzg0', title: 'This 28-year-old picks next big startup', channel: 'CNN Business' },
  { id: 'oXsQ4NMQ6B8', title: 'Raf Simons Autumn/Winter 2001-2002 "Riot! Riot! Riot!"', channel: 'YOURFASHIONARCHIVE' },
  { id: 'aayZ9ybDTBw', title: 'Inspiration: Jay-Z & Timbaland in the Studio', channel: 'The Game Tapes' },
  { id: '--APdD6vejI', title: 'Facebook Interview', channel: 'Derek Franzese' },
  { id: 'PUv66718DII', title: 'Bret Victor - Inventing on Principle', channel: 'Rui Oliveira' },
  { id: 'LK5M0_Blhzc', title: 'music that makes 4 hours feel like 40 minutes', channel: 'createyt' },
  { id: 'GGa_tbspGpU', title: 'Magic: The Gathering - 1997 "MTV Invitational" [ALL 4 "Motel California" Commercial Bumpers]', channel: 'The Booster Pack Network' },
  { id: 'u404SLJj7ig', title: 'Netscape Mozilla Documentary 1998 - 2000 ProJect Code Rush - creative common licence', channel: 'znoopy2k' },
  { id: 'wKiIroiCvZ0', title: 'David Lynch on iPhone', channel: 'Brittney Gilbert' },
  { id: 'NLlGopyXT_g', title: 'The Machine is Us/ing Us (Final Version)', channel: 'Michael Wesch' },
  { id: 'SuTcavAzopg', title: 'iPod\'s Dirty Secret - from 2003', channel: 'Casey Neistat Classics' },
  { id: 'D7TB8b2t3QE', title: 'Project Glass: Live Demo At Google I/O', channel: 'Google for Developers' },
  { id: 'WXuK6gekU1Y', title: 'AlphaGo - The Movie | Full award-winning documentary', channel: 'Google DeepMind' },
  { id: 'qie5VITX6eQ', title: 'Core Studio Public Lecture: Virgil Abloh, “Insert Complicated Title Here”', channel: 'Harvard GSD' },
  { id: 'UZHTNBMAfAA', title: 'OpenAI Five: Dota Gameplay', channel: 'OpenAI' },
  { id: 'LaHcOs7mhfU', title: 'David Bowie predicted in 1999 the impact of the Internet in BBC interview', channel: 'loquenotecuentan' },
  { id: 'oz49vQwSoTE', title: 'Satoshi Kon - Editing Space & Time', channel: 'Every Frame a Painting' },
  { id: 'eU7V4GyEuXA', title: 'A Brief History of John Baldessari', channel: 'Bonjour Supermarché' },
  { id: 'aNSepdhwnm8', title: 'Nike Basketball Freestyle Commercial (2001)', channel: 'TFC Builds' },
  { id: 'qV_t9oyvxG0', title: 'Daft Punk - Rollin & Scratchin (Live at Mayan Theater 1997)', channel: 'Daft Punk' },
]

export const VIDEOS: Video[] = ROWS.map((row, i) => ({ ...row, length: null, why: null, tone: TONES[i % TONES.length]! }))
