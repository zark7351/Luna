const {contextBridge,ipcRenderer}=require('electron');
const allowed=new Set(['state','settings','hide','quit']);
contextBridge.exposeInMainWorld('pet',{
  call:(channel,payload)=>{if(!allowed.has(channel))throw Error('Unknown operation');return ipcRenderer.invoke(channel,payload);},
  passthrough:value=>ipcRenderer.send('passthrough',!!value),
  drag:value=>ipcRenderer.send('drag',!!value)
});
