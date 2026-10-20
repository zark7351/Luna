const fs = require('node:fs'),
  path = require('node:path');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
// Pick a solid pixel of the frame being drawn now, near the middle of the region, away from moving edges.
async function point(win, region) {
  return win.webContents.executeJavaScript(`(async()=>{
  const canvas=document.querySelector('#pet canvas.character-face'),stage=window.lunaCharacterAssets.stage,c=stage.center;
  const data=canvas.getContext('2d').getImageData(0,0,stage.width,stage.height).data,box=canvas.getBoundingClientRect();
  const target={head:[c,95],chest:[c,185],arms:[112,240],forbidden:[c,262],legs:[c,295],feet:[c-14,322]}['${region}'],edge=['forbidden','feet'].includes('${region}')?1:3;
  const solid=(x,y)=>{for(let dy=-edge;dy<=edge;dy++)for(let dx=-edge;dx<=edge;dx++){const px=x+dx,py=y+dy;if(px<0||py<0||px>=stage.width||py>=stage.height||data[(py*stage.width+px)*4+3]<200)return false;}return true;};
  let nearest=null,best=Infinity;
  for(let y=Math.max(0,target[1]-45);y<Math.min(stage.height,target[1]+45);y++)for(let x=Math.max(0,target[0]-60);x<Math.min(stage.width,target[0]+60);x++){
    const score=Math.hypot(x-target[0],y-target[1]);if(score>=best||window.lunaBodyShortcuts.regionAt(x,y,c)!=='${region}'||!solid(x,y))continue;
    best=score;nearest={x:box.left+(x+0.5)/stage.width*box.width,y:box.top+(y+0.5)/stage.height*box.height};
  }
  if(!nearest||window.lunaCharacter.hitRegion(nearest.x,nearest.y)!=='${region}')throw Error('visible body region mismatch: ${region}');
  return {x:Math.round(nearest.x),y:Math.round(nearest.y)};
})()`);
}
async function click(win, region) {
  const p = await point(win, region);
  win.webContents.sendInputEvent({ type: 'mouseMove', ...p });
  win.webContents.sendInputEvent({ type: 'mouseDown', ...p, button: 'left', clickCount: 1 });
  win.webContents.sendInputEvent({ type: 'mouseUp', ...p, button: 'left', clickCount: 1 });
  await sleep(120);
}
const idle = `window.lunaCharacter.expression==='neutral'`;
async function check(win, output, stateFile, stats) {
  const read = code => win.webContents.executeJavaScript(code);
  const until = async (test, label, limit = 2500) => {
    const deadline = Date.now() + limit;
    while (!(await test())) {
      if (Date.now() > deadline) throw Error(label);
      await sleep(50);
    }
  };
  await read(
    `(()=>{closeSheets();document.querySelector('#settings').hidden=true;showMessage('');bodyReactions.reset();})()`
  );
  for (const region of ['head', 'chest', 'arms', 'forbidden', 'legs', 'feet']) await point(win, region);
  if (
    !(await read(
      `(()=>{const box=document.querySelector('#pet canvas').getBoundingClientRect(),stage=window.lunaCharacterAssets.stage;return window.lunaCharacter.hitRegion(box.left+stage.center/stage.width*box.width,box.top+292/stage.height*box.height)!=='forbidden';})()`
    ))
  )
    throw Error('lower skirt still triggers forbidden region');
  if (
    !(await read(
      `(()=>{const r=document.querySelector('#pet').getBoundingClientRect();return window.lunaCharacter.hitRegion(r.left+1,r.top+1)===null;})()`
    ))
  )
    throw Error('transparent corners react');
  if ('bodyShortcuts' in JSON.parse(fs.readFileSync(stateFile)).settings) throw Error('body shortcut setting remains');
  // Each part only plays its animation: no tooltip, bubble, sheet, settings or screenshot window.
  for (const [region, expression] of [
    ['head', 'happy'],
    ['arms', 'wink'],
    ['legs', 'smile'],
    ['feet', 'pout'],
    ['chest', 'shy'],
    ['forbidden', 'shy']
  ]) {
    await read(`bodyReactions.reset();void 0`);
    await click(win, region);
    if (
      !(await read(
        `window.lunaCharacter.expression==='${expression}'&&!document.querySelector('#pet').hasAttribute('title')&&!infoBubbles.active&&document.querySelector('#bubble').hidden&&document.querySelector('#settings').hidden&&Array.from(document.querySelectorAll('.bottom-sheet')).every(node=>node.hidden)`
      ))
    )
      throw Error('body click did more than animate: ' + region);
    if (
      require('electron')
        .BrowserWindow.getAllWindows()
        .some(
          window =>
            !window.isDestroyed() &&
            /\/(screenshot|recording|reminder)\.html/.test(window.webContents.getURL()) &&
            window.isVisible()
        )
    )
      throw Error('body click opened a tool window: ' + region);
  }
  await read(`bodyReactions.reset();void 0`);
  const dragPoint = await point(win, 'head');
  await until(() => read(idle), 'reaction did not return to idle before drag');
  win.webContents.sendInputEvent({ type: 'mouseMove', ...dragPoint });
  win.webContents.sendInputEvent({ type: 'mouseDown', ...dragPoint, button: 'left', clickCount: 1 });
  await sleep(70);
  win.webContents.sendInputEvent({
    type: 'mouseMove',
    x: dragPoint.x + 16,
    y: dragPoint.y + 2,
    modifiers: ['leftButtonDown']
  });
  await sleep(90);
  win.webContents.sendInputEvent({
    type: 'mouseUp',
    x: dragPoint.x + 16,
    y: dragPoint.y + 2,
    button: 'left',
    clickCount: 1
  });
  await sleep(100);
  if (!(await read(`${idle}&&!dragStart`))) throw Error('drag triggered a body reaction');
  // Nothing shows date, weather or usage now; the readers stay for future animations.
  const originalRead = stats.read;
  try {
    let cpu = 25;
    stats.read = () => ({ cpu, memory: 50, gpu: 75 });
    await read(`infoBubbles.start('stats');void 0`);
    await until(() => read(`infoBubbles.active==='stats'&&feedback.getMessage().includes('25%')`), 'stats bubble');
    cpu = 49;
    await sleep(1200);
    if (!(await read(`feedback.getMessage().includes('49%')`))) throw Error('stats bubble not dynamic');
    await sleep(4300);
    if (!(await read(`document.querySelector('#bubble').hidden&&!infoBubbles.active`)))
      throw Error('stats bubble extended beyond five seconds');
  } finally {
    stats.read = originalRead;
  }
  await read(`infoBubbles.start('datetime');void 0`);
  if (
    !(await read(
      `feedback.getMessage().startsWith('今天是')&&feedback.getMessage().includes('星期')&&feedback.getMessage().includes('现在是')`
    ))
  )
    throw Error('date bubble');
  if (
    !(await read(
      `(()=>{const text=document.querySelector('#bubble-message');return text.scrollHeight<=text.clientHeight+1;})()`
    ))
  )
    throw Error('date dialogue clipped');
  await read(`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`);
  fs.writeFileSync(path.join(output, 'luna-date-dialogue-preview.png'), (await win.webContents.capturePage()).toPNG());
  await require('./bubble-smoke').click(win, 'bubble-body');
  await read(
    `(async()=>{await openSettings();document.querySelector('#weather-query').value='杭州';document.querySelector('#weather-search').click();})()`
  );
  await sleep(150);
  await read(
    `(()=>{const result=document.querySelector('#weather-results button');if(!result)throw Error('weather search result');result.click();document.querySelector('#settings-form').requestSubmit();})()`
  );
  await sleep(150);
  await read(`showMessage('');infoBubbles.start('weather');void 0`);
  await until(() => read(`feedback.getMessage().includes('杭州')`), 'weather bubble');
  await require('./bubble-smoke').click(win, 'bubble-body');
  // Three chest or forbidden clicks within ten seconds still make her angry, and later clicks do not cut it short.
  await read(
    `window.smokeBodyReactionMethods={click:bodyReactions.click,reset:bodyReactions.reset};Object.assign(bodyReactions,window.lunaBodyShortcuts.createReactions({}));showMessage('');void 0;`
  );
  await click(win, 'chest');
  await click(win, 'chest');
  if (!(await read(`window.lunaCharacter.expression==='shy'`))) throw Error('second sensitive click');
  await click(win, 'chest');
  if (!(await read(`window.lunaCharacter.expression==='angry'&&feedback.getMessage().includes('一直戳')`)))
    throw Error('third sensitive click did not trigger');
  fs.writeFileSync(path.join(output, 'luna-body-angry-preview.png'), (await win.webContents.capturePage()).toPNG());
  await read(`Object.assign(bodyReactions,window.lunaBodyShortcuts.createReactions({}));void 0;`);
  await click(win, 'chest');
  await click(win, 'chest');
  await click(win, 'head');
  if (
    !(await read(
      `window.lunaCharacter.expression==='angry'&&feedback.getMessage().includes('一直戳')&&!infoBubbles.active`
    ))
  )
    throw Error('continuous clicks interrupted angry expression or dialogue');
  await sleep(2100);
  await until(() => read(idle), 'angry reaction did not restore', 1800);
  await read(
    `angerInteraction.returned();Object.assign(bodyReactions,window.smokeBodyReactionMethods);delete window.smokeBodyReactionMethods;bodyReactions.reset();showMessage('');void 0;`
  );
  await read(
    `(()=>{if(wheel.items?.some?.(item=>['datetime','weather','stats'].includes(item.id))||document.querySelector('[data-wheel=datetime],[data-wheel=weather],[data-wheel=stats]'))throw Error('information entries remain');showMessage('');})()`
  );
  return {
    chibiFrame: true,
    alphaHitRegions: true,
    animationOnly: true,
    dragDoesNotActivate: true,
    informationReaders: true,
    dynamicFiveSeconds: true,
    dateAndWeekday: true,
    weatherCitySearch: true,
    repeatedAngry: true,
    angrySurvivesClicks: true,
    restored: true,
    noInformationEntries: true
  };
}
module.exports = { check, click, point };
