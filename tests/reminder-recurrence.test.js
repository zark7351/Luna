const test = require('node:test'),
  assert = require('node:assert/strict');

const fs = require('node:fs/promises'),
  os = require('node:os'),
  path = require('node:path');

const { createReminders } = require('../reminders');

const { nextOccurrence } = require('../reminder-schedule');

const at = (year, month, day, hour = 9, minute = 0) => new Date(year, month - 1, day, hour, minute).getTime();

async function fixture(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'claudy-repeat-'));

  t.after(() => fs.rm(dir, { recursive: true, force: true }));

  return dir;
}

test('每天和每周多选按本地时刻跨月跨年计算，恰好到点时下一次为后续日期', () => {
  assert.equal(nextOccurrence({ kind: 'daily', time: '09:00' }, at(2026, 12, 31, 9)), at(2027, 1, 1));

  assert.equal(
    nextOccurrence({ kind: 'weekly', time: '08:30', days: [1, 5] }, at(2026, 11, 2, 9)),

    at(2026, 11, 6, 8, 30)
  );

  assert.equal(
    nextOccurrence({ kind: 'weekly', time: '08:30', days: [1, 5] }, at(2026, 11, 6, 8, 30)),

    at(2026, 11, 9, 8, 30)
  );

  for (const rule of [
    { kind: 'weekly', time: '09:00', days: [] },

    { kind: 'daily', time: '25:00' },

    { kind: 'weekly', time: '09:00', days: ['1'] },

    { kind: 'other', time: '09:00' }
  ])
    assert.throws(() => nextOccurrence(rule, at(2026, 11, 1)));
});

test('重启跨过多次只补一条；完成本次跳到下次，连点气泡不能跳过下次', async t => {
  const dir = await fixture(t);

  let now = at(2026, 11, 1, 8),
    calls = 0;

  let reminders = await createReminders(dir, { now: () => now });

  const saved = await reminders.save({ title: '早安', recurrence: { kind: 'daily', time: '09:00' } });

  assert.equal(saved.dueAt, at(2026, 11, 1));

  reminders.stop();

  now = at(2026, 11, 5, 10);

  reminders = await createReminders(dir, { now: () => now, onDue: () => calls++ });

  await reminders.check();

  await reminders.check();

  assert.equal(calls, 1);

  const result = await Promise.allSettled([
    reminders.action({ id: saved.id, action: 'complete' }, true),

    reminders.action({ id: saved.id, action: 'complete' }, true)
  ]);

  assert.deepEqual(
    result.map(x => x.status),

    ['fulfilled', 'rejected']
  );

  assert.equal(reminders.list()[0].dueAt, at(2026, 11, 6));

  assert.equal(reminders.list()[0].status, 'pending');

  const loaded = await createReminders(dir, { now: () => now });

  assert.equal(loaded.list()[0].recurrence.time, '09:00');
});

test('延后只影响本次，不改变周规则；编辑及返回数据均不泄漏嵌套引用', async t => {
  const dir = await fixture(t);

  let now = at(2026, 11, 2, 8);

  const reminders = await createReminders(dir, { now: () => now });

  const saved = await reminders.save({ title: '周一', recurrence: { kind: 'weekly', time: '09:00', days: [1] } });

  saved.recurrence.days.push(2);

  const list = reminders.list();

  list[0].recurrence.days.push(3);

  assert.deepEqual(reminders.list()[0].recurrence.days, [1]);

  now = at(2026, 11, 2);

  await reminders.check();

  await reminders.action({ id: saved.id, action: 'snooze' });

  assert.equal(reminders.list()[0].dueAt, at(2026, 11, 2, 9, 5));

  now = at(2026, 11, 2, 9, 5);

  await reminders.check();

  await reminders.action({ id: saved.id, action: 'complete' }, true);

  assert.equal(reminders.list()[0].dueAt, at(2026, 11, 9));

  await reminders.save({ id: saved.id, title: '单次', dueAt: now + 60000 });

  assert.equal(reminders.list()[0].recurrence, undefined);

  await assert.rejects(
    reminders.save({
      title: '错误',

      mode: 'countdown',

      durationSeconds: 60,

      recurrence: { kind: 'daily', time: '09:00' }
    })
  );
});

test('撤销的工作日规则保留当前一次，已暂停的规则转为已完成，迁移不发通知', async t => {
  const dir = await fixture(t);

  let calls = 0;

  const now = at(2027, 1, 1, 8);

  const rows = [
    {
      id: 'work',

      title: '旧工作日',

      mode: 'scheduled',

      dueAt: now + 60000,

      status: 'pending',

      recurrence: { kind: 'workday', time: '09:00' }
    },

    {
      id: 'rest',

      title: '旧非工作日',

      mode: 'scheduled',

      dueAt: now - 60000,

      status: 'fired',

      recurrence: { kind: 'restday', time: '09:00' }
    },

    {
      id: 'blocked',

      title: '已暂停',

      mode: 'scheduled',

      dueAt: now - 60000,

      status: 'pending',

      recurrenceBlocked: true,

      recurrence: { kind: 'workday', time: '09:00' }
    }
  ];

  await fs.writeFile(path.join(dir, 'reminders.json'), JSON.stringify(rows));

  const reminders = await createReminders(dir, { now: () => now, onChange: () => calls++ });

  assert.equal(calls, 0);

  assert.equal(reminders.list().find(x => x.id === 'work').dueAt, now + 60000);

  assert.equal(reminders.list().find(x => x.id === 'rest').status, 'fired');

  assert.equal(reminders.list().find(x => x.id === 'blocked').status, 'done');

  const saved = JSON.parse(await fs.readFile(path.join(dir, 'reminders.json'), 'utf8'));

  assert.ok(saved.every(x => !Object.hasOwn(x, 'recurrence') && !Object.hasOwn(x, 'recurrenceBlocked')));

  for (const kind of ['workday', 'restday'])
    await assert.rejects(reminders.save({ title: '不支持', recurrence: { kind, time: '09:00' } }), /规则无效/);

  await reminders.action({ id: 'rest', action: 'complete' }, true);

  assert.equal(reminders.list().find(x => x.id === 'rest').status, 'done');
});
