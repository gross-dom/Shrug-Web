# Shrug VIP: the card and the store

Where Shrug people see their points and spend them. Two pages and a small server:

- **The card** (`/`): a member signs in with their email and a six-digit code, opens their pack and is
  shown their card and balance. It is one finished page, kept as it is in `card/index.html`.
- **The store** (`/store/`): what they can spend their points on, and what they have ordered (`src/`).
- **The server** (`api/`): signs members in, says who may see what, places orders and takes payments.
  Everything is kept in the Shrug base in Airtable; there is no other database.

```
npm install
npm run build:demo    # the click-through demo: no server, nothing sent, no money moves
npm run build         # the real site, which talks to the server in api/
npm test              # the server's endpoints, run against stand-ins for Airtable, Stripe and Resend
```

Both builds go to `dist/`. The demo is plain files and can be put anywhere. The real site is deployed to
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

The store itself is a wall: each product hangs on a peg as a foil pack, like the pack on the card's
page, with its price on a shelf label under it. One numbered edition (or, failing that, something in
short supply) is given the middle of the wall. Until a product has a `Picture` in Airtable it shows a
line drawing of the sort of thing it is, marked Placeholder (`src/Art.tsx`).

## Airtable

The base is **Shrug**. The store reads it afresh on every visit, so a change there is live at once.

- **Members**: one row each. `Points` is the balance. `Role` (Founder, LP, Investor) and `Funds`
  (Shrug 1 to Shrug 5) decide what they are shown.
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
- **Orders**: written by the store. Set `Status` to Sent or Refunded as you deal with one.
- **Applications** and **Sign-ins**: the store's own. People who signed in and are not members; and
  the sign-in codes, kept only as marks that cannot be read back.

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

- **Payments have not been run against Stripe.** The code follows Stripe's documented flow and the
  server's side of it is tested against a stand-in, but no real or test payment has been made.
- **Emails about points** (a balance going up, an order on its way) are not sent. Only the sign-in code is.
- Two people buying the last one at the same instant can both get it: Airtable cannot rule that out.
  A payment, though, is only ever made into one order.
