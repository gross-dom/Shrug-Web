# Shrug VIP: the store, as designed

A design for `store/`, written against commit `947a4c0` (23 Nov 2026). It keeps everything the build does
(sign-in, who sees what, the price rule, orders, Stripe, documents) and changes how the store looks and where
the documents live.

It replaces the wall of foil packs built in `cd58477`. That was drawn from an earlier pass of this design, which
has been dropped: the store is now a plain dark interface, and only the card page keeps the pack's look.

> **Since this was drawn (24 Nov 2026).** The pages have moved on from the still screens in a few places,
> and where they differ the pages are right. `screens/store.css` is kept in step with the build
> (`src/styles.css` is a copy of it); the `screens/*.html` pages are as first drawn.
>
> - **The name** is Shrug's wordmark from the brand kit (SHRUG VIP STORE in the bar, SHRUG VIP on the card
>   page, SHRUG on the pack and the card), not type.
> - **Prices are points**, shown with the points mark (a gold coin). Dollars are only what is left to pay
>   by card. "Your points" is "Use points", and its slider is there wherever points can be used, at
>   checkout too. The balance in the bar is the mark and the figure, without the small card.
> - **Buttons are glass**, not solid white and grey: the thing to do next is the brightest pane on the
>   screen. Rule 3 holds, with "white" read as "bright".
> - **The display** has no title or count, and its tiles are upright (4 by 5), filled by the photograph.
>   The page scrolls. Rule 2's "fits six without scrolling" no longer holds.
> - **A product** shows its own pictures, paged by the arrows; another product is reached from the foot.
>   Each picture is shown whole over an out-of-focus copy of itself. There is a line under the name for
>   the product's write-up.
> - **Everything bought goes through checkout**, points or not ("Claim for 400 points", then checkout, then
>   "Confirm order"). The address is asked for there, never on the product.
> - **Updates** can be locked: "Unlock" for 10 points. A row has its surface only under the pointer.
> - **Yours is My VIP**, and opens with the account at a glance: account type, card, balance, member since,
>   purchases, investments.
> - **The card page** has Sign in at its foot (no tear for someone who has had their pack), one white
>   button under the card (Go to the store) in place of the balance ticket, and rounded controls.

In this folder:

- `screens/*.html`: every screen as a static page, on `screens/store.css`. Open `screens/Store.html` and follow
  the links. These are the source of truth for layout, sizes and copy.
- `screens/Card.html` and `card-page.css`: the card page, for reference. It keeps its own look and is not
  changed.
- `DESIGN.md`: this file.
- `PROMPT.md`: what to say to Code with it.

## 0. Building it

Work in this order. Each step leaves the store working.

1. **The skin and the two store views.** Replace `src/styles.css` with `screens/store.css` and rebuild
   `src/App.tsx` as the display (`Store.html`) and the product (`Product.html`, `ProductPointsOnly.html`),
   with checkout (`Checkout.html`) and the receipt (`Receipt.html`) in the product's panel. `Pack`, `Tag`,
   `Hang`, `Stage`, `Counter` and the tear `Strip` go, with the stickers and the foil.
2. **Yours** (`Yours.html`) and the address on file.
3. **Updates** (`Updates.html`): documents out of the store, the four states, the viewer, the Opens table.
4. **The doors and empty rooms** (`Gates.html`).

The price rule is already right (`shared/rules.ts` as of `cd58477`): do not change it, the server, or their
tests. Lift markup and class names from the screens as they are. Do not restyle: where a screen and this file
differ, the screen is right. Done means: every state in `States.html` and `Gates.html` can be reached in the
demo, the phone screens match at 390 wide, a product does not scroll on desktop, and `npm test` passes.

## 1. The idea

The card page is the one expressive moment: the pack, the tear, the card. The store is not. It is a plain dark
interface of the kind people already know how to use: one sans, sentence case, rounded grey surfaces, one white
button to a screen. The only thing that comes through from the card page is the member's card, small, in the
balance at the top right, in their tier's metal.

Five rules hold everywhere.

1. **Pictures first.** The store opens on a display of everything in it, three across, each a picture with its
   name and price under it. A product is one press in. There is no list view of the store.
2. **A product never scrolls on a desktop.** A product, checkout and the receipt each fit one window (down to
   1280 by 760). The display fits six without scrolling; past six, its rows keep their height and the page scrolls.
3. **One white button to a screen.** It is the thing to do next. Everything else that can be pressed is grey.
4. **Gold is points, and nothing else:** the points taken off a price, points given, and the card in the bar.
   There is no other accent color.
5. **A price is a price.** Workspace is never discounted. Points are shown as part of how it is paid, not as
   money off: "Price $1,450 / Your points 8,400 pts, $840 / Total $680".

No display type, no capitals, no letter-spaced labels, no monospace, no textures or lighting.

## 2. Tokens

All in `store.css`, on `.ui` (desktop) and `.up` (phone).

| Token | Value | Used for |
| --- | --- | --- |
| `--bg` | `#0c0c0d` | The page |
| `--surface` | `#17171a` | Cards, the picture's tile, the chosen row, the section switch |
| `--surface-2` | `#222226` | Grey buttons, badges, thumbnails |
| `--surface-3` | `#2e2e33` | The chosen section, a switch that is off |
| `--line` | white at 9% | Rules inside a card, the rule over the foot |
| `--text` / `--text-2` / `--text-3` | `#f5f5f7` / `#a1a1a8` / `#85858d` | Words; second lines and labels; captions. All pass 4.5:1 on the page and on a surface |
| `--gold` | `#d9b862` | Points |
| `--red` | `#ff7a72` | What is said when something goes wrong |
| `--font` | Inter 400/500/600, then the system sans | Everything |
| `--edge` | 40px desktop, 20px phone | The page's margin |
| `--bar` / `--foot` | 72px / 104px | The top bar; the strip of products along the foot |

Type: title 34/600 (26 on a phone), heading 22/600, a name in a list 16/600, body 15/400, second lines 13/400.
Figures use tabular numerals. Corners: 24 for the picture, 16 for cards and rows, 12 to 14 for thumbnails,
fully round for buttons, badges and the section switch.

## 3. The parts

| Part | Class | Notes |
| --- | --- | --- |
| Top bar | `.ui-top` | The name, the three sections, the balance |
| Section switch | `.ui-seg` | Store, Updates, Yours |
| Balance | `.ui-wallet`, `.ui-chip` | The card small, in its metal (`.m-gold`, `.m-silver`, `.m-black`), then the points. Links to the card. `.ui-delta` shows what was just spent |
| Display | `.ui-shop`, `.ui-prod` | Three columns (two on a phone). A product is its picture on a grey tile, a badge in the corner, then name, kind and price. The one under the pointer lightens |
| Picture | `.ui-media` | The product's `Picture`, contained, on a grey tile. Previous and next as round buttons, "2 of 6" top left |
| No picture | the same tile | An icon for the kind (book, document, image). Replaces the outlined-name poster |
| Product panel | `.ui-col` | Kind and a badge, name, words, colors, the sums, the button, a caption |
| Colors | `.ui-swatches`, `.ui-sw` | Round swatches, a white ring on the chosen one, its name beside the label |
| Sums | `.ui-card.rows` | Price, Your points (gold), Shipping, Total. The same card carries a receipt |
| Points to use | `.ui-range` | The slider the build has, as a plain range under Your points, from 0 to `mostPoints`, full to begin with. Left out where there is nothing to choose (no points, or a product that takes none) and at checkout |
| Button | `.ui-btn` | White. `.sec` grey, `.off` nothing to press, `.sm` small, in a list or a card |
| Badge | `.ui-badge` | "3 of 5 left", an order's status. `.gold` for Pre-order and Made to order, `.on` for Yours |
| Foot | `.ui-rail` | On a product: every other product as thumbnail, name, price. The one on screen has a surface behind it. "View all" goes back to the display |
| List row | `.ui-row` + `.ui-upd` / `.ui-ord` / `.ui-pts` | Updates, orders, points. No rules between rows; the one under the pointer gets a surface |
| Card of facts | `.ui-card` | An address, emails, the account |
| Switch | `.ui-toggle` | Emails on or off |

## 4. The screens

| Screen | File | Replaces |
| --- | --- | --- |
| The card, with the way in | `Card.html` | Nothing: the gold strip into the store is already there. For reference only |
| The store | `Store.html` | The wall of packs (`Hang`, `Stage` in `App.tsx`) |
| A product | `Product.html` | The counter (`Counter`) |
| No photograph yet, bought with points alone | `ProductPointsOnly.html` | The pack with a line drawing. One press, no checkout step |
| Checkout | `Checkout.html` | `Pay.tsx`'s place in the counter. It takes the panel's place; the picture stays |
| Receipt | `Receipt.html` | The sticker and the flecks of foil |
| Updates | `Updates.html` | Documents on the shelves; the desktop's LP Updates folder reads the same list |
| Yours | `Yours.html` | `Yours` under the wall |
| The product panel in every state | `States.html` | Reference, not a screen |
| Doors and empty rooms | `Gates.html` | The `.gate` blocks. Reference |
| The parts | `System.html` | Reference |
| Phone | `PhoneStore.html`, `PhoneProduct.html`, `PhoneCheckout.html`, `PhoneReceipt.html`, `PhoneUpdates.html`, `PhoneYours.html` | The same six, at 390 by 844 |

### The store

What a member lands on from the card, and what "Store" in the bar goes to. Everything they may see, in `Place`
order, three across and as many rows as it takes. Each product is a link to its own screen; nothing is bought
from here. The badge in the corner says what is scarce or different about it: "3 of 5 left", "Pre-order",
"Made to order", "Sold out", and "Yours" once they have it. A product with no price yet shows none.

### A product

One product to a screen. The arrow keys, the two round buttons, the foot and a swipe all move to the next
without going back to the display. The address carries the product (`/store/?p=<id>`) so a link from an email
lands on it.

### The button

| The product | Button | Then |
| --- | --- | --- |
| Total is $0 (free, or the points cover it) | **Claim for free** / **Claim with 1,000 points** | One press places the order. The address on file is shown above the button |
| Total is more than $0 | **Buy for $680** | Checkout |
| On request | **Request** | Becomes "Requested", off |
| Pre-order with no price | **Reserve** | Becomes "Reserved", off |
| Sold out | "Sold out", off | |

A color has to be chosen before the button can be pressed. Until then it reads "Choose a color", off.

### Checkout

What is being bought, the address on file, the sums again, then Stripe's own Apple Pay button where the white
button is drawn, and "Pay with card" opening Stripe's card form in the same column. With no address on file,
the address fields stand where the address is shown, and are saved for next time. Escape, or the back link,
returns to the product.

### The receipt

A tick, "It's yours.", and the same card of rows: reference, item, edition number, what was paid, where it is
going. In the bar the balance counts down and shows what was spent beside it for that visit. The picture and
the foot mark the product as yours.

### Updates

Not for sale, so not in the store. One list, in groups (Funds, SPVs), and one of four states each:

| State | Shown as | When |
| --- | --- | --- |
| Open | "Open" | The member is one of the people it was written for |
| Request | "Request" | It is listed to them but not theirs. Writes an order with status Requested; Shrug approves by adding them |
| Requested | "Requested", nothing to press | After that |
| Coming soon | "Coming soon", nothing to press | Listed with no file yet |

Open shows the PDF in the page (the preview on the right becomes the viewer), with "Prepared for [name]" under
it, and records that it was opened. Download is the grey button under it.

### Yours

The member's card as the card page draws it, then what has been ordered with a badge for where each stands
(Ordered, Sent; Reserved, Ready; Requested, Open), then the points that have come and gone, then three cards:
the shipping address, emails on or off, and the account.

### Phone

Below 740px. The three sections as a full-width switch under the bar. The display is two across and scrolls
as a page does. A product is one screen and does not scroll: the picture, the name, the colors, two lines of sums, and the button docked at the foot over six dots.
Swipe sideways to change product. Checkout is a sheet up from the foot. Lists scroll as a page does.

## 5. How it moves

Quiet, and short. One easing, the build's own: `cubic-bezier(0.2, 0.7, 0.2, 1)`. With `prefers-reduced-motion`,
every one of these is a cut.

- **Changing product:** the picture and panel cross-fade, 200ms. No slide on desktop; on a phone the picture
  follows the finger.
- **A button pressed:** it dims to 85% while the answer comes. No spinner under 400ms.
- **Checkout and back:** the panel cross-fades, 200ms. On a phone the sheet rises, 280ms.
- **Paid:** the tick scales in from 80%, 240ms; the balance counts down over 600ms.
- **Under the pointer:** a row or a product in the foot gets its surface, 120ms.

## 6. What changes in the code

### The price rule: nothing to do

`shared/rules.ts` already does what this design needs, as of `cd58477`: a price in dollars kept as points, points
used as far as the floor, the rest by card, nobody short. The page goes by `mostPoints`, `fitPoints` and
`dueCents`, and the slider stays (`.ui-range`). To match the 23 Nov call, the chair's row in Airtable becomes
Points 14,500 and Floor 500; that is a change to the base, not the code.

### An address on file (`Members`, `api/order.ts`, `Pay.tsx`)

Members gets one long-text field, `Ship to`. The store saves an address to it the first time one is given
(typed, or from Apple Pay) and shows it from then on. Changing it is in Yours. A one-off address is by email.

### Documents (`api/store.ts`, `App.tsx`, the desktop's `account.ts`)

`/api/store` returns `updates` beside `products`: every Document, out of `products`. Each carries `state`:
`open`, `request`, `requested` or `soon` (no File yet). To list a document to people it is not written for,
Products needs a checkbox, `Listed to everyone`; without it the build's rule stands and they are never sent it.

`/api/file` gains `?view=1`, which answers `Content-Disposition: inline`. Both ways write a row to a new table,
`Opens` (Member, Product, When, Opened or Downloaded). The name under the viewer is the page's, not stamped
into the PDF.

### Points that have come and gone (`Yours`)

What was spent is in Orders already. What was given is only the last `Reason` on the member's row. Until there
is a table of awards, Yours shows the spends and one line for the balance as it was given.

### The pages (`src/App.tsx`, `src/styles.css`)

`styles.css` is replaced by `store.css`. Add `@fontsource/inter` (400, 500, 600); Oswald stays for the member's
card in Yours, and Red Hat Mono is no longer used by the store. `App.tsx` becomes four views (the display, a product, updates, yours) over
the one answer from `/api/store`, with the product in the address. `Counter` goes; its states are the product panel's. `Art.tsx`'s line drawings may stay as the stand-in for a
picture, small and in `--text-3` on the grey tile, in place of the icons drawn here.
The demo keeps working: `demo.ts` needs an `updates` list.

### The card page (`card/index.html`, `build.mjs`)

Leave it as it is. The gold strip under a member's card already goes into the store, and it lands on the
display. The fade from the card into the store can stay.

## 7. Not designed here

- The desktop site's Log In sheet and LP Updates window. They stay as built and should read `updates`.
- Emails (an order on its way, a new piece).
- The waiting list as a game, and anything in the Mac app.
- Stamping a member's name into a PDF.

## 8. Still open

1. Whether Chromatic is free (the call) or 400 points (the base).
2. Notable owners on a product: who, and whether they have agreed to be named.
3. The address a one-off delivery is emailed to.
4. Whether a member can buy a second chair.
