const test=require('node:test'),assert=require('node:assert/strict');
const {validate,migrateState}=require('../core');
const {translate}=require('../i18n');
const {dateText,statsText,weatherText}=require('../shortcut-bubbles');
test('旧设置默认中文，语言经校验与重启迁移保持，自定义名字不翻译',()=>{
  assert.equal(validate({}).language,'zh-CN');
  assert.equal(validate({language:'invalid'}).language,'zh-CN');
  const settings=validate({language:'en',name:'露娜',nickname:'设置'});
  assert.deepEqual(migrateState({settings}).settings,settings);
  assert.equal(settings.name,'露娜');assert.equal(settings.nickname,'设置');
  assert.equal(translate('<img src=x>','en'),'<img src=x>');
});
test('英文日期与系统/天气反馈区分等待、零值和离线，中文保持原行为',()=>{
  const t=text=>translate(text,'en'),date=new Date(2026,9,8,10,1);
  assert.match(dateText(date,'en'),/Thursday.*October 8, 2026/);
  assert.match(dateText(date),/星期四/);
  assert.match(statsText({cpu:0,memory:35,pending:{gpu:true}},t),/CPU 0%.*Memory 35%\nGPU Loading/);
  assert.equal(weatherText({status:'unset'},t),'Choose a weather city in Settings first.');
  assert.match(weatherText({status:'stale',location:{name:'上海'},reading:{label:'晴',temperature:24}},t),/^上海 · Clear 24°C\nLast weather · Offline$/);
});
