const {contextBridge,ipcRenderer,webUtils}=require('electron');
const allowed=new Set(['pure-layout','anger-mode','anger-hide','panel-focus','recording-show','storage-choose','ui-sound','reminder-show','reminder-list','reminder-complete','screenshot-start','screenshot-shortcut','state','settings','appearance','system-stats','weather-current','weather-search','weather-locate','edge-expand','hide','quit','library-show','library-expand','library-window','collection-list','collection-add-text','collection-add-clipboard','library-add-files','collection-open','collection-delete','collection-copy','collection-reveal','collection-file-icon','collection-link-preview']);
contextBridge.exposeInMainWorld('pet',{
  call:(channel,payload)=>{if(!allowed.has(channel))throw Error('Unknown operation');return ipcRenderer.invoke(channel,payload);},
  saveDroppedFiles:async files=>{
    if(files.length>10)return Promise.resolve({ok:false,error:'每次最多拖入 10 个文件。'});
    const entries=[];
    for(const file of files){
      const filePath=webUtils.getPathForFile(file);
      if(filePath)entries.push({path:filePath});
      else{
        if(file.size>64*1024*1024)return {ok:false,error:'临时文件超过 64 MB，请先保存到电脑，再拖入收藏。'};
        entries.push({name:file.name,bytes:await file.arrayBuffer()});
      }
    }
    return ipcRenderer.invoke('collection-add-drop',entries);
  },
  onLibraryView:callback=>ipcRenderer.on('library-view',(_event,value)=>callback(value)),
  onCollectionUpdated:callback=>ipcRenderer.on('collection-updated',()=>callback()),
  onScreenshotShortcutChanged:callback=>ipcRenderer.on('screenshot-shortcut-changed',(_event,value)=>callback(value)),
  onScreenshotMessage:callback=>ipcRenderer.on('screenshot-message',(_event,value)=>callback(value)),
  onPanel:callback=>ipcRenderer.on('panel-open',(_event,name)=>callback(name)),
  onSound:callback=>ipcRenderer.on('sound-play',(_event,name)=>callback(name)),
  onEffect:callback=>ipcRenderer.on('ui-effect',(_event,name)=>callback(name)),
  onReminderCount:callback=>ipcRenderer.on('reminder-count',(_event,value)=>callback(value)),
  onReminderDue:callback=>ipcRenderer.on('reminder-due',(_event,value)=>callback(value)),
  onIdleChanged:callback=>ipcRenderer.on('idle-changed',(_event,value)=>callback(value===true)),
  onAbsence:callback=>ipcRenderer.on('pet-absence',(_event,value)=>callback(value)),
  onSettingsChanged:callback=>ipcRenderer.on('settings-changed',(_event,value)=>callback(value)),
  onEdgeDockChanged:callback=>ipcRenderer.on('edge-dock-changed',(_event,value)=>callback(value)),
  edgeHold:(value,expanded=false)=>ipcRenderer.send('edge-hold',value===true,expanded===true),
  passthrough:value=>ipcRenderer.send('passthrough',!!value),
  drag:value=>ipcRenderer.send('drag',!!value)
});


const recordingAllowed=new Set(['recording-state','recording-start','recording-select','recording-started','recording-chunk','recording-finish','recording-error','recording-stop']);
contextBridge.exposeInMainWorld('recorder',{
  call:(name,payload)=>{if(!recordingAllowed.has(name))throw Error('未知录屏操作');return ipcRenderer.invoke(name,payload);},
  onStart:callback=>ipcRenderer.on('recording-start',(_event,value)=>callback(value)),
  onStop:callback=>ipcRenderer.on('recording-stop',()=>callback()),
  onStatus:callback=>ipcRenderer.on('recording-status',(_event,value)=>callback(value))
});


const reminderAllowed=new Set(['ui-sound','reminder-list','reminder-save','reminder-action']);
contextBridge.exposeInMainWorld('reminder',{
  call:(channel,payload)=>{if(!reminderAllowed.has(channel))throw Error('Unknown operation');return ipcRenderer.invoke(channel,payload);},
  onUpdated:callback=>ipcRenderer.on('reminders-updated',()=>callback())
});
