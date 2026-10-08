const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {createCollection}=require('../collection');
const {region,validateOptions,captureOptions,bitrate}=require('../recording-options');
test('原生编码器启动中停止会等待句柄并保存一次，不回退发送浏览器开始事件',async()=>{
  const {EventEmitter}=require('node:events'),{createRecording}=require('../recording');
  const handlers=new Map(),sent=[];let release,callbacks,commits=0,stops=0;
  class Window extends EventEmitter{
    constructor(){super();this.webContents=new EventEmitter();this.webContents.send=(...args)=>sent.push(args);this.webContents.setWindowOpenHandler=()=>{};}
    isDestroyed(){return !!this.dead;}async loadFile(){}setContentProtection(){}setIgnoreMouseEvents(){}setAlwaysOnTop(){}showInactive(){}isVisible(){return true;}destroy(){this.dead=true;this.emit('closed');}
  }
  const window=new Window(),screen=new EventEmitter(),powerMonitor=new EventEmitter();screen.getDisplayNearestPoint=()=>({scaleFactor:1});
  const controller=createRecording({getHostWindow:()=>window,onShow:()=>{},BrowserWindow:Window,ipcMain:{handle:(name,fn)=>handlers.set(name,fn),removeHandler:name=>handlers.delete(name)},screen,powerMonitor,screenshot:{isActive:()=>false},collection:{beginRecording:async()=>({append:async()=>{},abort:async()=>{}})},getWindows:()=>[],getSettings:()=>({recordFrameRate:60,recordFormat:'mp4'}),remember:()=>{},commit:async()=>commits++,onMessage:()=>{},onSound:()=>{},smoke:true,nativeRecorder:{available:true,start:async(_config,values)=>{callbacks=values;return new Promise(resolve=>release=resolve);}}});
  const selecting=controller.select({fps:60,format:'mp4'},{rect:{x:0,y:0,width:320,height:180},bounds:{x:0,y:0,width:1920,height:1080},sourceId:'test',test:false});
  while(!release)await new Promise(resolve=>setImmediate(resolve));
  const stopped=controller.stop();release({stop:()=>{stops++;callbacks.onFinish();},abort:async()=>{}});await selecting;await stopped;
  assert.equal(commits,1);assert.equal(stops,1);assert.ok(!sent.some(([name])=>name==='recording-start'||name==='recording-stop'));assert.equal(controller.isActive(),false);await controller.dispose();
});
test('录屏帧率/格式白名单，区域裁剪按实际视频尺寸处理 DPI 与偶数编码尺寸',()=>{
  for(const fps of [15,24,30,60])for(const format of ['mp4'])assert.deepEqual(validateOptions({fps,format,extra:1}),{fps,format});
  for(const input of [{fps:120,format:'mp4'},{fps:30,format:'avi'},{fps:30,format:'webm'},null])assert.throws(()=>validateOptions(input));
  assert.deepEqual(region({x:100,y:40,width:201,height:81},{width:1280,height:720},1920,1080),{x:150,y:60,width:300,height:120,outputWidth:300,outputHeight:120});
  assert.throws(()=>region({x:2000,y:0,width:100,height:100},{width:1280,height:720},1920,1080));
});
test('高 DPI 录屏请求原生像素；4K/60FPS 有足够码率，8K 与超宽区域不缩小',()=>{
  const constraints=captureOptions({captureSize:{width:3840,height:2160},sourceId:'screen:1',fps:60});
  assert.equal(constraints.audio,false);assert.equal(constraints.video.mandatory.minWidth,3840);assert.equal(constraints.video.mandatory.maxHeight,2160);
  const crop=region({x:101.5,y:40.5,width:801,height:451},{width:1920,height:1080},3840,2160);
  assert.equal(crop.x,203);assert.equal(crop.y,81);assert.equal(crop.width,crop.outputWidth);assert.equal(crop.height,crop.outputHeight);
  assert.ok(bitrate(1920,1080,60)>30000000);assert.equal(bitrate(3840,2160,60),100000000);
  for(const [width,height]of [[7680,4320],[5120,1440]]){
    const large=region({x:0,y:0,width,height},{width,height},width,height);
    assert.equal(large.outputWidth,width);assert.equal(large.outputHeight,height);
  }
});
test('保存目录变更只影响新副本；重启保留旧副本位置，删除副本不触及引用原文件',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'luna-storage-test-'));try{
    let directory='';const data=path.join(root,'data'),custom=path.join(root,'custom');const collection=await createCollection(data,{getDirectory:()=>directory});
    const old=await collection.addBytes('old.png',new Uint8Array([1]));const oldPath=collection.openTarget(old.id).target;
    directory=custom;const recent=await collection.addBytes('recent.png',new Uint8Array([2]));const recentPath=collection.openTarget(recent.id).target;
    assert.equal(path.dirname(recentPath),custom);assert.equal(collection.openTarget(old.id).target,oldPath);
    const restarted=await createCollection(data);assert.equal(restarted.openTarget(recent.id).target,recentPath);assert.equal(restarted.previewFile(recent.id).path,recentPath);
    const reference=await restarted.addFile(recentPath);await restarted.remove(reference.id);await fs.access(recentPath);
    await restarted.remove(recent.id);await assert.rejects(fs.access(recentPath));await fs.access(oldPath);
  }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('录屏分块顺序写入、完成后加入收藏，途中变更目录不影响会话；取消清理临时文件',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'luna-recording-test-'));try{
    let directory=path.join(root,'first');const collection=await createCollection(path.join(root,'data'),{getDirectory:()=>directory});
    const writer=await collection.beginRecording('record.mp4');await writer.append(new Uint8Array([1,2]));directory=path.join(root,'second');await writer.append(new Uint8Array([3,4]));const item=await writer.finish();
    assert.deepEqual([...await fs.readFile(collection.openTarget(item.id).target)],[1,2,3,4]);assert.equal(path.dirname(collection.openTarget(item.id).target),path.join(root,'first'));
    const cancelled=await collection.beginRecording('cancel.mp4');await cancelled.append(new Uint8Array([9]));await cancelled.abort();assert.deepEqual(await fs.readdir(directory),[]);assert.equal(collection.list().length,1);await assert.rejects(cancelled.append(new Uint8Array([1])));
    const empty=await collection.beginRecording('empty.mp4');await assert.rejects(empty.finish());await empty.abort();assert.deepEqual(await fs.readdir(directory),[]);
  }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('保存路径与录屏偏好迁移，非法相对目录与帧率不会进入设置',()=>{
  const {validate,migrateState}=require('../core');const directory=path.join(os.tmpdir(),'luna-save');
  const settings=validate({saveDirectory:directory,recordFormat:'mp4',recordFrameRate:60});assert.equal(settings.saveDirectory,directory);assert.deepEqual(migrateState({settings}).settings,settings);
  const invalid=validate({saveDirectory:'../elsewhere',recordFrameRate:0,recordFormat:'exe'});assert.equal(invalid.saveDirectory,'');assert.equal(invalid.recordFrameRate,60);assert.equal(invalid.recordFormat,'mp4');
});
test('启动过程中关闭会清理晚到的文件句柄，不发送开始消息；其他窗口不能写入录屏',async()=>{
  const {EventEmitter}=require('node:events'),{createRecording}=require('../recording');
  const handlers=new Map(),sent=[];let release,aborted=0;
  class Window extends EventEmitter{constructor(){super();this.dead=false;this.webContents=new EventEmitter();this.webContents.send=(...args)=>sent.push(args);this.webContents.setWindowOpenHandler=()=>{};}isDestroyed(){return this.dead;}async loadFile(){}setContentProtection(){}show(){}focus(){}setPosition(){}destroy(){this.dead=true;this.emit('closed');}}
  const screen=new EventEmitter(),powerMonitor=new EventEmitter();screen.getDisplayNearestPoint=()=>({workArea:{x:0,y:0,width:1920,height:1080}});
  const petWindow=new Window({});let shows=0;
  const host=createRecording({getHostWindow:()=>petWindow,onShow:()=>shows++,BrowserWindow:Window,ipcMain:{handle:(name,fn)=>handlers.set(name,fn),removeHandler:name=>handlers.delete(name)},screen,powerMonitor,screenshot:{isActive:()=>false},collection:{beginRecording:()=>new Promise(resolve=>release=resolve)},getWindows:()=>[],getSettings:()=>({recordFrameRate:30,recordFormat:'mp4'}),remember:()=>{},commit:()=>assert.fail('cancelled session must not commit'),onMessage:()=>{},onSound:()=>{},smoke:true});
  await host.show();assert.equal((await handlers.get('recording-chunk')({sender:{}},new ArrayBuffer(1))).ok,false);
  const selecting=host.select({fps:30,format:'mp4'},{rect:{x:0,y:0,width:100,height:100},bounds:{x:0,y:0,width:100,height:100},sourceId:'test'});
  const stopped=host.stop();release({abort:async()=>aborted++});await selecting;await stopped;assert.equal(aborted,1);assert.equal(host.isActive(),false);assert.equal(sent.some(([name])=>name==='recording-start'),false);
  await host.dispose();assert.equal(petWindow.isDestroyed(),false);assert.equal(shows,1);assert.equal(handlers.size,0);assert.equal(powerMonitor.listenerCount('suspend'),0);
});
test('录屏边框以单个透明窗口闭合覆盖负坐标屏幕、穿透鼠标，并在保存及错误后销毁',async()=>{
  const {EventEmitter}=require('node:events'),{createRecording}=require('../recording');
  for(const mode of ['saved','error','close']){
    const fail=mode==='error';
    const handlers=new Map();
    class Window extends EventEmitter{
      constructor(options){super();this.options=options;this.webContents=new EventEmitter();this.webContents.send=()=>{};this.webContents.setWindowOpenHandler=()=>{};}
      isDestroyed(){return !!this.dead;}async loadFile(){}setContentProtection(value){this.protected=value;}setIgnoreMouseEvents(value){this.ignore=value;}setAlwaysOnTop(){}show(){this.visible=true;}showInactive(){this.visible=true;}focus(){}setPosition(){}close(){let prevented=false;this.emit('close',{preventDefault:()=>prevented=true});if(!prevented)this.destroy();}destroy(){this.dead=true;this.emit('closed');}
    }
    const screen=new EventEmitter(),powerMonitor=new EventEmitter();screen.getDisplayNearestPoint=()=>({workArea:{x:-1920,y:0,width:1920,height:1080}});
    let aborted=0,committed=0;
    const petWindow=new Window({});
    const host=createRecording({getHostWindow:()=>petWindow,onShow:()=>{},BrowserWindow:Window,ipcMain:{handle:(n,f)=>handlers.set(n,f),removeHandler:n=>handlers.delete(n)},screen,powerMonitor,screenshot:{isActive:()=>false},collection:{beginRecording:async()=>({abort:async()=>aborted++})},getWindows:()=>[],getSettings:()=>({recordFrameRate:60,recordFormat:'mp4'}),remember:()=>{},commit:async()=>committed++,onMessage:()=>{},onSound:()=>{},smoke:true});
    await host.show();await host.select({fps:60,format:'mp4'},{rect:{x:0,y:0,width:1920,height:1080},bounds:{x:-1920,y:0,width:1920,height:1080},sourceId:'test'});
    const borders=host.getBorders();assert.equal(borders.length,1);
    assert.deepEqual(borders.map(b=>({x:b.options.x,y:b.options.y,width:b.options.width,height:b.options.height})),[{x:-1920,y:0,width:1920,height:1080}]);
    for(const border of borders){assert.equal(border.ignore,true);assert.equal(border.protected,true);assert.equal(border.options.focusable,true);assert.equal(border.visible,true);}
    const sender=host.getWindow().webContents;await handlers.get('recording-started')({sender});
    if(mode==='close'){petWindow.close();assert.equal(petWindow.isDestroyed(),false);assert.equal(host.isActive(),true);}
    await handlers.get(fail?'recording-error':'recording-finish')({sender},'test failure');
    assert.equal(host.getBorders().length,0);assert.ok(borders.every(b=>b.isDestroyed()));assert.equal(host.isActive(),false);assert.equal(committed,fail?0:1);assert.equal(aborted,fail?1:0);assert.equal(petWindow.protected,false);await new Promise(resolve=>setImmediate(resolve));await host.dispose();assert.equal(petWindow.isDestroyed(),mode==='close');
  }
});
