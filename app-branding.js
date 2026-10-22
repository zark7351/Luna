const path = require('node:path');
const APP_ID = 'Claude.Companion.Desktop';
const appIcon = path.join(__dirname, 'assets', 'claude.ico');
// The fourteen-petal hair flower, matching the clean-mode SVG. Windows expects premultiplied BGRA.
function trayBitmap(size = 32) {
  if (!Number.isInteger(size) || size < 16 || size > 256) throw Error('Invalid tray size');
  const bytes = Buffer.alloc(size * size * 4);
  const petals = Array.from({ length: 14 }, (_, i) => {
    const angle = (i * Math.PI * 2) / 14;
    return [Math.cos(angle), Math.sin(angle)];
  });
  function color(x, y) {
    const radius = Math.hypot(x, y);
    if (radius <= 8) return [42, 26, 20];
    if (radius <= 10.5) return [212, 154, 58];
    for (const [cos, sin] of petals) {
      const px = x * cos + y * sin,
        py = -x * sin + y * cos + 16.5;
      if ((px / 6.1) ** 2 + (py / 12.5) ** 2 <= 1)
        return (px / 5.3) ** 2 + (py / 11.7) ** 2 <= 1 ? [255, 253, 250] : [89, 65, 52];
    }
    return null;
  }
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      let covered = 0;
      const rgb = [0, 0, 0];
      for (let sy = 0; sy < 4; sy++)
        for (let sx = 0; sx < 4; sx++) {
          const sample = color(((x + (sx + 0.5) / 4) * 64) / size - 32, ((y + (sy + 0.5) / 4) * 64) / size - 32);
          if (sample) {
            covered++;
            sample.forEach((value, i) => (rgb[i] += value));
          }
        }
      const alpha = Math.round((covered / 16) * 255),
        offset = (y * size + x) * 4;
      bytes[offset] = Math.round(rgb[2] / 16);
      bytes[offset + 1] = Math.round(rgb[1] / 16);
      bytes[offset + 2] = Math.round(rgb[0] / 16);
      bytes[offset + 3] = alpha;
    }
  return bytes;
}
function createTrayIcon(nativeImage) {
  return nativeImage.createFromBitmap(trayBitmap(), { width: 32, height: 32 });
}
module.exports = { APP_ID, appIcon, trayBitmap, createTrayIcon };
