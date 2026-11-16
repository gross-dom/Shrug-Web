# Shrug Web

Shrug's website as a desktop you can click around: a macOS-style skin over the "Shrug desktop" design, built with the [Stageshow](https://github.com/benjitaylor/skills) kit's window chrome, message thread, rows and controls. On a phone it is one conversation instead, with the visitor in it.

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

Below 760px wide (or 480px tall) the site is not a phone drawn inside a phone. It is one conversation, and the visitor is in it: Niv adds you to Shrug Family, asks the group his question, and the ninety answer at the pace the desktop keeps. On the desktop you look over Niv's shoulder at his Mac; on a phone the messages are sent to you.

You get around by replying. Above the message field are the replies you might send; tap one, or type your own words. While you and Niv are talking the group holds on, and "keep the replies coming" brings them back.

| You say | Niv answers with |
| --- | --- |
| who’s in here? | How many, who they are, and a button to everyone in the group, each with what they said |
| show me the portfolio | A screenshot of the Portfolio window on his Mac. Tap it and it opens, laid out for a phone |
| i have questions | The FAQs become the replies to send, and each is answered in the conversation |
| can i see the case studies? | A screenshot of the terminal, and a request for your email, which you type into the message field |
| what’s a drop? | A screenshot of the VIP window, which opens as a photo library |
| send me the one-pager | The link, unfolded as Messages unfolds one |
| how do i reach you? | A button that opens the phone's real Messages or Mail with a first line written, and one that shares the site |

- **The screenshots are live.** Each is the desktop's own window, drawn at full size and scaled into a bubble (`src/phone/Shot.tsx`), so it is always the window as it stands.
- **Opening is a step in the browser's history**, so the phone's back gesture or button closes what is open, and a reload comes back to it.
- **A double tap loves a message**, and the button at the top right shares the site through the phone's own share sheet.
- **The link preview** is the conversation's opening (`public/og.png`, taken by `tools/og.cjs`), so the address unfolds as the chat when it is texted.
- **Reaching Shrug for real** needs a number or an address in `SITE.contact` (`src/data/site.ts`). Until then the conversation says so in its place.
- **Niv's lines** other than the two he opens with are placeholder copy, in `src/phone/convo.ts`.

The status bar and home indicator are the real phone's; the page only keeps clear of them. There is no screen saver on a phone.

### Links

- `?open=portfolio,faqs` opens those windows as well as the group chat (on a phone, the last one named is open over the conversation). Names: `chat`, `portfolio`, `faqs`, `case-studies`, `vip`.
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
tools/         wallpaper.py draws the wallpaper; og.cjs takes the link preview
src/
  data/     the site's content
  os/       the desktop: window manager, menu bar, Dock, icons, screen saver
  apps/     one file per window, plus what windows and phone screens share
            (chat.ts: the chat's clock; chat-ui.tsx: the conversation;
            portfolio-ui.tsx: the companies and their logos; state.ts)
  phone/    the phone: the conversation, what opens out of it, and its sheets
  styles/   base.css, os.css (the desktop), apps.css (the windows), phone.css
  kit/      the Stageshow kit, copied in unmodified
```

- **Window behaviour** is in `os/wm.ts` (state) and `os/WindowFrame.tsx` (dragging, resizing, the lights).
- **A new window**: add it to `os/apps.ts`, write its component in `apps/`, list it in `os/Desktop.tsx`, and give it a screen in `phone/apps.tsx`.
- **The phone** is `phone/convo.ts` (the conversation: what is said, in what order, and what each reply sets off), `phone/Thread.tsx` (the conversation's screen), `phone/Shot.tsx` (a window of the Mac as a screenshot), `phone/apps.tsx` (what the screenshots open into, and the sheets), `phone/nav.ts` (what is open, mirrored into history) and `phone/ui.tsx` (pages, sheets, lists).
- **The wallpaper** is a picture, `public/wallpaper.webp`, drawn by `tools/wallpaper.py` (`python3 tools/wallpaper.py public/wallpaper.webp 2880 1800 86`; it needs numpy and Pillow), so the colours and shapes can be changed there. To use a photograph instead, put it in `public/` and set `--wallpaper: url('/wallpaper.jpg')` on `.os`.
- **The look** is a set of kit tokens on `.os` in `os.css`: accent, grays, type, window radius.

## The kit

`src/kit/` is a copy of the kit from the Stageshow skill in `.agents/skills/stageshow/`, with no changes, so it can be replaced with a newer copy. The kit's parts are drawn for scripted demos; here they are wrapped so they work as a real interface:

- The kit's `Window` draws the chrome. `WindowFrame` puts working traffic lights over the spot the kit keeps for them and adds dragging and resizing.
- The kit's `Thread`, `Bubble`, `Stamp` and `Receipt` draw the conversation, its typing dots and its bubbles leaving the field. `apps/chat-ui.tsx` lets it scroll and keeps it on the newest reply.
- The kit's `Row` and `Avatar` draw the list of conversations and the monograms.
- The kit's `Popover` draws the menus and the details. The menu bar adds the items, keyboard and focus handling.

The app icons, folder, document and wallpaper are drawn for this site; the group chat's icon is drawn after the Messages icon (a white speech bubble on green). No file from an operating system is used. The company logos belong to the companies.
