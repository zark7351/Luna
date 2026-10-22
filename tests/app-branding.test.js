const test = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path');
const { trayBitmap, APP_ID } = require('../app-branding');
test('托盘使用十四瓣花饰，圆心深棕、边角透明且边缘抗锯齿', () => {
  const data = trayBitmap(),
    pixel = (x, y) => [...data.subarray((y * 32 + x) * 4, (y * 32 + x + 1) * 4)];
  assert.deepEqual(pixel(16, 16), [20, 26, 42, 255]);
  assert.deepEqual(pixel(0, 0), [0, 0, 0, 0]);
  assert.ok(pixel(16, 3)[3] > 0);
  assert.ok(Array.from(data).some((alpha, index) => index % 4 === 3 && alpha > 0 && alpha < 255));
  assert.throws(() => trayBitmap(3));
  assert.equal(APP_ID, 'Claude.Companion.Desktop');
});
test('Windows 头像 ICO 有七种有效 PNG 尺寸，版本号与锁文件同步', () => {
  const data = fs.readFileSync(path.join(__dirname, '..', 'assets', 'claude.ico')),
    sizes = [16, 24, 32, 48, 64, 128, 256];
  assert.equal(data.readUInt16LE(2), 1);
  assert.equal(data.readUInt16LE(4), sizes.length);
  sizes.forEach((size, index) => {
    const entry = 6 + index * 16,
      start = data.readUInt32LE(entry + 12),
      length = data.readUInt32LE(entry + 8);
    assert.ok(start + length <= data.length);
    assert.equal(data.readUInt32BE(start + 16), size);
    assert.equal(data.readUInt32BE(start + 20), size);
    assert.equal(data[start + 25], 6);
  });
  assert.equal(require('../package.json').version, '1.0.0');
  assert.equal(require('../package-lock.json').packages[''].version, '1.0.0');
});
