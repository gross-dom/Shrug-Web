# Checks

The checks the audit ran (see `docs/audit.md`), kept so that the next change can be held to the same standard. They drive the site in a real browser: every screen of the iPhone, every window of the desktop, arriving on a slow or broken connection, a change of layout mid-visit, keyboard-only use, forced colours, reduced motion, and each of the audit's fixes.

```sh
sh tests/all.sh            # builds, serves the build, runs everything (about 40 minutes)
sh tests/all.sh nowebkit   # without the passes in Safari's engine
node tests/checks/phone-flow.cjs http://127.0.0.1:5173/   # one suite, against the dev server
```

They are not part of the site and add nothing to its dependencies. They need:

- **Playwright** and its Chromium: `npm install --no-save playwright && npx playwright install chromium`, or a global install (the scripts are run with `NODE_PATH` set to the global modules).
- **axe-core** for the accessibility scans (`phone-axe`, and the one `terminal-vip` runs): `npm install --no-save axe-core`. Without it both stop on a file that is not there.
- For the WebKit passes only: WebKitGTK's `MiniBrowser` and `WebKitWebDriver`, and `xvfb-run` (set `MINIBROWSER` to the browser's path if it is not Debian's). Leave them out with `nowebkit`.
- Python 3 with Pillow, for the contact sheets some checks make of their pictures.

Run against a build (`all.sh` does), not only the dev server: the dev server keeps every stylesheet in the order it is imported and a build does not have to, and one fault in this audit could only be seen in a build. Pictures the checks take go to `tests/audit/shots/` (not kept in git).

| Check | What it holds to |
| --- | --- |
| `phone-flow`, `phone-apps`, `phone-links`, `phone-folders`, `badge` | The iPhone: lock and unlock, each app end to end, moving between them, the Home Screen's folders, the Messages badge; and VIP, which is a link in the Dock and no app (a tap opens the points site in a new tab; an address or a step in history that names it opens nothing; search finds it as a link) |
| `desktop-flow` | The desktop: windows, each app, the screen saver; what is at the right of the menu bar (Log In and the clock, and no link); and VIP in the Dock and the Go menu, a link to the points site that opens in a new tab and no window |
| `arriving` | Something to land on however the site arrives: slow, a file missing, offline, scripts off, an old browser, an address the site does not have |
| `crossing` | A change of layout keeps the visitor's place; a keyboard is not a change of layout |
| `addresses` | What a phone fetches, the order of the stylesheets in a build, forgiving addresses (and that one which asks for VIP, which is no window or app, opens nothing for it) |
| `place` | The address follows the visitor on both layouts, a link opens where it says, Share passes that link on, and a reload brings the desktop back |
| `portfolio-faqs`, `terminal-vip`, `messages`, `folders-search`, `ios-parts`, `phone-shell`, `desktop-shell` | Each of the audit's fixes, and of the review's after it, by area (`terminal-vip` also holds to Tab, `whois`, `fortune` and a founder's company; `phone-shell` to the glass, the Lock Screen and a second tap). VIP's half of `terminal-vip` is `terminal-vip-link.cjs`: VIP is the way to the points site, so it holds to the link by every route besides the Dock's own icon (`open vip` in the terminal, the Drops conversation, About Shrug's Drops row, the menus), to no window or app by any (a desk kept with one, a step in history), and to the two windows still laid out with the classes VIP's window had, Wallpapers and LP Updates, being drawn as they were. `terminal-vip-axe.cjs` is axe-core over the terminal, those links and those two windows, and a violation there fails the run |
| `account` | Log In at the right of the menu bar (the sheet, an address, six digits, a wrong code), the LP Updates folder it puts on the desk and what is in it, a download, a reload, Log Out, and that a visitor and a phone have neither. It runs against the demo's stand-in (`src/os/account.ts`) |
| `between-apps` | What happens between apps on the iPhone (an app opening out of its icon frame by frame, its launch screen, being carried off by hand), the Exit buttons of Notes and Messages, a message to Shrug with files, Back leading back out to a folder, and on the desktop the widget and the redrawn icons |
| `forced-colours` | Windows High Contrast (Chromium's emulation), and the kit's parts under reduced motion |
| `*-webkit` | The same in Safari's engine |
| `phone-axe` | axe-core over every iPhone screen. It prints what it finds and does not fail the run: read its last lines, which should be "no violations" |

`live.cjs` runs any one of them against the deployed site from a machine whose way out is a proxy (`node tests/checks/live.cjs place.cjs https://shrug-web.vercel.app/`).

`lib.cjs` is what they share: opening the site as a given device, reaching any iPhone screen through history, and a few detectors (spills, small targets, console errors). It also answers for the weather service the desk's widget asks (`api.weather.gov`), so that nothing a check finds depends on the weather or on that service being up, and for the points site that VIP leads to (`SITE.points` in `src/data/site.ts`, read from there as `POINTS`): a check that follows VIP gets an empty page at that address, and asks nothing of the network (`tabFrom` presses something and says where the tab it opened went). No real phone, Firefox, or screen reader is involved: what those add is not covered here.

Two things to know when adding to them. Replies land every two seconds (quicker out of sight) and each drops a banner over the top bar of whatever app is showing, so a check that presses things there first pauses the replies the way a visitor can (Pause Replies in the conversation's details: `quiet` in `ios-parts.cjs`); the phone has no Settings app to turn banners off in. And a bubble is still growing out of its typing dots for a moment after it lands, so a measurement of the thread's height takes the least of a few looks (`spareOf` in `desktop-flow.cjs`).
