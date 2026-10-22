const test = require('node:test'),
  assert = require('node:assert/strict');
const size = require('../pet-size');
const { migrateState, validate } = require('../core');
test('滚轮尺寸有上下限，非法输入不污染存储，设置与迁移保留大小', () => {
  assert.equal(size.next(1, -120), 1.1);
  assert.equal(size.next(1, 120), 0.9);
  assert.equal(size.normalize(200), 1.8);
  assert.equal(size.normalize(-2), 0.6);
  for (const input of [NaN, Infinity, '1.5', null, undefined]) assert.equal(size.normalize(input), 1);
  assert.equal(size.windowWidth(1), 280);
  assert.ok(size.windowWidth(1.8) >= 256 * 1.8 + 24);
  const state = migrateState({ settings: { petScale: 1.4, name: '小克' } });
  assert.equal(state.settings.petScale, 1.4);
  assert.deepEqual(migrateState(JSON.parse(JSON.stringify(state))), state);
  assert.equal(validate({ petScale: 0 }).petScale, 0.6);
});
test('品牌默认名迁移为克劳德，自定义称呼和其他本地设置保留', () => {
  assert.equal(migrateState({ settings: { name: '露娜' } }).settings.name, '克劳德');
  assert.equal(
    migrateState({ settings: { name: '小克', nickname: '主人', soundEnabled: false } }).settings.name,
    '小克'
  );
  assert.equal(validate({}).name, '克劳德');
});
