const fs = require('node:fs');
const path = require('node:path');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

// Real character drawing, native input and reminder IPC in an isolated smoke profile.
async function check(live, output) {
  const { win, idle } = live;
  const read = code => win.webContents.executeJavaScript(code);
  const previousReminderNow = live.smokeReminderNow;
  let reminderId;
  await read(`closeSheets();document.querySelector('#settings').hidden=true;rest(false);
    feedback.show('');clearTimeout(happyTimer);document.querySelector('#pet').classList.remove('happy');
    window.lunaCharacter.cancel();`);
  try {
    const pixels = await read(`(()=>{
      const character=window.lunaCharacter,canvas=document.querySelector('.character-face'),ctx=canvas.getContext('2d');
      const time=performance.now()+700;
      character.draw(time);const before=ctx.getImageData(0,0,384,292).data;
      character.react('happy');character.draw(time);
      const after=ctx.getImageData(0,0,384,292).data,patches=window.lunaCharacterAssets.happy.patches;
      const counts=patches.map(()=>0);
      for(let i=0;i<before.length;i+=4){
        if(before[i+3]!==after[i+3])throw Error('happy changed alpha');
        const x=(i/4)%384,y=Math.floor(i/4/384);
        if(Math.max(...[0,1,2].map(k=>Math.abs(before[i+k]-after[i+k])))>1){
          const index=patches.findIndex(p=>{const[a,b,w,h]=p.target;return x>=Math.floor(a)-1&&x<=Math.ceil(a+w)+1&&y>=Math.floor(b)-1&&y<=Math.ceil(b+h)+1;});
          if(index<0)throw Error('happy moved pixels outside eyes/mouth '+x+','+y);
          counts[index]++;
        }
      }
      if(counts.some(n=>n<15))throw Error('missing happy eye/mouth art '+counts);
      const enlarged=document.createElement('canvas');enlarged.width=768;enlarged.height=584;
      enlarged.getContext('2d').drawImage(canvas,0,0,768,584);
      character.cancel();character.react('tail');character.react('happy');
      if(!character.motions.includes('tail'))throw Error('happy interrupted tail');
      return {counts,preview:enlarged.toDataURL()};
    })()`);
    fs.writeFileSync(
      path.join(output, 'claude-happy-preview.png'),
      Buffer.from(pixels.preview.split(',')[1], 'base64')
    );
    await wait(1500);
    await read(`window.lunaCharacter.react('happy');window.lunaCharacter.react('smile');`);
    await wait(900);
    if (await read(`window.lunaCharacter.expression==='happy'`)) throw Error('repeat click extended happy');

    // Daily greeting keeps its existing once-per-day gating and original words.
    await read(`(()=>{
      feedback.show('');window.lunaCharacter.cancel();
      const greeting=window.lunaLife.createLife({now:()=>new Date(2026,9,23,10),random:()=>0.95,
        say:lifeSay,canSpeak:()=>true,load:()=>({firstSeen:'2026-10-01',lastGreeting:'2026-10-22'})});
      greeting.start();if(!greeting.tick()||window.lunaCharacter.expression!=='happy'||greeting.tick())throw Error('daily happy greeting');
      feedback.show('');window.lunaCharacter.cancel();
      window.happySmokeRandom=Math.random;window.happySmokePaused=lifePaused;lifePaused=false;Math.random=()=>0.1;
    })()`);
    await require('./body-shortcut-smoke').click(win, 'head');
    if (!(await read(`window.lunaCharacter.expression==='happy'`))) throw Error('occasional happy head pat');
    await read(`window.lunaCharacter.cancel();feedback.show('');`);
    await require('./body-shortcut-smoke').click(win, 'head');
    if (!(await read(`window.lunaCharacter.expression==='smile'`))) throw Error('head grin cooldown');
    await read(`window.lunaCharacter.cancel();feedback.show('');Math.random=()=>0.95;void 0;`);
    // Return is detected by the native idle monitor, without waking a sleeping pet on keyboard movement.
    live.smokeIdleSeconds = 600;
    idle.check();
    live.smokeIdleSeconds = 0;
    idle.check();
    await wait(80);
    await require('./body-shortcut-smoke').click(win, 'arms');
    if (!(await read(`window.lunaCharacter.expression==='happy'`))) throw Error('return click happy');
    await read(`window.lunaCharacter.cancel();feedback.show('');`);
    await require('./body-shortcut-smoke').click(win, 'arms');
    if (!(await read(`window.lunaCharacter.expression==='wink'`))) throw Error('return happy repeated');
    await read(
      `lifePaused=window.happySmokePaused;Math.random=window.happySmokeRandom;window.lunaCharacter.cancel();feedback.show('');`
    );

    const saved = await live.reminders.save({ title: '开心笑专项提醒', mode: 'countdown', durationSeconds: 1 });
    reminderId = saved.id;
    live.smokeReminderNow += 2000;
    await live.reminders.check();
    await wait(100);
    await read(`if(playHappy()||lifeSay('', 'happy'))throw Error('happy overrode due reminder');`);
    await read(`api('reminder-complete',${JSON.stringify(saved.id)})`);
    await wait(100);
    if (!(await read(`!feedback.getReminder()&&window.lunaCharacter.expression==='happy'`)))
      throw Error('reminder completion happy');

    win.webContents.debugger.attach('1.3');
    try {
      await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', {
        features: [{ name: 'prefers-reduced-motion', value: 'reduce' }]
      });
      await read(`window.lunaCharacter.cancel();window.lunaCharacter.react('happy');`);
      await wait(50);
      const first = await read(`document.querySelector('.character-face').toDataURL()`);
      await wait(150);
      if (first !== (await read(`document.querySelector('.character-face').toDataURL()`)))
        throw Error('reduced motion happy moved');
    } finally {
      await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', { features: [] });
      win.webContents.debugger.detach();
    }
    await read(`(async()=>{
      const loadImage=async file=>{const image=new Image();image.src='assets/'+file;await image.decode();return image;};
      const host=document.createElement('div'),fallback=createLunaCharacter(host,{loadImage:file=>file.includes('happy')?Promise.reject(Error('missing optional happy')):loadImage(file)});
      if(!await fallback.load())throw Error('optional happy failure hid idle');fallback.react('happy');
      fallback.draw(performance.now()+500);
      if(!host.querySelector('canvas').getContext('2d').getImageData(210,160,1,1).data[3])throw Error('happy fallback blank');fallback.stop();
      let finish;const late=createLunaCharacter(document.createElement('div'),{loadImage:file=>file.includes('happy')?new Promise(r=>finish=r):loadImage(file)});
      const pending=late.load();late.stop();finish(await loadImage(window.lunaCharacterAssets.happy.file));
      if(await pending)throw Error('late happy revived stopped character');
    })()`);
    return {
      facePatchPixels: pixels.counts,
      bodyAndAlphaFixed: true,
      noHop: true,
      tailContinues: true,
      boundedDuration: true,
      dailyGreeting: true,
      occasionalHeadPat: true,
      returnFirstClick: true,
      completedReminder: true,
      reminderPriority: true,
      reducedMotion: true,
      missingArtFallback: true,
      lateLoadSafe: true
    };
  } finally {
    if (reminderId) await live.reminders.action({ id: reminderId, action: 'delete' });
    live.smokeReminderNow = previousReminderNow;
    live.smokeIdleSeconds = 0;
    live.notifyReminders();
    idle.check(true);
    await read(`if(window.happySmokeRandom){Math.random=window.happySmokeRandom;lifePaused=window.happySmokePaused;}
      happyReactions.clear();feedback.show('');window.lunaCharacter.cancel();clearTimeout(happyTimer);document.querySelector('#pet').classList.remove('happy');`);
  }
}
module.exports = { check };
