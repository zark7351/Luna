const {test}=require('node:test');
const assert=require('node:assert/strict');
const {defaults,validate,migrateState,WINDOW_WIDTH,WINDOW_HEIGHT}=require('../core');

test('old chat and AI data are discarded while local settings remain',()=>{
  const state=migrateState({settings:{name:'星露娜',nickname:'小星',top:false,online:true,baseUrl:'https://example.com/v1'},key:'old-key',history:[{role:'user',content:'old chat'}],position:[100,200]});
  assert.deepEqual(state,{settings:{name:'星露娜',nickname:'小星',top:false,screenshotShortcut:true,soundEnabled:true,hair:'original',outfit:'original',weatherLocation:null,saveDirectory:'',recordFrameRate:60,recordFormat:'mp4'},layoutVersion:3,position:[447,110]});
  assert.equal(Object.hasOwn(state,'history'),false);
  assert.equal(Object.hasOwn(state,'key'),false);
});

test('new position and settings stay stable on later launches',()=>{
  const state=migrateState({settings:defaults,layoutVersion:2,position:[447,200]});
  assert.deepEqual(state.position,[447,110]);
  assert.deepEqual(migrateState(state),state);
  assert.deepEqual(validate({}),defaults);
  assert.equal(WINDOW_WIDTH,280);
  assert.equal(WINDOW_HEIGHT,640);
});

test('截图快捷键默认开启，关闭设置经过校验和重启迁移后保持',()=>{assert.equal(validate({}).screenshotShortcut,true);const state=migrateState({settings:{screenshotShortcut:false}});assert.equal(state.settings.screenshotShortcut,false);assert.equal(migrateState(JSON.parse(JSON.stringify(state))).settings.screenshotShortcut,false);});

test('总声音开关默认开启，关闭后重启保持',()=>{assert.equal(validate({}).soundEnabled,true);const state=migrateState({settings:{soundEnabled:false}});assert.equal(state.settings.soundEnabled,false);assert.equal(migrateState(JSON.parse(JSON.stringify(state))).settings.soundEnabled,false);});

test('发型和服装独立保存，旧状态与非法值回退原版',()=>{for(const hair of ['original','straight'])for(const outfit of ['original','jk']){const state=migrateState({settings:{hair,outfit}});assert.equal(state.settings.hair,hair);assert.equal(state.settings.outfit,outfit);assert.deepEqual(migrateState(JSON.parse(JSON.stringify(state))),state);}const invalid=validate({hair:'../../bad',outfit:null});assert.equal(invalid.hair,'original');assert.equal(invalid.outfit,'original');});
