const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {createCollection}=require('../collection');
const {mediaResponse}=require('../media');

test('preview only serves collection media, including ranges and deleted files',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'luna-preview-test-'));
  try{
    const collection=await createCollection(root);
    const item=await collection.addBytes('视频.MP4',new Uint8Array([0,1,2,3,4,5]));
    const publicItem=collection.list()[0];
    assert.equal(publicItem.mediaType,'video/mp4');
    assert.equal('storedName' in publicItem,false);
    const request=range=>new Request(publicItem.previewUrl,{headers:range?{Range:range}:{}});
    let response=await mediaResponse(request('bytes=1-3'),collection);
    assert.equal(response.status,206);
    assert.equal(response.headers.get('Content-Range'),'bytes 1-3/6');
    assert.deepEqual([...new Uint8Array(await response.arrayBuffer())],[1,2,3]);
    response=await mediaResponse(request('bytes=-2'),collection);
    assert.deepEqual([...new Uint8Array(await response.arrayBuffer())],[4,5]);
    assert.equal((await mediaResponse(request('bytes=6-'),collection)).status,416);
    assert.equal((await mediaResponse(request('bytes=0-1,3-4'),collection)).status,416);
    response=await mediaResponse(new Request(publicItem.previewUrl,{method:'HEAD'}),collection);
    assert.equal(response.headers.get('Content-Length'),'6');
    const html=await collection.addBytes('page.html',new Uint8Array([1]));
    assert.equal((await mediaResponse(new Request('luna-media://collection/'+html.id),collection)).status,404);
    assert.equal((await mediaResponse(new Request('luna-media://collection/../../state.json'),collection)).status,404);
    const reopened=await createCollection(root);
    assert.equal(reopened.list().find(entry=>entry.id===item.id).previewUrl,publicItem.previewUrl);
    await collection.remove(item.id);
    assert.equal((await mediaResponse(request(),collection)).status,404);
  }finally{await fs.rm(root,{recursive:true,force:true});}
});

test('reference preview reads original updates and handles moved or deleted files',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'luna-reference-media-test-'));
  try{
    const source=path.join(root,'原图.png');await fs.writeFile(source,Buffer.from([1,2,3]));
    const collection=await createCollection(path.join(root,'user-data'));
    const item=await collection.addFile(source);
    const url=collection.list()[0].previewUrl;
    await fs.writeFile(source,Buffer.from([4,5]));
    const response=await mediaResponse(new Request(url),collection);
    assert.deepEqual([...new Uint8Array(await response.arrayBuffer())],[4,5]);
    const moved=path.join(root,'移动后的图片.png');await fs.rename(source,moved);
    assert.equal((await mediaResponse(new Request(url),collection)).status,404);
    await collection.remove(item.id);
    assert.deepEqual([...await fs.readFile(moved)],[4,5]);
  }finally{await fs.rm(root,{recursive:true,force:true});}
});
