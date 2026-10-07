const test=require('node:test'),assert=require('node:assert/strict');
const {validate,defaults,regionAt,createReactions,actions}=require('../body-shortcuts');
test('五个部位可独立映射九种功能，非法值回退且不共享可变配置',()=>{assert.equal(Object.keys(actions).length,9);for(const action of Object.keys(actions)){const mapped=validate(Object.fromEntries(Object.keys(defaults).map(region=>[region,action])));assert.ok(Object.values(mapped).every(value=>value===action));}assert.deepEqual(validate({head:'../../command',extra:'quit'}),defaults);assert.deepEqual(validate(null),defaults);});
test('源图坐标区分头胸、两侧手臂、交叉手、腿与脚；非法点无作用',()=>{assert.equal(regionAt(260,130),'head');assert.equal(regionAt(270,290,270),'chest');assert.equal(regionAt(170,290,270),'arms');assert.equal(regionAt(270,460,270),'arms');assert.equal(regionAt(260,740),'legs');assert.equal(regionAt(260,945),'feet');assert.equal(regionAt(-1,200),null);assert.equal(regionAt(260,NaN),null);});
test('生气仅在五秒内连续三次胸部点击后，以 1% 独立概率触发',()=>{
  let time=1000,rolls=0,value=.5;const reactions=createReactions({now:()=>time,random:()=>{rolls++;return value;}});
  assert.equal(reactions.click('head').expression,'happy');assert.equal(reactions.click('chest').expression,'shy');assert.equal(reactions.click('arms').annoyed,false);assert.equal(reactions.click('chest').expression,'shy');assert.equal(rolls,0);
  assert.equal(reactions.click('chest').expression,'shy');assert.equal(rolls,1);value=.009999;assert.equal(reactions.click('chest').expression,'angry');assert.equal(rolls,2);
  value=.01;assert.equal(reactions.click('chest').expression,'shy');assert.equal(rolls,3);value=0;assert.equal(reactions.click('legs').expression,'smile');assert.equal(rolls,3);
  time+=5001;assert.equal(reactions.click('chest').expression,'shy');assert.equal(rolls,3);reactions.reset();assert.equal(reactions.click('chest').annoyed,false);assert.equal(rolls,3);
});
