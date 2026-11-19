# Reads each company's logo (public/logos) and writes down two colours for it: the ground the logo is
# drawn on (what the round face on its contact card is filled with, so that the logo can sit inside the
# circle and not be cut by it), and the colour its card is tinted, which is the logo's own colour taken
# down to where white words can be read on it, as a contact's card takes its colour from the picture.
# And for each picture that heads a card in place of a logo (public/posters), the colours of its top and foot.
#   python3 tools/logo-colours.py      (writes src/data/logoColours.ts; needs Pillow)
import colorsys
import glob
import math
import os
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
LOGOS = os.path.join(HERE, '..', 'public', 'logos')
OUT = os.path.join(HERE, '..', 'src', 'data', 'logoColours.ts')

# How light a card's page is: white on it is 5.9 to 1, and still 4.9 to 1 on the panes drawn over it
PAGE_LUMINANCE = 0.128
# A logo with no colour of its own gets a slate
NEUTRAL = (0.575, 0.11)


def luminance(rgb):
    def lin(c):
        c /= 255.0
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

    r, g, b = (lin(v) for v in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def at_luminance(h, s, target):
    """The colour of hue h and saturation s whose luminance is the target's."""
    lo, hi = 0.0, 1.0
    for _ in range(40):
        mid = (lo + hi) / 2
        rgb = tuple(round(v * 255) for v in colorsys.hls_to_rgb(h, mid, s))
        if luminance(rgb) < target:
            lo = mid
        else:
            hi = mid
    return tuple(round(v * 255) for v in colorsys.hls_to_rgb(h, (lo + hi) / 2, s))


def hexed(rgb):
    return '#%02x%02x%02x' % tuple(rgb)


def read(path):
    im = Image.open(path).convert('RGBA')
    flat = Image.new('RGBA', im.size, (255, 255, 255, 255))
    flat.alpha_composite(im)
    return flat.convert('RGB')


def ground_of(im):
    """The colour round the logo's edge, if its edge is one colour; None for a picture that runs to the edge."""
    w, h = im.size
    ring = 5
    px = im.load()
    # The corners are left out: a tile's own rounded corners show the page through them
    cut = round(w * 0.2)
    edge = []
    for x in range(cut, w - cut):
        for d in range(ring):
            edge.append(px[x, d])
            edge.append(px[x, h - 1 - d])
    for y in range(cut, h - cut):
        for d in range(ring):
            edge.append(px[d, y])
            edge.append(px[w - 1 - d, y])
    mean = tuple(sum(p[i] for p in edge) / len(edge) for i in range(3))
    spread = (sum(sum((p[i] - mean[i]) ** 2 for i in range(3)) for p in edge) / len(edge)) ** 0.5
    if spread > 10:
        return None
    # The middle value of each channel: a few stray pixels of the mark do not move it
    return tuple(sorted(p[i] for p in edge)[len(edge) // 2] for i in range(3))


def tint_of(im):
    """The logo's own colour, as a hue and how strong it is; NEUTRAL for a logo in black, white and gray."""
    small = im.resize((48, 48), Image.LANCZOS)
    bins = [0.0] * 36
    sums = [[0.0, 0.0, 0.0] for _ in range(36)]
    total = 0
    coloured = 0
    px = small.load()
    for y in range(small.height):
        for x in range(small.width):
            r, g, b = px[x, y]
            h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            total += 1
            if s < 0.28 or v < 0.22:
                continue
            coloured += 1
            weight = s * v
            i = int(h * 36) % 36
            bins[i] += weight
            # A hue is an angle: its mean is taken round the circle
            sums[i][0] += math.cos(h * math.tau) * weight
            sums[i][1] += math.sin(h * math.tau) * weight
            sums[i][2] += s * weight
    if coloured / total < 0.025:
        return NEUTRAL
    # The fullest run of three neighbouring hues
    best = max(range(36), key=lambda i: bins[i - 1] + bins[i] + bins[(i + 1) % 36])
    run = [(best - 1) % 36, best, (best + 1) % 36]
    weight = sum(bins[i] for i in run)
    hue = (math.atan2(sum(sums[i][1] for i in run), sum(sums[i][0] for i in run)) / math.tau) % 1.0
    sat = sum(sums[i][2] for i in run) / weight
    return (hue, max(0.13, min(0.34, sat * 0.4)))


def mean_of(im, box):
    px = im.crop(box).resize((24, 24), Image.LANCZOS).load()
    return tuple(round(sum(px[x, y][i] for x in range(24) for y in range(24)) / 576) for i in range(3))


def poster_of(im):
    """A picture that heads a card: the colour along its top (the phone's status bar is over it, in white,
    so it is taken down a little), and the colour the page under it is drawn in, which is the colour of the
    picture's own foot taken down to where white words can be read on it."""
    w, h = im.size
    top = mean_of(im, (0, 0, w, max(1, round(h * 0.06))))
    top = tuple(round(v * 0.72) for v in top)
    foot = mean_of(im, (0, round(h * 0.72), w, h))
    hue, light, sat = colorsys.rgb_to_hls(*(v / 255 for v in foot))
    return hexed(top), hexed(at_luminance(hue, min(sat, 0.4), min(luminance(foot), 0.105)))


def main():
    rows = []
    for path in sorted(glob.glob(os.path.join(LOGOS, '*.webp'))):
        im = read(path)
        ground = ground_of(im)
        hue, sat = tint_of(im)
        page = at_luminance(hue, sat, PAGE_LUMINANCE)
        rows.append((os.path.basename(path), hexed(ground) if ground else None, hexed(page)))
    hue, sat = NEUTRAL
    plain = hexed(at_luminance(hue, sat, PAGE_LUMINANCE))
    lines = [
        '// Two colours for each company\'s logo, read from the logo itself by tools/logo-colours.py: the ground',
        '// it is drawn on (null where the picture runs to its edges), and the colour its contact card is tinted.',
        '// Written by that tool; run it again when a logo is added or changed.',
        '',
        'export interface LogoColours {',
        '  /** What the logo sits on: the round face on its card is filled with it, and the logo drawn inside. */',
        '  ground: string | null',
        '  /** Its card\'s page: the logo\'s own colour, dark enough for white words. */',
        '  page: string',
        '}',
        '',
        '/** For a company with no logo: a slate. */',
        "export const PLAIN_PAGE = '%s'" % plain,
        '',
        'export const LOGO_COLOURS: Record<string, LogoColours> = {',
    ]
    for name, ground, page in rows:
        lines.append("  '%s': { ground: %s, page: '%s' }," % (name, "'%s'" % ground if ground else 'null', page))
    lines.append('}')
    posters = []
    for path in sorted(glob.glob(os.path.join(HERE, '..', 'public', 'posters', '*'))):
        if os.path.splitext(path)[1].lower() not in ('.webp', '.jpg', '.jpeg', '.png', '.avif'):
            continue
        top, page = poster_of(read(path))
        posters.append((os.path.basename(path), top, page))
    lines += [
        '',
        'export interface PosterColours {',
        '  /** Along the picture\'s top, where the status bar is. */',
        '  top: string',
        '  /** The page under the picture: the colour of its foot, dark enough for white words. */',
        '  page: string',
        '}',
        '',
        '/** The same for each picture that heads a card in place of a logo (public/posters). */',
        'export const POSTER_COLOURS: Record<string, PosterColours> = {' + ('' if posters else '}'),
    ]
    if posters:
        for name, top, page in posters:
            lines.append("  '%s': { top: '%s', page: '%s' }," % (name, top, page))
        lines.append('}')
    with open(OUT, 'w') as f:
        f.write('\n'.join(lines) + '\n')
    print('wrote', os.path.relpath(OUT), len(rows), 'logos,', len(posters), 'posters')


if __name__ == '__main__':
    sys.exit(main())
