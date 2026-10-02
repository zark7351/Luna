const {contextBridge,ipcRenderer}=require('electron');
const allowed=new Set(['reminder-list','reminder-save','reminder-action']);
contextBridge.exposeInMainWorld('reminder',{
  call:(channel,payload)=>{if(!allowed.has(channel))throw Error('Unknown operation');return ipcRenderer.invoke(channel,payload);},
  onUpdated:callback=>ipcRenderer.on('reminders-updated',()=>callback())
});
