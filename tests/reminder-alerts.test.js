const test=require('node:test'),assert=require('node:assert/strict');
const {createReminderAlerts,REMINDER_SOUND_INTERVAL}=require('../reminder-alerts');
test('提醒按间隔重复响，静音/锁屏/录屏暂停，完成后立即清理并切到下一条',()=>{
  let due=[],paused=false,enabled=true,time=0,sounds=0;const sent=[];
  const alerts=createReminderAlerts({getDue:()=>due,isPaused:()=>paused,send:value=>sent.push(value),play:()=>{if(!enabled)return false;sounds++;return true;},now:()=>time});
  alerts.tick();assert.deepEqual(sent,[null]);due=[{id:'one',title:'喝水'},{id:'two',title:'休息'}];alerts.tick();assert.equal(sounds,1);assert.equal(sent.at(-1).remaining,2);
  time=REMINDER_SOUND_INTERVAL-1;alerts.tick();assert.equal(sounds,1);time++;alerts.tick();assert.equal(sounds,2);alerts.tick();assert.equal(sounds,2);
  paused=true;time+=REMINDER_SOUND_INTERVAL;alerts.tick();assert.equal(sounds,2);paused=false;enabled=false;alerts.tick();assert.equal(sounds,2);enabled=true;alerts.tick();assert.equal(sounds,3);
  due.shift();alerts.tick();assert.equal(sent.at(-1).id,'two');assert.equal(sounds,4);due=[];alerts.tick();assert.equal(sent.at(-1),null);time+=REMINDER_SOUND_INTERVAL;alerts.tick();assert.equal(sounds,4);
  alerts.stop();due=[{id:'late',title:'late'}];alerts.tick();assert.equal(sounds,4);
});
test('尚未就绪/已销毁的窗口不记录已发送状态，恢复可见后重送提醒',()=>{
  let live=false,sends=0,sounds=0;
  const alerts=createReminderAlerts({getDue:()=>[{id:'one',title:'喝水'}],isPaused:()=>false,send:()=>{if(!live)return false;sends++;},play:()=>{if(!live)return false;sounds++;},now:()=>0});
  alerts.tick();assert.equal(sends,0);assert.equal(sounds,0);live=true;alerts.tick();alerts.tick();assert.equal(sends,1);assert.equal(sounds,1);
});
