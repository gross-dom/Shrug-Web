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

The build writes more than the app: the site in plain words inside the page itself, the link preview's tags, `robots.txt`, `sitemap.xml`, `llms.txt` and `404.html`, all from the data in `src/data/` (`tools/page.ts`). They carry the address the build is served from: on Vercel the project's own (its domain once it has one, its `vercel.app` address until then), so that a link to it unfolds with a picture that is there to fetch; anywhere else `SITE.url` in `src/data/site.ts`, or whatever `SITE_URL=https://… npm run build` says.

It is deployed on Vercel as the project `shrug-web`, at https://shrug-web.vercel.app: `npx vercel deploy --prod` from this folder puts up what is in it (`vercel.json` has the settings: files under `/assets/` cached for good, and a `noindex` header on any `*.vercel.app` address, so that only the site's own domain is indexed once it has one). Connecting the GitHub repository in Vercel's project settings would deploy every push instead.

Any other static host will do too. It should compress what it serves, may cache `/assets/` for good (those names change with their contents) and should not cache `index.html`. For an address it does not have it can serve either `404.html` or `index.html`: both send `/portfolio` and the like to that app. The page starts with a few lines of script and style written into it (the loading screen, and asking early for what it needs), so a Content-Security-Policy, if the host sets one, has to allow them.

## What's on the desktop

| Window | In the Dock as | What it holds |
| --- | --- | --- |
| Group Chat | Group Chat | Shrug's own Messages. Shrug asks the group (“Testimonials”) what it's like to work with them, and 89 people reply. |
| Portfolio | Portfolio (the Finder's face) | Every company under its logo, in Shrug's own order or by vertical, as icons or a list, with search, Back/Forward and a preview of the one selected. |
| FAQs | FAQs (a notes app's icon) | Each question as a note, with Shrug's answer. |
| Case Studies | Case Studies | A terminal that lists the case studies, links the two that are public, and says how to ask for the rest. |
| VIP | VIP (a black tile, VIP in white capitals) | Photos and videos from the drops in one grid: all of them, the photos or the videos. |
| About Shrug | (the menu bar's mark) | Who Shrug is, in a sentence and a few facts (when it started, its partners, which fund this is, what it backs), and counts taken from the data, each opening what it counts. |

Windows drag by their bar, resize from any edge or corner, and close, minimize and zoom from their traffic lights. Drag one against the left, right or top edge to tile it, or rest the pointer on the green light for the same choices. A window keeps the place the visitor gave it: when the browser shrinks it is fitted in, and when the room comes back so does the window. A reload brings the desk back as it was left: which windows are open and where, which is in front, which are in the Dock, and what each is showing (kept for the tab, `src/os/deskmemory.ts`; a visit beginning starts as any visit does).

- **With a keyboard**: everything is reachable with Tab, the arrow keys, Return and Escape. F6 steps between the menu bar, the window in front and the Dock; with a window focused, Alt and the arrows move it and Alt, Shift and the arrows size it. Focus goes into whatever opens and back to what opened it when it closes.
- **With a finger** (an iPad, a touch laptop): one tap opens anything; the lights, the menus and the window's edges are finger-sized wherever a touch screen is present; holding the green light shows the tiling choices.
- **The desktop's icons** open on a second click (or Return), as well as a double-click.
- **The Dock** spaces its icons as a Mac's does, and after its rule keeps the one-pager, drawn as a sheet of paper as tall as the app icons. A count on an icon is a red circle, as iOS and macOS draw one (it widens only for two digits or more).
- **A notification** drops in at the top right corner when a reply lands while the conversation is not the window in front: who it is from, the group's name and how the reply begins. One at a time, a few seconds each, and it waits while the pointer is on it; pressed, it opens the conversation at that reply (`src/os/Notifications.tsx`).
- **The shrug emoticon** is the menu bar's mark, top left, and is nowhere else on the site: not in the tab's title, About Shrug, the screen saver or the conversation. Everywhere else Shrug is its logo (`src/data/logo.ts`).
- **The screen saver** starts after two and a half minutes of stillness, or from the mark's menu, where it can also be set to Never (remembered). It waits while the conversation is still arriving in a window that is showing. Any key, a click, a tap or a movement wakes it, and that key or tap does nothing else.
- **The page's title** names the window in front.

### The group chat

It is laid out as an iMessage group conversation, seen from Shrug's side:

- Shrug's messages are the blue bubbles on the right. The script types them into the message field and sends them, so each bubble leaves the field the way a sent message does, and "Delivered" sits under the last one.
- Everyone else is gray on the left, with their name and role over the bubble and their initials beside it.
- The sidebar is the list of conversations: the group (“Testimonials”) and, under it, a few easter eggs. The 89 replies are in the group and nowhere else. Each row's name and last message are centred on its picture. Away from the group its row is marked when replies come in, and the Dock's badge counts them until it is opened again. Search finds the conversations, and the people in the group by name, role or what they said; a person found goes to their reply.
- Shrug's question is typed and sent within about three seconds of arriving, and the first reply is in a second after that. Then every reply keeps the same time: its typing dots, the message, a breath, the next, a little over one a second. It never speeds up. The pace is `WRITING` and `BETWEEN` in `src/apps/chat.ts`.
- Nobody has to wait for them all: while replies are still arriving, **Load all 89 replies** sits at the head of the thread. It brings in every reply at once and leaves the reader where they were, with a count of what is new below them and the way down to the newest.
- A thread that is put away while replies arrive (its window closed or minimised) is not drawn into while it cannot be seen, and is laid out afresh when it is shown again. (The kit measures a bubble as it lands, and one that lands out of sight would measure as nothing: the thread once came back with a screen of empty space under it.) A window that was closed opens again on the newest reply, wherever it had been scrolled to; one that was only minimised comes back where the reader was, with the count of what is new.
- The name in the bar, or the Details button, opens the details: pause the replies, show them all, play it again, and everyone in the group. A person there opens their card, with Show in Testimonials.
- The easter eggs are short conversations of Shrug's own (Akash Nigam late at night, an unknown number, a drop on its way), in `src/data/eggs.ts`: edit them, add to them or take them out there.
- The plus beside the field opens the rest of the site.
- Anything a visitor types is sent the way a message is: a blue bubble that leaves the field, with “Delivered” under the last of them. It is a picture of delivery: nothing is sent anywhere and nobody replies.
- After the last reply the conversation simply ends. There is no sign-off, and no links are left at its foot.
- A reload (or a tab a phone threw away and brought back) picks the conversation up where it was: the replies that had come in, what the visitor typed, and what had been read. Play From the Start starts it over.
- A screen reader is told when the first reply lands and then every tenth; each message is read as who, then what.
- With reduced motion set, the conversation is all there at once, opened at its top.

### On a phone

Below 740px wide (or 480px tall) the site is an iPhone, in the look of the current iOS (every tablet is wide enough to be a desktop, both ways up). Everything on the desktop is there, as the app an iPhone has in its place, under that app's own name and icon and laid out the way that app is. Case Studies and VIP are Shrug's own, and keep their names and their icons:

| On the desktop | On the iPhone |
| --- | --- |
| The screen saver | **The Lock Screen.** The time, set in glass as the current iOS sets it and at the size an iPhone draws its own (its figures a little under a fifth of the screen's width tall, in the type's own proportions), under the date (“Wed 18 Nov”), and the group's replies arriving as notifications, stacked as iOS stacks a conversation's. Swipe up to open it, or tap a notification to go straight to the conversation; a tap anywhere lifts it and says how, and a second tap opens it. There is no torch and no camera. Left alone for two minutes the phone locks again, though never under someone reading a note or a conversation. |
| The desk, its icons and the Dock | **The Home Screen.** The newest reply as a Messages widget; two folders, Portfolio and FAQs, as an iPhone has folders (frosted glass with a little of what is inside showing through, the name underneath); the icons (Case Studies, the one-pager and VIP); a Dock of Messages, Contacts and Notes, in a tray of frosted glass that the wallpaper shows through; and Search. The badge on Messages counts the replies as they come in. |
| Group chat | **Messages.** The list of conversations (Testimonials, then the easter eggs), a conversation with its floating header and the message field, and the group's details sheet with Pause Replies, Show Every Reply, Play From the Start and everyone in it. Load all 89 replies is at the head of the thread here too. |
| Portfolio (a Finder window) | **Contacts.** One list, as Contacts keeps people: at its head Shrug's own card, where My Card is; then a section to a vertical, where Contacts has one to a letter, each company a row under its own logo; and down the trailing edge the index of letters, which are the verticals'. A vertical is filed under the letter its name begins with, the sections run in that order as everything in Contacts does, and Other comes last under #; inside a vertical the companies keep Shrug's order. A letter pressed (or a finger slid along the index) brings its vertical up under the bar, and a letter with nothing under it brings up the next that has. A company opens as a contact's card does, pushed over the list: its logo and name, what can be done (its website, passing it on), and what is known (the site, the vertical, what it does). Search is at the foot of the list. |
| FAQs (Notes) | **Notes.** It opens inside the FAQs folder: the questions as notes, grouped by date the way Notes groups them, each opening on its own page. Back leads out to Folders. Search is at the foot, and the compose button starts a note of the visitor's own, which is kept for the visit and sent nowhere. |
| Case Studies (Terminal) | **A terminal**, with keys over the keyboard so nobody has to type. It answers `help`, `ls`, `open portfolio` and the like, links the two public case studies and says how to ask for the rest. |
| VIP (Photos) | **VIP.** An app of its own, under the black tile it has on the desktop, and laid out the way Photos' library is: one grid, with Photos' Sort and Filter menu, and a full-screen viewer to swipe through, with Favorite and Info. Nothing else: no tabs, collections, albums or search. A picture that has not come in yet is a quiet tile with its drop's name. |
| About Shrug | Nothing: the phone has no Settings app. What Settings would have set is fixed (`src/phone/settings.ts`: replies are announced with what they say, the phone locks after two minutes); pausing the replies is in the conversation's details. |
| Moving, minimising and closing windows | **The home indicator.** Swipe it up to go to the Home Screen; swipe up and pause (or press and hold) for the App Switcher, where a tap goes to an app and a flick upward, its ×, or Delete closes it. |
| A reply landing while another window is in front | **A banner** at the top of the screen. Tap it to open the conversation. |

- **On a real phone the phone is the frame.** The screen is drawn edge to edge, under the phone's own status bar and down to its foot. Safari paints the bar above the page and the bar below it itself, each in one colour that it reads from the page (it will not put a picture there). So the page hands it both: a strip of colour fixed along the top edge of the screen and another along the foot, each in the colour of what is showing there (`src/phone/edges.ts`, drawn by `Phone.tsx`), and the wallpaper is brought to those same two colours at its own edges. The strips are made to the measure WebKit takes of one before it will use its colour (fixed, the screen across, more than 10px deep, solid, and lying over the point 4px in from the middle of the edge: the rule is in WebKit's `LocalFrameView::fixedContainerEdges`, and is written out beside the strips in `styles/phone.css`). Over the wallpaper the bars are then its own top and its own foot; over an app they are the app's ground; under a sheet they are the shade behind it. The home indicator at the foot is the site's own: the phone's is below the browser, and leaves it.
- **An app opens the way one does on an iPhone**: out of its icon (or the widget or notification that was pressed), whole from the first moment and growing to fill the screen, in a little over a third of a second; putting it away is the same in reverse (`src/phone/Zoom.tsx`). Nothing is uncovered from the top down. Screens, sheets, folders and search keep to the same short times.
- **Anywhere else it is drawn inside an iPhone**: in a narrow window on a computer, or with `?phone` in the address at any size. The frame, the status bar, the island and the home indicator are the kit's `Phone`, at the real proportions. There, a field that takes the keyboard brings up the kit's iOS keyboard, and its keys pop as the computer's are typed. Where a window cannot hold the frame at about two thirds of its size or more (a short window, or a laptop zoomed to 200%), the phone is drawn edge to edge instead, so nothing is cut off and zooming makes the type larger; a window too small even for that gets a Home Screen that scrolls.
- **The badge on Messages counts what is new.** It starts at nothing, ticks up with each reply that comes in to the group, and is cleared by reading the conversation, as a badge is on an iPhone. The number beside Back inside an easter egg is the same count (`useNewReplies` in `src/apps/state.ts`; the desktop's Dock counts the same way).
- **Out of the conversation, the replies come a little quicker**: about one every 0.8 seconds in place of 1.2, and the first of them sooner. On the Lock Screen and the Home Screen a reply is a notification or a line in the widget, with no message field to watch being typed into and no dots to watch being written, so those waits are cut short (`UNSEEN` in `src/apps/chat.ts`). Open the conversation and it keeps the desktop's time.
- **A folder opens where it is**, as one does on an iPhone: the Home Screen falls out of focus behind it and it grows into a larger piece of glass with its name over it. Portfolio shows the companies nine to a page, each under its logo the way a folder holds apps, and turns sideways; FAQs lists the questions, and scrolls where the ten of them do not fit. Picking one opens it in its app (a company at its card in Contacts; a question in Notes), and a tap outside, the home bar or the browser's back closes the folder (`src/phone/Folder.tsx`). The strip of dots under Portfolio's pages steps back and on from its left and right halves. The folders are large wherever they fit; on a shorter screen they are icon-sized folders among the icons, and only on a very short one are they left off (Contacts and Notes are in the Dock).
- **Every move is a step in the browser's history.** Safari's swipe from the left edge (or an Android back button) is the phone's Back: it goes back a screen inside an app, closes a sheet, and leaves an app for the Home Screen. Search and the App Switcher are steps too, so Back closes them. A reload comes back to where it was, unlocked, with what the visitor had made: their notes and folders, their favourites in VIP, and the conversation as far as it had got (kept in the browser for the tab; nothing is sent anywhere).
- **While something is opening, closing or sliding, presses on what is under it are ignored**, as on an iPhone, so a double tap does what one tap does.
- **A change of layout keeps the visitor's place.** Turn a tablet, drag a window across the line, or open a split view, and the app that was in front is in front in the other layout, on the same conversation, company or question, with no Lock Screen in between (`src/os/crossing.ts`). A keyboard that shortens the page is not a change of layout.
- **Apps open where an iPhone would have left them**: Notes inside FAQs, one step in from its first screen, with Back leading out; Contacts on its list. A company's card that is come to from outside the app (search, the Home Screen's folder, a link) is over a list brought to that company, so Back finds it among its own. After that they stay as they were left, as they do on an iPhone, until they are flicked out of the App Switcher. An app that fails does what one does on an iPhone: it closes to the Home Screen and starts afresh next time; the rest of the phone carries on.
- **Turned on its side**, the apps reflow as apps do. A real iPhone keeps its Lock Screen and Home Screen upright; a page turns with the browser, so those two are laid out for the width instead, with the Dock down the trailing edge.
- **Small gray type is a shade darker than iOS's own** (in the conversation on the desktop too), so that it meets the contrast guidance. The blue is iOS's, which on white falls a little short of that guidance for small text, as it does on an iPhone.
- **Added to a phone's Home Screen** the site has Shrug's icon (`public/apple-touch-icon.png`, drawn by `tools/icons.cjs`) and still opens in the browser. Running it full screen from there is left off (`"display": "browser"` in `public/manifest.webmanifest`): in that mode the phone's status bar keeps one colour of ink, which can't be right over both the wallpaper and a white app. It also hasn't been tried on a real phone.
- **Search** (the pill above the Dock, or a pull down on the Home Screen) looks through the people who have replied so far, the companies, the questions, the drops, the apps under either of their names (Contacts is also "portfolio", Notes is "faqs") and the one-pager, and opens the app at what was found. "contact", "email" and the like find the way to Shrug. With nothing found there are still two things to press: the one-pager, and Ask in Messages. While it is up the Home Screen falls away almost to nothing behind it, so its white type reads over anything.
- **The link preview** is the conversation's opening (`public/og.png`, taken by `tools/og.cjs`), so the address unfolds as the chat when it is texted.
- **The page's title** names the screen (the conversation, the company, the app), so each step in the browser's history, and a screen reader arriving, says where it is.

To send someone the site as a single file they can open on a phone or in a browser: `node tools/preview.cjs shrug.html`. Opened on a computer, the file shows the iPhone, with a button for the desktop.

### Arriving, and when it goes wrong

Whatever happens on the way in, there is something on screen and a way on.

- **While it loads**: the mark and a bar on the dark ground, in place of an empty page (nothing is drawn at all if the site arrives within half a second). After ten seconds it says it is still loading and offers the one-pager; after thirty it offers another go. It is plain HTML and CSS in `index.html`, so it is there before any script.
- **If a script or stylesheet does not arrive**, or arrives and cannot run: "Shrug didn’t load", with Try Again, the one-pager and the plain version.
- **In a browser too old to draw the site** (it needs `:has()`, `color-mix()`, container units and `inert`: Safari 16.4, Chrome 111, Firefox 121, or newer): "Shrug needs a newer browser", with the one-pager and the plain version, and Continue Anyway if the site did manage to start underneath.
- **The plain version** is the site in plain words: who Shrug is, twelve of the testimonials, every company with its link and line, the answered FAQs, the one-pager. It is written into `#root` at build time from the data, so it is what a browser with scripts off shows, what a search engine or a link preview reads, and what the two cards above uncover. The site replaces it when it starts. `llms.txt` is the same in full, as text.
- **The desktop and the iPhone are separate downloads**, and the page asks for the one its screen needs alongside the first script. The other is fetched once things are quiet, so a turned tablet or a narrowed window has it to hand. If it still cannot be had (the connection has gone, or a new version of the site has replaced the files), a card says so over the wallpaper, tries again by itself when the connection returns, and never trades itself for the browser's own error page; going back to the size that was working brings that layout back.
- **Phones fetch only what a phone shows** (not the desktop's wallpaper), and where Apple's own type is not installed the site's is asked for at once and never swapped in under a reader.

### Links

- `?open=portfolio,faqs` opens those windows as well as the group chat (on a phone, it arrives in the last one named, already unlocked; `chat` arrives in the conversation itself). Names: `chat`, `portfolio` (or `contacts`; `wallet` and `files`, which it has been, still open it), `faqs` (or `notes`), `case-studies`, `vip` (or `photos`), `about` (or `settings`). About Shrug is the desktop's: a phone asked for it opens on its Home Screen.
- **The address follows the visitor.** On both layouts it names where they are: the app, and the company, question or conversation open in it (`?open=portfolio&at=eight-sleep`, `?open=faqs&at=4`, `?open=chat&at=drops`). The iPhone writes it with each step it takes through history, the desktop as its front window changes, so the link in the address bar, or one passed on with Share, opens there. Whatever else the address carries (`?phone`, `?draft`) is left as it was (`src/os/place.ts`). The desk as a visit finds it, the Lock Screen and the Home Screen are the site's plain address. (VIP is one grid, so its address is just `?open=vip`; an older link that names a drop opens VIP.)
- Addresses are read forgivingly (`src/os/address.ts`): the switches answer in any case (`?OPEN=Portfolio`), names can be set apart with commas, semicolons, plus signs or spaces, a path or a hash names an app too (`/portfolio`, `#faqs`), and a switch can be turned off (`?phone=0`). On a host that serves `404.html` for an address it does not have, that page sends `/portfolio` and the like to the app and anything else to the site.
- `?phone` shows the iPhone whatever the size of the screen, drawn in its frame. `?phone=hand` draws it edge to edge instead, as a real phone gets it, for trying that layout in a browser on a computer.
- `?saver` starts on the screen saver (desktop only). `?idle=20` sets how many seconds of stillness start it, and lock the phone.
- `?draft` is the editor's view: what Shrug has still to supply (a VIP picture, or an FAQ's answer should a question be added without one) is drawn as the note that says so. Without it a visitor is shown a line written for them (see Content).

## Content

Everything on the site comes from `src/data/`. `site.ts` holds the facts that are said in more than one place: the name, the address, the one-pager, one sentence on what Shrug is (`SITE.line`: under the name in About Shrug, and what a search engine and a link preview read; the one there now says no more than the testimonials do, and Shrug's own sentence belongs in its place), the few facts About Shrug gives (`ABOUT`, each of them said in the FAQs), and how to reach Shrug (`SITE.contact`). `logo.ts` is Shrug's logo as a shape, which the icons, the loading screen and the link preview all draw.

| File | What it holds | Where it came from |
| --- | --- | --- |
| `people.ts` | The 89 people, their roles and their quotes | Names and roles from the design; each quote is that person's testimonial as published on shrug.vc |
| `eggs.ts` | The easter-egg conversations in Messages | Written for this site; Akash Nigam's is worded by Shrug |
| `portfolio.ts` | The companies, in Shrug's own order, each with its vertical, a link, a one-line description and a logo | The names and their order are Shrug's list; verticals from the design; links and descriptions from shrug.vc's portfolio page |
| `public/logos/` | One 144px tile per company | Each company's own site icon |
| `faqs.ts` | The ten questions and Shrug's answers to them | Shrug's own FAQs |
| `drops.ts` | The drops | The design |

Still to come. A visitor never reads a note written for Shrug: until a thing is supplied they get a line written for them and a way on, and the editor's note shows only with `?draft` in the address.

| File | Missing | What a visitor sees until then | With `?draft` |
| --- | --- | --- | --- |
| `site.ts` | A way to reach Shrug (`contact.email` or `contact.sms`) | Every place that would offer it offers the one-pager instead | The same |
| `site.ts` | Shrug's own sentence (`line`) | "Shrug Capital is an early-stage venture fund." | The same |
| `faqs.ts` | Nothing now. A question added with `answer: null` | "Shrug hasn’t written this one down yet.", with the one-pager; "Answer on its way" in the list | The bracketed slot from the design |
| `eggs.ts` | Shrug's own words for the other two easter eggs | Short conversations written as placeholders | The same |
| `drops.ts` | Every photo and video (`src`, `from`) | A quiet tile with the drop's name; "On its way" when opened; nothing counted that is not there | "Photo slot" and "Video slot" tiles |
| `portfolio.ts` | 10 logos (`logo: null`) | The company's initial on a gray tile | The same |
| `portfolio.ts` | A line for the seven companies with no site (`NOTES`: "Acquired by …") | "No website listed" where the link would be | The same |

Fill in a field and the real thing replaces its placeholder; nothing else needs to change. To add a logo, put a square image in `public/logos/` and name it in the company's entry.

**Reaching Shrug.** `reach()` in `site.ts` is the one way to Shrug everything uses: an email if `SITE.contact.email` is set, a text if `contact.sms` is, and with neither the one-pager. The day an address is written there, these all use it with no other change: the terminal (`y` opens a message asking for access), an FAQ with no answer yet, About Shrug (a link to write appears beside the one-pager), and search ("contact", "email").

**To check from a machine that can reach them:** 60 of the companies' links are `http://`, as shrug.vc's portfolio page has them. They were left so because they could not be tried from where this was built, and a wrong `https://` is a dead link where a browser would have upgraded the `http://` one itself. Two testimonials have slips to check against their authors' own text (Ashton Kutcher: "a entrepreneurs mind"; Maggie Norris: "a trusted sounding board and mentors"), and `caseStudies.ts` lists Feastables, which is not among the 81 companies.

The 10 companies without a logo are RTFKT, Cloud23, Opal, Mona Lee Solar, BloxSnacks, Loyal, Drumroll, Poparazzi, YOLO and Sprinter: their sites have no icon the two icon services could find, or serve one that isn't their logo (a host's default, a parked page, an emoji, a placeholder), and no site could be confirmed for Drumroll. Lula's is the icon of lula.com, which a funding profile gives as its address; the Shrug page links only to its case study. About a quarter of the other logos come from small icons (32 to 48px) and are soft at the preview's size; a proper logo file replaces any of them the same way.

Nothing leaves the page. A message typed into the group chat is shown on screen, marked Delivered, and goes nowhere, on the desktop and on the iPhone alike, and the terminal no longer asks for an email it has nowhere to send. What a visitor makes (their notes, favourites, drafts, how far the conversation had got) is kept in their own browser so that a reload does not lose it, and is sent nowhere. The site does not say so anywhere itself now (the iPhone's Settings did, under Privacy, and has gone with the app): if it stops being true, analytics added by a host included, it will need saying somewhere.

## Where things are

```
index.html     the page: the loading screen (and what it says when the site
               cannot be drawn), and the marks tools/page.ts writes at
public/        the companies' logos (logos/), the wallpaper, the link preview
               (og.png) and the icons
tools/         page.ts writes the plain page, the link preview's tags, robots.txt,
               sitemap.xml, llms.txt and 404.html from the data, and has the
               built page ask early for what it needs; wallpaper.cjs makes the
               wallpaper from its drawing (wallpaper.svg, wallpaper-phone.svg),
               with wallpaper.py for its grain; og.cjs takes the link preview;
               icons.cjs draws the icons; preview.cjs makes the site into one
               file to send
tests/         the checks the audit ran, and a runner for them (tests/README.md)
docs/          audit.md: what the audit found and what became of each finding
src/
  data/     the site's content
  os/       the site's root (Desktop.tsx: which layout, arriving, and the card
            for when half of the site cannot be had, Stalled.tsx), what the two
            layouts share (crossing.ts: keeping the place across a change of
            layout; address.ts: what the address asks for; place.ts: the
            address that follows the visitor; deskmemory.ts: the desk kept
            for a reload; focus.ts, title.ts, dates.ts) and the desktop itself
            (Surface.tsx): window manager, menu bar, Dock, icons, notifications,
            screen saver
  apps/     one file per window, plus what windows and phone screens share
            (chat.ts: the chat's clock; chat-ui.tsx: the conversation;
            portfolio-ui.tsx: the companies and their logos; answer.tsx: an
            FAQ's answer, drawn; state.ts)
  phone/    the iPhone: the system (lock, home, switcher), how an app opens
            (Zoom.tsx), the colours at the screen's edges (edges.ts), the parts its
            apps are built from, and the apps themselves (apps/)
  styles/   base.css, os.css (the desktop), apps.css (the windows), phone.css
            (the iPhone's own screens), ios.css (the parts its apps share),
            a stylesheet per iPhone app (phone/), and access.css (forced
            colours, and the kit's parts under reduced motion)
  kit/      the Stageshow kit, copied in unmodified
```

- **The desktop and the iPhone are separate downloads.** `os/Desktop.tsx` is the root and loads `os/Surface.tsx` (the desktop) or `phone/Phone.tsx` (the iPhone), whichever the screen shows; what they share (the conversation, the data, the kit) is loaded once. `os/Boundary.tsx` keeps a failure inside the window or app it happened in.
- **Window behaviour** is in `os/wm.ts` (state) and `os/WindowFrame.tsx` (dragging, resizing, the lights).
- **A new window**: add it to `os/apps.ts`, write its component in `apps/` and list it in `os/Surface.tsx`.
- **The iPhone** is `phone/system.ts` (locked or not, which app is in front, how far into each app, mirrored into history), `phone/Phone.tsx` (the screen: edge to edge on a real phone, in the kit's frame elsewhere), `phone/Springboard.tsx` (the Lock Screen, the Home Screen, the App Switcher, banners, the home indicator), `phone/Zoom.tsx` (an app opening out of its icon and going back into it), `phone/edges.ts` (the colours along the top and foot of the screen, which a phone's browser paints its bars with), `phone/ui.tsx` with `styles/ios.css` (what the apps are built from: screens with floating glass buttons and folding large titles, stacks of screens, grouped lists, search bars, an index down a screen's edge, menus, sheets), `phone/apps/` (one file per app; `routes.ts` names the screens inside them), `phone/icons.tsx` (the app icons) and `phone/settings.ts` (how the phone behaves where an iPhone would ask its owner; there is no Settings app, so these are fixed).
- **A new app on the iPhone**: write it in `phone/apps/` from the parts in `phone/ui.tsx`, name it in `phone/apps/index.tsx`, draw its icon in `phone/icons.tsx`, and put it on the Home Screen or in the Dock (`DOCKED`, `ON_HOME`).
- **The wallpaper** is a picture, `public/wallpaper.webp` for the desktop and `public/wallpaper-phone.webp` for the iPhone, made from a drawing: `tools/wallpaper.svg` and `tools/wallpaper-phone.svg` (Shrug's own, a sky that runs from near-black at the top to a pale blue at the foot). To change it, change or replace the drawings and run `node tools/wallpaper.cjs`: it draws each at the size it is shown and gives it a fine grain, so that the long gradients do not band once the picture is compressed (it needs Playwright, and Python with numpy and Pillow). `tools/wallpaper.py` adds that grain, and can still draw the four wallpapers the site had before (`glass`, `sheets`, `dusk` and `present`: `python3 tools/wallpaper.py public/wallpaper.webp 2880 1800 86 glass`). The colours that follow the wallpaper are the fallbacks under it in `os.css` and `phone.css`, the two colours the phone's wallpaper is faded to at its top and foot in `phone.css`, and `WALLPAPER_TOP`, `WALLPAPER_FOOT` and `WALLPAPER_DIMMED` in `src/phone/chrome.ts` (what a phone's browser is given to paint its bars with over the Lock Screen and Home Screen): a new wallpaper needs all of them brought to its own top and foot. The loading screen keeps the site's own dark, and `theme-color` in `index.html` is that ground's. To use a photograph instead, put it in `public/` and set `--wallpaper: url('/wallpaper.jpg')` on `.os`.
- **The look** is a set of kit tokens on `.os` in `os.css`: accent, grays, type, window radius.
- **Dates and times** are written in English whatever the browser's language, with the visitor's own clock, 12 hours or 24 (`os/dates.ts`: every formatter comes from there). The date in the menu bar and on the Lock Screen is the short one, weekday first: Wed 18 Nov.
- **The focus ring** is one rule in `base.css`: the accent, solid. A surface it would not show against (the wallpaper, the Dock, a dark window) sets `--ring: #fff`.

## Accessibility

- **Keyboard.** Both layouts work without a pointer. Menus and lists answer the arrow keys; sheets, folders, menus and the screen saver hold the keyboard while they are up and give it back to what opened them. A page that is only read (an FAQ's answer, in the window and on the phone) takes the keyboard itself, so that the arrows and Page Down scroll a long one. The iPhone has two buttons only a keyboard or a screen reader meets, Home Screen and App Switcher, which show when they have focus.
- **Screen readers.** The page's title names the place; every screen has a heading; the conversation reads as who then what, and says when replies have come in without reading out all 89 of them.
- **Time.** Nothing on the site times out for good: the screen saver can be set to Never and waits for the conversation; the phone locks itself after two minutes but never under a reader, and opens again where it was at a tap or a key; replies can be paused from the conversation's details and from the mark's menu.
- **Reduced motion.** Nothing zooms, slides or glides; the conversation arrives whole.
- **Forced colours** (Windows High Contrast): edges, states and controls are drawn in the system's colours (`styles/access.css`).
- **Zoom.** The desktop holds together to 200% on a laptop; past that the site is the iPhone, drawn edge to edge, which reflows.
- **Contrast.** Small gray type is a shade darker than the systems' own so that it passes; iOS's blue on white falls a little short for small text, as it does on an iPhone.

## What it was tested on

In November 2026 seven testers went over the whole site, each as a different visitor, and what they found was fixed: `docs/audit.md` is the record, finding by finding. The checks they wrote are in `tests/` (`sh tests/all.sh` builds the site and runs them all: see `tests/README.md` for what that needs).

Playwright's Chromium at every size from 280px phones to a 4K desktop, with touch, with a keyboard only, slowed down, throttled to 3G, offline, with scripts off, with reduced motion and with forced colours; and WebKitGTK (Safari's engine) for the things engines differ on. Not on real iPhones, Androids or iPads, not in Firefox, and not with a real screen reader: what a real device adds (its keyboard, its safe areas, its own gestures) is emulated or argued in the code's comments.

Since the audit the site has been reworked three times from Shrug's notes: the new wallpaper, logo and FAQs; the portfolio on the phone as Contacts (after Files, and then a Wallet); a quicker conversation with Load all and Delivered; notifications on the desktop; glass on the Lock Screen and the Dock; the phone drawn to the top and foot of the screen; no Settings app; VIP as one grid. The checks were brought up to date with each change and pass in Chromium. The passes in Safari's engine were rewritten to match but could not be run where that work was done, and none of it has been looked at on a real iPhone. Four things there can only be judged on one: how Safari paints its bars from the strips of colour at the screen's edges (the whole of "full bleed"), how the glass reads over the wallpaper, how quick an app feels to open, and whether the Lock Screen's clock sits and measures as the phone's own does (it is set from the proportions of an iPhone's clock, not from a measurement of one: `styles/phone.css` says what they are).

## The kit

`src/kit/` is a copy of the kit from the Stageshow skill in `.agents/skills/stageshow/`, with no changes, so it can be replaced with a newer copy. The kit's parts are drawn for scripted demos; here they are wrapped so they work as a real interface:

- The kit's `Window` draws the chrome. `WindowFrame` puts working traffic lights over the spot the kit keeps for them and adds dragging and resizing.
- The kit's `Thread`, `Bubble`, `Stamp` and `Receipt` draw the conversation, its typing dots and its bubbles leaving the field. `apps/chat-ui.tsx` lets it scroll and keeps it on the newest reply.
- The kit's `Row` and `Avatar` draw the list of conversations and the monograms.
- The kit's `Popover` draws the menus and the details. The menu bar adds the items, keyboard and focus handling.
- The kit's `Phone`, `LockScreen` and `Notification` draw the iPhone's frame, its Lock Screen and its banners. `phone/Springboard.tsx` adds the gestures: the swipe that unlocks, the home indicator, the App Switcher. An app opens out of its icon with the site's own zoom (`phone/Zoom.tsx`) in place of the kit's `Expand`, which uncovers an app from its top edge down.

The app icons, folder and document are drawn for this site; the wallpaper and the logo are Shrug's. On the desktop the group chat's icon is drawn after the Messages icon (a white speech bubble on green), Portfolio's after the Finder's face as macOS draws it now, and FAQs' after the Notes icon (`src/os/icons.tsx`). On the iPhone the icons of Messages, Contacts and Notes are drawn after the iOS icons of those apps (`src/phone/icons.tsx`). No file from an operating system is used. The company logos belong to the companies.
