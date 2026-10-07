// Whole-body drawings and reusable expression packs have independent source files.
// Existing three-cell sheets are legacy providers; a new outfit can be one neutral PNG.
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();else root.lunaCharacterAssets=factory();
})(typeof window==='object'?window:globalThis,()=>{
  const stage={width:512,height:1024};
  const facePacks={
    'silver-dress':{file:'character.png',cellWidth:512,closed:[[236,121],[293,112]],happy:[[236,120],[291,109]],smile:[270,146]},
    'silver-jk':{file:'luna-silver-jk.png',cellWidth:512,closed:[[222,124],[282,114]],happy:[[199,123],[258,111]],smile:[235,152]},
    'black-dress':{file:'luna-straight-original.png',cellWidth:512,closed:[[222,120],[280,110]],happy:[[190,118],[247,107]],smile:[225,146]},
    'black-jk':{file:'luna-straight-jk.png',cellWidth:512,closed:[[226,122],[284,113]],happy:[[193,121],[250,110]],smile:[228,147]}
  };
  const looks={
    'original-original':{body:{file:'character.png',columns:3,center:274},face:{pack:'silver-dress',eyes:[[239,117],[294,108]],mouth:[272,145]}},
    'original-jk':{body:{file:'luna-silver-jk.png',columns:3,center:276},face:{pack:'silver-jk',eyes:[[240,121],[297,112]],mouth:[273,150]}},
    'straight-original':{body:{file:'luna-straight-original.png',columns:3,center:291},face:{pack:'black-dress',eyes:[[258,115],[310,105]],mouth:[289,144]}},
    'straight-jk':{body:{file:'luna-straight-jk.png',columns:3,center:291},face:{pack:'black-jk',eyes:[[258,117],[311,109]],mouth:[292,145]}},
    'bob-original':{body:{file:'luna-bob-original.png',columns:1,center:261.6},face:{pack:'silver-dress',eyes:[[226,126],[275,117]],mouth:[257,152]}},
    'bob-jk':{body:{file:'luna-bob-jk.png',columns:1,center:256.2},face:{pack:'silver-dress',eyes:[[222,119],[276,111]],mouth:[254,148]}},
    'bob-secretary':{body:{file:'luna-bob-secretary.png',columns:1,center:259.5},face:{pack:'silver-dress',eyes:[[230,113],[277,105]],mouth:[260,138]}},
    'bob-nurse':{body:{file:'luna-bob-nurse.png',columns:1,center:257.7},face:{pack:'silver-dress',eyes:[[228,132],[278,125]],mouth:[259,158]}},
    'twintails-original':{body:{file:'luna-twintails-original.png',columns:1,center:263.8},face:{pack:'silver-dress',eyes:[[226,120],[277,112]],mouth:[257,148]}},
    'twintails-jk':{body:{file:'luna-twintails-jk.png',columns:1,center:255.9},face:{pack:'silver-dress',eyes:[[221,117],[273,109]],mouth:[254,146]}},
    'twintails-secretary':{body:{file:'luna-twintails-secretary.png',columns:1,center:260},face:{pack:'silver-dress',eyes:[[229,111],[277,104]],mouth:[258,139]}},
    'twintails-nurse':{body:{file:'luna-twintails-nurse.png',columns:1,center:258.9},face:{pack:'silver-dress',eyes:[[230,127],[279,119]],mouth:[260,154]}},
    'original-secretary':{body:{file:'luna-original-secretary.png',columns:1,center:258},face:{pack:'silver-dress',eyes:[[224,112],[271,104]],mouth:[253,136]}},
    'original-nurse':{body:{file:'luna-original-nurse.png',columns:1,center:255.7},face:{pack:'silver-dress',eyes:[[223,137],[273,129]],mouth:[254,163]}},
    'straight-secretary':{body:{file:'luna-straight-secretary.png',columns:1,center:259},face:{pack:'silver-dress',eyes:[[226,114],[277,107]],mouth:[257,138]}},
    'straight-nurse':{body:{file:'luna-straight-nurse.png',columns:1,center:256.5},face:{pack:'silver-dress',eyes:[[226,133],[273,125]],mouth:[257,157]}}
  };
  const file=value=>typeof value==='string'&&/^[a-z0-9][a-z0-9_-]*\.png$/i.test(value);
  const point=(value,rx,ry)=>Array.isArray(value)&&value.length===2&&value.every(Number.isFinite)&&value[0]>=rx&&value[0]<=stage.width-rx&&value[1]>=ry&&value[1]<=stage.height-ry;
  function validateLook(look,packs=facePacks){
    const body=look?.body,face=look?.face,pack=packs[face?.pack];
    if(!body||!file(body.file)||!Number.isInteger(body.columns)||body.columns<1||body.columns>3||!Number.isFinite(body.center)||body.center<0||body.center>stage.width)throw Error('Invalid whole-body asset');
    if(!pack||!file(pack.file)||pack.cellWidth!==stage.width)throw Error('Invalid expression pack');
    if(!Array.isArray(face.eyes)||face.eyes.length!==2||!face.eyes.every(value=>point(value,21,16))||!point(face.mouth,17,12))throw Error('Invalid face anchors');
    if(face.scale!==undefined&&(!Number.isFinite(face.scale)||face.scale<.5||face.scale>1.5))throw Error('Invalid expression scale');
    for(const name of ['closed','happy'])if(!Array.isArray(pack[name])||pack[name].length!==2||!pack[name].every(value=>point(value,21,16)))throw Error('Invalid eye source');
    if(!point(pack.smile,17,12))throw Error('Invalid mouth source');return {body,face,pack};
  }
  function getLook(hair,outfit){const look=looks[hair+'-'+outfit]||looks['original-original'];return validateLook(look);}
  // Map the source eye line to the drawing's eye line without shearing facial features.
  function expressionPose(sourceEyes,targetEyes){
    const vector=eyes=>{if(!Array.isArray(eyes)||eyes.length!==2||!eyes.every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)))throw Error('Invalid expression eye line');const x=eyes[1][0]-eyes[0][0],y=eyes[1][1]-eyes[0][1];if(x<10)throw Error('Invalid expression eye spacing');return {x,y,length:Math.hypot(x,y)};};
    const source=vector(sourceEyes),target=vector(targetEyes);return {scale:target.length/source.length,rotation:Math.atan2(target.y,target.x)-Math.atan2(source.y,source.x)};
  }
  function validateFaceImage(pack,image){
    const inside=(frame,point,rx,ry)=>frame*pack.cellWidth+point[0]-rx>=0&&frame*pack.cellWidth+point[0]+rx<=image.naturalWidth&&point[1]-ry>=0&&point[1]+ry<=image.naturalHeight;
    if(!pack.closed.every(value=>inside(1,value,21,16))||!pack.happy.every(value=>inside(2,value,21,16))||!inside(2,pack.smile,17,12))throw Error('Expression source outside image');
  }
  function validateBodyImage(body,image){
    if(image.naturalWidth!==stage.width*body.columns||image.naturalHeight!==stage.height)throw Error('Whole-body image must match its declared frame layout');
  }
  function applyBody(node,look,source){
    const {body}=look;node.style.backgroundImage="url('"+(source||'assets/'+body.file)+"')";
    node.style.setProperty('--sprite-width',body.columns*100+'%');node.style.setProperty('--sprite-height','100%');node.style.setProperty('--sprite-row','0%');
    node.style.setProperty('--body-offset',(stage.width/2-body.center)/stage.width*100+'%');node.dataset.bodyFile=body.file;node.dataset.bodyColumns=String(body.columns);
  }
  function freeze(value){Object.values(value).forEach(item=>{if(item&&typeof item==='object')freeze(item);});return Object.freeze(value);}
  freeze(stage);freeze(facePacks);freeze(looks);
  return Object.freeze({stage,facePacks,looks,validateLook,validateFaceImage,validateBodyImage,getLook,expressionPose,applyBody});
});
