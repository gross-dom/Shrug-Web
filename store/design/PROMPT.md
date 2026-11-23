# What to say to Code

The store's look has changed direction. The wall of foil packs you built in `cd58477` came from an earlier
pass of the design that has been dropped. The new design is in `store/design/`: read `DESIGN.md` first, then
open the pages in `store/design/screens/` (start at `Store.html`), which are the source of truth for layout,
sizes, class names and copy.

Rebuild the store's pages to match, in the order DESIGN.md section 0 gives:

1. The store is a plain dark interface now: Inter, sentence case, rounded grey surfaces, one white button to a
   screen. It opens on a display of products, pictures first, and each product has its own screen with checkout
   and the receipt in its panel. The packs, pegs, shelf labels, tear strip, stickers and foil all go. Only the
   card page keeps that look, and it stays exactly as it is.
2. Keep the price rule, the server and their tests as they are. Keep the points slider, restyled as the plain
   range in the screens.
3. Yours gets an address kept on file. Documents leave the store for their own section, Updates, with the four
   states in DESIGN.md.

Use `screens/store.css` as the stylesheet and lift the markup as it is; do not restyle or add to it. Keep the
demo working throughout. Before you start, tell me anything in DESIGN.md that the current server cannot do
without a change to Airtable, and stop there for my answer on those.
