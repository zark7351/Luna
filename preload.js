const {contextBridge,ipcRenderer,webUtils}=require('electron');
const allowed=new Set(['state','settings','hide','quit','library-show','collection-list','collection-add-text','collection-add-clipboard','library-add-files','collection-open','collection-delete','collection-copy']);
contextBridge.exposeInMainWorld('pet',{
  call:(channel,payload)=>{if(!allowed.has(channel))throw Error('Unknown operation');return ipcRenderer.invoke(channel,payload);},
  saveDroppedFiles:files=>{
    if(files.length>10)return Promise.resolve({ok:false,error:'每次最多拖入 10 个文件。'});
    const paths=Array.from(files).map(file=>webUtils.getPathForFile(file)).filter(Boolean);
    if(!paths.length)return Promise.resolve({ok:true,value:{saved:0,failed:[],unavailable:true}});
    return ipcRenderer.invoke('collection-add-files',paths);
  },
  onCollectionUpdated:callback=>ipcRenderer.on('collection-updated',()=>callback()),
  passthrough:value=>ipcRenderer.send('passthrough',!!value),
  drag:value=>ipcRenderer.send('drag',!!value)
});
