# Shrug.VIP v1: the apps, as designed

A design for the desktop in `Shrug-Web`, written against commit `5322551` (24 Nov 2026). It covers the six
reworks and six of the seven new apps in *Shrug.VIP v1: apps and design briefs*. **Workspace is not in this
handover:** it is still being designed and follows separately.

In this folder:

- `screens/*.html`: every state as a static page on `screens/shrugos.css`. Open `screens/index.html` and follow
  the links. Each page is one artboard: a window at its default size on a piece of the desk, or a piece of the
  desk itself.
- `screens/shrugos.css`: one stylesheet for all of them. Its head is the desk, the window chrome and the Mac
  controls, taken from `src/styles/os.css` and `src/kit/window.css`; then `store/design/screens/store.css` as
  written; then one block per app.
- `DESIGN.md`: this file. `PROMPT.md`: what to say to Code with it.
- **Beside this folder, from Dom:** the logo display icons, and reference screenshots for sign-in, the picture
  set, Preview, Mail, Photo Booth, Spotify and YouTube (section 2). They are not in this folder; they were not
  available when these screens were drawn.

## 0. Building it

Work in this order. Each step leaves the desktop working.

1. **Sign-in and accounts**, with the shell changes in section 3 (the Dock and desk split, the new icons).
2. **VIP Store** as a window.
3. **Updates** and **Preview**, then the **One-pager** as a file that opens in Preview.
4. **Mail.**
5. **QuickTime Player, Photo Booth, Group Chat's compose, Spotify, YouTube, Wallpapers.**

Three rules decide between sources when they differ.

- **Flow, states and copy:** the screens here are right. Every state in a brief has a screen; none should be
  dropped.
- **Look:** where Dom has attached a screenshot of the real app (section 2), the screenshot is right and the
  screen here is only a guide to layout and states.
- **The store:** the code already written is right (section 4, VIP Store).

Done means: every screen listed in section 4 can be reached, each window opens at its default size and holds
its minimum, a product does not scroll at the store's default size, nothing private is in the page before
sign-in, US spelling in everything a visitor reads, and `sh tests/all.sh` passes with the checks updated for
what changed (VIP is now a window, not a link; Log In has more steps; the desk has more icons).

## 1. Rules every app follows

From the brief, unchanged.

- **Mac first.** Each app looks and behaves like its Mac counterpart, inside the desktop's window chrome.
- **Everything opens on the desktop.** Only a portfolio company's own website opens a new tab.
- **One sign-in.** No app has a login of its own. A locked item opens the same sheet from the menu bar, and the
  sheet says what it was opened for ("Log in to open Updates", "Log in to request", "Log in to post").
- **One checkout.** All buying happens in the VIP Store. Other apps carry a button that opens the product there.
- **Locked, not hidden.** Private items show a lock. Their contents are fetched only after sign-in and never sit
  in the page.
- **Desktop only for new apps.** The iPhone keeps what it has.

## 2. What Dom attaches alongside

| Attached | Governs | How to use it |
| --- | --- | --- |
| Logo display icons | The Dock and desk icons | Use these files wherever one is supplied, in place of the icons drawn in `Icons.html`. The Dock and desk split stays as drawn. |
| Apple sign-in and sheet screenshots | Sign-in and accounts | Match Apple's styling for the sheet, fields, code entry and buttons. Flow and copy as drawn. |
| Apple-style emoticon screenshot | The picture step of sign-up | The set to choose from, in place of the eight faces drawn here. See open point 1. |
| Preview screenshots | Preview | Match Apple's Preview exactly: toolbar, sidebar, page ground. |
| Superhuman screenshots | Mail | Build the look from these. Use all of Superhuman's keyboard shortcuts. |
| Photo Booth screenshots | Photo Booth | Match for the look. |
| Spotify screenshots | Spotify | Get the design exactly right from these. |
| YouTube screenshots | YouTube | Get the design exactly right from these. |

Updates has no screenshot: match Apple's Finder list window as the Portfolio window already does.

## 3. The shell: what changes

**Apps (`src/os/apps.ts`).** New entries, with the sizes the screens are drawn at.

| App | Name shown | Default | Minimum | Lives |
| --- | --- | --- | --- | --- |
| `store` | VIP Store | 1120 × 720 | 960 × 640 | Dock, last before the rule |
| `mail` | Mail | 1180 × 740 | 860 × 560 | Dock |
| `updates` | Updates | 760 × 540 | 520 × 360 | Desk (was LP Updates, shown only after login; now always on the desk, with a lock) |
| `preview` | Preview | 980 × 720 | 560 × 420 | Dock only while a document is open |
| `quicktime` | QuickTime Player | 748 wide, fixed, around a 720 × 405 picture | not resizable | Dock only while open; a Film file on the desk opens it |
| `photobooth` | Photo Booth | 780 × 660 | 620 × 540 | Desk |
| `spotify` | Spotify | 1000 × 660 | 780 × 520 | Desk |
| `youtube` | YouTube | 1100 × 664 | 860 × 540 | Desk |
| `workspace` | Workspace | to follow | to follow | Dock |

Group Chat and Wallpapers keep their built sizes.

**The Dock (`src/os/Dock.tsx`):** Portfolio, Group Chat, FAQs, Case Studies, Mail, Workspace, VIP Store, then
the rule. VIP stops being a link and opens the store window; `open vip` in the terminal, VIP in the Go menu,
the Drops row in About Shrug and "See who got one in VIP" all open that window too. After the rule: Preview and
QuickTime Player while they have something open, then minimized windows. The one-pager leaves the Dock for the
desk.

**The desk:** Updates (locked), One-pager, Wallpapers, Film, Photo Booth, Spotify, YouTube, in that order down
the right. `Main.html` is the desk at rest; `Desk-Open.html` is it with a document and the film open.

**The menu bar:** Log In becomes the person's picture and first name once signed in.

## 4. The apps

### Sign-in and accounts

One sheet, let down from Log In at the right of the menu bar. 300 wide.

| Screen | State |
| --- | --- |
| `SignIn-Empty` | The sheet, empty: email first |
| `SignIn-Phone` | An email not on the list: straight to a phone number |
| `SignIn-Code` | Code entry (the texted code) |
| `SignIn-Wrong` | Wrong code |
| `SignIn-TooMany` | Too many tries |
| `SignIn-Inbox` | An email on the list: six digits to that inbox first |
| `SignIn-ListPhone` | Then the phone number, which is what they sign in with from then on |
| `SignIn-Link` | Arriving from a personal link in the update email: the email is already confirmed |
| `SignIn-Profile` | First sign-in: display name and picture |
| `SignedIn-Standard`, `SignedIn-LP` | Signed in: points, Open VIP Store, Open Updates (LP), Edit Name and Picture, Log Out |
| `Locked-Before`, `Locked-After` | A locked item opening the sheet, and what the desk shows once an LP is in |

Notes from Dom: flow and copy are approved. Style it the way Apple styles its own sheets, from the attached
screenshots. The picture step uses Apple-style emoticons from the attached screenshot.

Needs from the server: a quick check of whether an email is on the list (it decides the path); a texted
six-digit code; a display name and a picture (a chosen default, or an uploaded photo) on the member. The pack
no longer asks for a code of its own.

### VIP Store

**Use the store that is already written.** `store/src` and `store.css` are the design; these screens are that
design placed in a window, and should look as close to it, and reuse as much of its code, as possible while
sitting inside a native-feeling app window. Photographs, descriptions, prices and points come from the existing
store and its data. The sample products, prices and stand-in pictures on these screens are not content.

What is new is the frame and a few states:

- **The window.** The store's layout is sized to its window, not the browser (`.win .ui` at the foot of the
  store block in `shrugos.css` shows the adjustments used here: a 60px bar, a 28px edge, an 88px foot). A product
  does not scroll at 1120 × 720.
- **Two sections: Store and My VIP.** Updates leaves the bar. My VIP is what the store calls Yours: the card,
  orders and where each stands, points in and out, the address on file, Log Out.
- **Check, and follow Apple:** where a Mac app would put the Store / My VIP switch and the points balance. The
  screens put both in the title bar row with the traffic lights, as one unified toolbar. If Apple's own apps
  would put them a line down, do that instead.
- **A visitor** lands straight in the store at standard prices, with no wallet in the bar and no points on a
  product (`Store-Visitor`, `Product-Buy-Visitor`). A visitor can buy (`Checkout-Visitor`); the email and
  address given at payment create their account, and the moment after the receipt says so and asks for a phone
  (`Receipt-NewAccount`). My VIP for a visitor is a door to Log In (`Yours-Visitor`).
- **A standard user** has the standard card and about 100 points (`Store-Standard`).
- **Doors from other apps:** any app can open a product directly.

**The pack: do not build the pack screens here.** The pack opening stays exactly as it is built today; Dom and
Niv like it as it is. The only changes are that it plays inside the store window on the first signed-in open,
and that it no longer asks for a code. `Pack-Sealed`, `Pack-Tearing`, `Pack-Card`, `Pack-Card-Black` and
`Pack-Card-Standard` stay in this folder for reference only: they show where it sits and which card each person
gets (Silver, Gold or Black for an LP; the black placeholder card with steel outline type for a standard user).

| Screen | State |
| --- | --- |
| `Store-Visitor`, `Store-Standard`, `Store-LP` | The store, as each kind of person |
| `Product-Buy`, `Product-Claim`, `Product-Request`, `Product-Requested`, `Product-Reserve`, `Product-SoldOut` | A product's button in each state |
| `Checkout`, `Checkout-Visitor`, `Receipt`, `Receipt-NewAccount` | Paying, and after |
| `Yours`, `Yours-Visitor` | My VIP |
| `Store-Empty`, `Store-NoAnswer` | An empty store; no answer from the server |

Product pages are approved; Dom will make specific fixes once testing. Payments are set up after the design is
locked. Chairs are sold by Workspace and everything else by VIP Labs; a buyer sees that only on the receipt.

### Updates

A locked folder on the desk. Nobody but an LP sees what is inside, not even the names of the files. Match
Apple's styling for a Finder list window.

| Screen | State |
| --- | --- |
| `Updates-Folder` | The locked folder on the desk |
| `Updates-Standard` | A standard user: still locked, told who it is for, nothing listed |
| `Updates-LP-One`, `Updates-LP-Several` | An LP in one fund, and in several: grouped Funds and SPVs, each row naming the fund it was written for, in one of the four built states (Open, Request, Requested, Coming soon) |
| `Updates-Empty` | Nothing here yet |

A visitor who opens the folder gets the sign-in sheet (`Locked-Before`). A document opens in Preview.

### Preview

The one viewer every document opens in. Match Apple's Preview exactly, from the attached screenshots. No
editing tools. No Dock icon until a document is open.

| Screen | State |
| --- | --- |
| `Preview-Loading` | Loading |
| `Preview-Document` | A document (the one-pager) |
| `Preview-Private` | A private document: a Private tag by its name, "Prepared for [name]" under the page, Download switched off |
| `Preview-Deck` | A deck in full screen, stepped with the arrow keys, Escape to leave |
| `Preview-NoAccess` | No access, with Request |
| `Preview-Missing` | File missing |

"Prepared for [name]" is the page's, not stamped into the PDF. Download can be switched off per document.

### One-pager

A file on the desk that opens in Preview, in place of the link to DocSend. `OnePager-Icon` is the file;
`OnePager-Page1` and `OnePager-Page2` are the page template at US Letter. **Use the up-to-date Shrug brand
throughout:** the mark, wordmark and type on these pages stand in for the current identity. Bracketed lines are
for the rewrite.

### Mail

Twenty email exchanges that led to something, read-only. The functionality here is approved. Build the look
from the Superhuman screenshots Dom attaches, and **use all of Superhuman's keyboard shortcuts**, not only the
few shown on these screens.

| Screen | State |
| --- | --- |
| `Mail-Inbox` | The inbox with twenty emails, split tabs across the top, a tag on each row for what it led to |
| `Mail-Thread` | A thread, opening with one line on what it led to |
| `Mail-Command` | The command palette |
| `Mail-Zero` | The palette's easter egg (a proposal) |

Read-only holds across every shortcut: nothing sends, archives or changes mail. Reply opens a new message to
Shrug in Messages. Everything in Mail is public. Copy is templated for now; the real exchanges come later, with
addresses and personal details removed.

### QuickTime Player

Approved as drawn: the old brushed-metal player, with controls drawn in its own style. Two items, Film (5:00)
and Study (0:40), with room for more. It pauses when its window is minimized or closed. The film is served from
Vimeo or as a file; either way no host's controls or branding show.

Screens: `QT-Poster`, `QT-Playing`, `QT-Paused`, `QT-Ended` (Replay and the next item), `QT-Loading`,
`QT-CantPlay`.

### Photo Booth

Approved. Match the attached Photo Booth screenshots for the look; flow, states and copy as drawn. The strip
along the foot is the wall: the latest photos from everyone, each with a display name and picture. Anyone can
take and save; posting needs sign-in. No queue: a post appears at once, Shrug can remove any photo, and a
person can remove their own.

Screens: `PB-Ask`, `PB-Refused`, `PB-Live`, `PB-Effects`, `PB-Countdown`, `PB-Review`, `PB-Posted`, `PB-SignIn`,
`PB-Empty`, `PB-Large`, `PB-Large-Own`.

### Group Chat: write to Shrug

Approved as drawn. The Testimonials conversation and the easter-egg threads stay as built. The pencil starts a
message whose only recipient is Shrug; a subject is picked first.

Screens: `Msg-Subject`, `Msg-Testimonial`, `Msg-Intro`, `Msg-Meeting`, `Msg-Sending`, `Msg-Delivered`,
`Msg-NotDelivered`, `Msg-Thread`.

Delivery is honest: Delivered only once Shrug's inbox has it, otherwise Not Delivered with a way to try again.
Ten files, 25 MB each. Messages go to hello@labs.vip for now. The phone's compose gains the same three subjects.

### Spotify

Approved as a starting version. Get the design exactly right from the attached Spotify screenshots. What these
screens fix is the structure: a sidebar (Podcasts, Playlists), a list, a player bar. Playback is Spotify's own
embedded player: in the bar for one episode, in the main pane for a playlist, since the embed brings its own
track list. Check what a listener not signed in to Spotify hears before relying on full-length play.

Screens: `Spotify-Browsing`, `Spotify-Playing`, `Spotify-Playlist`, `Spotify-Unavailable`.

### YouTube

Approved as a starting version. Get the design exactly right from the attached YouTube screenshots. One
playlist: the player, with the list beside it. The player is YouTube's own embed with nothing drawn over it. A
video that cannot be embedded shows a link to watch it on YouTube.

Screens: `YouTube-List`, `YouTube-Playing`, `YouTube-Unavailable`.

### Wallpapers

Approved as drawn. A second section, Photographs, beside the five colorways; a photograph opens large with Set
as Wallpaper and Download.

Screens: `Wallpapers-Grid`, `Wallpapers-Photo`.

## 5. Not designed here

- **Workspace.** In exploration; its own handover follows. The Dock keeps a place for it.
- The five pieces that stay as built (Portfolio, FAQs, Case Studies, About Shrug, the desk's own parts), bar the
  small edits in the brief.
- The iPhone.
- Motion, beyond what the store's `DESIGN.md` already sets.
- Payments.

## 6. Still open

1. **The pictures.** The brief says Apple's own Memoji artwork is not used; Dom's note asks for Apple-style
   emoticons from a screenshot. Build the picker to take whatever set is supplied, and confirm with Dom which
   artwork ships.
2. **Third-party look and marks.** Superhuman's agreement is being arranged separately. Nothing has been said
   about Spotify or YouTube; matching their apps closely and using their marks is Dom's call to clear.
3. **What the sign-in sheet gives away.** The inbox step shows that an email is on the list.
4. **The address for messages.** hello@labs.vip is assumed.
5. **Chromatic's price.** These screens show $40 covered by 400 points; the store's data is what counts.
