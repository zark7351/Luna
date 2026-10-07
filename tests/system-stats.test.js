const {test}=require('node:test');
const assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const {createSystemStats,gpuUsage}=require('../system-stats');
const engine='luid_0x00000000_0x0002339B_phys_0_eng_0';
test('GPU 按物理引擎汇总各进程后取最忙引擎，缺失与零占用区分',()=>{
  assert.equal(gpuUsage([{engine,usage:20},{engine,usage:30},{engine:engine.replace('eng_0','eng_1'),usage:40}]),50);
  assert.equal(gpuUsage([{engine,usage:80},{engine,usage:80}]),100);
  assert.equal(gpuUsage([{engine,usage:0}]),0);
  for(const input of [null,[],[{engine:'invalid',usage:20}],[{engine,usage:'50'}],[{engine,usage:NaN}],[{engine,usage:-2}]])assert.equal(gpuUsage(input),null);
});
function fixture(){let tick=0,clock=1000,free=400,cpus=[{times:{user:40,idle:60}}],killed=0,cancelled=false;const worker=new EventEmitter();worker.stdout=new EventEmitter();worker.stdout.setEncoding=()=>{};worker.kill=()=>{killed++;};const stats=createSystemStats({system:{cpus:()=>cpus,totalmem:()=>1000,freemem:()=>free},startWorker:()=>worker,now:()=>clock,schedule:fn=>{tick=fn;return 1;},cancel:()=>{cancelled=true;}});return {stats,worker,tick:()=>tick(),time:value=>{clock=value;},cpus:value=>{cpus=value;},free:value=>{free=value;},killed:()=>killed,cancelled:()=>cancelled};}
test('CPU 使用采样差值，内存使用真实总量；首帧/计数重置/非法内存不伪装零',()=>{
  const f=fixture();assert.deepEqual(f.stats.read(),{cpu:null,memory:60,gpu:null,pending:{cpu:true,gpu:true}});
  f.cpus([{times:{user:90,idle:110}}]);f.tick();assert.equal(f.stats.read().cpu,50);assert.equal(f.stats.read().pending.cpu,false);
  f.cpus([{times:{user:0,idle:0}}]);f.free(2000);f.tick();assert.equal(f.stats.read().cpu,null);assert.equal(f.stats.read().memory,null);f.stats.stop();
});
test('GPU 流支持拆包、坏数据和过期读数，停止后晚到消息不更新且清理子进程',()=>{
  const f=fixture(),line=JSON.stringify({engines:[{engine,usage:37}]})+'\n';f.worker.stdout.emit('data',line.slice(0,20));assert.equal(f.stats.read().gpu,null);assert.equal(f.stats.read().pending.gpu,true);f.worker.stdout.emit('data',line.slice(20));assert.equal(f.stats.read().gpu,37);assert.equal(f.stats.read().pending.gpu,false);
  f.time(17000);assert.equal(f.stats.read().gpu,null);f.worker.stdout.emit('data','not-json\n');assert.equal(f.stats.read().gpu,null);
  f.stats.stop();f.worker.stdout.emit('data',line);f.worker.emit('exit');f.tick();assert.deepEqual(f.stats.read(),{cpu:null,memory:null,gpu:null,pending:{cpu:false,gpu:false}});assert.equal(f.killed(),1);assert.equal(f.cancelled(),true);
});
test('挂起的 GPU 查询超时后终止并延迟重试，超长结果也安全清理',()=>{
  const f=fixture();f.time(23000);f.tick();assert.equal(f.killed(),1);assert.equal(f.stats.read().gpu,null);assert.equal(f.stats.read().pending.gpu,false);f.stats.stop();
  const other=fixture();other.worker.stdout.emit('data','x'.repeat(262145));assert.equal(other.killed(),1);assert.equal(other.stats.read().gpu,null);other.stats.stop();
});
test('GPU 报告不可用或启动失败后结束等待，不把失败长期显示为读取中',()=>{
  const f=fixture();f.worker.stdout.emit('data','{"engines":null}\n');assert.equal(f.stats.read().pending.gpu,false);assert.equal(f.stats.read().gpu,null);f.stats.stop();
  const stats=createSystemStats({system:{cpus:()=>[],totalmem:()=>0,freemem:()=>0},startWorker:()=>null,schedule:()=>1,cancel:()=>{}});
  assert.deepEqual(stats.read(),{cpu:null,memory:null,gpu:null,pending:{cpu:false,gpu:false}});stats.stop();
});
