# Writes the figures of the Lock Screen's clock as outlines (src/phone/clockFace.ts): 0 to 9 and the colon,
# from the Inter the site ships (its display cut, heavy), so that the clock is one size and one shape on
# every phone, whatever type the phone itself has. Inter is under the SIL Open Font License.
#   python3 tools/clock-face.py      (needs fonttools and brotli: pip install fonttools brotli)
import os
import sys

from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

HERE = os.path.dirname(os.path.abspath(__file__))
FONT = os.path.join(HERE, '..', 'node_modules', '@fontsource-variable', 'inter', 'files', 'inter-latin-opsz-normal.woff2')
OUT = os.path.join(HERE, '..', 'src', 'phone', 'clockFace.ts')
WEIGHT = 760
OPTICAL = 32


def main():
    font = instantiateVariableFont(TTFont(FONT), {'wght': WEIGHT, 'opsz': OPTICAL}, inplace=False)
    cap = font['OS/2'].sCapHeight
    glyphs = font.getGlyphSet()
    cmap = font.getBestCmap()
    rows = []
    for ch in '0123456789:':
        name = cmap[ord(ch)]
        bounds = BoundsPen(glyphs)
        glyphs[name].draw(bounds)
        x0, _, x1, _ = bounds.bounds
        # Each figure is moved to start at its own left edge, and turned the right way up for a drawing
        # (a font's y runs up the page), with its baseline at the height of a capital
        pen = SVGPathPen(glyphs, ntos=lambda v: ('%.1f' % v).rstrip('0').rstrip('.'))
        glyphs[name].draw(TransformPen(pen, (1, 0, 0, -1, -x0, cap)))
        advance = font['hmtx'][name][0]
        rows.append((ch, round(x1 - x0), round(x0), round(advance - x1), pen.getCommands()))
    lines = [
        '// The figures of the Lock Screen\'s clock, as outlines: 0 to 9 and the colon. Written by',
        '// tools/clock-face.py from the Inter the site ships (display cut, weight %d; SIL Open Font License).' % WEIGHT,
        '// Drawn as shapes and not set as type, the clock is the same size and shape on every phone.',
        '',
        '/** The height of a figure, in the units the outlines are drawn in. The round ones run a little over it, top and foot. */',
        'export const CAP = %d' % cap,
        '',
        'export interface Figure {',
        '  /** How wide its outline is. */',
        '  width: number',
        '  /** The space the face leaves before it and after it. */',
        '  before: number',
        '  after: number',
        '  /** Its outline, from its own left edge, the baseline at CAP. */',
        '  d: string',
        '}',
        '',
        'export const FIGURES: Record<string, Figure> = {',
    ]
    for ch, width, before, after, d in rows:
        lines.append("  '%s': { width: %d, before: %d, after: %d, d: '%s' }," % (ch, width, before, after, d))
    lines.append('}')
    with open(OUT, 'w') as f:
        f.write('\n'.join(lines) + '\n')
    print('wrote', os.path.relpath(OUT), len(rows), 'figures, cap', cap)


if __name__ == '__main__':
    sys.exit(main())
