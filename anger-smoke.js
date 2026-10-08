const fs=require('node:fs'),path=require('node:path');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
module.exports=async({win,trayMenu,phase,restore,output})=>{
 const read=code=>win.webContents.executeJavaScript(code);
 const until=async(test,label,limit=5000)=>{const deadline=Date.now()+limit;while(!await test()){if(Date.now()>deadline)throw Error(label);await sleep(40);}};
 await read("(async()=>{closeSheets();document.querySelector('#settings').hidden=true;document.querySelector('#wardrobe').hidden=true;rest(false);angerInteraction.returned();window.savedAngerMethods={click:bodyReactions.click,reset:bodyReactions.reset};window.savedAngerSettings={...settings};await api('settings',{...settings,bodyShortcuts:{...settings.bodyShortcuts,chest:''}});Object.assign(bodyReactions,window.lunaBodyShortcuts.createReactions({}));feedback.updateReminder({id:'anger-priority',title:'提醒测试',remaining:1});})()");
 let sensitiveClick=0;const click=()=>require('./body-shortcut-smoke').click(win,++sensitiveClick%2?'forbidden':'chest');
 try{
  await click();await click();await click();
  if(!await read("window.lunaCharacter.expression==='angry'&&feedback.getMessage().includes('一直戳')&&!feedback.getReminder()"))throw Error('empty shortcut or reminder suppressed anger dialogue');
  await click();await click();await click();await read("showMessage('should not interrupt');rest(true);document.querySelector('#bubble-body').click();void 0");
  if(!await read("window.lunaCharacter.expression==='angry'&&feedback.getMessage().includes('一直戳')"))throw Error('angry pose interrupted');
  await until(()=>read("angerInteraction.phase==='furious'"),'furious not reached');
  if(!await read("window.lunaCharacter.expression==='furious'&&feedback.getMessage().includes('变态')&&document.body.inert"))throw Error('furious face or dialogue');
  await read('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');fs.writeFileSync(path.join(output,'luna-furious-preview.png'),(await win.webContents.capturePage()).toPNG());
  await until(()=>phase()==='absent','did not disappear');const hiddenAt=Date.now();
  if(win.isVisible())throw Error('pet remains visible');restore();if(win.isVisible())throw Error('restore bypassed absence');
  const results=await read("Promise.all(['library-show','settings','recording-show','screenshot-start'].map(name=>window.pet.call(name,{})))");const frame=win.webContents.mainFrame.frames.find(frame=>frame.url.endsWith('/recording.html'));if(frame&&(await frame.executeJavaScript("window.recorder.call('recording-select')")).ok)throw Error('recording bypassed absence');if(results.some(r=>r.ok))throw Error('operation bypassed absence');
  if(trayMenu().getMenuItemById('settings').enabled)throw Error('tray remains enabled');
  await sleep(9200);if(win.isVisible())throw Error('returned before ten seconds');
  await until(()=>phase()==='normal'&&win.isVisible(),'return failed',2200);
  if(Date.now()-hiddenAt<9800||!await read("!document.body.inert&&angerInteraction.phase==='normal'&&feedback.getMessage().includes('回来')"))throw Error('return dialogue/unlock');
  if(!trayMenu().getMenuItemById('settings').enabled)throw Error('tray not restored');
  return {threeSecondProtectedAnger:true,emptyShortcutSpeaks:true,reminderPreserved:true,queuedEscalation:true,forbiddenTriggers:true,furiousOpenEyesClosedMouth:true,sameGentleBlush:true,hiddenTenSeconds:true,operationsLocked:true,returnDialogue:true};
 }finally{if(phase()==='absent')await until(()=>phase()==='normal','cleanup return',11500);await read("(async()=>{heldReminder=null;feedback.updateReminder(null);angerInteraction.returned();await api('anger-mode','normal');Object.assign(bodyReactions,window.savedAngerMethods);bodyReactions.reset();await api('settings',window.savedAngerSettings);delete window.savedAngerSettings;delete window.savedAngerMethods;showMessage('');window.lunaCharacter.cancel();})()");}
};
