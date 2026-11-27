#!/usr/bin/env python3
"""The chair's photographs, brought in from the folder Shrug keeps its selects in.

    python3 -I tools/chair-photos.py "<…/Website Selects>" [--check]
    python3 tools/chair-photos.py --again

The folder has one folder per colourway, named as the launch list names it, and in each:

    gallery/   the photographs Workspace shows in its window, in the order of their names
                 01__X.jpg                                 a landscape slide
                 02-pair-left__X.jpg, 02-pair-right__Y.jpg two portraits, side by side, as ONE slide
                 03-portrait__X.jpg                        one portrait, whole, inside the landscape window
    checkout/  upright studio shots for the page a chair is bought on, 01 its hero: only for a color that has
               no lead yet (Dom, 27 Nov: where there is a lead, checkout shows the lead's two and nothing else)
    lead/      landscape.jpg and portrait.jpg: the chair in this color on a backdrop of it (Shrug's renders of
               27 Nov). The gallery opens on the landscape, ahead of the photographs; the upright is not in the
               gallery (Dom, 27 Nov). Checkout shows the two, the landscape first, filling its tile and cut to its
               middle as the page narrows ("fill"), as ArtStore's pictures made to fill a tile are; the upright
               after it, whole.

Folders whose names begin with "_" (_Alternatives) and the full-resolution originals are left alone.

Each photograph is copied as it is, byte for byte, to

    store/public/pictures/workspace/<color id>/gallery|checkout|lead/<its name>.jpg

and is the largest size the pages have of it: it came ready for the web (sRGB, 2,400 on its long side) and
is not made again. Beside it two smaller copies are made for small and plain screens (-s.webp, 760 on the
long side: a thumbnail, a phone; -m.webp, 1,600), since nothing in this site makes sizes as a page is asked
for. What there is of each color is written to store/src/chair-photos.json, which the pages read
(store/src/pictures.ts): the slides of its gallery and how each is laid out, its checkout shots, and for
each photograph its size, what a studio shot's two sides are like (the color of its left edge and of its
right, at eight heights: a tile wider than the shot is painted with those beside it, so that the shot is shown
whole and its studio seems to run on to the tile's edges) and what it is a view of, for its alt text.

What a photograph is a view of is read from chair-photo-views.json beside this script
({"<color id>/gallery/01__X": "from behind"}), which is written by hand, and only where the view is plain
to see.

--check reads the folder and reports on it without copying anything. --again needs no folder: it goes over
the list as it stands from the copies already in the site, and writes in what chair-photo-views.json says
of each (taking out any view that file no longer has) and each studio shot's sides, for when the photographs
are already in and only what is said of them has changed.

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
    'Proton Sparkle': 'proton-sparkle',
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


STOPS = 8


def sides_of(im):
    """What a studio shot is like down its left edge and down its right: the color of each at eight heights."""
    w, h = im.size
    t = max(2, round(w * 0.012))
    sides = []
    for x in (0, w - t):
        stops = []
        for n in range(STOPS):
            band = im.crop((x, round(h * n / STOPS), x + t, round(h * (n + 1) / STOPS)))
            r, g, b = (round(c) for c in ImageStat.Stat(band).mean)
            stops.append(f'#{r:02x}{g:02x}{b:02x}')
        sides.append(stops)
    return sides


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


def again():
    """The list as it stands, gone over from the copies in the site: each view, and each studio shot's sides."""
    views = json.load(open(VIEWS)) if os.path.exists(VIEWS) else {}
    manifest = json.load(open(MANIFEST))
    known, said = set(), 0
    for color, kept in manifest.items():
        for part, photos in (('gallery', [p for slide in kept['gallery'] for p in slide['photos']]), ('checkout', kept['checkout'])):
            for one in photos:
                key = f"{color}/{one['file']}"
                known.add(key)
                if views.get(key):
                    one['view'] = views[key]
                    said += 1
                else:
                    one.pop('view', None)
                one.pop('ground', None)
                if part == 'checkout' and not one.get('fill'):
                    with Image.open(os.path.join(OUT, color, one['file'] + '.jpg')) as opened:
                        one['sides'] = sides_of(ImageOps.exif_transpose(opened).convert('RGB'))
    with open(MANIFEST, 'w') as out:
        json.dump(manifest, out, indent=1, sort_keys=True)
        out.write('\n')
    print(f'{said} of {len(known)} photographs say what they are a view of')
    for key in sorted(set(views) - known):
        print(f'  {key}: no such photograph')
    for key in sorted(known - set(views)):
        print(f'  {key}: no view said')


def main():
    if '--again' in sys.argv:
        return again()
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

        def photograph(part, file, sided=None):
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
            if part == 'checkout' if sided is None else sided:
                one['sides'] = sides_of(im)
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

        # ---- the lead: the landscape render first in the gallery; at checkout, it and then the upright one
        lead, heads = {}, []
        for file in listed(os.path.join(at, 'lead')):
            stem = os.path.splitext(file)[0].lower()
            if stem in ('landscape', 'portrait'):
                lead[stem] = file
            else:
                notes.append(f'{name}/lead/{file}: neither landscape.jpg nor portrait.jpg; left out')
        if 'landscape' in lead:
            one = photograph('lead', lead['landscape'], sided=False)
            if one['h'] >= one['w']:
                notes.append(f'{name}/lead/{lead["landscape"]}: is not a landscape')
            kept['gallery'].append({'kind': 'wide', 'photos': [one]})
            heads.append(dict(one, fill=True))
        if 'portrait' in lead:
            one = photograph('lead', lead['portrait'], sided=True)
            if one['h'] <= one['w']:
                notes.append(f'{name}/lead/{lead["portrait"]}: is not upright')
            heads.append(one)
        if lead and set(lead) != {'landscape', 'portrait'}:
            notes.append(f'{name}/lead: has only its {", ".join(sorted(lead))}')

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
        kept['checkout'] = heads + [photograph('checkout', f) for f in files]
        if not kept['checkout']:
            notes.append(f'{name}: nothing for its checkout')
        elif not lead:
            notes.append(f'{name}: no lead renders yet, so its checkout shows its studio shots')
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
        print(f"{kept['name']:20} {color:20} gallery: {gallery:34} checkout: {len(kept['checkout'])}")
    print(f'\n{len(manifest)} colors' + ('' if check else f', written to {os.path.relpath(MANIFEST)}'))
    if notes:
        print('\nTo look at:')
        for note in notes:
            print(f'  {note}')


if __name__ == '__main__':
    main()
