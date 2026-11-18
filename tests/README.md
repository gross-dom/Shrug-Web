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
| `forced-colours` | Windows High Contrast (Chromium's emulation), and the kit's parts under reduced motion |
| `*-webkit` | The same in Safari's engine |
| `phone-axe` | axe-core over every iPhone screen |

`lib.cjs` is what they share: opening the site as a given device, reaching any iPhone screen through history, and a few detectors (spills, small targets, console errors). No real phone, Firefox, or screen reader is involved: what those add is not covered here.
