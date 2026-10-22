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
test('尾巴绕固定根部整体轻甩，尾尖稍后跟随，温和回摆后归位', () => {
  const tip = [45, 150],
    root = [43, 262];
  for (const t of [0, motion.durations.tail, -1, NaN]) {
    assert.deepEqual(motion.deform(...tip, { tail: t }), tip);
  }
  for (const t of [0.1, 0.28, 0.5, 0.76, 1.1]) {
    assert.deepEqual(motion.deform(...root, { tail: t }), root);
    for (const fixed of [
      [210, 135],
      [228, 218],
      [180, 200],
      [105, 70],
      [247, 38]
    ]) {
      assert.deepEqual(motion.deform(...fixed, { tail: t }), fixed);
    }
  }
  assert.equal(motion.tailAngles(0.08)[1], 0);
  assert.ok(motion.tailAngles(0.28)[0] < -0.09);
  assert.ok(motion.tailAngles(0.38)[1] > 0.02);
  assert.ok(Math.abs(motion.tailAngles(0.76)[0]) < Math.abs(motion.tailAngles(0.28)[0]) / 3);
  assert.ok(motion.deform(...tip, { tail: 0.28 })[0] < tip[0] - 5);
  assert.ok(motion.deform(...tip, { tail: 0.76 })[0] > tip[0]);
});

test('尾巴条纹横截面不拉伸，甩动时上中段同向移动而非交替波纹', () => {
  const sections = [145, 165, 185];
  for (const t of [0.14, 0.28, 0.42, 0.9]) {
    for (const y of sections) {
      const a = motion.deform(35, y, { tail: t }),
        b = motion.deform(60, y, { tail: t });
      assert.ok(Math.abs(Math.hypot(b[0] - a[0], b[1] - a[1]) - 25) < 0.15);
    }
  }
  for (const t of [0.14, 0.28, 0.42]) {
    const offsets = sections.map(y => motion.deform(55, y, { tail: t })[0] - 55);
    assert.ok(offsets.every(dx => dx < 0));
  }
});

test('上方弯钩的长度和夹角保持不变，尾巴矩形里的头发也不参与变形', () => {
  const hook = [
    [45, 150],
    [85, 165],
    [76, 190]
  ];
  const hair = [
    [105, 160],
    [108, 185],
    [102, 205],
    [88, 220],
    [75, 240],
    [58, 253]
  ];
  for (const time of [0.14, 0.28, 0.52, 0.8, 1.1]) {
    for (let i = 0; i < hook.length; i++)
      for (let j = i + 1; j < hook.length; j++) {
        const a = hook[i],
          b = hook[j],
          p = motion.tailPoint(...a, time),
          q = motion.tailPoint(...b, time);
        assert.ok(Math.abs(Math.hypot(q[0] - p[0], q[1] - p[1]) - Math.hypot(b[0] - a[0], b[1] - a[1])) < 1e-9);
      }
    for (const point of hair) {
      assert.equal(motion.tailSample(...point), false);
      assert.deepEqual(motion.deform(...point, { tail: time }), point);
    }
  }
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
