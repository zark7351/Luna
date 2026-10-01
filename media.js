const fs=require('node:fs/promises');
const {Readable}=require('node:stream');
const path=require('node:path');

const types={'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.webp':'image/webp','.bmp':'image/bmp','.avif':'image/avif','.mp4':'video/mp4','.m4v':'video/mp4','.mov':'video/quicktime','.webm':'video/webm','.ogv':'video/ogg'};
function mediaType(name){return types[path.extname(name).toLowerCase()] || '';}

// Only collection IDs are accepted; renderer content never chooses a disk path.
async function mediaResponse(request,collection){
  let file;
  try{
    const url=new URL(request.url);
    if(url.hostname!=='collection' || !/^\/[a-f0-9-]{36}$/.test(url.pathname) || !['GET','HEAD'].includes(request.method))return new Response(null,{status:404});
    file=collection.previewFile(url.pathname.slice(1));
    if(!file)return new Response(null,{status:404});
  }catch{return new Response(null,{status:404});}
  let handle;
  try{
    handle=await fs.open(file.path,'r');
    const stat=await handle.stat();
    if(!stat.isFile() || !stat.size){await handle.close();return new Response(null,{status:404});}
    let start=0,end=stat.size-1,status=200;
    const headers={'Content-Type':file.type,'Accept-Ranges':'bytes','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
    const range=request.headers.get('range');
    if(range){
      const match=/^bytes=(\d*)-(\d*)$/.exec(range);
      if(match && (match[1] || match[2])){
        if(!match[1])start=Math.max(0,stat.size-Number(match[2]));
        else{start=Number(match[1]);if(match[2])end=Math.min(end,Number(match[2]));}
      }
      if(!match || (!match[1]&&!match[2]) || !Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start>end || start>=stat.size){
        await handle.close();return new Response(null,{status:416,headers:{'Content-Range':`bytes */${stat.size}`}});
      }
      status=206;headers['Content-Range']=`bytes ${start}-${end}/${stat.size}`;
    }
    headers['Content-Length']=String(end-start+1);
    if(request.method==='HEAD'){await handle.close();return new Response(null,{status,headers});}
    return new Response(Readable.toWeb(handle.createReadStream({start,end,autoClose:true})),{status,headers});
  }catch{if(handle)await handle.close().catch(()=>{});return new Response(null,{status:404});}
}
module.exports={mediaType,mediaResponse};
