const {contextBridge,ipcRenderer,webUtils}=require('electron');
const allowed=new Set(['state','settings','hide','quit','library-show','collection-list','collection-add-text','collection-add-clipboard','library-add-files','collection-open','collection-delete','collection-copy','collection-reveal','collection-file-icon','collection-link-preview']);
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
  onCollectionUpdated:callback=>ipcRenderer.on('collection-updated',()=>callback()),
  passthrough:value=>ipcRenderer.send('passthrough',!!value),
  drag:value=>ipcRenderer.send('drag',!!value)
});
