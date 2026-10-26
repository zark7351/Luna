const fs = require('node:fs');
const path = require('node:path');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

// Isolated profile + injected local clock. Never changes Windows time or personal settings.
async function check(live, output) {
  const { win, idle } = live;
  const previousReminderNow = live.smokeReminderNow;
  let reminderId;
  const read = code => win.webContents.executeJavaScript(code);
  const at = (hour, minute = 0, day = 23) => {
    live.smokeIdleNow = new Date(2026, 9, day, hour, minute).getTime();
    idle.check();
  };
  const state = () =>
    read(`({sleeping:document.querySelector('#pet').classList.contains('sleeping'),
    pose:window.lunaCharacter.pose,frame:Number(document.querySelector('.character-face').dataset.frame)})`);
  async function expect(sleeping) {
    for (let i = 0; i < 60; i++) {
      const value = await state();
      if (value.sleeping === sleeping && value.pose === (sleeping ? 'sleep' : 'idle')) return value;
      await wait(50);
    }
    throw Error('sleep/pose mismatch ' + JSON.stringify(await state()));
  }
  async function click(x, y) {
    const point = await read(`(()=>{
      const canvas=document.querySelector('.character-face'),box=canvas.getBoundingClientRect();
      const x=box.left+${x}/384*box.width,y=box.top+${y}/292*box.height;
      if(!window.lunaCharacter.hitTest(x,y)||window.lunaCharacter.hitRegion(x,y)!=='wake')
        throw Error('sleep visible pixel did not wake');
      if(window.lunaCharacter.hitRegion(box.left+1,box.top+1)!==null)throw Error('transparent sleep hit');
      return {x:Math.round(x),y:Math.round(y)};
    })()`);
    win.webContents.sendInputEvent({ type: 'mouseMove', ...point });
    await wait(40);
    if (!(await state()).sleeping) throw Error('hover woke sleeping pet');
    win.webContents.sendInputEvent({ type: 'mouseDown', ...point, button: 'left', clickCount: 1 });
    win.webContents.sendInputEvent({ type: 'mouseUp', ...point, button: 'left', clickCount: 1 });
    await expect(false);
    if (idle.isSleeping() || (await read(`window.lunaCharacter.motions.length`)))
      throw Error('click did not sync native sleep or played an idle appendage');
  }
  await read(`closeSheets();document.querySelector('#settings').hidden=true;feedback.show('');`);
  try {
    live.smokeIdleSeconds = 10000;
    at(12, 29);
    await expect(false);
    live.smokeIdleSeconds = 0;
    at(12, 30);
    await expect(true);
    const first = await state();
    await wait(180);
    if ((await state()).frame === first.frame) throw Error('sleep breathing not playing');
    if (await read(`window.lunaCharacter.react('ear-right')||window.lunaCharacter.react('tail')`))
      throw Error('idle appendage played on sleep artwork');
    fs.writeFileSync(path.join(output, 'claude-sleep.png'), (await win.webContents.capturePage()).toPNG());
    await click(210, 225);
    live.smokeIdleSeconds = 10000;
    idle.check();
    await expect(false);
    live.smokeIdleNow += 299000;
    idle.check();
    await expect(false);
    live.smokeIdleSeconds = 300;
    live.smokeIdleNow += 1000;
    idle.check();
    await expect(true);
    await click(244, 65); // The current sleeping ear occupies a different place than idle.
    live.smokeIdleNow += 300000;
    idle.check();
    await expect(true);
    await click(41, 155);

    // Changed scale must use the sleeping frame's alpha rather than the old anatomy map.
    await read(`api('pet-scale',1.8)`);
    live.smokeIdleNow += 300000;
    idle.check();
    await expect(true);
    await click(210, 225);
    await read(`api('pet-scale',1)`);
    at(14);
    await expect(false);
    at(22);
    await expect(true);
    live.smokeIdleSeconds = 0;
    at(0, 1, 24);
    await expect(true);

    win.webContents.debugger.attach('1.3');
    try {
      await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', {
        features: [{ name: 'prefers-reduced-motion', value: 'reduce' }]
      });
      await wait(80);
      const still = await read(`document.querySelector('.character-face').toDataURL()`);
      await wait(150);
      if (
        (await state()).frame !== 0 ||
        still !== (await read(`document.querySelector('.character-face').toDataURL()`))
      )
        throw Error('reduced motion sleep moved');
    } finally {
      await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', { features: [] });
      win.webContents.debugger.detach();
    }
    // A due reminder wakes and keeps her awake even while the user is idle.
    const saved = await live.reminders.save({ title: '睡眠专项提醒', mode: 'countdown', durationSeconds: 1 });
    reminderId = saved.id;
    live.smokeReminderNow += 2000;
    await live.reminders.check();
    await expect(false);
    live.smokeIdleSeconds = 10000;
    live.smokeIdleNow += 600000;
    idle.check();
    await expect(false);
    await read(`api('reminder-complete',${JSON.stringify(saved.id)})`);
    await wait(100);
    live.smokeIdleNow += 300000;
    idle.check();
    await expect(true);
    at(7, 0, 24);
    await expect(false);
    await read(`(async()=>{
      const loadImage=async file=>{const image=new Image();image.src='assets/'+file;await image.decode();return image;};
      const host=document.createElement('div');
      const fallback=createLunaCharacter(host,{loadImage:file=>file.includes('sleep')?Promise.reject(Error('missing sleep art')):loadImage(file)});
      if(!await fallback.load())throw Error('sleep failure hid idle');
      host.classList.add('sleeping');fallback.draw();
      if(fallback.pose!=='idle'||!host.querySelector('canvas').getContext('2d').getImageData(210,160,1,1).data[3])
        throw Error('sleep fallback invisible');
      fallback.stop();
      let finish;const late=createLunaCharacter(document.createElement('div'),{loadImage:file=>file.includes('sleep')?new Promise(r=>finish=r):loadImage(file)});
      const pending=late.load();await Promise.resolve();late.stop();finish(await loadImage(window.lunaCharacterAssets.poses.sleep.file));
      if(await pending)throw Error('late sleep revived stopped character');
    })()`);
    return {
      scheduled: true,
      noon1230: true,
      night2200to0700: true,
      breathing: true,
      clickWake: true,
      earTailWakeOnly: true,
      idleResleep: true,
      scaledAlphaHit: true,
      midnight: true,
      reminderPriority: true,
      reducedMotion: true,
      missingArtFallback: true,
      lateLoadSafe: true
    };
  } finally {
    if (reminderId) await live.reminders.action({ id: reminderId, action: 'delete' });
    live.smokeReminderNow = previousReminderNow;
    live.notifyReminders();
    live.smokeIdleSeconds = 0;
    live.smokeIdleNow = new Date(2026, 9, 23, 10).getTime();
    idle.check(true);
    await read(`(async()=>{await api('pet-scale',1);feedback.show('');window.lunaCharacter.cancel();})()`);
  }
}
module.exports = { check };
