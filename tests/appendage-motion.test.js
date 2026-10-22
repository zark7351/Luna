const test = require('node:test'),
  assert = require('node:assert/strict');
const motion = require('../appendage-motion');
test('耳根固定，快速收耳后回弹并轻抖第二下，脸、手及另一只耳朵不变', () => {
  const point = [105, 70];
  assert.deepEqual(motion.deform(...point, { 'ear-left': 0 }), point);
  assert.deepEqual(motion.deform(...point, { 'ear-left': 0.52 }), point);
  assert.ok(motion.earAngle(0.07) < -0.2);
  assert.ok(motion.earAngle(0.18) > 0);
  assert.ok(Math.abs(motion.earAngle(0.32)) < Math.abs(motion.earAngle(0.07)));
  for (const fixed of [
    [210, 135],
    [228, 218],
    [180, 200],
    [247, 38],
    [129, 111]
  ])
    assert.deepEqual(motion.deform(...fixed, { 'ear-left': 0.07 }), fixed);
  assert.ok(Math.hypot(...motion.deform(...point, { 'ear-left': 0.07 }).map((v, i) => v - point[i])) > 3);
});
test('尾巴脉冲沿根部到尾尖传播，两端归零，不牵动脸手和耳朵', () => {
  const tip = [45, 150],
    base = [50, 233];
  assert.deepEqual(motion.deform(...tip, { tail: 0.1 }), tip);
  assert.notDeepEqual(motion.deform(...base, { tail: 0.1 }), base);
  assert.notDeepEqual(motion.deform(...tip, { tail: 0.4 }), tip);
  assert.deepEqual(motion.deform(...tip, { tail: 1.12 }), tip);
  for (const fixed of [
    [210, 135],
    [228, 218],
    [180, 200],
    [105, 70],
    [247, 38]
  ])
    assert.deepEqual(motion.deform(...fixed, { tail: 0.4 }), fixed);
});
test('同部位连点不叠加或延长，不同部位独立，结束与取消都释放状态', () => {
  let now = 0;
  const player = motion.createController({ now: () => now });
  assert.equal(player.play('ear-left'), true);
  now = 200;
  assert.equal(player.play('ear-left'), false);
  assert.equal(player.play('tail'), true);
  now = 530;
  assert.deepEqual(player.active, ['tail']);
  assert.equal(player.play('ear-left'), true);
  assert.equal(player.play('__proto__'), false);
  player.clear();
  assert.deepEqual(player.active, []);
  now = 2000;
  assert.deepEqual(player.times(), {});
});
