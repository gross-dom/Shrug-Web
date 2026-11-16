# Shrug Web

Shrug's website as a desktop you can click around: a macOS-style skin over the "Shrug desktop" design, built with the [Stageshow](https://github.com/benjitaylor/skills) kit's window chrome, message thread, rows and controls. On a phone it is an iPhone instead: the same apps, each redrawn as its iOS counterpart, with the kit's lock screen, notifications and message thread.

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

Below 760px wide (or 480px tall) the site is an iPhone, in the look of the current iOS. Everything on the desktop is there, redrawn as the thing an iPhone has in its place:

| On the desktop | On the iPhone |
| --- | --- |
| The screen saver | **The Lock Screen.** The time and date, and the group's replies arriving as notifications, stacked as iOS stacks a conversation's. Swipe up to open it, or tap a notification to go straight to the conversation. Left alone for two and a half minutes the phone locks again. |
| The desk, its icons and the Dock | **The Home Screen.** Three widgets (the newest reply, the portfolio, the FAQs), the icons, a Dock of the four main apps with the unread badge on Messages, and Search. |
| Group chat | **Messages.** The list of conversations (Shrug Family, then everyone's own, unread until opened), a conversation with its floating header and the message field, and the details sheet with Pause Replies, Show Every Reply and Play From the Start. |
| Portfolio (a Finder window) | **Files.** Every company under its logo, grouped by vertical, as icons or a list; a Browse tab of the verticals as folders; search; and a card for each company with its link. |
| FAQs (Notes) | **Notes.** The questions as a list of notes, and each note on its own page. |
| Case Studies (Terminal) | **A terminal**, with keys over the keyboard so nobody has to type to ask for access. |
| VIP (Photos) | **Photos.** The Library as a grid, the drops as albums under Collections, and a full-screen viewer to swipe through. |
| About Shrug | **About**, laid out as Settings lays out General › About: the counts, each opening its app. |
| Moving, minimising and closing windows | **The home indicator.** Swipe it up to go to the Home Screen; swipe up and pause for the App Switcher, where a tap goes to an app and a flick upward closes it. |
| A reply landing while another window is in front | **A banner** at the top of the screen. Tap it to open the conversation. |

- **On a real phone the phone is the frame.** The screen is drawn edge to edge under the phone's own status bar, and the browser's bars are painted to match what is showing. The home indicator at the foot is the site's own: the phone's is below the browser, and leaves it.
- **Anywhere else it is drawn inside an iPhone**: in a narrow window on a computer, or with `?phone` in the address at any size. The frame, the status bar, the island and the home indicator are the kit's `Phone`, at the real proportions. There, a field that takes the keyboard brings up the kit's iOS keyboard, and its keys pop as the computer's are typed.
- **Every move is a step in the browser's history.** Safari's swipe from the left edge (or an Android back button) is the phone's Back: it goes back a screen inside an app, closes a sheet, and leaves an app for the Home Screen. A reload comes back to where it was, unlocked.
- **Apps stay as they were left**, as they do on an iPhone, until they are flicked out of the App Switcher. An app that fails does what one does on an iPhone: it closes to the Home Screen and starts afresh next time; the rest of the phone carries on.
- **Turned on its side**, the apps reflow as apps do. A real iPhone keeps its Lock Screen and Home Screen upright; a page turns with the browser, so those two are laid out for the width instead, with the Dock down the trailing edge.
- **Small gray type is a shade darker than iOS's own** (in the conversation on the desktop too), so that it meets the contrast guidance. The blue is iOS's, which on white falls a little short of that guidance for small text, as it does on an iPhone.
- **Added to a phone's Home Screen** the site has Shrug's icon (`public/apple-touch-icon.png`, drawn by `tools/icons.cjs`) and still opens in the browser. Running it full screen from there is left off (`"display": "browser"` in `public/manifest.webmanifest`): in that mode the phone's status bar keeps one colour of ink, which can't be right over both the wallpaper and a white app. It also hasn't been tried on a real phone.
- **Search** (the pill above the Dock, or a pull down on the Home Screen) looks through the people, the companies, the questions and the drops, and opens the app at what was found.
- **The link preview** is the conversation's opening (`public/og.png`, taken by `tools/og.cjs`), so the address unfolds as the chat when it is texted.
- **Reaching Shrug for real** would need a number or an address in `SITE.contact` (`src/data/site.ts`); nothing on the phone uses one yet.

To send someone the site as a single file they can open on a phone or in a browser: `node tools/preview.cjs shrug.html`. Opened on a computer, the file shows the iPhone, with a button for the desktop.

### Links

- `?open=portfolio,faqs` opens those windows as well as the group chat (on a phone, it arrives unlocked with the last one named open). Names: `chat`, `portfolio`, `faqs`, `case-studies`, `vip`.
- `?phone` shows the iPhone whatever the size of the screen, drawn in its frame. `?phone=hand` draws it edge to edge instead, as a real phone gets it, for trying that layout in a browser on a computer.
- `?saver` starts on the screen saver (desktop only). `?idle=20` sets how many seconds of stillness start it, and lock the phone.

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

Nothing leaves the page yet. A message typed into the group chat and an email given to the terminal are shown on screen and go nowhere, on the desktop and on the iPhone alike. Wire them up in `src/apps/chat.ts` (`sendMessage`) and `src/apps/Terminal.tsx` (`answer`): the iPhone's Messages and terminal call the same two.

## Where things are

```
public/        the companies' logos (logos/), the wallpaper, and the link preview (og.png)
tools/         wallpaper.py draws the wallpaper; og.cjs takes the link preview;
               icons.cjs draws the Home Screen icons; preview.cjs makes the site
               into one file to send
src/
  data/     the site's content
  os/       the site's root (Desktop.tsx) and the desktop itself (Surface.tsx):
            window manager, menu bar, Dock, icons, screen saver
  apps/     one file per window, plus what windows and phone screens share
            (chat.ts: the chat's clock; chat-ui.tsx: the conversation;
            portfolio-ui.tsx: the companies and their logos; state.ts)
  phone/    the iPhone: the system (lock, home, switcher), the parts its apps
            are built from, and the apps themselves (apps/)
  styles/   base.css, os.css (the desktop), apps.css (the windows), phone.css
            (the iPhone's own screens), ios.css (the parts its apps share),
            and a stylesheet per iPhone app (phone/)
  kit/      the Stageshow kit, copied in unmodified
```

- **The desktop and the iPhone are separate downloads.** `os/Desktop.tsx` is the root and loads `os/Surface.tsx` (the desktop) or `phone/Phone.tsx` (the iPhone), whichever the screen shows; what they share (the conversation, the data, the kit) is loaded once. `os/Boundary.tsx` keeps a failure inside the window or app it happened in.
- **Window behaviour** is in `os/wm.ts` (state) and `os/WindowFrame.tsx` (dragging, resizing, the lights).
- **A new window**: add it to `os/apps.ts`, write its component in `apps/` and list it in `os/Surface.tsx`.
- **The iPhone** is `phone/system.ts` (locked or not, which app is in front, how far into each app, mirrored into history), `phone/Phone.tsx` (the screen: edge to edge on a real phone, in the kit's frame elsewhere), `phone/Springboard.tsx` (the Lock Screen, the Home Screen, apps opening out of their icons, the App Switcher, banners, the home indicator), `phone/ui.tsx` with `styles/ios.css` (what the apps are built from: screens with floating glass buttons and folding large titles, stacks of screens, grouped lists, tab and search bars, menus, sheets), and `phone/apps/` (one file per app; `routes.ts` names the screens inside them).
- **A new app on the iPhone**: write it in `phone/apps/` from the parts in `phone/ui.tsx`, name it in `phone/apps/index.tsx`, and put its icon on the Home Screen or in the Dock there.
- **The wallpaper** is a picture, `public/wallpaper.webp`, drawn by `tools/wallpaper.py` (`python3 tools/wallpaper.py public/wallpaper.webp 2880 1800 86`; it needs numpy and Pillow), so the colours and shapes can be changed there. To use a photograph instead, put it in `public/` and set `--wallpaper: url('/wallpaper.jpg')` on `.os`.
- **The look** is a set of kit tokens on `.os` in `os.css`: accent, grays, type, window radius.

## The kit

`src/kit/` is a copy of the kit from the Stageshow skill in `.agents/skills/stageshow/`, with no changes, so it can be replaced with a newer copy. The kit's parts are drawn for scripted demos; here they are wrapped so they work as a real interface:

- The kit's `Window` draws the chrome. `WindowFrame` puts working traffic lights over the spot the kit keeps for them and adds dragging and resizing.
- The kit's `Thread`, `Bubble`, `Stamp` and `Receipt` draw the conversation, its typing dots and its bubbles leaving the field. `apps/chat-ui.tsx` lets it scroll and keeps it on the newest reply.
- The kit's `Row` and `Avatar` draw the list of conversations and the monograms.
- The kit's `Popover` draws the menus and the details. The menu bar adds the items, keyboard and focus handling.
- The kit's `Phone`, `LockScreen` and `Notification` draw the iPhone's frame, its Lock Screen and its banners, and the kit's `Expand` is the zoom an app opens out of its icon with. `phone/Springboard.tsx` adds the gestures: the swipe that unlocks, the home indicator, the App Switcher.

The app icons, folder, document and wallpaper are drawn for this site; the group chat's icon is drawn after the Messages icon (a white speech bubble on green). No file from an operating system is used. The company logos belong to the companies.
