const { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage, shell, clipboard, dialog, protocol, net } = require('electron');
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
protocol.registerSchemesAsPrivileged([{scheme:'luna-media',privileges:{standard:true,secure:true,stream:true}}]);
const smoke = process.argv.includes('--smoke-test');
if (smoke) app.setPath('userData', path.join(app.getPath('temp'), 'lunapet-smoke-' + process.pid));
let win, libraryWin, tray, state, stateFile, collection, drag=null;
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
function publicState() { return { settings:state.settings }; }
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
  const current=libraryWin;
  current.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  current.webContents.on('will-navigate',e=>e.preventDefault());
  current.once('ready-to-show',()=>{if(!current.isDestroyed())current.show();});
  current.on('closed',()=>{if(libraryWin===current)libraryWin=null;});
  await current.loadFile('library.html');
  if(!smoke)for(const item of collection.list())if(item.kind==='link'&&!item.linkPreview)queuePreview(item.id).catch(()=>{});
}
if (!app.requestSingleInstanceLock() && !smoke) app.quit();
else {
app.on('second-instance',()=>{if(win)restore();});
app.whenReady().then(async()=>{
  stateFile=path.join(app.getPath('userData'),'state.json');
  if(smoke){fs.mkdirSync(path.dirname(stateFile),{recursive:true});fs.writeFileSync(stateFile,JSON.stringify({settings:{name:'露娜',nickname:'',top:true,online:true,baseUrl:'https://example.test/v1',model:'old-model'},key:'fake-encrypted-key',history:[{role:'assistant',content:'旧版测试回复',online:true}],position:[100,100]}),'utf8');}
  state={settings:{...defaults},layoutVersion:2};
  try { state=migrateState(JSON.parse(fs.readFileSync(stateFile,'utf8')));persist(); } catch {}
  collection=await createCollection(app.getPath('userData'));
  protocol.handle('luna-media',request=>mediaResponse(request,collection));
  const area=screen.getPrimaryDisplay().workArea;
  const p=state.position || [area.x+area.width-WINDOW_WIDTH-30,area.y+area.height-WINDOW_HEIGHT-20];
  const [x,y]=safePosition(Number(p[0])||0,Number(p[1])||0);
  win=new BrowserWindow({width:WINDOW_WIDTH,height:WINDOW_HEIGHT,x,y,transparent:true,frame:false,resizable:false,hasShadow:false,alwaysOnTop:state.settings.top,show:false,skipTaskbar:false,backgroundColor:'#00000000',webPreferences:{preload:path.join(__dirname,'preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  win.webContents.on('will-navigate',e=>e.preventDefault());
  win.webContents.session.setPermissionRequestHandler((contents,permission,cb,details)=>cb(details.isMainFrame!==false && allowFullscreen(contents,permission)));
  win.webContents.session.setPermissionCheckHandler((contents,permission)=>allowFullscreen(contents,permission));
  win.once('ready-to-show',()=>win.show());
  win.on('moved',()=>{state.position=win.getPosition();});
  screen.on('display-removed',()=>{if(liveWindow())win.setPosition(...safePosition(...win.getPosition()));});
  // Tray artwork is derived from a small in-memory RGBA buffer, independent of character assets.
  const b=Buffer.alloc(32*32*4);for(let yy=0;yy<32;yy++)for(let xx=0;xx<32;xx++){const i=(yy*32+xx)*4;const inside=(xx-16)**2+(yy-16)**2<210;b[i]=170;b[i+1]=132;b[i+2]=232;b[i+3]=inside?255:0;}
  tray=new Tray(nativeImage.createFromBitmap(b,{width:32,height:32}));
  tray.setToolTip('露娜 · 桌面伙伴');tray.setContextMenu(Menu.buildFromTemplate([{label:'显示宠物',click:restore},{label:'隐藏宠物',click:()=>{if(liveWindow())win.hide();}},{type:'separator'},{label:'退出',click:()=>app.quit()}]));tray.on('double-click',restore);
  const handle=(name,fn,allowLibrary=false)=>ipcMain.handle(name,async(e,...args)=>{const petSender=liveWindow() && e.sender===win.webContents;const librarySender=allowLibrary && libraryWin && !libraryWin.isDestroyed() && e.sender===libraryWin.webContents;if(!petSender && !librarySender)return {ok:false,error:'窗口已关闭'};try{return {ok:true,value:await fn(...args)};}catch(err){return {ok:false,error:err.message || '操作失败'};}});
  handle('state',()=>publicState());
  handle('settings',input=>{
    const next=validate(input);
    const previous=state;state={...state,settings:next};try{persist();}catch(e){state=previous;throw e;}
    win.setAlwaysOnTop(next.top);return publicState();
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
  win.on('closed',()=>{drag=null;clearInterval(timer);});
  await win.loadFile('index.html');
  if(smoke){
    try{
      await new Promise(r=>setTimeout(r,1200));
      const result=await win.webContents.executeJavaScript(`(async()=>{const s=await window.pet.call('state');if(!s.ok||'history' in s.value||document.querySelector('#chat-form'))throw Error('chat remains');document.querySelector('#settings-button').click();await new Promise(r=>setTimeout(r,200));if(document.querySelector('#settings').hidden)throw Error('settings');document.querySelector('#settings-close').click();document.querySelector('#pet').click();if(!document.querySelector('#pet').classList.contains('happy'))throw Error('expression');return {settings:true,expression:true,bridge:true,noChat:true};})()`);
      const migrated=JSON.parse(fs.readFileSync(stateFile,'utf8'));
      if(Object.hasOwn(migrated,'key') || Object.hasOwn(migrated,'history') || Object.hasOwn(migrated.settings,'online') || migrated.layoutVersion!==2)throw Error('legacy storage migration');
      result.legacyStorage=true;
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
        return {imagePreview:true,videoPreview:true,referencePreview:true,libraryTabs:true,libraryGrid:true,fileIcon:true,fileName:true,linkCard:true};
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
      libraryWin.destroy();
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
