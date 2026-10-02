const {test}=require('node:test');
const assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const {startIdleMonitor}=require('../idle');
function fixture(){
  const powerMonitor=new EventEmitter(),messages=[];let seconds=0,destroyed=false,tick,cancelled=false;
  const window={isDestroyed:()=>destroyed,webContents:{send:(channel,value)=>messages.push([channel,value])}};
  const monitor=startIdleMonitor({powerMonitor,getWindow:()=>window,readIdleSeconds:()=>seconds,schedule:(fn,delay)=>{assert.equal(delay,2000);tick=fn;return 42;},cancel:id=>{assert.equal(id,42);cancelled=true;}});
  return {monitor,powerMonitor,messages,tick:()=>tick(),idle:n=>seconds=n,destroy:()=>destroyed=true,cancelled:()=>cancelled};
}
test('system idle threshold sleeps at five minutes and wakes on activity without repeated events',()=>{
  const f=fixture();f.monitor.check(true);f.idle(299);f.tick();assert.deepEqual(f.messages,[['idle-changed',false]]);
  f.idle(300);f.tick();f.tick();assert.equal(f.monitor.isSleeping(),true);
  f.idle(0);f.tick();assert.deepEqual(f.messages,[['idle-changed',false],['idle-changed',true],['idle-changed',false]]);
  f.monitor.stop();assert.equal(f.cancelled(),true);
});
test('lock and suspend retain rest until both conditions clear',()=>{
  const f=fixture();f.powerMonitor.emit('lock-screen');f.powerMonitor.emit('suspend');f.powerMonitor.emit('resume');
  assert.equal(f.monitor.isSleeping(),true);f.powerMonitor.emit('unlock-screen');assert.equal(f.monitor.isSleeping(),false);
  assert.deepEqual(f.messages,[['idle-changed',true],['idle-changed',false]]);f.monitor.stop();
});
test('destroyed windows and stopped monitors never receive late events and listeners are cleaned up',()=>{
  const f=fixture();f.destroy();f.idle(500);f.tick();f.powerMonitor.emit('lock-screen');assert.deepEqual(f.messages,[]);
  f.monitor.stop();f.monitor.stop();f.monitor.check(true);f.tick();f.powerMonitor.emit('unlock-screen');
  assert.deepEqual(f.messages,[]);assert.equal(f.powerMonitor.eventNames().length,0);assert.equal(f.cancelled(),true);
});
test('invalid idle readings do not change rest state',()=>{
  const f=fixture();for(const value of [NaN,Infinity,-1]){f.idle(value);f.monitor.check(true);}assert.deepEqual(f.messages,[]);f.monitor.stop();
});
