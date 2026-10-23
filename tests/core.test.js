const { test } = require('node:test');
const assert = require('node:assert/strict');
const { defaults, validate, migrateState, WINDOW_WIDTH, WINDOW_HEIGHT } = require('../core');
const { validateMemory } = require('../life');

test('old chat and AI data are discarded while local settings remain', () => {
  const state = migrateState({
    settings: { name: '星露娜', nickname: '小星', top: false, online: true, baseUrl: 'https://example.com/v1' },
    key: 'old-key',
    history: [{ role: 'user', content: 'old chat' }],
    position: [100, 200]
  });
  assert.deepEqual(state, {
    settings: { ...defaults, name: '星露娜', nickname: '小星', top: false },
    layoutVersion: 3,
    life: validateMemory(),
    position: [447, 110]
  });
  assert.equal(Object.hasOwn(state, 'history'), false);
  assert.equal(Object.hasOwn(state, 'key'), false);
});

test('new position and settings stay stable on later launches', () => {
  const state = migrateState({ settings: defaults, layoutVersion: 2, position: [447, 200] });
  assert.deepEqual(state.position, [447, 110]);
  assert.deepEqual(migrateState(state), state);
  assert.deepEqual(validate({}), defaults);
  assert.equal(WINDOW_WIDTH, 280);
  assert.equal(WINDOW_HEIGHT, 640);
});

test('截图快捷键默认开启，关闭设置经过校验和重启迁移后保持', () => {
  assert.equal(validate({}).screenshotShortcut, true);
  const state = migrateState({ settings: { screenshotShortcut: false } });
  assert.equal(state.settings.screenshotShortcut, false);
  assert.equal(migrateState(JSON.parse(JSON.stringify(state))).settings.screenshotShortcut, false);
});

test('总声音开关默认开启，关闭后重启保持', () => {
  assert.equal(validate({}).soundEnabled, true);
  const state = migrateState({ settings: { soundEnabled: false } });
  assert.equal(state.settings.soundEnabled, false);
  assert.equal(migrateState(JSON.parse(JSON.stringify(state))).settings.soundEnabled, false);
});

test('旧信息条开关和身体快捷功能配置在迁移时清除', () => {
  const state = migrateState({
    settings: { infoBarEnabled: true, bodyShortcuts: { head: 'stats', feet: 'reminder' } },
    layoutVersion: 3,
    position: [100, 200]
  });
  assert.equal(Object.hasOwn(state.settings, 'infoBarEnabled'), false);
  assert.equal(Object.hasOwn(state.settings, 'bodyShortcuts'), false);
  assert.equal(Object.hasOwn(defaults, 'bodyShortcuts'), false);
  assert.deepEqual(migrateState(JSON.parse(JSON.stringify(state))), state);
});

test('换装已移除，旧状态里的发型和服装不再保存', () => {
  const state = migrateState({ settings: { hair: 'bob', outfit: 'nurse' } });
  assert.equal(Object.hasOwn(state.settings, 'hair'), false);
  assert.equal(Object.hasOwn(state.settings, 'outfit'), false);
});

test('恢复按需天气，仅保存有效城市坐标，排除 IP 与凭据', () => {
  const state = migrateState({
    settings: {
      weatherLocation: { name: '杭州', latitude: 30, longitude: 120, ip: 'private', token: 'secret' },
      recordFrameRate: 30
    }
  });
  assert.equal(state.settings.weatherLocation.name, '杭州');
  assert.equal(Object.hasOwn(state.settings.weatherLocation, 'ip'), false);
  assert.equal(Object.hasOwn(state.settings.weatherLocation, 'token'), false);
  assert.equal(validate({ weatherLocation: { name: 'bad', latitude: 999, longitude: 1 } }).weatherLocation, null);
  assert.equal(state.settings.recordFrameRate, 30);
});

test('精简模式默认关闭，保存与迁移保持且不接受字符串开启', () => {
  assert.equal(validate().pureMode, false);
  assert.equal(validate({ pureMode: 'true' }).pureMode, false);
  const state = migrateState({ settings: { pureMode: true } });
  assert.equal(state.settings.pureMode, true);
  assert.deepEqual(migrateState(JSON.parse(JSON.stringify(state))), state);
});
