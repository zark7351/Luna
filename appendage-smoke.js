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
      const times=part==='tail'?[0,.14,.28,.52,.8,api.durations.tail]:[0,.07,.18,.32,.43,.52];
      let changedAlpha=0;
      times.forEach((seconds,col)=>{
        ctx.clearRect(0,0,384,292);ctx.drawImage(base,0,0);const before=ctx.getImageData(0,0,384,292).data;
        clock=seconds*1000;motion.draw(ctx,clock);const after=ctx.getImageData(0,0,384,292).data;
        const [px,py,pw,ph]=api.patches[part];
        for(let y=0;y<292;y++)for(let x=0;x<384;x++){
          const i=(y*384+x)*4;
          if(x<px||x>=px+pw||y<py||y>=py+ph){for(let k=0;k<4;k++)if(before[i+k]!==after[i+k])throw Error('local motion changed fixed pixels: '+part);}
          else if(Math.abs(before[i+3]-after[i+3])>32)changedAlpha++;
          if(part==='tail'&&before[i+3]===255&&((x>=102&&x<118&&y>=148&&y<196)||(x>=100&&x<120&&y>=197&&y<262)||(x>=90&&x<106&&y>=211&&y<261)||(x>=80&&x<98&&y>=232&&y<262)||(x>=65&&x<81&&y>=247&&y<269)))for(let k=0;k<4;k++)if(before[i+k]!==after[i+k])throw Error('tail moved foreground hair: '+x+','+y+' at '+seconds);
          if(seconds===api.durations[part])for(let k=0;k<4;k++)if(before[i+k]!==after[i+k])throw Error('local motion did not restore original pixels: '+part);
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
  const hairCheck = await read(`(async()=>{
    const api=window.claudeAppendages,image=new Image();
    image.src='assets/luna-2d/idle.webp';await image.decode();
    const base=document.createElement('canvas'),surface=document.createElement('canvas');
    base.width=surface.width=384;base.height=surface.height=292;
    const source=base.getContext('2d',{willReadFrequently:true}),ctx=surface.getContext('2d',{willReadFrequently:true});
    const hair=[[102,148,16,48],[100,197,20,65],[90,211,16,50],[80,232,18,30],[65,247,16,22]];
    let clock=0,samples=0;const motion=api.createRenderer(surface,{now:()=>clock});
    try{
      for(let frame=0;frame<192;frame+=24){
        source.clearRect(0,0,384,292);source.drawImage(image,frame%12*384,Math.floor(frame/12)*292,384,292,0,0,384,292);
        const original=source.getImageData(0,0,384,292).data;
        clock=0;motion.clear();motion.play('tail');
        for(const seconds of [.14,.28,.52,.8,1.1]){
          ctx.clearRect(0,0,384,292);ctx.drawImage(base,0,0);clock=seconds*1000;motion.draw(ctx,clock);
          const moved=ctx.getImageData(0,0,384,292).data;
          for(const [x,y,w,h] of hair)for(let py=y;py<y+h;py++)for(let px=x;px<x+w;px++){
            const i=(py*384+px)*4;if(original[i+3]!==255)continue;
            for(let k=0;k<4;k++)if(original[i+k]!==moved[i+k])throw Error('tail moved hair in idle frame '+frame+' at '+px+','+py);
            samples++;
          }
        }
      }
      return {idleFrames:8,motionSamples:40,fixedHairPixels:samples};
    }finally{motion.stop();}
  })()`);
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
    isolatedTailHair: hairCheck,
    noWholeBodyHop: true,
    scaledHitRegions: true,
    reducedMotion: true
  };
}
module.exports = { check };
