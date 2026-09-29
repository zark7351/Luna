const { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const reportFatal = error => { fs.writeFileSync(path.join(app.getPath('temp'),'lunapet-startup-error.log'),String(error.stack || error)); app.exit(1); };
process.on('uncaughtException', reportFatal);
process.on('unhandledRejection', reportFatal);
const {defaults,validate,migrateState,WINDOW_WIDTH,WINDOW_HEIGHT} = require('./core');
const smoke = process.argv.includes('--smoke-test');
if (smoke) app.setPath('userData', path.join(app.getPath('temp'), 'lunapet-smoke-' + process.pid));
let win, tray, state, stateFile, drag=null;
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
function persist() {
  fs.mkdirSync(path.dirname(stateFile),{recursive:true});
  fs.writeFileSync(stateFile+'.tmp',JSON.stringify(state,null,2),'utf8');
  fs.renameSync(stateFile+'.tmp',stateFile);
}
function publicState() { return { settings:state.settings }; }
function safePosition(x,y) {
  const a=screen.getDisplayNearestPoint({x:Math.round(x+WINDOW_WIDTH/2),y:Math.round(y+WINDOW_HEIGHT/2)}).workArea;
  return [Math.round(clamp(x,a.x,a.x+Math.max(0,a.width-WINDOW_WIDTH))),Math.round(clamp(y,a.y,a.y+Math.max(0,a.height-WINDOW_HEIGHT)))];
}
function liveWindow() { return win && !win.isDestroyed(); }
function restore() {if(!liveWindow())return;win.setIgnoreMouseEvents(false);win.show();win.focus();}
if (!app.requestSingleInstanceLock() && !smoke) app.quit();
else {
app.on('second-instance',()=>{if(win)restore();});
app.whenReady().then(async()=>{
  stateFile=path.join(app.getPath('userData'),'state.json');
  if(smoke){fs.mkdirSync(path.dirname(stateFile),{recursive:true});fs.writeFileSync(stateFile,JSON.stringify({settings:{name:'露娜',nickname:'',top:true,online:true,baseUrl:'https://example.test/v1',model:'old-model'},key:'fake-encrypted-key',history:[{role:'assistant',content:'旧版测试回复',online:true}],position:[100,100]}),'utf8');}
  state={settings:{...defaults},layoutVersion:2};
  try { state=migrateState(JSON.parse(fs.readFileSync(stateFile,'utf8')));persist(); } catch {}
  const area=screen.getPrimaryDisplay().workArea;
  const p=state.position || [area.x+area.width-WINDOW_WIDTH-30,area.y+area.height-WINDOW_HEIGHT-20];
  const [x,y]=safePosition(Number(p[0])||0,Number(p[1])||0);
  win=new BrowserWindow({width:WINDOW_WIDTH,height:WINDOW_HEIGHT,x,y,transparent:true,frame:false,resizable:false,hasShadow:false,alwaysOnTop:state.settings.top,show:false,skipTaskbar:false,backgroundColor:'#00000000',webPreferences:{preload:path.join(__dirname,'preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  win.webContents.on('will-navigate',e=>e.preventDefault());
  win.webContents.session.setPermissionRequestHandler((_wc,_p,cb)=>cb(false));
  win.once('ready-to-show',()=>win.show());
  win.on('moved',()=>{state.position=win.getPosition();});
  screen.on('display-removed',()=>{if(liveWindow())win.setPosition(...safePosition(...win.getPosition()));});
  // Tray artwork is derived from a small in-memory RGBA buffer, independent of character assets.
  const b=Buffer.alloc(32*32*4);for(let yy=0;yy<32;yy++)for(let xx=0;xx<32;xx++){const i=(yy*32+xx)*4;const inside=(xx-16)**2+(yy-16)**2<210;b[i]=170;b[i+1]=132;b[i+2]=232;b[i+3]=inside?255:0;}
  tray=new Tray(nativeImage.createFromBitmap(b,{width:32,height:32}));
  tray.setToolTip('露娜 · 桌面伙伴');tray.setContextMenu(Menu.buildFromTemplate([{label:'显示宠物',click:restore},{label:'隐藏宠物',click:()=>{if(liveWindow())win.hide();}},{type:'separator'},{label:'退出',click:()=>app.quit()}]));tray.on('double-click',restore);
  const handle=(name,fn)=>ipcMain.handle(name,async(e,...args)=>{if(!liveWindow() || e.sender!==win.webContents)return {ok:false,error:'窗口已关闭'};try{return {ok:true,value:await fn(...args)};}catch(err){return {ok:false,error:err.message || '操作失败'};}});
  handle('state',()=>publicState());
  handle('settings',input=>{
    const next=validate(input);
    const previous=state;state={...state,settings:next};try{persist();}catch(e){state=previous;throw e;}
    win.setAlwaysOnTop(next.top);return publicState();
  });
  handle('hide',()=>win.hide());handle('quit',()=>app.quit());
  ipcMain.on('passthrough',(e,value)=>{if(liveWindow() && e.sender===win.webContents && !drag)win.setIgnoreMouseEvents(value===true,{forward:true});});
  ipcMain.on('drag',(e,start)=>{
    if(!liveWindow() || e.sender!==win.webContents)return;
    if(start){drag={cursor:screen.getCursorScreenPoint(),pos:win.getPosition()};win.setIgnoreMouseEvents(false);}
    else{drag=null;state.position=win.getPosition();persist();}
  });
  const timer=setInterval(()=>{if(drag && !win.isDestroyed()){const c=screen.getCursorScreenPoint();win.setPosition(...safePosition(drag.pos[0]+c.x-drag.cursor.x,drag.pos[1]+c.y-drag.cursor.y));}},16);
  win.on('closed',()=>{drag=null;clearInterval(timer);});
  await win.loadFile('index.html');
  if(smoke){
    try{
      await new Promise(r=>setTimeout(r,1200));
      const result=await win.webContents.executeJavaScript(`(async()=>{const s=await window.pet.call('state');if(!s.ok||'history' in s.value||document.querySelector('#chat-form'))throw Error('chat remains');document.querySelector('#settings-button').click();await new Promise(r=>setTimeout(r,200));if(document.querySelector('#settings').hidden)throw Error('settings');document.querySelector('#settings-close').click();document.querySelector('#pet').click();if(!document.querySelector('#pet').classList.contains('happy'))throw Error('expression');return {settings:true,expression:true,bridge:true,noChat:true};})()`);
      const migrated=JSON.parse(fs.readFileSync(stateFile,'utf8'));
      if(Object.hasOwn(migrated,'key') || Object.hasOwn(migrated,'history') || Object.hasOwn(migrated.settings,'online') || migrated.layoutVersion!==2)throw Error('legacy storage migration');
      result.legacyStorage=true;
      if(win.getSize()[0]!==WINDOW_WIDTH)throw Error('window width');
      await new Promise(r=>setTimeout(r,250));
      const shot=await win.webContents.capturePage();fs.writeFileSync(path.join(__dirname,'preview.png'),shot.toPNG());
      const oldSender=win.webContents;
      win.destroy();
      ipcMain.emit('passthrough',{sender:oldSender},true);
      ipcMain.emit('drag',{sender:oldSender},false);
      result.lateEventsAfterWindowDestroyed=true;
      fs.writeFileSync(path.join(__dirname,'smoke-result.json'),JSON.stringify(result));console.log(JSON.stringify(result));app.exit(0);
    }catch(e){console.error(e);app.exit(1);}
  }
});
app.on('before-quit',()=>{if(stateFile && state)persist();});
app.on('window-all-closed',()=>app.quit());
}
