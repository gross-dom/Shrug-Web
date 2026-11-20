# Takes in the pictures Shrug supplies: a folder of the companies' logos and a folder of the photographs
# of the people in the testimonials. Each file is matched to its company or its person by its name, cut to
# the sizes the site draws it at, and written where the site keeps it; what was matched is written down in
# src/data/pictures.ts, which the data reads. Nothing else needs changing: a file that matches a company
# takes the place of the logo it had, and a person with a photograph is shown by it in place of initials.
#   python3 tools/pictures.py --logos DIR --people DIR     (either, or both; needs Pillow)
#   python3 tools/logo-colours.py                           (afterwards: the cards' colours, read from the logos)
# A file is matched by the name in its own: a number before the name is passed over ("09 Aidaly.png"), and
# so is whatever follows a person's name ("bryan chou webflow.jpg"). It says what it could not match, and
# matches nothing it is not sure of: those are put right by renaming the file, or by naming it in ALIASES.
# A file with REVIEW in its name is not used, and is listed. Where two files are for one company neither is
# used: they are listed, and drawn side by side on a sheet (--sheet FILE) for Shrug to choose between;
# the choice is given with --pick, the company's name and something only the chosen file's name has:
#   python3 tools/pictures.py --logos DIR --pick "Aidaly=09" --pick "Levels=levels.png"
import argparse
import difflib
import os
import re
import sys
import unicodedata

from PIL import Image, ImageOps

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..')
OUT = os.path.join(ROOT, 'src', 'data', 'pictures.ts')
KINDS = ('.png', '.jpg', '.jpeg', '.webp', '.avif', '.heic', '.tif', '.tiff', '.gif', '.bmp')

# A file's name (as it is written, less its ending) for a name the site has, where the two would not be matched
ALIASES = {
    # The site has him as Bryant Chou, of Webflow; the file's name has one letter fewer
    'bryan chou webflow': 'Bryant Chou',
}

# How large each is kept: twice the most points it is drawn across, for a screen with two pixels to the
# point. A logo in a list, a folder or a window is 88 points at most; at the head of its card on the iPhone
# it is 215; a face is 256 pixels square, as Shrug asked
SMALL, LARGE, FACE = 176, 430, 256


def plain(text):
    """A name as it is compared: its letters and figures, unaccented, in lower case."""
    text = unicodedata.normalize('NFKD', text.replace('&', ' and '))
    return ''.join(ch for ch in text.lower() if ch.isalnum() and not unicodedata.combining(ch))


def stem_of(path):
    """What a file is called, less the things that are said of every file in the folder."""
    stem = os.path.splitext(os.path.basename(path))[0]
    # (the number a file was given in its folder comes before its name, and is not part of it)
    stem = re.sub(r'^\s*\d+[\s_\-.)]*(?=\D)', '', stem)
    stem = re.sub(r'(?i)[\s_\-]*(\d{3,4}\s*px|\d{3,4}x\d{3,4}|@\dx|logo|icon|app[\s_\-]*icon|profile|photo|headshot|final|copy|\(\d+\))$', '', stem)
    return re.sub(r'(?i)^(logo|icon)[\s_\-]+', '', stem).strip(' _-')


def names_in(path, call):
    """The first words of each `c('…'` or `p('…'` in a data file: the names it holds."""
    found = []
    for line in open(path, encoding='utf-8'):
        m = re.match(r"\s*%s\(\s*(['\"])((?:\\.|(?!\1).)*)\1" % call, line)
        if m:
            found.append(m.group(2).replace("\\'", "'"))
    return found


def match(files, names, picks=None):
    """Each file to the one name it is for. Returns ({name: file}, [files matched to nothing], {name: [the
    files that are both for it]}, [files marked REVIEW]). Where two files are for one name neither is
    taken, unless `picks` says which ({name: something only that file's name has})."""
    by_plain = {}
    for name in names:
        by_plain.setdefault(plain(name), []).append(name)
    found, lost, review = {}, [], []
    for path in sorted(files):
        if 'review' in os.path.basename(path).lower():
            review.append(path)
            continue
        stem = stem_of(path)
        key = plain(ALIASES.get(stem, stem))
        hit = by_plain.get(key)
        if not hit:
            # One name the file's name holds, or is held by (four letters at least: "x" is in everything)
            close = [n for p, ns in by_plain.items() for n in ns if len(p) >= 4 and len(key) >= 4 and (p in key or key in p)]
            if len(close) != 1:
                close = [n for p, ns in by_plain.items() for n in ns if difflib.SequenceMatcher(None, p, key).ratio() >= 0.86]
            hit = close if len(close) == 1 else None
        if hit and len(hit) == 1:
            found.setdefault(hit[0], []).append(path)
        else:
            lost.append(path)
    taken, twice = {}, {}
    for name, paths in found.items():
        want = (picks or {}).get(name)
        chosen = [p for p in paths if want and want.lower() in os.path.basename(p).lower()]
        if len(paths) == 1:
            taken[name] = paths[0]
        elif len(chosen) == 1:
            taken[name] = chosen[0]
            lost += [p for p in paths if p != chosen[0]]
        else:
            twice[name] = paths
    return taken, lost, twice, review


def slug(name):
    return re.sub(r'-+', '-', re.sub(r'[^a-z0-9]+', '-', unicodedata.normalize('NFKD', name).encode('ascii', 'ignore').decode().lower())).strip('-')


def opened(path):
    im = Image.open(path)
    im = ImageOps.exif_transpose(im)
    return im.convert('RGBA')


def squared(im):
    """A logo on a square: one that is not square is set in the middle of one, on its own corner's colour."""
    w, h = im.size
    if w == h:
        return im
    side = max(w, h)
    ground = im.getpixel((0, 0))
    out = Image.new('RGBA', (side, side), ground)
    out.paste(im, ((side - w) // 2, (side - h) // 2), im)
    return out


def flat(im):
    """On white, where it is see-through: the site draws a logo on a ground of its own."""
    out = Image.new('RGBA', im.size, (255, 255, 255, 255))
    out.alpha_composite(im)
    return out.convert('RGB')


def draw_pairs(twice, out):
    """The files that are two for one company, each pair on a row with its name and the files' own names."""
    from PIL import ImageDraw
    cell, pad, label = 300, 24, 46
    rows = sorted(twice.items())
    across = max(len(paths) for _, paths in rows)
    sheet = Image.new('RGB', (pad + across * (cell + pad), pad + len(rows) * (cell + label + pad)), '#f2f2f4')
    pen = ImageDraw.Draw(sheet)
    for r, (name, paths) in enumerate(rows):
        top = pad + r * (cell + label + pad)
        for c, path in enumerate(paths):
            left = pad + c * (cell + pad)
            sheet.paste(flat(squared(opened(path))).resize((cell, cell), Image.LANCZOS), (left, top))
            pen.text((left, top + cell + 6), '%s: %s' % (name, os.path.basename(path)), fill='#111')
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    sheet.save(out)


def files_in(folder):
    return [os.path.join(folder, f) for f in os.listdir(folder) if f.lower().endswith(KINDS) and not f.startswith('.')]


def ts_map(name, comment, pairs):
    lines = ['/** %s */' % comment, 'export const %s: Record<string, string> = {' % name]
    lines += ["  %s: '%s'," % (repr(k) if "'" not in k else '"%s"' % k, v) for k, v in sorted(pairs.items())]
    return lines + ['}']


def kept(name):
    """What pictures.ts holds for one of its maps now, so that taking in one folder keeps the other's."""
    if not os.path.exists(OUT):
        return {}
    text = open(OUT, encoding='utf-8').read()
    m = re.search(r'export const %s: Record<string, string> = \{(.*?)\n\}' % name, text, re.S)
    return dict((k.replace("\\'", "'"), v) for _, k, v in re.findall(r"^\s*(['\"])(.*?)\1: '(.*?)',$", m.group(1), re.M)) if m else {}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--logos')
    ap.add_argument('--people')
    ap.add_argument('--pick', action='append', default=[], help='NAME=something only the chosen file has in its name')
    ap.add_argument('--sheet', help='where to draw the files that are two for one company, side by side')
    args = ap.parse_args()
    picks = dict(p.split('=', 1) for p in args.pick if '=' in p)
    if not args.logos and not args.people:
        ap.error('a folder of logos, of people, or both')
    logos, photos = kept('SUPPLIED_LOGOS'), kept('SUPPLIED_PHOTOS')
    unsure = False

    if args.logos:
        # (Two companies share a name. The one whose key is its name is the one a file of that name is for: portfolio.ts)
        companies = list(dict.fromkeys(names_in(os.path.join(ROOT, 'src', 'data', 'portfolio.ts'), 'c')))
        taken, lost, twice, review = match(files_in(args.logos), companies, picks)
        for where in ('', 'large'):
            os.makedirs(os.path.join(ROOT, 'public', 'logos', where), exist_ok=True)
        for name, path in taken.items():
            im = flat(squared(opened(path)))
            file = slug(name) + '.webp'
            im.resize((SMALL, SMALL), Image.LANCZOS).save(os.path.join(ROOT, 'public', 'logos', file), 'WEBP', quality=90, method=6)
            im.resize((LARGE, LARGE), Image.LANCZOS).save(os.path.join(ROOT, 'public', 'logos', 'large', file), 'WEBP', quality=88, method=6)
            logos[name] = file
        print('logos: %d files used, of %d' % (len(taken), len(taken) + len(lost) + len(review) + sum(len(v) for v in twice.values())))
        for path in lost:
            print('  not used (no company for it, or not the one picked):', os.path.basename(path))
        for path in review:
            print('  not used (marked REVIEW):', os.path.basename(path))
        for name, paths in sorted(twice.items()):
            print('  two for %s, neither used until one is picked: %s' % (name, ' | '.join(os.path.basename(p) for p in paths)))
        if twice and args.sheet:
            draw_pairs(twice, args.sheet)
            print('  drawn side by side in', args.sheet)
        without = [n for n in companies if n not in logos]
        if without:
            print('  companies with no supplied logo (they keep what they had): ' + ', '.join(without))
        unsure = unsure or bool(lost) or bool(twice)

    if args.people:
        people = names_in(os.path.join(ROOT, 'src', 'data', 'people.ts'), 'p')
        taken, lost, twice, review = match(files_in(args.people), people, picks)
        lost += review + [p for paths in twice.values() for p in paths]
        os.makedirs(os.path.join(ROOT, 'public', 'people'), exist_ok=True)
        for name, path in taken.items():
            # A square cut from the middle, as Shrug asked
            im = ImageOps.fit(flat(opened(path)), (FACE, FACE), Image.LANCZOS, centering=(0.5, 0.5))
            file = slug(name) + '.webp'
            im.save(os.path.join(ROOT, 'public', 'people', file), 'WEBP', quality=86, method=6)
            photos[name] = file
        print('people: %d files used, of %d' % (len(taken), len(taken) + len(lost)))
        for path in lost:
            print('  not used (nobody for it, or two for one person):', os.path.basename(path))
        without = [n for n in people if n not in photos]
        if without:
            print('  people with no photograph here (they keep their initials): ' + ', '.join(without))
        unsure = unsure or bool(lost)

    lines = [
        '// The pictures Shrug has supplied, as tools/pictures.py matched them to the names in the data: a',
        "// company's logo (public/logos, and the same larger in public/logos/large for the head of its card)",
        "// and a person's photograph (public/people). Written by that tool; run it again when a picture is",
        '// added or changed. A name that is not here keeps what it had: a logo found for it, or initials.',
        '',
    ]
    lines += ts_map('SUPPLIED_LOGOS', "A company's name to its logo's file.", logos) + ['']
    lines += ts_map('SUPPLIED_PHOTOS', "A person's name, as people.ts has it, to their photograph's file.", photos)
    with open(OUT, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines) + '\n')
    print('wrote', os.path.relpath(OUT, ROOT), '(%d logos, %d photographs)' % (len(logos), len(photos)))
    return 1 if unsure else 0


if __name__ == '__main__':
    sys.exit(main())
