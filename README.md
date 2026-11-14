# Shrug Web

Shrug's website as a desktop you can click around: a macOS-style skin over the "Shrug desktop" design, built with the [Stageshow](https://github.com/benjitaylor/skills) kit's window chrome, message thread, rows and controls.

## Run it

```sh
npm install
npm run dev      # http://127.0.0.1:5173
npm run build    # type-checks, then builds to dist/
npm run preview  # serves the build
```

Node 20.19 or newer.

## What's on the desktop

| Window | In the Dock as | What it holds |
| --- | --- | --- |
| Group chat | Group chat | Shrug asks what it's like to work with them; ninety people reply. You can message back. |
| Portfolio | Portfolio | Every company by vertical, as icons or a list, with search and Back/Forward. |
| FAQs | FAQs | Each question as a note. |
| Case Studies | Case Studies | A terminal that lists the case studies and takes an access request. |
| VIP | VIP | Photos and videos from the drops, with each drop as an album. |
| About Shrug | (the menu bar's mark) | Counts taken from the data. |

Windows drag by their bar, resize from any edge or corner, and close, minimise and zoom from their traffic lights. Drag one against the left, right or top edge to tile it, or rest the pointer on the green light for the same choices. The screen saver starts after two and a half minutes of stillness, or from the mark's menu.

On a phone-sized screen each window fills the screen and nothing drags.

### Links

- `?open=portfolio,faqs` opens those windows as well as the group chat. Names: `chat`, `portfolio`, `faqs`, `case-studies`, `vip`.
- `?saver` starts on the screen saver. `?idle=20` sets how many seconds of stillness start it.

## Content still to come

Everything on the site comes from `src/data/`. Three things are placeholders and are marked as such on screen:

| File | Missing | What shows until then |
| --- | --- | --- |
| `people.ts` | 89 of the 90 quotes (`quote: null`) | Gray lines in the bubble |
| `faqs.ts` | All seven answers (`answer: null`) | The bracketed slot from the design |
| `drops.ts` | Every photo and video (`src`, `from`) | "Photo slot" and "Video slot" tiles |

Fill in a field and the real thing replaces its placeholder; nothing else needs to change.

Nothing leaves the page yet. A message typed into the group chat and an email given to the terminal are shown on screen and go nowhere, and both say so. Wire them up in `src/apps/chat.ts` (`sendMessage`) and `src/apps/Terminal.tsx` (`answer`).

## Where things are

```
src/
  data/     the site's content
  os/       the desktop: window manager, menu bar, Dock, icons, screen saver
  apps/     one file per window, plus the chat's clock (chat.ts)
  styles/   base.css, os.css (the desktop), apps.css (the windows)
  kit/      the Stageshow kit, copied in unmodified
```

- **Window behaviour** is in `os/wm.ts` (state) and `os/WindowFrame.tsx` (dragging, resizing, the lights).
- **A new window**: add it to `os/apps.ts`, write its component in `apps/`, and list it in `os/Desktop.tsx`.
- **The wallpaper** is drawn in CSS (`.os__wallpaper` in `os.css`). To use a photograph, put it in `public/` and set `--wallpaper: url('/wallpaper.jpg')` on `.os`.
- **The look** is a set of kit tokens on `.os` in `os.css`: accent, grays, type, window radius.

## The kit

`src/kit/` is a copy of the kit from the Stageshow skill in `.agents/skills/stageshow/`, with no changes, so it can be replaced with a newer copy. The kit's parts are drawn for scripted demos; here they are wrapped so they work as a real interface:

- The kit's `Window` draws the chrome. `WindowFrame` puts working traffic lights over the spot the kit keeps for them and adds dragging and resizing.
- The kit's `Thread` and `Bubble` draw the conversation. The chat window lets it scroll and keeps it on the newest reply.
- The kit's `Popover` draws the menus. The menu bar adds the items, keyboard and focus handling.

The app icons, folder, document and wallpaper are drawn for this site. No operating system's artwork is used.
