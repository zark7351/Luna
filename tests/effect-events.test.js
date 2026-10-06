const test=require('node:test'),assert=require('node:assert/strict');
const {operationEffect,effectNames}=require('../effect-events');
test('视觉反馈仅对应已提交的成功动作，取消或全部失败不播放成功动画',()=>{
  for(const channel of ['collection-add-files','collection-add-drop','library-add-files']){
    assert.equal(operationEffect(channel,{saved:0,failed:[]}),null);
    assert.equal(operationEffect(channel,{saved:0,failed:['失败']}),null);
    assert.equal(operationEffect(channel,{saved:1,failed:['部分失败']}),'collect');
  }
  assert.equal(operationEffect('collection-add-clipboard',{kind:'files',saved:0}),null);
  assert.equal(operationEffect('collection-add-clipboard',{id:'image',kind:'file'}),'collect');
  assert.equal(operationEffect('collection-add-text',{id:'text'}),'collect');
  assert.equal(operationEffect('appearance',{}),'wardrobe');
  assert.equal(operationEffect('reminder-save',{}),'reminder-save');
  assert.equal(operationEffect('reminder-action',{}, {action:'complete'}),'complete');
  for(const action of ['snooze','delete','edit'])assert.equal(operationEffect('reminder-action',{}, {action}),null);
  for(const channel of ['ui-sound','state','collection-list','collection-link-preview','settings'])assert.equal(operationEffect(channel,{}),null);
  assert.ok(effectNames.includes('capture'));assert.ok(effectNames.includes('recording'));
});
