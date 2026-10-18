// Companion behaviour: daily greetings, welcome-back lines, gentle care and occasional idle chatter.
// Pure decision logic with injected clock/randomness so it can be unit tested; the renderer owns timers and drawing.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.lunaLife = factory();
})(globalThis, () => {
  const MINUTE = 60000;
  const DAY_START_HOUR = 5;
  const IDLE_THRESHOLD = 5 * MINUTE;
  const PROACTIVE_GAP = 4 * MINUTE;
  const DAILY_PROACTIVE_LIMIT = 8;
  const CHATTER_MIN = 25 * MINUTE;
  const CHATTER_SPREAD = 25 * MINUTE;
  const WORK_FIRST = 90 * MINUTE;
  const WORK_REPEAT = 60 * MINUTE;
  const WORK_DAILY_LIMIT = 3;
  const LATE_REPEAT = 90 * MINUTE;
  const LATE_DAILY_LIMIT = 2;
  const MILESTONES = [7, 30, 50, 100, 200, 300, 365, 500, 1000];
  const COUNTERS = ['collect', 'capture', 'recording', 'complete'];

  const line = (text, expression = 'smile') => ({ text, expression });
  const lines = {
    firstMeeting: line('初次见面，我是{name}，以后请多关照！', 'happy'),
    greeting: {
      morning: [
        line('早上好！今天也一起加油吧。', 'happy'),
        line('早呀，昨晚睡得好吗？'),
        line('早上好～新的一天开始啦。', 'wink')
      ],
      noon: [line('中午好，记得按时吃饭哦。'), line('中午啦，先吃饭再忙吧。', 'wink')],
      afternoon: [line('下午好，今天第一次见面呢。'), line('下午好～我等你好久啦。', 'shy')],
      evening: [line('晚上好，今天辛苦啦。'), line('晚上好～今天过得怎么样？', 'wink')],
      late: [line('这么晚才来呀……要早点休息哦。', 'pout')]
    },
    weekday: {
      1: '周一啦，慢慢进入状态就好。',
      5: '今天是周五，再坚持一下就周末啦！',
      6: '周末也来找我呀，别太累哦。',
      0: '周末也来找我呀，别太累哦。'
    },
    milestone: '今天是我们认识的第 {days} 天哦。',
    welcome: {
      short: [line('你回来啦。'), line('欢迎回来～', 'happy')],
      medium: [line('回来啦，刚才离开了 {minutes} 分钟呢。'), line('欢迎回来，休息得怎么样？', 'wink')],
      long: [line('你走了好久，我都快睡着了……', 'pout'), line('回来啦！离开了 {hours} 个多小时呢。', 'happy')],
      veryLong: [line('终于回来啦，我等了好久。', 'shy')],
      late: [line('这么晚还要忙吗？别熬太晚哦。', 'pout')]
    },
    sleep: {
      normal: [line('你先忙，我小憩一下。'), line('那我先闭目养神一会儿。')],
      late: [line('好晚了，我先睡啦……')]
    },
    work: [
      line('已经连续忙了 {hours} 个多小时了，起来走走吧。', 'shy'),
      line('眼睛累了吧？看看远处，休息一下。'),
      line('坐太久对腰不好哦，站起来伸个懒腰吧。', 'wink')
    ],
    late: [line('已经很晚了，早点休息吧。', 'pout'), line('都这个点了……明天再继续好不好？', 'shy')],
    counts: {
      capture: line('今天已经截了 {count} 张图了，好勤快。', 'wink'),
      collect: line('今天帮你收藏了 {count} 样东西啦。'),
      complete: line('今天完成了 {count} 个提醒，真棒！', 'happy')
    },
    chatter: {
      morning: [line('上午效率最高，冲呀！', 'happy')],
      noon: [line('肚子有点饿了……你吃饭了吗？', 'pout')],
      sleepy: [line('午后好困……我偷偷打个哈欠。', 'sleepy')],
      evening: [line('天黑啦，屏幕别太亮，保护眼睛。')],
      any: [
        line('♪～', 'smile'),
        line('（偷偷看你一眼）', 'shy'),
        line('我在这儿陪着你呢。'),
        line('有什么要我帮你收藏的吗？', 'wink'),
        line('喝口水吧，我也陪你喝。'),
        line('今天的天空是什么颜色的呢……')
      ]
    },
    dragStart: [line('哇，要带我去哪儿？', 'shy'), line('慢点慢点～', 'pout')],
    shake: line('别晃啦，头好晕……', 'sleepy')
  };

  const pad = n => String(n).padStart(2, '0');
  // Late-night hours before 05:00 still belong to the previous day.
  function dayKey(date) {
    const d = new Date(date.getTime() - DAY_START_HOUR * 3600000);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function daysBetween(fromKey, toKey) {
    const parse = key => Date.UTC(...key.split('-').map((v, i) => Number(v) - (i === 1 ? 1 : 0)));
    return Math.round((parse(toKey) - parse(fromKey)) / 86400000);
  }
  function period(date) {
    const h = date.getHours();
    if (h >= 5 && h < 11) return 'morning';
    if (h >= 11 && h < 13) return 'noon';
    if (h >= 13 && h < 18) return 'afternoon';
    if (h >= 18 && h < 23) return 'evening';
    return 'late';
  }
  function isLateNight(date) {
    const minutes = date.getHours() * 60 + date.getMinutes();
    return minutes >= 23 * 60 + 30 || minutes < 5 * 60;
  }
  function isSleepyTime(date) {
    const h = date.getHours();
    return (h >= 13 && h < 15) || h >= 23 || h < 6;
  }

  const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
  const count = value => (Number.isInteger(value) && value >= 0 ? Math.min(value, 9999) : 0);
  function validateMemory(input) {
    const value = input && typeof input === 'object' ? input : {};
    const date = key => (typeof value[key] === 'string' && DATE_KEY.test(value[key]) ? value[key] : '');
    const counts = {};
    for (const name of COUNTERS) counts[name] = count(value.counts?.[name]);
    const said = Array.isArray(value.said)
      ? value.said.filter(text => typeof text === 'string' && text.length <= 80).slice(-40)
      : [];
    return {
      firstSeen: date('firstSeen'),
      lastGreeting: date('lastGreeting'),
      day: date('day'),
      counts,
      said,
      proactive: count(value.proactive),
      work: count(value.work),
      late: count(value.late)
    };
  }

  function blinkPlan({ date, random = Math.random, workedMs = 0 }) {
    const sleepy = isSleepyTime(date) || workedMs >= 2 * 60 * MINUTE;
    if (sleepy)
      return {
        delay: 2400 + random() * 2200,
        duration: random() < 0.3 ? 420 : 220,
        double: false
      };
    return { delay: 3200 + random() * 2400, duration: 140, double: random() < 0.15 };
  }

  function createLife({
    now = () => new Date(),
    random = Math.random,
    say = () => false,
    canSpeak = () => true,
    translate = (text, values) =>
      values ? text.replace(/\{(\w+)\}/g, (match, key) => (key in values ? String(values[key]) : match)) : text,
    name = () => '露娜',
    nickname = () => '',
    separator = () => '，',
    load = () => ({}),
    save = () => {}
  } = {}) {
    let memory = validateMemory(load()),
      enabled = false,
      sleeping = false,
      sleepingSince = 0,
      activeSince = now().getTime(),
      lastProactive = 0,
      lastWork = 0,
      lastLate = 0,
      lastDrag = 0,
      lastShake = 0,
      pendingGreeting = false,
      nextChatterAt = 0;

    const pick = pool => {
      const fresh = pool.filter(item => !memory.said.includes(item.text));
      const choices = fresh.length ? fresh : pool;
      return choices[Math.floor(random() * choices.length)];
    };
    const render = (item, values = {}, address = false) => {
      const text = translate(item.text, { name: name(), ...values });
      const you = nickname();
      return { text: address && you ? you + separator() + text : text, expression: item.expression };
    };
    function remember(item) {
      memory.said = [...memory.said.filter(text => text !== item.text), item.text].slice(-40);
    }
    function persist() {
      save({ ...memory, counts: { ...memory.counts }, said: [...memory.said] });
    }
    function scheduleChatter(from) {
      nextChatterAt = from + CHATTER_MIN + random() * CHATTER_SPREAD;
    }
    function rollDay() {
      const today = dayKey(now());
      if (memory.day === today) return today;
      memory.day = today;
      for (const key of COUNTERS) memory.counts[key] = 0;
      memory.said = [];
      memory.proactive = memory.work = memory.late = 0;
      persist();
      return today;
    }
    function greeting() {
      const date = now(),
        today = rollDay();
      const first = !memory.firstSeen;
      if (first) memory.firstSeen = today;
      memory.lastGreeting = today;
      pendingGreeting = false;
      if (first) {
        persist();
        return render(lines.firstMeeting);
      }
      const item = pick(lines.greeting[period(date)]);
      remember(item);
      const base = render(item, {}, true);
      const extra = [];
      const days = daysBetween(memory.firstSeen, today) + 1;
      if (MILESTONES.includes(days) || (days > 365 && days % 365 === 0))
        extra.push(translate(lines.milestone, { days }));
      else if (lines.weekday[date.getDay()] && period(date) !== 'late')
        extra.push(translate(lines.weekday[date.getDay()]));
      persist();
      return { text: [base.text, ...extra].join('\n'), expression: base.expression };
    }
    function speak(result, proactive = true) {
      if (!result || !say(result.text, result.expression)) return false;
      if (proactive) {
        lastProactive = now().getTime();
        memory.proactive++;
        persist();
      }
      return true;
    }
    function chatterLine(date) {
      for (const key of ['complete', 'capture', 'collect']) {
        const value = memory.counts[key],
          item = lines.counts[key];
        if (value >= (key === 'complete' ? 1 : 3) && !memory.said.includes(item.text))
          return { item, values: { count: value } };
      }
      const pool = [...lines.chatter.any];
      const p = period(date);
      if (isSleepyTime(date) && p !== 'late') pool.push(...lines.chatter.sleepy);
      if (lines.chatter[p]) pool.push(...lines.chatter[p]);
      return { item: pick(pool) };
    }

    return {
      start() {
        enabled = true;
        rollDay();
        const t = now().getTime();
        activeSince = t;
        pendingGreeting = memory.lastGreeting !== dayKey(now());
        scheduleChatter(t);
      },
      setEnabled(value) {
        if (value && !enabled) this.start();
        enabled = value === true;
      },
      get enabled() {
        return enabled;
      },
      // Called on a timer; returns true when Luna said something.
      tick() {
        if (!enabled || sleeping) return false;
        rollDay();
        const date = now(),
          t = date.getTime();
        if (pendingGreeting) return canSpeak() ? speak(greeting()) : false;
        if (t - lastProactive < PROACTIVE_GAP || memory.proactive >= DAILY_PROACTIVE_LIMIT || !canSpeak()) return false;
        if (isLateNight(date) && memory.late < LATE_DAILY_LIMIT && t - lastLate >= LATE_REPEAT) {
          const item = pick(lines.late);
          if (speak(render(item, {}, true))) {
            remember(item);
            lastLate = t;
            memory.late++;
            persist();
            return true;
          }
          return false;
        }
        const worked = t - activeSince;
        // lastWork resets on every wake, so a real break restarts the 90-minute count.
        if (worked >= WORK_FIRST && memory.work < WORK_DAILY_LIMIT && (!lastWork || t - lastWork >= WORK_REPEAT)) {
          const item = pick(lines.work);
          if (speak(render(item, { hours: Math.floor(worked / 3600000) || 1 }, true))) {
            remember(item);
            lastWork = t;
            memory.work++;
            persist();
            return true;
          }
          return false;
        }
        if (t >= nextChatterAt) {
          const { item, values } = chatterLine(date);
          scheduleChatter(t);
          if (speak(render(item, values))) {
            remember(item);
            persist();
            return true;
          }
        }
        return false;
      },
      sleep() {
        if (sleeping) return null;
        sleeping = true;
        sleepingSince = now().getTime();
        if (!enabled) return null;
        const item = pick(isLateNight(now()) ? lines.sleep.late : lines.sleep.normal);
        return render(item);
      },
      wake() {
        if (!sleeping) return null;
        sleeping = false;
        const t = now().getTime(),
          away = t - sleepingSince + IDLE_THRESHOLD;
        activeSince = t;
        lastWork = 0;
        if (!enabled) return null;
        lastProactive = t;
        scheduleChatter(t);
        if (memory.lastGreeting !== dayKey(now())) return greeting();
        const minutes = Math.round(away / MINUTE);
        let pool;
        if (isLateNight(now()) && minutes >= 20) pool = lines.welcome.late;
        else if (minutes < 20) pool = lines.welcome.short;
        else if (minutes < 60) pool = lines.welcome.medium;
        else if (minutes < 180) pool = lines.welcome.long;
        else pool = lines.welcome.veryLong;
        const item = pick(pool);
        remember(item);
        return render(item, { minutes, hours: Math.floor(minutes / 60) }, minutes >= 20);
      },
      note(effect) {
        if (!COUNTERS.includes(effect)) return;
        rollDay();
        memory.counts[effect] = Math.min(memory.counts[effect] + 1, 9999);
        persist();
      },
      dragStarted() {
        const t = now().getTime();
        if (!enabled || t - lastDrag < 5 * MINUTE || random() >= 0.3) return false;
        lastDrag = t;
        return speak(render(pick(lines.dragStart)), false);
      },
      shaken() {
        const t = now().getTime();
        if (!enabled || t - lastShake < MINUTE) return false;
        lastShake = t;
        return speak(render(lines.shake), false);
      },
      blinkPlan() {
        return blinkPlan({ date: now(), random, workedMs: sleeping ? 0 : now().getTime() - activeSince });
      },
      memory: () => validateMemory(memory)
    };
  }

  return { createLife, validateMemory, blinkPlan, dayKey, period, isLateNight, isSleepyTime, lines };
});
