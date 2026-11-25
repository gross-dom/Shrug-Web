// The apps out on the desk, and what else step 5 of design/v1 added: the Film, which QuickTime Player opens;
// Photo Booth; Spotify; YouTube; the Photographs in Wallpapers; and a message to Shrug, in Messages.
// (What goes in several of them has not been supplied yet: the films, the episodes, the videos and the
// photographs are stand-ins or templated, as src/data says of each, and that is what these hold them to.)
//   node desk-apps.cjs http://127.0.0.1:4273/
const { chromium } = require('playwright')
const A = require('./lib.cjs')
const BASE = process.argv[2] || A.BASE

let failed = 0
const check = (name, ok, detail = '') => {
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`)
}

;(async () => {
  const browser = await A.launch()
  const front = (p) => p.evaluate(() => document.querySelector('.wf[data-active]')?.dataset.app ?? null)
  const dock = (p) => p.evaluate(() => [...document.querySelector('.dock__shelf').children].map((el) => (el.classList.contains('dock__rule') ? '|' : `${el.dataset.dockApp}${el.hasAttribute('data-open') ? '*' : ''}`)).join(' '))
  const sizeOf = (p, app) => p.evaluate((app) => { const r = document.querySelector(`.wf[data-app="${app}"]`).getBoundingClientRect(); return `${Math.round(r.width)}x${Math.round(r.height)}` }, app)
  const openFromDesk = async (p, id, app = id) => {
    await p.locator(`[data-desk="${id}"]`).dblclick()
    await p.waitForSelector(`.wf[data-app="${app}"][data-open]`, { timeout: 15000 })
    await p.waitForTimeout(700)
  }
  const close = async (p, app) => { await p.locator(`.wf[data-app="${app}"] button[aria-label^="Close"]`).click(); await p.waitForTimeout(500) }

  // ---- the desk
  let t = await A.open(browser, { device: 'desktop', base: BASE, query: 'still&empty' })
  let p = t.page
  await p.waitForTimeout(1600)
  const desk = await p.evaluate(() => { const items = [...document.querySelectorAll('.desk__item')]; const rects = items.map((i) => i.getBoundingClientRect()); const dockTop = document.querySelector('.dock__shelf').getBoundingClientRect().top; return { ids: items.map((i) => i.dataset.desk).join(' '), says: items.map((i) => i.getAttribute('aria-label')).join(' | '), oneLine: rects.every((r) => Math.abs(r.left - rects[0].left) < 1), clear: rects.every((r) => r.bottom <= dockTop), drawn: items.every((i) => !!i.querySelector('svg')) } })
  check('the desk has, down its right side: Updates, the one-pager, Wallpapers, QuickTime, Photo Booth, Spotify, YouTube', desk.ids === A.DESK.map(([id]) => id).join(' ') && desk.says === A.DESK.map(([, says]) => says).join(' | '), desk.says)
  check('they are in one line on a 1440 by 900 screen, each with its icon, clear of the Dock', desk.oneLine && desk.clear && desk.drawn, JSON.stringify(desk))
  // (on a shorter screen they are closer together, still one line, so that a window has the room beside them;
  // and only on one too short for that do they go to a second line beside the first)
  const laid = () => p.evaluate(() => { const rects = [...document.querySelectorAll('.desk__item')].map((i) => i.getBoundingClientRect()); const dockTop = document.querySelector('.dock__shelf').getBoundingClientRect().top; return { lines: new Set(rects.map((r) => Math.round(r.left))).size, clear: rects.every((r) => r.bottom <= dockTop && r.left >= 0), firstRight: rects[0].left >= Math.max(...rects.map((r) => r.left)) - 1, pitch: Math.round(rects[1].top - rects[0].top), icon: Math.round(document.querySelector('.desk__icon').getBoundingClientRect().height), named: [...document.querySelectorAll('.desk__name')].every((n) => n.getBoundingClientRect().height >= 14) } })
  const tall = await laid()
  await p.setViewportSize({ width: 1280, height: 640 })
  await p.waitForTimeout(500)
  const short = await laid()
  check('on a short screen the icons are closer together and smaller, still in one line, each with its name, none under the Dock', tall.pitch === 99 && tall.icon === 64 && short.lines === 1 && short.pitch < 99 && short.pitch >= 64 && short.icon < 64 && short.named && short.clear, JSON.stringify({ tall, short }))
  await p.setViewportSize({ width: 1280, height: 520 })
  await p.waitForTimeout(500)
  const shortest = await laid()
  check('on the shortest screens they go to a second line beside the first, the first still at the right, none under the Dock', shortest.lines === 2 && shortest.clear && shortest.firstRight && shortest.pitch >= 64, JSON.stringify(shortest))
  await p.setViewportSize({ width: 1440, height: 900 })
  await p.waitForTimeout(500)

  // ---- QuickTime Player, under its own icon
  await openFromDesk(p, 'quicktime')
  const qt = (p) => p.evaluate(() => { const w = document.querySelector('.wf[data-app="quicktime"]'); const q = w.querySelector('.qt'); return { status: q.dataset.status, name: w.querySelector('.qt-name').textContent, lcd: w.querySelector('.qt-lcd').innerText.replace(/\s+/g, ' ').trim(), play: w.querySelector('.qt-b.play').getAttribute('aria-label'), big: !!w.querySelector('.qt-big'), over: w.querySelector('.qt-over')?.innerText.replace(/\s*\n\s*/g, ' / ') ?? null, list: [...w.querySelectorAll('.qt-list button')].map((b) => `${b.innerText.replace(/\s+/g, ' ').trim()}${b.getAttribute('aria-current') ? '*' : ''}`).join(' | '), lab: w.querySelector('.qt-well .lab')?.textContent ?? null, fits: q.scrollHeight <= q.clientHeight } })
  let q = await qt(p)
  check('its icon on the desk opens QuickTime Player: 748 across, in front, on its poster, the film’s name in its bar, and nothing written over the picture', (await sizeOf(p, 'quicktime')).startsWith('748x') && (await front(p)) === 'quicktime' && q.status === 'poster' && q.name === 'Film' && q.big && q.lab === null && q.fits, JSON.stringify(q))
  const qtIcon = await p.evaluate(() => ({ desk: document.querySelector('[data-desk="quicktime"] image')?.getAttribute('href'), mid: (() => { const b = document.querySelector('.qt-big').getBoundingClientRect(); const g = document.querySelector('.qt-big svg').getBoundingClientRect(); return Math.round(Math.abs(g.left + g.width / 2 - (b.left + b.width / 2)) + Math.abs(g.top + g.height / 2 - (b.top + b.height / 2))) })(), grips: document.querySelectorAll('.wf[data-app="quicktime"] [data-edge], .wf[data-app="quicktime"] .wf__edge, .wf[data-app="quicktime"] [class*="grip"]').length }))
  check('its icon is the one Dom supplied, and the large Play is in the middle of its ring', qtIcon.desk === '/icons/quicktime.webp' && qtIcon.mid <= 1, JSON.stringify(qtIcon))
  check('its window can be made larger', qtIcon.grips >= 4, JSON.stringify(qtIcon))
  check('its clock is at nothing of five minutes, and its list has the Film, picked, and the Study', q.lcd === '0:00 5:00' && q.list === 'Film 5:00* | Study 0:40' && q.play === 'Play', JSON.stringify(q))
  check('QuickTime Player is in the Dock while it is open, after the rule', new RegExp(`^${A.DOCK_IDS.join(' ')} \\| quicktime\\*$`).test(await dock(p)), await dock(p))
  await p.locator('.qt-big').click()
  await p.waitForTimeout(2300)
  q = await qt(p)
  check('Play: it plays, the clock runs, and the button is Pause', q.status === 'playing' && /^0:0[1-3] 5:00$/.test(q.lcd) && q.play === 'Pause' && !q.big && q.lab === null, JSON.stringify(q))
  await p.locator('.qt-b.play').click()
  await p.waitForTimeout(300)
  const held = (await qt(p)).lcd
  await p.waitForTimeout(1200)
  q = await qt(p)
  check('Pause: it stops where it is', q.status === 'paused' && q.lcd === held && q.play === 'Play', JSON.stringify(q))
  // to the end: the track is pressed at its far end
  const track = await p.evaluate(() => { const r = document.querySelector('.qt-track').getBoundingClientRect(); return { x: r.right - 1, y: r.top + r.height / 2 } })
  await p.mouse.click(track.x, track.y)
  await p.locator('.qt-b.play').click()
  await p.waitForTimeout(1800)
  q = await qt(p)
  check('at its end: Replay, and the next, which plays by itself after a count', q.status === 'ended' && /^Film \/ Replay \/ Next: Study, 0:40 \/ Study plays in [345] seconds\.$/.test(q.over ?? ''), String(q.over))
  await p.waitForTimeout(5600)
  q = await qt(p)
  check('…and then the Study is playing', q.name === 'Study' && q.status === 'playing' && q.list === 'Film 5:00 | Study 0:40*', JSON.stringify(q))
  // minimized, it stops
  await p.locator('.wf[data-app="quicktime"] button[aria-label^="Minimize"]').click().catch(() => {})
  await p.keyboard.press('Escape')
  await p.waitForTimeout(700)
  const wasMin = await p.evaluate(() => document.querySelector('.wf[data-app="quicktime"]').hasAttribute('data-min') || getComputedStyle(document.querySelector('.wf[data-app="quicktime"]')).visibility === 'hidden')
  if (!wasMin) await close(p, 'quicktime')
  await p.waitForTimeout(700)
  q = await qt(p)
  check('put away, it stops playing', q.status !== 'playing', JSON.stringify({ status: q.status, wasMin }))
  if (wasMin) { await p.locator('[data-dock-app="quicktime"]').click(); await p.waitForTimeout(600); await close(p, 'quicktime') }
  check('closed, it leaves the Dock', (await dock(p)) === A.DOCK_IDS.join(' '), await dock(p))

  // ---- Spotify: laid out as Spotify is (Dom's screenshots of it are the look)
  await openFromDesk(p, 'spotify')
  const S = '.wf[data-app="spotify"]'
  const sp = () =>
    p.evaluate((S) => {
      const w = document.querySelector(S)
      const dark = (el) => { const m = /rgba?\((\d+), (\d+), (\d+)/.exec(getComputedStyle(el).backgroundColor); return !!m && +m[1] < 40 && +m[2] < 40 && +m[3] < 40 }
      return {
        view: w.querySelector('.sp-main').getAttribute('aria-label'),
        lib: [...w.querySelectorAll('.sp-lib .sp-item')].map((b) => `${b.innerText.replace(/\s*\n\s*/g, '/')}${b.getAttribute('aria-current') ? '*' : ''}`),
        home: w.querySelector('.spbar__home').getAttribute('aria-current'),
        search: w.querySelector('.sp-search input').placeholder,
        back: w.querySelector('.spbar__nav button[aria-label="Back"]').getAttribute('aria-disabled'),
        tiles: w.querySelectorAll('.sp-tiles > li').length,
        sects: [...w.querySelectorAll('.sp-sect')].map((x) => x.innerText.replace(/\s*\n\s*/g, '/')).join(' | '),
        cards: w.querySelectorAll('.sp-card').length,
        rows: w.querySelectorAll('button.sp-row').length,
        on: [...w.querySelectorAll('button.sp-row')].findIndex((r) => r.classList.contains('on')),
        eq: !!w.querySelector('.sp-row.on .sp-eq'),
        hero: w.querySelector('.sp-hero')?.innerText.replace(/\s*\n\s*/g, ' / ') ?? null,
        stand: w.querySelector('.sp-stand')?.innerText.replace(/\s*\n\s*/g, ' / ') ?? null,
        tag: w.querySelector('.sp-main .sp-tag')?.textContent ?? null,
        now: w.querySelector('.sp-now').innerText.replace(/\s*\n\s*/g, ' / '),
        frames: w.querySelectorAll('iframe').length,
        panels: dark(w.querySelector('.sp-lib')) && dark(w.querySelector('.sp-main')) && dark(w.querySelector('.sp-now')),
      }
    }, S)
  let so = await sp()
  check('Spotify opens 1000 by 660 on Home: the way back and on, Home and one long search field along its head', (await sizeOf(p, 'spotify')) === '1000x660' && so.view === 'Home' && so.home === 'page' && so.search === 'What do you want to play?' && so.back === 'true', JSON.stringify(so))
  check('it is three dark panels: Your Library (the three lists of podcasts, then each playlist under the name Spotify gives it), the main pane, and the bar at the foot where what is playing is', so.panels && so.lib.length === 5 && /^Podcasts 1\/11 episodes/.test(so.lib[0]) && /^Podcasts 2\/10 episodes/.test(so.lib[1]) && /^Podcasts 3\/10 episodes/.test(so.lib[2]) && so.lib.slice(3).every((l) => /^Stand-in playlist \w{4}\/Playlist$/.test(l)), JSON.stringify(so.lib))
  check('Home has its tiles and its sections, one for each list of podcasts and one for the playlists, each with Show all; the first episode is set out in the bar at the foot under the title Spotify gives it (it does not say Nothing playing, nor Plays through Spotify), in Spotify’s own player', so.tiles === 6 && so.sects === 'Shrug’s network, on air/Podcasts 1/Show all | Shrug’s network, on air/Podcasts 2/Show all | Shrug’s network, on air/Podcasts 3/Show all | From the team/Playlists/Show all' && so.cards === 2 && /^Stand-in episode \w{4} \/ Podcast episode/.test(so.now) && !/Nothing playing|Plays through Spotify|no link/.test(so.now) && so.frames === 1, JSON.stringify(so))
  const embed = await p.evaluate((S) => document.querySelector(`${S} .sp-now iframe`)?.src ?? '', S)
  check('the player in the bar is Spotify’s embed of the first episode Dom supplied, by its link (with no "si" on it)', embed.startsWith('https://open.spotify.com/embed/episode/4HK2X8EhWMW9PuyEWdf90F') && !/[?&]si=/.test(embed), embed)
  // the chips over Your Library filter the library, one kind at a time
  await p.locator(`${S} .sp-lib .sp-chips button`, { hasText: 'Playlists' }).click()
  await p.waitForTimeout(250)
  let lib = await sp()
  check('the Playlists chip over Your Library leaves only the playlists there, and the main pane is as it was', lib.lib.length === 2 && lib.lib.every((l) => /\/Playlist$/.test(l)) && lib.view === 'Home', JSON.stringify(lib.lib))
  await p.locator(`${S} .sp-lib .sp-chips button.x`).click()
  await p.locator(`${S} .sp-lib .sp-chips button`, { hasText: 'Podcasts' }).click()
  await p.waitForTimeout(250)
  lib = await sp()
  check('the Podcasts chip leaves only the lists of podcasts; its x has everything back', lib.lib.length === 3 && lib.lib.every((l) => /^Podcasts \d\//.test(l)), JSON.stringify(lib.lib))
  await p.locator(`${S} .sp-lib .sp-chips button.x`).click()
  await p.waitForTimeout(250)
  await p.locator(`${S} .sp-home .sp-chips button`, { hasText: 'Playlists' }).click()
  await p.waitForTimeout(250)
  check('the chips over Home filter Home: Playlists shows the playlists alone', (await sp()).sects === 'From the team/Playlists/Show all' && (await sp()).lib.length === 5, (await sp()).sects)
  await p.locator(`${S} .sp-home .sp-chips button`, { hasText: 'All' }).click()
  await p.waitForTimeout(250)
  await p.locator(`${S} .sp-lib .sp-item`).first().click()
  await p.waitForTimeout(400)
  so = await sp()
  check('a list of podcasts, from the library: its page, its eleven episodes in a table, and the way back lit', so.view === 'Podcasts 1' && so.hero === 'Podcasts / Shrug’s network, on air / Podcasts 1 · 11 episodes' && so.rows === 11 && so.back === null && /\*$/.test(so.lib[0]), JSON.stringify(so))
  const table = await p.evaluate((S) => ({ head: [...document.querySelectorAll(`${S} .sp-row.head > span`)].map((x) => x.textContent.trim()).join('|'), row: document.querySelector(`${S} button.sp-row .t`).innerText.replace(/\s*\n\s*/g, ' / ') }), S)
  check('the table has a column only for what there is to say: each episode’s title, as Spotify gives it', table.head === '#||Title' && /^Stand-in episode \w{4} \/ Podcast episode$/.test(table.row), JSON.stringify(table))
  await p.locator(`${S} button.sp-row`).nth(2).click()
  await p.waitForTimeout(400)
  so = await sp()
  check('an episode picked is marked in the table and named in the bar at the foot, where Spotify’s player for it is', so.on === 2 && so.eq && /^Stand-in episode \w{4} \/ Podcast episode/.test(so.now) && so.frames === 1 && (await p.evaluate((S) => document.querySelector(`${S} .sp-now iframe`).src, S)).includes('/embed/episode/2IFu3Y5z2WfjZVieQc8a72'), JSON.stringify(so))
  await p.locator(`${S} .sp-lib .sp-item`).nth(4).click()
  await p.waitForTimeout(600)
  so = await sp()
  const listFrame = await p.evaluate((S) => document.querySelector(`${S} .sp-main iframe`)?.src ?? '', S)
  check('a playlist is the main pane’s: its page under the name Spotify gives it, with Spotify’s own player for it, which brings its tracks', /^Public Playlist \/ Stand-in playlist \w{4}$/.test(so.hero ?? '') && listFrame.includes('/embed/playlist/2UDAoEBddY0XvO9oXcI87S') && so.tag === 'Previews, unless you’re signed in to Spotify' && /\*$/.test(so.lib[4]), JSON.stringify({ hero: so.hero, listFrame, tag: so.tag }))
  await p.locator(`${S} .spbar__nav button[aria-label="Back"]`).click()
  await p.waitForTimeout(300)
  check('Back goes to where it was: the list of podcasts', (await sp()).view === 'Podcasts 1', (await sp()).view)
  await p.locator(`${S} .sp-search input`).fill('zzzz')
  await p.waitForTimeout(300)
  const nothing = await p.locator(`${S} .sp-none`).first().innerText()
  check('the search field searches the room, and says when nothing in it is called that', (await sp()).rows === 0 && nothing === 'Nothing in the room is called that.', nothing)
  await close(p, 'spotify')

  // ---- YouTube: its watch page
  await openFromDesk(p, 'youtube')
  const Y = '.wf[data-app="youtube"]'
  const yt = () =>
    p.evaluate((Y) => {
      const w = document.querySelector(Y)
      const r = w.querySelector('.yt-player').getBoundingClientRect()
      return {
        mark: w.querySelector('.ytbar__mark svg')?.getAttribute('aria-label'),
        word: (w.querySelector('.ytbar__mark svg')?.querySelectorAll('path').length ?? 0) === 3 && !w.querySelector('.ytbar__mark b'),
        search: w.querySelector('.yt-search input').getAttribute('aria-label'),
        menu: !!w.querySelector('.ytbar__menu'),
        field: w.querySelector('.yt-search input').placeholder,
        items: w.querySelectorAll('.yt-item').length,
        on: [...w.querySelectorAll('.yt-item')].findIndex((i) => i.classList.contains('on')),
        head: w.querySelector('.yt-list header')?.innerText.replace(/\s*\n\s*/g, ' / ') ?? null,
        h1: w.querySelector('.yt-col h1')?.textContent,
        under: w.querySelector('.yt-under').innerText.replace(/\s*\n\s*/g, ' / '),
        why: w.querySelector('.yt-why')?.innerText.replace(/\s*\n\s*/g, ' / ') ?? null,
        stills: [...w.querySelectorAll('.yt-item .yt-th img')].slice(0, 2).map((i) => i.getAttribute('src')).join(' '),
        start: w.querySelector('.yt-start img')?.getAttribute('src') ?? null,
        frames: w.querySelectorAll('iframe').length,
        ratio: Math.round((r.width / r.height) * 100) / 100,
        radius: getComputedStyle(w.querySelector('.yt-player')).borderRadius,
        still: !!w.querySelector('.yt-item .yt-th'),
      }
    }, Y)
  let yo = await yt()
  check('YouTube opens 1100 by 664 as its watch page: YouTube’s own logo (its mark and its word, drawn) and one field along the head, with no menu button, the rounded player sixteen by nine, and the list of twenty-two at the right, the first picked', (await sizeOf(p, 'youtube')) === '1100x664' && yo.mark === 'YouTube' && yo.word && !yo.menu && yo.field === 'Search this playlist' && yo.search === 'Search Videos the team loves' && yo.items === 22 && yo.on === 0 && yo.head === 'Videos the team loves / Shrug · 1 / 22' && yo.ratio === 1.78 && yo.radius === '12px' && yo.still, JSON.stringify(yo))
  check('under the player: the video’s place in the list; each video is its own still from YouTube, by its id; no player is fetched until one is played, and nothing is said of why it is here until someone has written it', yo.h1 === 'Video 1' && /· 1 \/ 22/.test(yo.under) && yo.why === null && yo.frames === 0 && yo.start === 'https://i.ytimg.com/vi/MnrJzXM7a6o/hqdefault.jpg' && yo.stills === 'https://i.ytimg.com/vi/MnrJzXM7a6o/mqdefault.jpg https://i.ytimg.com/vi/yU3GUHDf0mk/mqdefault.jpg', JSON.stringify({ h1: yo.h1, under: yo.under, why: yo.why, start: yo.start, stills: yo.stills }))
  await p.locator(`${Y} .yt-item`).nth(3).click()
  await p.waitForTimeout(300)
  yo = await yt()
  check('a video picked in the list is the one shown, in YouTube’s own player', yo.on === 3 && yo.head === 'Videos the team loves / Shrug · 4 / 22' && yo.frames === 1 && (await p.evaluate((Y) => document.querySelector(`${Y} .yt-player iframe`).src, Y)).startsWith('https://www.youtube-nocookie.com/embed/oXsQ4NMQ6B8?'), JSON.stringify({ on: yo.on, head: yo.head, frames: yo.frames }))
  // the player says what it is playing: from then on the window calls the video by its title, and says whose it is
  await p.evaluate((Y) => { const f = document.querySelector(`${Y} .yt-player iframe`); window.dispatchEvent(new MessageEvent('message', { origin: 'https://www.youtube-nocookie.com', source: f.contentWindow, data: JSON.stringify({ event: 'infoDelivery', info: { videoData: { video_id: 'oXsQ4NMQ6B8', title: 'A stand-in title', author: 'A stand-in channel' } } }) })) }, Y)
  await p.waitForTimeout(300)
  yo = await yt()
  const named = await p.evaluate((Y) => document.querySelectorAll(`${Y} .yt-item`)[3].querySelector('.w').innerText.replace(/\s*\n\s*/g, ' / '), Y)
  check('once YouTube’s player says what it is playing, the window calls the video by its title and channel, under the player and in the list', yo.h1 === 'A stand-in title' && /^A \/ A stand-in channel/.test(yo.under) && named === 'A stand-in title / A stand-in channel', JSON.stringify({ h1: yo.h1, under: yo.under, named }))
  await p.locator(`${Y} .yt-search input`).fill('zzzz')
  await p.waitForTimeout(300)
  check('the field searches this playlist, as it says, and says when nothing in it is called that', (await p.locator(`${Y} .yt-item`).count()) === 0 && (await p.locator(`${Y} .yt-none`).innerText()) === 'Nothing in the list is called that.', '')
  await p.locator(`${Y} .yt-search button[aria-label="Clear"]`).click()
  await p.waitForTimeout(200)
  await p.locator(`${Y} .yt-pill`, { hasText: 'Theater mode' }).click()
  await p.waitForTimeout(300)
  const theater = await p.evaluate((Y) => { const w = document.querySelector(Y); return { list: !!w.querySelector('.yt-list'), says: [...w.querySelectorAll('.yt-pill')].map((b) => b.textContent.trim()).find((x) => /view|mode/i.test(x)), wide: Math.round(w.querySelector('.yt-player').getBoundingClientRect().width) } }, Y)
  check('Theater mode puts the list away and gives the player the window’s width', !theater.list && theater.says === 'Default view' && theater.wide > 900, JSON.stringify(theater))
  await p.locator(`${Y} .yt-col`).focus()
  await p.keyboard.press('t')
  await p.waitForTimeout(300)
  check('T, as on YouTube, brings the list back', (await p.locator(`${Y} .yt-list`).count()) === 1)
  await close(p, 'youtube')

  // ---- Wallpapers: Photographs
  await openFromDesk(p, 'wallpapers')
  const wp = await p.evaluate(() => { const w = document.querySelector('.wf[data-app="wallpapers"]'); return { heads: [...w.querySelectorAll('.walls__head')].map((h) => h.textContent.replace(/\s+/g, ' ').trim()).join(' | '), ways: w.querySelectorAll('.walls-tile').length, photos: w.querySelectorAll('.walls-photo').length, across: (() => { const tiles = [...w.querySelectorAll('.walls-photo')].slice(0, 5).map((t) => Math.round(t.getBoundingClientRect().top)); return tiles.filter((y) => y === tiles[0]).length })() } })
  check('Wallpapers has two sections: the five colorways, and Photographs, twenty by the team, four across', wp.heads === 'Colorways 5 | Photographs 20, by the team' && wp.ways === 5 && wp.photos === 20 && wp.across === 4, JSON.stringify(wp))
  await p.locator('.wf[data-app="wallpapers"] .walls-photo').nth(2).click()
  await p.waitForTimeout(500)
  const big = await p.evaluate(() => { const w = document.querySelector('.wf[data-app="wallpapers"] .walls-room'); return { name: w?.getAttribute('aria-label'), title: w?.querySelector('.vip-look__title')?.innerText.replace(/\s*\n\s*/g, ' / '), foot: w?.querySelector('.walls-foot')?.innerText.replace(/\s*\n\s*/g, ' / '), off: [...(w?.querySelectorAll('.walls-foot .walls-act') ?? [])].map((b) => `${b.textContent.trim()}:${b.getAttribute('aria-disabled')}`).join(' ') } })
  check('a photograph opens large: which of the twenty it is, its title and who took it, Download and Set as Wallpaper', big.title === 'Photographs / 3 of 20' && /^\[Photograph 03\] \/ By \[Name\], \[Place, Year\] \/ Download \/ Set as Wallpaper$/.test(big.foot ?? ''), JSON.stringify(big))
  check('one that has not been supplied has nothing to hand over yet: both are off', big.off === 'Download:true Set as Wallpaper:true', big.off)
  await p.keyboard.press('Escape')
  await p.waitForTimeout(300)
  await close(p, 'wallpapers')

  // ---- a message to Shrug, in Messages
  await p.click('.dock [data-dock-app="messages"]')
  await p.waitForSelector('.wf[data-app="messages"][data-open] .im-pencil', { timeout: 15000 })
  await p.waitForTimeout(500)
  await p.locator('.im-pencil').click()
  await p.waitForTimeout(400)
  const M = '.wf[data-app="messages"]'
  const pickS = await p.evaluate((M) => { const w = document.querySelector(M); return { to: w.querySelector('.im-to')?.innerText.replace(/\s+/g, ' '), head: w.querySelector('.im-pick h2')?.textContent, opts: [...w.querySelectorAll('.im-opt b')].map((b) => b.textContent).join(' | '), field: w.querySelector('.im-field textarea').placeholder, off: w.querySelector('.im-field textarea').disabled, row: w.querySelector('.conv-write .conv')?.innerText.replace(/\s*\n\s*/g, ' / '), picked: w.querySelectorAll('.conv-write .conv[aria-current]').length, pencil: w.querySelector('.im-pencil').getAttribute('aria-pressed'), pencilIn: !!w.querySelector('.ss-window__main .im-pencil') && !w.querySelector('.ss-window__side .im-pencil'), x: w.querySelector('.conv-write__x')?.getAttribute('aria-label'), plus: w.querySelectorAll('.im-field .plus').length, side: (() => { const a = w.querySelector('.ss-window__side').getBoundingClientRect(); const o = w.getBoundingClientRect(); return [Math.round(a.left - o.left), Math.round(a.top - o.top), Math.round(o.bottom - a.bottom)].join(',') })(), level: (() => { const n = w.querySelector('.conv-write .conv .ss-row__lead').getBoundingClientRect(); const c = w.querySelector('.conv-list .conv .ss-row__lead').getBoundingClientRect(); return `${Math.round(n.left - c.left)},${Math.round(n.width - c.width)}` })() } }, M)
  check('Messages is two panes side by side: the list’s pane runs to the window’s own edges, with nothing floating', pickS.side === '0,0,0', pickS.side)
  check('the pencil, at the head of the conversation’s pane, starts a message whose only recipient is Shrug: New Message is a row at the head of the list as the others are (the same face, in line with theirs), with an x to put it away', pickS.to === 'To: Shrug' && pickS.pencilIn && pickS.row === 'New Message' && pickS.picked === 1 && pickS.pencil === 'true' && pickS.level === '0,0' && pickS.x === 'Discard the new message', JSON.stringify(pickS))
  check('a subject can be picked, of three, or it is simply typed: the field is open, and there is no plus until a message is begun', pickS.head === 'What’s this about?' && pickS.opts === 'Add a testimonial | Request an intro | Request a meeting' && pickS.field === 'Pick a subject to chat, or start typing' && !pickS.off && pickS.plus === 0, JSON.stringify(pickS))
  await p.locator(`${M} .im-field textarea`).fill('Hello Shrug.')
  await p.waitForTimeout(200)
  const typing = await p.evaluate((M) => ({ plus: document.querySelectorAll(`${M} .im-field .plus`).length, send: document.querySelector(`${M} .im-field .send`)?.getAttribute('aria-disabled') ?? 'ready' }), M)
  check('typing begins a message: the plus and Send are there, and it can be sent as it is', typing.plus === 1 && typing.send === 'ready', JSON.stringify(typing))
  await p.locator(`${M} .im-field textarea`).fill('')
  await p.locator(`${M} .im-opt`).nth(1).click()
  await p.waitForTimeout(300)
  const intro = await p.evaluate((M) => { const w = document.querySelector(M); return { head: w.querySelector('.im-form header b').textContent, labels: [...w.querySelectorAll('.im-form .im-lbl > span')].map((s) => s.textContent).join(' | '), small: w.querySelector('.im-form small').textContent, ask: w.querySelector('.im-field textarea').placeholder, send: w.querySelector('.im-field .send')?.getAttribute('aria-disabled') } }, M)
  check('Request an intro asks for a name and who, and to say why in the message', intro.head === 'Request an intro' && intro.labels === 'Your name | Who do you want to meet?' && intro.small === 'Tell us why you want the intro in your message.' && intro.ask === 'Why you’d like to meet them' && intro.send === 'true', JSON.stringify(intro))
  await p.locator(`${M} .im-link`).click()
  await p.locator(`${M} .im-opt`).nth(2).click()
  await p.waitForTimeout(300)
  const meet = await p.evaluate((M) => { const w = document.querySelector(M); return { head: w.querySelector('.im-form header b').textContent, labels: [...w.querySelectorAll('.im-form .im-lbl > span, .im-form .im-lbl__text')].map((s) => s.textContent).join(' | '), small: w.querySelector('.im-form small').textContent, add: w.querySelector('.im-file--add').textContent.trim() } }, M)
  check('Change subject goes back; Request a meeting asks for a name, an email and files, ten of 25 MB each', meet.head === 'Request a meeting' && meet.labels === 'Your name | Email | Files, such as a deck' && meet.small === 'Up to ten files, 25 MB each.' && meet.add === 'Add files', JSON.stringify(meet))
  await p.locator(`${M} .im-form input[type=file], ${M} .im-field input[type=file]`).first().setInputFiles({ name: 'Deck.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(4200, 1) })
  await p.locator(`${M} .im-lbl input`).first().fill('Riley Chen')
  await p.locator(`${M} .im-lbl input[type=email]`).fill('riley@example.test')
  await p.locator(`${M} .im-field textarea`).fill('We are building a thing.')
  await p.keyboard.press('Enter')
  await p.waitForTimeout(350)
  const sending = await p.evaluate((M) => document.querySelector(`${M} .im-stat`)?.textContent.trim(), M)
  await p.waitForTimeout(1500)
  const gone = await p.evaluate((M) => { const w = document.querySelector(M); return { sub: w.querySelector('.im-sub')?.textContent, me: w.querySelector('.im-me')?.textContent, att: w.querySelector('.im-att')?.innerText.replace(/\s*\n\s*/g, ' / '), stat: w.querySelector('.im-stat')?.innerText.replace(/\s+/g, ' ').trim(), again: !!w.querySelector('.im-stat.bad button'), row: w.querySelector('.conv-write .conv')?.innerText.replace(/\s*\n\s*/g, ' / '), note: w.querySelectorAll('.im-note').length } }, M)
  check('sent, it is in the conversation under its subject, with its file, and says Sending… while it goes', sending === 'Sending…' && gone.sub === 'Request a meeting' && gone.me === 'We are building a thing.' && /^Deck\.pdf \/ 4 KB$/.test(gone.att ?? ''), JSON.stringify({ sending, gone }))
  check('delivery is honest: with no inbox to take it yet it says Not Delivered, with Try Again, and never Delivered', /^! Not Delivered · Try Again$/.test(gone.stat ?? '') && gone.again && gone.row === 'Shrug / Not Delivered' && gone.note === 0, JSON.stringify(gone))
  // another conversation is a press away, and the message to Shrug is kept
  await p.locator(`${M} .conv-list .conv`).first().click()
  await p.waitForTimeout(500)
  const away = await p.evaluate((M) => ({ write: document.querySelectorAll(`${M} .chat-write`).length, row: !!document.querySelector(`${M} .conv-write .conv`), pencil: document.querySelector(`${M} .im-pencil`).getAttribute('aria-pressed') }), M)
  check('a conversation picked from the list is shown in its place; the message to Shrug stays at the head of the list', away.write === 0 && away.row && away.pencil === 'false', JSON.stringify(away))
  check('nothing went wrong on the way', A.realErrors(t.errors).length === 0, A.realErrors(t.errors).join(' | '))
  await t.ctx.close()
  await browser.close()

  // ---- Photo Booth, with a camera that the browser makes up (and says yes to) for the purpose
  const booth = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] })
  t = await A.open(booth, { device: 'desktop', base: BASE, query: 'still&empty' })
  p = t.page
  await p.waitForTimeout(1600)
  await openFromDesk(p, 'photobooth')
  const pb = (p) =>
    p.evaluate(() => {
      const w = document.querySelector('.wf[data-app="photobooth"]')
      const b = w.querySelector('.pb')
      return {
        stage: b.dataset.stage,
        msg: w.querySelector('.pb-msg')?.innerText.replace(/\s*\n\s*/g, ' / ') ?? null,
        shutter: w.querySelector('.pb-shutter')?.getAttribute('aria-label') ?? null,
        ctl: [...w.querySelectorAll('.pb-ctl button')].map((x) => (x.getAttribute('aria-label') ?? x.textContent.trim()) + (x.getAttribute('aria-pressed') === 'true' ? '*' : '') + (x.disabled || x.getAttribute('aria-disabled') === 'true' ? ' (off)' : '')).join(' | '),
        strip: w.querySelector('.pb-strip')?.innerText.replace(/\s*\n\s*/g, ' / ') ?? null,
        wall: w.querySelectorAll('.pb-th').length,
        toast: w.querySelector('.pb-toast')?.textContent ?? null,
        order: [...b.children].map((c) => c.className.split(' ')[0]).join(' '),
        cam: !!w.querySelector('video.pb-cam'),
      }
    })
  const logIn = async (p) => {
    await p.locator('.account input[type=email]').fill('riley@example.test')
    await p.keyboard.press('Enter'); await p.waitForTimeout(900)
    await p.keyboard.type('4155550134'); await p.keyboard.press('Enter'); await p.waitForTimeout(900)
    await p.keyboard.type('246810'); await p.waitForTimeout(1500)
    await p.keyboard.type('Riley Chen'); await p.locator('.account__go').click(); await p.waitForTimeout(1800)
  }
  let b = await pb(p)
  check('Photo Booth opens 780 by 660, and is for someone logged in: a visitor is shown the door, and the camera is not asked for', (await sizeOf(p, 'photobooth')) === '780x660' && b.stage === 'door' && b.msg === 'Log in to use Photo Booth / Log In' && !b.cam && b.shutter === 'Take photo, unavailable', JSON.stringify(b))
  check('it is laid out as the Mac’s: the picture, the strip under it, and one bar with the view’s switch, the shutter and Effects', b.order === 'pb-view pb-strip pb-ctl' && /^Four to a sheet \| One photo\* \| A film: not in this booth \(off\) \| Take photo, unavailable \(off\)/.test(b.ctl), JSON.stringify({ order: b.order, ctl: b.ctl }))
  check('with nothing posted yet the wall says so', b.strip === 'No photos yet. Take one and be first on the wall.' && b.wall === 0, String(b.strip))
  await p.locator('.pb-msg .pb-btn').click()
  await p.waitForTimeout(500)
  const door = await p.evaluate(() => ({ head: document.querySelector('.account__head')?.textContent, lead: document.querySelector('.account__lead')?.textContent }))
  check('its Log In lets down the desk’s sheet, which says what for', door.head === 'Log in to use Photo Booth' && door.lead === 'Log in or sign up to get started.', JSON.stringify(door))
  await logIn(p)
  b = await pb(p)
  check('logged in, it asks for the camera, saying what happens next and that nothing is saved or posted', b.stage === 'ask' && b.msg === 'Photo Booth would like to use your camera / Your browser will ask next. Nothing is saved or posted until you choose to. / Allow Camera', JSON.stringify(b))
  await p.locator('.pb-msg .pb-btn').click()
  await p.waitForSelector('.pb[data-stage="live"] video.pb-cam', { timeout: 15000 })
  await p.waitForTimeout(800)
  b = await pb(p)
  const mirror = await p.evaluate(() => getComputedStyle(document.querySelector('.pb-cam')).transform)
  check('allowed, the camera is live, shown as a mirror shows it, with the shutter and Effects', b.stage === 'live' && /\| Take photo \| Effects$/.test(b.ctl) && /^matrix\(-1, 0, 0, 1/.test(mirror), JSON.stringify({ b, mirror }))
  await p.locator('.pb-ctl .pb-btn', { hasText: 'Effects' }).click()
  await p.waitForTimeout(500)
  const fx = await p.evaluate(() => { const g = document.querySelector('.pb-fx'); return { names: [...g.querySelectorAll('small')].map((s) => s.textContent).join(' '), on: g.querySelector('.on small')?.textContent, role: g.getAttribute('role'), live: g.querySelectorAll('video').length } })
  check('Effects is nine, each the camera seen through it, Normal in the middle and picked', fx.names === 'Mono Sepia Cool Pop Normal Negative Warm Faded Night' && fx.on === 'Normal' && fx.role === 'radiogroup' && fx.live === 9, JSON.stringify(fx))
  await p.locator('.pb-fx button', { hasText: 'Sepia' }).click()
  await p.waitForSelector('.pb[data-stage="live"] video.pb-cam', { timeout: 8000 })
  check('one picked is what the camera is seen through', /sepia/.test(await p.evaluate(() => document.querySelector('.pb-cam').style.filter)))
  await p.locator('.pb-shutter').click()
  await p.waitForTimeout(400)
  const counting = await p.evaluate(() => ({ mid: (() => { const b = document.querySelector('.pb-ctl--count .pb-shutter').getBoundingClientRect(); const g = document.querySelector('.pb-ctl--count .pb-shutter svg').getBoundingClientRect(); return Math.round(Math.abs(g.left + g.width / 2 - (b.left + b.width / 2)) + Math.abs(g.top + g.height / 2 - (b.top + b.height / 2))) })(), stage: document.querySelector('.pb').dataset.stage, n: document.querySelector('.pb-count')?.innerText.replace(/\s+/g, ' '), on: document.querySelector('.pb-count b.on')?.textContent, shutter: document.querySelector('.pb-shutter')?.getAttribute('aria-label'), bar: getComputedStyle(document.querySelector('.pb-ctl')).backgroundColor }))
  const red = /rgb\((\d+), (\d+), (\d+)\)/.exec(counting.bar)
  check('the shutter counts down from three: the bar turns red and counts, and the camera in it (in the middle of its ring) cancels', counting.stage === 'count' && counting.n === '3 2 1' && counting.on === '3' && counting.shutter === 'Cancel' && counting.mid <= 1 && !!red && +red[1] > 180 && +red[2] < 110 && +red[3] < 110, JSON.stringify(counting))
  await p.waitForSelector('.pb[data-stage="review"] img.pb-photo', { timeout: 10000 })
  await p.waitForTimeout(500)
  b = await pb(p)
  const shot = await p.evaluate(() => { const img = document.querySelector('.pb-photo'); return { jpeg: img.src.startsWith('data:image/jpeg'), w: img.naturalWidth } })
  check('then the photo, to look at: Retake, Post to the Wall, and Share (not Save)', b.stage === 'review' && b.ctl === 'Retake | Post to the Wall | Share this photo' && shot.jpeg && shot.w > 300, JSON.stringify({ b, shot }))
  // Share hands the photo on: to the system's own share sheet where there is one (stood in for here, since a
  // browser with no screen has none to show), and otherwise to the clipboard, or failing both to a file
  await p.evaluate(() => { window.__shared = null; navigator.canShare = () => true; navigator.share = async (data) => { window.__shared = { name: data.files?.[0]?.name, type: data.files?.[0]?.type, size: data.files?.[0]?.size } } })
  await p.locator('.pb-ctl .pb-share').click()
  await p.waitForTimeout(900)
  const handed = await p.evaluate(() => window.__shared)
  check('Share hands the photo itself to the system’s share sheet, as a picture file', !!handed && /^Photo Booth \d{4}-\d\d-\d\d\.jpg$/.test(handed.name ?? '') && handed.type === 'image/jpeg' && handed.size > 5000, JSON.stringify(handed))
  await p.evaluate(() => { navigator.canShare = undefined; navigator.clipboard.write = () => Promise.reject(new Error('no clipboard')) })
  const [saved] = await Promise.all([p.waitForEvent('download', { timeout: 8000 }).catch(() => null), p.locator('.pb-ctl .pb-share').click()])
  await p.waitForTimeout(300)
  const said = await p.evaluate(() => document.querySelector('.pb-toast')?.textContent ?? null)
  check('with no share sheet and no clipboard to take it, it is a file to keep, and the booth says so', !!saved && /^Photo Booth \d{4}-\d\d-\d\d\.jpg$/.test(saved.suggestedFilename()) && said === 'Saved to your downloads.', JSON.stringify({ file: saved?.suggestedFilename(), said }))
  await p.locator('.pb-btn--post').click()
  await p.waitForTimeout(1200)
  b = await pb(p)
  const first = await p.evaluate(() => { const th = document.querySelector('.pb-th'); return { name: th?.querySelector('small')?.textContent.trim(), fresh: th?.classList.contains('new'), waiting: th?.classList.contains('waiting'), tag: th?.querySelector('.pb-th__wait')?.textContent.trim(), says: th?.querySelector('button')?.getAttribute('aria-label') } })
  check('Post to the Wall sends it for approval: it is in the strip for its taker, marked Waiting, and the booth says what happens next', b.wall === 1 && /Riley Chen$/.test(first.name ?? '') && first.fresh && first.waiting && first.tag === 'Waiting' && b.toast === 'Sent. It goes on the wall once Shrug has approved it.' && /^A photo by Riley Chen, \d{1,2} \w+ \d{4}, waiting for approval$/.test(first.says ?? ''), JSON.stringify({ b, first }))
  await p.locator('.pb-th button').first().click()
  await p.waitForTimeout(500)
  b = await pb(p)
  const meta = await p.evaluate(() => document.querySelector('.pb-meta')?.innerText.replace(/\s*\n\s*/g, ' / '))
  const bar = await p.evaluate(() => { const ctl = document.querySelector('.pb-ctl').getBoundingClientRect(); const cam = document.querySelector('.pb-shutter.back').getBoundingClientRect(); const share = document.querySelector('.pb-ctl .pb-share').getBoundingClientRect(); return { camMid: Math.round(Math.abs(cam.left + cam.width / 2 - (ctl.left + ctl.width / 2))), shareRight: Math.round(ctl.right - share.right), x: document.querySelector('.pb-th.on .pb-th__x')?.getAttribute('aria-label') } })
  check('a photo opens large, with who took it and when, and that it is waiting; the camera’s button is in the middle of the bar, Share at its right (no Save), and its own taker has an x on it in the strip', b.stage === 'large' && /Riley Chen \/ \d{1,2} \w+ \d{4} \/ Waiting for approval$/.test(meta ?? '') && b.ctl === 'Approve (demo) | Back to the camera | Share this photo' && bar.camMid <= 1 && bar.shareRight <= 24 && bar.x === 'Remove this photo', JSON.stringify({ b, meta, bar }))
  await p.locator('.pb-ctl .pb-btn', { hasText: 'Approve (demo)' }).click()
  await p.waitForTimeout(400)
  b = await pb(p)
  check('approved (the demo’s stand-in for Shrug), it is on the wall and no longer waiting', b.ctl === 'Back to the camera | Share this photo' && !(await p.evaluate(() => document.querySelector('.pb-th').classList.contains('waiting'))) && (await p.evaluate(() => document.querySelector('.pb-th.on .pb-th__x')?.getAttribute('aria-label'))) === 'Remove this photo from the wall', JSON.stringify(b))
  await p.locator('.pb-shutter.back').click()
  await p.waitForTimeout(500)
  check('the camera’s button goes back to the camera', (await pb(p)).stage === 'live', (await pb(p)).stage)
  await p.locator('.pb-th button').first().click()
  await p.waitForTimeout(400)
  await p.locator('.pb-th__x').click()
  await p.waitForTimeout(600)
  b = await pb(p)
  check('the x takes it off the wall', b.wall === 0 && b.toast === 'Removed from the wall.', JSON.stringify(b))
  // four to a sheet
  if (b.stage !== 'live') { await p.locator('.pb-shutter.back').click().catch(() => {}); await p.waitForTimeout(600) }
  await p.locator('.pb-seg button').first().click()
  await p.waitForTimeout(300)
  b = await pb(p)
  check('the switch at the left of the bar is one photo or four to a sheet; a film is not taken here, and says so', /^Four to a sheet\* \| One photo \| A film: not in this booth \(off\) \| Take four photos \| Effects$/.test(b.ctl), b.ctl)
  await p.locator('.pb-shutter').click()
  await p.waitForSelector('.pb[data-stage="review"] img.pb-photo', { timeout: 30000 })
  await p.waitForTimeout(400)
  const four = await p.evaluate(() => { const img = document.querySelector('.pb-photo'); return { w: img.naturalWidth, h: img.naturalHeight } })
  check('four are taken, one after another, and set on one sheet', four.w > 300 && four.h > 300, JSON.stringify(four))
  // (this one is posted and approved, so that there is something on the wall for a visitor to look at)
  await p.locator('.pb-btn--post').click(); await p.waitForTimeout(1000)
  await p.locator('.pb-th button').first().click(); await p.waitForTimeout(400)
  await p.locator('.pb-ctl .pb-btn', { hasText: 'Approve (demo)' }).click(); await p.waitForTimeout(300)
  // logging out puts the camera away: it is a member's
  await p.locator('.menubar__login').click()
  await p.locator('.account__row', { hasText: 'Log Out' }).click()
  await p.waitForTimeout(1000)
  b = await pb(p)
  check('logged out, Photo Booth is the door again and the camera is put away', b.stage === 'door' && !b.cam, JSON.stringify(b))
  await p.locator('.pb-th button').first().click(); await p.waitForTimeout(400)
  const looking = await pb(p)
  await p.locator('.pb-shutter.back').click(); await p.waitForTimeout(400)
  b = await pb(p)
  check('a visitor can look at the wall, and the camera’s button there leads back to the door, not to the camera', looking.stage === 'large' && b.stage === 'door' && !b.cam, JSON.stringify({ looking: looking.stage, then: b.stage }))
  check('nothing went wrong on the way (Photo Booth)', A.realErrors(t.errors).length === 0, A.realErrors(t.errors).join(' | '))
  await t.ctx.close()
  await booth.close()

  // without a camera to give, it says the camera is off, and the wall still works
  const none = await chromium.launch()
  t = await A.open(none, { device: 'desktop', base: BASE, query: 'still&empty' })
  p = t.page
  await p.waitForTimeout(1600)
  await openFromDesk(p, 'photobooth')
  await p.locator('.pb-msg .pb-btn').click()
  await p.waitForTimeout(400)
  await logIn(p)
  await p.locator('.pb-msg .pb-btn').click()
  await p.waitForSelector('.pb[data-stage="refused"]', { timeout: 15000 })
  b = await pb(p)
  check('refused the camera, it says the camera is off and how to turn it on, with Try Again', b.msg === 'The camera is off / Turn it on for this site in your browser’s settings, then try again. The wall below still works without it. / Try Again', String(b.msg))
  await t.ctx.close()
  await none.close()

  console.log(failed ? `${failed} FAILED` : 'all ok')
  process.exit(failed ? 1 : 0)
})().catch((e) => {
  console.error('FAILED', e.message.split('\n').slice(0, 10).join('\n'))
  process.exit(1)
})
