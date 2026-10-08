const {test}=require('node:test');
const assert=require('node:assert/strict');
const {defaults,validate,migrateState,WINDOW_WIDTH,WINDOW_HEIGHT}=require('../core');

test('old chat and AI data are discarded while local settings remain',()=>{
  const state=migrateState({settings:{name:'星露娜',nickname:'小星',top:false,online:true,baseUrl:'https://example.com/v1'},key:'old-key',history:[{role:'user',content:'old chat'}],position:[100,200]});
  assert.deepEqual(state,{settings:{...defaults,name:'星露娜',nickname:'小星',top:false},layoutVersion:3,position:[447,110]});
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

test('旧信息条开关清除，五部位配置独立校验并在重启保持',()=>{const state=migrateState({settings:{infoBarEnabled:true,bodyShortcuts:{head:'stats',chest:'bogus',feet:'reminder'}},layoutVersion:3,position:[100,200]});assert.equal(Object.hasOwn(state.settings,'infoBarEnabled'),false);assert.equal(state.settings.bodyShortcuts.head,'stats');assert.equal(state.settings.bodyShortcuts.feet,'reminder');assert.equal(state.settings.bodyShortcuts.chest,defaults.bodyShortcuts.chest);assert.deepEqual(migrateState(JSON.parse(JSON.stringify(state))),state);const next=validate();next.bodyShortcuts.head='weather';assert.equal(defaults.bodyShortcuts.head,'datetime');});

test('设置快捷功能保存并经重启迁移保持，原有部位配置不变',()=>{const state=migrateState({settings:{bodyShortcuts:{head:'settings',chest:'weather',arms:'library',legs:'stats',feet:'wardrobe'}}});assert.equal(state.settings.bodyShortcuts.head,'settings');assert.deepEqual(migrateState(JSON.parse(JSON.stringify(state))),state);assert.deepEqual({...state.settings.bodyShortcuts,head:defaults.bodyShortcuts.head},defaults.bodyShortcuts);});

test('发型和服装独立保存，旧状态与非法值回退原版',()=>{for(const hair of ['original','straight','bob','twintails'])for(const outfit of ['original','jk','secretary','nurse']){const state=migrateState({settings:{hair,outfit}});assert.equal(state.settings.hair,hair);assert.equal(state.settings.outfit,outfit);assert.deepEqual(migrateState(JSON.parse(JSON.stringify(state))),state);}const invalid=validate({hair:'../../bad',outfit:null});assert.equal(invalid.hair,'original');assert.equal(invalid.outfit,'original');});

test('恢复按需天气，仅保存有效城市坐标，排除 IP 与凭据',()=>{const state=migrateState({settings:{weatherLocation:{name:'杭州',latitude:30,longitude:120,ip:'private',token:'secret'},recordFrameRate:30}});assert.equal(state.settings.weatherLocation.name,'杭州');assert.equal(Object.hasOwn(state.settings.weatherLocation,'ip'),false);assert.equal(Object.hasOwn(state.settings.weatherLocation,'token'),false);assert.equal(validate({weatherLocation:{name:'bad',latitude:999,longitude:1}}).weatherLocation,null);assert.equal(state.settings.recordFrameRate,30);});

test('纯净模式默认关闭，保存与迁移保持且不接受字符串开启',()=>{assert.equal(validate().pureMode,false);assert.equal(validate({pureMode:'true'}).pureMode,false);const state=migrateState({settings:{pureMode:true}});assert.equal(state.settings.pureMode,true);assert.deepEqual(migrateState(JSON.parse(JSON.stringify(state))),state);});
