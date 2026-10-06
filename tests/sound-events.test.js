const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {names,operationSound,createSoundDispatch}=require('../sound-events');
test('声音白名单、总开关与已销毁窗口均阻止发送；连点节流不吞掉正常下一次操作',()=>{
  let enabled=true,live=true,time=0;const sent=[];
  const play=createSoundDispatch({enabled:()=>enabled,live:()=>live,now:()=>time,send:name=>sent.push(name)});
  assert.equal(play('../../other'),false);assert.equal(play('click'),true);assert.equal(play('click'),false);
  time=90;assert.equal(play('click'),true);enabled=false;assert.equal(play('save'),false);
  enabled=true;live=false;assert.equal(play('save'),false);live=true;assert.equal(play('save'),true);
  assert.deepEqual(sent,['click','click','save']);
});
test('收藏成功、部分成功、全部失败与用户取消分别反馈，后台查询保持安静',()=>{
  for(const channel of ['library-add-files','collection-add-files','collection-add-drop']){
    assert.equal(operationSound(channel,{saved:1,failed:['failed']}),'collect');
    assert.equal(operationSound(channel,{saved:0,failed:['failed']}),'error');
    assert.equal(operationSound(channel,{saved:0,failed:[]}),null);
  }
  assert.equal(operationSound('collection-add-clipboard',{kind:'files',saved:0,failed:['missing']}),'error');
  assert.equal(operationSound('collection-add-clipboard',{kind:'files',saved:1,failed:['missing']}),'collect');
  assert.equal(operationSound('collection-add-clipboard',{kind:'text'}),'collect');
  assert.equal(operationSound('collection-copy',null,null,true),'error');
  assert.equal(operationSound('weather-current',null,null,true),null);
  assert.equal(operationSound('reminder-list',[]),null);
  assert.equal(operationSound('reminder-action',true,{action:'snooze'}),'snooze');
  assert.equal(operationSound('reminder-action',true,{action:'complete'}),'complete');
});
test('全部本地音效为完整短 PCM 文件，无截幅且 UI 音效内容各不相同',()=>{
  const hashes=new Set();
  for(const name of names){
    const bytes=fs.readFileSync(path.join(__dirname,'..','assets',name==='reminder'?'reminder.wav':'sounds/'+name+'.wav'));
    assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.readUInt32LE(4)+8,bytes.length);
    assert.equal(bytes.readUInt16LE(20),1);assert.equal(bytes.readUInt16LE(22),1);assert.equal(bytes.readUInt16LE(34),16);
    if(name==='reminder')continue;
    const seconds=bytes.readUInt32LE(40)/bytes.readUInt32LE(28);assert.ok(seconds>=.08&&seconds<=.35);
    for(let i=44;i<bytes.length;i+=2)assert.ok(Math.abs(bytes.readInt16LE(i))<32767);
    hashes.add(require('node:crypto').createHash('sha256').update(bytes).digest('hex'));
  }
  assert.equal(hashes.size,names.length-1);
});
