const {app}=require('electron');
const http=require('node:http');
const assert=require('node:assert/strict');
const {askWithSystemNetwork}=require('../network');
const {defaults}=require('../core');
app.whenReady().then(async()=>{
 let requests=0,redirectHit=false;
 const server=http.createServer((req,res)=>{
  if(req.url==='/redirect/chat/completions'){res.writeHead(302,{Location:'/unexpected'});res.end();return;}
  if(req.url==='/unexpected'){redirectHit=true;res.end();return;}
  let body='';req.on('data',b=>body+=b);req.on('end',()=>{
   requests++;
   try {
    assert.equal(req.method,'POST');assert.equal(req.url,'/v1/chat/completions');
    assert.equal(req.headers.authorization,'Bearer fake-local-test-key');
    assert.equal(JSON.parse(body).messages.at(-1).content,'本地测试');
    res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({choices:[{message:{content:'本地测试通过'}}]}));
   }catch(e){res.writeHead(400);res.end();}
  });
 });
 try {
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const root=`http://127.0.0.1:${server.address().port}`;
  assert.equal(await askWithSystemNetwork({...defaults,baseUrl:root+'/v1',model:'test'},'fake-local-test-key',[],'本地测试'),'本地测试通过');
  await assert.rejects(askWithSystemNetwork({...defaults,baseUrl:root+'/redirect',model:'test'},'fake-local-test-key',[],'本地测试'));
  assert.equal(requests,1);assert.equal(redirectHit,false);
  console.log('PASS: production Electron transport POST, response parsing and redirect rejection');
  server.close();app.exit(0);
 }catch(e){console.error(e.message);server.close();app.exit(1);}
}).catch(e=>{console.error(e.name);app.exit(1);});
