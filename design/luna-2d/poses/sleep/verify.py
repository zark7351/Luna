"""Validate deterministic sleep frames; reads generated artwork only, no application data."""
import json
import hashlib
import math
import sys
from pathlib import Path
from PIL import Image, ImageChops, ImageFilter

root = Path(__file__).resolve().parent
files = sorted((root / 'frames').glob('frame-*.png'))
assert len(files) == 144
first = Image.open(files[0]).convert('RGBA')
assert first.size == (768, 584)
maximum = 0
for file in files:
    image = Image.open(file).convert('RGBA')
    alpha = image.getchannel('A')
    for edge in [(0, 0, 768, 1), (0, 583, 768, 584), (0, 0, 1, 584), (767, 0, 768, 584)]:
        assert alpha.crop(edge).getbbox() is None, (file.name, 'clipped')
    # Runtime stage coordinates doubled: face/contact, both forearms, visible hand.
    for box in [(145, 180, 215, 220), (135, 225, 210, 240), (100, 240, 330, 270)]:
        bounds = tuple(value * 2 for value in box)
        channels = ImageChops.difference(first.crop(bounds), image.crop(bounds)).split()
        assert channels[3].getbbox() is None, (file.name, 'fixed alpha')
        delta = max(c.getextrema()[1] for c in channels[:3])
        assert delta <= 1, (file.name, box, delta)
        maximum = max(maximum, delta)

motion = {}
for name, box in {'breathing': (270, 145, 345, 210), 'ear': (175, 48, 237, 120),
                  'tail': (15, 135, 85, 225)}.items():
    bounds = tuple(value * 2 for value in box)
    motion[name] = any(max(c.getextrema()[1] for c in ImageChops.difference(
        first.crop(bounds), Image.open(file).convert('RGBA').crop(bounds)).split()) > 2 for file in files[::3])
    assert motion[name], name

# Sample the moving tail's opaque interior in source coordinates. A mask cut
# through the tail used to split its right side off, opening a diagonal crack.
# Stay in the rigid upper section, away from AA edges and the root transition.
source = Image.open(root / 'sleep-approved.png').convert('RGBA')
interior = source.getchannel('A').filter(ImageFilter.MinFilter(9))
points = [(x, y) for y in range(540, 681, 4) for x in range(40, 285, 4)
          if interior.getpixel((x, y)) >= 250]
assert len(points) > 500
minimum_tail_alpha = 255
atlas = Image.open(root.parents[3] / 'assets/luna-2d/sleep.webp').convert('RGBA') if '--atlas' in sys.argv else None
minimum_atlas_alpha = 255
for index, file in enumerate(files):
    alpha = Image.open(file).convert('RGBA').getchannel('A')
    angle = 0.032 * math.sin(index / 24 * 2 * math.pi / 6)
    for x, y in points:
        dx, dy = x - 135, y - 905
        px = 135 + math.cos(angle) * dx - math.sin(angle) * dy
        py = 905 + math.sin(angle) * dx + math.cos(angle) * dy
        pixel = (round((px + 52) / 1552 * 768), round((py + 80) / 1182 * 584))
        value = alpha.getpixel(pixel)
        assert value >= 180, (file.name, 'tail interior cracked', (x, y), pixel, value)
        minimum_tail_alpha = min(minimum_tail_alpha, value)
        if atlas is not None:
            pixel = (index % 12 * 384 + round((px + 52) / 1552 * 384),
                     index // 12 * 292 + round((py + 80) / 1182 * 292))
            value = atlas.getpixel(pixel)[3]
            assert value >= 180, (file.name, 'packed tail interior cracked', (x, y), pixel, value)
            minimum_atlas_alpha = min(minimum_atlas_alpha, value)

report = {'frames': len(files), 'fps': 24, 'durationSeconds': 6, 'size': first.size,
          'sourceSha256': hashlib.sha256((root / 'sleep-approved.png').read_bytes()).hexdigest(),
          'fixedFaceCheekArms': True, 'fixedRegionMaximumRgbDelta': maximum,
          'transparentBorder': True, 'motion': motion, 'tailCoreOpaque': True,
          'tailCoreSamplesPerFrame': len(points), 'minimumTailCoreAlpha': minimum_tail_alpha}
if atlas is not None:
    report.update(packedTailCoreOpaque=True, minimumPackedTailCoreAlpha=minimum_atlas_alpha)
(root / 'verification.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print(json.dumps(report))
