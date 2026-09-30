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

test('copy a file into local collection, persist entries, and delete the copy',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'luna-collection-test-'));
  try{
    const source=path.join(root,'photo.png');
    await fs.writeFile(source,Buffer.from('fake-image'));
    const collection=await createCollection(path.join(root,'user-data'));
    const file=await collection.addFile(source);
    const text=await collection.addText('记住这段文字');
    assert.equal(file.kind,'file');
    assert.equal(collection.list()[0].id,text.id);
    const copy=collection.openTarget(file.id).target;
    assert.notEqual(copy,source);
    assert.equal((await fs.readFile(copy)).toString(),'fake-image');
    const reopened=await createCollection(path.join(root,'user-data'));
    assert.equal(reopened.list().length,2);
    await reopened.remove(file.id);
    await assert.rejects(fs.stat(copy),{code:'ENOENT'});
    assert.equal(reopened.list().length,1);
  }finally{await fs.rm(root,{recursive:true,force:true});}
});
