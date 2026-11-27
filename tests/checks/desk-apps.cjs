// The apps out on the desk, and what else step 5 of design/v1 added: the Film, which QuickTime Player opens;
// Photo Booth; Spotify; YouTube; the Photographs in Wallpapers; a message to Shrug, in Messages; and Weather.
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
  check('the desk has, down its right side: Updates, Accredited Investors Only, Investor Portal, Portfolio, the one-pager, Wallpapers, QuickTime, Photo Booth, Spotify, YouTube', desk.ids === A.DESK.map(([id]) => id).join(' ') && desk.says === A.DESK.map(([, says]) => says).join(' | '), desk.says)
  // (27 Nov: nothing on the desk is ever drawn smaller, or brought closer together. There are ten of them now,
  // which is two lines on a screen 900 tall: five and five, beside one another, the first still at the right.
  // On a screen too short for that they are in as many lines as it takes, as even as can be made)
  const laid = () => p.evaluate(() => { const rects = [...document.querySelectorAll('.desk__item')].map((i) => i.getBoundingClientRect()); const dockTop = document.querySelector('.dock__shelf').getBoundingClientRect().top; const lefts = [...new Set(rects.map((r) => Math.round(r.left)))]; return { lines: lefts.length, each: lefts.map((l) => rects.filter((r) => Math.round(r.left) === l).length).join('+'), clear: rects.every((r) => r.bottom <= dockTop && r.left >= 0), firstRight: rects[0].left >= Math.max(...rects.map((r) => r.left)) - 1, pitch: Math.round(rects[1].top - rects[0].top), icon: Math.round(document.querySelector('.desk__icon').getBoundingClientRect().height), named: [...document.querySelectorAll('.desk__name')].every((n) => n.getBoundingClientRect().height >= 14) } })
  const tall = await laid()
  check('they are in two even lines on a 1440 by 900 screen, five and five, each with its icon, clear of the Dock', desk.clear && desk.drawn && tall.lines === 2 && tall.each === '5+5' && tall.firstRight && tall.pitch === 96 && tall.icon === 61, JSON.stringify({ desk, tall }))
  await p.setViewportSize({ width: 1440, height: 1200 })
  await p.waitForTimeout(500)
  const single = await laid()
  check('on a screen tall enough for all ten they are one line', single.lines === 1 && single.each === '10' && single.pitch === 96 && single.icon === 61 && single.named && single.clear, JSON.stringify(single))
  await p.setViewportSize({ width: 1280, height: 640 })
  await p.waitForTimeout(500)
  const short = await laid()
  check('on a short screen the icons are the size and as far apart as they always are, in two even lines beside one another, the first still at the right, each with its name, none under the Dock', short.lines === 2 && short.each === '5+5' && short.pitch === 96 && short.icon === 61 && short.firstRight && short.named && short.clear, JSON.stringify({ short }))
  await p.setViewportSize({ width: 1280, height: 520 })
  await p.waitForTimeout(500)
  const shortest = await laid()
  check('and on the shortest they are still that size, in as many lines as it takes and as even as can be made (three, three, two and two), none under the Dock', shortest.lines === 4 && shortest.each === '3+3+2+2' && shortest.clear && shortest.firstRight && shortest.pitch === 96 && shortest.icon === 61, JSON.stringify(shortest))
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
      const lines = (el) => el?.innerText.replace(/\s*\n\s*/g, ' / ') ?? null
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
        hero: lines(w.querySelector('.sp-hero')),
        said: w.querySelector('.sp-main').innerText,
        what: lines(w.querySelector('.sp-what')),
        keys: [...w.querySelectorAll('.sp-keys button')].map((b) => b.getAttribute('aria-label')).join(', '),
        line: lines(w.querySelector('.sp-line')),
        side: !w.querySelector('.sp-side').hasAttribute('data-shut'),
        about: lines(w.querySelector('.sp-about')),
        players: [...w.querySelectorAll('.sp-side iframe')].map((f) => f.src),
        inFoot: w.querySelectorAll('.sp-now iframe').length,
        panels: dark(w.querySelector('.sp-lib')) && dark(w.querySelector('.sp-main')) && dark(w.querySelector('.sp-side')) && dark(w.querySelector('.sp-now')),
      }
    }, S)
  /** What Spotify's player (a stand-in: lib.cjs) has been told to do, and where it is. */
  const player = () => p.evaluate(() => (window.__spotify ? { uri: window.__spotify.uri, paused: window.__spotify.paused, at: window.__spotify.at, calls: window.__spotify.calls.join(', ') } : null))
  let so = await sp()
  check('Spotify opens on Home: the way back and on, Home and one long search field along its head', so.view === 'Home' && so.home === 'page' && so.search === 'What do you want to play?' && so.back === 'true', JSON.stringify(so))
  check('it is dark panels on black: Your Library (the three playlists of podcasts under the names Dom gave them, then each playlist of songs under Spotify’s name for it), the main pane, the Now playing view, and the bar at the foot', so.panels && so.lib.join(' | ') === 'Tech/Podcasts • 11 episodes | Culture/Podcasts • 10 episodes | Infrastructure/Podcasts • 10 episodes | Lalala/Playlist | portugal/Playlist', JSON.stringify(so.lib))
  check('Home has its tiles and its sections, one for each list of podcasts and one for the playlists, each with Show all; the first episode is set out in the bar at the foot under its own title and show (it does not say Nothing playing, Plays through Spotify, or anything of previews)', so.tiles === 8 && so.sects === 'Podcasts/Tech/Show all | Podcasts/Culture/Show all | Podcasts/Infrastructure/Show all | From the team/Playlists/Show all' && so.cards === 2 && /^69\. Niv Dror .* \/ Non-Technical$/.test(so.what) && !/Nothing playing|Plays through Spotify|[Pp]review/.test(so.what + so.said), JSON.stringify({ tiles: so.tiles, sects: so.sects, what: so.what }))
  let pl = await player()
  check('Spotify’s own player for that episode is in the Now playing view (and not in the bar), by the episode’s link with no "si" on it, not yet playing; under it, what the episode is', so.side && so.players.length === 1 && so.players[0].includes('/embed/episode/4HK2X8EhWMW9PuyEWdf90F') && !/[?&]si=/.test(so.players[0]) && so.inFoot === 0 && pl?.uri === 'spotify:episode:4HK2X8EhWMW9PuyEWdf90F' && pl.paused && /Non-Technical \/ May 2022 • 39 min$/.test(so.about), JSON.stringify({ players: so.players, pl, about: so.about }))
  check('the bar at the foot is the buttons that play it, as Spotify’s bar has them (shuffle, the one before, play, the one after, repeat), over a line of where the episode is', so.keys === 'Shuffle, Previous episode, Play, Next episode, Repeat' && /^0:00 \/ /.test(so.line), JSON.stringify({ keys: so.keys, line: so.line }))
  // How it is drawn (Dom's screenshots of Spotify's bar, 26 Nov): each button 32 across with a picture of 16
  // in it, play in a white disc, 8 between them and 8 more at each side of the disc; the type is DM Sans
  const drawn = await p.evaluate(async (S) => {
    const w = document.querySelector(S)
    await document.fonts.ready
    const keys = [...w.querySelectorAll('.sp-keys button')].map((b) => b.getBoundingClientRect())
    const k = w.getBoundingClientRect().width / w.offsetWidth || 1
    return {
      sizes: keys.map((r) => `${Math.round(r.width / k)}x${Math.round(r.height / k)}`).join(' '),
      gaps: keys.slice(1).map((r, i) => Math.round((r.left - keys[i].right) / k)).join(' '),
      pictures: [...w.querySelectorAll('.sp-keys button svg')].map((g) => Math.round(g.getBoundingClientRect().width / k)).join(' '),
      disc: getComputedStyle(w.querySelector('.sp-go')).backgroundColor,
      face: getComputedStyle(w.querySelector('.spwin') ?? w).fontFamily.split(',')[0].replace(/["']/g, '').trim(),
      has: document.fonts.check('16px "DM Sans"'),
      bar: Math.round(w.querySelector('.sp-now').getBoundingClientRect().height / k),
      // (no volume: Spotify's embedded player cannot be told how loud to be, so no slider is drawn for it)
      sliders: [...w.querySelectorAll('.sp-now input[type="range"], .sp-now [role="slider"]')].map((x) => x.getAttribute('aria-label')).join(', '),
      loud: w.querySelectorAll('.sp-now [aria-label*="olume" i], .sp-now [aria-label*="mute" i]').length,
    }
  }, S)
  check('its buttons are Spotify’s sizes (32 across, pictures of 16, the white disc, 8 between and 16 beside the disc), in a bar of 88; the window is set in DM Sans', drawn.sizes === '32x32 32x32 32x32 32x32 32x32' && drawn.gaps === '8 16 16 8' && drawn.pictures === '16 16 16 16 16' && drawn.disc === 'rgb(255, 255, 255)' && drawn.bar === 88 && drawn.face === 'DM Sans' && drawn.has, JSON.stringify(drawn))
  check('the bar has one line to drag, the episode’s, and no volume slider (Spotify’s player cannot be told how loud to be: nothing is drawn that would do nothing)', drawn.sliders === 'Where the episode is' && drawn.loud === 0, JSON.stringify(drawn))
  // Under the pointer: a button of the bar says what it does, a row lightens and its number gives way to the play button
  await p.locator(`${S} .sp-keys button[aria-label="Shuffle"]`).hover()
  await p.waitForTimeout(700)
  const tip = await p.evaluate((S) => { const st = getComputedStyle(document.querySelector(`${S} .sp-keys button[aria-label="Shuffle"]`), '::before'); return { says: st.content, shown: st.opacity } }, S)
  check('a button of the bar says what it does when the pointer rests on it, as Spotify’s do', tip.says === '"Enable shuffle"' && tip.shown === '1', JSON.stringify(tip))
  await p.locator(`${S} button.sp-row`).nth(1).hover()
  await p.waitForTimeout(250)
  const over = await p.evaluate((S) => {
    const row = document.querySelectorAll(`${S} button.sp-row`)[1]
    const alpha = (c) => { const m = /rgba?\(([^)]+)\)/.exec(c); const parts = m ? m[1].split(/[,/ ]+/).filter(Boolean) : []; return parts.length > 3 ? parseFloat(parts[3]) : 1 }
    return { ground: alpha(getComputedStyle(row).backgroundColor), number: getComputedStyle(row.querySelector('.num .n')).visibility, play: getComputedStyle(row.querySelector('.num .sp-g')).display, under: getComputedStyle(row.querySelector('.t span')).color }
  }, S)
  check('a row under the pointer lightens, its number gives way to the play button, and what is said under its title goes white', over.ground > 0.05 && over.ground < 0.3 && over.number === 'hidden' && over.play === 'block' && over.under === 'rgb(255, 255, 255)', JSON.stringify(over))
  await p.mouse.move(8, 8)
  await p.locator(`${S} .sp-go`).click()
  await p.waitForTimeout(900)
  pl = await player()
  so = await sp()
  check('Play plays Spotify’s player: the button is Pause, and the line moves along with the episode, whose length it now says', pl.calls === 'toggle' && !pl.paused && pl.at > 0 && /Pause/.test(so.keys) && /^0:0[1-9] \/ 10:00$/.test(so.line), JSON.stringify({ pl, keys: so.keys, line: so.line }))
  await p.locator(`${S} .sp-line input`).focus()
  await p.keyboard.press('ArrowRight')
  await p.waitForTimeout(300)
  check('on the line, the right arrow moves the episode on five seconds, as it does Spotify’s', /seek ([5-9]|1\d)\b/.test((await player()).calls), (await player()).calls)
  await p.locator(`${S} .sp-keys button[aria-label="Next episode"]`).click()
  await p.waitForTimeout(700)
  pl = await player()
  so = await sp()
  check('Next episode gives the player the episode after it in its list, and plays on', pl.uri === 'spotify:episode:5rRgN3DwsHNjZpGrdInLYw' && !pl.paused && /load spotify:episode:5rRgN3DwsHNjZpGrdInLYw, play$/.test(pl.calls) && /^Talking Startup Investing .* \/ HyperChange$/.test(so.what), JSON.stringify({ pl, what: so.what }))
  await p.locator(`${S} .sp-end button`).click()
  await p.waitForTimeout(300)
  so = await sp()
  check('the switch at the bar’s right puts the Now playing view away; the episode plays on behind it', !so.side && so.players.length === 1 && !(await player()).paused, JSON.stringify({ side: so.side, players: so.players.length }))
  await p.locator(`${S} .sp-end button`).click()
  await p.waitForTimeout(300)
  await p.locator(`${S} .sp-go`).click()
  await p.waitForTimeout(300)
  check('and brings it back; Pause pauses', (await sp()).side && (await player()).paused, JSON.stringify(await player()))
  // Previous, as Spotify's is: well into an episode it is back to its start; at its start, the one before
  const key = (name) => p.locator(`${S} .sp-keys button[aria-label^="${name}"]`)
  await p.locator(`${S} .sp-line input`).focus()
  await p.keyboard.press('ArrowRight')
  await p.keyboard.press('ArrowRight')
  await p.waitForTimeout(250)
  await key('Previous').click()
  await p.waitForTimeout(300)
  pl = await player()
  check('Previous, well into an episode, goes back to its start', pl.uri === 'spotify:episode:5rRgN3DwsHNjZpGrdInLYw' && /seek 0$/.test(pl.calls) && pl.at === 0, JSON.stringify(pl))
  await key('Previous').click()
  await p.waitForTimeout(400)
  pl = await player()
  check('and from its start, to the episode before (which is not played: this one was paused); at the first of a list there is none before', pl.uri === 'spotify:episode:4HK2X8EhWMW9PuyEWdf90F' && pl.paused && (await key('Previous').getAttribute('aria-disabled')) === 'true', JSON.stringify(pl))
  // Shuffle: Next takes the others of the list in no order, each once; Previous goes back the way it came
  await key('Shuffle').click()
  const taken = []
  for (let i = 0; i < 10; i++) {
    await key('Next').click()
    await p.waitForTimeout(160)
    taken.push((await player()).uri)
  }
  check('Shuffle on (green, with its dot), Next goes through the other ten of the list once each, in no fixed order', (await key('Shuffle').getAttribute('aria-pressed')) === 'true' && new Set(taken).size === 10 && !taken.includes('spotify:episode:4HK2X8EhWMW9PuyEWdf90F') && taken.every((u) => /^spotify:episode:/.test(u)), JSON.stringify(taken))
  await key('Previous').click()
  await p.waitForTimeout(300)
  check('and Previous goes back to the one that was played before', (await player()).uri === taken[8], JSON.stringify({ at: (await player()).uri, was: taken[8] }))
  await key('Shuffle').click()
  // Repeat, and what follows an episode that has played to its end
  await p.locator(`${S} button.sp-row`).first().click()
  await p.waitForTimeout(500)
  await key('Repeat').click()
  await key('Repeat').click()
  const one = await key('Repeat').getAttribute('aria-label')
  await p.locator(`${S} .sp-line input`).focus()
  await p.keyboard.press('End')
  await p.waitForTimeout(1300)
  pl = await player()
  check('Repeat pressed twice is the one episode: played to its end, it starts again', one === 'Repeat: this episode' && pl.uri === 'spotify:episode:4HK2X8EhWMW9PuyEWdf90F' && !pl.paused && pl.at < 30000 && /seek 599, load spotify:episode:4HK2X8EhWMW9PuyEWdf90F, play$/.test(pl.calls), JSON.stringify(pl))
  await key('Repeat').click()
  await p.locator(`${S} .sp-line input`).focus()
  await p.keyboard.press('End')
  await p.waitForTimeout(1300)
  pl = await player()
  check('Repeat off (pressed a third time), an episode that ends is followed by the next in its list, which plays', (await key('Repeat').getAttribute('aria-pressed')) === 'false' && pl.uri === 'spotify:episode:5rRgN3DwsHNjZpGrdInLYw' && !pl.paused && /load spotify:episode:5rRgN3DwsHNjZpGrdInLYw, play$/.test(pl.calls), JSON.stringify(pl))
  // the chips over Your Library filter the library, one kind at a time
  await p.locator(`${S} .sp-lib .sp-chips button`, { hasText: 'Playlists' }).click()
  await p.waitForTimeout(250)
  let lib = await sp()
  check('the Playlists chip over Your Library leaves only the playlists there, and the main pane is as it was', lib.lib.length === 2 && lib.lib.every((l) => /\/Playlist$/.test(l)) && lib.view === 'Home', JSON.stringify(lib.lib))
  await p.locator(`${S} .sp-lib .sp-chips button.x`).click()
  await p.locator(`${S} .sp-lib .sp-chips button`, { hasText: 'Podcasts' }).click()
  await p.waitForTimeout(250)
  lib = await sp()
  check('the Podcasts chip leaves only the lists of podcasts; its x has everything back', lib.lib.length === 3 && lib.lib.every((l) => /\/Podcasts • \d+ episodes$/.test(l)), JSON.stringify(lib.lib))
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
  check('a list of podcasts, from the library: its page under its name, its eleven episodes in a table, and the way back lit', so.view === 'Tech' && so.hero === 'Podcasts / Tech / Shrug • 11 episodes' && so.rows === 11 && so.back === null && /\*$/.test(so.lib[0]), JSON.stringify(so))
  const table = await p.evaluate((S) => ({ head: [...document.querySelectorAll(`${S} .sp-row.head > span`)].map((x) => x.textContent.trim()).join('|'), row: document.querySelector(`${S} button.sp-row`).innerText.replace(/\s*\n\s*/g, ' / ') }), S)
  check('the table: each episode’s number, its title over its show, when it came out and how long it is, as Spotify has them', table.head === '#||Title|Released|' && /^1 \/ 69\. Niv Dror \(Founder & Managing Partner, Shrug Capital\) has “no problem” with cartoon fish \/ Non-Technical \/ May 2022 \/ 39 min$/.test(table.row), JSON.stringify(table))
  await p.locator(`${S} button.sp-row`).nth(2).click()
  await p.waitForTimeout(600)
  so = await sp()
  pl = await player()
  check('an episode picked plays: it is marked in the table, named in the bar at the foot, and the one Spotify’s player has', so.on === 2 && so.eq && /^Consumer Social, .* \/ Village Global Podcast$/.test(so.what) && pl.uri === 'spotify:episode:2IFu3Y5z2WfjZVieQc8a72' && !pl.paused && so.players.length === 1, JSON.stringify({ on: so.on, eq: so.eq, what: so.what, pl }))
  await p.locator(`${S} .sp-go`).click()
  await p.locator(`${S} .sp-lib .sp-item`).nth(4).click()
  await p.waitForTimeout(600)
  so = await sp()
  const listFrame = await p.evaluate((S) => document.querySelector(`${S} .sp-main iframe`)?.src ?? '', S)
  check('a playlist of songs is the main pane’s: its page under Spotify’s name for it, with Spotify’s own player, which brings its tracks; nothing is said of previews', so.hero === 'Public Playlist / portugal' && listFrame.includes('/embed/playlist/2UDAoEBddY0XvO9oXcI87S') && !/[Pp]review/.test(so.said) && /\*$/.test(so.lib[4]), JSON.stringify({ hero: so.hero, listFrame }))
  await p.locator(`${S} .spbar__nav button[aria-label="Back"]`).click()
  await p.waitForTimeout(300)
  check('Back goes to where it was: the list of podcasts', (await sp()).view === 'Tech', (await sp()).view)
  await p.locator(`${S} .sp-search input`).fill('zzzz')
  await p.waitForTimeout(300)
  const nothing = await p.locator(`${S} .sp-none`).first().innerText()
  check('the search field searches the room, and says when nothing in it is called that', (await sp()).rows === 0 && nothing === 'Nothing in the room is called that.', nothing)
  await p.locator(`${S} .sp-search input`).fill('nvidia')
  await p.waitForTimeout(300)
  check('and finds an episode by its title, whichever list it is in', (await sp()).rows === 1 && /Nvidia Part I/.test((await sp()).said), String((await sp()).rows))
  await close(p, 'spotify')
  check('closed, the player is let go of', (await player())?.calls.endsWith('destroy'), JSON.stringify(await player()))

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
        second: w.querySelectorAll('.yt-item')[1]?.querySelector('.w').innerText.replace(/\s*\n\s*/g, ' / '),
        player: w.querySelector('.yt-player iframe')?.src ?? null,
        frames: w.querySelectorAll('iframe').length,
        ratio: Math.round((r.width / r.height) * 100) / 100,
        radius: getComputedStyle(w.querySelector('.yt-player')).borderRadius,
        still: !!w.querySelector('.yt-item .yt-th'),
      }
    }, Y)
  /** YouTube's player (a stand-in) says something to the page, as the real one does. */
  const says = (told) => p.evaluate(([Y, told]) => { const f = document.querySelector(`${Y} .yt-player iframe`); window.dispatchEvent(new MessageEvent('message', { origin: 'https://www.youtube-nocookie.com', source: f.contentWindow, data: JSON.stringify(told) })) }, [Y, told])
  let yo = await yt()
  check('YouTube opens 1100 by 664 as its watch page: YouTube’s own logo (its mark and its word, drawn) and one field along the head, with no menu button, the rounded player sixteen by nine, and the list of twenty-two at the right, the first picked, with Play all at its head', (await sizeOf(p, 'youtube')) === '1100x664' && yo.mark === 'YouTube' && yo.word && !yo.menu && yo.field === 'Search this playlist' && yo.search === 'Search Daily Inspiration' && yo.items === 22 && yo.on === 0 && yo.head === 'Daily Inspiration / Shrug · 1 / 22 / Play all' && yo.ratio === 1.78 && yo.radius === '12px' && yo.still, JSON.stringify(yo))
  check('each video is under its own title and channel, as YouTube has them, with its still from YouTube by its id; nothing is said of why it is here until someone has written it', yo.h1 === 'Steve Jobs introduces iPhone in 2007' && /^J \/ John Schroter \/ Daily Inspiration · 1 \/ 22/.test(yo.under) && yo.second === 'Jensen Huang-The First Six Months of NVIDIA / Entrepreneurship.org' && yo.why === null && yo.stills === 'https://i.ytimg.com/vi/MnrJzXM7a6o/mqdefault.jpg https://i.ytimg.com/vi/yU3GUHDf0mk/mqdefault.jpg', JSON.stringify({ h1: yo.h1, under: yo.under, second: yo.second, why: yo.why, stills: yo.stills }))
  check('it plays as the window opens, in YouTube’s own player, with its sound off', yo.frames === 1 && /^https:\/\/www\.youtube-nocookie\.com\/embed\/MnrJzXM7a6o\?autoplay=1&mute=1&/.test(yo.player), String(yo.player))
  await p.locator(`${Y} .yt-item`).nth(3).click()
  await p.waitForTimeout(300)
  yo = await yt()
  check('a video picked in the list is the one shown, and plays with its sound', yo.on === 3 && yo.head === 'Daily Inspiration / Shrug · 4 / 22 / Play all' && yo.frames === 1 && /^https:\/\/www\.youtube-nocookie\.com\/embed\/oXsQ4NMQ6B8\?autoplay=1&rel=0/.test(yo.player) && yo.h1 === 'Raf Simons Autumn/Winter 2001-2002 "Riot! Riot! Riot!"', JSON.stringify({ on: yo.on, head: yo.head, player: yo.player, h1: yo.h1 }))
  // the player says a video has ended: the next one in the list begins
  await says({ event: 'onStateChange', info: 0 })
  await p.waitForTimeout(400)
  yo = await yt()
  check('when a video ends the next begins, as a playlist does', yo.on === 4 && /\/embed\/aayZ9ybDTBw\?/.test(yo.player) && yo.h1 === 'Inspiration: Jay-Z & Timbaland in the Studio', JSON.stringify({ on: yo.on, player: yo.player, h1: yo.h1 }))
  await p.locator(`${Y} .yt-list header .yt-pill`).click()
  await p.waitForTimeout(400)
  yo = await yt()
  check('Play all starts the list from its top, with its sound', yo.on === 0 && /\/embed\/MnrJzXM7a6o\?autoplay=1&rel=0/.test(yo.player), JSON.stringify({ on: yo.on, player: yo.player }))
  await p.locator(`${Y} .yt-search input`).fill('zzzz')
  await p.waitForTimeout(300)
  check('the field searches this playlist, as it says, and says when nothing in it is called that', (await p.locator(`${Y} .yt-item`).count()) === 0 && (await p.locator(`${Y} .yt-none`).innerText()) === 'Nothing in the list is called that.', '')
  await p.locator(`${Y} .yt-search input`).fill('bowie')
  await p.waitForTimeout(300)
  check('and finds a video by its title', (await p.locator(`${Y} .yt-item`).count()) === 1, String(await p.locator(`${Y} .yt-item`).count()))
  await p.locator(`${Y} .yt-search button[aria-label="Clear"]`).click()
  await p.waitForTimeout(200)
  await p.locator(`${Y} .yt-pill`, { hasText: 'Theater mode' }).click()
  await p.waitForTimeout(300)
  const theater = await p.evaluate((Y) => { const w = document.querySelector(Y); return { named: (() => { const h = w.querySelector('.yt-col h1').getBoundingClientRect(); const c = w.querySelector('.yt-col').getBoundingClientRect(); return h.bottom <= c.bottom + 1 })(), list: !!w.querySelector('.yt-list'), says: [...w.querySelectorAll('.yt-pill')].map((b) => b.textContent.trim()).find((x) => /view|mode/i.test(x)), wide: Math.round(w.querySelector('.yt-player').getBoundingClientRect().width) } }, Y)
  check('Theater mode puts the list away and gives the player the window, as wide as leaves the video’s name in sight under it', !theater.list && theater.says === 'Default view' && theater.wide > 760 && theater.named, JSON.stringify(theater))
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
  check('typing begins a message: the plus and Send are there, it can be sent as it is, and the offer of subjects is gone', typing.plus === 1 && typing.send === 'ready' && (await p.locator(`${M} .im-pick`).count()) === 0, JSON.stringify(typing))
  // another conversation is looked at: the new message stays at the head of the list, with what was typed in it
  await p.locator(`${M} .conv-list .conv`).first().click()
  await p.waitForTimeout(400)
  const kept = await p.evaluate((M) => ({ row: document.querySelector(`${M} .conv-write .conv`)?.innerText.trim(), x: !!document.querySelector(`${M} .conv-write__x`), write: document.querySelectorAll(`${M} .chat-write`).length }), M)
  await p.locator(`${M} .conv-write .conv`).click()
  await p.waitForTimeout(300)
  check('the new message stays in the list while another conversation is looked at, with its x, and has what was typed when it is come back to', kept.row === 'New Message' && kept.x && kept.write === 0 && (await p.locator(`${M} .im-field textarea`).inputValue()) === 'Hello Shrug.', JSON.stringify(kept))
  await p.locator(`${M} .conv-write__x`).click()
  await p.waitForTimeout(300)
  const away0 = await p.locator(`${M} .conv-write`).count()
  await p.locator('.im-pencil').click()
  await p.waitForTimeout(300)
  check('its x puts it away, and what was typed with it: the pencil starts another, empty, with the subjects offered', away0 === 0 && (await p.locator(`${M} .im-field textarea`).inputValue()) === '' && (await p.locator(`${M} .im-opt`).count()) === 3, String(away0))
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
  const gone = await p.evaluate((M) => { const w = document.querySelector(M); return { sub: w.querySelector('.im-sub')?.textContent, me: w.querySelector('.im-me')?.textContent, att: w.querySelector('.im-att')?.innerText.replace(/\s*\n\s*/g, ' / '), stat: w.querySelector('.im-stat')?.innerText.replace(/\s+/g, ' ').trim(), again: !!w.querySelector('.im-stat.bad button'), row: w.querySelector('.conv-write .conv')?.innerText.replace(/\s*\n\s*/g, ' / '), note: w.querySelector('.im-note')?.textContent ?? null, more: w.querySelector('.im-pick h2')?.textContent ?? null, room: (() => { const last = w.querySelector('.im-note')?.getBoundingClientRect(); const pick = w.querySelector('.im-pick h2')?.getBoundingClientRect(); return last && pick ? Math.round(pick.top - last.bottom) : null })() } }, M)
  check('sent, it is in the conversation under its subject, with its file, and says Sending… while it goes', sending === 'Sending…' && gone.sub === 'Request a meeting' && gone.me === 'We are building a thing.' && /^Deck\.pdf \/ 4 KB$/.test(gone.att ?? ''), JSON.stringify({ sending, gone }))
  check('in the demo, which has no inbox to take it, it is shown as Delivered and says under it that nothing was sent (a live site with no inbox says Not Delivered)', gone.stat === 'Delivered' && !gone.again && gone.row === 'Shrug / You: Request a meeting' && gone.note === 'Demo: nothing was sent.', JSON.stringify(gone))
  check('after it the subjects are offered again, as "More to say?", set well clear of what was sent', gone.more === 'More to say?' && gone.room >= 36, JSON.stringify({ more: gone.more, room: gone.room }))
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
  const postingSays = await p.evaluate(() => document.querySelector('.wf[data-app="photobooth"] .pb-line')?.textContent ?? null)
  check('and what posting does is said under it, in Dom’s words', postingSays === 'Posting shares this photo and your name with everyone.', String(postingSays))
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
  const first = await p.evaluate(() => { const th = document.querySelector('.pb-th'); return { name: th?.querySelector('small')?.textContent.trim(), fresh: th?.classList.contains('new'), marked: th?.classList.contains('waiting'), tag: th?.querySelector('.pb-th__wait')?.textContent.trim() ?? null, says: th?.querySelector('button')?.getAttribute('aria-label') } })
  check('Post to the Wall puts it on the wall at once, with no queue: it is in the strip under its taker’s name, and the booth says so', b.wall === 1 && /Riley Chen$/.test(first.name ?? '') && first.fresh && !first.marked && first.tag === null && b.toast === 'Posted. It’s on the wall.' && /^A photo by Riley Chen, \w+ \d{1,2}, \d{4}$/.test(first.says ?? ''), JSON.stringify({ b, first }))
  await p.locator('.pb-th button').first().click()
  await p.waitForTimeout(500)
  b = await pb(p)
  const meta = await p.evaluate(() => document.querySelector('.pb-meta')?.innerText.replace(/\s*\n\s*/g, ' / '))
  const bar = await p.evaluate(() => { const ctl = document.querySelector('.pb-ctl').getBoundingClientRect(); const cam = document.querySelector('.pb-shutter.back').getBoundingClientRect(); const share = document.querySelector('.pb-ctl .pb-share').getBoundingClientRect(); return { camMid: Math.round(Math.abs(cam.left + cam.width / 2 - (ctl.left + ctl.width / 2))), shareRight: Math.round(ctl.right - share.right), x: document.querySelector('.pb-th.on .pb-th__x')?.getAttribute('aria-label') } })
  check('a photo opens large, with who took it and when; the camera’s button is in the middle of the bar, Share at its right (no Save), and its own taker has an x on it in the strip (and no Flag: that is for someone else’s)', b.stage === 'large' && /Riley Chen \/ \w+ \d{1,2}, \d{4}$/.test(meta ?? '') && b.ctl === 'Back to the camera | Share this photo' && bar.camMid <= 1 && bar.shareRight <= 24 && bar.x === 'Remove this photo from the wall', JSON.stringify({ b, meta, bar }))
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
  // (this one is posted, so that there is something on the wall for a visitor to look at, and for someone else to flag)
  await p.locator('.pb-btn--post').click(); await p.waitForTimeout(1000)
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
  // someone else, logged in, cannot remove it: they can flag it for Shrug to look at, and are not shown it again.
  // It stays on the wall: its taker, and anyone else, still has it
  await p.locator('.pb-msg .pb-btn').click()
  await p.waitForTimeout(400)
  await p.locator('.account input[type=email]').fill('sam@example.test')
  await p.keyboard.press('Enter'); await p.waitForTimeout(900)
  await p.keyboard.type('4155550177'); await p.keyboard.press('Enter'); await p.waitForTimeout(900)
  await p.keyboard.type('246810'); await p.waitForTimeout(1500)
  await p.keyboard.type('Sam Okafor'); await p.locator('.account__go').click(); await p.waitForTimeout(1800)
  await p.locator('.pb-th button').first().click(); await p.waitForTimeout(400)
  const theirs = await pb(p)
  const noX = await p.locator('.pb-th__x').count()
  check('someone else, logged in, is not offered the x on another person’s photo: only its taker removes it', noX === 0 && theirs.wall === 1, JSON.stringify({ noX, wall: theirs.wall }))
  await p.locator('.pb-ctl .pb-btn', { hasText: 'Flag' }).click(); await p.waitForTimeout(500)
  b = await pb(p)
  check('they can flag it, for Shrug to look at: they are not shown it again, and the booth says so', /^Flag this photo as not right for the wall \| Back to the camera \| Share this photo$/.test(theirs.ctl) && b.wall === 0 && b.toast === 'Flagged for Shrug to look at. You won’t be shown it again.', JSON.stringify({ theirs: theirs.ctl, wall: b.wall, toast: b.toast }))
  await p.locator('.menubar__login').click()
  await p.locator('.account__row', { hasText: 'Log Out' }).click()
  await p.waitForTimeout(900)
  await p.locator('.pb-msg .pb-btn').click()
  await p.waitForTimeout(400)
  await p.locator('.account input[type=email]').fill('riley@example.test')
  await p.keyboard.press('Enter'); await p.waitForTimeout(900)
  await p.keyboard.type('246810'); await p.waitForTimeout(1800)
  const mine = await p.evaluate(() => { const th = document.querySelector('.pb-th'); return { n: document.querySelectorAll('.pb-th').length, tag: th?.querySelector('.pb-th__wait')?.textContent.trim() ?? null, says: th?.querySelector('button')?.getAttribute('aria-label') ?? null } })
  check('a flag takes nothing off the wall: the photo is still there for its taker (and for everyone else), as it was', mine.n === 1 && mine.tag === null && /^A photo by Riley Chen, /.test(mine.says ?? '') && !/flagged/i.test(mine.says ?? ''), JSON.stringify(mine))
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

  // ---- Weather: the Mac's own, opened from the widget on the desk (the forecast is the checks' stand-in for
  // the National Weather Service's: lib.cjs)
  const WT = '.wf[data-app="weather"]'
  const skies = await A.launch()
  const openWeather = async (weather, more = {}) => {
    const w = await A.open(skies, { device: 'desktop', base: BASE, query: 'empty', locale: 'en-US', timezoneId: 'America/Los_Angeles', weather, ...more })
    await w.page.waitForSelector('.sf', { timeout: 20000 })
    await w.page.waitForTimeout(900)
    await w.page.locator('.sf').click()
    await w.page.waitForSelector(`${WT}[data-open] .wt-msg, ${WT}[data-open] .wt-col`, { timeout: 15000 })
    await w.page.waitForTimeout(1200)
    return w
  }
  const wt = (p) => p.evaluate((WT) => {
    const w = document.querySelector(WT)
    const text = (sel, from = w) => from.querySelector(sel)?.textContent.replace(/\s+/g, ' ').trim() ?? null
    const tile = (name) => [...w.querySelectorAll('.wt-tile')].find((x) => (x.getAttribute('aria-label') ?? '').startsWith(name))
    const feel = tile('Feels like')
    const app = w.querySelector('.wt-app')
    const dock = document.querySelector('.dock__shelf').getBoundingClientRect()
    const box = w.getBoundingClientRect()
    return {
      kind: app.dataset.kind,
      light: app.dataset.light,
      sky: !!w.querySelector('.wt-sky'),
      clouds: w.querySelectorAll('.wt-sky .wt-cloud').length,
      drift: [...w.querySelectorAll('.wt-sky .wt-cloud')].some((c) => getComputedStyle(c).animationName !== 'none'),
      canvas: !!w.querySelector('.wt-sky canvas'),
      place: text('.wt-head h1'),
      temp: text('.wt-temp'),
      feels: text('.wt-feel'),
      range: text('.wt-range'),
      ink: getComputedStyle(w.querySelector('.wt-temp') ?? app).color,
      tiles: [...w.querySelectorAll('.wt-tile')].map((x) => (x.getAttribute('aria-label') ?? '').replace(/^The moon: .*/, 'The moon').replace(/^Sunrise$/, 'Sunset')).join(' | '),
      feel: feel ? { big: text('.wt-big', feel), mid: text('.wt-mid', feel), gap: text('.wt-gap', feel), says: text('p', feel) } : null,
      rain: text('.wt-big', tile('Chance of rain') ?? w),
      humid: text('.wt-big', tile('Humidity') ?? w),
      places: [...w.querySelectorAll('.wt-card')].map((c) => `${c.querySelector('.wt-card__top')?.firstElementChild?.firstChild?.textContent.trim() ?? c.textContent.trim().slice(0, 14)}${c.getAttribute('aria-current') ? '*' : ''}`).join(' | '),
      none: text('.wt-none'),
      msg: w.querySelector('.wt-msg')?.innerText.replace(/\s*\n\s*/g, ' / ') ?? null,
      wide: w.querySelector('.wt').scrollWidth - w.querySelector('.wt').clientWidth,
      clear: box.bottom <= dock.top + 1 && box.top >= 24,
      hours: [...w.querySelectorAll('.wt-hours li')].slice(0, 4).map((li) => li.textContent.replace(/\s+/g, ' ').trim()).join(' | '),
      spilt: [...w.querySelectorAll('.wt-tile')].filter((x) => x.scrollWidth > x.clientWidth + 1 || x.scrollHeight > x.clientHeight + 1).map((x) => x.getAttribute('aria-label')).join(' | '),
    }
  }, WT)
  /** Whether what falls in the sky is moving: its canvas drawn differently a little later. */
  const falling = async (p) => {
    const shot = () => p.evaluate((WT) => document.querySelector(`${WT} .wt-sky canvas`)?.toDataURL() ?? null, WT)
    const a = await shot(); await p.waitForTimeout(400); const b = await shot()
    return { drawn: !!a && a.length > 2000, moves: !!a && a !== b }
  }
  let w = await openWeather()
  p = w.page
  let s = await wt(p)
  check('the widget on the desk opens Weather: the window is the sky of the place, clear of the menu bar and the Dock, with the place’s name, its temperature large, how it feels, and the day’s high and low', (await front(p)) === 'weather' && s.sky && s.clear && s.place === 'San Francisco' && /^58°/.test(s.temp ?? '') && /Feels Like: 58°/.test(s.feels ?? '') && /^H:\d+° L:\d+°$/.test(s.range ?? '') && s.ink === 'rgb(255, 255, 255)', JSON.stringify({ place: s.place, temp: s.temp, feels: s.feels, range: s.range, ink: s.ink, clear: s.clear }))
  check('a mostly cloudy sky is clouds, and they drift', s.kind === 'cloud' && s.clouds >= 2 && s.drift && !s.canvas, JSON.stringify({ kind: s.kind, light: s.light, clouds: s.clouds, drift: s.drift, canvas: s.canvas }))
  check('under them, tiles: Feels Like first, then the wind, the hours ahead, humidity, rain, the week, the moon and the sun', s.tiles === 'Feels like | Wind | The hours ahead | Humidity | Chance of rain | Day by day | The moon | Sunset', s.tiles)
  check('Feels Like says what it feels like and what it is: at 58 with a breeze, the same', !!s.feel && s.feel.big === '58°' && s.feel.mid === 'Actual: 58°' && s.feel.gap === '=' && s.feel.says === 'Similar to the actual temperature.', JSON.stringify(s.feel))
  check('humidity and the chance of rain are the Service’s own numbers', s.humid === '76%' && s.rain === '10%', `${s.humid} ${s.rain}`)
  check('nothing in a tile is cut off, and the window does not scroll sideways', s.spilt === '' && s.wide <= 0, JSON.stringify({ spilt: s.spilt, wide: s.wide }))
  check('the places are down its left, the one shown picked: three in the United States, and London', /^San Francisco\* \| Los Angeles \| New York \| London$/.test(s.places), s.places)
  await p.locator(`${WT} .wt-seg button[aria-label*="ain"]`).first().click(); await p.waitForTimeout(300)
  const asRain = (await wt(p)).hours
  check('the hours ahead can be read as the chance of rain', /\d+%/.test(asRain), asRain)
  await p.locator(`${WT} .wt-card`, { hasText: 'New York' }).click(); await p.waitForTimeout(700)
  s = await wt(p)
  check('another place, picked, is shown', s.place === 'New York' && /New York\*/.test(s.places), JSON.stringify({ place: s.place, places: s.places }))
  // London (Dom, 27 Nov) is not the Weather Service's to forecast: it is the Norwegian Meteorological Institute's,
  // in Celsius, asked for once, and said to be theirs with the licence it is given under
  const metAsked = []
  p.on('request', (r) => /api\.met\.no/.test(r.url()) && metAsked.push({ url: r.url(), agent: Object.keys(r.headers()).filter((h) => !/^(accept|accept-language|accept-encoding|referer|origin|user-agent|sec-|connection|host|pragma|cache-control)/i.test(h)) }))
  await p.locator(`${WT} .wt-card`, { hasText: 'London' }).click(); await p.waitForTimeout(900)
  s = await wt(p)
  const foot = await p.evaluate((WT) => ({ says: document.querySelector(`${WT} .wt-foot`)?.textContent.replace(/\s+/g, ' ').trim() ?? '', links: [...document.querySelectorAll(`${WT} .wt-foot a`)].map((a) => a.getAttribute('href')).join(' | ') }), WT)
  check('London is shown from another service’s forecast, its Celsius put into Fahrenheit (9 is 48), with the tiles the others have', s.place === 'London' && /London\*/.test(s.places) && /^48°/.test(s.temp ?? '') && /^H:\d+° L:\d+°$/.test(s.range ?? '') && /Feels like \| Wind \| The hours ahead/.test(s.tiles) && s.humid === '81%' && s.spilt === '', JSON.stringify({ place: s.place, temp: s.temp, range: s.range, tiles: s.tiles, humid: s.humid, spilt: s.spilt }))
  check('and its foot says whose the data is and under what licence, as their terms ask', /^Data from MET Norway/.test(foot.says) && /CC BY 4\.0/.test(foot.says) && /api\.met\.no\/doc\/License/.test(foot.links), JSON.stringify(foot))
  await p.locator(`${WT} .wt-card`, { hasText: 'New York' }).click(); await p.waitForTimeout(500)
  await p.locator(`${WT} .wt-card`, { hasText: 'London' }).click(); await p.waitForTimeout(700)
  const london = metAsked.filter((r) => /lat=51\.5074&lon=-0\.1278/.test(r.url))
  check('it is asked as their terms ask of a small site: the place to four decimals, nothing added to the request, and not again while its answer is good', london.length <= 1 && metAsked.every((r) => /\/weatherapi\/locationforecast\/2\.0\/complete\?lat=-?\d+\.\d{4}&lon=-?\d+\.\d{4}$/.test(r.url) && r.agent.length === 0), JSON.stringify(metAsked))
  await p.locator(`${WT} .wt-card`, { hasText: 'New York' }).click(); await p.waitForTimeout(500)
  await p.locator(`${WT} .wt-find input`).fill('los'); await p.waitForTimeout(250)
  const found = (await wt(p)).places
  await p.locator(`${WT} .wt-find input`).fill('zzz'); await p.waitForTimeout(250)
  s = await wt(p)
  check('the field over them finds a place by name, and says so when none is called that', found === 'Los Angeles' && s.places === '' && s.none === 'No place here is called that.', JSON.stringify({ found, places: s.places, none: s.none }))
  await p.locator(`${WT} .wt-find input`).fill('')
  const clear = await p.evaluate((WT) => { const f = document.querySelector(`${WT} .wt-fold`).getBoundingClientRect(); const i = document.querySelector(`${WT} .wt-find`).getBoundingClientRect(); return Math.round(i.top - f.bottom) }, WT)
  check('the round button at the sidebar’s head is clear of the search field under it (they do not touch)', clear >= 8 && clear <= 14, String(clear))
  await p.locator(`${WT} .wt-fold`).click(); await p.waitForTimeout(300)
  check('the button at its head puts the places away, and brings them back', (await p.locator(`${WT} .wt-side`).count()) === 0 && (await p.locator(`${WT} .wt-fold`).getAttribute('aria-label')) === 'Show the places')
  check('nothing went wrong on the way (Weather)', A.realErrors(w.errors).length === 0, A.realErrors(w.errors).join(' | '))
  await w.ctx.close()
  // cold and windy, in the rain: it feels colder than it is, and the rain falls
  w = await openWeather({ temperature: 44, windSpeed: '15 mph', shortForecast: 'Rain Showers' })
  p = w.page
  s = await wt(p)
  let fall = await falling(p)
  check('at 44 in a 15 mph wind it feels like 37 (the Service’s wind chill): seven lower, and it says the wind is why', /Feels Like: 37°/.test(s.feels ?? '') && !!s.feel && s.feel.big === '37°' && s.feel.mid === 'Actual: 44°' && s.feel.gap === '↓7°' && s.feel.says === 'Wind is making it feel colder.', JSON.stringify({ feels: s.feels, feel: s.feel }))
  check('in rain the sky is rain, and it falls', s.kind === 'rain' && s.canvas && fall.drawn && fall.moves, JSON.stringify({ kind: s.kind, ...fall }))
  await w.ctx.close()
  // for someone who has asked for less motion, the sky is still
  w = await openWeather({ shortForecast: 'Rain Showers' }, { reducedMotion: true })
  p = w.page
  s = await wt(p)
  fall = await falling(p)
  check('with less motion asked for, the sky is the same sky, and nothing in it moves', s.kind === 'rain' && !s.drift && !fall.moves, JSON.stringify({ kind: s.kind, drift: s.drift, ...fall }))
  await w.ctx.close()
  // the Service does not answer: it says so, and offers to ask again
  w = await openWeather('down')
  p = w.page
  s = await wt(p)
  check('with no answer from the Service it says the forecast didn’t arrive, with Try Again, and shows no weather it was not told', /^San Francisco \/ The forecast didn’t arrive\. \/ Try Again$/.test(s.msg ?? '') && s.tiles === '' && s.temp === null, JSON.stringify({ msg: s.msg, tiles: s.tiles, temp: s.temp }))
  await w.ctx.close()
  await skies.close()

  console.log(failed ? `${failed} FAILED` : 'all ok')
  process.exit(failed ? 1 : 0)
})().catch((e) => {
  console.error('FAILED', e.message.split('\n').slice(0, 10).join('\n'))
  process.exit(1)
})
