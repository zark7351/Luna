const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('capture',{
  state:()=>ipcRenderer.invoke('screenshot-state'),
  select:rect=>ipcRenderer.invoke('screenshot-select',rect),
  cancel:()=>ipcRenderer.invoke('screenshot-cancel')
});
