const fs=require('node:fs'),path=require('node:path');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
module.exports=async({win,restore,stateFile,output})=>{
 const read=code=>win.webContents.executeJavaScript(code);
 const wait=async(test,label)=>{const end=Date.now()+4500;while(!await test()){if(Date.now()>end)throw Error(label+' '+await read("JSON.stringify({ignore,classes:document.querySelector('#companion').className,settingsHidden:document.querySelector('#settings').hidden,bar:document.querySelector('.petbar').getBoundingClientRect().toJSON(),button:document.querySelector('#toolbar-settings').getBoundingClientRect().toJSON()})"));await sleep(40);}};
 const click=async(id)=>{const p=await read("(()=>{showControls();const b=document.querySelector('#"+id+"').getBoundingClientRect();return {x:Math.round(b.x+b.width/2),y:Math.round(b.y+b.height/2)};})()");win.webContents.sendInputEvent({type:'mouseMove',...p});await sleep(180);win.webContents.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,...p});win.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,...p});await sleep(120);};
 await read("closeSheets();document.querySelector('#settings').hidden=true;document.querySelector('#wardrobe').hidden=true;if(document.querySelector('#help').open)document.querySelector('#help').close();void 0;");
 const saved=await read('JSON.parse(JSON.stringify(settings))');
 try{
  win.close();await sleep(100);if(win.isDestroyed()||win.isVisible())throw Error('native close did not hide to tray');restore();await wait(()=>win.isVisible(),'tray restore');
  await click('toolbar-settings');await wait(()=>read("!document.querySelector('#settings').hidden"),'toolbar settings');
  await read("document.querySelector('#pure-mode').checked=true;document.querySelector('#settings-form').requestSubmit();void 0;");
  await wait(()=>read("settings.pureMode&&document.querySelector('#settings').hidden")&&win.getBounds().height===128,'pure mode compact');
  if(!JSON.parse(fs.readFileSync(stateFile)).settings.pureMode)throw Error('pure mode not persisted');
  if(!await read("(()=>{const bar=document.querySelector('.petbar');hideControls();return !document.querySelector('#hide')&&getComputedStyle(document.querySelector('#edge-expand')).display==='none'&&[...bar.querySelectorAll('button')].filter(b=>getComputedStyle(b).display!=='none').length===6&&getComputedStyle(document.querySelector('#pet')).display==='none'&&getComputedStyle(bar).visibility==='visible'&&bar.getAttribute('aria-hidden')==='false'&&!overControls(1,1)&&[...bar.querySelectorAll('button')].every(b=>getComputedStyle(b).borderTopWidth==='0px');})()"))throw Error('clean toolbar layout/input');
  fs.writeFileSync(path.join(output,'luna-pure-mode-preview.png'),(await win.webContents.capturePage()).toPNG());
  await click('library-button');await wait(()=>read("!document.querySelector('#library-sheet').hidden")&&win.getBounds().height===640,'pure library expansion');
  await read("closeSheet('library');void 0");await wait(()=>win.getBounds().height===128,'panel close did not compact');
  const grip=await read("(()=>{const b=document.querySelector('#toolbar-drag').getBoundingClientRect();return {x:Math.round(b.x+b.width/2),y:Math.round(b.y+b.height/2)};})()");
  win.webContents.sendInputEvent({type:'mouseMove',...grip});await sleep(180);win.webContents.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,...grip});await sleep(50);win.webContents.sendInputEvent({type:'mouseMove',modifiers:['leftButtonDown'],x:grip.x+15,y:grip.y});await sleep(100);
  if(!await read('!!dragStart&&dragging'))throw Error('toolbar grip did not drag '+await read('JSON.stringify({dragStart,dragging,ignore})'));win.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,x:grip.x+15,y:grip.y});await sleep(100);if(!await read('!dragStart&&!dragging'))throw Error('toolbar drag not released '+await read('JSON.stringify({dragStart,dragging,ignore})'));
  await click('toolbar-settings');await wait(()=>read("!document.querySelector('#settings').hidden"),'clean settings reopen');
  await read("document.querySelector('#pure-mode').checked=false;document.querySelector('#settings-form').requestSubmit();void 0");await wait(()=>read("!settings.pureMode&&getComputedStyle(document.querySelector('#pet')).display!=='none'")&&win.getBounds().height===640,'normal mode restore');
  return {closeToTray:true,restore:true,unifiedToolbar:true,settingsEntry:true,characterHidden:true,compactWindow:true,persisted:true,panelsExpand:true,gripDrag:true,normalModeRestore:true};
 }finally{await read("api('settings',"+JSON.stringify(saved)+").then(()=>{closeSheets();document.querySelector('#settings').hidden=true;void 0;})");}
};
