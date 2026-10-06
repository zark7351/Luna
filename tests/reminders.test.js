const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {createReminders}=require('../reminders');
async function fixture(t){const directory=await fs.mkdtemp(path.join(os.tmpdir(),'luna-reminder-test-'));t.after(()=>fs.rm(directory,{recursive:true,force:true}));return directory;}
test('气泡完成只接受已到点的提醒，连续点击与延后竞争不会完成尚未到点的事项',async t=>{
  const directory=await fixture(t);let now=1000;const reminders=await createReminders(directory,{now:()=>now});
  const item=await reminders.save({title:'喝水',dueAt:2000});
  await assert.rejects(reminders.action({id:item.id,action:'complete'},true),/尚未到时间/);now=2000;await reminders.check();
  await reminders.action({id:item.id,action:'snooze'});await assert.rejects(reminders.action({id:item.id,action:'complete'},true),/已处理/);
  now=reminders.list()[0].dueAt;await reminders.check();
  const results=await Promise.allSettled([reminders.action({id:item.id,action:'complete'},true),reminders.action({id:item.id,action:'complete'},true)]);
  assert.deepEqual(results.map(result=>result.status),['fulfilled','rejected']);assert.equal(reminders.list()[0].status,'done');
  const reloaded=await createReminders(directory);assert.equal(reloaded.list()[0].status,'done');
});
test('倒计时按主进程保存时刻计算截止时间，重启继续倒数，到点一次触发',async t=>{
  const directory=await fixture(t);let now=1000,calls=0;
  let reminders=await createReminders(directory,{now:()=>now});
  const item=await reminders.save({title:'倒计时',mode:'countdown',durationSeconds:15,dueAt:999999});
  assert.equal(item.dueAt,16000);assert.equal(item.mode,'countdown');
  reminders.stop();now=10000;reminders=await createReminders(directory,{now:()=>now,onDue:()=>calls++});await reminders.check();assert.equal(calls,0);assert.equal(reminders.list()[0].dueAt,16000);
  now=16000;await reminders.check();await reminders.check();assert.equal(calls,1);
  await reminders.action({id:item.id,action:'snooze'});assert.equal(reminders.list()[0].dueAt,316000);
});
test('倒计时拒绝零/负/小数/超过七天/非法模式，编辑可切换定时或重启倒计时',async t=>{
  const directory=await fixture(t);const reminders=await createReminders(directory,{now:()=>1000});
  for(const durationSeconds of [0,-1,1.2,NaN,604801,'5'])await assert.rejects(reminders.save({title:'a',mode:'countdown',durationSeconds}));
  await assert.rejects(reminders.save({title:'a',mode:'unknown',dueAt:10000}));
  const item=await reminders.save({title:'a',mode:'countdown',durationSeconds:1});
  await reminders.save({id:item.id,title:'a',dueAt:5000});assert.equal(reminders.list()[0].mode,'scheduled');assert.equal(Object.hasOwn(reminders.list()[0],'durationSeconds'),false);
  await reminders.save({id:item.id,title:'a',mode:'countdown',durationSeconds:60});assert.equal(reminders.list()[0].dueAt,61000);
});
test('到点事件只触发一次，同一时刻多条提醒合并，重新检查不重复触发',async t=>{
  const directory=await fixture(t);let now=1000,calls=[];
  const reminders=await createReminders(directory,{now:()=>now,onDue:items=>calls.push(items)});
  await Promise.all(['喝水','开会'].map(title=>reminders.save({title,dueAt:2000})));
  assert.equal((await reminders.check()).length,0);now=2000;
  await Promise.all([reminders.check(),reminders.check()]);assert.equal(calls.length,1);assert.equal(calls[0].length,2);
  const reopened=await createReminders(directory,{now:()=>now,onDue:()=>assert.fail('already fired')});await reopened.check();assert.ok(reopened.list().every(item=>item.status==='fired'));
});
test('关闭或休眠错过的提醒恢复后触发；延后五分钟和完成会持久保存',async t=>{
  const directory=await fixture(t);let now=1000;
  let reminders=await createReminders(directory,{now:()=>now});const item=await reminders.save({title:'  休息  ',dueAt:3000});reminders.stop();now=9000;
  reminders=await createReminders(directory,{now:()=>now});await reminders.check();assert.equal(reminders.list()[0].status,'fired');
  await reminders.action({id:item.id,action:'snooze'});assert.equal(reminders.list()[0].dueAt,309000);assert.equal(reminders.list()[0].status,'pending');
  await reminders.action({id:item.id,action:'complete'});now=400000;assert.equal((await reminders.check()).length,0);
  reminders=await createReminders(directory);assert.equal(reminders.list()[0].status,'done');await reminders.action({id:item.id,action:'delete'});assert.equal(reminders.list().length,0);
});
test('编辑重新计时，非法时间/内容/操作不改变数据，返回记录不能修改内部状态',async t=>{
  const directory=await fixture(t);const reminders=await createReminders(directory,{now:()=>1000});const item=await reminders.save({title:'原提醒',dueAt:2000});
  await reminders.save({id:item.id,title:'新提醒',dueAt:5000});assert.equal(reminders.list().length,1);assert.equal(reminders.list()[0].dueAt,5000);
  for(const input of [{title:'',dueAt:5000},{title:'a',dueAt:1000},{title:'a',dueAt:NaN},{id:'missing',title:'a',dueAt:5000}])await assert.rejects(reminders.save(input));
  await assert.rejects(reminders.action({id:item.id,action:'snooze'}));await assert.rejects(reminders.action({id:item.id,action:'unknown'}));
  reminders.list()[0].status='done';assert.equal(reminders.list()[0].status,'pending');
});
test('磁盘提交失败不会吞掉到点提醒，停止后不再触发回调',async t=>{
  const directory=await fixture(t);let now=1000,calls=0;const reminders=await createReminders(directory,{now:()=>now,onDue:()=>calls++});await reminders.save({title:'安全提交',dueAt:2000});now=3000;
  await fs.mkdir(path.join(directory,'reminders.json.tmp'));await assert.rejects(reminders.check());assert.equal(reminders.list()[0].status,'pending');assert.equal(calls,0);
  await fs.rmdir(path.join(directory,'reminders.json.tmp'));await reminders.check();assert.equal(calls,1);
  reminders.stop();await reminders.check();assert.equal(calls,1);
});
