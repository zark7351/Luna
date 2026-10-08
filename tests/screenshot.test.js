const test=require('node:test'),assert=require('node:assert/strict');
const {cropBounds}=require('../screenshot');
test('截图按返回图像尺寸转换，支持非整数 DPI 与负坐标屏幕',()=>{
  assert.deepEqual(cropBounds({x:100,y:40,width:200,height:80},{x:-1280,y:0,width:1280,height:720},{width:1920,height:1080}),{x:150,y:60,width:300,height:120});
});
test('取消捕获中会话后，晚到的屏幕结果不会创建窗口；恢复仅限存活窗口',async()=>{
  const {EventEmitter}=require('node:events');
  const {createScreenshot}=require('../screenshot');
  const handlers=new Map(),screen=new EventEmitter();
  screen.getAllDisplays=()=>[{id:1,size:{width:100,height:100},bounds:{x:0,y:0,width:100,height:100},scaleFactor:1}];
  let resolveSources,shown=0,created=0;
  const sourceReady=new Promise(resolve=>{resolveSources=resolve;});
  const controller=createScreenshot({BrowserWindow:class{constructor(){created++;}},ipcMain:{handle:(name,fn)=>handlers.set(name,fn),removeHandler:name=>handlers.delete(name)},screen,getSources:()=>sourceReady,getWindows:()=>[{isDestroyed:()=>false,isVisible:()=>true,hide:()=>{},showInactive:()=>shown++}],save:()=>assert.fail('cancelled capture must not save'),onMessage:()=>{}});
  const pending=controller.start();
  assert.equal(await controller.start(),false);
  assert.equal(handlers.get('screenshot-state')({sender:{}}),null);
  handlers.get('screenshot-cancel')({sender:{}}); // An unrelated sender cannot cancel.
  await new Promise(resolve=>setTimeout(resolve,180));
  controller.stop();resolveSources([]);
  assert.equal(await pending,false);assert.equal(created,0);assert.equal(shown,1);
  assert.equal(handlers.size,0);assert.equal(screen.listenerCount('display-removed'),0);
});
test('越界截图裁到屏幕边界，非法或过小区域不保存',()=>{
  assert.deepEqual(cropBounds({x:-10,y:90,width:40,height:30},{width:100,height:100},{width:200,height:200}),{x:0,y:180,width:60,height:20});
  for(const rect of [null,{x:NaN,y:0,width:10,height:10},{x:0,y:0,width:1,height:20},{x:200,y:0,width:20,height:20}])assert.throws(()=>cropBounds(rect,{width:100,height:100},{width:100,height:100}));
});
test('工作区变化不打断框选，录屏选择只交付区域和屏幕源，真正分辨率变化会取消',async()=>{
  const {EventEmitter}=require('node:events'),{createScreenshot}=require('../screenshot');const handlers=new Map(),windows=[];
  class Window extends EventEmitter{constructor(options){super();this.options=options;this.dead=false;this.webContents=new EventEmitter();this.webContents.setWindowOpenHandler=()=>{};windows.push(this);}isDestroyed(){return this.dead;}destroy(){this.dead=true;this.emit('closed');}setAlwaysOnTop(){}async loadFile(){}showInactive(){}focus(){}}
  const screen=new EventEmitter(),display={id:1,size:{width:100,height:100},bounds:{x:-100,y:0,width:100,height:100},scaleFactor:1};screen.getAllDisplays=()=>[display];screen.getCursorScreenPoint=()=>({x:-50,y:50});screen.getDisplayNearestPoint=()=>display;
  const thumbnail={isEmpty:()=>false,getSize:()=>({width:200,height:200}),toDataURL:()=>''};let selected,cancelled=0;
  const controller=createScreenshot({BrowserWindow:Window,ipcMain:{handle:(name,fn)=>handlers.set(name,fn),removeHandler:name=>handlers.delete(name)},screen,getSources:async()=>[{id:'screen:1',display_id:'1',thumbnail}],getWindows:()=>[],save:()=>assert.fail('recording selection must not save PNG'),onMessage:()=>{}});
  await controller.start({onSelect:value=>selected=value,onCancel:()=>cancelled++});screen.emit('display-metrics-changed',{},display,['workArea']);assert.equal(controller.isActive(),true);
  assert.equal(windows[0].options.transparent,true);assert.equal(windows[0].options.fullscreen,false);
  const selectionState=handlers.get('screenshot-state')({sender:windows[0].webContents});assert.equal(selectionState.live,true);assert.equal(selectionState.image,null);
  assert.equal((await handlers.get('screenshot-select')({sender:windows[0].webContents},{x:10,y:20,width:30,height:40})).ok,true);assert.equal(selected.sourceId,'screen:1');assert.equal(selected.bounds.x,-100);assert.equal(cancelled,0);assert.equal(controller.isActive(),false);
  await controller.start({onSelect:()=>{},onCancel:()=>cancelled++});screen.emit('display-metrics-changed',{},display,['scaleFactor']);assert.equal(controller.isActive(),false);assert.equal(cancelled,1);controller.stop();
});
