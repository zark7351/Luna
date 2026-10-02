const { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage, shell, clipboard, dialog, protocol, net, powerMonitor, desktopCapturer, globalShortcut } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const {pathToFileURL}=require('node:url');
const reportFatal = error => { fs.writeFileSync(path.join(app.getPath('temp'),'lunapet-startup-error.log'),String(error.stack || error)); app.exit(1); };
process.on('uncaughtException', reportFatal);
process.on('unhandledRejection', reportFatal);
const {defaults,validate,migrateState,WINDOW_WIDTH,WINDOW_HEIGHT} = require('./core');
const {createCollection} = require('./collection');
const {mediaResponse}=require('./media');
const {copyFileToClipboard,requireFile}=require('./file-actions');
const {fetchLinkPreview}=require('./link-preview');
const {createWeather}=require('./weather');
const {startIdleMonitor}=require('./idle');
const {createScreenshot}=require('./screenshot');
const {createReminders}=require('./reminders');
protocol.registerSchemesAsPrivileged([{scheme:'luna-media',privileges:{standard:true,secure:true,stream:true}}]);
const smoke = process.argv.includes('--smoke-test');
if (smoke) app.setPath('userData', path.join(app.getPath('temp'), 'lunapet-smoke-' + process.pid));
let win, libraryWin, tray, state, stateFile, collection, weather, idle, screenshot, reminders, reminderWin, reminderTimer, reminderAlertTimer, reminderTopTimer, drag=null;
const reminderPauses=new Set();
let reminderSoundPending=false;
function configureAudio(current){current.webContents.setAudioMuted(!state.settings.soundEnabled);}
function playSound(name){if(!quitting && state.settings.soundEnabled && liveWindow())win.webContents.send('sound-play',name);}
let smokeIdleSeconds=0;let smokeReminderNow=Date.now(),quitting=false,quitSettled=false;
let trayMenu;
function openPetPanel(name){if(quitting || !liveWindow())return;restore();win.webContents.send('panel-open',name);}
let collectionOp=Promise.resolve();
let previewOp=Promise.resolve();const previewPending=new Map();
function queuePreview(id,force=false){
  if(previewPending.has(id))return previewPending.get(id);
  const task=previewOp.then(async()=>{
    const item=collection.list().find(entry=>entry.id===id);if(!item||item.kind!=='link'||(!force&&item.linkPreview))return;
    let preview;
    try{preview=await fetchLinkPreview(item.content,{fetch:net.fetch.bind(net),thumbnail:bytes=>{
      const image=nativeImage.createFromBuffer(bytes);if(image.isEmpty())return '';const {width,height}=image.getSize();const scale=Math.min(1,360/width,240/height);
      return 'data:image/jpeg;base64,'+image.resize({width:Math.max(1,Math.round(width*scale)),height:Math.max(1,Math.round(height*scale))}).toJPEG(80).toString('base64');
    }});}catch{preview={status:'failed',description:'暂时无法获取网页预览，可点击链接打开。',fetchedAt:new Date().toISOString()};}
    await mutateCollection(()=>collection.setLinkPreview(id,preview));notifyCollection();
  });
  previewOp=task.catch(()=>{});previewPending.set(id,task);task.finally(()=>previewPending.delete(id)).catch(()=>{});return task;
}
function mutateCollection(task){const pending=collectionOp.then(task);collectionOp=pending.catch(()=>{});return pending;}
function notifyCollection(){if(libraryWin && !libraryWin.isDestroyed())libraryWin.webContents.send('collection-updated');}
function addFiles(paths){return mutateCollection(async()=>{
  if(!Array.isArray(paths) || !paths.length || paths.length>10)throw Error('每次最多收藏 10 个本机文件。');
  let saved=0;const failed=[];
  for(const file of paths){try{await collection.addFile(file);saved++;}catch(error){failed.push(error.message || '文件收藏失败');}}
  if(saved)notifyCollection();
  return {saved,failed};
});}
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
function persist() {
  fs.mkdirSync(path.dirname(stateFile),{recursive:true});
  fs.writeFileSync(stateFile+'.tmp',JSON.stringify(state,null,2),'utf8');
  fs.renameSync(stateFile+'.tmp',stateFile);
}
function publicState() { return { settings:state.settings,sleeping:idle?.isSleeping()||false }; }
function safePosition(x,y) {
  const a=screen.getDisplayNearestPoint({x:Math.round(x+WINDOW_WIDTH/2),y:Math.round(y+WINDOW_HEIGHT/2)}).workArea;
  return [Math.round(clamp(x,a.x,a.x+Math.max(0,a.width-WINDOW_WIDTH))),Math.round(clamp(y,a.y,a.y+Math.max(0,a.height-WINDOW_HEIGHT)))];
}
function liveWindow() { return win && !win.isDestroyed(); }
function allowFullscreen(contents,permission){return permission==='fullscreen' && !!libraryWin && !libraryWin.isDestroyed() && contents===libraryWin.webContents && contents.getURL()===pathToFileURL(path.join(__dirname,'library.html')).href;}
function restore() {if(!liveWindow())return;win.setIgnoreMouseEvents(false);win.show();win.focus();}
async function showLibrary(){
  if(libraryWin && !libraryWin.isDestroyed()){libraryWin.show();libraryWin.focus();return;}
  libraryWin=new BrowserWindow({width:900,height:640,minWidth:560,minHeight:400,title:'露娜收藏夹',backgroundColor:'#fcf9ff',show:false,webPreferences:{preload:path.join(__dirname,'preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  configureAudio(libraryWin);
  const current=libraryWin;
  current.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  current.webContents.on('will-navigate',e=>e.preventDefault());
  current.once('ready-to-show',()=>{if(!current.isDestroyed())current.show();});
  current.on('closed',()=>{if(libraryWin===current)libraryWin=null;});
  await current.loadFile('library.html');
  if(!smoke)for(const item of collection.list())if(item.kind==='link'&&!item.linkPreview)queuePreview(item.id).catch(()=>{});
}
function notifyReminders(){
  if(quitting)return;
  if(reminderWin && !reminderWin.isDestroyed())reminderWin.webContents.send('reminders-updated');
  if(liveWindow())win.webContents.send('reminder-count',reminders.list().filter(item=>item.status!=='done').length);
}
async function showReminders(alert=false){
  if(quitting)return;
  if(!reminderWin || reminderWin.isDestroyed()){
    reminderWin=new BrowserWindow({width:520,height:640,minWidth:420,minHeight:460,title:'露娜提醒',backgroundColor:'#f8f4fc',show:false,webPreferences:{preload:path.join(__dirname,'reminder-preload.js'),contextIsolation:true,sandbox:true,nodeIntegration:false}});
    configureAudio(reminderWin);
    const current=reminderWin;
    current.webContents.setWindowOpenHandler(()=>({action:'deny'}));current.webContents.on('will-navigate',event=>event.preventDefault());
    current.on('closed',()=>{if(reminderWin===current)reminderWin=null;clearTimeout(reminderTopTimer);});
    await current.loadFile('reminder.html');
    if(current.isDestroyed() || quitting)return;
  }
  const current=reminderWin;if(!current || current.isDestroyed())return;
  if(current.isMinimized())current.restore();
  if(alert){current.setAlwaysOnTop(true);current.showInactive();current.flashFrame(true);clearTimeout(reminderTopTimer);reminderTopTimer=setTimeout(()=>{if(!current.isDestroyed())current.setAlwaysOnTop(false);},8000);}
  else{current.show();current.focus();current.flashFrame(false);}
}
function presentReminders(){
  if(quitting || reminderPauses.size)return;
  clearTimeout(reminderAlertTimer);
  if(screenshot?.isActive()){reminderAlertTimer=setTimeout(presentReminders,500);return;}
  if(!reminders.list().some(item=>item.status==='fired')){reminderSoundPending=false;return;}
  if(reminderSoundPending){reminderSoundPending=false;playSound('reminder');}
  showReminders(true).catch(()=>{if(liveWindow())win.webContents.send('reminder-due','有提醒到时间了，请点击铃铛查看。');});
}
if (!app.requestSingleInstanceLock() && !smoke) app.quit();
else {
app.on('second-instance',()=>{if(win)restore();});
app.whenReady().then(async()=>{
  stateFile=path.join(app.getPath('userData'),'state.json');
  if(smoke){fs.mkdirSync(path.dirname(stateFile),{recursive:true});fs.writeFileSync(stateFile,JSON.stringify({settings:{name:'露娜',nickname:'',top:true,online:true,baseUrl:'https://example.test/v1',model:'old-model'},key:'fake-encrypted-key',history:[{role:'assistant',content:'旧版测试回复',online:true}],position:[100,100]}),'utf8');}
  state={settings:{...defaults},layoutVersion:3};
  try { state=migrateState(JSON.parse(fs.readFileSync(stateFile,'utf8')));persist(); } catch {}
  collection=await createCollection(app.getPath('userData'));
  reminders=await createReminders(app.getPath('userData'),{now:smoke?()=>smokeReminderNow:Date.now,onChange:notifyReminders,onDue:due=>{reminderSoundPending=true;if(liveWindow())win.webContents.send('reminder-due',due.length===1?'到时间啦：'+due[0].title:due.length+' 条提醒到时间啦。');presentReminders();}});
  weather=createWeather({directory:app.getPath('userData'),fetch:smoke?async url=>{
    const host=new URL(url).hostname;
    return new Response(JSON.stringify(host==='ipwho.is'?{success:true,city:'杭州',region:'浙江',country:'中国',latitude:30.27,longitude:120.15}:host==='geocoding-api.open-meteo.com'?{results:[{name:'杭州',admin1:'浙江',country:'中国',latitude:30.27,longitude:120.15}]}:{current:{temperature_2m:22,weather_code:2,is_day:1}}));
  }:net.fetch.bind(net)});
  protocol.handle('luna-media',request=>mediaResponse(request,collection));
  const area=screen.getPrimaryDisplay().workArea;
  const p=state.position || [area.x+area.width-WINDOW_WIDTH-30,area.y+area.height-WINDOW_HEIGHT-20];
  const [x,y]=safePosition(Number(p[0])||0,Number(p[1])||0);
  win=new BrowserWindow({width:WINDOW_WIDTH,height:WINDOW_HEIGHT,x,y,transparent:true,frame:false,resizable:false,hasShadow:false,alwaysOnTop:state.settings.top,show:false,skipTaskbar:false,backgroundColor:'#00000000',webPreferences:{preload:path.join(__dirname,'preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:true,autoplayPolicy:'no-user-gesture-required'}});
  configureAudio(win);
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  win.webContents.on('will-navigate',e=>e.preventDefault());
  win.webContents.session.setPermissionRequestHandler((contents,permission,cb,details)=>cb(details.isMainFrame!==false && allowFullscreen(contents,permission)));
  win.webContents.session.setPermissionCheckHandler((contents,permission)=>allowFullscreen(contents,permission));
  win.once('ready-to-show',()=>{if(liveWindow())win.show();});
  win.on('moved',()=>{if(liveWindow())state.position=win.getPosition();});
  screen.on('display-removed',()=>{if(liveWindow())win.setPosition(...safePosition(...win.getPosition()));});
  // Tray artwork is derived from a small in-memory RGBA buffer, independent of character assets.
  const b=Buffer.alloc(32*32*4);for(let yy=0;yy<32;yy++)for(let xx=0;xx<32;xx++){const i=(yy*32+xx)*4;const inside=(xx-16)**2+(yy-16)**2<210;b[i]=170;b[i+1]=132;b[i+2]=232;b[i+3]=inside?255:0;}
  tray=new Tray(nativeImage.createFromBitmap(b,{width:32,height:32}));
  tray.setToolTip('露娜 · 桌面伙伴');trayMenu=Menu.buildFromTemplate([{id:'settings',label:'设置',click:()=>openPetPanel('settings')},{id:'help',label:'使用说明',click:()=>openPetPanel('help')},{type:'separator'},{label:'提醒',click:()=>showReminders().catch(()=>{})},{label:'截图收藏（Ctrl+Alt+A）',click:()=>screenshot?.start()},{type:'separator'},{label:'显示宠物',click:restore},{label:'隐藏宠物',click:()=>{if(liveWindow())win.hide();}},{type:'separator'},{label:'退出',click:()=>app.quit()}]);tray.setContextMenu(trayMenu);tray.on('double-click',restore);
  const handle=(name,fn,allowLibrary=false,allowReminders=false)=>ipcMain.handle(name,async(e,...args)=>{const petSender=liveWindow() && e.sender===win.webContents;const librarySender=allowLibrary && libraryWin && !libraryWin.isDestroyed() && e.sender===libraryWin.webContents;const reminderSender=allowReminders && reminderWin && !reminderWin.isDestroyed() && e.sender===reminderWin.webContents;if(quitting || (!petSender && !librarySender && !reminderSender))return {ok:false,error:'窗口已关闭'};try{return {ok:true,value:await fn(...args)};}catch(err){return {ok:false,error:err.message || '操作失败'};}});
  const captureMessage=(message,saved)=>{for(const window of [win,libraryWin])if(window && !window.isDestroyed())window.webContents.send('screenshot-message',{message,saved});};
  screenshot=createScreenshot({BrowserWindow,ipcMain,screen,getWindows:()=>[win,libraryWin,reminderWin],getSources:smoke?async()=>screen.getAllDisplays().map(display=>({display_id:String(display.id),thumbnail:nativeImage.createFromPath(path.join(__dirname,'assets','character.png')).resize({width:display.bounds.width*2,height:display.bounds.height*2})})):desktopCapturer.getSources.bind(desktopCapturer),save:png=>mutateCollection(async()=>{await collection.addBytes('截图-'+new Date().toISOString().replace(/[:.]/g,'-')+'.png',png);notifyCollection();}),onMessage:captureMessage});
  handle('screenshot-start',()=>screenshot.start(),true);
  let captureShortcut=false;
  const shortcutStatus=()=>({enabled:state.settings.screenshotShortcut,available:captureShortcut});
  function syncCaptureShortcut(){
    if(!state.settings.screenshotShortcut){if(captureShortcut)globalShortcut.unregister('CommandOrControl+Alt+A');captureShortcut=false;}
    else if(!captureShortcut && !smoke){try{captureShortcut=globalShortcut.register('CommandOrControl+Alt+A',()=>{if(state.settings.screenshotShortcut)screenshot.start().catch(()=>captureMessage('截图启动失败。',false));});}catch{captureShortcut=false;}}
    for(const window of [win,libraryWin])if(window && !window.isDestroyed())window.webContents.send('screenshot-shortcut-changed',shortcutStatus());
  }
  syncCaptureShortcut();
  handle('screenshot-shortcut',shortcutStatus,true);
  handle('reminder-show',()=>showReminders());
  handle('reminder-list',()=>reminders.list(),false,true);
  handle('reminder-save',input=>reminders.save(input),false,true);
  handle('reminder-action',input=>reminders.action(input),false,true);
  handle('state',()=>publicState());
  handle('weather-current',()=>weather.current(state.settings.weatherLocation));
  handle('weather-search',query=>weather.search(query));
  handle('weather-locate',()=>weather.locate());
  handle('weather-provider',provider=>{
    const urls={weather:'https://open-meteo.com/',cities:'https://www.geonames.org/',location:'https://ipwhois.io/'};
    if(!Object.hasOwn(urls,provider))throw Error('未知天气来源。');
    return shell.openExternal(urls[provider]);
  });
  handle('settings',input=>{
    const next=validate(input);
    const previous=state;state={...state,settings:next};try{persist();}catch(e){state=previous;throw e;}
    if(liveWindow())win.setAlwaysOnTop(next.top);for(const current of [win,libraryWin,reminderWin])if(current && !current.isDestroyed())configureAudio(current);syncCaptureShortcut();return publicState();
  });
  handle('hide',()=>win.hide());handle('quit',()=>app.quit());
  handle('library-show',showLibrary);
  handle('collection-list',()=>collection.list(),true);
  const addText=content=>mutateCollection(async()=>{const item=await collection.addText(content);notifyCollection();if(item.kind==='link'&&!smoke)queuePreview(item.id).catch(()=>{});return item;});
  handle('collection-add-text',addText,true);
  handle('collection-add-clipboard',()=>addText(clipboard.readText()),true);
  handle('collection-link-preview',async id=>{const item=collection.openTarget(id);if(item.kind!=='link')throw Error('不是网页链接。');await queuePreview(id,true);return true;},true);
  handle('collection-add-files',addFiles,true);
  handle('collection-add-drop',entries=>mutateCollection(async()=>{
    if(!Array.isArray(entries) || !entries.length || entries.length>10)throw Error('每次最多收藏 10 个文件。');
    let saved=0;const failed=[];
    for(const entry of entries){try{
      if(!entry || typeof entry!=='object')throw Error('拖入文件无效。');
      if(typeof entry.path==='string')await collection.addFile(entry.path);
      else if(entry.bytes instanceof ArrayBuffer)await collection.addBytes(entry.name,new Uint8Array(entry.bytes));
      else throw Error('没有收到可用文件，请先保存到电脑再拖入。');
      saved++;
    }catch(error){failed.push(error.message || '文件收藏失败');}}
    if(saved)notifyCollection();
    return {saved,failed};
  }));
  handle('library-add-files',async()=>{
    if(!libraryWin || libraryWin.isDestroyed())throw Error('收藏窗口已关闭。');
    const current=libraryWin;
    const chosen=await dialog.showOpenDialog(current,{title:'选择要收藏的文件',properties:['openFile','multiSelections']});
    if(current.isDestroyed())throw Error('收藏窗口已关闭。');
    if(chosen.canceled)return {saved:0,failed:[]};
    return addFiles(chosen.filePaths);
  },true);
  handle('collection-open',async id=>{
    const item=collection.openTarget(id);
    if(item.kind==='file'){const error=await shell.openPath(item.target);if(error)throw Error(item.storage==='reference'?'无法打开原文件，可能已移动、删除或所在磁盘不可用。':'无法打开文件，请检查收藏副本是否还在。');}
    else if(item.kind==='link'){const url=new URL(item.target);if(!['http:','https:'].includes(url.protocol))throw Error('不支持打开这个链接。');await shell.openExternal(url.href);}
    else throw Error('文字内容请使用复制按钮。');
    return true;
  },true);
  handle('collection-copy',async id=>{const item=collection.openTarget(id);if(item.kind==='file')return copyFileToClipboard(item.target);clipboard.writeText(item.target);return true;},true);
  handle('collection-reveal',async id=>{const item=collection.openTarget(id);if(item.kind!=='file')throw Error('只有文件可打开所在文件夹。');await requireFile(item.target);shell.showItemInFolder(item.target);return true;},true);
  handle('collection-file-icon',async id=>{const item=collection.openTarget(id);if(item.kind!=='file')throw Error('不是文件。');await requireFile(item.target);return (await app.getFileIcon(item.target,{size:'large'})).toDataURL();},true);
  handle('collection-delete',id=>mutateCollection(async()=>{const removed=await collection.remove(id);notifyCollection();return removed;}),true);
  ipcMain.on('passthrough',(e,value)=>{if(liveWindow() && e.sender===win.webContents && !drag)win.setIgnoreMouseEvents(value===true,{forward:true});});
  ipcMain.on('drag',(e,start)=>{
    if(!liveWindow() || e.sender!==win.webContents)return;
    if(start){drag={cursor:screen.getCursorScreenPoint(),pos:win.getPosition()};win.setIgnoreMouseEvents(false);}
    else{drag=null;state.position=win.getPosition();persist();}
  });
  const timer=setInterval(()=>{if(drag && !win.isDestroyed()){const c=screen.getCursorScreenPoint();win.setPosition(...safePosition(drag.pos[0]+c.x-drag.cursor.x,drag.pos[1]+c.y-drag.cursor.y));}},16);
  win.on('closed',()=>{drag=null;clearInterval(timer);idle?.stop();});
  idle=startIdleMonitor({powerMonitor,getWindow:()=>win,readIdleSeconds:()=>smoke?smokeIdleSeconds:powerMonitor.getSystemIdleTime()});
  win.webContents.on('did-finish-load',()=>{if(liveWindow())idle.check(true);});
  await win.loadFile('index.html');
  notifyReminders();
  const checkReminders=()=>{if(!quitting && !reminderPauses.size)reminders.check().catch(()=>{if(liveWindow())win.webContents.send('reminder-due','提醒保存失败，请检查磁盘空间。');});};
  const suspendReminders=()=>reminderPauses.add('suspend'),lockReminders=()=>reminderPauses.add('lock');
  const resumeReminders=()=>{reminderPauses.delete('suspend');checkReminders();presentReminders();},unlockReminders=()=>{reminderPauses.delete('lock');checkReminders();presentReminders();};
  powerMonitor.on('suspend',suspendReminders);powerMonitor.on('lock-screen',lockReminders);powerMonitor.on('resume',resumeReminders);powerMonitor.on('unlock-screen',unlockReminders);
  app.once('before-quit',()=>{for(const [name,listener] of [['suspend',suspendReminders],['lock-screen',lockReminders],['resume',resumeReminders],['unlock-screen',unlockReminders]])powerMonitor.removeListener(name,listener);});
  if(!smoke){reminderTimer=setInterval(checkReminders,1000);checkReminders();}
  if(smoke){
    try{
      await new Promise(r=>setTimeout(r,1200));
      win.hide();trayMenu.getMenuItemById('settings').click();await new Promise(r=>setTimeout(r,200));
      if(!win.isVisible() || !await win.webContents.executeJavaScript(`!document.querySelector('#settings').hidden`))throw Error('tray settings restore');
      const result=await win.webContents.executeJavaScript(`(async()=>{const s=await window.pet.call('state');if(!s.ok||'history' in s.value||document.querySelector('#chat-form'))throw Error('chat remains');openSettings();await new Promise(r=>setTimeout(r,200));if(document.querySelector('#settings').hidden)throw Error('settings');document.querySelector('#settings-close').click();document.querySelector('#pet').click();if(!document.querySelector('#pet').classList.contains('happy'))throw Error('expression');return {settings:true,expression:true,bridge:true,noChat:true};})()`);
      const migrated=JSON.parse(fs.readFileSync(stateFile,'utf8'));
      if(Object.hasOwn(migrated,'key') || Object.hasOwn(migrated,'history') || Object.hasOwn(migrated.settings,'online') || migrated.layoutVersion!==3)throw Error('legacy storage migration');
      result.legacyStorage=true;
      const today=await win.webContents.executeJavaScript(`(async()=>{
        const wait=async check=>{const end=Date.now()+4000;while(!check()){if(Date.now()>end)throw Error('weather UI timeout');await new Promise(r=>setTimeout(r,30));}};
        if(document.querySelector('#clock-hour')||document.querySelector('#calendar-date'))throw Error('numeric time remains');
        const sky=document.querySelector('#day-cycle'),horizon=document.querySelector('.time-horizon');
        const visible=node=>getComputedStyle(node).display!=='none';
        window.lunaWeather.updateTime(new Date(2026,9,5,6));
        if(document.querySelector('#calendar-weekday').textContent!=='Mon'||sky.dataset.period!=='sunrise'||!visible(horizon))throw Error('weekday or sunrise');
        window.lunaWeather.updateTime(new Date(2026,9,5,12));
        if(sky.dataset.period!=='day'||visible(horizon)||!visible(document.querySelector('.time-sun')))throw Error('noon icon');
        window.lunaWeather.updateTime(new Date(2026,9,5,18));
        if(sky.dataset.period!=='sunset'||!visible(horizon))throw Error('sunset icon');
        window.lunaWeather.updateTime(new Date(2026,9,6,0));
        if(sky.dataset.period!=='night'||visible(horizon)||visible(document.querySelector('.time-sun'))||document.querySelector('#calendar-weekday').textContent!=='Tue'||!visible(document.querySelector('.time-moon')))throw Error('moon or midnight weekday');
        window.lunaWeather.updateTime();
        openSettings();await wait(()=>!document.querySelector('#settings').hidden);
        document.querySelector('#weather-locate').click();await wait(()=>document.querySelector('#weather-selected').textContent.includes('IP 定位'));
        document.querySelector('#settings-form').requestSubmit();await wait(()=>document.querySelector('#weather-temperature').textContent==='22°');
        if(document.querySelector('#weather-city').textContent!=='杭州'||document.querySelector('#weather-icon').dataset.kind!=='partly')throw Error('weather view');
        const panel=document.querySelector('#today-panel').getBoundingClientRect(),bubble=document.querySelector('#bubble').getBoundingClientRect();
        if(panel.bottom>bubble.top||panel.height>50||sky.getBoundingClientRect().width>28)throw Error('compact today layout');
        openSettings();await wait(()=>!document.querySelector('#settings').hidden);
        document.querySelector('#weather-query').value='杭州';document.querySelector('#weather-search').click();await wait(()=>!document.querySelector('#weather-results').hidden);
        const select=document.querySelector('#weather-results');select.value='0';select.dispatchEvent(new Event('change'));document.querySelector('#settings-form').requestSubmit();await wait(()=>document.querySelector('#settings').hidden);
        return {dayCycle:true,englishWeekday:true,weatherIcons:true,ipLocation:true,citySearch:true,todayLayout:true};
      })()`);
      Object.assign(result,today);
      win.hide();trayMenu.getMenuItemById('help').click();await new Promise(r=>setTimeout(r,100));
      if(!win.isVisible() || !await win.webContents.executeJavaScript(`document.querySelector('#help').open`))throw Error('tray help restore');
      result.trayPanels=true;
      const controls=await win.webContents.executeJavaScript(`(()=>{
        const buttons=[...document.querySelectorAll('.petbar button')];
        if(buttons.length!==4||buttons.some(button=>button.textContent.trim()||!button.querySelector('svg')||!button.title||!button.getAttribute('aria-label'))||document.querySelector('.caption')||document.querySelector('#sleep')||document.querySelector('#settings-button')||document.querySelector('#help-button'))throw Error('pet icon toolbar');
        openHelp();const help=document.querySelector('#help'),bounds=help.getBoundingClientRect();
        if(!help.open||!help.contains(document.activeElement)||!help.textContent.includes('本地文件只保存路径')||bounds.top<0||bounds.bottom>document.body.clientHeight)throw Error('help dialog');
        if(getComputedStyle(help,'::backdrop').backgroundColor!=='rgba(0, 0, 0, 0)')throw Error('help backdrop must be transparent');
        return {petIconToolbar:true,helpDialog:true};
      })()`);
      Object.assign(result,controls);
      await new Promise(r=>setTimeout(r,150));
      fs.writeFileSync(path.join(app.getPath('temp'),'luna-help-preview.png'),(await win.webContents.capturePage()).toPNG());
      win.webContents.sendInputEvent({type:'keyDown',keyCode:'Escape'});
      win.webContents.sendInputEvent({type:'keyUp',keyCode:'Escape'});
      await new Promise(r=>setTimeout(r,100));
      await win.webContents.executeJavaScript(`{if(document.querySelector('#help').open)throw Error('help Escape');openHelp();document.querySelector('#help-close').click();if(document.querySelector('#help').open)throw Error('help close');}`);
      result.helpClose=true;
      const measuredIdle=powerMonitor.getSystemIdleTime();
      if(!Number.isFinite(measuredIdle)||measuredIdle<0)throw Error('system idle API');
      result.systemIdleAPI=true;
      smokeIdleSeconds=299;idle.check();
      if(await win.webContents.executeJavaScript(`document.querySelector('#pet').classList.contains('sleeping')`))throw Error('sleep before threshold');
      smokeIdleSeconds=300;idle.check();await new Promise(r=>setTimeout(r,50));
      if(!await win.webContents.executeJavaScript(`document.querySelector('#pet').classList.contains('sleeping')`))throw Error('automatic sleep');
      smokeIdleSeconds=0;idle.check();await new Promise(r=>setTimeout(r,50));
      if(await win.webContents.executeJavaScript(`document.querySelector('#pet').classList.contains('sleeping')`))throw Error('automatic wake');
      result.automaticIdleRest=true;
      await win.webContents.executeJavaScript(`(async()=>{openSettings();await new Promise(r=>setTimeout(r,100));if(document.querySelector('#settings-form .primary').getBoundingClientRect().bottom>document.body.clientHeight)throw Error('settings clipped');const buttons=[...document.querySelectorAll('#settings button')];if(buttons.some(button=>button.textContent.trim()||!button.querySelector('svg')||!button.title||!button.getAttribute('aria-label'))||document.querySelector('#settings [data-provider]')||document.querySelector('#top').getAttribute('role')!=='switch')throw Error('settings icon actions');})()`);
      result.settingsIconActions=true;
      fs.writeFileSync(path.join(app.getPath('temp'),'luna-weather-settings.png'),(await win.webContents.capturePage()).toPNG());
      await win.webContents.executeJavaScript(`document.querySelector('#settings-close').click()`);
      // Windows may expand a shown window to its native minimum width at higher DPI.
      if(win.getSize()[0]<WINDOW_WIDTH || await win.webContents.executeJavaScript('document.body.clientWidth')!==WINDOW_WIDTH)throw Error('window width: '+win.getSize()[0]);
      await win.webContents.executeJavaScript(`(async()=>{const data=new DataTransfer();data.setData('text/plain','https://example.com/for-luna');document.querySelector('#pet').dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:data}));await new Promise(r=>setTimeout(r,300));})()`);
      if(collection.list().length!==1 || collection.list()[0].kind!=='link')throw Error('collection drop');
      result.collectionDrop=true;
      await win.webContents.executeJavaScript(`(async()=>{const data=new DataTransfer();data.items.add(new File([new Uint8Array([0,1,2,255])],'临时图片.png',{type:'image/png'}));document.querySelector('#pet').dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:data}));await new Promise(r=>setTimeout(r,300));})()`);
      if(collection.list().length!==2 || collection.list()[0].kind!=='file')throw Error('virtual file drop: '+await win.webContents.executeJavaScript(`document.querySelector('#bubble').textContent`));
      result.virtualFileDrop=true;
      const videoPath=path.join(app.getPath('userData'),'本地视频.mp4');
      fs.writeFileSync(videoPath,Buffer.from([0,1,2,255]));
      await win.webContents.executeJavaScript(`{const input=document.createElement('input');input.type='file';input.id='smoke-file';document.body.append(input);}`);
      win.webContents.debugger.attach('1.3');
      try{
        const {root}=await win.webContents.debugger.sendCommand('DOM.getDocument');
        const {nodeId}=await win.webContents.debugger.sendCommand('DOM.querySelector',{nodeId:root.nodeId,selector:'#smoke-file'});
        await win.webContents.debugger.sendCommand('DOM.setFileInputFiles',{nodeId,files:[videoPath]});
        await win.webContents.executeJavaScript(`(async()=>{const input=document.querySelector('#smoke-file');const data=new DataTransfer();data.items.add(input.files[0]);document.querySelector('#pet').dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:data}));await new Promise(r=>setTimeout(r,300));input.remove();})()`);
      }finally{if(!win.isDestroyed() && win.webContents.debugger.isAttached())win.webContents.debugger.detach();}
      if(collection.list().length!==3 || collection.list()[0].title!=='本地视频.mp4')throw Error('local file drop: '+await win.webContents.executeJavaScript(`document.querySelector('#bubble').textContent`));
      if(!fs.readFileSync(collection.openTarget(collection.list()[0].id).target).equals(fs.readFileSync(videoPath)))throw Error('local file bytes');
      if(collection.openTarget(collection.list()[0].id).target!==videoPath || collection.list()[0].storage!=='reference')throw Error('local file reference');
      result.localFileDrop=true;
      const imageBytes=nativeImage.createFromPath(path.join(__dirname,'assets','character.png')).resize({width:240}).toPNG();
      await collection.addBytes('预览图片.png',new Uint8Array(imageBytes));
      const videoBytes=await win.webContents.executeJavaScript(`(async()=>{
        const canvas=document.createElement('canvas');canvas.width=320;canvas.height=180;const ctx=canvas.getContext('2d');
        const draw=()=>{ctx.fillStyle='#d9c8ee';ctx.fillRect(0,0,320,180);ctx.fillStyle='#6d4c8d';ctx.font='24px sans-serif';ctx.fillText('Luna video preview',40,95);};draw();
        const stream=canvas.captureStream(10);const recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8'});const chunks=[];
        return new Promise((resolve,reject)=>{recorder.ondataavailable=e=>chunks.push(e.data);recorder.onerror=e=>reject(Error('video fixture recording'));recorder.onstop=async()=>{clearInterval(timer);stream.getTracks().forEach(t=>t.stop());resolve(Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer())));};const timer=setInterval(draw,80);recorder.start();setTimeout(()=>recorder.stop(),600);});
      })()`);
      await collection.addBytes('预览视频.webm',new Uint8Array(videoBytes));
      const referenceImage=path.join(app.getPath('userData'),'原图预览.png');fs.writeFileSync(referenceImage,imageBytes);
      await collection.addFile(referenceImage);
      const otherFile=path.join(app.getPath('userData'),'笔记.txt');fs.writeFileSync(otherFile,'file fixture');await collection.addFile(otherFile);
      const linkItem=collection.list().find(entry=>entry.kind==='link');
      await collection.setLinkPreview(linkItem.id,{status:'ready',title:'露娜网页卡片',description:'这是本地测试的网页简介。',image:'data:image/jpeg;base64,'+nativeImage.createFromBuffer(imageBytes).toJPEG(80).toString('base64')});
      await collection.addText('测试文字收藏');
      await showLibrary();
      await new Promise(r=>setTimeout(r,200));
      if(!libraryWin || libraryWin.isDestroyed() || !await libraryWin.webContents.executeJavaScript(`{document.querySelector('#tab-links').click();document.querySelector('#items').textContent.includes('example.com/for-luna');}`))throw Error('library view');
      result.library=true;
      const previews=await libraryWin.webContents.executeJavaScript(`(async()=>{
        const wait=async test=>{const end=Date.now()+5000;while(!test()){if(Date.now()>end)throw Error('media preview timeout');await new Promise(r=>setTimeout(r,50));}};
        if([...document.querySelectorAll('.header-actions button')].some(button=>button.textContent.trim()||!button.querySelector('svg')||!button.title||!button.getAttribute('aria-label')))throw Error('library icon toolbar');
        if([...document.querySelectorAll('#tabs button')].some(button=>!button.querySelector('svg')||!button.title||!button.getAttribute('aria-label')))throw Error('library icon tabs');
        document.querySelector('#tab-media').click();document.querySelector('#tab-media').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));
        if(document.querySelector('#tab-files').getAttribute('aria-selected')!=='true')throw Error('icon tab keyboard navigation');
        document.querySelector('#tab-links').click();
        if(document.querySelector('.web-title')?.textContent!=='露娜网页卡片' || !document.querySelector('.web-description')?.textContent.includes('网页简介'))throw Error('link card');
        await wait(()=>{const img=document.querySelector('.web-cover img');return img&&img.complete&&img.naturalWidth>0;});
        document.querySelector('#tab-text').click();if(!document.querySelector('#items').textContent.includes('测试文字收藏'))throw Error('text tab');
        document.querySelector('#tab-files').click();await wait(()=>{const icon=document.querySelector('.file-icon');return icon&&icon.complete&&icon.naturalWidth>0;});
        if(!document.querySelector('#items .file-name')?.textContent.includes('笔记.txt'))throw Error('file name missing');
        if(!document.querySelector('#items button[aria-label="打开所在文件夹"]'))throw Error('reveal button');
        if(Array.from(document.querySelectorAll('#items .actions button')).some(b=>b.textContent.trim() || !b.querySelector('svg') || !b.title || !b.getAttribute('aria-label')))throw Error('icon actions');
        document.querySelector('#tab-media').click();
        const search=document.querySelector('#search');search.value='预览图片';search.dispatchEvent(new Event('input'));
        await wait(()=>{const img=document.querySelector('img.media-preview');return img&&img.complete&&img.naturalWidth>0;});
        search.value='原图预览';search.dispatchEvent(new Event('input'));
        await wait(()=>{const img=document.querySelector('img.media-preview');return img&&img.complete&&img.naturalWidth>0;});
        search.value='预览视频';search.dispatchEvent(new Event('input'));
        await wait(()=>{const video=document.querySelector('video.media-preview');return video&&video.readyState>=2&&video.videoWidth===320;});
        const video=document.querySelector('video.media-preview');video.currentTime=Math.min(.3,video.duration/2);await wait(()=>!video.seeking);
        search.value='预览';search.dispatchEvent(new Event('input'));
        const cards=Array.from(document.querySelectorAll('#items .item'));
        if(cards.length!==3 || cards[0].getBoundingClientRect().top!==cards[1].getBoundingClientRect().top)throw Error('grid layout');
        if(document.querySelector('#items').textContent.includes('预览图片.png'))throw Error('media filename visible');
        return {imagePreview:true,videoPreview:true,referencePreview:true,libraryTabs:true,libraryGrid:true,fileIcon:true,fileName:true,linkCard:true,libraryIconTabs:true};
      })()`);
      Object.assign(result,previews);
      await libraryWin.webContents.executeJavaScript(`{document.querySelector('#search').value='预览视频';document.querySelector('#search').dispatchEvent(new Event('input'));}`);
      await libraryWin.webContents.executeJavaScript(`document.querySelector('video').requestFullscreen()`,true);
      await new Promise(r=>setTimeout(r,300));
      if(!libraryWin.isFullScreen() || !await libraryWin.webContents.executeJavaScript(`document.fullscreenElement===document.querySelector('video')`))throw Error('video fullscreen');
      await libraryWin.webContents.executeJavaScript(`document.exitFullscreen()`);
      await new Promise(r=>setTimeout(r,300));
      if(libraryWin.isFullScreen() || await libraryWin.webContents.executeJavaScript(`!!document.fullscreenElement`))throw Error('video fullscreen exit');
      result.videoFullscreen=true;result.iconActions=true;
      await libraryWin.webContents.executeJavaScript(`{document.querySelector('#search').value='';document.querySelector('#tab-links').click();}`);
      await new Promise(r=>setTimeout(r,200));
      fs.writeFileSync(path.join(app.getPath('temp'),'luna-link-card-preview.png'),(await libraryWin.webContents.capturePage()).toPNG());
      await libraryWin.webContents.executeJavaScript(`document.querySelector('#tab-files').click()`);
      await new Promise(r=>setTimeout(r,200));
      fs.writeFileSync(path.join(app.getPath('temp'),'luna-file-card-preview.png'),(await libraryWin.webContents.capturePage()).toPNG());
      await libraryWin.webContents.executeJavaScript(`document.querySelector('#tab-media').click()`);
      await libraryWin.webContents.executeJavaScript(`{document.querySelector('#search').value='预览';document.querySelector('#search').dispatchEvent(new Event('input'));}`);
      fs.writeFileSync(path.join(app.getPath('temp'),'luna-library-preview.png'),(await libraryWin.webContents.capturePage()).toPNG());
      const countBeforeCapture=collection.list().length;
      if(!await screenshot.start() || await screenshot.start())throw Error('screenshot single session');
      let capture=screenshot.getWindows()[0];
      await new Promise(r=>setTimeout(r,150));
      capture.webContents.sendInputEvent({type:'keyDown',keyCode:'Escape'});
      if(!capture.isDestroyed())capture.webContents.sendInputEvent({type:'keyUp',keyCode:'Escape'});
      await new Promise(r=>setTimeout(r,100));
      if(screenshot.getWindows().length || collection.list().length!==countBeforeCapture || !win.isVisible() || !libraryWin.isVisible())throw Error('screenshot cancel restore');
      if(!await screenshot.start())throw Error('screenshot restart');
      capture=screenshot.getWindows()[0];
      await capture.webContents.executeJavaScript(`new Promise((resolve,reject)=>{const until=Date.now()+3000;const timer=setInterval(()=>{if(document.querySelector('#screen').complete&&document.querySelector('#screen').naturalWidth){clearInterval(timer);resolve(true);}else if(Date.now()>until){clearInterval(timer);reject(Error('capture image'));}},30);})`);
      capture.webContents.sendInputEvent({type:'mouseDown',x:200,y:160,button:'left',clickCount:1});
      capture.webContents.sendInputEvent({type:'mouseMove',x:40,y:60});
      await new Promise(r=>setTimeout(r,100));
      fs.writeFileSync(path.join(app.getPath('temp'),'luna-screenshot-selection.png'),(await capture.webContents.capturePage()).toPNG());
      capture.webContents.sendInputEvent({type:'mouseUp',x:40,y:60,button:'left',clickCount:1});
      const captureUntil=Date.now()+4000;
      while(collection.list().length===countBeforeCapture){if(Date.now()>captureUntil)throw Error('screenshot automatic collection');await new Promise(r=>setTimeout(r,40));}
      const captureItem=collection.list()[0],captureImage=nativeImage.createFromPath(collection.openTarget(captureItem.id).target);
      if(captureItem.mediaType!=='image/png' || captureItem.storage!=='copy' || captureImage.getSize().width!==320 || captureImage.getSize().height!==200 || screenshot.getWindows().length)throw Error('screenshot crop and cleanup: '+JSON.stringify({item:captureItem,size:captureImage.getSize(),windows:screenshot.getWindows().length}));
      await new Promise(r=>setTimeout(r,200));
      libraryWin.show();libraryWin.focus();
      await libraryWin.webContents.executeJavaScript(`(async()=>{const end=Date.now()+4000;while(true){const image=document.querySelector('[data-id="${captureItem.id}"] img');if(image){image.loading='eager';image.scrollIntoView();}if(document.querySelector('#tab-media').getAttribute('aria-selected')==='true'&&image?.naturalWidth>0)return true;if(Date.now()>end)throw Error('screenshot library preview: '+JSON.stringify({status:document.querySelector('#status').textContent,tab:document.querySelector('#tab-media').getAttribute('aria-selected'),search:document.querySelector('#search').value,images:[...document.querySelectorAll('#items img')].map(i=>({src:i.src,width:i.naturalWidth,hidden:i.hidden})),ids:[...document.querySelectorAll('#items article')].map(i=>i.dataset.id)}));await new Promise(r=>setTimeout(r,50));}})()`);
      result.screenshot={cancel:true,reverseSelection:true,automaticCollection:true,scaledCrop:true,mediaPreview:true};
      await win.webContents.executeJavaScript(`(async()=>{openSettings();await new Promise(r=>setTimeout(r,120));const toggle=document.querySelector('#screenshot-shortcut');if(!toggle.checked)throw Error('shortcut default');toggle.checked=false;document.querySelector('#settings-form').requestSubmit();await new Promise(r=>setTimeout(r,150));const state=await window.pet.call('state');if(state.value.settings.screenshotShortcut!==false||!document.querySelector('#screenshot-button').title.includes('已关闭'))throw Error('shortcut disable UI');})()`);
      if(JSON.parse(fs.readFileSync(stateFile,'utf8')).settings.screenshotShortcut!==false || shortcutStatus().enabled || captureShortcut || globalShortcut.isRegistered('CommandOrControl+Alt+A'))throw Error('shortcut disable persist');
      if(!await libraryWin.webContents.executeJavaScript(`document.querySelector('#screenshot-button').title.includes('已关闭')`))throw Error('library shortcut status');
      await win.webContents.executeJavaScript(`(async()=>{openSettings();await new Promise(r=>setTimeout(r,120));if(document.querySelector('#screenshot-shortcut').checked)throw Error('shortcut reopened preference');document.querySelector('#screenshot-shortcut').checked=true;document.querySelector('#settings-form').requestSubmit();await new Promise(r=>setTimeout(r,150));})()`);
      if(!shortcutStatus().enabled || !JSON.parse(fs.readFileSync(stateFile,'utf8')).settings.screenshotShortcut)throw Error('shortcut reenable');
      result.screenshotShortcutSettings=true;
      await win.webContents.executeJavaScript(`sounds.reminder.volume=0;window.smokeSoundCount=0;window.pet.onSound(()=>window.smokeSoundCount++);void 0;`);
      await showReminders();
      await reminderWin.webContents.executeJavaScript(`(async()=>{document.querySelector('#title').value='喝水，放松一下';document.querySelector('#time').value=new Date(Date.now()+600000-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16);document.querySelector('#form').requestSubmit();await new Promise(r=>setTimeout(r,150));if(!document.querySelector('.item')?.textContent.includes('喝水'))throw Error('reminder form');})()`);
      const reminderItem=reminders.list()[0];if(!reminderItem || reminderItem.status!=='pending')throw Error('reminder saved');
      reminderWin.destroy();lockReminders();smokeReminderNow=reminderItem.dueAt+1;checkReminders();await new Promise(r=>setTimeout(r,30));if(reminders.list()[0].status!=='pending'||reminderWin)throw Error('reminder lock deferral');unlockReminders();await reminders.settled();
      const reminderUntil=Date.now()+4000;
      while(!reminderWin || reminderWin.isDestroyed() || reminderWin.webContents.isLoading()){if(Date.now()>reminderUntil)throw Error('reminder alert window');await new Promise(r=>setTimeout(r,40));}
      await new Promise(r=>setTimeout(r,150));
      if(!reminderWin.isVisible() || !await reminderWin.webContents.executeJavaScript(`!!document.querySelector('.item.fired')`))throw Error('reminder visible alert');
      if(!await win.webContents.executeJavaScript(`window.smokeSoundCount===1 && !sounds.reminder.paused && sounds.reminder.readyState>=2`))throw Error('reminder sound playback');
      presentReminders();await new Promise(r=>setTimeout(r,40));
      if(!await win.webContents.executeJavaScript(`window.smokeSoundCount===1`))throw Error('reminder sound repeated');
      await win.webContents.executeJavaScript(`(async()=>{openSettings();await new Promise(r=>setTimeout(r,100));const toggle=document.querySelector('#sound-enabled');if(!toggle.checked)throw Error('sound default');toggle.checked=false;document.querySelector('#settings-form').requestSubmit();await new Promise(r=>setTimeout(r,150));})()`);
      if(state.settings.soundEnabled || !win.webContents.isAudioMuted() || !libraryWin.webContents.isAudioMuted() || !reminderWin.webContents.isAudioMuted() || JSON.parse(fs.readFileSync(stateFile,'utf8')).settings.soundEnabled!==false)throw Error('global sound mute persisted');
      fs.writeFileSync(path.join(app.getPath('temp'),'luna-reminder-preview.png'),(await reminderWin.webContents.capturePage()).toPNG());
      await reminderWin.webContents.executeJavaScript(`(async()=>{document.querySelector('button[aria-label="稍后 5 分钟"]').click();await new Promise(r=>setTimeout(r,150));if(document.querySelector('.item.fired'))throw Error('reminder snooze UI');})()`);
      if(reminders.list()[0].dueAt!==smokeReminderNow+300000 || reminders.list()[0].status!=='pending')throw Error('reminder snooze');
      await reminderWin.webContents.executeJavaScript(`(async()=>{document.querySelector('button[aria-label="完成"]').click();await new Promise(r=>setTimeout(r,150));document.querySelector('#done').click();if(!document.querySelector('.item.done'))throw Error('reminder complete UI');})()`);
      if(reminders.list()[0].status!=='done' || JSON.parse(fs.readFileSync(path.join(app.getPath('userData'),'reminders.json'),'utf8'))[0].status!=='done')throw Error('reminder persistence');
      await reminderWin.webContents.executeJavaScript(`(async()=>{document.querySelector('#mode-countdown').click();document.querySelector('[data-minutes="60"]').click();if(!document.querySelector('#time').disabled||document.querySelector('#hours').value!=='1'||document.querySelector('#minutes').value!=='0')throw Error('countdown mode preset');document.querySelector('#hours').value='0';document.querySelector('#minutes').value='0';document.querySelector('#seconds').value='10';document.querySelector('#title').value='倒计时测试';document.querySelector('#form').requestSubmit();await new Promise(r=>setTimeout(r,150));if(!document.querySelector('.item.countdown time')?.textContent.includes('剩余'))throw Error('countdown display');})()`);
      const countdownItem=reminders.list().find(item=>item.title==='倒计时测试');
      if(countdownItem?.mode!=='countdown'||countdownItem.dueAt!==smokeReminderNow+10000)throw Error('countdown deadline');
      fs.writeFileSync(path.join(app.getPath('temp'),'luna-countdown-preview.png'),(await reminderWin.webContents.capturePage()).toPNG());
      smokeReminderNow=countdownItem.dueAt;await reminders.check();await new Promise(r=>setTimeout(r,150));
      if(!await reminderWin.webContents.executeJavaScript(`document.querySelector('.item.countdown.fired')?.textContent.includes('到时间啦')`))throw Error('countdown due popup');
      if(!await win.webContents.executeJavaScript(`window.smokeSoundCount===1`))throw Error('muted reminder played');
      await win.webContents.executeJavaScript(`(async()=>{openSettings();await new Promise(r=>setTimeout(r,100));document.querySelector('#sound-enabled').checked=true;document.querySelector('#settings-form').requestSubmit();await new Promise(r=>setTimeout(r,150));})()`);
      if(!state.settings.soundEnabled || win.webContents.isAudioMuted() || reminderWin.webContents.isAudioMuted())throw Error('sound reenable');
      result.sound={decodedPlayback:true,singleChime:true,globalMute:true,persisted:true,reenabled:true};
      result.countdown={preset:true,customSeconds:true,remainingTime:true,due:true};
      reminderWin.destroy();
      notifyReminders();
      result.reminders={form:true,duePopup:true,snooze:true,complete:true,persisted:true};
      libraryWin.destroy();
      await new Promise(r=>setTimeout(r,250));
      const shot=await win.webContents.capturePage();fs.writeFileSync(path.join(__dirname,'preview.png'),shot.toPNG());
      const oldSender=win.webContents;
      win.destroy();
      idle.check(true);
      ipcMain.emit('passthrough',{sender:oldSender},true);
      ipcMain.emit('drag',{sender:oldSender},false);
      result.lateEventsAfterWindowDestroyed=true;
      fs.writeFileSync(path.join(__dirname,'smoke-result.json'),JSON.stringify(result));console.log(JSON.stringify(result));app.exit(0);
    }catch(e){console.error(e);app.exit(1);}
  }
});
app.on('before-quit',event=>{quitting=true;clearInterval(reminderTimer);clearTimeout(reminderAlertTimer);clearTimeout(reminderTopTimer);reminders?.stop();screenshot?.stop();globalShortcut.unregisterAll();if(stateFile && state)persist();if(reminders && !quitSettled){event.preventDefault();reminders.settled().finally(()=>{quitSettled=true;app.quit();});}});
app.on('window-all-closed',()=>app.quit());
}
