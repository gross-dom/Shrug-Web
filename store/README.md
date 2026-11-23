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

10 points are $1. A product is got in one of four ways, decided by its row in Airtable (`shared/rules.ts`):

| It has | It is | The member |
| --- | --- | --- |
| Points only | bought with points | spends the points; if it is posted, says where to send it |
| Points and a Price (and Postage) | bought with points and dollars | spends the points, and pays the Price and Postage by Apple Pay or card, which gives the address |
| Status "On request" | not sold | presses Request; a row is written to Orders and Shrug writes back |
| Status "Pre-order" and no Points or Price | not out yet | reserves one; nothing is taken |

So the Workspace Chair at 10,000 points with a Price of $450 and Postage of $70 costs 10,000 points and
$520. Someone with too few points is told how many more they need. A Document (a PDF) is a download:
once got, it is in Yours, and only someone who has it can fetch the file.

## Airtable

The base is **Shrug**. The store reads it afresh on every visit, so a change there is live at once.

- **Members**: one row each. `Points` is the balance. `Role` (Founder, LP, Investor) and `Funds`
  (Shrug 1 to Shrug 5) decide what they are shown.
- **Products**: one row for each thing in the store.
  - `Visible to` is who sees it. **Everyone** is every member. Otherwise a member sees it if they are
    in any group ticked: Founders, LPs and Investors go by `Role`; "Shrug 1 LPs" is anyone with
    Shrug 1 in `Funds`. With nothing ticked, nobody sees it. What a member may not see is never sent
    to their browser.
  - `Points`, `Price` (the floor, in dollars) and `Postage` are the cost. `Status` is Available,
    Pre-order, On request or Hidden.
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
