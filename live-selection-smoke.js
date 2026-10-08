const assert=require('node:assert/strict');
async function check({screenshot,display}){
  let selected;
  await screenshot.start({onSelect:value=>{selected=value;}});
  const overlay=screenshot.getWindows().find(window=>window.getBounds().x===display.bounds.x&&window.getBounds().y===display.bounds.y);
  assert.ok(overlay);
  assert.equal(overlay.isFullScreen(),false);
  await overlay.webContents.executeJavaScript(`(async()=>{const until=Date.now()+3000;while(!ready&&Date.now()<until)await new Promise(r=>setTimeout(r,20));if(!ready||!document.querySelector('#screen').hidden||document.querySelector('#screen').getAttribute('src'))throw Error('recording selector displays a screenshot');})()`);
  // The covered fixture area must contain no painted pixels from the selector.
  const image=await overlay.webContents.capturePage({x:20,y:20,width:320,height:180});
  const bitmap=image.toBitmap();for(let i=3;i<bitmap.length;i+=4)assert.equal(bitmap[i],0,'recording overlay has an opaque background');
  overlay.webContents.sendInputEvent({type:'mouseDown',x:40,y:40,button:'left',clickCount:1});
  overlay.webContents.sendInputEvent({type:'mouseMove',x:300,y:170});
  overlay.webContents.sendInputEvent({type:'mouseUp',x:300,y:170,button:'left',clickCount:1});
  const until=Date.now()+3000;while(!selected&&Date.now()<until)await new Promise(resolve=>setTimeout(resolve,20));
  assert.ok(selected);assert.equal(selected.rect.width,260);assert.equal(selected.rect.height,130);assert.equal(screenshot.isActive(),false);
  await screenshot.start({onSelect:()=>{throw Error('cancel selected a region');}});
  const cancel=screenshot.getWindows()[0];cancel.webContents.sendInputEvent({type:'keyDown',keyCode:'ESCAPE'});
  const cancelUntil=Date.now()+3000;while(screenshot.isActive()&&Date.now()<cancelUntil)await new Promise(resolve=>setTimeout(resolve,20));
  assert.equal(screenshot.isActive(),false);
  return {liveDesktop:true,noScreenshot:true,transparentPixels:true,nativeSelection:true,cancel:true};
}
module.exports={check};
