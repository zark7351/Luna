const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {extractMetadata,safeUrl,fetchLinkPreview}=require('../link-preview');
const {createCollection}=require('../collection');
const resolve=async()=>[{address:'1.1.1.1'}];

test('web metadata handles attribute order, entities, fallback titles and relative covers',()=>{
  const metadata=extractMetadata(`<head><title>备用标题</title><script>"<meta property='og:title' content='假标题'>"</script><meta content="露娜 &amp; 收藏" property="og:title"><meta name=description content="中文简介"><meta content="/cover.png" property="og:image"></head>`, 'https://example.com/page');
  assert.equal(metadata.title,'露娜 & 收藏');assert.equal(metadata.description,'中文简介');assert.equal(metadata.imageUrl,'https://example.com/cover.png');
  assert.equal(extractMetadata('<title>普通标题</title>','https://example.com').title,'普通标题');
  assert.equal(extractMetadata('<meta property="og:image" content="file:///secret">','https://example.com').imageUrl,'');
});

test('previews reject local addresses and redirected private hosts, and omit credentials',async()=>{
  for(const url of ['file:///secret','http://localhost/a','http://127.0.0.1/a','http://192.168.1.1/','http://[::1]/','https://user:pass@example.com'])await assert.rejects(safeUrl(url,resolve));
  await assert.rejects(safeUrl('https://example.com',async()=>[{address:'10.0.0.1'}]));
  let calls=0;
  await assert.rejects(fetchLinkPreview('https://example.com',{resolve,fetch:async(_url,options)=>{
    calls++;assert.equal(options.credentials,'omit');assert.equal(options.redirect,'manual');return new Response(null,{status:302,headers:{location:'http://127.0.0.1/private'}});
  }}));assert.equal(calls,1);
});

test('metadata and covers are bounded, cached locally and never restore removed links',async()=>{
  const preview=await fetchLinkPreview('https://example.com',{resolve,thumbnail:()=> 'data:image/jpeg;base64,fixture',fetch:async url=>url.endsWith('cover.png')?new Response(new Uint8Array([1,2]),{headers:{'content-type':'image/png'}}):new Response('<title>测试网页</title><meta property="og:image" content="/cover.png">',{headers:{'content-type':'text/html; charset=utf-8'}})});
  assert.equal(preview.title,'测试网页');assert.equal(preview.image,'data:image/jpeg;base64,fixture');
  await assert.rejects(fetchLinkPreview('https://example.com',{resolve,fetch:async()=>new Response('body',{headers:{'content-type':'text/html','content-length':String(3*1024*1024)}})}),/过大/);
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'luna-link-cache-'));
  try{
    const collection=await createCollection(root);const link=await collection.addText('https://example.com');
    await collection.setLinkPreview(link.id,preview);
    assert.equal((await createCollection(root)).list()[0].linkPreview.title,'测试网页');
    await collection.remove(link.id);assert.equal(await collection.setLinkPreview(link.id,preview),false);assert.equal(collection.list().length,0);
  }finally{await fs.rm(root,{recursive:true,force:true});}
});
