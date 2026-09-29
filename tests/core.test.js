const {test}=require('node:test');
const assert=require('node:assert/strict');
const {defaults,validate,migrateState,WINDOW_WIDTH,WINDOW_HEIGHT}=require('../core');

test('old chat and AI data are discarded while local settings remain',()=>{
  const state=migrateState({settings:{name:'星露娜',nickname:'小星',top:false,online:true,baseUrl:'https://example.com/v1'},key:'old-key',history:[{role:'user',content:'old chat'}],position:[100,200]});
  assert.deepEqual(state,{settings:{name:'星露娜',nickname:'小星',top:false},layoutVersion:2,position:[447,200]});
  assert.equal(Object.hasOwn(state,'history'),false);
  assert.equal(Object.hasOwn(state,'key'),false);
});

test('new position and settings stay stable on later launches',()=>{
  const state=migrateState({settings:defaults,layoutVersion:2,position:[447,200]});
  assert.deepEqual(state.position,[447,200]);
  assert.deepEqual(validate({}),defaults);
  assert.equal(WINDOW_WIDTH,280);
  assert.equal(WINDOW_HEIGHT,550);
});
