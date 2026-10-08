const fs=require('node:fs'),path=require('node:path');
const {WINDOW_WIDTH,TOOLBAR_INSET,TOOLBAR_WIDTH}=require('./core');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
module.exports=async({win,restore,stateFile,output})=>{
 const read=code=>win.webContents.executeJavaScript(code);
 const wait=async(test,label,timeout=4500)=>{const end=Date.now()+timeout;while(!await test()){if(Date.now()>end)throw Error(label+' '+await read("JSON.stringify({ignore,edgeState,classes:document.querySelector('#companion').className,settingsHidden:document.querySelector('#settings').hidden,bar:document.querySelector('.petbar').getBoundingClientRect().toJSON(),button:document.querySelector('#toolbar-settings').getBoundingClientRect().toJSON()})"));await sleep(40);}};
 const click=async(id)=>{const p=await read("(()=>{showControls();const b=document.querySelector('#"+id+"').getBoundingClientRect();return {x:Math.round(b.x+b.width/2),y:Math.round(b.y+b.height/2)};})()");win.webContents.sendInputEvent({type:'mouseMove',...p});await sleep(180);win.webContents.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,...p});win.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,...p});await sleep(120);};
 await read("closeSheets();document.querySelector('#settings').hidden=true;document.querySelector('#wardrobe').hidden=true;if(document.querySelector('#help').open)document.querySelector('#help').close();void 0;");
 const saved=await read('JSON.parse(JSON.stringify(settings))');
 try{
  await click('hide');await wait(()=>!win.isVisible()&&!win.isDestroyed(),'normal toolbar hide');restore();await wait(()=>win.isVisible(),'normal toolbar tray restore');
  win.close();await sleep(100);if(win.isDestroyed()||win.isVisible())throw Error('native close did not hide to tray');restore();await wait(()=>win.isVisible(),'tray restore');
  await click('toolbar-settings');await wait(()=>read("!document.querySelector('#settings').hidden"),'toolbar settings');
  await read("document.querySelector('#pure-mode').checked=true;document.querySelector('#settings-form').requestSubmit();void 0;");
  await wait(()=>read("settings.pureMode&&document.querySelector('#settings').hidden")&&win.getBounds().height===128,'pure mode compact');
  if(!JSON.parse(fs.readFileSync(stateFile)).settings.pureMode)throw Error('pure mode not persisted');
  if(!await read("(()=>{const bar=document.querySelector('.petbar');hideControls();return !!document.querySelector('#hide svg[data-icon=hide]')&&getComputedStyle(document.querySelector('#edge-expand')).display==='none'&&[...bar.querySelectorAll('button')].filter(b=>getComputedStyle(b).display!=='none').length===7&&getComputedStyle(document.querySelector('#pet')).display==='none'&&getComputedStyle(bar).visibility==='visible'&&bar.getAttribute('aria-hidden')==='false'&&!overControls(1,1)&&[...bar.querySelectorAll('button')].every(b=>getComputedStyle(b).borderTopWidth==='0px');})()"))throw Error('clean toolbar layout/input');
  fs.writeFileSync(path.join(output,'luna-pure-mode-preview.png'),(await win.webContents.capturePage()).toPNG());
  await click('hide');await wait(()=>!win.isVisible()&&!win.isDestroyed(),'pure toolbar hide');restore();await wait(()=>win.isVisible()&&win.getBounds().height===128,'pure toolbar tray restore');
  await click('library-button');await wait(()=>read("!document.querySelector('#library-sheet').hidden")&&win.getBounds().height===640,'pure library expansion');
  await read("closeSheet('library');void 0");await wait(()=>win.getBounds().height===128,'panel close did not compact');
  const beforeEdges=win.getBounds(),area=require('electron').screen.getDisplayMatching(beforeEdges).workArea;
  for(const side of ['left','right']){
    restore();await wait(()=>win.getBounds().height===128,'pure edge restore');
    const edgeX=side==='left'?area.x-TOOLBAR_INSET:area.x+area.width-WINDOW_WIDTH+TOOLBAR_INSET;
    win.setBounds({...beforeEdges,x:edgeX});await wait(()=>Math.abs(win.getBounds().x-edgeX)<=1,'pure edge position');
    const {ipcMain}=require('electron');ipcMain.emit('drag',{sender:win.webContents},true);ipcMain.emit('drag',{sender:win.webContents},false);
    await wait(()=>read("edgeState.collapsed&&edgeState.side==='"+side+"'")&&win.getBounds().height===44,'pure toolbar collapse');
    await wait(()=>read("(()=>{const bar=document.querySelector('.petbar').getBoundingClientRect();return Math.abs(bar.width-36)<1&&Math.abs(bar.height-44)<1&&[...document.querySelectorAll('.petbar button')].filter(b=>getComputedStyle(b).display!=='none').every(b=>b.id==='edge-expand');})()"),'pure collapsed arrow bounds');
    fs.writeFileSync(path.join(output,'luna-pure-edge-'+side+'.png'),(await win.webContents.capturePage()).toPNG());
    await click('edge-expand');await wait(()=>read('!edgeState.collapsed')&&win.getBounds().height===128,'pure arrow expansion');
    await read("api('pure-layout',false)");const bar=await read("document.querySelector('.petbar').getBoundingClientRect().toJSON()");
    if(Math.abs(bar.width-TOOLBAR_WIDTH)>1||Math.abs(win.getBounds().x+(side==='left'?bar.left:bar.right)-(side==='left'?area.x:area.x+area.width))>1)throw Error('pure toolbar edge alignment');
    await click('library-button');await wait(()=>read("!document.querySelector('#library-sheet').hidden")&&win.getBounds().height===640,'pure edge library expansion');
    if(win.getBounds().x<area.x-1||win.getBounds().x+WINDOW_WIDTH>area.x+area.width+1)throw Error('pure edge panel clipped');
    await read("closeSheet('library');void 0");await wait(()=>win.getBounds().height===128&&Math.abs(win.getBounds().x-edgeX)<=1,'pure edge anchor restoration');
    await wait(()=>read('edgeState.collapsed')&&win.getBounds().height===44,'pure toolbar automatic recollapse',7500);
  }
  restore();await wait(()=>win.getBounds().height===128,'pure final expansion');win.setBounds(beforeEdges);await wait(()=>Math.abs(win.getBounds().x-beforeEdges.x)<=1,'pure original position');require('electron').ipcMain.emit('drag',{sender:win.webContents},true);require('electron').ipcMain.emit('drag',{sender:win.webContents},false);await read("api('pure-layout',false)");
  const grip=await read("(()=>{const b=document.querySelector('#toolbar-drag').getBoundingClientRect();return {x:Math.round(b.x+b.width/2),y:Math.round(b.y+b.height/2)};})()");
  win.webContents.sendInputEvent({type:'mouseMove',...grip});await sleep(180);win.webContents.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,...grip});await sleep(50);win.webContents.sendInputEvent({type:'mouseMove',modifiers:['leftButtonDown'],x:grip.x+15,y:grip.y});await sleep(100);
  if(!await read('!!dragStart&&dragging'))throw Error('toolbar grip did not drag '+await read('JSON.stringify({dragStart,dragging,ignore})'));win.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,x:grip.x+15,y:grip.y});await sleep(100);if(!await read('!dragStart&&!dragging'))throw Error('toolbar drag not released '+await read('JSON.stringify({dragStart,dragging,ignore})'));
  await click('toolbar-settings');await wait(()=>read("!document.querySelector('#settings').hidden"),'clean settings reopen');
  await read("document.querySelector('#pure-mode').checked=false;document.querySelector('#settings-form').requestSubmit();void 0");await wait(()=>read("!settings.pureMode&&getComputedStyle(document.querySelector('#pet')).display!=='none'")&&win.getBounds().height===640,'normal mode restore');
  return {toolbarHideNormal:true,toolbarHidePure:true,closeToTray:true,restore:true,unifiedToolbar:true,settingsEntry:true,characterHidden:true,compactWindow:true,persisted:true,panelsExpand:true,toolbarEdges:true,edgePanelsFit:true,sideHide:true,arrowExpandsCompact:true,autoRecollapse:true,gripDrag:true,normalModeRestore:true};
 }finally{await read("api('settings',"+JSON.stringify(saved)+").then(()=>{closeSheets();document.querySelector('#settings').hidden=true;void 0;})");}
};
