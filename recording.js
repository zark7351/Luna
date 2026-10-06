const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {validateOptions}=require('./recording-options');
function createRecording({BrowserWindow,ipcMain,screen,powerMonitor,screenshot,collection,getWindows,getSettings,remember,commit,onMessage,onSound,getHostWindow,onShow,smoke=false}){
  let window=getHostWindow(),session=null,disposed=false;
  window.on('close',event=>{if(session){event.preventDefault();stop().finally(()=>{if(live())window.close();});}});
  window.on('closed',()=>{window=null;if(session)fail('露娜窗口已关闭。').catch(()=>{});});
  window.webContents.on('render-process-gone',()=>{if(session)fail('录屏进程中断，请重新录制。').catch(()=>{});});
  const live=()=>window&&!window.isDestroyed();
  const state=(message='')=>({phase:session?.phase||'idle',fps:getSettings().recordFrameRate,format:getSettings().recordFormat,message});
  function publish(message){if(live())window.webContents.send('recording-status',state(message));}
  function clearBorders(current){for(const border of current.borders||[])if(!border.isDestroyed())border.destroy();current.borders=[];}
  async function showBorders(current,selected){
    const {rect,bounds}=selected;
    if(session!==current||!['preparing','recording'].includes(current.phase))return;
    const scale=screen.getDisplayNearestPoint({x:Math.round(bounds.x+rect.x),y:Math.round(bounds.y+rect.y)}).scaleFactor||1;
    const border=new BrowserWindow({x:Math.round(bounds.x+rect.x),y:Math.round(bounds.y+rect.y),width:Math.round(rect.width),height:Math.round(rect.height),frame:false,transparent:true,resizable:false,focusable:false,skipTaskbar:true,show:false,alwaysOnTop:true,hasShadow:false,roundedCorners:false,webPreferences:{contextIsolation:true,sandbox:true,nodeIntegration:false}});
    current.borders.push(border);border.setIgnoreMouseEvents(true);border.setContentProtection(true);border.setAlwaysOnTop(true,'screen-saver');
    border.webContents.setWindowOpenHandler(()=>({action:'deny'}));border.webContents.on('will-navigate',event=>event.preventDefault());
    await border.loadFile(path.join(__dirname,'recording-border.html'),{query:{line:String(1/scale)}});
    if(session!==current||!['preparing','recording'].includes(current.phase)||border.isDestroyed()){clearBorders(current);return;}
    border.showInactive();
  }
  function reset(current,message){if(session!==current)return;clearBorders(current);if(live())window.setContentProtection(false);session=null;clearTimeout(current.timeout);clearTimeout(current.startTimeout);for(const hidden of current.hidden)if(!hidden.isDestroyed())hidden.showInactive();current.resolve();publish(message);onMessage(message,!!current.saved);}
  async function fail(message){const current=session;if(!current)return;current.phase='saving';try{await current.queue.catch(()=>{});await current.writer?.abort();}finally{reset(current,String(message||'录屏失败，请重试。').slice(0,200));onSound('error');}}
  async function show(){if(disposed||!live())return;onShow();}
  async function begin(selected,options,{test=false}={}){
    const current=session;if(!current||!live())return;
    current.phase='preparing';publish('正在开始录制…');
    try{
      current.writer=await collection.beginRecording('录屏-'+new Date().toISOString().replace(/[:.]/g,'-')+'.'+options.format);
      if(session!==current||disposed){await current.writer.abort();return;}
      if(current.phase==='stopping'){await current.writer.abort();reset(current,'已取消录屏。');return;}
      current.config={...selected,...options,test:smoke&&test};
      await showBorders(current,selected);
      if(session!==current||!live())return;
      if(current.phase==='stopping'){await current.writer.abort();reset(current,'已取消录屏。');return;}
      for(const appWindow of getWindows())if(appWindow&&appWindow!==window&&!appWindow.isDestroyed()&&appWindow.isVisible()){appWindow.hide();current.hidden.push(appWindow);}
      window.setContentProtection(true);window.showInactive();window.webContents.send('recording-start',current.config);
      current.startTimeout=setTimeout(()=>{if(session===current&&current.phase==='preparing')fail('屏幕采集启动超时，请重试。').catch(()=>{});},15000);
    }catch(error){await fail(error.message);}
  }
  async function select(options,testSelection=null){
    options=validateOptions(options);if(disposed||session||screenshot.isActive())throw Error('已有截图或录屏正在进行。');
    remember(options);const current={phase:'choosing',hidden:[],borders:[],queue:Promise.resolve(),saved:false};current.done=new Promise(resolve=>current.resolve=resolve);session=current;publish('请框选录屏范围…');
    try{
      if(smoke&&testSelection){await begin(testSelection,options,{test:testSelection.test!==false});return true;}
      const started=await screenshot.start({onSelect:selected=>begin(selected,options),onCancel:()=>reset(current,'已取消录屏。')});
      if(!started)reset(current,'录屏框选未启动。');return started;
    }catch(error){await fail(error.message);throw error;}
  }
  function stop(){
    const current=session;if(!current)return Promise.resolve();
    if(current.phase==='choosing'){screenshot.cancel();reset(current,'已取消录屏。');return current.done;}
    if(['preparing','recording'].includes(current.phase)){current.phase='stopping';publish('正在保存视频…');if(live())window.webContents.send('recording-stop');current.timeout=setTimeout(()=>{if(session===current)fail('录屏保存超时，请重新录制。').catch(()=>{});},20000);}
    return current.done;
  }
  const methods={
    'recording-state':()=>state(),
    'recording-select':()=>select({format:'mp4',fps:getSettings().recordFrameRate}),
    'recording-stop':stop,
    'recording-started':()=>{if(!session||!['preparing','stopping'].includes(session.phase))throw Error('录屏已结束。');clearTimeout(session.startTimeout);if(session.phase!=='stopping'){session.phase='recording';publish('录制中 · 停止后自动收藏');onSound('capture-start');}return true;},
    'recording-chunk':async bytes=>{const current=session;if(!current?.writer||!['recording','stopping'].includes(current.phase)||!(bytes instanceof ArrayBuffer)||!bytes.byteLength||bytes.byteLength>8*1024*1024)throw Error('录屏数据无效。');current.queue=current.queue.then(()=>current.writer.append(new Uint8Array(bytes)));await current.queue;return true;},
    'recording-finish':async()=>{const current=session;if(!current?.writer||!['recording','stopping'].includes(current.phase))throw Error('录屏已结束。');current.phase='saving';clearTimeout(current.startTimeout);await current.queue;try{await commit(current.writer);current.saved=true;reset(current,'录屏已收藏。');onSound('capture-done');return true;}catch(error){await fail(error.message);throw error;}},
    'recording-error':message=>fail(message)
  };
  for(const [name,fn] of Object.entries(methods))ipcMain.handle(name,async(event,value)=>{if(disposed||!live()||event.sender!==window.webContents)return {ok:false,error:'录屏窗口已关闭。'};try{return {ok:true,value:await fn(value)};}catch(error){return {ok:false,error:error.message||'录屏失败'};}});
  const interrupted=()=>{stop().catch(()=>{});};
  for(const name of ['suspend','lock-screen'])powerMonitor.on(name,interrupted);
  const changed=(_event,_display,metrics)=>{if(!metrics||metrics.some(name=>['bounds','scaleFactor','rotation'].includes(name)))interrupted();};
  screen.on('display-removed',interrupted);screen.on('display-metrics-changed',changed);
  const canCapture=contents=>!!session&&['preparing','recording'].includes(session.phase)&&live()&&contents===window.webContents&&contents.getURL()===pathToFileURL(path.join(__dirname,'index.html')).href;
  async function dispose(){await stop();disposed=true;for(const name of Object.keys(methods))ipcMain.removeHandler(name);for(const name of ['suspend','lock-screen'])powerMonitor.removeListener(name,interrupted);screen.removeListener('display-removed',interrupted);screen.removeListener('display-metrics-changed',changed);if(live())window.setContentProtection(false);}
  return {show,stop,dispose,canCapture,isActive:()=>!!session,getWindow:()=>window,getBorders:()=>[...(session?.borders||[])],select};
}
module.exports={createRecording};
