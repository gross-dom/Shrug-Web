"""Several pictures on one sheet, each under its file name.
Usage: sheet.py <out.png> <columns> <scale> <picture> [<picture> ...]"""
import os
import sys
from PIL import Image, ImageDraw

out, cols, scale, files = sys.argv[1], int(sys.argv[2]), float(sys.argv[3]), sys.argv[4:]
tiles = []
for f in files:
    try:
        im = Image.open(f).convert('RGB')
    except Exception:
        continue
    im = im.resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))), Image.LANCZOS)
    tiles.append((os.path.splitext(os.path.basename(f))[0], im))
if not tiles:
    sys.exit('no pictures')
cw = max(t[1].width for t in tiles)
ch = max(t[1].height for t in tiles) + 18
rows = (len(tiles) + cols - 1) // cols
sheet = Image.new('RGB', (cols * (cw + 10) + 10, rows * (ch + 10) + 10), (38, 38, 44))
d = ImageDraw.Draw(sheet)
for i, (name, im) in enumerate(tiles):
    x = 10 + (i % cols) * (cw + 10)
    y = 10 + (i // cols) * (ch + 10)
    d.text((x, y), name[:48], fill=(235, 235, 240))
    sheet.paste(im, (x, y + 16))
sheet.save(out)
print(out, sheet.size)
