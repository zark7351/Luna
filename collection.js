const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const {mediaType}=require('./media');

const MAX_TEXT = 20000;

function classifyText(value) {
  const content = String(value || '').trim();
  if (!content || content.length > MAX_TEXT) throw Error('文字或链接需在 1–20000 字以内。');
  let kind = 'text';
  try {
    const url = new URL(content);
    if (['http:', 'https:'].includes(url.protocol)) kind = 'link';
  } catch {}
  return { kind, content, title: kind === 'link' ? content.slice(0, 120) : content.split(/\r?\n/)[0].slice(0, 80) };
}

async function createCollection(root) {
  const indexPath = path.join(root, 'collection.json');
  const filesDir = path.join(root, 'collection-files');
  await fs.mkdir(filesDir, { recursive: true });
  let items = [];
  try {
    const loaded = JSON.parse(await fs.readFile(indexPath, 'utf8'));
    if (!Array.isArray(loaded)) throw Error('收藏索引格式错误。');
    for (const item of loaded) {
      if (!item || typeof item !== 'object' || typeof item.id !== 'string' || !['file','link','text'].includes(item.kind) || typeof item.title !== 'string') throw Error('收藏索引格式错误。');
      if(item.kind==='file'){
        if(item.storage==='reference'){
          if(typeof item.referencePath!=='string' || !path.isAbsolute(item.referencePath) || item.storedName)throw Error('收藏索引包含无效文件路径。');
        }else if((item.storage!==undefined && item.storage!=='copy') || typeof item.storedName!=='string' || !/^[a-f0-9-]{36}(\.[a-z0-9]{1,10})?$/.test(item.storedName))throw Error('收藏索引包含无效文件名。');
      }
      if (item.kind !== 'file' && typeof item.content !== 'string') throw Error('收藏索引格式错误。');
    }
    items = loaded;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  async function persist(next) {
    const temp = `${indexPath}.tmp`;
    await fs.writeFile(temp, JSON.stringify(next, null, 2), 'utf8');
    await fs.rename(temp, indexPath);
    items = next;
  }
  function list() { return items.slice().reverse().map(({storedName,referencePath,...item})=>{
    if(item.kind==='file')item.storage=item.storage==='reference'?'reference':'copy';
    const type=item.kind==='file'?mediaType(referencePath || storedName):'';
    return type?{...item,mediaType:type,previewUrl:'luna-media://collection/'+encodeURIComponent(item.id)}:item;
  }); }
  async function addText(value) {
    const parsed = classifyText(value);
    const item = { id: randomUUID(), ...parsed, createdAt: new Date().toISOString() };
    await persist([...items, item]);
    return item;
  }
  async function addFile(source) {
    if (typeof source !== 'string' || !path.isAbsolute(source)) throw Error('只能收藏本机文件。');
    const stat = await fs.stat(source);
    if (!stat.isFile()) throw Error('暂不支持收藏文件夹。');
    const item = { id: randomUUID(), kind: 'file', storage:'reference', title: path.basename(source).slice(0, 180), referencePath:path.resolve(source), size: stat.size, createdAt: new Date().toISOString() };
    await persist([...items, item]);
    return item;
  }
  async function addBytes(name,bytes) {
    if(typeof name!=='string' || !name.trim() || !(bytes instanceof Uint8Array) || !bytes.byteLength || bytes.byteLength>64*1024*1024)throw Error('临时文件无效或超过 64 MB，请先保存到电脑再拖入。');
    const title=path.win32.basename(path.basename(name)).slice(0,180);
    const ext=path.extname(title);
    const storedName=randomUUID()+(/^\.[a-zA-Z0-9]{1,10}$/.test(ext)?ext.toLowerCase():'');
    const destination=path.join(filesDir,storedName);
    await fs.writeFile(destination,bytes);
    const item={id:randomUUID(),kind:'file',storage:'copy',title,storedName,size:bytes.byteLength,createdAt:new Date().toISOString()};
    try{await persist([...items,item]);}catch(error){await fs.rm(destination,{force:true});throw error;}
    return item;
  }
  function find(id) { return items.find(item => item.id === id); }
  async function setLinkPreview(id,preview){
    const item=find(id);if(!item || item.kind!=='link')return false;
    await persist(items.map(entry=>entry.id===id?{...entry,linkPreview:preview}:entry));return true;
  }
  async function remove(id) {
    const item = find(id);
    if (!item) throw Error('收藏项不存在。');
    await persist(items.filter(entry => entry.id !== id));
    if (item.kind === 'file' && item.storage!=='reference') await fs.rm(path.join(filesDir, item.storedName), { force: true });
    return true;
  }
  function openTarget(id) {
    const item = find(id);
    if (!item) throw Error('收藏项不存在。');
    if (item.kind === 'file') return { kind: 'file', storage:item.storage==='reference'?'reference':'copy', target: item.storage==='reference'?item.referencePath:path.join(filesDir, item.storedName) };
    if (item.kind === 'link') return { kind: 'link', target: item.content };
    return { kind: 'text', target: item.content };
  }
  function previewFile(id){
    const item=find(id);
    const type=item && item.kind==='file'?mediaType(item.storage==='reference'?item.referencePath:item.storedName):'';
    return type?{path:item.storage==='reference'?item.referencePath:path.join(filesDir,item.storedName),type}:null;
  }
  return { list, addText, addFile, addBytes, remove, openTarget, previewFile, setLinkPreview };
}

module.exports = { createCollection, classifyText };
