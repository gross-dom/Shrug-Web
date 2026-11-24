# Shrug VIP: the card and the store

Where Shrug people see their points and spend them. Two pages and a small server:

- **The card** (`/`, `card/index.html`): a member signs in with their email and a six-digit code. The first
  time, that is **Apply / Redeem**: the code loosens the strip, they tear their pack open and their card
  comes out. After that they use **Sign in** at the foot of the page: the same code by email, and their card
  is simply there, with nothing to tear (a pack waiting to be torn can also be skipped). Under the card is
  one button, **Go to the store**.
- **The store** (`/store/`, `src/`): two sections under one bar. **Store** is a display of everything in
  it, pictures first, and a screen for each product, with checkout and the receipt in its panel. **My VIP**
  is the member's card, their account at a glance, what they have bought, the funds they are in, their
  points and their address. (Updates, what Shrug writes to its LPs, are no longer shown here: they are
  being given a place of their own elsewhere. The server still has them: see below.)
- **The server** (`api/`): signs members in, says who may see what, places orders and takes payments.
  Everything is kept in the Shrug base in Airtable; there is no other database.

```
npm install
npm run build:demo    # the click-through demo: no server, nothing sent, no money moves
npm run build         # the real site, which talks to the server in api/
npm test              # the server's endpoints, run against stand-ins for Airtable, Stripe and Resend
```

## Who is asking

There are three kinds of person, and one set of rules (`shared/rules.ts`) answers for each.

| Who | How | What they are shown |
| --- | --- | --- |
| A visitor | Nobody is signed in | The store: everything that is `Visible to` Everyone, at its price. No points, no orders, no updates. The button on a product is the way to the card |
| A standard user | They signed in with a phone number, and are not on Shrug's list | The same store, as a member: a row in Members with no `Role`, the tier Standard and 100 points to begin with (`STARTING_POINTS`, which is $10) |
| Someone on the list | A row in Members with a `Role` | What is for Everyone and for their groups; and, for an LP, the updates |

- **Signing in makes the account.** The first time an address that is not in Members proves a phone number,
  a row is added for it (`welcome` in `api/_lib/members.ts`). Signing in again finds that row: there is no second
  account and no more points. Applications is no longer written to.
- **Updates are for LPs alone.** A document is never shown or handed to anyone whose `Role` does not include
  LP, whatever is ticked on it: on a document, Everyone means every LP (`mayHave`). Anyone can sign in now, so
  a box ticked in Airtable cannot by itself put an LP update in front of the public.
- **Taken out of Members, someone is a visitor again** at their next request, and their session is ended.
- **A standard user's card is the black one.** Their tier is `standard`, and their card is the placeholder's
  black stock and steel outline type, printed with what they have: their points, and their name once they
  have given one ("Your name here" until then). It comes out of the pack as a metal card does. The card page
  (`standardCard`) and My VIP (`.mc.m-standard`) draw it; `stockOf` in `shared/rules.ts` says which card a
  tier is. The placeholder itself ("you're not on the list. yet.") is no longer anybody's.

## Signing in

An email comes first, and the server says what comes next (`api/start.ts`).

| The email | Next | Then |
| --- | --- | --- |
| Nobody's yet | A phone number (`api/text.ts`), which is texted six digits | The right code makes the account, with the number on it (`api/verify.ts`) |
| Has a number on file | Six digits are texted to that number. The page is told only its last two digits | The right code signs them in |
| On the list, and its inbox not yet confirmed; or any account with no number | Six digits are emailed | The right code signs them in and notes `Email confirmed`. They are then asked for a number (`api/phone.ts`) |

- **A number belongs to one account.** Someone who proves a number that already has an account is signed in
  to that account, whatever email they typed: so the starting points are had once to a phone, not once to an
  email address.
- **Someone on the list confirms their inbox once before a number counts.** A number on their row from
  before (someone can make a standard account with any address, and Shrug may list that address later) lets
  nobody in until the email is proved. `wayIn` in `api/_lib/members.ts` is the whole rule.
- **A lost or changed number** is got round by the inbox: `start` and `verify` with `by: 'inbox'`. Only
  someone who has just proved their email (so, or by their personal link) may put a different number on an
  account that has one.
- **A personal link** (`api/link.ts`, made by `tools/link.mjs`) is what an update email carries for each LP.
  Opening it proves the email, so the sheet asks only for a number. It works until the account has a number,
  and until the day it says; after that it only brings up Log In.
- **Codes.** A texted code is Twilio Verify's: made, sent, kept ten minutes and allowed five guesses there,
  with nothing of it kept here (`api/_lib/texts.ts`). An emailed code is the store's own, as before
  (`api/_lib/codes.ts`): out of guesses, no new one is sent until the old one would have run out.
- **A name and a picture** (`api/profile.ts`) are asked for the first time someone signs in. The picture is
  one of Shrug's faces (`shared/faces.ts`), kept as a file named for it (`face-shrug.png`), or a photo of theirs.
- **Where it is asked.** The desktop's Log In sheet (`src/os/Account.tsx`, in the desktop's own folder) is
  the whole of it. The card page's strip is the same way in for a phone: an email, then a number for someone
  new, then six digits.
- A session says how it began (`via`: text, inbox, link or pay), and every answer about a member says what
  their account still lacks (`needs`: a phone, a profile).

In the demo a small **Demo** tab beside the name in the bar chooses who is looking, adds points, and brings
on the states that cannot otherwise be got to (sold out, a payment that fails, an empty store, no answer).

Both builds go to `dist/`: the card at its root and the store under `store/`. `SHRUG_BASE=/vip/` builds them
to be served under that path of another site (the card at `/vip/`, the store at `/vip/store/`); the server
stays at `/api`. The demo is plain files and can be put anywhere. The real site is deployed to
Vercel from this folder (`vercel deploy`), which builds it and runs `api/`.

## How buying works

Everything has a price in points, and that is how it is shown everywhere: the points mark (a gold coin)
and the figure. Ten points are a dollar, so 10,000 points is a price of $1,000. A member uses as many of
their points as they choose (**Use points**, with a slider), and what the points do not cover is paid in
dollars by Apple Pay or card. Some things have a **floor**, the least that is paid in dollars however many
points are used: the page says so as "You can use a maximum of 9,500 points against this purchase."
**Postage** is added on top and points do not pay for it.

| Product | Points | Floor | Postage | With no points | At its least |
| --- | --- | --- | --- | --- | --- |
| Workspace, Matte Black | 10,000 | $450 | $70 | $1,070 | $520, using 5,500 points |
| Art on Acrylic | 2,800 | $75 | $5 | $285 | $80, using 2,050 points |
| Chromatic | 400 | none | none | $40 | nothing, using 400 points |
| Shrug 2027 (pre-order) | 550 | none | none | $55 | nothing, using 550 points |

So nobody is told they have too few points: they pay the difference. All of this is in `shared/rules.ts`,
which both the server and the pages go by.

Whatever is bought goes through the same checkout. The button on a product says what it will come to
("Claim for 400 points", "Claim for 8,400 points + $680", "Buy for $285") and opens checkout: what it is,
the sums, and the ways to finish. With something to pay those are Apple Pay and the card; with nothing to
pay there is one, **Confirm order**.

**The address comes last, and only where it is needed.** Apple Pay brings an address with it, so it asks
for nothing. A card and points alone do not: once "Pay with card" or "Confirm order" is pressed, and only
if there is no address on file, the page asks where to send it, and then takes the card or places the
order. With an address on file it is shown at checkout, with the way to change it, and nothing is asked.

The **Use points** slider is on a product and again at checkout wherever points can be used, also where
they would cover the whole price: every point is used to begin with, and a member who would sooner keep
some eases it down and pays the rest by card.

Besides buying:

- Status **On request**: not sold. Its price is shown, the member presses Request, a row is written to
  Orders and Shrug writes back. (Give it a Floor equal to its whole price: points are not used on it.)
- Status **Pre-order** with no Points yet: the member reserves one, and nothing is taken. With Points, it
  is pre-ordered as anything else is bought, and the button says "Pre-order for …".
- A **Document** (a PDF) is an update, and is not in the store. One with no price is there for anyone
  who may see it; one with a price is **unlocked** with points first (see Updates below).

## The pages, and the design they are built from

The design is in `design/`: `DESIGN.md`, and every screen as a still page in `design/screens/`. The pages
were built from it, and have since moved on from it (`DESIGN.md` says where, at its head): the still pages
show the store as it was first drawn. `src/styles.css` **is** `design/screens/store.css`, kept the same: to
change how the store looks, change that file and copy it across. The markup is in `src/App.tsx` (the bar,
the display, the gates), `src/Product.tsx` (a product, checkout, the receipt) and `src/Yours.tsx` (My VIP). `src/app.css` holds what a still page cannot say: the size of a real window and
phone, where a long page scrolls, the box an address is typed in, what is under the pointer, and how
things move.

- **The name** in the bar is Shrug's wordmark as the brand kit draws it, set as SHRUG VIP STORE
  (`src/brand.tsx`, outlines, no typeface to load). The card page carries the same wordmark: at its head
  (SHRUG VIP), printed on the pack, and on the member's card.
- **Points** are shown with their mark (`PointsMark` in `src/brand.tsx`) wherever a number is a number of
  points. Dollars appear only as what is left to pay by card, and as postage.
- **Buttons are glass**: a pane that what is behind shows through, lit along its top edge. The thing to do
  next is the brightest one on the screen (`.ui-btn`), anything else that can be pressed a dimmer one
  (`.sec`). Each has a hairline round its rim. The card page has none: its labels are the dark ruled
  boxes in small capitals that the pack has always had, its "Go to the store" is plain white words with an
  arrow, and the links in its footer are the footer's own small capitals.
- **Photographs.** The ones Shrug has supplied are in `public/pictures/`, each whole, as WebP at three
  sizes (760, 1,800 and, where the original has the pixels, 2,400 on the long side), and are found by the
  product's name (`src/pictures.ts`). The browser is told how wide each file is and how large it will be
  drawn, and fetches the smallest that is sharp on that screen: a desktop's tile gets the 1,800 one, a
  phone's the 760 one, a large dense screen the 2,400 one. A product with none there shows what its row in
  Airtable has (`Picture`, which can hold several), and one with nothing shows a drawing of the sort of
  thing it is. Most of the photographs are upright and some are wide, so: in the display a product's tile
  is 4 by 5 and its first picture fills it (cropped to the tile, about its middle unless `pictures.ts`
  says where); on a product's own screen each picture is shown whole, with the same picture out of focus
  filling the tile behind it, so that a tall one and a wide one sit alike.
- **A product's pictures** are paged through with the arrows on the picture, the arrow keys, the dots, or
  a finger drawn across it. Another product is reached from the foot (on a phone, the two arrows by
  "2 of 6").
- **A product's one line** is its `Description` in Airtable, shown under its name.
- **The balance** in the bar goes to My VIP. The card at the head of My VIP goes to the card page.
- **My VIP lists what was bought apart from what was only asked for:** "Purchase history" is orders that
  something was taken for; "Requests and reservations" is requests, and places kept with nothing taken.
- A phone's layout is used under 740px across. There a product's button stays at the foot and what is
  above it scrolls.
- A product is in the address (`/store/?p=<id>`), so a link from an email lands on it; `?s=yours` is
  My VIP. An old link to `?s=updates` lands on the store.
- Where a product has `Options`, they are drawn as swatches. Black, Stone and White are known; any other
  is given its color after its name ("Sand #c8b89a"). The chairs are now a product for each color
  ("Workspace, Matte Black"), so none has options at present.
- `/?signin` opens the card page ready to sign in; the store's door sends people to `/?signin=store`,
  and they are back in the store as soon as they are in.

**One place the design does not fit its own rule.** A product is meant never to scroll on a desktop, down
to a window of 1280 by 760. The design's checkout is 98px taller than the room that window leaves it. The
sizes are as designed; where the panel is taller than its room, it scrolls in its place and the page stays
still.

## Updates, and the address on file

**Updates** are the documents (a Product whose Kind is Document). **The store's pages no longer show them**
(the Updates section has been taken out: Shrug is putting them somewhere else), but the server
still does everything below, for whatever comes to read them: `/api/store` answers with `updates`, an order
asks for one or unlocks one, and `/api/file` hands one over. The page that showed them is in the
repository's history (`src/Updates.tsx`). Each update is, for a member, in one of five states:

| State | When |
| --- | --- |
| Open | It is `Visible to` them, has a `File`, and either has no `Points` or they have unlocked it. It opens in the page, and can be downloaded |
| Unlock | It is `Visible to` them and has `Points` (10, say). "Unlock for 10 points" takes the points, writes an order, and it is open to them from then on. With too few points the button says how many are needed |
| Request | `Listed to everyone` is ticked, and it is not `Visible to` them. Asking writes a row to Orders with the status Requested; to approve, add them to a group it is `Visible to` |
| Requested | They have asked |
| Coming soon | It is shown to them, and has no `File` yet |

Every open and every download is noted in the table **Opens**. The desktop site's LP Updates folder reads
the same list.

**The address** a member's orders go to is kept on their row (`Members → Ship to`), as a few lines of text.
It is saved the first time one is given (typed at checkout or with a claim, or given by Apple Pay when there
is none), shown from then on, and changed in My VIP.

## Airtable

The base is **Shrug**. The store reads it afresh on every visit, so a change there is live at once.

- **Members**: one row each. `Points` is the balance. `Role` (Founder, LP, Investor) and `Funds`
  (Shrug 1 to Shrug 5) decide what they are shown. `Ship to` is where their orders are sent. Four columns
  are the app's own: `Phone` (the number they sign in with, written once they have proved it; clear it to
  make them prove one again), `Email confirmed` (when they last proved the email; clear it to make someone
  on the list confirm again), `Display name` and `Picture`.
- **Products**: one row for each thing in the store.
  - `Visible to` is who sees it. **Everyone** is every member. Otherwise a member sees it if they are
    in any group ticked: Founders, LPs and Investors go by `Role`; "Shrug 1 LPs" is anyone with
    Shrug 1 in `Funds`. With nothing ticked, nobody sees it. What a member may not see is never sent
    to their browser.
  - `Points` (the price: 10 to the dollar), `Floor` (the least paid in dollars) and `Postage` are the
    cost. `Status` is Available, Pre-order, On request or Hidden.
  - `Edition of` and `Left` make a numbered edition ("Edition of 10 · 7 left", and each one sold is
    numbered 4/10). `Left` alone is a plain limit, and reaches Sold out at 0. `Limited supply` is only
    the label.
  - `Options` is a list to choose one from, separated by commas.
  - `Description` is the one line under its name.
  - `Picture` is shown in the store, and can hold several: the first is the one in the display. (The
    photographs kept with the pages are used first: see above.) `File` is a Document's PDF.
  - For a Document, `Points` is what it costs to unlock.
  - For a Document: `Group` is the heading it is under in Updates (Funds, SPVs), and `Listed to everyone`
    shows it to every member, with Request for those it is not written for.
- **Orders**: written by the store. Set `Status` as you deal with one: Sent, Ready (for a reservation
  that can now be had), or Refunded. My VIP shows the member where each stands.
- **Opens**: written by the store. Who opened or downloaded which update, and when.
- **Sign-ins**: the store's own. The sign-in codes, kept only as marks that cannot be read back.
- **Applications**: no longer written to. Someone who signs in without being on the list is given a row in
  Members (see Who is asking). `Tier` needs the choice **Standard** for them (the store writes it, and
  Airtable adds a choice it has not seen).

## What the real site needs

Set on the Vercel project (Settings → Environment Variables). None is kept in this repository.

| Name | What it is |
| --- | --- |
| `AIRTABLE_TOKEN` | A personal access token for the Shrug base, with `data.records:read` and `data.records:write` |
| `SESSION_SECRET` | Any long random string. Sessions are signed with it; changing it signs everyone out |
| `RESEND_API_KEY` | Resend, which emails a sign-in code |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` | Twilio, which texts a sign-in code: the account's SID and auth token |
| `TWILIO_VERIFY_SID` | The Verify service the texts go through (Twilio → Verify → Services): its SID begins `VA` |
| `MAIL_FROM` | Who the code is from, at a domain verified in Resend: `Shrug VIP <vip@…>` |
| `STRIPE_SECRET_KEY` | Stripe, for the dollars |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe's key for the page (not a secret) |
| `STRIPE_WEBHOOK_SECRET` | From a Stripe webhook pointed at `/api/stripe` for `payment_intent.succeeded` |

For Apple Pay, the site's domain has to be added in Stripe (Settings → Payment method domains).

## A visitor buys

Someone not signed in can buy what is paid for with money (asking, reserving and anything that costs nothing
need an account, and the button is the way in instead). At checkout they give an email for the receipt; the
price is the price, with no points. The payment makes their account (`api/pay.ts`, `api/order.ts`):

- A standard account, from the email and the address they paid with, with the starting points. They are
  signed in to it, and the receipt says so and asks for a phone number, which is how they log in from then on.
- If that email already has an account, the order is that account's and **nobody is signed in**: paying with
  an address does not show it is theirs. The order goes where the payer said; the address on file is left.
- Only the browser that began a payment is answered when it is made into an order (a cookie says which
  payment is its own), and only an account the payment has just made is opened this way (no number, and this
  its only order). Stripe's own word arriving first makes the same account and order, once.
- An account made by a payment and left without a number is opened by a code to its email.

## In a window of the desktop

On Shrug's own site the store is the VIP Store window (`src/apps/Store.tsx`, in the desktop's folder): these
pages in a frame, served by the same site at `/vip/` (the desktop's build puts them there: `tools/store.mjs`).
The window draws the bar; here it is not drawn, the layout is sized to the window, Log In is the desk's
sheet, and moving about adds nothing to the browser's history (`src/desk.ts`). The first time someone signed
in comes to the store, the frame shows the card's page: the pack hangs with its strip loose, and asks for no
code. A visitor's prices are in dollars, in a window and out of one.

## Not done yet

- **No text has been sent for real.** Signing in by text is built and checked against a stand-in for Twilio
  Verify; it needs a Twilio account and its three settings before a real number is texted. Until bots are
  kept off `api/text.ts` (a rate limit, or Vercel's BotID), anyone can have a code texted to any number at
  Shrug's cost: Verify's own Fraud Guard is the only guard.
- **The card page cannot add a number to an account that has none.** Its strip asks someone new for their
  number and takes a texted code, as the desktop's Log In does; but someone on the list who signs in there
  (by their inbox) is not then asked for a number, nor for a name and picture. They are asked on the desktop.
- **The faces** (`shared/faces.ts`) are emoji on a colored ground, as Contacts on a Mac offers them. Which
  set ships is Dom's to say; the list can be changed without touching anyone's row.

- **Payments have not been run against Stripe.** The code follows Stripe's documented flow and the
  server's side of it is tested against a stand-in, but no real or test payment has been made.
- **Emails about points** (a balance going up, an order on its way) are not sent. Only the sign-in code is.
- **Points given** are shown in My VIP as one line: the balance and everything since spent, with the last
  `Reason`. Airtable keeps no record of each award or its date.
- **Investment history** in My VIP is the funds on a member's row (`Funds`): Airtable has no dates or
  amounts for them, so none are shown.
- The design's "Owned by" line on a product, and the address a one-off delivery is emailed to, are left out:
  both are open questions in `design/DESIGN.md`.
- Two people buying the last one at the same instant can both get it: Airtable cannot rule that out.
  A payment, though, is only ever made into one order.
