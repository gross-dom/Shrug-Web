# Logos redrawn for the site

Two of the companies' logos, as Dom sent them on 27 Nov (small pictures, soft on a Mac's screen), redrawn
clean. Each is a square of the logo's own ground with the mark and the name in the middle of it, which is
how the site keeps a company's logo (`public/logos`, and larger in `public/logos/large`).

- `atoms.svg`: Atoms (atoms.com). The seven dots are drawn as circles on the regular hexagon they were
  measured to lie on (to within a fifth of a pixel of the picture sent); the name is traced from it.
- `ghost.svg`: Ghost. The mark is traced and made even about its middle (it is the same turned a quarter
  and mirrored); the name is traced.

They are traced from pictures 264 and 294 pixels wide, so a corner in them is a little rounder than in the
companies' own artwork: where a company's own vector file is to hand, it should take the place of these.

To put one in the site again: draw it to a PNG named for its company ("Atoms.png", "Ghost.png") in a folder
of its own, then `python3 tools/pictures.py --logos THAT_FOLDER` and `python3 tools/logo-colours.py`.
