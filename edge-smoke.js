const fs=require('node:fs');
const path=require('node:path');
const {WINDOW_WIDTH,WINDOW_HEIGHT}=require('./core');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function wait(win,script){const end=Date.now()+7500;while(!await win.webContents.executeJavaScript(script)){if(Date.now()>end)throw Error('edge smoke timeout: '+script);await sleep(40);}}
async function check({win,dock,screen,ipcMain,stateFile,fireReminder}){
  await win.webContents.executeJavaScript(`showMessage('');if(document.querySelector('#today-panel'))throw Error('removed info bar returned');void 0;`);
  const original=win.getBounds(),area=screen.getDisplayMatching(original).workArea;
  for(const side of ['left','right']){
    // Release through the production IPC path after a synthetic move of the native window.
    ipcMain.emit('drag',{sender:win.webContents},true);win.setPosition(side==='left'?area.x:area.x+area.width-original.width,area.y+Math.min(60,Math.max(0,area.height-original.height)));ipcMain.emit('drag',{sender:win.webContents},false);
    await wait(win,`document.body.dataset.edgeCollapsed==='${side}'`);
    const bounds=win.getBounds();if(bounds.width!==36||bounds.height!==44||bounds.x<area.x||bounds.x+bounds.width>area.x+area.width)throw Error('edge handle bounds');
    const saved=JSON.parse(fs.readFileSync(stateFile,'utf8')).position;if(saved[0]!== (side==='left'?area.x:area.x+area.width-WINDOW_WIDTH))throw Error('collapsed handle overwrote logical pet position');
    const expected=side==='left'?'m9 6 6 6-6 6':'m15 6-6 6 6 6';
    await win.webContents.executeJavaScript(`(()=>{const buttons=[...document.querySelectorAll('button')].filter(node=>{const s=getComputedStyle(node),r=node.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0;});if(buttons.length!==1||buttons[0].id!=='hide'||buttons[0].querySelector('path').getAttribute('d')!==${JSON.stringify(expected)}||document.querySelector('.petbar').getAttribute('aria-hidden')!=='false')throw Error('collapsed must show only inward arrow');})()`);
    await sleep(100);fs.writeFileSync(path.join(require('electron').app.getPath('temp'),'luna-edge-'+side+'.png'),(await win.webContents.capturePage()).toPNG());
    await require('./bubble-smoke').click(win,'hide');await wait(win,`document.body.dataset.edgeCollapsed===''`);
    if(win.getBounds().width<WINDOW_WIDTH||win.getBounds().width>WINDOW_WIDTH+16||win.getBounds().height!==WINDOW_HEIGHT)throw Error('edge expand native bounds');
    if(side==='left'){
      await wait(win,`document.body.dataset.edgeCollapsed==='left'`);
      await fireReminder();await wait(win,`document.body.dataset.edgeCollapsed===''&&!!feedback.getReminder()`);await sleep(5200);if(dock.read().collapsed)throw Error('due reminder auto collapsed');await require('./bubble-smoke').click(win,'bubble-complete');await wait(win,`!feedback.getReminder()`);
      await win.webContents.executeJavaScript(`openSettings();void 0;`);await wait(win,`!document.querySelector('#settings').hidden`);await sleep(5200);if(dock.read().collapsed)throw Error('settings collapsed while editing');await win.webContents.executeJavaScript(`document.querySelector('#settings-close').click();void 0;`);await sleep(60);
    }
    ipcMain.emit('drag',{sender:win.webContents},true);win.setBounds(original);ipcMain.emit('drag',{sender:win.webContents},false);await wait(win,`document.body.dataset.edgeCollapsed===''`);
    if(dock.read().side!==null)throw Error('dragging away must undock');
  }
  return {noInfoBar:true,left:true,right:true,onlyArrow:true,nativeExpand:true,autoRecollapse:true,panelHold:true,reminderWakeAndHold:true,logicalPosition:true,undock:true};
}
module.exports={check};
