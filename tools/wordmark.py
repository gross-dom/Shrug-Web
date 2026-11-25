# Writes a word as outlines in the brand's light face, to stand after SHRUG in a lockup (store/src/brand.tsx):
# CAPITAL, for SHRUG CAPITAL. The kit sets SHRUG in Unbounded Bold and what follows it in Unbounded Light;
# SHRUG, VIP and STORE are already kept as outlines, and this draws another word the same way, in the same
# units (1,000 to the em, the baseline at 766, y running down), starting where VIP starts.
#   python3 tools/wordmark.py CAPITAL path/to/unbounded-latin-300-normal.woff2
#   (the face is @fontsource/unbounded; needs fonttools, brotli and uharfbuzz)
import io
import sys

import uharfbuzz as hb
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

START = 4758  # where what follows SHRUG begins: VIP's own left edge
BASELINE = 766


def main(word, path):
    font = TTFont(path)
    font.flavor = None
    held = io.BytesIO()
    font.save(held)
    shaper = hb.Font(hb.Face(held.getvalue()))
    buf = hb.Buffer()
    buf.add_str(word)
    buf.guess_segment_properties()
    hb.shape(shaper, buf, {'kern': True})
    to = 1000 / font['head'].unitsPerEm
    glyphs = font.getGlyphSet()
    order = font.getGlyphOrder()
    x = 0
    placed = []
    for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
        placed.append((order[info.codepoint], x + pos.x_offset))
        x += pos.x_advance
    bounds = BoundsPen(glyphs)
    for name, at in placed:
        glyphs[name].draw(TransformPen(bounds, (1, 0, 0, 1, at, 0)))
    x0, y0, x1, y1 = bounds.bounds
    pen = SVGPathPen(glyphs, ntos=lambda v: str(int(round(v))))
    for name, at in placed:
        glyphs[name].draw(TransformPen(pen, (to, 0, 0, -to, START + (at - x0) * to, BASELINE)))
    print('cap height', font['OS/2'].sCapHeight * to, 'ends at', round(START + (x1 - x0) * to))
    print(pen.getCommands())


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
