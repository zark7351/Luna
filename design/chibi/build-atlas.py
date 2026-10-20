"""Pack a transparent PNG frame sequence into one WebP atlas for character.js.

Usage: python build-atlas.py <frames-dir> <out.webp> [--skip 1] [--crop x0,y0,x1,y1] [--width 270]
Frames are read in name order; --skip drops leading frames (the idle export's first frame has stray pixels).
The script only crops, scales and packs; alpha is kept as exported.
"""
import argparse, json, math, pathlib
from PIL import Image

p = argparse.ArgumentParser()
p.add_argument('frames')
p.add_argument('out')
p.add_argument('--skip', type=int, default=0)
p.add_argument('--crop', default='')
p.add_argument('--width', type=int, default=270)
p.add_argument('--columns', type=int, default=12)
p.add_argument('--quality', type=int, default=90)
a = p.parse_args()

files = sorted(pathlib.Path(a.frames).glob('*.png'))[a.skip:]
frames = [Image.open(f).convert('RGBA') for f in files]
if a.crop:
    box = tuple(int(v) for v in a.crop.split(','))
else:
    boxes = [f.getchannel('A').point(lambda v: 255 if v > 32 else 0).getbbox() for f in frames]
    box = (min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes))
w = a.width
h = round(w * (box[3] - box[1]) / (box[2] - box[0]))
rows = math.ceil(len(frames) / a.columns)
atlas = Image.new('RGBA', (w * a.columns, h * rows), (0, 0, 0, 0))
for i, f in enumerate(frames):
    atlas.paste(f.crop(box).resize((w, h), Image.LANCZOS), ((i % a.columns) * w, (i // a.columns) * h))
atlas.save(a.out, 'WEBP', quality=a.quality, alpha_quality=100, method=6)
print(json.dumps({'frames': len(frames), 'columns': a.columns, 'width': w, 'height': h, 'crop': box}))
