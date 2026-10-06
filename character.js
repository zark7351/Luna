// Freeze the original neutral drawing; swap only painted eye and mouth patches.
(()=>{
  const looks={
    'original-original':{file:'character.png',center:274,eyes:[[239,117],[294,108]],mouth:[272,145],closed:[[238,120],[292,111]],happy:[[239,120],[293,112]],smile:[270,146]},
    'original-jk':{file:'luna-silver-jk.png',center:276,eyes:[[240,121],[297,111]],mouth:[275,150],closed:[[223,123],[280,115]],happy:[[202,123],[260,114]],smile:[234,151]},
    'straight-original':{file:'luna-straight-original.png',center:291,eyes:[[258,115],[310,105]],mouth:[289,144],closed:[[223,118],[279,109]],happy:[[192,119],[245,110]],smile:[225,146]},
    'straight-jk':{file:'luna-straight-jk.png',center:291,eyes:[[258,117],[314,109]],mouth:[292,145],closed:[[225,122],[282,112]],happy:[[193,123],[248,114]],smile:[228,147]}
  };
  window.createLunaCharacter=pet=>{
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=1024;canvas.className='character-face';canvas.setAttribute('aria-hidden','true');pet.append(canvas);
    const ctx=canvas.getContext('2d'),images=new Map();let look,image,revision=0,expression='neutral',reaction=null,timers=[],stopped=false;
    const reduced=matchMedia('(prefers-reduced-motion: reduce)');
    function patch(frame,source,target,rx,ry){
      const layer=document.createElement('canvas');layer.width=rx*2;layer.height=ry*2;const paint=layer.getContext('2d');
      paint.drawImage(image,frame*512+source[0]-rx,source[1]-ry,rx*2,ry*2,0,0,rx*2,ry*2);
      const mask=paint.getImageData(0,0,layer.width,layer.height);
      for(let y=0;y<layer.height;y++)for(let x=0;x<layer.width;x++){
        const distance=Math.hypot((x+.5-rx)/rx,(y+.5-ry)/ry),index=(y*layer.width+x)*4+3;
        mask.data[index]*=Math.max(0,Math.min(1,(1-distance)/.15));
      }
      paint.putImageData(mask,0,0);ctx.drawImage(layer,target[0]-rx,target[1]-ry);
    }
    function draw(){
      ctx.clearRect(0,0,512,1024);if(!image||!look)return;
      expression=pet.classList.contains('sleeping')?'closed':reaction||(pet.classList.contains('happy')?'happy':pet.classList.contains('blink')?'closed':'neutral');canvas.dataset.expression=expression;
      if(['closed','wink','happy'].includes(expression))for(let i=0;i<(expression==='wink'?1:2);i++)patch(expression==='happy'?2:1,expression==='happy'?look.happy[i]:look.closed[i],look.eyes[i],21,16);
      if(['happy','wink','smile'].includes(expression))patch(2,look.smile,look.mouth,17,12);
      if(expression==='shy')for(const eye of look.eyes){const gradient=ctx.createRadialGradient(eye[0],eye[1]+17,1,eye[0],eye[1]+17,17);gradient.addColorStop(0,'rgba(229,137,158,.38)');gradient.addColorStop(1,'rgba(229,137,158,0)');ctx.fillStyle=gradient;ctx.fillRect(eye[0]-17,eye[1]+4,34,30);}
    }
    function cancel(){for(const timer of timers)clearTimeout(timer);timers=[];reaction=null;draw();}
    async function setLook(hair,outfit){
      const current=++revision;cancel();look=looks[hair+'-'+outfit]||looks['original-original'];image=null;draw();canvas.style.transform='translateX('+((256-look.center)/512*100)+'%)';
      const file=look.file;if(!images.has(file)){const asset=new Image();asset.src='assets/'+file;images.set(file,asset.decode().then(()=>asset));}
      try{const loaded=await images.get(file);if(!stopped&&current===revision){image=loaded;draw();}}catch(error){console.warn('表情素材加载失败',error.message);}
    }
    function react(name){
      const types={collect:'wink',capture:'wink',recording:'smile',wardrobe:'shy','reminder-save':'smile',reminder:'smile',complete:'happy',wink:'wink',smile:'smile',shy:'shy',happy:'happy'};
      if(!Object.hasOwn(types,name)||stopped)return false;cancel();if(pet.classList.contains('sleeping'))return true;reaction=types[name];draw();
      if(!reduced.matches&&reaction==='wink')timers.push(setTimeout(()=>{reaction='smile';draw();},210));
      timers.push(setTimeout(()=>{reaction=null;draw();},name==='reminder'?2400:1800));return true;
    }
    const observer=new MutationObserver(draw);observer.observe(pet,{attributes:true,attributeFilter:['class']});
    function stop(){stopped=true;revision++;cancel();observer.disconnect();}
    reduced.addEventListener('change',cancel);window.addEventListener('pagehide',stop);
    return {setLook,react,cancel,draw,get expression(){return expression;}};
  };
})();
