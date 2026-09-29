const {test}=require('node:test');
const assert=require('node:assert/strict');
const {validate,askAI,offline,defaults}=require('../core');
test('reject unsafe endpoints and require model for online mode',()=>{
 assert.throws(()=>validate({...defaults,baseUrl:'http://example.com/v1'}));
 assert.throws(()=>validate({...defaults,baseUrl:'https://user:secret@example.com'}));
 assert.throws(()=>validate({...defaults,online:true}));
 assert.equal(validate({...defaults,baseUrl:'http://127.0.0.1:11434/v1/'}).baseUrl,'http://127.0.0.1:11434/v1');
});
test('send selected model, memory and online-only history; never follow redirect',async()=>{
 const s=validate({...defaults,baseUrl:'https://example.com/v1',model:'user-model',online:true,memory:'喜欢猫'});
 const answer=await askAI(s,'test-secret',[{role:'assistant',content:'offline canned',online:false},{role:'user',content:'previous',online:true}],'你好',async(url,opts)=>{
  assert.equal(url,'https://example.com/v1/chat/completions');assert.equal(opts.redirect,'error');assert.equal(opts.headers.Authorization,'Bearer test-secret');
  const body=JSON.parse(opts.body);assert.equal(body.model,'user-model');assert.equal(body.messages.length,3);assert.match(body.messages[0].content,/喜欢猫/);
  return {ok:true,json:async()=>({choices:[{message:{content:'你好呀'}}]})};
 });assert.equal(answer,'你好呀');
});
test('report auth and malformed responses without exposing server text',async()=>{
 await assert.rejects(askAI({...defaults,baseUrl:'https://example.com'},'',[],'hello',async()=>({ok:false,status:401})),/认证失败/);
 await assert.rejects(askAI({...defaults,baseUrl:'https://example.com'},'',[],'hello',async()=>({ok:true,json:async()=>({})})),/没有返回/);
 assert.match(offline('你是谁',defaults),/离线互动/);
});
