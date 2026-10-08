const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {validateOptions}=require('./recording-options');
const geometry=require('./recording-frame-geometry');
function createRecording({BrowserWindow,ipcMain,screen,powerMonitor,screenshot,collection,getWindows,getSettings,remember,commit,onMessage,onSound,getHostWindow,onShow,smoke=false,nativeRecorder=null,isBlocked=()=>false}){
  let window=getHostWindow(),session=null,disposed=false;
  window.on('close',event=>{if(event.defaultPrevented)return;if(session){event.preventDefault();stop().finally(()=>{if(live())window.close();});}});
  window.on('closed',()=>{window=null;if(session)fail('露娜窗口已关闭。').catch(()=>{});});
  window.webContents.on('render-process-gone',()=>{if(session)fail('录屏进程中断，请重新录制。').catch(()=>{});});
  const live=()=>window&&!window.isDestroyed();
  const state=(message='')=>({phase:session?.phase||'idle',fps:getSettings().recordFrameRate,format:getSettings().recordFormat,nativeAvailable:!!nativeRecorder?.available,backend:session?.native||session?.nativePending?'native':'browser',startedAt:session?.startedAt||0,encoder:session?.encoding?.encoder||null,rect:session?.selected?.rect||null,bounds:session?.selected?.bounds||null,language:getSettings().language||'zh-CN',scale:session?.scale||1,message});
  function publish(message){const value=state(message);if(live())window.webContents.send('recording-status',value);for(const border of session?.borders||[])if(!border.isDestroyed())border.webContents.send('recording-status',value);}
  function clearBorders(current){for(const border of current.borders||[])if(!border.isDestroyed())border.destroy();current.borders=[];}
  async function showBorders(current,selected){
    const {rect,bounds}=selected;
    if(session!==current||!['adjusting','preparing','recording'].includes(current.phase))return;
    const scale=screen.getDisplayNearestPoint({x:Math.round(bounds.x+rect.x),y:Math.round(bounds.y+rect.y)}).scaleFactor||1;
    const border=new BrowserWindow({x:Math.round(bounds.x),y:Math.round(bounds.y),width:Math.round(bounds.width),height:Math.round(bounds.height),frame:false,transparent:true,resizable:false,focusable:true,skipTaskbar:true,show:false,alwaysOnTop:true,hasShadow:false,roundedCorners:false,webPreferences:{preload:path.join(__dirname,'recording-border-preload.js'),contextIsolation:true,sandbox:true,nodeIntegration:false}});
    current.borders.push(border);border.setIgnoreMouseEvents(true,{forward:true});border.setContentProtection(true);border.setAlwaysOnTop(true,'screen-saver');
    border.webContents.setWindowOpenHandler(()=>({action:'deny'}));border.webContents.on('will-navigate',event=>event.preventDefault());
    current.scale=scale;
    border.on('close',event=>{if(session===current){event.preventDefault();stop().catch(()=>{});}});
    border.webContents.on('render-process-gone',()=>{if(session===current)fail('录屏进程中断，请重新录制。').catch(()=>{});});
    await border.loadFile(path.join(__dirname,'recording-border.html'));
    if(session!==current||!['adjusting','preparing','recording'].includes(current.phase)||border.isDestroyed()){clearBorders(current);return;}
    border.showInactive();publish(current.phase==='adjusting'?'调整边框后，点击开始录制。':'正在开始录制…');
  }
  function reset(current,message){if(session!==current)return;clearBorders(current);if(live())window.setContentProtection(false);session=null;clearTimeout(current.timeout);clearTimeout(current.startTimeout);for(const hidden of current.hidden)if(!hidden.isDestroyed())hidden.showInactive();current.resolve();publish(message);onMessage(message,!!current.saved);}
  async function fail(message){const current=session;if(!current)return;current.phase='saving';try{await current.native?.abort();await current.queue.catch(()=>{});await current.writer?.abort();}finally{reset(current,String(message||'录屏失败，请重试。').slice(0,200));onSound('error');}}
  async function show(){if(disposed||!live())return;onShow();}
  async function begin(selected,options,{test=false}={}){
    const current=session;if(!current||!live())return;
    current.selected=selected;current.phase='preparing';publish('正在开始录制…');
    try{
      current.writer=await collection.beginRecording('录屏-'+new Date().toISOString().replace(/[:.]/g,'-')+'.'+options.format);
      if(session!==current||disposed){await current.writer.abort();return;}
      if(current.phase==='stopping'){await current.writer.abort();reset(current,'已取消录屏。');return;}
      const scale=screen.getDisplayNearestPoint({x:Math.round(selected.bounds.x+selected.bounds.width/2),y:Math.round(selected.bounds.y+selected.bounds.height/2)}).scaleFactor||1;
      current.config={...selected,...options,captureSize:{width:Math.round(selected.bounds.width*scale),height:Math.round(selected.bounds.height*scale)},test:smoke&&test};
      if(!current.borders.length)await showBorders(current,selected);
      if(session!==current||!live())return;
      if(current.phase==='stopping'){await current.writer.abort();reset(current,'已取消录屏。');return;}
      for(const appWindow of getWindows())if(appWindow&&appWindow!==window&&!appWindow.isDestroyed()&&appWindow.isVisible()){appWindow.hide();current.hidden.push(appWindow);}
      window.setContentProtection(true);window.showInactive();
      if(nativeRecorder?.available&&!current.config.test){
        current.nativePending=true;
        const native=await nativeRecorder.start(current.config,{
          onStarted:info=>{if(session!==current)return;current.encoding=info;methods['recording-started']();},
          onChunk:bytes=>{if(session!==current)return;current.queue=current.queue.then(()=>current.writer.append(bytes));return current.queue;},
          onFinish:()=>{if(session===current)return methods['recording-finish']();},
          onError:message=>{if(session===current)return fail(message);}
        });
        current.nativePending=false;
        if(session!==current){await native.abort();return;}
        current.native=native;
        if(current.phase==='stopping')native.stop();
        return;
      }
      window.webContents.send('recording-start',current.config);
      current.startTimeout=setTimeout(()=>{if(session===current&&current.phase==='preparing')fail('屏幕采集启动超时，请重试。').catch(()=>{});},15000);
    }catch(error){await fail(error.message);}
  }
  async function select(options,testSelection=null){
    options=validateOptions(options);if(disposed||session||screenshot.isActive())throw Error('已有截图或录屏正在进行。');
    remember(options);const current={options,phase:'choosing',hidden:[],borders:[],queue:Promise.resolve(),saved:false};current.done=new Promise(resolve=>current.resolve=resolve);session=current;publish('请框选录屏范围…');
    try{
      if(smoke&&testSelection){if(testSelection.adjust)await adjustSelection(testSelection);else await begin(testSelection,options,{test:testSelection.test!==false});return true;}
      const started=await screenshot.start({onSelect:selected=>adjustSelection(selected),onCancel:()=>reset(current,'已取消录屏。')});
      if(!started)reset(current,'录屏框选未启动。');return started;
    }catch(error){await fail(error.message);throw error;}
  }
  async function adjustSelection(selected){const current=session;if(!current||!live())return;current.selected={...selected,rect:geometry.clamp(selected.rect,selected.bounds)};current.phase='adjusting';await showBorders(current,current.selected);}
  function stop(){
    const current=session;if(!current)return Promise.resolve();
    if(current.phase==='adjusting'){reset(current,'已取消录屏。');return current.done;}
    if(current.phase==='choosing'){screenshot.cancel();reset(current,'已取消录屏。');return current.done;}
    if(['preparing','recording'].includes(current.phase)){current.phase='stopping';publish('正在保存视频…');if(current.native)current.native.stop();else if(!current.nativePending&&live())window.webContents.send('recording-stop');current.timeout=setTimeout(()=>{if(session===current)fail('录屏保存超时，请重新录制。').catch(()=>{});},20000);}
    return current.done;
  }
  const methods={
    'recording-state':()=>state(),
    'recording-start':()=>{if(session?.phase!=='adjusting')throw Error('录屏已结束。');return begin(session.selected,session.options,{test:smoke&&session.selected.test!==false});},
    'recording-adjust':rect=>{if(session?.phase!=='adjusting')throw Error('录制中不能调整范围。');session.selected.rect=geometry.clamp(rect,session.selected.bounds);publish('调整边框后，点击开始录制。');return session.selected.rect;},
    'recording-select':()=>select({format:'mp4',fps:getSettings().recordFrameRate}),
    'recording-stop':stop,
    'recording-started':()=>{if(!session||!['preparing','stopping'].includes(session.phase))throw Error('录屏已结束。');clearTimeout(session.startTimeout);if(session.phase!=='stopping'){session.phase='recording';session.startedAt=Date.now();publish('录制中 · 停止后自动收藏');onSound('capture-start');}return true;},
    'recording-chunk':async bytes=>{const current=session;if(!current?.writer||!['recording','stopping'].includes(current.phase)||!(bytes instanceof ArrayBuffer)||!bytes.byteLength||bytes.byteLength>8*1024*1024)throw Error('录屏数据无效。');current.queue=current.queue.then(()=>current.writer.append(new Uint8Array(bytes)));await current.queue;return true;},
    'recording-finish':async()=>{const current=session;if(!current?.writer||!['recording','stopping'].includes(current.phase))throw Error('录屏已结束。');current.phase='saving';clearTimeout(current.startTimeout);await current.queue;try{await commit(current.writer);current.saved=true;reset(current,'录屏已收藏。');onSound('capture-done');return true;}catch(error){await fail(error.message);throw error;}},
    'recording-error':message=>fail(message)
  };
  for(const [name,fn] of Object.entries(methods))ipcMain.handle(name,async(event,value)=>{const borderSender=session?.borders.some(border=>!border.isDestroyed()&&event.sender===border.webContents);const borderAllowed=['recording-state','recording-start','recording-adjust','recording-stop'].includes(name);if(disposed||!live()||(event.sender!==window.webContents&&!(borderSender&&borderAllowed)))return {ok:false,error:'录屏窗口已关闭。'};try{if(isBlocked()&&['recording-start','recording-adjust','recording-select','recording-stop'].includes(name))throw Error('露娜暂时不理你，请稍后再试。');return {ok:true,value:await fn(value)};}catch(error){return {ok:false,error:error.message||'录屏失败'};}});
  const borderHit=(event,hit)=>{const border=session?.borders.find(value=>!value.isDestroyed()&&value.webContents===event.sender);if(border&&!disposed)border.setIgnoreMouseEvents(hit!==true,{forward:true});};
  ipcMain.on?.('recording-border-hit',borderHit);
  const interrupted=()=>{stop().catch(()=>{});};
  for(const name of ['suspend','lock-screen'])powerMonitor.on(name,interrupted);
  const changed=(_event,_display,metrics)=>{if(!metrics||metrics.some(name=>['bounds','scaleFactor','rotation'].includes(name)))interrupted();};
  screen.on('display-removed',interrupted);screen.on('display-metrics-changed',changed);
  const canCapture=contents=>!!session&&['preparing','recording'].includes(session.phase)&&live()&&contents===window.webContents&&contents.getURL()===pathToFileURL(path.join(__dirname,'index.html')).href;
  async function dispose(){await stop();disposed=true;ipcMain.removeListener?.('recording-border-hit',borderHit);for(const name of Object.keys(methods))ipcMain.removeHandler(name);for(const name of ['suspend','lock-screen'])powerMonitor.removeListener(name,interrupted);screen.removeListener('display-removed',interrupted);screen.removeListener('display-metrics-changed',changed);if(live())window.setContentProtection(false);}
  return {show,stop,dispose,canCapture,isActive:()=>!!session,getWindow:()=>window,getBorders:()=>[...(session?.borders||[])],select};
}
module.exports={createRecording};
