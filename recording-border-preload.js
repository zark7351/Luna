const {contextBridge,ipcRenderer}=require('electron');
const allowed=new Set(['recording-state','recording-start','recording-stop','recording-adjust']);
contextBridge.exposeInMainWorld('recordingFrame',{call:(name,value)=>{if(!allowed.has(name))throw Error('Unknown recording operation');return ipcRenderer.invoke(name,value);},onStatus:callback=>ipcRenderer.on('recording-status',(_event,value)=>callback(value)),hit:value=>ipcRenderer.send('recording-border-hit',value===true)});
