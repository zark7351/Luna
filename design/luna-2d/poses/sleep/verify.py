"""Validate deterministic sleep frames; reads generated artwork only, no application data."""
import json
from pathlib import Path
from PIL import Image, ImageChops

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
    for box in [(160, 190, 230, 225), (100, 230, 330, 270)]:
        bounds = tuple(value * 2 for value in box)
        channels = ImageChops.difference(first.crop(bounds), image.crop(bounds)).split()
        assert channels[3].getbbox() is None, (file.name, 'fixed alpha')
        delta = max(c.getextrema()[1] for c in channels[:3])
        assert delta <= 1, (file.name, box, delta)
        maximum = max(maximum, delta)

motion = {}
for name, box in {'breathing': (270, 150, 360, 220), 'ear': (180, 50, 240, 110)}.items():
    bounds = tuple(value * 2 for value in box)
    motion[name] = any(max(c.getextrema()[1] for c in ImageChops.difference(
        first.crop(bounds), Image.open(file).convert('RGBA').crop(bounds)).split()) > 2 for file in files[::3])
    assert motion[name], name

report = {'frames': len(files), 'fps': 24, 'durationSeconds': 6, 'size': first.size,
          'fixedFaceCheekArms': True, 'fixedRegionMaximumRgbDelta': maximum,
          'transparentBorder': True, 'motion': motion}
(root / 'verification.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print(json.dumps(report))
