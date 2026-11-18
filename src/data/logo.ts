// Shrug's logo: the s of the identity, set larger than the tile it sits on and cut by it. The same
// letter, very large, is the wallpaper (tools/wallpaper.svg). It is kept here as plain data so
// that the site (src/os/icons.tsx), the pages the build writes (tools/page.ts) and the pictures made
// from it (tools/icons.cjs, tools/og.cjs) all draw the one shape.

/** The s, in the 200-unit box the identity draws it in: it stands from 40 to 160. */
export const S = 'M154.17 79.38H115.83Q115.42 74.06 110.78 70.99Q106.15 67.92 100 67.92Q94.58 67.92 90.83 69.84Q87.08 71.77 87.08 75.42Q87.08 78.02 89.32 80.31Q91.56 82.6 98.12 83.75L121.88 87.92Q139.69 91.04 148.49 98.75Q157.29 106.46 157.29 119.38Q157.29 131.88 150 140.99Q142.71 150.1 130.05 155.05Q117.4 160 101.25 160Q74.58 160 59.53 149.11Q44.48 138.23 42.71 120.42H84.17Q85.1 125.94 89.79 128.91Q94.48 131.88 101.46 131.88Q107.29 131.88 111.04 129.9Q114.79 127.92 114.79 124.38Q114.79 118.23 101.46 115.83L80.83 112.08Q63.12 108.85 54.27 100.26Q45.42 91.67 45.42 77.92Q45.42 65.73 51.93 57.29Q58.44 48.85 70.47 44.43Q82.5 40 99.17 40Q124.38 40 138.91 50.47Q153.44 60.94 154.17 79.38Z'

/** How the s sits on a square tile 180 units across: it runs off the tile's left side and its foot. */
export const ON_TILE = 'translate(-69.34 -35.33) scale(1.43333)'

/** And in a disc 200 units across, where Shrug is a face in a conversation. */
export const IN_DISC = 'translate(-77.03 -39.26) scale(1.5925)'

/** The tile as markup, for a page that has no script to draw it: the loading screen, the plain page, the page for an address that is not there. */
export const tileSvg = (size: number, ground = '#fff', ink = '#000') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="${size}" height="${size}" aria-hidden="true"><rect width="180" height="180" fill="${ground}"/><path fill="${ink}" transform="${ON_TILE}" d="${S}"/></svg>`

/** The three letters of VIP, drawn (not set in a typeface, so they are the same on every machine): for a tile 100 units across. */
export const VIP_LETTERS = 'M17.25 35H25.65L30.75 50.3L35.85 35H44.25L34.25 65H27.25ZM48.25 35H56.25V65H48.25ZM61.75 35H73.75a9 9 0 0 1 0 18H69.75V65H61.75ZM69.75 41.6V46.4H73.6a2.4 2.4 0 0 0 0-4.8Z'
