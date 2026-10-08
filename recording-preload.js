const {contextBridge,ipcRenderer}=require('electron');
const allowed=new Set(['recording-state','recording-start','recording-select','recording-started','recording-chunk','recording-finish','recording-error','recording-stop']);
contextBridge.exposeInMainWorld('recorder',{
  call:(name,payload)=>{if(!allowed.has(name))throw Error('未知录屏操作');return ipcRenderer.invoke(name,payload);},
  onStart:callback=>ipcRenderer.on('recording-start',(_event,value)=>callback(value)),
  onStop:callback=>ipcRenderer.on('recording-stop',()=>callback()),
  onStatus:callback=>ipcRenderer.on('recording-status',(_event,value)=>callback(value))
});
