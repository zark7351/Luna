const fs = require('node:fs');
const path = require('node:path');
// 2D Luna: the landscape atlas animates without stretching or clipping, and reactions return to idle.
async function checkCharacter(win, output, label) {
  await win.webContents.executeJavaScript(`(async()=>{
    const pet=document.querySelector('#pet'),canvas=pet.querySelector('canvas.character-face'),stage=window.lunaCharacterAssets.stage;
    clearTimeout(happyTimer);pet.classList.remove('happy','blink','sleeping');window.lunaCharacter.cancel();
    for(let i=0;i<40&&canvas.dataset.pose!=='idle';i++)await new Promise(r=>setTimeout(r,50));
    if(canvas.width!==stage.width||canvas.height!==stage.height||canvas.dataset.pose!=='idle')throw Error('idle pose not drawn');
    const ctx=canvas.getContext('2d'),snapshot=()=>ctx.getImageData(0,0,stage.width,stage.height).data;
    const first=snapshot();await new Promise(r=>setTimeout(r,320));const later=snapshot();
    let moved=0;for(let i=3;i<first.length;i+=4)if(first[i]!==later[i])moved++;
    if(moved<50)throw Error('idle pose does not animate');
    if(later[3]!==0||later[(stage.width-1)*4+3]!==0)throw Error('character corners not transparent');
    const box=pet.getBoundingClientRect(),body=document.body.getBoundingClientRect();
    if(box.left<body.left||box.right>body.right||Math.abs((box.left+box.right-body.left-body.right)/2)>1)throw Error('character outside or off centre');
    if(Math.abs(box.width/box.height-stage.width/stage.height)>0.002)throw Error('half-body portrait stretched');
    if(window.lunaCharacter.hitRegion(box.left+66/stage.width*box.width,box.top+210/stage.height*box.height)!=='tail')throw Error('tail local reaction hit region');
    for(const expression of ['happy','wink','smile','shy','pout']){
      window.lunaCharacter.cancel();window.lunaCharacter.react(expression);
      if(window.lunaCharacter.expression!==expression||!Object.hasOwn(window.lunaCharacterAssets.poses,canvas.dataset.pose))throw Error('reaction pose: '+expression);
    }
    window.lunaCharacter.cancel();pet.classList.add('sleeping');window.lunaCharacter.draw();
    if(window.lunaCharacter.expression!=='sleeping')throw Error('sleeping pose');
    pet.classList.remove('sleeping');window.lunaCharacter.draw();
    if(window.lunaCharacter.expression!=='neutral'||canvas.dataset.pose!=='idle')throw Error('idle restore');
    const bounds=pet.getBoundingClientRect();showMessage('较长的消息'.repeat(12),0);const bubble=document.querySelector('#bubble').getBoundingClientRect();if(bubble.bottom>bounds.top+12)throw Error('long bubble overlaps head');showMessage('');
  })()`);
  fs.writeFileSync(
    path.join(output, 'luna-character-' + label + '.png'),
    (await win.webContents.capturePage()).toPNG()
  );
}
async function checkReactions(win) {
  await win.webContents.executeJavaScript(`(async()=>{
    for(const name of ['collect','capture','recording','reminder-save','complete'])if(!window.smokeUiEffects.includes(name))throw Error('missing action reaction: '+name);
    document.querySelector('#settings').hidden=true;closeSheets();window.lunaEffects.clear();showMessage('');showControls();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const box=document.querySelector('#pet').getBoundingClientRect();window.lunaEffects.burst('collect');
    if(!document.elementFromPoint((box.left+box.right)/2,box.top+box.height*0.45)?.closest('#pet')||getComputedStyle(document.querySelector('.character-face')).pointerEvents!=='none'||document.querySelector('#luna-fx'))throw Error('reaction intercepted controls');
    for(let i=0;i<12;i++)window.lunaEffects.burst('collect');if(document.querySelectorAll('.character-face').length!==1||window.lunaEffects.burst('unknown')!==false)throw Error('reaction resource limit');
  })()`);
  await new Promise(r => setTimeout(r, 2000));
  const finishUntil = Date.now() + 1500;
  while (!(await win.webContents.executeJavaScript(`window.lunaCharacter.expression==='neutral'`))) {
    if (Date.now() > finishUntil)
      throw Error(
        'reaction did not finish: ' + (await win.webContents.executeJavaScript(`window.lunaCharacter.expression`))
      );
    await new Promise(r => setTimeout(r, 60));
  }
  win.webContents.debugger.attach('1.3');
  try {
    await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }]
    });
    await new Promise(r => setTimeout(r, 80));
    await win.webContents.executeJavaScript(
      `(()=>{window.lunaEffects.burst('capture');window.lunaEffects.pulse(document.querySelector('#library-button'));if(!matchMedia('(prefers-reduced-motion: reduce)').matches||document.querySelector('#library-button').getAnimations().length||window.lunaCharacter.expression!=='wink')throw Error('reduced motion ignored');})()`
    );
    await new Promise(r => setTimeout(r, 400));
    if (!(await win.webContents.executeJavaScript(`window.lunaCharacter.expression==='wink'`)))
      throw Error('reduced motion wink animated');
  } finally {
    await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', { features: [] });
    win.webContents.debugger.detach();
  }
  return {
    committedActions: true,
    mutedVisuals: true,
    poseReactions: true,
    noImageMovement: true,
    clickThrough: true,
    boundedTimers: true,
    cleanup: true,
    reducedMotion: true
  };
}
module.exports = { checkCharacter, checkReactions };
