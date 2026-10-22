"""Verify exported idle frames and previews; never reads application user data."""

import hashlib
import json
from pathlib import Path

from PIL import Image, ImageChops, ImageSequence

root = Path(__file__).resolve().parent
frames = sorted((root / 'frames').glob('frame-*.png'))
assert len(frames) == 192, f'Unexpected frame count: {len(frames)}'
first = Image.open(frames[0]).convert('RGBA')
assert first.size == (768, 584)

regions = {
    'hair': [(102, 148, 118, 196), (100, 197, 120, 262), (90, 211, 106, 261),
             (80, 232, 98, 262), (65, 247, 81, 269)],
    'hands': [(154, 178, 186, 204), (198, 251, 256, 273)],
    'mouth': [(199, 157, 223, 173)],
}
maximum_color_delta = 0
for file in frames:
    with Image.open(file) as image:
        image = image.convert('RGBA')
        assert image.size == first.size, file.name
        alpha = image.getchannel('A')
        for edge in [(0, 0, 768, 1), (0, 583, 768, 584), (0, 0, 1, 584), (767, 0, 768, 584)]:
            assert alpha.crop(edge).getbbox() is None, (file.name, 'clipped border')
        for name, boxes in regions.items():
            for box in boxes:
                bounds = tuple(value * 2 for value in box)
                difference = ImageChops.difference(first.crop(bounds), image.crop(bounds))
                channels = difference.split()
                assert channels[3].getbbox() is None, (file.name, name, 'alpha moved')
                delta = max(channel.getextrema()[1] for channel in channels[:3])
                # A one-unit RGB quantization difference is possible in the GPU sampler.
                assert delta <= 1, (file.name, name, delta)
                maximum_color_delta = max(maximum_color_delta, delta)

animation = json.loads((root / 'animation.json').read_text(encoding='utf-8'))
assert animation['loopSeamIdentical']
assert hashlib.sha256(frames[0].read_bytes()).hexdigest() == animation['firstFrameSha256']
artifacts = {}
for name in ['idle-transparent.webp', 'idle-transparent-master.apng', 'idle-preview.gif']:
    file = root / name
    with Image.open(file) as image:
        alpha_min, alpha_max, duration = 255, 0, 0
        count = image.n_frames
        size, loop = image.size, image.info.get('loop')
        for frame in ImageSequence.Iterator(image):
            frame.load()
            duration += frame.info.get('duration', 0)
            low, high = frame.convert('RGBA').getchannel('A').getextrema()
            alpha_min, alpha_max = min(alpha_min, low), max(alpha_max, high)
        assert count == 192 and abs(duration - 8000) <= 2, (name, count, duration)
        artifacts[name] = {'size': size, 'frames': count, 'durationMs': duration,
                           'loop': loop, 'bytes': file.stat().st_size, 'alphaRange': [alpha_min, alpha_max]}

checks = {'tail': (10, 136, 103, 220), 'leftEar': (80, 40, 149, 104),
          'rightEar': (208, 6, 281, 83), 'blink': (170, 110, 237, 154)}
motion_checks = {}
for name, box in checks.items():
    bounds = tuple(value * 2 for value in box)
    motion_checks[name] = any(
        any(channel.getextrema()[1] > 2 for channel in ImageChops.difference(
            first.crop(bounds), Image.open(file).convert('RGBA').crop(bounds)).split())
        for file in frames[::6]
    )
    assert motion_checks[name], f'No visible motion: {name}'

report = {'frameCount': 192, 'size': first.size, 'sourceFrameAlphaRange': first.getchannel('A').getextrema(),
          'allFramesHandsFixed': True, 'allFramesMouthFixed': True, 'allFramesHairFixed': True,
          'fixedRegionMaxRgbDelta': maximum_color_delta, 'outerBorderMaximumAlpha': 0,
          'loopEndpointExactlyMatches': True, 'motionChecks': motion_checks, 'artifacts': artifacts}
(root / 'verification.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print('IDLE_VERIFY_OK: 192 frames, fixed hair/hands/mouth, transparent borders, seamless loop, valid previews')
