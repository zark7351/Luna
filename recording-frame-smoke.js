const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
async function check({recording,display,temp,collection}){
  const before=collection.list().length;
  await recording.select({format:'mp4',fps:30},{rect:{x:100,y:100,width:320,height:180},bounds:display.bounds,sourceId:'test',adjust:true});
  const border=recording.getBorders()[0],js=code=>border.webContents.executeJavaScript(code);
  const read=()=>js("recordingFrame.call('recording-state').then(result=>result.value)");
  let state=await read();assert.equal(state.phase,'adjusting');assert.equal(collection.list().length,before);
  await new Promise(resolve=>setTimeout(resolve,150));assert.equal((await read()).phase,'adjusting');
  const bitmap=(await border.webContents.capturePage({x:140,y:145,width:30,height:20})).toBitmap();for(let index=3;index<bitmap.length;index+=4)assert.equal(bitmap[index],0);
  assert.equal(await js("document.querySelector('#toolbar').dataset.inside"),'false');
  border.webContents.sendInputEvent({type:'mouseMove',x:419,y:279});
  border.webContents.sendInputEvent({type:'mouseDown',x:419,y:279,button:'left',clickCount:1});
  border.webContents.sendInputEvent({type:'mouseMove',x:459,y:309});
  border.webContents.sendInputEvent({type:'mouseUp',x:459,y:309,button:'left',clickCount:1});
  const until=Date.now()+4000;while((state=await read()).rect.width!==360&&Date.now()<until)await new Promise(resolve=>setTimeout(resolve,30));
  assert.equal(state.rect.width,360);assert.equal(state.rect.height,210);
  // Drag the toolbar's size label to move the whole frame.
  const size=await js("(()=>{const rect=document.querySelector('#size').getBoundingClientRect();return {x:Math.round(rect.x+10),y:Math.round(rect.y+10)}})()");
  border.webContents.sendInputEvent({type:'mouseDown',...size,button:'left',clickCount:1});border.webContents.sendInputEvent({type:'mouseMove',x:size.x+20,y:size.y+20});border.webContents.sendInputEvent({type:'mouseUp',x:size.x+20,y:size.y+20,button:'left',clickCount:1});
  await new Promise(resolve=>setTimeout(resolve,100));state=await read();assert.equal(state.rect.x,120);assert.equal(state.rect.y,120);
  await js("recordingFrame.call('recording-adjust',{x:0,y:0,width:320,height:180})");assert.equal(await js("document.querySelector('#toolbar').dataset.inside"),'true');
  await new Promise(resolve=>setTimeout(resolve,100));
  fs.writeFileSync(path.join(temp,'luna-adjustable-recording.png'),(await border.webContents.capturePage({x:0,y:0,width:380,height:240})).toPNG());
  const restricted=await js("(()=>{try{recordingFrame.call('recording-chunk',new ArrayBuffer(1));return false;}catch{return true;}})()");assert.equal(restricted,true);
  await js("document.querySelector('#cancel').click();void 0");const cancelled=Date.now()+3000;while(recording.isActive()&&Date.now()<cancelled)await new Promise(resolve=>setTimeout(resolve,20));assert.equal(recording.isActive(),false);assert.equal(collection.list().length,before);
  return {waitsForStart:true,resize:true,move:true,toolbarInsideAtEdge:true,transparentCenter:true,restrictedBridge:true,cancelWithoutFile:true};
}
module.exports={check};
