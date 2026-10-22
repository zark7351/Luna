const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function check(win, output) {
  const read = script => win.webContents.executeJavaScript(script);
  await read(
    `(()=>{closeSheets();document.querySelector('#settings').hidden=true;clearTimeout(happyTimer);document.querySelector('#pet').classList.remove('happy');window.lunaCharacter.cancel();showMessage('');})()`
  );
  const qa = await read(`(()=>{
    const api=window.claudeAppendages,source=document.querySelector('#pet canvas'),sheet=document.createElement('canvas');
    sheet.width=6*384;sheet.height=3*316;const display=sheet.getContext('2d');
    const base=document.createElement('canvas');base.width=384;base.height=292;base.getContext('2d').drawImage(source,0,0);
    const stats={};
    ['ear-left','ear-right','tail'].forEach((part,row)=>{
      const surface=document.createElement('canvas');surface.width=384;surface.height=292;
      const ctx=surface.getContext('2d',{willReadFrequently:true});let clock=0;
      const motion=api.createRenderer(surface,{now:()=>clock});
      motion.play(part);
      const times=part==='tail'?[0,.2,.4,.6,.8,1.12]:[0,.07,.18,.32,.43,.52];
      let changedAlpha=0;
      times.forEach((seconds,col)=>{
        ctx.clearRect(0,0,384,292);ctx.drawImage(base,0,0);const before=ctx.getImageData(0,0,384,292).data;
        clock=seconds*1000;motion.draw(ctx,clock);const after=ctx.getImageData(0,0,384,292).data;
        const [px,py,pw,ph]=api.patches[part];
        for(let y=0;y<292;y++)for(let x=0;x<384;x++){
          const i=(y*384+x)*4;
          if(x<px||x>=px+pw||y<py||y>=py+ph){for(let k=0;k<4;k++)if(before[i+k]!==after[i+k])throw Error('local motion changed fixed pixels: '+part);}
          else if(Math.abs(before[i+3]-after[i+3])>32)changedAlpha++;
          if((x===0||x===383||y===0||y===291)&&after[i+3])throw Error('local motion touches frame border: '+part);
        }
        display.fillStyle='#f1eae0';display.fillRect(col*384,row*316,384,316);display.drawImage(surface,col*384,row*316);
        display.fillStyle='#4a3830';display.font='14px sans-serif';display.fillText(part+' '+seconds.toFixed(2)+'s',col*384+10,row*316+309);
      });
      if(changedAlpha<30)throw Error('no visible motion: '+part);
      stats[part]={changedAlpha,fixedOutsidePatch:true};motion.stop();
    });
    return {stats,sheet:sheet.toDataURL('image/png')};
  })()`);
  fs.writeFileSync(
    path.join(output, 'claude-appendage-contact-sheet.png'),
    Buffer.from(qa.sheet.split(',')[1], 'base64')
  );
  const until = async test => {
    const end = Date.now() + 2200;
    while (!(await test())) {
      if (Date.now() > end) throw Error('appendage did not return to idle');
      await sleep(30);
    }
  };
  for (const part of ['ear-left', 'ear-right', 'tail']) {
    await require('./body-shortcut-smoke').click(win, part);
    assert.equal(
      await read(`window.lunaCharacter.motions.includes('${part}')`),
      true,
      'native appendage click: ' + part
    );
    assert.equal(
      await read(
        `window.lunaCharacter.expression==='neutral'&&!document.querySelector('#pet').classList.contains('happy')&&document.querySelector('#bubble').hidden`
      ),
      true,
      'appendage caused whole-body reaction'
    );
    await require('./body-shortcut-smoke').click(win, part);
    await until(() => read(`window.lunaCharacter.motions.length===0`));
  }
  for (const scale of [0.6, 1.8]) {
    await read(`api('pet-scale',${scale}).then(s=>applySettings(s.settings))`);
    for (const part of ['ear-left', 'ear-right', 'tail']) {
      await require('./body-shortcut-smoke').click(win, part);
      assert.equal(await read(`window.lunaCharacter.motions.includes('${part}')`), true, 'scaled appendage click');
      await read(`window.lunaCharacter.cancel();void 0`);
    }
  }
  await read(`api('pet-scale',1).then(s=>applySettings(s.settings))`);
  win.webContents.debugger.attach('1.3');
  try {
    await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }]
    });
    await read(
      `(()=>{if(!matchMedia('(prefers-reduced-motion: reduce)').matches||window.lunaCharacter.react('ear-left')||window.lunaCharacter.motions.length)throw Error('reduced motion ignored');})()`
    );
  } finally {
    await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', { features: [] });
    win.webContents.debugger.detach();
  }
  await read(`(async()=>{
    const pet=document.createElement('button'),player=window.createLunaCharacter(pet);
    try{if(!await player.load()||!player.react('tail'))throw Error('cleanup test not active');player.stop();if(player.motions.length||player.react('ear-left'))throw Error('motion survived stop');}
    finally{player.stop();pet.remove();}
  })()`);
  return {
    nativeEarAndTailClicks: true,
    independentPatches: qa.stats,
    noWholeBodyHop: true,
    scaledHitRegions: true,
    reducedMotion: true
  };
}
module.exports = { check };
