# Shrug Web

Shrug's website as a desktop you can click around: a macOS-style skin over the "Shrug desktop" design, built with the [Stageshow](https://github.com/benjitaylor/skills) kit's window chrome, message thread, rows and controls. How it works on a phone is being chosen: there are ten versions of that to try.

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
- The sidebar is the list of conversations: the group (“Shrug Family”), then everyone's own message, all there from the start and unread until opened, so they can be read through while the group plays out beside them. A person's own conversation shows the question and their reply.
- In the group, every reply keeps the same time: its typing dots, the message, a breath, the next. It never speeds up. The pace is `WRITING` and `BETWEEN` in `src/apps/chat.ts`.
- The name in the bar, or the Details button, opens the details: pause the replies, show them all, play it again, and everyone in the group.
- The plus beside the field opens the rest of the site.
- Anything a visitor types is shown as Not Delivered, as Messages marks a message that didn't go. Nothing is sent and nobody replies.

### On a phone

Below 760px wide (or 480px tall) the site is laid out for a phone, and how it should work there is still being chosen. There are ten versions, from the most familiar to the least. `?v=3` shows the third; with no `v`, a phone shows the list of them. A bar above each one names it, steps to the next and goes back to the list. The list and the bar are scaffolding for choosing: they are not part of any version.

| | Version | What it is | What of the phone it uses |
| --- | --- | --- | --- |
| 1 | The scroll | One long page. The conversation plays as you scroll into it; the rest follows as chapters. | Scrolling, snap carousels |
| 2 | Messages, with apps | The conversation, with the site living where the keyboard does, as iMessage apps do. | The keyboard's place, taps, stickers |
| 3 | The sheet | The conversation never stops; everything else is a sheet you pull up over it with a thumb. | A draggable sheet, one-thumb reach |
| 4 | Stories | Ninety rings. Tap one and their reply fills the screen; tap on, hold to read, swipe away. | Taps, holds, swipes |
| 5 | The feed | One reply to a screen. Swipe up for the next, sideways for the portfolio, double tap to love. | Paging swipes, double tap, the share sheet |
| 6 | The deck | A deck of ninety cards to flick through: keep the ones that land, and share your hand. | Dragging and flinging, flips, ticks |
| 7 | Shrug it | Ask the question, then shrug your phone. Every shrug is another answer. | Shaking and tilting |
| 8 | The jar | Ninety people pour in and pile up. Tilt the phone and they roll; tap one to hear them out. | Which way is down, flicks |
| 9 | The window | Your phone is a window onto Niv's Mac: pan, pinch and turn it to look around the real desktop. | Pan, pinch, turning the phone |
| 10 | The room | The family is all around you. Turn where you stand to look round the room at them. | Which way you face, the camera |

- **Every version works by touch alone.** Shaking, tilting, turning and the camera are extras: a phone has to be asked before it will report its movement (each version that wants it has a button for that), and where it says no, or there is nothing to ask, the same things are done by dragging and tapping.
- **What they share**: the pages a version can open over itself (the portfolio, FAQs, case studies and VIP, in `src/phone/apps.tsx`), the sheets (a company, a person, the access request), and `src/phone/native.ts`, which is the share sheet, a tick under the finger, and how the phone is held and moved.
- **Opening a page or a sheet is a step in the browser's history**, so the phone's back gesture or button closes what is open.
- **Versions 2 and 3 are the conversation with the visitor in it**: Niv adds you to Shrug Family, asks his question, and you get around by replying. `src/phone/convo.ts` holds what is said and what each reply sets off. Niv's lines other than the two he opens with are placeholder copy.
- **Reaching Shrug for real** needs a number or an address in `SITE.contact` (`src/data/site.ts`). Until then the versions that offer it say so in its place.
- **The link preview** is the conversation's opening (`public/og.png`, taken by `tools/og.cjs`), so the address unfolds as the chat when it is texted.

Once one is picked, the others, the list and the bar come out: `src/phone/variants/` and `src/styles/variants/` hold one file each per version, and `src/phone/Phone.tsx` is where the chosen one would be named.

The status bar and home indicator are the real phone's; the page only keeps clear of them. There is no screen saver on a phone.

To send someone the site as a single file they can open on a phone or in a browser, with all ten versions in it: `node tools/preview.cjs shrug.html`.

### Links

- `?open=portfolio,faqs` opens those windows as well as the group chat (on a phone, the last one named is open over the version being shown). Names: `chat`, `portfolio`, `faqs`, `case-studies`, `vip`.
- `?v=1` to `?v=10` picks the phone's version.
- `?saver` starts on the screen saver. `?idle=20` sets how many seconds of stillness start it. Desktop only.

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

Nothing leaves the page yet. A message typed into the group chat and an email given to the terminal (or, on a phone, to Niv in the conversation) are shown on screen and go nowhere. Wire them up in `src/apps/chat.ts` (`sendMessage`) and `src/apps/Terminal.tsx` (`answer`, which the phone's sheet calls too).

## Where things are

```
public/        the companies' logos (logos/), the wallpaper, and the link preview (og.png)
tools/         wallpaper.py draws the wallpaper; og.cjs takes the link preview;
               preview.cjs makes the site into one file to send
src/
  data/     the site's content
  os/       the desktop: window manager, menu bar, Dock, icons, screen saver
  apps/     one file per window, plus what windows and phone screens share
            (chat.ts: the chat's clock; chat-ui.tsx: the conversation;
            portfolio-ui.tsx: the companies and their logos; state.ts)
  phone/    the phone: its ten versions (variants/), the pages and sheets they
            share, and what a phone can do that a desktop can't (native.ts)
  styles/   base.css, os.css (the desktop), apps.css (the windows), phone.css,
            and a stylesheet per phone version (variants/)
  kit/      the Stageshow kit, copied in unmodified
```

- **Window behaviour** is in `os/wm.ts` (state) and `os/WindowFrame.tsx` (dragging, resizing, the lights).
- **A new window**: add it to `os/apps.ts`, write its component in `apps/`, list it in `os/Desktop.tsx`, and give it a screen in `phone/apps.tsx`.
- **The phone** is `phone/Phone.tsx` (which version is showing, and what is open over it), `phone/variants/` (the versions), `phone/apps.tsx` (the pages and sheets they open), `phone/nav.ts` (what is open, mirrored into history), `phone/ui.tsx` (pages, sheets, lists) and `phone/native.ts` (sharing, ticks, movement). The conversation that versions 2 and 3 are built on is `phone/convo.ts` (what is said and what each reply sets off), `phone/Thread.tsx` (its screen) and `phone/Shot.tsx` (a window of the Mac as a screenshot).
- **The wallpaper** is a picture, `public/wallpaper.webp`, drawn by `tools/wallpaper.py` (`python3 tools/wallpaper.py public/wallpaper.webp 2880 1800 86`; it needs numpy and Pillow), so the colours and shapes can be changed there. To use a photograph instead, put it in `public/` and set `--wallpaper: url('/wallpaper.jpg')` on `.os`.
- **The look** is a set of kit tokens on `.os` in `os.css`: accent, grays, type, window radius.

## The kit

`src/kit/` is a copy of the kit from the Stageshow skill in `.agents/skills/stageshow/`, with no changes, so it can be replaced with a newer copy. The kit's parts are drawn for scripted demos; here they are wrapped so they work as a real interface:

- The kit's `Window` draws the chrome. `WindowFrame` puts working traffic lights over the spot the kit keeps for them and adds dragging and resizing.
- The kit's `Thread`, `Bubble`, `Stamp` and `Receipt` draw the conversation, its typing dots and its bubbles leaving the field. `apps/chat-ui.tsx` lets it scroll and keeps it on the newest reply.
- The kit's `Row` and `Avatar` draw the list of conversations and the monograms.
- The kit's `Popover` draws the menus and the details. The menu bar adds the items, keyboard and focus handling.

The app icons, folder, document and wallpaper are drawn for this site; the group chat's icon is drawn after the Messages icon (a white speech bubble on green). No file from an operating system is used. The company logos belong to the companies.
