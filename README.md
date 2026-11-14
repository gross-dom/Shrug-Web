# Shrug Web

Shrug's website as a desktop you can click around: a macOS-style skin over the "Shrug desktop" design, built with the [Stageshow](https://github.com/benjitaylor/skills) kit's window chrome, message thread, rows and controls. On a phone it is an iPhone instead: a Home Screen of the same apps.

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
| Group chat | Group chat | Shrug's own Messages. Shrug asks the group what it's like to work with them, and ninety people reply. |
| Portfolio | Portfolio | Every company under its logo, by vertical, as icons or a list, with search, Back/Forward and a preview of the one selected. |
| FAQs | FAQs | Each question as a note. |
| Case Studies | Case Studies | A terminal that lists the case studies and takes an access request. |
| VIP | VIP | Photos and videos from the drops, with each drop as an album. |
| About Shrug | (the menu bar's mark) | Counts taken from the data. |

Windows drag by their bar, resize from any edge or corner, and close, minimise and zoom from their traffic lights. Drag one against the left, right or top edge to tile it, or rest the pointer on the green light for the same choices. The screen saver starts after two and a half minutes of stillness, or from the mark's menu.

### The group chat

It is laid out as an iMessage group conversation, seen from Shrug's side:

- Shrug's messages are the blue bubbles on the right. The script types them into the message field and sends them, so each bubble leaves the field the way a sent message does, and "Delivered" sits under the last one.
- Everyone else is gray on the left, with their name and role over the bubble and their initials beside it.
- The sidebar is the list of conversations: the group, then a conversation for each person as they reply, newest first, unread until opened. A person's own conversation shows the question and their reply.
- The name in the bar, or the Details button, opens the details: pause the replies, show them all, play it again, and everyone in the group.
- The plus beside the field opens the rest of the site.
- Anything a visitor types is shown as Not Delivered, as Messages marks a message that didn't go. Nothing is sent and nobody replies.

### On a phone

Below 760px wide (or 480px tall) the site is drawn as an iPhone: a Home Screen with the apps, a widget for the group chat and a Dock. Each app opens full screen out of its icon and has the screens iOS would give it: Messages' list, conversation and details; the portfolio as a grid of logos with a sheet for each company; the FAQs as notes; the case studies as a terminal; VIP as a photo library; About as a settings list.

- The phone's screens are steps in the browser's history, so the phone's own back gesture or button steps back through them.
- A reply that lands while the conversation is not on screen drops in as a banner (three at most in a visit).
- The screen saver is a lock screen with the newest replies as notifications.
- The status bar and home indicator are the real phone's; the page only keeps clear of them.

### Links

- `?open=portfolio,faqs` opens those windows as well as the group chat (on a phone, the last one named). Names: `chat`, `portfolio`, `faqs`, `case-studies`, `vip`.
- `?saver` starts on the screen saver. `?idle=20` sets how many seconds of stillness start it.

## Content

Everything on the site comes from `src/data/`.

| File | What it holds | Where it came from |
| --- | --- | --- |
| `people.ts` | The ninety people, their roles and their quotes | Names and roles from the design; each quote is that person's testimonial as published on shrug.vc |
| `portfolio.ts` | The companies by vertical, with a link, a one-line description and a logo | Names and verticals from the design; links and descriptions from shrug.vc's portfolio page |
| `public/logos/` | One 144px tile per company | Each company's own site icon |
| `faqs.ts` | The seven questions | The design |
| `drops.ts` | The drops | The design |

Still to come, and marked as such on screen:

| File | Missing | What shows until then |
| --- | --- | --- |
| `faqs.ts` | All seven answers (`answer: null`) | The bracketed slot from the design |
| `drops.ts` | Every photo and video (`src`, `from`) | "Photo slot" and "Video slot" tiles |
| `portfolio.ts` | 15 logos (`logo: null`) | The company's initial on a gray tile |

Fill in a field and the real thing replaces its placeholder; nothing else needs to change. To add a logo, put a square image in `public/logos/` and name it in the company's entry.

The 15 companies without a logo are Senra, Mona Lee Solar, Homemade, BloxSnacks, Loyal, Supergreat, Drumroll, Lula, Seis, RTFKT, Once Upon, Diagram, Tome, Opal and Poparazzi: their sites had no icon or served one that isn't their logo (a host's default, a parked page, another product's, a placeholder), and no site could be confirmed for Drumroll or Lula. About a quarter of the other logos come from small icons (32 to 48px) and are soft at the preview's size; a proper logo file replaces any of them the same way.

Nothing leaves the page yet. A message typed into the group chat and an email given to the terminal are shown on screen and go nowhere. Wire them up in `src/apps/chat.ts` (`sendMessage`) and `src/apps/Terminal.tsx` (`answer`).

## Where things are

```
public/logos/  the companies' logos
src/
  data/     the site's content
  os/       the desktop: window manager, menu bar, Dock, icons, screen saver
  apps/     one file per window, plus what windows and phone screens share
            (chat.ts: the chat's clock; chat-ui.tsx: the conversation;
            portfolio-ui.tsx: the companies and their logos; state.ts)
  phone/    the phone: Home Screen, navigation, each app's screens, lock screen
  styles/   base.css, os.css (the desktop), apps.css (the windows), phone.css
  kit/      the Stageshow kit, copied in unmodified
```

- **Window behaviour** is in `os/wm.ts` (state) and `os/WindowFrame.tsx` (dragging, resizing, the lights).
- **A new window**: add it to `os/apps.ts`, write its component in `apps/`, list it in `os/Desktop.tsx`, and give it a screen in `phone/apps.tsx`.
- **The phone** is `phone/Phone.tsx` (Home Screen, apps opening and closing, banners), `phone/nav.ts` (where it is, mirrored into history) and `phone/ui.tsx` (bars, lists, sheets).
- **The wallpaper** is drawn in CSS (`.os__wallpaper` in `os.css`). To use a photograph, put it in `public/` and set `--wallpaper: url('/wallpaper.jpg')` on `.os`.
- **The look** is a set of kit tokens on `.os` in `os.css`: accent, grays, type, window radius.

## The kit

`src/kit/` is a copy of the kit from the Stageshow skill in `.agents/skills/stageshow/`, with no changes, so it can be replaced with a newer copy. The kit's parts are drawn for scripted demos; here they are wrapped so they work as a real interface:

- The kit's `Window` draws the chrome. `WindowFrame` puts working traffic lights over the spot the kit keeps for them and adds dragging and resizing.
- The kit's `Thread`, `Bubble`, `Stamp` and `Receipt` draw the conversation, its typing dots and its bubbles leaving the field. `apps/chat-ui.tsx` lets it scroll and keeps it on the newest reply.
- The kit's `Row` and `Avatar` draw the list of conversations and the monograms.
- The kit's `Popover` draws the menus and the details. The menu bar adds the items, keyboard and focus handling.
- The kit's `LockScreen` and `Notification` draw the phone's lock screen and banners.

The app icons, folder, document and wallpaper are drawn for this site. No operating system's artwork is used. The company logos belong to the companies.
