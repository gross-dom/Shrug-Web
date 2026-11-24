// What QuickTime Player has to play (design/v1, "QuickTime Player"): two items, with room for more.
//
// A film is a file: `src` is its address (an .mp4 the site serves, or one on a host that hands files over),
// and `poster` the still it shows before it starts. Neither film has been supplied yet. Until one is, an item
// with no `src` plays as a stand-in: its poster, with the player's clock running for the film's length, so
// that everything about the player can be seen and used. Put the file's address in `src` and it plays.
// (A film kept on Vimeo is not wired up yet: its player needs Vimeo's own script to be driven without its
// controls showing, and an id to point at.)

export interface Film {
  id: string
  name: string
  /** How long it runs, in seconds: shown before it has loaded, and how long a stand-in plays for. */
  length: number
  /** The file. Null until it is supplied. */
  src: string | null
  /** The still shown before it plays, and through a stand-in. */
  poster: string
}

export const FILMS: Film[] = [
  { id: 'film', name: 'Film', length: 300, src: null, poster: '/wallpapers/graphite.webp' },
  { id: 'study', name: 'Study', length: 40, src: null, poster: '/wallpapers/dusk.webp' },
]
