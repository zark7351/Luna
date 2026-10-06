const test=require('node:test'),assert=require('node:assert/strict');
const {createPetFeedback}=require('../pet-feedback');
test('普通消息自动消失、替换时旧回调失效，提醒优先且持续直到清除',()=>{
  const rendered=[],timers=[];let cancellations=0;
  const feedback=createPetFeedback({render:value=>rendered.push(value),schedule:(fn,delay)=>{timers.push({fn,delay});return timers.length;},cancel:()=>cancellations++});
  assert.equal(rendered.at(-1).message,'');feedback.show('第一条');assert.equal(timers[0].delay,4500);
  feedback.show('第二条');timers[0].fn();assert.equal(rendered.at(-1).message,'第二条');timers[1].fn();assert.equal(rendered.at(-1).message,'');
  feedback.show('普通反馈');feedback.updateReminder({id:'one',title:'喝水',remaining:2});assert.equal(feedback.show('换装完成'),false);timers[2].fn();
  assert.equal(rendered.at(-1).reminder.id,'one');assert.match(rendered.at(-1).message,/喝水.*还有 1 条/);
  feedback.updateReminder({id:'two',title:'休息',remaining:1});assert.equal(rendered.at(-1).reminder.id,'two');
  feedback.updateReminder(null);assert.equal(rendered.at(-1).message,'');feedback.show('完成啦');feedback.updateReminder(null);assert.equal(rendered.at(-1).message,'完成啦');
  const count=rendered.length;feedback.stop();timers.at(-1).fn();feedback.show('late');feedback.updateReminder({id:'late',title:'late'});assert.equal(rendered.length,count);assert.ok(cancellations>0);
});
