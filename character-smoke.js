const fs=require('node:fs');
const path=require('node:path');
async function checkCharacter(win,output,label){
  await win.webContents.executeJavaScript(`(async()=>{
    const pet=document.querySelector('#pet'),source=new Image();source.src=getComputedStyle(pet).backgroundImage.slice(5,-2);await source.decode();
    clearTimeout(happyTimer);pet.classList.remove('happy','blink','sleeping');window.lunaCharacter.cancel();window.lunaCharacter.draw();
    const overlay=pet.querySelector('canvas'),base=document.createElement('canvas');base.width=512;base.height=1024;const ctx=base.getContext('2d',{willReadFrequently:true});
    ctx.drawImage(source,0,0,512,1024,0,0,512,1024);ctx.drawImage(overlay,0,0);const neutral=ctx.getImageData(0,0,512,1024).data;
    const fixed=getComputedStyle(pet,'::before').transform;
    const pixels=ctx.getImageData(0,250,512,700).data;let sum=0,count=0;for(let p=0;p<pixels.length;p+=4)if(pixels[p+3]>200){sum+=(p/4)%512;count++;}
    if(Math.abs(sum/count+new DOMMatrix(fixed).m41*512/pet.clientWidth-256)>1)throw Error('character off centre');
    for(const expression of ['closed','happy','wink','smile','shy']){
      window.lunaCharacter.cancel();pet.classList.remove('happy','blink','sleeping');
      if(expression==='closed')pet.classList.add('blink');else window.lunaCharacter.react(expression);window.lunaCharacter.draw();
      ctx.clearRect(0,0,512,1024);ctx.drawImage(source,0,0,512,1024,0,0,512,1024);ctx.drawImage(overlay,0,0);
      const changed=ctx.getImageData(0,0,512,1024).data;let differences=0;
      for(let i=0;i<changed.length;i+=4)if(changed[i]!==neutral[i]||changed[i+1]!==neutral[i+1]||changed[i+2]!==neutral[i+2]||changed[i+3]!==neutral[i+3]){
        const x=i/4%512,y=Math.floor(i/4/512);if(x<200||x>340||y<85||y>178)throw Error('expression changed hair or body: '+expression+' '+x+','+y+' values '+[...changed.slice(i,i+4)]+' / '+[...neutral.slice(i,i+4)]+' overlay '+[...overlay.getContext('2d').getImageData(x,y,1,1).data]);differences++;
      }
      if(differences<60||getComputedStyle(pet,'::before').backgroundPosition!=='0% 0%'||getComputedStyle(pet,'::before').transform!==fixed||getComputedStyle(pet).transform!=='none'||pet.getAnimations().length)throw Error('expression not fixed to original drawing: '+expression);
    }
    window.lunaCharacter.cancel();pet.classList.remove('happy','blink','sleeping');window.lunaCharacter.draw();
    const bar=document.querySelector('#today-panel');bar.hidden=false;const panel=bar.getBoundingClientRect(),bounds=pet.getBoundingClientRect();
    if(Math.abs((panel.left+panel.right-bounds.left-bounds.right)/2)>.5||bounds.top-panel.bottom<8||bounds.top-panel.bottom>25)throw Error('information placement');
    showMessage('较长的消息'.repeat(12),0);const bubble=document.querySelector('#bubble').getBoundingClientRect();
    if(Math.abs(bubble.bottom-panel.bottom)>.5||bubble.bottom>bounds.top-8)throw Error('long bubble overlaps head');showMessage('');
  })()`);
  for(const name of ['closed','wink','smile','shy','happy']){
    const face=await win.webContents.executeJavaScript(`(async()=>{
      const pet=document.querySelector('#pet');pet.classList.remove('happy','blink');window.lunaCharacter.cancel();
      if('${name}'==='closed')pet.classList.add('blink');else window.lunaCharacter.react('${name}');window.lunaCharacter.draw();
      const source=new Image();source.src=getComputedStyle(pet).backgroundImage.slice(5,-2);await source.decode();
      const c=document.createElement('canvas');c.width=512;c.height=1024;const ctx=c.getContext('2d');ctx.drawImage(source,0,0,512,1024,0,0,512,1024);ctx.drawImage(pet.querySelector('canvas'),0,0);
      const detail=document.createElement('canvas');detail.width=280;detail.height=240;detail.getContext('2d').drawImage(c,200,75,140,120,0,0,280,240);return detail.toDataURL();
    })()`);
    fs.writeFileSync(path.join(output,'luna-face-'+label+'-'+name+'.png'),Buffer.from(face.split(',')[1],'base64'));
  }
  await win.webContents.executeJavaScript(`{window.lunaCharacter.cancel();document.querySelector('#pet').classList.remove('happy','blink');}`);
}
async function checkReactions(win){
  await win.webContents.executeJavaScript(`(()=>{
    for(const name of ['collect','capture','recording','wardrobe','reminder-save','complete'])if(!window.smokeUiEffects.includes(name))throw Error('missing action reaction: '+name);
    document.querySelector('#settings').hidden=true;document.querySelector('#wardrobe').hidden=true;closeSheets();window.lunaEffects.clear();showMessage('');showControls();
    const button=document.querySelector('#library-button'),box=button.getBoundingClientRect();window.lunaEffects.burst('collect');
    if(!document.elementFromPoint((box.left+box.right)/2,(box.top+box.bottom)/2)?.closest('#library-button')||getComputedStyle(document.querySelector('.character-face')).pointerEvents!=='none'||document.querySelector('#luna-fx'))throw Error('reaction intercepted controls');
    for(let i=0;i<12;i++)window.lunaEffects.burst('collect');if(document.querySelectorAll('.character-face').length!==1||window.lunaEffects.burst('unknown')!==false)throw Error('reaction resource limit');
  })()`);
  await new Promise(r=>setTimeout(r,2000));if(!await win.webContents.executeJavaScript(`window.lunaCharacter.expression==='neutral'`))throw Error('reaction did not finish');
  win.webContents.debugger.attach('1.3');
  try{
    await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await new Promise(r=>setTimeout(r,80));
    await win.webContents.executeJavaScript(`(()=>{window.lunaEffects.burst('capture');window.lunaEffects.pulse(document.querySelector('#library-button'));if(!matchMedia('(prefers-reduced-motion: reduce)').matches||document.querySelector('#library-button').getAnimations().length||window.lunaCharacter.expression!=='wink')throw Error('reduced motion ignored');})()`);
    await new Promise(r=>setTimeout(r,400));if(!await win.webContents.executeJavaScript(`window.lunaCharacter.expression==='wink'`))throw Error('reduced motion wink animated');
  }finally{await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[]});win.webContents.debugger.detach();}
  return {committedActions:true,mutedVisuals:true,paintedExpressions:true,noImageMovement:true,clickThrough:true,boundedTimers:true,cleanup:true,reducedMotion:true};
}
module.exports={checkCharacter,checkReactions};
