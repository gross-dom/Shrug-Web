# Brings the pictures for VIP in: python3 -I tools/vip.py <folder>. Each file is filed under the drop its
# name says, kept at the size it is shown at (public/vip), and written into src/data/drops.ts with the
# colour along its top edge.
import sys,os,re
from PIL import Image
src=sys.argv[1]; out='public/vip'; os.makedirs(out,exist_ok=True)
def drop(f):
    b=os.path.splitext(f)[0]
    m=re.match(r'(.*?)\s*(\d+)?$',b); name,n=m.group(1),int(m.group(2) or 0)
    if b=='Atoms x MKBHD': return 'Atoms x MKBHD',0
    if name=='Shrug Cal': return ('VC Puzzle' if n>=9 else 'Shrug Calendar'),n
    if name=='Others': return ('VC Sticker Pack' if n==3 else 'Other Drops'),n
    return {'Alt':'Alt x Shrug','Atoms':'Atoms x MKBHD','Billboard':'Billboards','Deep Tech Mat':'Deep Tech Mat','Feastables':'Feastables x Shrug'}[name],n
by={}
for f in sorted(os.listdir(src)):
    d,n=drop(f)
    im=Image.open(os.path.join(src,f)).convert('RGB'); im.thumbnail((1200,1600))
    slug=re.sub(r'[^a-z0-9]+','-',os.path.splitext(f)[0].lower()).strip('-')+'.webp'
    im.save(os.path.join(out,slug),'WEBP',quality=84,method=6)
    # The colour along the picture's top edge, under the shade the head of the library lays over it (22% black)
    top=im.resize((1,max(1,im.height)),Image.BOX).crop((0,0,1,max(1,im.height//25))).resize((1,1),Image.BOX).getpixel((0,0))
    edge='#%02x%02x%02x' % tuple(round(c*0.78) for c in top)
    by.setdefault(d,[]).append((n,slug,edge))
order=['Atoms x MKBHD','Deep Tech Mat','Feastables x Shrug','Billboards','Alt x Shrug','Shrug Calendar','VC Puzzle','VC Sticker Pack','Other Drops']
for d in by: by[d].sort()
rows=[]
while any(by.get(d) for d in order):
    for d in order:
        if by.get(d): rows.append((d,)+by[d].pop(0)[1:])
BIG=", 'big'"
lines="\n".join("  photo('%s', '%s', '%s'%s)," % (d,s,e,BIG if i==0 else '') for i,(d,s,e) in enumerate(rows))
p='src/data/drops.ts'; s=open(p).read()
a=s.index("// VIP: photos"); b=s.index("/** A drop's own colour")
new="""// VIP: photos from the people who got a drop, as they posted them. The pictures are Shrug's own
// (public/vip, kept at the size they are shown at), each filed under the drop it is of; they are set
// out a drop at a time in turn, so that no one drop fills the head of the grid. A slot with no file is
// still drawn (a quiet tile with the drop's name on it), but it is never counted: a count a visitor
// reads is of what has arrived.

export const DROPS = [%s]

export type MediaKind = 'photo' | 'video'

export interface MediaSlot {
  kind: MediaKind
  /** The drop it shows. */
  drop: string
  /** Who sent it. `null` until supplied. */
  from: string | null
  /** The file to show. `null` until supplied. */
  src: string | null
  /** The colour along the top edge of its picture, as it is drawn at the head of VIP on the iPhone (under
   * the shade laid over it there): what the browser's bar over it is given, so that the picture reads as
   * running to the very top of the screen. `null` where it has not been worked out. */
  edge: string | null
  /** How the tile sits in the grid. */
  span: '' | 'big' | 'tall' | 'wide'
}

const photo = (drop: string, file: string, edge: string, span: MediaSlot['span'] = ''): MediaSlot => ({ kind: 'photo', drop, from: null, src: `/vip/${file}`, edge, span })

export const MEDIA: MediaSlot[] = [
%s
]

""" % (', '.join("'%s'" % d for d in order), lines)
open(p,'w').write(s[:a]+new+s[b:])
print(len(rows),'pictures')
