"""Draws the desktop's wallpaper: sheets of colour rising across one another, each lit along its
crest and shading the one behind, with a light coming up behind them, in the manner of a Mac's
abstract wallpapers. Original artwork: every pixel is computed here.
Usage: wallpaper.py <out> <width> <height>"""
import sys
import numpy as np
from PIL import Image

out, W, H = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])

def hexc(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], dtype=np.float64) / 255.0

def smooth(a, b, x):
    t = np.clip((x - a) / (b - a), 0.0, 1.0)
    return t * t * (3 - 2 * t)

def mix(c0, c1, t):
    return c0 + (c1 - c0) * t[..., None]

# the page, 1.6 wide by 1 tall, sampled at pixel centres
ys, xs = np.mgrid[0:H, 0:W].astype(np.float64)
x = (xs + 0.5) / H
y = (ys + 0.5) / H
aspect = W / H
px = 1.0 / H

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
img = img + (rng.random((H, W, 1)) - 0.5) * (1.1 / 255.0)

Image.fromarray((np.clip(img, 0, 1) * 255 + 0.5).astype(np.uint8), 'RGB').save(out, quality=int(sys.argv[4]) if len(sys.argv) > 4 else 90, method=6)
print(out, W, H)
