const {lookup}=require('node:dns/promises');
const {isIP}=require('node:net');

function decode(value){return String(value||'').replace(/&(#x[\da-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi,(_,key)=>{
  if(key[0]==='#'){const n=key[1].toLowerCase()==='x'?parseInt(key.slice(2),16):Number(key.slice(1));return n>0&&n<=0x10ffff?String.fromCodePoint(n):'';}
  return {amp:'&',quot:'"',apos:"'",lt:'<',gt:'>',nbsp:' '}[key.toLowerCase()];
});}
const clean=value=>decode(String(value||'').replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim();
function extractMetadata(html,url){
  const head=html.split(/<body\b/i)[0].replace(/<!--[\s\S]*?-->|<script\b[^>]*>[\s\S]*?<\/script\s*>|<style\b[^>]*>[\s\S]*?<\/style\s*>/gi,'');
  const meta={};
  for(const tag of head.match(/<meta\b(?:[^<>"']|"[^"]*"|'[^']*')*>/gi)||[]){
    const attrs={};for(const m of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g))attrs[m[1].toLowerCase()]=decode(m[2]??m[3]??m[4]);
    const key=(attrs.property||attrs.name||'').toLowerCase();if(key && !(key in meta))meta[key]=attrs.content||'';
  }
  const title=clean(meta['og:title']||meta['twitter:title']||head.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]||new URL(url).hostname).slice(0,200);
  const description=clean(meta['og:description']||meta['twitter:description']||meta.description).slice(0,400);
  let imageUrl='';try{const image=new URL(meta['og:image:secure_url']||meta['og:image']||meta['twitter:image'],url);if(['http:','https:'].includes(image.protocol) && (meta['og:image:secure_url']||meta['og:image']||meta['twitter:image']))imageUrl=image.href;}catch{}
  return {title,description,imageUrl,site:new URL(url).hostname};
}
function publicAddress(address){
  const a=address.toLowerCase();
  if(isIP(a)===4){const [x,y]=a.split('.').map(Number);return !(x===0||x===10||x===127||x>=224||(x===169&&y===254)||(x===172&&y>=16&&y<=31)||(x===192&&y===168)||(x===100&&y>=64&&y<=127)||(x===198&&(y===18||y===19)));}
  return isIP(a)===6 && /^[23]/.test(a);
}
async function safeUrl(value,resolve=lookup){
  const url=new URL(value);const host=url.hostname.replace(/^\[|\]$/g,'').toLowerCase();
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password||host==='localhost'||host.endsWith('.localhost')||host.endsWith('.local')||(!isIP(host)&&!host.includes('.')))throw Error('仅支持公开网页预览。');
  if(isIP(host)){if(!publicAddress(host))throw Error('不支持本机或内网地址预览。');}
  else{
    let timer;try{const addresses=await Promise.race([resolve(host,{all:true}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('域名解析超时。')),3000);})]);if(!addresses.length||addresses.some(item=>!publicAddress(item.address)))throw Error('不支持本机或内网地址预览。');}finally{clearTimeout(timer);}
  }
  return url;
}
async function readLimited(response,limit){
  if(Number(response.headers.get('content-length'))>limit){await response.body?.cancel();throw Error('网页预览内容过大。');}
  const reader=response.body?.getReader();if(!reader)return Buffer.alloc(0);
  const chunks=[];let size=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw Error('网页预览内容过大。');}chunks.push(Buffer.from(value));}}finally{reader.releaseLock();}
  return Buffer.concat(chunks);
}
async function fetchLinkPreview(value,{fetch,resolve=lookup,thumbnail=()=>''}){
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),12000);
  async function request(target,limit){
    for(let hop=0;hop<4;hop++){
      const url=await safeUrl(target,resolve);controller.signal.throwIfAborted();
      const response=await fetch(url.href,{signal:controller.signal,redirect:'manual',credentials:'omit',headers:{Accept:'text/html,image/png,image/jpeg,image/webp;q=0.8'}});
      if([301,302,303,307,308].includes(response.status)){
        const location=response.headers.get('location');await response.body?.cancel();if(!location)throw Error('网页跳转无效。');target=new URL(location,url).href;continue;
      }
      if(!response.ok){await response.body?.cancel();throw Error('网站暂时无法提供预览。');}
      return {url:url.href,type:response.headers.get('content-type')||'',bytes:await readLimited(response,limit)};
    }
    throw Error('网页跳转过多。');
  }
  try{
    const page=await request(value,2*1024*1024);
    if(!/text\/html|application\/xhtml\+xml/i.test(page.type))throw Error('这个链接不是网页。');
    const charset=page.type.match(/charset\s*=\s*["']?([\w-]+)/i)?.[1] || page.bytes.subarray(0,4096).toString().match(/charset\s*=\s*["']?([\w-]+)/i)?.[1] || 'utf-8';
    let html;try{html=new TextDecoder(charset).decode(page.bytes);}catch{html=page.bytes.toString('utf8');}
    const {imageUrl,...metadata}=extractMetadata(html,page.url);let image='';
    if(imageUrl){try{const cover=await request(imageUrl,1024*1024);if(/^image\/(png|jpeg|webp|gif)\b/i.test(cover.type))image=thumbnail(cover.bytes);}catch{}}
    return {...metadata,image,fetchedAt:new Date().toISOString(),status:'ready'};
  }finally{clearTimeout(timer);}
}
module.exports={extractMetadata,safeUrl,fetchLinkPreview};
