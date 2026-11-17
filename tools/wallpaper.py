"""Draws the site's wallpaper. Original artwork: every pixel is computed here, nothing is
traced or downloaded. Four pictures can be drawn, and each is laid out for the shape it is
asked for, so the same style serves the desktop (2880 x 1800) and the phone (900 x 1560):

  present  sheets of colour rising across one another, each lit along its crest and shading
           the one behind, with a light coming up behind them (what the site has now)
  glass    a deep blue ground crossed by a few large, soft petals of light, cyan through
           blue to violet, each a sheet of glass that catches the light along its edge
  sheets   the present one, refined: the same colours and rising sheets, with softer
           transitions, shadow and glow between the sheets, a little haze and a fine grain
  dusk     darker and calmer: near-black navy into plum, with one warm glow low down

Usage: wallpaper.py <out> <width> <height> [quality] [style]
  e.g. python3 tools/wallpaper.py public/wallpaper.webp 2880 1800 86
       python3 tools/wallpaper.py public/wallpaper-phone.webp 900 1560 86 glass"""
import sys
import numpy as np
from PIL import Image


def hexc(h, dtype=np.float64):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], dtype=dtype) / 255.0


def smooth(a, b, x):
    t = np.clip((x - a) / (b - a), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def mix(c0, c1, t):
    return c0 + (c1 - c0) * t[..., None]


def page(W, H, dtype=np.float64):
    """The page, one unit tall, sampled at pixel centres: x, y, how wide it is, and one pixel."""
    ys, xs = np.mgrid[0:H, 0:W].astype(dtype)
    return (xs + 0.5) / H, (ys + 0.5) / H, W / H, 1.0 / H


def upright(aspect):
    """0 for a phone held upright, 1 for a desktop: what a picture's layout is steered by."""
    return float(np.clip((aspect - 0.577) / (1.6 - 0.577), 0.0, 1.0))


def grain(img, seed, amount):
    """A fine grain, the same in every channel, so that nothing looks airbrushed and the long
    gradients never band. It has to be this strong to outlast the compression: at quality 86 a
    grain of one level is smoothed away and the bands come back; from about two and a half it
    stays. (The present style keeps the fainter one it was drawn with.)"""
    rng = np.random.default_rng(seed)
    h, w = img.shape[:2]
    return img + (rng.standard_normal((h, w, 1)).astype(img.dtype)) * (amount / 255.0)


# ---- present: what the site has now ----

def present(W, H):
    x, y, aspect, px = page(W, H)

    # the sky: night at the top, falling to a clear blue, with a light coming up on the right
    img = mix(hexc('#060a38'), hexc('#2148c9'), smooth(-0.05, 0.62, y - 0.10 * (x - aspect / 2)))
    sun = np.array([aspect * 0.635, 0.205])
    r = np.hypot((x - sun[0]) / 1.0, (y - sun[1]) / 0.80)
    img = img + (hexc('#6fb4ff') - img) * (np.exp(-(r / 0.50) ** 2) * 0.80)[..., None]
    img = img + (hexc('#bfe4ff') - img) * (np.exp(-(r / 0.22) ** 2) * 0.80)[..., None]
    img = img + (hexc('#fff6e6') - img) * (np.exp(-(r / 0.085) ** 2) * 0.92)[..., None]
    img = img + (hexc('#6a3fd6') - img) * (np.exp(-(((x - aspect * 0.10) / 0.55) ** 2 + ((y - 0.10) / 0.42) ** 2)) * 0.42)[..., None]

    # each sheet: where its crest runs, and its colours from the lit crest down into its depth,
    # shifting along its length from the first pair to the second
    SHEETS = [
        # base, tilt, amp, freq, phase, amp2, freq2, phase2, (rim, deep) at left, (rim, deep) at right, falloff
        (0.300, -0.050, 0.060, 2.30, 2.60, 0.016, 5.3, 0.6, ('#3f7bf0', '#1a3db8'), ('#7cc4ff', '#1f5fdc'), 0.40),
        (0.395, -0.105, 0.085, 2.05, 0.70, 0.020, 4.7, 2.1, ('#2f95ff', '#0f3fc0'), ('#3fe0ee', '#0f66d6'), 0.38),
        (0.520, -0.130, 0.090, 1.85, 3.60, 0.018, 4.3, 0.2, ('#8a6dff', '#2c14a8'), ('#bd8cff', '#4a22cc'), 0.34),
        (0.640, -0.150, 0.085, 2.00, 5.30, 0.016, 4.9, 1.7, ('#ff66b8', '#8a12a8'), ('#ff8fd0', '#b01fc0'), 0.30),
        (0.745, -0.165, 0.075, 2.20, 0.90, 0.014, 5.1, 3.9, ('#ffc56e', '#f2414a'), ('#ffb060', '#ff5a3c'), 0.26),
        (0.850, -0.150, 0.070, 1.90, 2.90, 0.016, 4.5, 5.2, ('#4d5fff', '#06083a'), ('#6474ff', '#090c4a'), 0.26),
    ]

    for base, tilt, amp, freq, phase, amp2, freq2, phase2, left, right, falloff in SHEETS:
        edge = base + tilt * (x - aspect / 2) + amp * np.sin(freq * x + phase) + amp2 * np.sin(freq2 * x + phase2)
        d = y - edge                       # how far below this sheet's crest (negative: above it)
        below = np.clip(d, 0, None)
        # the shadow it throws on what is behind, just above its crest
        img = img * (1 - np.exp(-np.clip(-d, 0, None) / 0.05) * (d < 0) * 0.34)[..., None]
        along = smooth(0.0, aspect, x)
        rim = mix(hexc(left[0]), hexc(right[0]), along)
        deep = mix(hexc(left[1]), hexc(right[1]), along)
        t = smooth(0.0, falloff, d) ** 0.8
        body = rim + (deep - rim) * t[..., None]
        # a soft light lying along the crest, never a hard line
        lit = np.exp(-below / 0.010) * 0.30 + np.exp(-below / 0.045) * 0.12
        body = body + (1.0 - body) * lit[..., None]
        cover = smooth(-1.0 * px, 1.0 * px, d)
        img = img + (body - img) * cover[..., None]

    # the corners fall away a little, as a lit scene does
    vig = 1.0 - 0.20 * smooth(0.60, 1.30, np.hypot((x - aspect / 2) / (aspect / 2), (y - 0.5) / 0.5))
    img = img * vig[..., None]

    # break up the long gradients so they never band once the file is compressed
    rng = np.random.default_rng(7)
    return img + (rng.random((H, W, 1)) - 0.5) * (1.1 / 255.0)


# ---- glass: petals of light on deep blue ----

def arc(x, y, left, mid, right, aspect):
    """How far inside the circle through three points a pixel is: the points are where an edge
    meets the left side of the page, crosses its middle and meets the right side, as heights.
    An edge that bows upward is the top of a mound; inside is below it. One that sags is the
    foot of a petal hanging from above; inside is above it."""
    ax, ay, bx, by, cx, cy = 0.0, left, aspect / 2, mid, aspect, right
    d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by))
    ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d
    uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d
    radius = float(np.hypot(ax - ux, ay - uy))
    return radius - np.hypot(x - ux, y - uy)


def glass(W, H):
    f = np.float32
    x, y, aspect, px = page(W, H, f)
    t = upright(aspect)
    at = lambda phone, desk: phone + (desk - phone) * t
    u = x / aspect
    c = lambda h: hexc(h, f)

    # the ground: almost black at the top, where the clock is, opening into a deep clear blue
    img = mix(c('#030617'), c('#081f78'), smooth(0.02, 0.95, y + 0.10 * (u - 0.5)))
    img = img + (c('#1746e8') - img) * (np.exp(-(((u - 0.30) / 0.62) ** 2 + ((y - 0.82) / 0.36) ** 2)) * 0.48)[..., None]
    img = img + (c('#33188c') - img) * (np.exp(-(((u - 0.95) / 0.55) ** 2 + ((y - 0.32) / 0.30) ** 2)) * 0.28)[..., None]

    # each petal: its edge (left, middle, right, for the phone and for the desktop), the light on
    # its edge and in its body, how deep the light reaches into it, how strong it is, and which
    # end of it the light comes from (+1 the right, -1 the left)
    PETALS = [
        ((0.600, 0.430, 0.340), (0.660, 0.390, 0.250), '#b59cff', '#6a3cf0', 0.30, 0.66, +1),
        ((0.470, 0.600, 0.900), (0.360, 0.540, 0.960), '#7db0ff', '#2a5cff', 0.28, 0.52, -1),
        ((0.840, 0.620, 0.500), (0.920, 0.610, 0.450), '#86ecff', '#0fb2ea', 0.32, 0.68, +1),
        ((0.740, 0.870, 1.080), (0.690, 0.850, 1.100), '#c4f6ff', '#2fd0f0', 0.26, 0.54, -1),
    ]
    for phone, desk, rim, body, depth, strength, lit in PETALS:
        s = arc(x, y, at(phone[0], desk[0]), at(phone[1], desk[1]), at(phone[2], desk[2]), aspect)
        inside = smooth(-1.2 * px, 1.2 * px, s)
        into = np.clip(s, 0, None)
        along = 0.50 + 0.50 * smooth(0.0, 1.0, u if lit > 0 else 1 - u)
        # what it does to what is behind it, just outside its edge: a shade, and closer in the
        # light that spills over the edge
        out = np.clip(-s, 0, None)
        img = img * (1 - np.exp(-out / 0.034) * (1 - inside) * 0.24)[..., None]
        img = img + (c(rim) - img) * (np.exp(-out / 0.007) * (1 - inside) * 0.16 * strength * along)[..., None]
        # glass: a faint tint right through it, light gathering toward its edge, and the edge itself
        tint = 0.045 + (0.36 * np.exp(-into / depth) + 0.24 * np.exp(-into / (depth * 0.20)) + 0.14 * np.exp(-into / (depth * 0.05))) * along
        light = mix(c(body), c(rim), np.exp(-into / (depth * 0.28)))
        img = 1 - (1 - img) * (1 - light * (tint * inside * strength)[..., None])
        edge = np.exp(-into / 0.0035) * inside * 0.50 * strength * along
        img = img + (c('#f2fbff') - img) * edge[..., None]

    # the corners fall away a little
    vig = 1.0 - 0.22 * smooth(0.55, 1.35, np.hypot((u - 0.5) / 0.5, (y - 0.5) / 0.5))
    img = img * vig[..., None]
    return grain(img, 11, 2.6)


# ---- sheets: the present one, refined ----

def sheets(W, H):
    f = np.float32
    x, y, aspect, px = page(W, H, f)
    t = upright(aspect)
    c = lambda h: hexc(h, f)

    # the sky: night at the top, falling to a clear blue; a light coming up behind the sheets,
    # softer than a sun, so that a clock in front of it still reads
    img = mix(c('#050830'), c('#2550d0'), smooth(-0.05, 0.64, y - 0.10 * (x - aspect / 2)))
    low = 0.040 * (1 - t)               # on a phone the far sheets sit a little lower, clear of the clock
    sun = (aspect * 0.640, 0.215 + 0.115 * (1 - t))
    r = np.hypot(x - sun[0], (y - sun[1]) / 0.80)
    img = img + (c('#5f9cff') - img) * (np.exp(-(r / (0.62 - 0.20 * (1 - t))) ** 2) * 0.60)[..., None]
    img = img + (c('#a9d2ff') - img) * (np.exp(-(r / (0.27 - 0.10 * (1 - t))) ** 2) * 0.58)[..., None]
    img = img + (c('#ffe9d2') - img) * (np.exp(-(r / (0.10 - 0.03 * (1 - t))) ** 2) * 0.66)[..., None]
    img = img + (c('#6a3fd6') - img) * (np.exp(-(((x - aspect * 0.10) / 0.55) ** 2 + ((y - 0.10) / 0.42) ** 2)) * 0.46)[..., None]
    haze = c('#a8b9ff')

    SHEETS = [
        # base, tilt, amp, freq, phase, amp2, freq2, phase2, (rim, deep) at left, (rim, deep) at right, falloff
        (0.300, -0.050, 0.060, 2.30, 2.60, 0.016, 5.3, 0.6, ('#4a84f2', '#1b3fb6'), ('#86c8ff', '#2260d8'), 0.42),
        (0.395, -0.105, 0.085, 2.05, 0.70, 0.020, 4.7, 2.1, ('#3a9bff', '#1242c0'), ('#55e2ee', '#126ad4'), 0.40),
        (0.520, -0.130, 0.090, 1.85, 3.60, 0.018, 4.3, 0.2, ('#957aff', '#2e16a6'), ('#c398ff', '#4c24c8'), 0.36),
        (0.640, -0.150, 0.085, 2.00, 5.30, 0.016, 4.9, 1.7, ('#ff78c0', '#86159f'), ('#ff9bd4', '#a922b6'), 0.32),
        (0.745, -0.165, 0.075, 2.20, 0.90, 0.014, 5.1, 3.9, ('#ffdca8', '#e2685c'), ('#ffd09a', '#ee6f58'), 0.28),
        (0.850, -0.150, 0.070, 1.90, 2.90, 0.016, 4.5, 5.2, ('#5a6bff', '#070938'), ('#7080ff', '#0a0d48'), 0.28),
    ]
    n = len(SHEETS)
    for i, (base, tilt, amp, freq, phase, amp2, freq2, phase2, left, right, falloff) in enumerate(SHEETS):
        far = 1 - i / (n - 1)               # 1 for the sheet furthest away, 0 for the nearest
        edge = base + low * far + tilt * (x - aspect / 2) + amp * np.sin(freq * x + phase) + amp2 * np.sin(freq2 * x + phase2)
        d = y - edge                       # how far below this sheet's crest (negative: above it)
        above = np.clip(-d, 0, None)
        below = np.clip(d, 0, None)
        along = smooth(0.0, aspect, x)
        rim = mix(c(left[0]), c(right[0]), along)
        deep = mix(c(left[1]), c(right[1]), along)
        # what it does to what is behind it: a close shadow under its crest and a wider, fainter
        # one, both toward night blue rather than black; then its own light, spilling over the crest
        shade = np.exp(-above / 0.016) * 0.34 + np.exp(-above / 0.085) * 0.22
        img = img + (img * c('#1a1560') - img) * (shade * (d < 0))[..., None]
        img = img + (rim - img) * (np.exp(-above / 0.010) * 0.16 * (d < 0))[..., None]
        # its body: from the lit crest into its depth, by way of a tone between the two
        k = smooth(0.0, falloff, d) ** 0.78
        middle = rim * 0.40 + deep * 0.60
        body = np.where((k < 0.45)[..., None], mix(rim, middle, k / 0.45), mix(middle, deep, (k - 0.45) / 0.55))
        # light lying along the crest, a wider sheen under it, and a fold further down that catches a little
        lit = np.exp(-below / 0.009) * 0.30 + np.exp(-below / 0.045) * 0.14 + np.exp(-below / 0.16) * 0.05
        fold = np.exp(-((d - falloff * (0.62 + 0.10 * np.sin(1.3 * x + i))) / 0.060) ** 2) * 0.045
        body = body + (1.0 - body) * (lit + fold)[..., None]
        # the further off it is, the more air there is in front of it
        body = body + (haze - body) * (0.13 * far ** 1.4)
        # and the light behind them all wraps a little round the far ones
        body = body + (c('#dcebff') - body) * (np.exp(-(r / 0.42) ** 2) * 0.16 * far)[..., None]
        cover = smooth(-(1.0 + 1.4 * far) * px, (1.0 + 1.4 * far) * px, d)
        img = img + (body - img) * cover[..., None]

    # the corners fall away a little, as a lit scene does
    vig = 1.0 - 0.22 * smooth(0.58, 1.32, np.hypot((x - aspect / 2) / (aspect / 2), (y - 0.5) / 0.5))
    img = img * vig[..., None]
    return grain(img, 13, 2.6)


# ---- dusk: dark and calm, with one warm glow ----

def dusk(W, H):
    f = np.float32
    x, y, aspect, px = page(W, H, f)
    t = upright(aspect)
    u = x / aspect
    c = lambda h: hexc(h, f)

    # the sky: nearly black at the top, through indigo, into plum low down. Each tone gives way
    # to the next over a long stretch that overlaps the one before, so there is no seam
    img = np.zeros((H, W, 3), f) + c('#03040d')
    for tone, y0, y1 in (('#080a24', -0.05, 0.42), ('#150f3c', 0.22, 0.66), ('#2c1348', 0.46, 0.84), ('#431a52', 0.66, 0.98)):
        img = img + (c(tone) - img) * smooth(y0, y1, y)[..., None]

    # the one warm glow, on the horizon and a little off centre: what is left of the day
    gx, gy = 0.57 + 0.05 * t, 0.735 + 0.035 * t
    wide = np.exp(-(((u - gx) / (1.25 - 0.45 * t)) ** 2 + ((y - gy) / 0.27) ** 2))
    near = np.exp(-(((u - gx) / (0.74 - 0.30 * t)) ** 2 + ((y - gy) / 0.120) ** 2))
    core = np.exp(-(((u - gx) / (0.42 - 0.20 * t)) ** 2 + ((y - gy) / 0.046) ** 2))
    img = img + (c('#8f2a66') - img) * (wide * 0.62)[..., None]
    img = img + (c('#e9604d') - img) * (near * 0.80)[..., None]
    img = img + (c('#ffbf78') - img) * (core * 0.88)[..., None]

    # ground in front of it: three dark rises, the same sheets the site has always had, at night,
    # each with the last of the light along its crest
    RISES = [
        # base, tilt, amp, freq, phase, tone, how much of the glow its crest takes
        (0.745, -0.050, 0.026, 2.2, 1.1, '#34174a', 0.55),
        (0.830, -0.085, 0.034, 1.9, 3.7, '#1f0d33', 0.40),
        (0.925, -0.060, 0.030, 2.4, 5.6, '#0f0719', 0.28),
    ]
    for base, tilt, amp, freq, phase, tone, takes in RISES:
        edge = base + 0.035 * t + tilt * (x - aspect / 2) + amp * np.sin(freq * x + phase)
        d = y - edge
        below = np.clip(d, 0, None)
        img = img + (img * c('#2a1038') - img) * (np.exp(-np.clip(-d, 0, None) / 0.030) * 0.30 * (d < 0))[..., None]
        body = mix(c(tone), c(tone) * 0.50, smooth(0.0, 0.20, d))
        toward = 0.20 + 0.80 * np.exp(-((u - gx) / 0.50) ** 2)
        body = body + (c('#ff9f6b') - body) * ((np.exp(-below / 0.006) * takes + np.exp(-below / 0.030) * takes * 0.22) * toward)[..., None]
        img = img + (body - img) * smooth(-1.2 * px, 1.2 * px, d)[..., None]

    # the corners fall away
    vig = 1.0 - 0.26 * smooth(0.50, 1.35, np.hypot((u - 0.5) / 0.5, (y - 0.5) / 0.5))
    img = img * vig[..., None]
    return grain(img, 17, 3.0)


STYLES = {'present': present, 'glass': glass, 'sheets': sheets, 'dusk': dusk}

if __name__ == '__main__':
    out, W, H = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
    quality = int(sys.argv[4]) if len(sys.argv) > 4 else 90
    style = sys.argv[5] if len(sys.argv) > 5 else 'present'
    if style not in STYLES:
        sys.exit(f'no such style: {style} (one of {", ".join(STYLES)})')
    img = STYLES[style](W, H)
    Image.fromarray((np.clip(img, 0, 1) * 255 + 0.5).astype(np.uint8), 'RGB').save(out, quality=quality, method=6)
    print(out, W, H, style)
