const { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage, safeStorage } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const reportFatal = error => { fs.writeFileSync(path.join(app.getPath('temp'),'lunapet-startup-error.log'),String(error.stack || error)); app.exit(1); };
process.on('uncaughtException', reportFatal);
process.on('unhandledRejection', reportFatal);
const {defaults,validate,offline} = require('./core');
const {askWithSystemNetwork} = require('./network');
const smoke = process.argv.includes('--smoke-test');
if (smoke) app.setPath('userData', path.join(app.getPath('temp'), 'lunapet-smoke-' + process.pid));
let win, tray, state, stateFile, busy=false, drag=null;
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
function persist() {
  fs.mkdirSync(path.dirname(stateFile),{recursive:true});
  fs.writeFileSync(stateFile+'.tmp',JSON.stringify(state,null,2),'utf8');
  fs.renameSync(stateFile+'.tmp',stateFile);
}
function publicState() { return { settings:state.settings, history:state.history, hasKey:!!state.key }; }
function safePosition(x,y) {
  const a=screen.getDisplayNearestPoint({x:Math.round(x+310),y:Math.round(y+275)}).workArea;
  return [Math.round(clamp(x,a.x,a.x+Math.max(0,a.width-620))),Math.round(clamp(y,a.y,a.y+Math.max(0,a.height-550)))];
}
function liveWindow() { return win && !win.isDestroyed(); }
function restore() {if(!liveWindow())return;win.setIgnoreMouseEvents(false);win.show();win.focus();}
if (!app.requestSingleInstanceLock() && !smoke) app.quit();
else {
app.on('second-instance',()=>{if(win)restore();});
app.whenReady().then(async()=>{
  stateFile=path.join(app.getPath('userData'),'state.json');
  state={settings:{...defaults},history:[],key:''};
  try { const saved=JSON.parse(fs.readFileSync(stateFile,'utf8'));state.settings=validate(saved.settings||{});state.key=typeof saved.key==='string'?saved.key:'';state.history=Array.isArray(saved.history)?saved.history.filter(x=>['user','assistant'].includes(x.role)&&typeof x.content==='string').slice(-100):[];state.position=saved.position;}catch{}
  const area=screen.getPrimaryDisplay().workArea;
  const p=state.position || [area.x+area.width-650,area.y+area.height-570];
  const [x,y]=safePosition(Number(p[0])||0,Number(p[1])||0);
  win=new BrowserWindow({width:620,height:550,x,y,transparent:true,frame:false,resizable:false,hasShadow:false,alwaysOnTop:state.settings.top,show:false,skipTaskbar:false,backgroundColor:'#00000000',webPreferences:{preload:path.join(__dirname,'preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  win.webContents.on('will-navigate',e=>e.preventDefault());
  win.webContents.session.setPermissionRequestHandler((_wc,_p,cb)=>cb(false));
  win.once('ready-to-show',()=>win.show());
  win.on('moved',()=>{state.position=win.getPosition();});
  screen.on('display-removed',()=>{if(liveWindow())win.setPosition(...safePosition(...win.getPosition()));});
  // Tray artwork is derived from a small in-memory RGBA buffer, independent of character assets.
  const b=Buffer.alloc(32*32*4);for(let yy=0;yy<32;yy++)for(let xx=0;xx<32;xx++){const i=(yy*32+xx)*4;const inside=(xx-16)**2+(yy-16)**2<210;b[i]=170;b[i+1]=132;b[i+2]=232;b[i+3]=inside?255:0;}
  tray=new Tray(nativeImage.createFromBitmap(b,{width:32,height:32}));
  tray.setToolTip('露娜 · 桌面伙伴');tray.setContextMenu(Menu.buildFromTemplate([{label:'显示宠物',click:restore},{label:'隐藏宠物',click:()=>win.hide()},{type:'separator'},{label:'退出',click:()=>app.quit()}]));tray.on('double-click',restore);
  const handle=(name,fn)=>ipcMain.handle(name,async(e,...args)=>{if(!liveWindow() || e.sender!==win.webContents)return {ok:false,error:'窗口已关闭'};try{return {ok:true,value:await fn(...args)};}catch(err){return {ok:false,error:err.message || '操作失败'};}});
  handle('state',()=>publicState());
  handle('settings',input=>{
    if(busy)throw Error('请等待本次回复完成再保存。');
    const next=validate(input); let key=state.key;
    if(input.clearKey || next.baseUrl!==state.settings.baseUrl)key='';
    if(typeof input.apiKey==='string' && input.apiKey.trim()){
      if(input.apiKey.length>4096)throw Error('密钥长度异常。');
      if(!safeStorage.isEncryptionAvailable())throw Error('系统加密暂不可用，未保存密钥。');
      key=safeStorage.encryptString(input.apiKey.trim()).toString('base64');
    }
    const previous=state;state={...state,settings:next,key};try{persist();}catch(e){state=previous;throw e;}
    win.setAlwaysOnTop(next.top);return publicState();
  });
  handle('chat',async raw=>{
    if(busy)throw Error('正在回复，请稍等。');
    const text=String(raw||'').trim();if(!text || text.length>3000)throw Error('请输入 1–3000 字。');
    busy=true;
    try{
      let key='';if(state.settings.online && state.key){try{key=safeStorage.decryptString(Buffer.from(state.key,'base64'));}catch{throw Error('密钥无法解密，请在设置中重新填写。');}}
      let answer;
      try{answer=state.settings.online?await askWithSystemNetwork(state.settings,key,state.history,text):offline(text,state.settings);}catch(e){if(e.name==='TimeoutError'||e.name==='AbortError')throw Error('连接超时，请稍后重试。');if(e instanceof TypeError)throw Error('响应读取失败，请检查网络后重试。');throw e;}
      const online=state.settings.online;
      state.history.push({role:'user',content:text,online},{role:'assistant',content:answer,online});state.history=state.history.slice(-100);persist();return {answer,online};
    }finally{busy=false;}
  });
  handle('clear',()=>{if(busy)throw Error('请等待回复完成。');state.history=[];persist();return true;});
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
      const result=await win.webContents.executeJavaScript(`(async()=>{const s=await window.pet.call('state');if(!s.ok)throw Error('state');document.querySelector('#message').value='你好';document.querySelector('#chat-form').requestSubmit();await new Promise(r=>setTimeout(r,600));if(!document.querySelector('#messages').textContent.includes('你好，我是'))throw Error('chat');document.querySelector('#settings-button').click();await new Promise(r=>setTimeout(r,200));if(document.querySelector('#settings').hidden)throw Error('settings');document.querySelector('#settings-close').click();document.querySelector('#pet').click();if(!document.querySelector('#pet').classList.contains('happy'))throw Error('expression');return {chat:true,settings:true,expression:true,bridge:true};})()`);
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
