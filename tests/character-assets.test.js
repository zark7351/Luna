const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const assets = require('../character-assets');

test('每个姿势图集尺寸与帧布局一致，且为透明 WebP', () => {
  for (const [name, pose] of Object.entries(assets.poses)) {
    const bytes = fs.readFileSync(path.join(__dirname, '..', 'assets', pose.file));
    assert.equal(bytes.toString('ascii', 0, 4), 'RIFF', name);
    assert.equal(bytes.toString('ascii', 8, 12), 'WEBP', name);
    assert.equal(bytes.toString('ascii', 12, 16), 'VP8X', name);
    assert.ok(bytes[20] & 0x10, name + ' has alpha');
    const width = bytes.readUIntLE(24, 3) + 1,
      height = bytes.readUIntLE(27, 3) + 1;
    assert.equal(width, assets.stage.width * pose.columns, name);
    assert.equal(height, assets.stage.height * Math.ceil(pose.frames / pose.columns), name);
  }
  assert.ok(assets.poses.idle);
});

test('默认 2D 托腮待机保留横向比例，以 24fps 顺序播放完整八秒', () => {
  assert.equal(assets.poses.idle.file, 'luna-2d/idle.webp');
  assert.equal(assets.stage.width / assets.stage.height, 768 / 584);
  assert.equal(assets.poses.idle.frames / assets.poses.idle.fps, 8);
  assert.equal(assets.frameAt(assets.poses.idle, 0), 0);
  assert.equal(assets.frameAt(assets.poses.idle, 7.99), 191);
  assert.equal(assets.frameAt(assets.poses.idle, 8), 0);
});

test('缺少素材的表情回退到待机姿势', () => {
  assert.equal(assets.poseFor('neutral'), 'idle');
  for (const expression of ['happy', 'shy', 'pout', 'sleeping', 'working', 'missing'])
    assert.ok(Object.hasOwn(assets.poses, assets.poseFor(expression)), expression);
});

test('往返循环不重复首尾帧，单次播放停在最后一帧', () => {
  const pose = { frames: 4, columns: 4, fps: 10, loop: 'pingpong' };
  assert.deepEqual(
    Array.from({ length: 8 }, (_, i) => assets.frameAt(pose, i / 10)),
    [0, 1, 2, 3, 2, 1, 0, 1]
  );
  assert.equal(assets.frameAt({ ...pose, loop: 'loop' }, 0.5), 1);
  assert.equal(assets.frameAt({ ...pose, loop: 'once' }, 5), 3);
  assert.equal(assets.frameAt(pose, -1), 0);
});

test('非法素材路径和帧布局在加载前拒绝', () => {
  const valid = { file: 'chibi/idle.webp', frames: 2, columns: 2, fps: 24, loop: 'pingpong' };
  assert.equal(assets.validatePose(valid), valid);
  for (const invalid of [
    { ...valid, file: '../other.webp' },
    { ...valid, file: 'https://example.com/a.webp' },
    { ...valid, frames: 0 },
    { ...valid, columns: 1.5 },
    { ...valid, fps: Infinity },
    { ...valid, loop: 'bounce' }
  ])
    assert.throws(() => assets.validatePose(invalid));
  assert.throws(() =>
    assets.validateImage(valid, { naturalWidth: assets.stage.width, naturalHeight: assets.stage.height })
  );
  assert.ok(Object.isFrozen(assets.poses.idle));
});

test('微笑短暂显现并平滑收回，减少动态效果时不渐变，始终复用待机时钟', () => {
  assert.equal(assets.poseFor('smile'), 'idle');
  assert.equal(assets.smileOpacity(-1), 0);
  assert.equal(assets.smileOpacity(0), 0);
  assert.equal(assets.smileOpacity(90), 0.5);
  assert.equal(assets.smileOpacity(500), 1);
  assert.equal(assets.smileOpacity(2390), 0.5);
  assert.equal(assets.smileOpacity(2600), 0);
  assert.equal(assets.smileOpacity(0, true), 1);
  assert.equal(assets.smileOpacity(2600, true), 0);
  const bytes = fs.readFileSync(path.join(__dirname, '..', 'assets', assets.smile.file));
  assert.deepEqual([bytes.readUInt32BE(16), bytes.readUInt32BE(20)], assets.smile.sourceSize);
});
