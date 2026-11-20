# Checks

The checks the audit ran (see `docs/audit.md`), kept so that the next change can be held to the same standard. They drive the site in a real browser: every screen of the iPhone, every window of the desktop, arriving on a slow or broken connection, a change of layout mid-visit, keyboard-only use, forced colours, reduced motion, and each of the audit's fixes.

```sh
sh tests/all.sh            # builds, serves the build, runs everything (about 40 minutes)
sh tests/all.sh nowebkit   # without the passes in Safari's engine
node tests/checks/phone-flow.cjs http://127.0.0.1:5173/   # one suite, against the dev server
```

They are not part of the site and add nothing to its dependencies. They need:

- **Playwright** and its Chromium: `npm install --no-save playwright && npx playwright install chromium`, or a global install (the scripts are run with `NODE_PATH` set to the global modules).
- **axe-core** for the accessibility scans: `npm install --no-save axe-core`.
- For the WebKit passes only: WebKitGTK's `MiniBrowser` and `WebKitWebDriver`, and `xvfb-run` (set `MINIBROWSER` to the browser's path if it is not Debian's). Leave them out with `nowebkit`.
- Python 3 with Pillow, for the contact sheets some checks make of their pictures.

Run against a build (`all.sh` does), not only the dev server: the dev server keeps every stylesheet in the order it is imported and a build does not have to, and one fault in this audit could only be seen in a build. Pictures the checks take go to `tests/audit/shots/` (not kept in git).

| Check | What it holds to |
| --- | --- |
| `phone-flow`, `phone-apps`, `phone-links`, `phone-folders`, `badge` | The iPhone: lock and unlock, each app end to end, moving between them, the Home Screen's folders, the Messages badge |
| `desktop-flow` | The desktop: windows, each app, the screen saver |
| `arriving` | Something to land on however the site arrives: slow, a file missing, offline, scripts off, an old browser, an address the site does not have |
| `crossing` | A change of layout keeps the visitor's place; a keyboard is not a change of layout |
| `addresses` | What a phone fetches, the order of the stylesheets in a build, forgiving addresses |
| `place` | The address follows the visitor on both layouts, a link opens where it says, Share passes that link on, and a reload brings the desktop back |
| `portfolio-faqs`, `terminal-vip`, `messages`, `folders-search`, `ios-parts`, `phone-shell`, `desktop-shell` | Each of the audit's fixes, by area |
| `between-apps` | What happens between apps on the iPhone (an app opening out of its icon frame by frame, its launch screen, being carried off by hand), the ways out of Notes and Messages, a message to Shrug with files, and on the desktop the widget and the redrawn icons |
| `forced-colours` | Windows High Contrast (Chromium's emulation), and the kit's parts under reduced motion |
| `*-webkit` | The same in Safari's engine |
| `phone-axe` | axe-core over every iPhone screen. It prints what it finds and does not fail the run: read its last lines, which should be "no violations" |

`live.cjs` runs any one of them against the deployed site from a machine whose way out is a proxy (`node tests/checks/live.cjs place.cjs https://shrug-web.vercel.app/`).

`lib.cjs` is what they share: opening the site as a given device, reaching any iPhone screen through history, and a few detectors (spills, small targets, console errors). It also answers for the weather service the desk's widget asks (`api.weather.gov`), so that nothing a check finds depends on the weather or on that service being up. No real phone, Firefox, or screen reader is involved: what those add is not covered here.

Two things to know when adding to them. Replies land a little over once a second and each drops a banner over the top bar of whatever app is showing, so a check that presses things there first pauses the replies the way a visitor can (Pause Replies in the conversation's details: `quiet` in `ios-parts.cjs`); the phone has no Settings app to turn banners off in. And a bubble is still growing out of its typing dots for a moment after it lands, so a measurement of the thread's height takes the least of a few looks (`spareOf` in `desktop-flow.cjs`).
