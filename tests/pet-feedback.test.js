const test=require('node:test'),assert=require('node:assert/strict');
const {createPetFeedback}=require('../pet-feedback');
test('动态消息更新保持原到期回调，关闭后和提醒时不能重新显示',()=>{let expire;const rendered=[];const f=createPetFeedback({render:value=>rendered.push(value),schedule:fn=>{expire=fn;return 1;},cancel:()=>{}});f.show('CPU 1%',5000);const original=expire;f.update('CPU 2%');assert.equal(expire,original);expire();assert.equal(f.getMessage(),'');assert.equal(f.update('迟到'),false);f.updateReminder({id:'due',title:'喝水'});assert.equal(f.update('CPU 3%'),false);});
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
test('普通对话点击切换下一条，最后一条关闭；替换、过期和旧回调不带出残留对话',()=>{
  const rendered=[],timers=[];const feedback=createPetFeedback({render:value=>rendered.push(value),schedule:fn=>{timers.push(fn);return timers.length;},cancel:()=>{}});
  feedback.show(['第一条','第二条']);assert.equal(rendered.at(-1).hasNext,true);feedback.advance();assert.equal(rendered.at(-1).message,'第二条');assert.equal(rendered.at(-1).hasNext,false);
  timers[0]();assert.equal(rendered.at(-1).message,'第二条');feedback.advance();assert.equal(rendered.at(-1).message,'');timers[1]();assert.equal(rendered.at(-1).message,'');
  feedback.show(['旧内容','不应恢复']);feedback.show('新内容');feedback.advance();assert.equal(rendered.at(-1).message,'');assert.equal(rendered.at(-1).hasNext,false);
  feedback.show(['会过期','剩余内容']);timers.at(-1)();feedback.advance();assert.equal(rendered.at(-1).message,'');
});
test('普通对话点击不能清除提醒，提醒结束也不会恢复先前的下一条；停止后点击无效',()=>{
  const rendered=[];const feedback=createPetFeedback({render:value=>rendered.push(value),schedule:()=>1,cancel:()=>{}});
  feedback.show(['普通内容','下一条'],0);feedback.updateReminder({id:'due',title:'喝水',remaining:1});assert.equal(feedback.advance(),false);assert.equal(rendered.at(-1).hasNext,false);assert.equal(feedback.getReminder().id,'due');
  feedback.updateReminder(null);feedback.advance();assert.equal(rendered.at(-1).message,'');const count=rendered.length;feedback.stop();assert.equal(feedback.advance(),false);assert.equal(rendered.length,count);
});
