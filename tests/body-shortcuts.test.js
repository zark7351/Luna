const test = require('node:test'),
  assert = require('node:assert/strict');
const shortcuts = require('../body-shortcuts');
const { regionAt, createReactions } = shortcuts;
test('点击部位只触发动画，不再有快捷功能配置', () => {
  assert.deepEqual(Object.keys(shortcuts).sort(), ['createReactions', 'regionAt', 'regions']);
  const r = createReactions();
  assert.deepEqual(
    ['head', 'chest', 'arms', 'forbidden', 'legs', 'feet'].map(region => r.click(region).expression),
    ['happy', 'shy', 'wink', 'shy', 'smile', 'pout']
  );
  assert.equal(r.click('tail'), null);
});
test('十秒内三次敏感点击必定生气，恰好十秒排除旧点击', () => {
  let time = 0;
  const r = createReactions({ now: () => time });
  r.click('chest');
  time = 6000;
  r.click('chest');
  time = 9999;
  assert.equal(r.click('chest').annoyed, true);
  r.reset();
  time = 0;
  r.click('chest');
  time = 6000;
  r.click('chest');
  time = 10000;
  assert.equal(r.click('chest').annoyed, false);
});
test('Q 版帧坐标区分头胸、两侧手臂、裙子与腿、脚；尾巴和非法点无作用', () => {
  assert.equal(regionAt(165, 100), 'head');
  assert.equal(regionAt(165, 185), 'chest');
  assert.equal(regionAt(110, 240), 'arms');
  assert.equal(regionAt(225, 250), 'arms');
  assert.equal(regionAt(165, 240), 'legs');
  assert.equal(regionAt(150, 300), 'legs');
  assert.equal(regionAt(165, 320), 'feet');
  assert.equal(regionAt(40, 200), null);
  assert.equal(regionAt(-1, 200), null);
  assert.equal(regionAt(165, NaN), null);
  assert.equal(regionAt(270, 100), null);
});
test('频繁点击胸部或禁区必定触发，其他部位不增加计数且重置有效', () => {
  let time = 1000;
  const r = createReactions({ now: () => time });
  assert.equal(r.click('head').expression, 'happy');
  assert.equal(r.click('chest').annoyed, false);
  r.click('arms');
  assert.equal(r.click('forbidden').annoyed, false);
  assert.equal(r.click('chest').annoyed, true);
  assert.equal(r.click('legs').expression, 'smile');
  time += 10001;
  assert.equal(r.click('chest').annoyed, false);
  r.reset();
  assert.equal(r.click('chest').annoyed, false);
});

test('禁区在衣物覆盖中央小范围内，与胸部共用敏感点击计数', () => {
  assert.equal(regionAt(165, 262), 'forbidden');
  assert.notEqual(regionAt(177, 262), 'forbidden');
  assert.notEqual(regionAt(165, 271), 'forbidden');
  assert.equal(regionAt(165, 290), 'legs');
  const r = createReactions({ random: () => 0 });
  assert.equal(r.click('forbidden').expression, 'shy');
  assert.equal(r.click('chest').annoyed, false);
  assert.equal(r.click('forbidden').annoyed, true);
  r.reset();
  assert.equal(r.click('forbidden').annoyed, false);
});
