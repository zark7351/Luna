const sleep=delay=>new Promise(resolve=>setTimeout(resolve,delay));
async function click(win,id){
  const point=await win.webContents.executeJavaScript(`(()=>{const button=document.getElementById('${id}'),box=button.getBoundingClientRect();if(button.hidden||button.disabled||box.width<1||box.height<1)throw Error('bubble action unavailable: ${id}');return{x:Math.round((box.left+box.right)/2),y:Math.round((box.top+box.bottom)/2)};})()`);
  win.webContents.sendInputEvent({type:'mouseMove',...point});win.webContents.sendInputEvent({type:'mouseDown',...point,button:'left',clickCount:1});win.webContents.sendInputEvent({type:'mouseUp',...point,button:'left',clickCount:1});await sleep(100);
}
async function checkOrdinary(win){
  await win.webContents.executeJavaScript(`(async()=>{await performBodyShortcut('head');void 0;})()`);await click(win,'bubble-body');if(!await win.webContents.executeJavaScript(`document.querySelector('#bubble').hidden&&!infoBubbles.active`))throw Error('date bubble click must cancel');
  await win.webContents.executeJavaScript(`showMessage('点击关闭这条消息',0);void 0;`);await click(win,'bubble-body');
  if(!await win.webContents.executeJavaScript(`document.querySelector('#bubble').hidden`))throw Error('normal bubble click did not close');
  await win.webContents.executeJavaScript(`showMessage(['对话第一条','对话第二条'],0);void 0;`);await click(win,'bubble-body');
  if(!await win.webContents.executeJavaScript(`document.querySelector('#bubble-message').textContent==='对话第二条'&&document.querySelector('#bubble-complete').hidden`))throw Error('normal bubble next');
  await click(win,'bubble-body');if(!await win.webContents.executeJavaScript(`document.querySelector('#bubble').hidden`))throw Error('last dialog not closed');
  return {dateBubbleDismiss:true,nativeClickClose:true,nextDialogue:true,lastDialogueCloses:true};
}
async function checkReminderLayout(win){
  await win.webContents.executeJavaScript(`(()=>{
    const bubble=document.querySelector('#bubble'),body=document.querySelector('#bubble-body'),done=document.querySelector('#bubble-complete'),box=bubble.getBoundingClientRect(),button=done.getBoundingClientRect(),text=body.getBoundingClientRect();
    if(done.parentElement!==bubble||done.hidden||done.disabled||button.left<text.right||button.right>box.right-5||button.top<box.top||button.bottom>box.bottom||text.width<100||body.contains(done))throw Error('complete button must be inside bubble with independent hit area');
    if(box.height>70||box.bottom>document.querySelector('#pet').getBoundingClientRect().top-8||document.body.scrollWidth>document.body.clientWidth)throw Error('reminder bubble exceeds compact layout');
  })()`);
}
module.exports={click,checkOrdinary,checkReminderLayout};
