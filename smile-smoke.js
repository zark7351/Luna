const fs = require('node:fs');
const path = require('node:path');

// Runs only in the isolated smoke profile, using the real renderer and committed IPC effects.
async function check(live, output) {
  const { win } = live;
  const read = code => win.webContents.executeJavaScript(code);
  const pixels = await read(`(async()=>{
    closeSheets();document.querySelector('#settings').hidden=true;rest(false);
    feedback.show('');clearTimeout(happyTimer);
    document.querySelector('#pet').classList.remove('happy','sleeping');
    const character=window.lunaCharacter,canvas=document.querySelector('.character-face');
    character.cancel();canvas.getAnimations().forEach(a=>a.cancel());
    const ctx=canvas.getContext('2d'),time=performance.now()+500;
    character.draw(time);const firstIndex=canvas.dataset.frame;
    const before=ctx.getImageData(0,0,canvas.width,canvas.height).data,neutral=canvas.toDataURL();
    character.react('smile');character.draw(time);
    const after=ctx.getImageData(0,0,canvas.width,canvas.height).data;
    const [x,y,w,h]=window.lunaCharacterAssets.smile.target;
    let changed=0;
    for(let i=0;i<before.length;i+=4){
      const px=(i/4)%canvas.width,py=Math.floor(i/4/canvas.width);
      if(before[i+3]!==after[i+3])throw Error('smile changed alpha '+JSON.stringify({i,before:before[i+3],after:after[i+3],firstIndex,afterIndex:canvas.dataset.frame}));
      if(Math.max(...[0,1,2].map(k=>Math.abs(before[i+k]-after[i+k])))>1){
        changed++;
        if(px<Math.floor(x)-1||px>Math.ceil(x+w)+1||py<Math.floor(y)-1||py>Math.ceil(y+h)+1)
          throw Error('smile outside mouth '+JSON.stringify({px,py,x,y,w,h}));
      }
    }
    if(changed<20||canvas.getAnimations().some(a=>a.effect.getKeyframes().some(k=>k.transform)))
      throw Error('missing painted smile or whole-body hop');
    const smile=canvas.toDataURL();
    character.cancel();character.react('tail');character.react('smile');
    if(!character.motions.includes('tail'))throw Error('smile interrupted tail');
    await new Promise(r=>setTimeout(r,1800));character.react('smile');
    await new Promise(r=>setTimeout(r,1700));
    if(character.expression==='smile')throw Error('repeat click extended smile');
    return {changed,neutral,smile};
  })()`);
  for (const name of ['neutral', 'smile'])
    fs.writeFileSync(
      path.join(output, 'claude-expression-' + name + '.png'),
      Buffer.from(pixels[name].split(',')[1], 'base64')
    );

  await require('./body-shortcut-smoke').click(win, 'head');
  if (!(await read(`window.lunaCharacter.expression==='smile'`))) throw Error('head smile missing');
  await read(`window.lunaCharacter.cancel();feedback.show('');api('collection-add-text','微笑专项收藏')`);
  await new Promise(r => setTimeout(r, 120));
  if (!(await read(`window.lunaCharacter.expression==='smile'`))) throw Error('collection success smile missing');

  await read(`(()=>{
    feedback.show('');window.lunaCharacter.cancel();
    let time=new Date(2026,9,23,10,0).getTime();
    const fake=window.lunaLife.createLife({now:()=>new Date(time),random:()=>0,
      say:lifeSay,canSpeak:()=>true,load:()=>({firstSeen:'2026-10-01',lastGreeting:'2026-10-23'})});
    fake.start();fake.sleep();time+=10*60000;const welcome=fake.wake();
    if(welcome.expression!=='smile'||!lifeSay(welcome.text,welcome.expression))throw Error('welcome smile');
    feedback.show('');window.lunaCharacter.cancel();
    if(!lifeSay('', 'smile')||feedback.getMessage()||window.lunaCharacter.expression!=='smile')
      throw Error('silent companionship smile');
  })()`);

  await live.reminders.save({ title: '微笑专项提醒', mode: 'countdown', durationSeconds: 1 });
  live.smokeReminderNow += 2000;
  await live.reminders.check();
  await new Promise(r => setTimeout(r, 150));
  win.webContents.send('ui-effect', 'collect');
  await require('./body-shortcut-smoke').click(win, 'head');
  const id = await read(`(()=>{
    if(!feedback.getReminder()||window.lunaCharacter.expression==='smile'||lifeSay('', 'smile'))
      throw Error('smile overrode due reminder');
    return feedback.getReminder().id;
  })()`);
  await read(`api('reminder-complete',${JSON.stringify(id)})`);
  await new Promise(r => setTimeout(r, 150));
  if (!(await read(`!feedback.getReminder()&&window.lunaCharacter.expression==='smile'`)))
    throw Error('completion smile missing');

  win.webContents.debugger.attach('1.3');
  try {
    await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }]
    });
    await read(`(()=>{window.lunaCharacter.cancel();window.lunaCharacter.react('smile');
      if(window.lunaCharacter.expression!=='smile'||document.querySelector('.character-face').getAnimations().length)
        throw Error('reduced motion smile');})()`);
  } finally {
    await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', { features: [] });
    win.webContents.debugger.detach();
  }
  await read(`(async()=>{
    const loadImage=async file=>{const image=new Image();image.src='assets/'+file;await image.decode();return image;};
    const host=document.createElement('div');
    const fallback=createLunaCharacter(host,{loadImage:file=>file.includes('smile')?Promise.reject(Error('smoke missing optional art')):loadImage(file)});
    if(!await fallback.load()||!host.querySelector('canvas').getContext('2d').getImageData(210,160,1,1).data[3])
      throw Error('optional smile failure hid idle');
    fallback.stop();
    let finish;const late=createLunaCharacter(document.createElement('div'),{loadImage:file=>file.includes('smile')?new Promise(r=>finish=r):loadImage(file)});
    const pending=late.load();late.stop();finish(await loadImage(window.lunaCharacterAssets.smile.file));
    if(await pending)throw Error('late smile revived stopped character');
  })()`);
  return {
    mouthPixels: pixels.changed,
    unchangedBodyAndAlpha: true,
    noHop: true,
    boundedDuration: true,
    head: true,
    collection: true,
    welcome: true,
    silentCompanionship: true,
    reminderPriority: true,
    completion: true,
    reducedMotion: true
  };
}
module.exports = { check };
