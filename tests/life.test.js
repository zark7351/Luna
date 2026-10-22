const test = require('node:test');
const assert = require('node:assert/strict');
const { createLife, validateMemory, blinkPlan, dayKey, isLateNight } = require('../life');

const MINUTE = 60000;
// 2026-10-14 is a Wednesday, 2026-10-16 a Friday.
function setup({ at = new Date(2026, 9, 14, 9, 0), memory = {}, canSpeak = () => true, random = () => 0 } = {}) {
  let time = at.getTime(),
    saved = null;
  const said = [];
  const life = createLife({
    now: () => new Date(time),
    random,
    canSpeak: () => canSpeak(),
    say: (text, expression) => {
      said.push({ text, expression });
      return true;
    },
    name: () => '露娜',
    nickname: () => '',
    load: () => memory,
    save: value => {
      saved = value;
    }
  });
  return {
    life,
    said,
    saved: () => saved,
    advance: ms => {
      time += ms;
    },
    set: date => {
      time = date.getTime();
    }
  };
}

test('memory validation keeps only known, bounded fields', () => {
  const value = validateMemory({
    firstSeen: '2026-10-01',
    lastGreeting: 'yesterday',
    counts: { capture: 3, collect: -1, hack: 9 },
    said: ['a', 5, 'x'.repeat(81)],
    proactive: 1.5,
    extra: true
  });
  assert.deepEqual(value, {
    firstSeen: '2026-10-01',
    lastGreeting: '',
    day: '',
    counts: { collect: 0, capture: 3, recording: 0, complete: 0 },
    said: ['a'],
    proactive: 0,
    work: 0,
    late: 0
  });
  assert.deepEqual(validateMemory(null).counts, { collect: 0, capture: 0, recording: 0, complete: 0 });
});

test('days start at 05:00 so late nights belong to the previous day', () => {
  assert.equal(dayKey(new Date(2026, 9, 18, 3, 0)), '2026-10-17');
  assert.equal(dayKey(new Date(2026, 9, 18, 5, 0)), '2026-10-18');
  assert.equal(isLateNight(new Date(2026, 9, 18, 23, 29)), false);
  assert.equal(isLateNight(new Date(2026, 9, 18, 23, 30)), true);
  assert.equal(isLateNight(new Date(2026, 9, 18, 4, 59)), true);
});

test('first launch introduces Luna once, then stays quiet', () => {
  const { life, said, saved, advance } = setup();
  life.start();
  assert.equal(life.tick(), true);
  assert.equal(said[0].text, '我是露娜。以后这里，就留个位置给我吧。');
  assert.equal(saved().firstSeen, '2026-10-14');
  assert.equal(saved().lastGreeting, '2026-10-14');
  advance(MINUTE);
  assert.equal(life.tick(), false);
});

test('daily greeting follows the time of day, weekday and nickname', () => {
  const memory = { firstSeen: '2026-10-01', lastGreeting: '2026-10-15' };
  const friday = setup({ at: new Date(2026, 9, 16, 8, 0), memory });
  const life = createLife({
    now: () => new Date(2026, 9, 16, 8, 0),
    random: () => 0,
    say: (text, expression) => friday.said.push({ text, expression }),
    nickname: () => '主人',
    load: () => memory
  });
  life.start();
  life.tick();
  assert.equal(friday.said[0].text, '主人，早上好。不必着急，先醒醒神。\n周五了，留点空闲给自己吧。');
  assert.equal(friday.said[0].expression, 'smile');
});

test('milestone days replace the weekday line', () => {
  const { life, said } = setup({
    at: new Date(2026, 9, 16, 19, 0),
    memory: { firstSeen: '2026-10-10', lastGreeting: '2026-10-15' }
  });
  life.start();
  life.tick();
  assert.equal(said[0].text, '晚上好。忙了一天，过来歇一会儿吧。\n陪你 7 天了。真好。');
});

test('busy moments postpone the greeting instead of dropping it', () => {
  let quiet = false;
  const { life, said } = setup({ memory: { firstSeen: '2026-10-01' }, canSpeak: () => quiet });
  life.start();
  assert.equal(life.tick(), false);
  quiet = true;
  assert.equal(life.tick(), true);
  assert.match(said[0].text, /^早上好/);
});

test('welcome-back lines depend on how long the user was away', () => {
  const { life, advance } = setup({ memory: { firstSeen: '2026-10-01', lastGreeting: '2026-10-14' } });
  life.start();
  life.sleep();
  advance(5 * MINUTE);
  assert.equal(life.wake().text, '回来啦。我还在这儿呢。');
  life.sleep();
  advance(30 * MINUTE);
  assert.equal(life.wake().text, '回来啦。歇了 35 分钟，舒服些了吗？');
  life.sleep();
  advance(2 * 60 * MINUTE);
  assert.equal(life.wake().text, '回来啦。我刚刚差一点就睡着了。');
});

test('安静陪伴复用原有频率与次数上限，忙碌时延期，欢迎回来使用微笑', () => {
  let quiet = false,
    randomCalls = 0;
  const { life, advance, said } = setup({
    at: new Date(2026, 9, 14, 10, 0),
    memory: { firstSeen: '2026-10-01', lastGreeting: '2026-10-14' },
    random: () => (randomCalls++ === 0 ? 0.999 : 0.85),
    canSpeak: () => quiet
  });
  life.start();
  advance(49 * MINUTE);
  assert.equal(life.tick(), false);
  advance(2 * MINUTE);
  assert.equal(life.tick(), false);
  quiet = true;
  assert.equal(life.tick(), true);
  assert.deepEqual(said, [{ text: '', expression: 'smile' }]);
  assert.equal(life.memory().proactive, 1);
  assert.equal(life.tick(), false);
  life.sleep();
  advance(10 * MINUTE);
  assert.equal(life.wake().expression, 'smile');
});

test('waking on a new day greets instead of welcoming back', () => {
  const { life, set } = setup({
    at: new Date(2026, 9, 14, 22, 0),
    memory: { firstSeen: '2026-10-01', lastGreeting: '2026-10-14' }
  });
  life.start();
  life.sleep();
  set(new Date(2026, 9, 15, 9, 0));
  assert.match(life.wake().text, /^早上好/);
});

test('long focus earns a rest reminder, repeated at most hourly and three times a day', () => {
  const { life, said, advance } = setup({ memory: { firstSeen: '2026-10-01', lastGreeting: '2026-10-14' } });
  life.start();
  advance(89 * MINUTE);
  const chatter = said.length;
  life.tick();
  advance(5 * MINUTE);
  assert.equal(life.tick(), true);
  assert.equal(said.at(-1).text, '已经忙了 1 个多小时。起来走走，我又不会跑。');
  const reminders = () => said.filter(item => /忙了|眼睛|坐太久/.test(item.text)).length;
  advance(30 * MINUTE);
  life.tick();
  assert.equal(reminders(), 1);
  for (let i = 0; i < 6; i++) {
    advance(61 * MINUTE);
    life.tick();
  }
  assert.equal(reminders(), 3);
  assert.ok(chatter >= 0);
});

test('a real break restarts the focus timer', () => {
  const { life, said, advance } = setup({ memory: { firstSeen: '2026-10-01', lastGreeting: '2026-10-14' } });
  life.start();
  advance(80 * MINUTE);
  life.sleep();
  advance(10 * MINUTE);
  life.wake();
  advance(80 * MINUTE);
  life.tick();
  assert.equal(said.filter(item => /忙了|眼睛|坐太久/.test(item.text)).length, 0);
});

test('late at night she asks the user to rest, at most twice', () => {
  const { life, said, advance } = setup({
    at: new Date(2026, 9, 15, 0, 30),
    memory: { firstSeen: '2026-10-01', lastGreeting: '2026-10-14' }
  });
  life.start();
  assert.equal(life.tick(), true);
  assert.equal(said[0].text, '已经很晚了。今天就先放过自己吧。');
  for (let i = 0; i < 8; i++) {
    advance(30 * MINUTE);
    life.tick();
  }
  assert.equal(said.filter(item => /很晚|这个点/.test(item.text)).length, 2);
});

test('chatter mentions today’s activity and respects the daily limit', () => {
  const { life, said, advance } = setup({
    at: new Date(2026, 9, 14, 9, 30),
    memory: { firstSeen: '2026-10-01', lastGreeting: '2026-10-14' }
  });
  life.start();
  for (let i = 0; i < 3; i++) life.note('capture');
  life.note('unknown');
  advance(26 * MINUTE);
  assert.equal(life.tick(), true);
  assert.equal(said[0].text, '今天已经收好 3 张截图了。都在收藏夹里。');
  for (let i = 0; i < 40; i++) {
    advance(30 * MINUTE);
    if (isLateNight(new Date(2026, 9, 14, 9, 30 + 26 + i * 30))) break;
    life.tick();
  }
  assert.ok(said.length <= 8, 'never more than eight proactive lines per day');
});

test('counters reset when a new day begins', () => {
  const { life, saved, set } = setup({ memory: { firstSeen: '2026-10-01', lastGreeting: '2026-10-14' } });
  life.start();
  life.note('collect');
  assert.equal(saved().counts.collect, 1);
  set(new Date(2026, 9, 15, 9, 0));
  life.note('collect');
  assert.equal(saved().counts.collect, 1);
  assert.equal(saved().day, '2026-10-15');
});

test('disabled companion says nothing and leaves the default lines to the caller', () => {
  const { life, said, advance } = setup();
  assert.equal(life.tick(), false);
  assert.equal(life.sleep(), null);
  advance(60 * MINUTE);
  assert.equal(life.wake(), null);
  assert.equal(life.dragStarted(), false);
  assert.equal(said.length, 0);
});

test('drag and shake reactions have cooldowns', () => {
  const { life, said, advance } = setup({ memory: { firstSeen: '2026-10-01', lastGreeting: '2026-10-14' } });
  life.start();
  assert.equal(life.dragStarted(), true);
  assert.equal(life.dragStarted(), false);
  advance(5 * MINUTE);
  assert.equal(life.dragStarted(), true);
  assert.equal(life.shaken(), true);
  assert.equal(life.shaken(), false);
  advance(MINUTE);
  assert.equal(life.shaken(), true);
  assert.deepEqual(
    said.map(item => item.expression),
    ['shy', 'shy', 'sleepy', 'sleepy']
  );
});

test('blinking slows down when she is sleepy', () => {
  const awake = blinkPlan({ date: new Date(2026, 9, 14, 10, 0), random: () => 0.1 });
  assert.deepEqual(awake, { delay: 3440, duration: 140, double: true });
  const afterLunch = blinkPlan({ date: new Date(2026, 9, 14, 13, 30), random: () => 0.1 });
  assert.equal(afterLunch.duration, 420);
  assert.equal(afterLunch.double, false);
  const tired = blinkPlan({ date: new Date(2026, 9, 14, 10, 0), random: () => 0.9, workedMs: 3 * 60 * MINUTE });
  assert.equal(tired.duration, 220);
});
