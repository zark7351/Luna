const path=require('node:path');

// Selection coordinates are CSS/DIP units; use the returned image size, not
// an assumed DPI multiplier (desktopCapturer may resize its thumbnail).
function cropBounds(rect,bounds,size){
  if(!rect || !['x','y','width','height'].every(key=>Number.isFinite(rect[key])))throw Error('截图区域无效。');
  if(rect.width<2 || rect.height<2)throw Error('请框选稍大一些的区域。');
  const left=Math.max(0,Math.min(bounds.width,rect.x));
  const top=Math.max(0,Math.min(bounds.height,rect.y));
  const right=Math.max(left,Math.min(bounds.width,rect.x+rect.width));
  const bottom=Math.max(top,Math.min(bounds.height,rect.y+rect.height));
  const x=Math.floor(left*size.width/bounds.width),y=Math.floor(top*size.height/bounds.height);
  const width=Math.min(size.width-x,Math.ceil(right*size.width/bounds.width)-x);
  const height=Math.min(size.height-y,Math.ceil(bottom*size.height/bounds.height)-y);
  if(width<1 || height<1)throw Error('截图区域不在屏幕内。');
  return {x,y,width,height};
}

function createScreenshot({BrowserWindow,ipcMain,screen,getSources,getWindows,save,onMessage}){
  let session=null,disposed=false;
  const entry=sender=>session?.entries.find(item=>!item.window.isDestroyed() && item.window.webContents===sender);
  function close(current){
    if(session!==current)return;
    session=null;
    for(const item of current.entries)if(!item.window.isDestroyed())item.window.destroy();
    for(const window of current.hidden)if(!window.isDestroyed())window.showInactive();
    current.entries.length=0;
  }
  ipcMain.handle('screenshot-state',event=>{
    const item=entry(event.sender);
    return item?{image:item.image.toDataURL(),width:item.bounds.width,height:item.bounds.height}:null;
  });
  ipcMain.handle('screenshot-cancel',event=>{if(entry(event.sender))close(session);return true;});
  ipcMain.handle('screenshot-select',async(event,rect)=>{
    const item=entry(event.sender),current=session;
    if(!item || current.saving)return {ok:false,error:'截图已结束。'};
    try{
      const png=item.image.crop(cropBounds(rect,item.bounds,item.image.getSize())).toPNG();
      current.saving=true;close(current);
      await save(png);
      if(!disposed)onMessage('截图已收藏。',true);
      return {ok:true};
    }catch(error){
      if(session===current)close(current);
      if(!disposed)onMessage(error.message || '截图失败，请重试。',false);
      return {ok:false,error:error.message};
    }
  });
  const changed=()=>{if(session){close(session);onMessage('屏幕配置已改变，请重新截图。',false);}};
  for(const name of ['display-added','display-removed','display-metrics-changed'])screen.on(name,changed);
  async function start(){
    if(disposed)return false;
    if(session)return false;
    const current={entries:[],hidden:[],saving:false};session=current;
    try{
      const displays=screen.getAllDisplays();
      for(const window of getWindows())if(window && !window.isDestroyed() && window.isVisible()){current.hidden.push(window);window.hide();}
      await new Promise(resolve=>setTimeout(resolve,160));
      if(session!==current)return false;
      const sources=await getSources({types:['screen'],thumbnailSize:{width:Math.max(...displays.map(d=>Math.ceil(d.size.width*d.scaleFactor))),height:Math.max(...displays.map(d=>Math.ceil(d.size.height*d.scaleFactor)))}});
      if(session!==current)return false;
      for(const display of displays){
        const source=sources.find(source=>source.display_id===String(display.id));
        if(!source || source.thumbnail.isEmpty())throw Error('无法获取屏幕图像，请重试。');
        const window=new BrowserWindow({...display.bounds,fullscreen:true,frame:false,resizable:false,show:false,skipTaskbar:true,backgroundColor:'#191521',webPreferences:{preload:path.join(__dirname,'screenshot-preload.js'),contextIsolation:true,sandbox:true,nodeIntegration:false}});
        const item={window,image:source.thumbnail,bounds:display.bounds};current.entries.push(item);
        window.setAlwaysOnTop(true,'screen-saver');
        window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
        window.webContents.on('will-navigate',event=>event.preventDefault());
        window.on('closed',()=>{if(session===current)close(current);});
      }
      await Promise.all(current.entries.map(item=>item.window.loadFile(path.join(__dirname,'screenshot.html'))));
      if(session!==current)return false;
      for(const item of current.entries)if(!item.window.isDestroyed())item.window.showInactive();
      const cursor=screen.getCursorScreenPoint(),display=screen.getDisplayNearestPoint(cursor);
      const focused=current.entries.find(item=>item.bounds.x===display.bounds.x && item.bounds.y===display.bounds.y) || current.entries[0];
      if(focused && !focused.window.isDestroyed())focused.window.focus();
      return true;
    }catch(error){if(session===current)close(current);if(!disposed)onMessage(error.message || '截图启动失败。',false);return false;}
  }
  function stop(){disposed=true;if(session)close(session);for(const name of ['display-added','display-removed','display-metrics-changed'])screen.removeListener(name,changed);for(const name of ['screenshot-state','screenshot-select','screenshot-cancel'])ipcMain.removeHandler(name);}
  return {start,stop,isActive:()=>!!session,getWindows:()=>session?.entries.map(item=>item.window)||[]};
}
module.exports={cropBounds,createScreenshot};
