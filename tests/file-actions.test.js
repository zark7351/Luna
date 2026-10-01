const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {copyFileToClipboard,requireFile}=require('../file-actions');

test('file clipboard helper passes Unicode and shell characters as data, not commands',{skip:process.platform!=='win32'},async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'luna-copy-test-'));
  try{
    const file=path.join(root,"图片 $() ' &.png");await fs.writeFile(file,'sample');
    let called=false;
    await copyFileToClipboard(file,async(executable,args,options)=>{
      called=true;assert.ok(executable.endsWith('powershell.exe'));assert.ok(args.includes('-STA'));
      const script=Buffer.from(args[args.indexOf('-EncodedCommand')+1],'base64').toString('utf16le');
      assert.ok(script.includes('SetFileDropList'));assert.ok(!script.includes(file));
      assert.equal(Buffer.from(options.env.LUNA_CLIPBOARD_FILE,'base64').toString('utf8'),file);
      assert.equal(options.windowsHide,true);assert.equal(options.shell,undefined);
    });
    assert.ok(called);
    await assert.rejects(copyFileToClipboard(file,async()=>{throw Error('busy');}),/复制失败/);
    await fs.rm(file);
    await assert.rejects(copyFileToClipboard(file,async()=>{assert.fail('missing file must not start helper');}),/移动、删除/);
    await assert.rejects(requireFile(root),/移动、删除/);
  }finally{await fs.rm(root,{recursive:true,force:true});}
});
