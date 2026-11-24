# Shrug VIP: the card and the store

Where Shrug people see their points and spend them. Two pages and a small server:

- **The card** (`/`): a member signs in with their email and a six-digit code, opens their pack and is
  shown their card and balance. It is one finished page, kept as it is in `card/index.html`.
- **The store** (`/store/`, `src/`): three sections under one bar. **Store** is a display of everything in
  it, pictures first, and a screen for each product, with checkout and the receipt in its panel. **Updates**
  is what Shrug has written to its LPs. **Yours** is the member's card, orders, points and address.
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
| A standard user | They signed in, and are not on Shrug's list | The same store, as a member: a row in Members with no `Role`, the tier Standard and 100 points to begin with (`STARTING_POINTS`, which is $10) |
| Someone on the list | A row in Members with a `Role` | What is for Everyone and for their groups; and, for an LP, the updates |

- **Signing in makes the account.** The first time an address that is not in Members gives a right code, a
  row is added for it (`welcome` in `api/_lib/members.ts`). Signing in again finds that row: there is no second
  account and no more points. Applications is no longer written to.
- **Updates are for LPs alone.** A document is never shown or handed to anyone whose `Role` does not include
  LP, whatever is ticked on it: on a document, Everyone means every LP (`mayHave`). Anyone can sign in now, so
  a box ticked in Airtable cannot by itself put an LP update in front of the public.
- **Taken out of Members, someone is a visitor again** at their next request, and their session is ended.

In the demo a small **Demo** tab beside the name in the bar chooses who is looking, adds points, and brings
on the states that cannot otherwise be got to (sold out, a payment that fails, an empty store, no answer).

Both builds go to `dist/`: the card at its root and the store under `store/`. `SHRUG_BASE=/vip/` builds them
to be served under that path of another site (the card at `/vip/`, the store at `/vip/store/`); the server
stays at `/api`. The demo is plain files and can be put anywhere. The real site is deployed to
Vercel from this folder (`vercel deploy`), which builds it and runs `api/`.

## How buying works

Everything has a price in dollars. It is kept in Airtable as points, at 10 points to the dollar, so
10,000 points is a price of $1,000. A member pays in dollars and can bring the price down with their
points: as many or as few as they choose, with a slider at the counter. Some things have a **floor**,
the least that is paid in dollars however many points are used. **Postage** is added on top and points
do not pay for it. What is left is paid by Apple Pay or card, which also gives the address.

| Product | Points | Floor | Postage | With no points | At its least |
| --- | --- | --- | --- | --- | --- |
| Workspace Chair | 10,000 | $450 | $70 | $1,070 | $520, using 5,500 points |
| Art on Acrylic | 2,800 | $75 | $5 | $285 | $80, using 2,050 points |
| Chromatic | 400 | none | none | $40 | nothing, using 400 points |

So nobody is told they have too few points: they pay the difference. When points cover the whole price
and there is no postage, nothing is paid; if the thing is posted, the store asks where to send it.
All of this is in `shared/rules.ts`, which both the server and the pages go by.

Besides buying:

- Status **On request**: not sold. Its price is shown, the member presses Request, a row is written to
  Orders and Shrug writes back. (Give it a Floor equal to its whole price: points are not used on it.)
- Status **Pre-order** with no Points yet: the member reserves one, and nothing is taken.
- A **Document** (a PDF) is a download. One with no price is there for anyone who may see it; one with
  a price is bought first, and is then in Yours. Only someone it is for can fetch the file.

## The pages, and the design they are built from

The design is in `design/`: `DESIGN.md`, and every screen as a still page in `design/screens/`. The pages are
built from it as it is. `src/styles.css` **is** `design/screens/store.css`, untouched: to change how the
store looks, change the design and copy it across. The markup in `src/App.tsx` (the bar, the display, the
gates), `src/Product.tsx` (a product, checkout, the receipt), `src/Updates.tsx` and `src/Yours.tsx` is the
screens' own, class for class. `src/app.css` holds only what a still page cannot say: the size of a real
window and phone, where a long page scrolls, a photograph's fit, the box an address is typed in, what is
under the pointer, and how things move.

- A phone's layout is used under 740px across. A product is one screen there and does not scroll.
- A product is in the address (`/store/?p=<id>`), so a link from an email lands on it; `?s=updates` and
  `?s=yours` are the other two sections.
- Until a product has a `Picture` in Airtable, its tile shows a small drawing of the sort of thing it is.
- A chair's colors are drawn as swatches. Black, Stone and White are known; any other is given its color
  after its name in `Options` ("Sand #c8b89a").
- Only the card page (`card/index.html`) keeps the pack's look. It is not changed.

**One place the design does not fit its own rule.** A product is meant never to scroll on a desktop, down
to a window of 1280 by 760. The design's checkout is 98px taller than the room that window leaves it. The
sizes are as designed; where the panel is taller than its room, it scrolls in its place and the page stays
still.

## Updates, and the address on file

**Updates** are the documents (a Product whose Kind is Document). They are not for sale and are not in the
store. Each is shown to a member in one of four states:

| State | When |
| --- | --- |
| Open | It is `Visible to` them, and has a `File`. It opens in the page, and can be downloaded |
| Request | `Listed to everyone` is ticked, and it is not `Visible to` them. Asking writes a row to Orders with the status Requested; to approve, add them to a group it is `Visible to` |
| Requested | They have asked |
| Coming soon | It is shown to them, and has no `File` yet |

Every open and every download is noted in the table **Opens**. The desktop site's LP Updates folder reads
the same list.

**The address** a member's orders go to is kept on their row (`Members → Ship to`), as a few lines of text.
It is saved the first time one is given (typed at checkout or with a claim, or given by Apple Pay when there
is none), shown from then on, and changed in Yours.

## Airtable

The base is **Shrug**. The store reads it afresh on every visit, so a change there is live at once.

- **Members**: one row each. `Points` is the balance. `Role` (Founder, LP, Investor) and `Funds`
  (Shrug 1 to Shrug 5) decide what they are shown. `Ship to` is where their orders are sent.
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
  - `Options` is a list to choose one from, separated by commas (a chair's colours).
  - `Picture` is shown in the store. `File` is a Document's PDF.
  - For a Document: `Group` is the heading it is under in Updates (Funds, SPVs), and `Listed to everyone`
    shows it to every member, with Request for those it is not written for.
- **Orders**: written by the store. Set `Status` as you deal with one: Sent, Ready (for a reservation
  that can now be had), or Refunded. Yours shows the member where each stands.
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
| `RESEND_API_KEY` | Resend, which sends the sign-in code |
| `MAIL_FROM` | Who the code is from, at a domain verified in Resend: `Shrug VIP <vip@…>` |
| `STRIPE_SECRET_KEY` | Stripe, for the dollars |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe's key for the page (not a secret) |
| `STRIPE_WEBHOOK_SECRET` | From a Stripe webhook pointed at `/api/stripe` for `payment_intent.succeeded` |

For Apple Pay, the site's domain has to be added in Stripe (Settings → Payment method domains).

## Not done yet

- **A visitor cannot buy.** They are shown everything, and the button sends them to the card. Buying without
  an account, with the account made from what the payment gives, waits on payments being set up.
- **The standard card.** A standard user's tier is `standard`, which the card page does not know: it draws
  them the silver card until theirs is designed.
- **Signing in by text.** Every code is still emailed. A phone number tied to an account, and a code sent to
  it, need two things this does not have yet: a column for the number in Members, and something to send texts.
- **A display name and a picture** for an account, for the same reason: they need their columns.

- **Payments have not been run against Stripe.** The code follows Stripe's documented flow and the
  server's side of it is tested against a stand-in, but no real or test payment has been made.
- **Emails about points** (a balance going up, an order on its way) are not sent. Only the sign-in code is.
- **Points given** are shown in Yours as one line: the balance and everything since spent, with the last
  `Reason`. Airtable keeps no record of each award or its date.
- The design's "Owned by" line on a product, and the address a one-off delivery is emailed to, are left out:
  both are open questions in `design/DESIGN.md`.
- Two people buying the last one at the same instant can both get it: Airtable cannot rule that out.
  A payment, though, is only ever made into one order.
