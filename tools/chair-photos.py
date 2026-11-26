#!/usr/bin/env python3
"""The chair's photographs, brought in from the folder Shrug keeps its selects in.

    python3 -I tools/chair-photos.py "<…/Website Selects>" [--check]

The folder has one folder per colourway, named as the launch list names it, and in each:

    gallery/   the photographs Workspace shows in its window, in the order of their names
                 01__X.jpg                                 a landscape slide
                 02-pair-left__X.jpg, 02-pair-right__Y.jpg two portraits, side by side, as ONE slide
                 03-portrait__X.jpg                        one portrait, whole, inside the landscape window
    checkout/  upright studio shots for the page a chair is bought on; 01 is its hero

Folders whose names begin with "_" (_Alternatives) and the full-resolution originals are left alone.

Each photograph is copied as it is, byte for byte, to

    store/public/pictures/workspace/<color id>/gallery|checkout/<its name>.jpg

and is the largest size the pages have of it: it came ready for the web (sRGB, 2,400 on its long side) and
is not made again. Beside it two smaller copies are made for small and plain screens (-s.webp, 760 on the
long side: a thumbnail, a phone; -m.webp, 1,600), since nothing in this site makes sizes as a page is asked
for. What there is of each color is written to store/src/chair-photos.json, which the pages read
(store/src/pictures.ts): the slides of its gallery and how each is laid out, its checkout shots, and for
each photograph its size, the ground a studio shot stands on (where its edges are one plain color, so that a
tile can be painted the same and the shot shown whole on it) and what it is a view of, for its alt text.

What a photograph is a view of is read from chair-photo-views.json beside this script
({"<color id>/gallery/01__X": "from behind"}), which is written by hand, and only where the view is plain
to see.

--check reads the folder and reports on it without copying anything.

Needs Pillow. Run it with -I: the folder is someone else's.
"""
import json
import os
import re
import shutil
import sys

from PIL import Image, ImageOps, ImageStat

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'store', 'public', 'pictures', 'workspace')
MANIFEST = os.path.join(HERE, '..', 'store', 'src', 'chair-photos.json')
VIEWS = os.path.join(HERE, 'chair-photo-views.json')
SMALL, MIDDLE = 760, 1600

# The launch list, as Shrug names the colors, and the color each is in the site (store/shared/colors.ts,
# src/data/workspace.ts). Matte Leather keeps the id it had as Matte Black.
COLORS = {
    'Matte Leather': 'matte-black',
    'Scuderia Red': 'scuderia-red',
    'Solar Orange': 'solar-orange',
    'Alexandrite': 'alexandrite',
    'Championship Green': 'championship-green',
    'Supersonic': 'supersonic',
    'Pearl Lavender': 'pearl-lavender',
    'Mantis Green': 'mantis-green',
    'Neutron Star': 'neutron-star',
    'Gummi Berry': 'gummi-berry',
    'Luxury Bronze': 'luxury-bronze',
    'Smurf': 'smurf',
    'Nuclear Pink': 'nuclear-pink',
    'Illusion Blue': 'illusion-blue',
    'Interstellar Black': 'interstellar-black',
    'Hulk Green': 'hulk-green',
    'Reserve Green': 'reserve-green',
    'Nuclear Green': 'nuclear-green',
    'Nuclear Violet': 'nuclear-violet',
    'Dazzling Pink': 'dazzling-pink',
    'Palleon Panther': 'palleon-panther',
    'Giallo Yellow': 'giallo-yellow',
    'Manhattan Blue': 'manhattan-blue',
    'Fractured Love': 'fractured-love',
}

NAMED = re.compile(r'^(\d+)(?:-(pair-left|pair-right|portrait))?(?:__(.*))?\.jpe?g$', re.I)


def plain(text):
    """A folder's name as it is compared: small letters, and nothing but letters and figures."""
    return re.sub(r'[^a-z0-9]+', '', text.lower())


BY_NAME = {plain(name): (name, color) for name, color in COLORS.items()}


def safe(name):
    """A file's name as an address can carry it."""
    return re.sub(r'[^A-Za-z0-9._-]+', '-', name).strip('-')


def ground_of(im):
    """The color a studio shot stands on, where its edges are one plain color; None where they are not."""
    w, h = im.size
    t = max(2, round(min(w, h) * 0.012))
    edges = [im.crop(box) for box in ((0, 0, w, t), (0, h - t, w, h), (0, 0, t, h), (w - t, 0, w, h))]
    means = [ImageStat.Stat(e).mean for e in edges]
    spread = max(max(ImageStat.Stat(e).stddev) for e in edges)
    apart = max(abs(a[c] - b[c]) for a in means for b in means for c in range(3))
    if spread > 6 or apart > 8:
        return None
    r, g, b = (round(sum(m[c] for m in means) / len(means)) for c in range(3))
    return f'#{r:02x}{g:02x}{b:02x}'


def smaller(im, long_side):
    w, h = im.size
    k = long_side / max(w, h)
    # (a copy is only worth keeping where it is a good deal smaller than the photograph itself)
    return None if k > 0.86 else im.resize((max(1, round(w * k)), max(1, round(h * k))), Image.LANCZOS)


def listed(folder):
    """The photographs in a folder, in the order of their names."""
    if not os.path.isdir(folder):
        return []
    return sorted(f for f in os.listdir(folder) if re.search(r'\.jpe?g$', f, re.I) and not f.startswith('.'))


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    check = '--check' in sys.argv
    if len(args) != 1 or not os.path.isdir(args[0]):
        sys.exit(__doc__)
    source = args[0]
    views = json.load(open(VIEWS)) if os.path.exists(VIEWS) else {}
    notes, found, manifest = [], {}, {}

    for folder in sorted(os.listdir(source)):
        at = os.path.join(source, folder)
        if not os.path.isdir(at) or folder.startswith(('_', '.')) or 'full res' in folder.lower():
            continue
        if plain(folder) not in BY_NAME:
            notes.append(f'{folder}: not a color of the launch list; left alone')
            continue
        found[BY_NAME[plain(folder)][1]] = (BY_NAME[plain(folder)][0], at)
    for name, color in COLORS.items():
        if color not in found:
            notes.append(f'{name}: no folder')

    for color, (name, at) in found.items():
        kept = {'name': name, 'gallery': [], 'checkout': []}

        def photograph(part, file):
            path = os.path.join(at, part, file)
            with Image.open(path) as opened:
                if opened.format != 'JPEG':
                    notes.append(f'{name}/{part}/{file}: is {opened.format}, not a JPEG')
                profile = opened.info.get('icc_profile')
                im = ImageOps.exif_transpose(opened).convert('RGB')
            w, h = im.size
            if max(w, h) > 2400:
                notes.append(f'{name}/{part}/{file}: {w} by {h}, larger than 2,400 on its long side')
            stem = safe(os.path.splitext(file)[0])
            one = {'file': f'{part}/{stem}', 'w': w, 'h': h}
            copies = {'s': smaller(im, SMALL), 'm': smaller(im, MIDDLE)}
            for key, copy in copies.items():
                if copy is not None:
                    one[key] = copy.size[0]
            if part == 'checkout':
                ground = ground_of(im)
                if ground:
                    one['ground'] = ground
            view = views.get(f'{color}/{part}/{stem}')
            if view:
                one['view'] = view
            if not check:
                out = os.path.join(OUT, color, part)
                os.makedirs(out, exist_ok=True)
                shutil.copyfile(path, os.path.join(out, f'{stem}.jpg'))
                for key, copy in copies.items():
                    if copy is not None:
                        copy.save(os.path.join(out, f'{stem}-{key}.webp'), 'WEBP', quality=84, method=6, **({'icc_profile': profile} if profile else {}))
            return one

        # ---- the gallery: slides, by the figures their names begin with
        slides = {}
        for file in listed(os.path.join(at, 'gallery')):
            m = NAMED.match(file)
            if not m:
                notes.append(f'{name}/gallery/{file}: its name does not say where it goes; left out')
                continue
            slides.setdefault(int(m.group(1)), []).append((m.group(2) or '', file))
        for n in sorted(slides):
            parts = dict(slides[n])
            if set(parts) == {'pair-left', 'pair-right'}:
                kind, files = 'pair', [parts['pair-left'], parts['pair-right']]
            elif set(parts) == {'portrait'}:
                kind, files = 'portrait', [parts['portrait']]
            elif set(parts) == {''}:
                kind, files = 'wide', [parts['']]
            else:
                notes.append(f'{name}/gallery: slide {n:02d} is {sorted(slides[n])}, which is none of a landscape, a pair or a portrait; left out')
                continue
            photos = [photograph('gallery', f) for f in files]
            for f, one in zip(files, photos):
                upright = one['h'] > one['w']
                if kind == 'wide' and upright:
                    notes.append(f'{name}/gallery/{f}: named as a landscape slide but is upright; shown whole, as a portrait is')
                    kind = 'portrait'
                elif kind != 'wide' and not upright:
                    notes.append(f'{name}/gallery/{f}: named as a portrait but is not upright')
            kept['gallery'].append({'kind': kind, 'photos': photos})

        # ---- the checkout: upright studio shots, the first its hero
        files = listed(os.path.join(at, 'checkout'))
        kept['checkout'] = [photograph('checkout', f) for f in files]
        if not files:
            notes.append(f'{name}: no checkout shots')
        if len(files) > 3:
            notes.append(f'{name}: {len(files)} checkout shots, more than three')
        if not kept['gallery']:
            notes.append(f'{name}: no gallery')
        manifest[color] = kept

    if not check:
        with open(MANIFEST, 'w') as out:
            json.dump(manifest, out, indent=1, sort_keys=True)
            out.write('\n')

    for color, kept in manifest.items():
        gallery = ', '.join(s['kind'] for s in kept['gallery']) or 'none'
        grounds = sum(1 for c in kept['checkout'] if c.get('ground'))
        print(f"{kept['name']:20} {color:20} gallery: {gallery:34} checkout: {len(kept['checkout'])} ({grounds} on a plain ground)")
    print(f'\n{len(manifest)} colors' + ('' if check else f', written to {os.path.relpath(MANIFEST)}'))
    if notes:
        print('\nTo look at:')
        for note in notes:
            print(f'  {note}')


if __name__ == '__main__':
    main()
