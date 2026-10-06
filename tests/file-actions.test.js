const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {copyFileToClipboard,readClipboardFiles,requireFile}=require('../file-actions');

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
test('剪贴板文件列表支持多个 Unicode 路径、空列表，拒绝异常/过量列表',{skip:process.platform!=='win32'},async()=>{
  const files=[path.join(os.tmpdir(),"视频 $() ' &.mp4"),path.join(os.tmpdir(),'图片.png')];
  assert.deepEqual(await readClipboardFiles(async(executable,args,options)=>{
    assert.ok(executable.endsWith('powershell.exe'));assert.ok(args.includes('-STA'));assert.equal(options.windowsHide,true);assert.equal(options.shell,undefined);
    const script=Buffer.from(args[args.indexOf('-EncodedCommand')+1],'base64').toString('utf16le');assert.ok(script.includes('GetFileDropList'));assert.ok(!script.includes(files[0]));return {stdout:JSON.stringify(files)};
  }),files);
  assert.deepEqual(await readClipboardFiles(async()=>({stdout:'[]'})),[]);
  for(const stdout of ['null','"file"','["relative.mp4"]','bad JSON'])await assert.rejects(readClipboardFiles(async()=>({stdout})),/无法读取/);
  await assert.rejects(readClipboardFiles(async()=>({stdout:JSON.stringify(Array(11).fill(files[0]))})),/最多收藏 10/);
  await assert.rejects(readClipboardFiles(async()=>{throw Error('busy');}),/无法读取/);
});
