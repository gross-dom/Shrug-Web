# Workspace: the studio, as designed

The seventh new app, and the piece left out of `DESIGN.md`. Read that file first: its rules, its shell changes and
its sign-in all apply here. This file adds Workspace.

In this folder: `screens/*.html`, thirteen states on `screens/shrugos.css` (the `ws2` and `ws3` blocks at its
foot are Workspace's). Open `screens/index.html`.

## 1. The idea

Workspace is a color picker for the chair with one button. Chairs are still sold in the VIP Store; this is where
they are explored. It opens on eight slabs: seven colors and Your own. Pick one and the whole window becomes a
studio in that color: a lit cove, the color's name set huge behind the chair, the chair itself on a turntable,
the colors in a small glass Dock of dots, the price and one button.

The app is called Workspace. The mark is set as W/S here, as the catalog draws it; use the supplied logo.

Window: 1100 × 720, minimum 900 × 620, in the Dock between Mail and VIP Store.

## 2. The chair is a 3D model

**This is the instruction that matters most.** The chair on these screens is a flat stand-in drawing. In the
build it is a **high-quality, interactive 3D render of the real chair**, not a photograph, not a sequence of
stills, and not this drawing.

- **What it is.** A painted Ergohuman, also sold as the Raynor Ergo Elite: black mesh headrest, back and seat,
  black arms, a chrome gas lift, with the paint on the spine at the back and on the five-star base.
- **The standard to meet.** Dom's references for the quality and feel of the 3D experience:
  - Rimowa: https://www.rimowa.com/gb/en/luggage/colour/silver/cabin/92653004.html
  - Cartier, Santos: https://int.cartier.com/en/collections/watches/all-watches/santos-de-cartier-all/w2sa0033-santos-de-cartier-watch.html
  - Herman Miller, Eames Lounge Chair: https://store.hermanmiller.com/living-room-furniture-lounge-chairs-ottomans/eames-lounge-chair-and-ottoman/100089694.html?lang=en_US&sku=100089694
  - Rolex, 1908: https://www.rolex.com/en-gb/watches/1908/m52506-0003
  - Porsche's configurator.
- **One model, many colors.** The painted parts take the chosen color as a material. All seven colors, and any
  color typed into Your own, come from the same asset; nothing is re-rendered per color. A color entered in
  Your own shows on the chair at once (`WS-Own`).
- **Finishes.** Most colors are a solid paint. Alexandrite is color-shifting, so its material has to change
  with the viewing angle as the chair turns (`WS-Shift`); that is the reason to turn it.
- **The set.** One studio for every color: the cove takes the color, lit from above and in front, with a soft
  contact shadow on the floor. The light and the camera do not change between colors.
- **Turning it.** Drag to orbit, as the screens' "Drag to turn" shows (`WS-Turn`). It opens from behind, at a
  slight three-quarter, because that is where the color is. Keep the orbit level and limit the tilt; no zoom
  past the point where the model stops holding up.
- **Loading and fallbacks.** Show a still of the chair in the chosen color while the model loads, then swap
  with no jump in position or light. Where 3D cannot run, the still stays and the app works without turning.
  With reduced motion, no automatic rotation.
- **The model itself is not in this handover.** A licensed 3D model of the chair is needed, from Raynor or the
  manufacturer's CAD, or commissioned. Do not use a model found online without the right to. Until it arrives,
  build the stage, the materials and the controls against a placeholder.

No picture from the Workspace site or the catalog is used anywhere in the app.

## 3. The colors

Seven to start: Scuderia Red, Solar Orange, Alexandrite, Championship Green, Supersonic, Pearl Lavender, Mantis
Green. Then Your own, which is always a request.

The values in `shrugos.css` are working values, not final. Scuderia Red and Championship Green were sampled from
the catalog. Solar Orange is approximate, Alexandrite is an indigo-to-copper stand-in for a color-shifting
paint, Mantis Green follows its name, and **Supersonic and Pearl Lavender are guesses** awaiting swatches. Keep
every color as one token that drives the cove, the slab, the Dock dot, the Dock icon and the chair's material.
Text on a color is white or near-black, whichever reads better on it.

## 4. The screens

| Screen | State |
| --- | --- |
| `WS-First` | First open: eight slabs |
| `WS-Hover` | Pointing at a slab: it widens and shows the chair |
| `WS-InStock` | A color chosen, in stock: **Buy in VIP Store**, which opens that product there |
| `WS-MadeToOrder` | A color chosen, made to order: **Request** |
| `WS-Shift` | A color-shifting finish |
| `WS-Turn` | Turning the chair |
| `WS-Requested` | Requested: the button is off and says so |
| `WS-SignedOut` | A request while signed out: the menu bar's sheet, with the color kept |
| `WS-Sonic` | A fifth color, for the palette |
| `WS-Own` | A color of your own: a name, a hex or a RAL code; always a request |
| `WS-Owners` | Notable Owners: people who own one, with their words, each card in its owner's color; links to the Notable Owners document in Preview. Only owners who have agreed to be named appear |
| `WS-Seven` | The seven studios at a glance. Reference, not a screen |
| `WS-Dock` | The Workspace icon in the Dock turns the color picked, and stays that way on the next visit |

Choosing a color floods the window: the slab grows to fill it, about 400ms, on the build's own easing; a cut
with reduced motion. Changing color in the studio cross-fades the cove and the material together.

## 5. Still open

1. The 3D model: who supplies it, and by when.
2. Swatch values for Supersonic and Pearl Lavender, and final values for the rest.
3. Which colors are in stock. Solar Orange is shown as available now because the Workspace site lists it so; the
   other six are shown as made to order.
4. Prices. $1,450 and $1,500 are the store's sample figures.
5. The VIP Store needs each of the seven as a product or option, and a request-only entry for Your own, or Buy
   in VIP Store has nowhere to land.
6. The one line about each color: Dom's copy.
