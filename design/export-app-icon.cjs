const { app, nativeImage } = require('electron');
const { trayBitmap } = require('../app-branding');
const fs = require('node:fs'),
  path = require('node:path'),
  os = require('node:os');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'luna-icon-export-')));
try {
  // Deterministic export of the approved 2D portrait; keep its face and alpha unchanged.
  const portrait = nativeImage.createFromPath(path.join(__dirname, 'luna-2d', 'idle', 'base-transparent.png'));
  const source = portrait.crop({ x: 300, y: 0, width: 950, height: 950 });
  if (source.isEmpty() || source.getSize().width !== source.getSize().height) throw Error('Square avatar required');
  fs.writeFileSync(
    path.join(__dirname, '..', 'assets', 'claude-avatar.png'),
    source.resize({ width: 256, height: 256, quality: 'best' }).toPNG()
  );
  const sizes = [16, 24, 32, 48, 64, 128, 256],
    images = sizes.map(size => source.resize({ width: size, height: size, quality: 'best' }).toPNG());
  const header = Buffer.alloc(6 + 16 * sizes.length);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(sizes.length, 4);
  let offset = header.length;
  images.forEach((bytes, index) => {
    const entry = 6 + index * 16;
    header[entry] = sizes[index] === 256 ? 0 : sizes[index];
    header[entry + 1] = header[entry];
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(bytes.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += bytes.length;
  });
  fs.writeFileSync(path.join(__dirname, '..', 'assets', 'claude.ico'), Buffer.concat([header, ...images]));
  for (const size of [16, 32, 64, 256]) {
    const flower = nativeImage.createFromBitmap(trayBitmap(size), { width: size, height: size });
    fs.writeFileSync(path.join(__dirname, '..', 'assets', `claude-flower-${size}.png`), flower.toPNG());
  }
  console.log('Exported 256px PNG and seven-size Windows ICO.');
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
app.quit();
