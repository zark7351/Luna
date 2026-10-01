const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {createCollection,classifyText}=require('../collection');

test('classify links and plain text without treating unsafe schemes as links',()=>{
  assert.equal(classifyText('https://example.com/a').kind,'link');
  assert.equal(classifyText('一段文字').kind,'text');
  assert.equal(classifyText('javascript:alert(1)').kind,'text');
  assert.throws(()=>classifyText('  '));
});

test('local references persist without copying and removing them preserves original files',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'luna-collection-test-'));
  try{
    const source=path.join(root,'photo.png');
    await fs.writeFile(source,Buffer.from('fake-image'));
    const collection=await createCollection(path.join(root,'user-data'));
    const file=await collection.addFile(source);
    const text=await collection.addText('记住这段文字');
    assert.equal(file.kind,'file');
    assert.equal(collection.list()[0].id,text.id);
    assert.equal(collection.openTarget(file.id).target,source);
    assert.equal(file.storage,'reference');
    assert.equal('referencePath' in collection.list().find(item=>item.id===file.id),false);
    assert.deepEqual(await fs.readdir(path.join(root,'user-data','collection-files')),[]);
    const reopened=await createCollection(path.join(root,'user-data'));
    assert.equal(reopened.list().length,2);
    await reopened.remove(file.id);
    assert.equal((await fs.readFile(source)).toString(),'fake-image');
    assert.equal(reopened.list().length,1);
  }finally{await fs.rm(root,{recursive:true,force:true});}
});

test('legacy copied files remain usable and deletion only removes their copies',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'luna-legacy-copy-test-'));
  try{
    const collection=await createCollection(root);
    const file=await collection.addBytes('old.png',new Uint8Array([1,2,3]));
    const indexPath=path.join(root,'collection.json');
    const index=JSON.parse(await fs.readFile(indexPath,'utf8'));delete index[0].storage;
    await fs.writeFile(indexPath,JSON.stringify(index));
    const reopened=await createCollection(root);
    assert.equal(reopened.list()[0].storage,'copy');
    const copy=reopened.openTarget(file.id).target;
    assert.deepEqual([...await fs.readFile(copy)],[1,2,3]);
    await reopened.remove(file.id);
    await assert.rejects(fs.stat(copy),{code:'ENOENT'});
  }finally{await fs.rm(root,{recursive:true,force:true});}
});

test('virtual image and video files keep their bytes and extension',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'luna-virtual-test-'));
  try{
    const collection=await createCollection(root);
    for(const name of ['图片.png','视频.mp4']){
      const bytes=new Uint8Array([0,1,2,255]);
      const item=await collection.addBytes(name,bytes);
      const copy=collection.openTarget(item.id).target;
      assert.equal(item.kind,'file');
      assert.equal(item.title,name);
      assert.equal(path.extname(copy),path.extname(name));
      assert.deepEqual(await fs.readFile(copy),Buffer.from(bytes));
    }
    await assert.rejects(collection.addBytes('empty.mp4',new Uint8Array()));
    await assert.rejects(collection.addBytes('too-big.mp4',new Uint8Array(64*1024*1024+1)));
  }finally{await fs.rm(root,{recursive:true,force:true});}
});
