#!/usr/bin/env python3
"""A product's photographs, made ready for the store: each kept whole at the sizes the pages ask for.

    python3 tools/store-pictures.py <name> <photograph> [<photograph> ...]

    python3 tools/store-pictures.py art-return-of-the-jedi hero.webp details.webp

writes store/public/pictures/<name>-1.webp, -1-s.webp (and -1-l.webp), <name>-2…, in the order given, and
prints the line for SIZES in store/src/pictures.ts, which is how the pages know what there is. The first
photograph is the one a shelf shows.

Each is kept at three sizes, by its long side: small (760: a thumbnail, a phone's tile), the one a product's
screen shows (1,800), and a large one (2,400) for big and dense screens. Nothing is made larger than it came:
a photograph smaller than 1,800 is kept at its own size, and only one of 2,200 or more has a large file.
Needs Pillow. Run it with -I where the photographs came from someone else's archive.
"""
import os
import sys

from PIL import Image, ImageOps

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'store', 'public', 'pictures')
SMALL, FULL, LARGE = 760, 1800, 2400


def fitted(im, long_side):
    w, h = im.size
    k = min(1.0, long_side / max(w, h))
    return im if k == 1.0 else im.resize((max(1, round(w * k)), max(1, round(h * k))), Image.LANCZOS)


def main():
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    name, files = sys.argv[1], sys.argv[2:]
    sizes = []
    for n, path in enumerate(files, 1):
        # (as it is meant to be seen: turned the way its camera says, and in plain RGB)
        im = ImageOps.exif_transpose(Image.open(path)).convert('RGB')
        small, full = fitted(im, SMALL), fitted(im, FULL)
        small.save(os.path.join(OUT, f'{name}-{n}-s.webp'), 'WEBP', quality=82, method=6)
        full.save(os.path.join(OUT, f'{name}-{n}.webp'), 'WEBP', quality=86, method=6)
        entry = [small.width, full.width, full.height]
        if max(im.size) >= 2200:
            large = fitted(im, LARGE)
            large.save(os.path.join(OUT, f'{name}-{n}-l.webp'), 'WEBP', quality=86, method=6)
            entry.append(large.width)
        sizes.append(entry)
    print(f"  '{name}': {sizes},")


if __name__ == '__main__':
    main()
