const test = require('node:test'),
  assert = require('node:assert/strict');
const shortcuts = require('../body-shortcuts');
const { regionAt, createReactions } = shortcuts;
test('点击部位只触发动画，不再有快捷功能配置', () => {
  assert.deepEqual(Object.keys(shortcuts).sort(), ['createReactions', 'regionAt', 'regions']);
  const r = createReactions();
  assert.deepEqual(
    ['head', 'chest', 'arms'].map(region => r.click(region).expression),
    ['smile', 'shy', 'wink']
  );
  for (const region of ['ear-left', 'ear-right', 'tail']) assert.deepEqual(r.click(region), { expression: region });
});
test('连续点击始终保持普通反应，不累计生气或影响其他部位', () => {
  const r = createReactions();
  for (let i = 0; i < 30; i++) {
    assert.deepEqual(r.click('chest'), { expression: 'shy' });
    assert.deepEqual(r.click('head'), { expression: 'smile' });
    assert.deepEqual(r.click('arms'), { expression: 'wink' });
  }
  for (const region of ['forbidden', 'legs', 'feet', 'missing', '__proto__']) assert.equal(r.click(region), null);
});

test('2D 半身区分头胸、手臂、左右耳及尾巴，画面外和非法点无作用', () => {
  assert.equal(regionAt(210, 135), 'head');
  assert.equal(regionAt(250, 30), 'ear-right');
  assert.equal(regionAt(105, 70), 'ear-left');
  assert.equal(regionAt(228, 218), 'chest');
  assert.equal(regionAt(175, 214), 'arms');
  assert.equal(regionAt(275, 255), 'arms');
  assert.equal(regionAt(58, 180), 'tail');
  assert.equal(regionAt(66, 210), 'tail');
  assert.equal(regionAt(66, 240), 'tail');
  assert.equal(regionAt(228, 285), null);
  assert.equal(regionAt(-1, 200), null);
  assert.equal(regionAt(228, NaN), null);
  assert.equal(regionAt(384, 100), null);
  assert.equal(regionAt(228, 292), null);
});
test('托腮的手优先于脸颊和胸部，前臂不会误判为未露出的下半身', () => {
  assert.equal(regionAt(181, 187), 'arms');
  assert.equal(regionAt(193, 218), 'arms');
  assert.equal(regionAt(228, 262), 'arms');
  for (let y = 0; y < 292; y += 3)
    for (let x = 0; x < 384; x += 3) assert.ok(!['legs', 'feet', 'forbidden'].includes(regionAt(x, y)), `${x},${y}`);
});
