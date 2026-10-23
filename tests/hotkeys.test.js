const { test } = require('node:test');
const assert = require('node:assert/strict');
const schema = require('../hotkeys');
const { validate, migrateState } = require('../core');
const { createHotkeyManager } = require('../hotkey-manager');
function fixture() {
  const callbacks = new Map(),
    occupied = new Set(),
    dispatched = [];
  const registry = {
    register(key, callback) {
      if (occupied.has(key) || callbacks.has(key)) return false;
      callbacks.set(key, callback);
      return true;
    },
    unregister(key) {
      callbacks.delete(key);
    }
  };
  const manager = createHotkeyManager(registry, action => dispatched.push(action));
  manager.start(schema.defaults);
  return { manager, callbacks, occupied, dispatched };
}
test('only screenshot, recording and collection have default bindings; legacy opt-out survives migration', () => {
  assert.deepEqual(validate({}).hotkeys, {
    screenshot: 'Ctrl+Alt+A',
    recording: 'Ctrl+Alt+R',
    library: 'Ctrl+Alt+C',
    reminder: '',
    pureMode: ''
  });
  const old = migrateState({ settings: { screenshotShortcut: false } });
  assert.equal(old.settings.hotkeys.screenshot, '');
  assert.equal(old.settings.hotkeys.recording, schema.defaults.recording);
  assert.deepEqual(migrateState(JSON.parse(JSON.stringify(old))), old);
  const custom = validate({ hotkeys: { ...schema.defaults, reminder: 'Ctrl+Shift+T', pureMode: 'F9' } });
  assert.deepEqual(migrateState({ settings: custom }).settings, custom);
});
test('normalization rejects duplicate, malformed, plain text and reserved shortcuts', () => {
  assert.equal(schema.normalize('alt+control+a'), 'Ctrl+Alt+A');
  assert.equal(schema.normalize('Win+Shift+F12'), 'Shift+Super+F12');
  assert.equal(schema.normalize('F24'), 'F24');
  assert.equal(schema.fromEvent({ code: 'KeyQ', ctrlKey: true, altKey: true }), 'Ctrl+Alt+Q');
  for (const key of [
    'A',
    'Shift+A',
    'Ctrl',
    'Ctrl++A',
    'Ctrl+Ctrl+A',
    'Alt+F4',
    'Ctrl+Alt+Delete',
    'Super+L',
    'Ctrl+F25'
  ])
    assert.throws(() => schema.normalize(key), undefined, key);
  assert.throws(() => schema.validate({ ...schema.defaults, reminder: 'control+alt+a' }), /重复/);
  assert.equal(schema.migrate({ ...schema.defaults, reminder: 'Ctrl+Alt+A', pureMode: 'invalid' }).reminder, '');
});
test('failed registration releases newly acquired keys and leaves working configuration intact', () => {
  const { manager, occupied, callbacks } = fixture();
  occupied.add('Ctrl+Alt+Q');
  assert.throws(
    () => manager.prepare({ ...schema.defaults, screenshot: 'Ctrl+Alt+S', recording: 'Ctrl+Alt+Q' }),
    /被占用/
  );
  assert.deepEqual([...callbacks.keys()].sort(), Object.values(schema.defaults).filter(Boolean).sort());
  assert.equal(manager.status().bindings.screenshot.accelerator, schema.defaults.screenshot);
  manager.stop();
});
test('settings persistence rollback and swapped assignments preserve the previous registrations', async () => {
  const { manager, callbacks, dispatched } = fixture();
  const change = manager.prepare({ ...schema.defaults, screenshot: 'Ctrl+Alt+S' });
  change.rollback();
  assert.equal(callbacks.has('Ctrl+Alt+S'), false);
  assert.equal(callbacks.has('Ctrl+Alt+A'), true);
  manager
    .prepare({ ...schema.defaults, screenshot: schema.defaults.library, library: schema.defaults.screenshot })
    .commit();
  callbacks.get('Ctrl+Alt+A')();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(dispatched, ['library']);
  manager.stop();
});
test('capture suspends own keys, resume reports external occupation, and stop releases all keys', async () => {
  const { manager, callbacks, occupied, dispatched } = fixture();
  const stale = callbacks.get('Ctrl+Alt+A');
  manager.suspend();
  assert.equal(callbacks.size, 0);
  stale();
  occupied.add('Ctrl+Alt+A');
  manager.resume();
  assert.equal(manager.status().bindings.screenshot.available, false);
  assert.equal(manager.status().bindings.recording.available, true);
  manager.stop();
  manager.resume();
  stale();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(dispatched, []);
  assert.equal(callbacks.size, 0);
});
test('empty binding never registers; startup conflict does not stop other actions', () => {
  const callbacks = new Map();
  const manager = createHotkeyManager(
    {
      register(key, fn) {
        if (key === schema.defaults.screenshot) return false;
        callbacks.set(key, fn);
        return true;
      },
      unregister(key) {
        callbacks.delete(key);
      }
    },
    () => {}
  );
  manager.start(schema.defaults);
  assert.equal(manager.status().bindings.screenshot.enabled, true);
  assert.equal(manager.status().bindings.screenshot.available, false);
  assert.equal(callbacks.size, 2);
  manager.stop();
});
