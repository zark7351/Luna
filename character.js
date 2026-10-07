// Freeze the original neutral drawing; swap only painted eye and mouth patches.
(()=>{
  window.createLunaCharacter=(pet,options={})=>{
    const assets=window.lunaCharacterAssets,resolveLook=options.resolveLook||assets.getLook;pet.classList.add('character-body');
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=1024;canvas.className='character-face';canvas.setAttribute('aria-hidden','true');pet.append(canvas);
    const ctx=canvas.getContext('2d'),images=new Map();let look,image,angryImage,alpha=null,revision=0,expression='neutral',reaction=null,timers=[],stopped=false;
    const reduced=matchMedia('(prefers-reduced-motion: reduce)');
    const loadImage=options.loadImage|| (async file=>{const asset=new Image();asset.src='assets/'+file;await asset.decode();return asset;});
    function getImage(file){
      if(!images.has(file)){const loading=Promise.resolve().then(()=>loadImage(file));images.set(file,loading);loading.catch(()=>{if(images.get(file)===loading)images.delete(file);});}
      return images.get(file);
    }
    function paintPatch(sourceImage,source,target,rx,ry,pose){
      const layer=document.createElement('canvas');layer.width=rx*2;layer.height=ry*2;const paint=layer.getContext('2d');
      paint.drawImage(sourceImage,source[0]-rx,source[1]-ry,rx*2,ry*2,0,0,rx*2,ry*2);
      const mask=paint.getImageData(0,0,layer.width,layer.height),scale=look.face.scale??pose.scale;
      for(let y=0;y<layer.height;y++)for(let x=0;x<layer.width;x++){
        const distance=Math.hypot((x+.5-rx)/rx,(y+.5-ry)/ry),index=(y*layer.width+x)*4+3;
        mask.data[index]*=Math.max(0,Math.min(1,(1-distance)/.15));
      }
      paint.putImageData(mask,0,0);ctx.save();ctx.translate(target[0],target[1]);ctx.rotate(pose.rotation);ctx.scale(scale,scale);ctx.drawImage(layer,-rx,-ry,rx*2,ry*2);ctx.restore();
    }
    function patch(frame,source,target,rx,ry,pose){paintPatch(image,[frame*look.pack.cellWidth+source[0],source[1]],target,rx,ry,pose);}
    function draw(){
      ctx.clearRect(0,0,512,1024);if(!image||!look)return;
      expression=pet.classList.contains('sleeping')?'closed':reaction||(pet.classList.contains('happy')?'happy':pet.classList.contains('blink')?'closed':'neutral');canvas.dataset.expression=expression;
      const closedPose=assets.expressionPose(look.pack.closed,look.face.eyes),happyPose=assets.expressionPose(look.pack.happy,look.face.eyes),angryPose=assets.expressionPose([[59,77],[114,68]],look.face.eyes);
      if(['closed','wink','happy'].includes(expression))for(let i=0;i<(expression==='wink'?1:2);i++)patch(expression==='happy'?2:1,expression==='happy'?look.pack.happy[i]:look.pack.closed[i],look.face.eyes[i],21,16,expression==='happy'?happyPose:closedPose);
      if(['happy','wink','smile'].includes(expression))patch(2,look.pack.smile,look.face.mouth,17,12,happyPose);
      // Keep annoyed eyes in the same local window as blinking; the old tall crop included silver fringe.
      if(expression==='angry'&&angryImage){for(let i=0;i<2;i++)paintPatch(angryImage,[[59,77],[114,68]][i],look.face.eyes[i],21,16,angryPose);paintPatch(angryImage,[92,105],look.face.mouth,17,12,angryPose);}
      if(expression==='pout'&&angryImage)paintPatch(angryImage,[92,105],look.face.mouth,17,12,angryPose);
      if(expression==='shy')for(const eye of look.face.eyes){const radius=17*(look.face.scale||1),gradient=ctx.createRadialGradient(eye[0],eye[1]+radius,1,eye[0],eye[1]+radius,radius);gradient.addColorStop(0,'rgba(229,137,158,.38)');gradient.addColorStop(1,'rgba(229,137,158,0)');ctx.fillStyle=gradient;ctx.fillRect(eye[0]-radius,eye[1]+4,radius*2,radius*2);}
    }
    function cancel(){for(const timer of timers)clearTimeout(timer);timers=[];reaction=null;draw();}
    async function setLook(hair,outfit){
      if(stopped)return false;const next=resolveLook(hair,outfit);assets.validateLook({body:next.body,face:next.face},{[next.face.pack]:next.pack});
      const current=++revision;cancel();
      try{
        const [body,face,angry]=await Promise.all([getImage(next.body.file),getImage(next.pack.file),getImage('angry-face.png')]);
        if(stopped||current!==revision)return false;assets.validateBodyImage(next.body,body);assets.validateFaceImage(next.pack,face);
        const mask=document.createElement('canvas');mask.width=512;mask.height=1024;const paint=mask.getContext('2d',{willReadFrequently:true});paint.drawImage(body,0,0,512,1024,0,0,512,1024);const pixels=paint.getImageData(0,0,512,1024).data;alpha=new Uint8Array(512*1024);for(let i=0;i<alpha.length;i++)alpha[i]=pixels[i*4+3];
        if(angry.naturalWidth!==160||angry.naturalHeight!==160)throw Error('Invalid angry expression asset');
        look=next;image=face;angryImage=angry;assets.applyBody(pet,look,body.src);canvas.style.transform='translateX('+((256-look.body.center)/512*100)+'%)';canvas.dataset.facePack=look.face.pack;draw();return true;
      }catch(error){console.warn('角色素材加载失败',error.message);return false;}
    }
    function react(name){
      const types={collect:'wink',capture:'wink',recording:'smile',wardrobe:'shy','reminder-save':'smile',reminder:'smile',complete:'happy',wink:'wink',smile:'smile',shy:'shy',happy:'happy',angry:'angry',pout:'pout'};
      if(!Object.hasOwn(types,name)||stopped)return false;cancel();if(pet.classList.contains('sleeping'))return true;reaction=types[name];draw();
      if(!reduced.matches&&reaction==='wink')timers.push(setTimeout(()=>{reaction='smile';draw();},210));
      timers.push(setTimeout(()=>{reaction=null;draw();},name==='reminder'?2400:1800));return true;
    }
    const observer=new MutationObserver(draw);observer.observe(pet,{attributes:true,attributeFilter:['class']});
    function stop(){if(stopped)return;stopped=true;revision++;cancel();observer.disconnect();reduced.removeEventListener('change',cancel);window.removeEventListener('pagehide',stop);}
    reduced.addEventListener('change',cancel);window.addEventListener('pagehide',stop);
    function hitRegion(clientX,clientY){if(stopped||!look||!alpha)return null;const box=pet.getBoundingClientRect(),x=Math.floor((clientX-box.left)/box.width*512-(256-look.body.center)),y=Math.floor((clientY-box.top)/box.height*1024);if(x<0||x>=512||y<0||y>=1024||alpha[y*512+x]<32)return null;return window.lunaBodyShortcuts.regionAt(x,y,look.body.center);}
    return {setLook,react,cancel,draw,stop,hitRegion,get expression(){return expression;}};
  };
})();
