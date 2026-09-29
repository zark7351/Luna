const {test}=require('node:test');
const assert=require('node:assert/strict');
const {defaults,validate,offline}=require('../core');

test('legacy AI settings are discarded while local preferences remain',()=>{
  const settings=validate({name:'星露娜',nickname:'小星',top:false,online:true,baseUrl:'https://example.com/v1',model:'old-model',memory:'旧偏好'});
  assert.deepEqual(settings,{name:'星露娜',nickname:'小星',top:false});
  assert.deepEqual(validate({}),defaults);
});

test('local responses are clearly preset and reflect saved names',()=>{
  const settings=validate({name:'露娜',nickname:'小星'});
  assert.match(offline('你好',settings),/小星，.*露娜/);
  assert.match(offline('你是谁',settings),/预设台词/);
  assert.match(offline('随便聊聊',settings),/固定台词/);
});
