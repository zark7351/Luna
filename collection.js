const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const MAX_TEXT = 20000;
const MAX_FILE_BYTES = 1024 * 1024 * 1024;

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
      if (item.kind === 'file' && (typeof item.storedName !== 'string' || !/^[a-f0-9-]{36}(\.[a-z0-9]{1,10})?$/.test(item.storedName))) throw Error('收藏索引包含无效文件名。');
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
  function list() { return items.slice().reverse().map(({storedName,...item})=>item); }
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
    if (stat.size > MAX_FILE_BYTES) throw Error('单个文件暂限 1 GB。');
    const ext = path.extname(source);
    const storedName = randomUUID() + (/^\.[a-zA-Z0-9]{1,10}$/.test(ext) ? ext.toLowerCase() : '');
    const destination = path.join(filesDir, storedName);
    await fs.copyFile(source, destination);
    const item = { id: randomUUID(), kind: 'file', title: path.basename(source).slice(0, 180), storedName, size: stat.size, createdAt: new Date().toISOString() };
    try { await persist([...items, item]); } catch (error) { await fs.rm(destination, { force: true }); throw error; }
    return item;
  }
  function find(id) { return items.find(item => item.id === id); }
  async function remove(id) {
    const item = find(id);
    if (!item) throw Error('收藏项不存在。');
    await persist(items.filter(entry => entry.id !== id));
    if (item.kind === 'file') await fs.rm(path.join(filesDir, item.storedName), { force: true });
    return true;
  }
  function openTarget(id) {
    const item = find(id);
    if (!item) throw Error('收藏项不存在。');
    if (item.kind === 'file') return { kind: 'file', target: path.join(filesDir, item.storedName) };
    if (item.kind === 'link') return { kind: 'link', target: item.content };
    return { kind: 'text', target: item.content };
  }
  return { list, addText, addFile, remove, openTarget };
}

module.exports = { createCollection, classifyText, MAX_FILE_BYTES };
