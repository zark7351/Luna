const fs=require('node:fs');
const path=require('node:path');
async function checkCharacter(win,output,label){
  await win.webContents.executeJavaScript(`(async()=>{
    const pet=document.querySelector('#pet'),source=new Image();source.src=getComputedStyle(pet).backgroundImage.slice(5,-2);await source.decode();
    clearTimeout(happyTimer);pet.classList.remove('happy','blink','sleeping');window.lunaCharacter.cancel();window.lunaCharacter.draw();
    const overlay=pet.querySelector('canvas'),base=document.createElement('canvas');base.width=512;base.height=1024;const ctx=base.getContext('2d',{willReadFrequently:true});
    const face=window.lunaCharacterAssets.getLook(pet.dataset.hair,pet.dataset.outfit).face,anchors=[...face.eyes,face.mouth];
    const faceBounds={left:Math.min(...anchors.map(p=>p[0]))-32,right:Math.max(...anchors.map(p=>p[0]))+32,top:Math.min(...anchors.map(p=>p[1]))-42,bottom:Math.max(...anchors.map(p=>p[1]))+40};
    ctx.drawImage(source,0,0,512,1024,0,0,512,1024);ctx.drawImage(overlay,0,0);const neutral=ctx.getImageData(0,0,512,1024).data;
    const fixed=getComputedStyle(pet,'::before').transform;
    const pixels=ctx.getImageData(0,250,512,700).data;let sum=0,count=0;for(let p=0;p<pixels.length;p+=4)if(pixels[p+3]>200){sum+=(p/4)%512;count++;}
    if(Math.abs(sum/count+new DOMMatrix(fixed).m41*512/pet.clientWidth-256)>1)throw Error('character off centre');
    for(const expression of ['closed','happy','wink','smile','shy','angry','pout']){
      window.lunaCharacter.cancel();pet.classList.remove('happy','blink','sleeping');
      if(expression==='closed')pet.classList.add('blink');else window.lunaCharacter.react(expression);window.lunaCharacter.draw();
      ctx.clearRect(0,0,512,1024);ctx.drawImage(source,0,0,512,1024,0,0,512,1024);ctx.drawImage(overlay,0,0);
      const changed=ctx.getImageData(0,0,512,1024).data;let differences=0;
      for(let i=0;i<changed.length;i+=4)if(changed[i]!==neutral[i]||changed[i+1]!==neutral[i+1]||changed[i+2]!==neutral[i+2]||changed[i+3]!==neutral[i+3]){
        const x=i/4%512,y=Math.floor(i/4/512);if(x<faceBounds.left||x>faceBounds.right||y<faceBounds.top||y>faceBounds.bottom)throw Error('expression changed hair or body: '+expression+' '+x+','+y);
        if(expression!=='shy'){
          const pose=window.lunaCharacterAssets.expressionPose(expression==='angry'?[[59,77],[114,68]]:expression==='closed'||expression==='wink'?window.lunaCharacterAssets.getLook(pet.dataset.hair,pet.dataset.outfit).pack.closed:window.lunaCharacterAssets.getLook(pet.dataset.hair,pet.dataset.outfit).pack.happy,face.eyes),scale=face.scale??pose.scale;
          const nearEye=['closed','happy','wink','angry'].includes(expression)&&face.eyes.some(p=>Math.hypot((x-p[0])/(24*scale),(y-p[1])/(19*scale))<1.05),nearMouth=expression!=='closed'&&Math.hypot((x-face.mouth[0])/(20*scale),(y-face.mouth[1])/(16*scale))<1.05;
          if(!nearEye&&!nearMouth)throw Error('expression includes fringe/forehead outside feature: '+expression+' '+x+','+y);
        }
        differences++;
      }
      if(differences<60||getComputedStyle(pet,'::before').backgroundPosition!=='0% 0%'||getComputedStyle(pet,'::before').transform!==fixed||getComputedStyle(pet).transform!=='none'||pet.getAnimations().length)throw Error('expression not fixed to original drawing: '+expression);
    }
    window.lunaCharacter.cancel();pet.classList.remove('happy','blink','sleeping');window.lunaCharacter.draw();
    const bounds=pet.getBoundingClientRect();showMessage('较长的消息'.repeat(12),0);const bubble=document.querySelector('#bubble').getBoundingClientRect();if(bubble.bottom>bounds.top-8)throw Error('long bubble overlaps head');showMessage('');
  })()`);
  for(const name of ['closed','wink','smile','shy','happy','angry','pout']){
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
  await win.webContents.executeJavaScript(`(async()=>{
    for(const name of ['collect','capture','recording','wardrobe','reminder-save','complete'])if(!window.smokeUiEffects.includes(name))throw Error('missing action reaction: '+name);
    document.querySelector('#settings').hidden=true;document.querySelector('#wardrobe').hidden=true;closeSheets();window.lunaEffects.clear();showMessage('');showControls();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const button=document.querySelector('#library-button'),box=button.getBoundingClientRect();window.lunaEffects.burst('collect');
    if(!document.elementFromPoint((box.left+box.right)/2,(box.top+box.bottom)/2)?.closest('#library-button')||getComputedStyle(document.querySelector('.character-face')).pointerEvents!=='none'||document.querySelector('#luna-fx'))throw Error('reaction intercepted controls');
    for(let i=0;i<12;i++)window.lunaEffects.burst('collect');if(document.querySelectorAll('.character-face').length!==1||window.lunaEffects.burst('unknown')!==false)throw Error('reaction resource limit');
  })()`);
  await new Promise(r=>setTimeout(r,2000));const finishUntil=Date.now()+1500;while(!await win.webContents.executeJavaScript(`window.lunaCharacter.expression==='neutral'`)){if(Date.now()>finishUntil)throw Error('reaction did not finish: '+await win.webContents.executeJavaScript(`window.lunaCharacter.expression`));await new Promise(r=>setTimeout(r,60));}
  win.webContents.debugger.attach('1.3');
  try{
    await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await new Promise(r=>setTimeout(r,80));
    await win.webContents.executeJavaScript(`(()=>{window.lunaEffects.burst('capture');window.lunaEffects.pulse(document.querySelector('#library-button'));if(!matchMedia('(prefers-reduced-motion: reduce)').matches||document.querySelector('#library-button').getAnimations().length||window.lunaCharacter.expression!=='wink')throw Error('reduced motion ignored');})()`);
    await new Promise(r=>setTimeout(r,400));if(!await win.webContents.executeJavaScript(`window.lunaCharacter.expression==='wink'`))throw Error('reduced motion wink animated');
  }finally{await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[]});win.webContents.debugger.detach();}
  return {committedActions:true,mutedVisuals:true,paintedExpressions:true,noImageMovement:true,clickThrough:true,boundedTimers:true,cleanup:true,reducedMotion:true};
}
async function checkHybrid(win){
  return win.webContents.executeJavaScript(`(async()=>{
    const assets=window.lunaCharacterAssets,shared=assets.facePacks['black-jk'],node=document.createElement('div');node.id='hybrid-fixture';node.style.cssText='position:absolute;left:-1000px;width:200px;height:400px;background-size:0 0';
    document.body.append(node);
    const definitions={
      dress:{body:{file:'single-dress.png',columns:1,center:291},face:{...assets.looks['straight-original'].face,pack:'black-jk'}},
      jk:{body:{file:'single-jk.png',columns:1,center:291},face:assets.looks['straight-jk'].face}
    };
    const singleImages=new Map();
    const controller=createLunaCharacter(node,{resolveLook:(_,outfit)=>assets.validateLook(definitions[outfit]),loadImage:async file=>{
      if(singleImages.has(file))return singleImages.get(file);const asset=new Image();asset.src='assets/'+file;await asset.decode();return asset;
    }});
    try{
      for(const [outfit,file]of [['dress','luna-straight-original.png'],['jk','luna-straight-jk.png']]){
        const body=new Image();body.src='assets/'+file;await body.decode();
        // Isolated in-memory single-frame fixture, never an added user outfit or edited asset.
        const base=document.createElement('canvas');base.width=512;base.height=1024;const paint=base.getContext('2d',{willReadFrequently:true});paint.drawImage(body,0,0,512,1024,0,0,512,1024);
        const single=new Image();single.src=base.toDataURL();await single.decode();singleImages.set(definitions[outfit].body.file,single);
        if(!await controller.setLook('fixture',outfit))throw Error('hybrid load failed');controller.cancel();controller.draw();
        const face=node.querySelector('canvas');paint.drawImage(face,0,0);const neutral=paint.getImageData(0,0,512,1024).data;
        if(face.dataset.facePack!=='black-jk'||definitions[outfit].body.file===shared.file||node.dataset.bodyColumns!=='1'||getComputedStyle(node,'::before').backgroundSize!=='100% 100%')throw Error('body still depends on expression sheet: '+JSON.stringify({face:face.dataset.facePack,body:node.dataset.bodyColumns,bg:getComputedStyle(node,'::before').backgroundSize}));
        for(const expression of ['happy','wink','smile','shy']){
          controller.react(expression);controller.draw();paint.clearRect(0,0,512,1024);paint.drawImage(body,0,0,512,1024,0,0,512,1024);paint.drawImage(face,0,0);
          const changed=paint.getImageData(0,0,512,1024).data;let differences=0;
          for(let i=0;i<changed.length;i+=4)if(changed[i]!==neutral[i]||changed[i+1]!==neutral[i+1]||changed[i+2]!==neutral[i+2]||changed[i+3]!==neutral[i+3]){
            const x=i/4%512,y=Math.floor(i/4/512);if(x<200||x>340||y<85||y>178)throw Error('shared expression moved single body');differences++;
          }
          if(differences<60)throw Error('shared expression did not render');
        }
      }
      const early=controller.setLook('fixture','dress'),latest=controller.setLook('fixture','jk');await Promise.all([early,latest]);
      if(node.dataset.bodyFile!=='single-jk.png'||node.querySelector('canvas').dataset.facePack!=='black-jk')throw Error('late look replaced current body');
      const pending=controller.setLook('fixture','dress');controller.stop();if(await pending!==false||controller.react('happy')!==false)throw Error('stopped controller accepted late result');
      return {singleFrameBody:true,sharedExpressionPack:true,twoOutfits:true,fixedBodyPixels:true,latestLookWins:true,stoppedLoadIgnored:true};
    }finally{controller.stop();node.remove();}
  })()`);
}
module.exports={checkCharacter,checkReactions,checkHybrid};
