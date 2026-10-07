const test=require('node:test');
const assert=require('node:assert/strict');
const assets=require('../character-assets');
test('全部十六种独立搭配有对应素材，新搭配为透明单帧且复用表情包',()=>{
  const fs=require('node:fs'),path=require('node:path');
  assert.equal(Object.keys(assets.looks).length,16);
  for(const hair of ['original','straight','bob','twintails'])for(const outfit of ['original','jk','secretary','nurse']){
    const key=hair+'-'+outfit;assert.ok(Object.hasOwn(assets.looks,key),key);
    const look=assets.getLook(hair,outfit),bytes=fs.readFileSync(path.join(__dirname,'..','assets',look.body.file));
    assert.equal(bytes.readUInt32BE(16),512*look.body.columns,key);assert.equal(bytes.readUInt32BE(20),1024,key);
    if(['bob','twintails'].includes(hair)||['secretary','nurse'].includes(outfit)){assert.equal(look.body.columns,1);assert.notEqual(look.body.file,look.pack.file);assert.equal(bytes[25],6,'RGBA export');}
  }
});
test('四种旧搭配保留原整身图、独立表情引用和固定面部锚点',()=>{
  for(const hair of ['original','straight'])for(const outfit of ['original','jk']){
    const look=assets.getLook(hair,outfit);assert.equal(look.body.columns,3);assert.equal(look.pack,assets.facePacks[look.face.pack]);assert.equal(look.face.eyes.length,2);assert.ok(Object.isFrozen(look.face.eyes[0]));
  }
  assert.deepEqual(assets.getLook('missing','outfit'),assets.getLook('original','original'));
});
test('新增单帧整身图可引用已有表情包，无需新闭眼与开心帧',()=>{
  const reference=assets.getLook('straight','jk');
  const input={body:{file:'new-outfit.png',columns:1,center:291},face:reference.face};
  const look=assets.validateLook(input);assert.equal(look.pack.file,'luna-straight-jk.png');assert.notEqual(look.body.file,look.pack.file);
  const properties={};const node={style:{setProperty:(key,value)=>properties[key]=value},dataset:{}};
  assets.applyBody(node,look);assert.equal(properties['--sprite-width'],'100%');assert.equal(properties['--body-offset'],(256-291)/512*100+'%');assert.equal(node.dataset.bodyFile,'new-outfit.png');
  assert.equal(node.style.backgroundImage,"url('assets/new-outfit.png')");
});
test('错误表情包、越界锚点、非法素材路径和帧布局在绘制前拒绝',()=>{
  const valid=structuredClone(assets.looks['straight-jk']);
  for(const invalid of [
    {...valid,body:{...valid.body,file:'../other.png'}},
    {...valid,body:{...valid.body,file:'https://example.com/face.png'}},
    {...valid,body:{...valid.body,columns:0}},
    {...valid,body:{...valid.body,center:Infinity}},
    {...valid,face:{...valid.face,pack:'missing'}},
    {...valid,face:{...valid.face,scale:Infinity}},
    {...valid,face:{...valid.face,scale:0}},
    {...valid,face:{...valid.face,eyes:[[2,2],valid.face.eyes[1]]}}
  ])assert.throws(()=>assets.validateLook(invalid));
  const pack=structuredClone(assets.facePacks['black-jk']);pack.smile=[999,999];assert.throws(()=>assets.validateLook(valid,{'black-jk':pack}));
});
test('独立表情图只需覆盖眼嘴区域，实际文件裁切或缺帧不能静默进入绘制',()=>{
  const pack=assets.facePacks['black-jk'];
  assert.doesNotThrow(()=>assets.validateFaceImage(pack,{naturalWidth:1536,naturalHeight:200}));
  assert.throws(()=>assets.validateFaceImage(pack,{naturalWidth:512,naturalHeight:1024}));
  assert.throws(()=>assets.validateFaceImage(pack,{naturalWidth:1536,naturalHeight:140}));
});
test('实际整身尺寸必须匹配声明，单帧与旧三帧都接受，裁切和错误帧数拒绝',()=>{
  const original=assets.getLook('original','original').body;
  assert.doesNotThrow(()=>assets.validateBodyImage(original,{naturalWidth:1536,naturalHeight:1024}));
  assert.doesNotThrow(()=>assets.validateBodyImage({...original,columns:1},{naturalWidth:512,naturalHeight:1024}));
  assert.throws(()=>assets.validateBodyImage(original,{naturalWidth:512,naturalHeight:1024}));
  assert.throws(()=>assets.validateBodyImage({...original,columns:1},{naturalWidth:512,naturalHeight:900}));
});

test('表情相似变换将源眼线映射到目标脸的角度和间距，不引入剪切',()=>{
  const source=[[20,30],[80,24]],target=[[100,130],[148,118]],pose=assets.expressionPose(source,target);
  const dx=source[1][0]-source[0][0],dy=source[1][1]-source[0][1];
  assert.ok(Math.abs(pose.scale*(dx*Math.cos(pose.rotation)-dy*Math.sin(pose.rotation))-(target[1][0]-target[0][0]))<1e-9);
  assert.ok(Math.abs(pose.scale*(dx*Math.sin(pose.rotation)+dy*Math.cos(pose.rotation))-(target[1][1]-target[0][1]))<1e-9);
  assert.deepEqual(assets.expressionPose(source,source),{scale:1,rotation:0});
  for(const invalid of [[],[[0,0],[0,0]],[[80,0],[20,0]],[[20,30],[Infinity,30]]])assert.throws(()=>assets.expressionPose(invalid,target));
  for(const look of Object.values(assets.looks))for(const expression of ['closed','happy']){
    const current=assets.expressionPose(assets.facePacks[look.face.pack][expression],look.face.eyes);
    assert.ok(current.scale>.7&&current.scale<1.15);assert.ok(Math.abs(current.rotation)<.15);
  }
});
