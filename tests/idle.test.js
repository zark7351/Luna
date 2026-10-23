const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { startIdleMonitor, sleepWindow } = require('../idle');
function fixture() {
  const powerMonitor = new EventEmitter(),
    messages = [];
  let seconds = 0,
    time = new Date(2026, 9, 23, 10).getTime(),
    allowed = true,
    destroyed = false,
    tick,
    cancelled = false;
  const window = {
    isDestroyed: () => destroyed,
    webContents: { send: (channel, value) => messages.push([channel, value]) }
  };
  const monitor = startIdleMonitor({
    powerMonitor,
    getWindow: () => window,
    readIdleSeconds: () => seconds,
    now: () => new Date(time),
    canSleep: () => allowed,
    schedule: (fn, delay) => {
      assert.equal(delay, 2000);
      tick = fn;
      return 42;
    },
    cancel: id => {
      assert.equal(id, 42);
      cancelled = true;
    }
  });
  return {
    monitor,
    powerMonitor,
    messages,
    tick: () => tick(),
    idle: n => (seconds = n),
    at: (hour, minute = 0, day = 23) => (time = new Date(2026, 9, day, hour, minute).getTime()),
    advance: n => (time += n * 1000),
    allow: value => (allowed = value),
    destroy: () => (destroyed = true),
    cancelled: () => cancelled
  };
}
test('sleep windows have exact local boundaries and keep the same night across midnight/month/year', () => {
  for (const [hour, minute, expected] of [
    [6, 59, true],
    [7, 0, false],
    [12, 29, false],
    [12, 30, true],
    [13, 59, true],
    [14, 0, false],
    [21, 59, false],
    [22, 0, true]
  ])
    assert.equal(!!sleepWindow(new Date(2026, 9, 23, hour, minute)), expected, `${hour}:${minute}`);
  assert.equal(sleepWindow(new Date(2026, 11, 31, 22)), sleepWindow(new Date(2027, 0, 1, 6, 59)));
});
test('daytime never sleeps even after prolonged inactivity, lock or suspend', () => {
  const f = fixture();
  f.monitor.check(true);
  f.idle(36000);
  for (const event of ['lock-screen', 'suspend', 'resume', 'unlock-screen']) f.powerMonitor.emit(event);
  f.tick();
  assert.deepEqual(f.messages, [['idle-changed', false]]);
  f.monitor.stop();
});
test('arrival sleeps immediately, ordinary keyboard/mouse activity does not wake or repeat events', () => {
  const f = fixture();
  f.at(12, 29);
  f.monitor.check(true);
  f.at(12, 30);
  f.tick();
  f.tick();
  assert.equal(f.monitor.isSleeping(), true);
  f.idle(0);
  f.advance(10);
  f.tick();
  assert.deepEqual(f.messages, [
    ['idle-changed', false],
    ['idle-changed', true]
  ]);
  f.at(14);
  f.tick();
  assert.equal(f.monitor.isSleeping(), false);
  f.monitor.stop();
});
test('click wakes, waits a full five idle minutes, and can repeat in the same sleep window', () => {
  const f = fixture();
  f.at(22);
  f.tick();
  f.monitor.wake();
  assert.equal(f.monitor.isSleeping(), false);
  f.idle(1000);
  f.tick();
  assert.equal(f.monitor.isSleeping(), false, 'old system idle time must not immediately put her back to sleep');
  f.advance(299);
  f.idle(299);
  f.tick();
  assert.equal(f.monitor.isSleeping(), false);
  f.advance(1);
  f.idle(300);
  f.tick();
  assert.equal(f.monitor.isSleeping(), true);
  f.monitor.wake();
  f.advance(301);
  f.idle(0);
  f.tick();
  assert.equal(f.monitor.isSleeping(), false, 'active user prevents re-sleep after waking');
  f.idle(300);
  f.tick();
  assert.equal(f.monitor.isSleeping(), true);
  f.monitor.stop();
  assert.equal(f.cancelled(), true);
});
test('startup in window sleeps; midnight, resume and clock changes re-evaluate the scheduled window', () => {
  const f = fixture();
  f.at(23);
  f.tick();
  f.monitor.wake();
  f.at(0, 1, 24);
  f.idle(0);
  f.tick();
  assert.equal(f.monitor.isSleeping(), false);
  f.at(7, 0, 24);
  f.powerMonitor.emit('resume');
  assert.equal(f.monitor.isSleeping(), false);
  f.at(12, 30, 24);
  f.powerMonitor.emit('unlock-screen');
  assert.equal(f.monitor.isSleeping(), true);
  f.at(14, 0, 24);
  f.tick();
  assert.equal(f.monitor.isSleeping(), false);
  f.at(22, 0, 24);
  f.tick();
  assert.equal(f.monitor.isSleeping(), true);
  f.monitor.stop();
});
test('due reminders hold awake and wait five idle minutes after completion', () => {
  const f = fixture();
  f.at(22);
  f.tick();
  f.allow(false);
  f.tick();
  assert.equal(f.monitor.isSleeping(), false);
  f.advance(600);
  f.idle(600);
  f.tick();
  assert.equal(f.monitor.isSleeping(), false);
  f.allow(true);
  f.advance(299);
  f.tick();
  assert.equal(f.monitor.isSleeping(), false);
  f.advance(1);
  f.tick();
  assert.equal(f.monitor.isSleeping(), true);
  f.monitor.stop();
});
test('destroyed windows and stopped monitors never receive late events and listeners are cleaned up', () => {
  const f = fixture();
  f.destroy();
  f.idle(500);
  f.tick();
  f.powerMonitor.emit('lock-screen');
  assert.deepEqual(f.messages, []);
  f.monitor.stop();
  f.monitor.stop();
  f.monitor.check(true);
  f.tick();
  f.powerMonitor.emit('unlock-screen');
  assert.deepEqual(f.messages, []);
  assert.equal(f.powerMonitor.eventNames().length, 0);
  assert.equal(f.cancelled(), true);
});
test('invalid idle readings do not change rest state', () => {
  const f = fixture();
  f.at(22);
  f.tick();
  f.monitor.wake();
  f.advance(600);
  f.messages.length = 0;
  for (const value of [NaN, Infinity, -1]) {
    f.idle(value);
    f.monitor.check();
  }
  assert.deepEqual(f.messages, []);
  f.monitor.stop();
});
