# Writes the lettering that icons carry as outlines (src/data/lettering.ts): PDF and MOV on a file's badge,
# and W/S, Workspace's mark. Drawn as shapes and not set as type, an icon is the same on every machine, and
# it is a picture all through: nothing in it is read out as words, or taken for a label.
# From the Inter the site ships (SIL Open Font License), shaped as a browser would shape it.
#   python3 tools/lettering.py      (needs fonttools, brotli and uharfbuzz: pip install fonttools brotli uharfbuzz)
import io
import os

import uharfbuzz as hb
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.recordingPen import DecomposingRecordingPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

HERE = os.path.dirname(os.path.abspath(__file__))
FONT = os.path.join(HERE, '..', 'node_modules', '@fontsource-variable', 'inter', 'files', 'inter-latin-wght-normal.woff2')
OUT = os.path.join(HERE, '..', 'src', 'data', 'lettering.ts')

# name, the letters, the weight, and the space taken out between letters (in ems)
WORDS = [
    ('PDF', 'PDF', 700, 0),
    ('MOV', 'MOV', 700, 0),
    ('W_S', 'W/S', 800, -1.5 / 31),
]


def outline(text, weight, tracking):
    font = instantiateVariableFont(TTFont(FONT), {'wght': weight}, inplace=False)
    font.flavor = None
    held = io.BytesIO()
    font.save(held)
    shaper = hb.Font(hb.Face(held.getvalue()))
    buf = hb.Buffer()
    buf.add_str(text)
    buf.guess_segment_properties()
    hb.shape(shaper, buf, {'kern': True})
    em = font['head'].unitsPerEm
    to = 1000 / em
    glyphs = font.getGlyphSet()
    order = font.getGlyphOrder()
    num = lambda v: ('%.1f' % v).rstrip('0').rstrip('.')
    # First where each letter falls, then the word moved so that its ink starts at nothing
    x = 0
    placed = []
    for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
        placed.append((order[info.codepoint], x + pos.x_offset))
        x += pos.x_advance + tracking * em
    bounds = BoundsPen(glyphs)
    for name, at in placed:
        glyphs[name].draw(TransformPen(bounds, (1, 0, 0, 1, at, 0)))
    x0, y0, x1, y1 = bounds.bounds
    pen = SVGPathPen(glyphs, ntos=num)
    for name, at in placed:
        # (a font's y runs up the page: turned the right way up for a drawing, the baseline at nothing)
        glyphs[name].draw(TransformPen(pen, (to, 0, 0, -to, (at - x0) * to, 0)))
    return pen.getCommands(), round((x1 - x0) * to, 1), round(y1 * to, 1), abs(round(-y0 * to, 1))


def main():
    lines = [
        '// The lettering that icons carry, as outlines: PDF and MOV on a file\'s badge, and W/S, Workspace\'s mark.',
        '// Written by tools/lettering.py from the Inter the site ships (SIL Open Font License). Drawn as shapes',
        '// and not set as type, an icon is the same on every machine, and a picture all through: nothing in it is',
        '// read out as words or taken for a label. (VIP\'s letters, in logo.ts, are drawn the same way.)',
        '',
        'export interface Lettering {',
        '  /** Its outline: a thousand units to the em, from its own left edge, the baseline at nothing, y running down. */',
        '  d: string',
        '  /** How wide its ink is, how far it rises above the baseline and how far it falls below. */',
        '  width: number',
        '  rise: number',
        '  fall: number',
        '}',
        '',
    ]
    for name, text, weight, tracking in WORDS:
        d, width, rise, fall = outline(text, weight, tracking)
        lines.append('/** "%s", weight %d. */' % (text, weight))
        lines.append("export const %s: Lettering = { width: %s, rise: %s, fall: %s, d: '%s' }" % (name, width, rise, fall, d))
    lines += [
        '',
        '/** Where to put a piece of lettering so that it is set at `size`, centered on `x`, its baseline at `y`. */',
        'export const set = (word: Lettering, size: number, x: number, y: number) => `translate(${(x - (word.width * size) / 2000).toFixed(2)} ${y}) scale(${size / 1000})`',
        '',
    ]
    with open(OUT, 'w') as f:
        f.write('\n'.join(lines))
    print('wrote', os.path.relpath(OUT, os.path.join(HERE, '..')))


if __name__ == '__main__':
    main()
