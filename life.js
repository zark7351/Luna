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
    firstMeeting: line('我是{name}。以后这里，就留个位置给我吧。'),
    greeting: {
      morning: [
        line('早上好。不必着急，先醒醒神。'),
        line('醒啦？先照顾好自己，再忙别的。'),
        line('早安。嗯，见到你，心情倒是不错。')
      ],
      noon: [line('中午了。先去吃饭，我替你守着这里。'), line('到午饭时间了，别让自己饿着。', 'wink')],
      afternoon: [line('下午好。嗯，这会儿最适合偷闲。'), line('来啦？午后的事，也慢慢来。', 'shy')],
      evening: [line('晚上好。忙了一天，过来歇一会儿吧。'), line('晚上好。今天就对自己宽容一点。', 'wink')],
      late: [line('这么晚还醒着呀。坐一会儿，就去休息吧。', 'pout')]
    },
    weekday: {
      1: '周一嘛，一件一件来就好。',
      5: '周五了，留点空闲给自己吧。',
      6: '周末的空闲，分我一点就好。',
      0: '周末的空闲，分我一点就好。'
    },
    milestone: '陪你 {days} 天了。真好。',
    welcome: {
      short: [line('回来啦。我还在这儿呢。'), line('欢迎回来。过来歇一会儿吧。')],
      medium: [line('回来啦。歇了 {minutes} 分钟，舒服些了吗？'), line('歇过了？那我也打起一点精神。')],
      long: [line('回来啦。我刚刚差一点就睡着了。'), line('离开 {hours} 个多小时了。回来就先歇一会儿吧。')],
      veryLong: [line('欢迎回来。今天剩下的时间，慢慢过吧。')],
      late: [line('还要忙一会儿？可别把明天的精神也用掉了。', 'pout')]
    },
    sleep: {
      normal: [line('你忙吧。我在这儿眯一会儿。'), line('我先闭目养神，有事再叫我。')],
      late: [line('夜深了，我先眯一会儿。你也别太晚。')]
    },
    work: [
      line('已经忙了 {hours} 个多小时。起来走走，我又不会跑。', 'shy'),
      line('眼睛也该歇歇了。看一会儿远处，再回来吧。'),
      line('坐太久了，去伸个懒腰。慢慢来就好。', 'wink')
    ],
    late: [line('已经很晚了。今天就先放过自己吧。', 'pout'), line('都这个点了，剩下的留给明天，好不好？', 'shy')],
    counts: {
      capture: line('今天已经收好 {count} 张截图了。都在收藏夹里。', 'wink'),
      collect: line('今天替你收好了 {count} 样东西。慢慢挑着看吧。'),
      complete: line('今天办完 {count} 件提醒了。嗯，做得不错。')
    },
    chatter: {
      morning: [line('早上的光，适合慢慢醒一醒。')],
      noon: [line('该吃点东西了。好好吃饭，也算正事。', 'pout')],
      sleepy: [line('午后嘛……稍微犯个懒，也没关系。', 'sleepy')],
      evening: [line('夜色正好。把手边的事，慢慢收个尾吧。')],
      any: [
        line('嗯……这样待着，就很好。', 'smile'),
        line('看你一眼。好啦，继续忙你的吧。'),
        line('你忙你的。我在这儿，正好偷个闲。'),
        line('有想留着的东西，就交给我吧。', 'wink'),
        line('去喝口水吧。回来时，我还在这里。'),
        line('把今天过得舒服一点，也很要紧。'),
        line('偶尔什么都不做，也挺好的。'),
        line('这点清静，还挺合我心意。'),
        line('我可不是在发呆。是在养精神。'),
        line('嗯？没什么事，就陪我坐一会儿吧。'),
        line('')
      ]
    },
    dragStart: [line('嗯？要换个位置看风景吗？', 'shy'), line('慢些呀，我还没坐稳呢。', 'pout')],
    shake: line('唔，慢一点……我有点晕。', 'sleepy')
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
    name = () => '克劳德',
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
