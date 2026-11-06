const assert = require('node:assert/strict');

const fs = require('node:fs');

const path = require('node:path');

async function check(live) {
  const { win, reminders } = live;

  const previousNow = live.smokeReminderNow;

  const created = [];

  const read = code => win.webContents.executeJavaScript(code);

  const panel = code => {
    if (win.isDestroyed() || win.webContents.isDestroyed()) throw Error('Reminder window closed');

    const frame = win.webContents.mainFrame.frames.find(frame => frame.url.includes('reminder.html'));

    if (!frame || frame.detached) throw Error('Reminder panel unavailable');

    return frame.executeJavaScript(code);
  };

  const until = async fn => {
    const end = Date.now() + 5000;

    while (!(await fn())) {
      if (Date.now() > end) throw Error('Recurring reminder UI timeout');

      await new Promise(resolve => setTimeout(resolve, 40));
    }
  };

  try {
    live.smokeReminderNow = new Date(2026, 0, 1, 8).getTime();

    await read(`closeSheets();document.querySelector('#settings').hidden=true;openSheet('reminder');`);

    await until(() => panel(`typeof syncRecurrence==='function'`));

    for (const kind of ['daily', 'weekly']) {
      await panel(`reset();setMode('scheduled');$('title').value='Repeat ${kind}';$('repeat').value='${kind}';syncRecurrence();$('repeat-time').value='09:00';setDays([1,3]);

        if(!$('time').disabled||$('repeat-time').disabled)throw Error('Hidden required fields');

        if($('weekdays').hidden!==('${kind}'!=='weekly'))throw Error('Weekday visibility');

        $('form').requestSubmit();`);

      await until(() => reminders.list().some(item => item.title === 'Repeat ' + kind));

      const item = reminders.list().find(item => item.title === 'Repeat ' + kind);

      created.push(item.id);

      assert.equal(item.recurrence.kind, kind);
    }

    await until(() => panel(`document.querySelectorAll('.repeat-label').length===2`));

    const weekly = reminders.list().find(item => item.title === 'Repeat weekly');

    await panel(`document.querySelector('[data-id="${weekly.id}"] button[title="编辑"]').click();`);

    assert.deepEqual(
      await panel(
        `({kind:$('repeat').value,time:$('repeat-time').value,days:[...document.querySelectorAll('[data-day][aria-pressed="true"]')].map(x=>Number(x.dataset.day))})`
      ),

      { kind: 'weekly', time: '09:00', days: [1, 3] }
    );

    await panel(`setDays([]);$('form').requestSubmit();`);

    await until(() => panel(`$('status').textContent.includes('请至少选择')`));

    assert.deepEqual(reminders.list().find(item => item.id === weekly.id).recurrence.days, [1, 3]);

    await panel(
      `setMode('countdown');if($('repeat-time').disabled!==true)throw Error('Countdown field disabled state');reset();setMode('scheduled');`
    );

    const daily = reminders.list().find(item => item.title === 'Repeat daily');

    live.smokeReminderNow = daily.dueAt;

    await reminders.check();

    await reminders.action({ id: daily.id, action: 'complete' }, true);

    assert.equal(reminders.list().find(item => item.id === daily.id).status, 'pending');

    await panel(`window.lunaI18n.setLanguage('en')`);

    assert.equal(await panel(`$('repeat').querySelector('[value="weekly"]').textContent`), 'Every week');

    assert.deepEqual(await panel(`[...$('repeat').options].map(x=>x.value)`), ['none', 'daily', 'weekly']);

    assert.equal(await panel(`!!document.querySelector('#calendar-note,script[src="cn-calendar.js"]')`), false);

    fs.writeFileSync(
      path.join(require('node:os').tmpdir(), 'claudy-recurring-reminders.png'),

      (await win.webContents.capturePage()).toPNG()
    );

    return {
      uiSaveAllRules: true,

      weeklyEdit: true,

      emptyDaysRejected: true,

      countdownCompatible: true,

      onlyDailyWeekly: true,

      english: true,

      completeSchedulesNext: true
    };
  } finally {
    for (const id of created) await reminders.action({ id, action: 'delete' });

    live.smokeReminderNow = previousNow;

    if (!win.isDestroyed() && !win.webContents.isDestroyed())
      await panel(`window.lunaI18n.setLanguage('zh-CN');reset();setMode('scheduled')`);
  }
}

module.exports = { check };
