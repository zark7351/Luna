// Native renderer mouse/keyboard events, rather than assigning values or invoking submit.
module.exports=async win=>{
  await win.webContents.executeJavaScript(`{openSheet('reminder');const doc=document.querySelector('#reminder-frame').contentDocument;doc.querySelector('#mode-scheduled').click();doc.querySelector('#title').value='';}`);
  win.blur();win.showInactive();
  const click=async(id,offset)=>{
    const point=await win.webContents.executeJavaScript(`(()=>{const frame=document.querySelector('#reminder-frame'),box=frame.getBoundingClientRect(),field=frame.contentDocument.querySelector('#${id}'),rect=field.getBoundingClientRect();if(field.disabled||field.readOnly)throw Error('visible field disabled: ${id}');return{x:Math.round(box.left+rect.left+${offset||15}),y:Math.round(box.top+rect.top+rect.height/2)};})()`);
    win.webContents.sendInputEvent({type:'mouseMove',...point});win.webContents.sendInputEvent({type:'mouseDown',...point,button:'left',clickCount:1});win.webContents.sendInputEvent({type:'mouseUp',...point,button:'left',clickCount:1});await new Promise(r=>setTimeout(r,120));
    if(!win.isFocused()||!await win.webContents.executeJavaScript(`document.querySelector('#reminder-frame').contentDocument.activeElement.id==='${id}'`))throw Error('native reminder field focus: '+id);
  };
  const key=(keyCode,modifiers=[])=>{win.webContents.sendInputEvent({type:'keyDown',keyCode,modifiers});win.webContents.sendInputEvent({type:'keyUp',keyCode,modifiers});};
  const type=async text=>{key('A',['control']);for(const char of text){win.webContents.sendInputEvent({type:'keyDown',keyCode:char});win.webContents.sendInputEvent({type:'char',keyCode:char});win.webContents.sendInputEvent({type:'keyUp',keyCode:char});}await new Promise(r=>setTimeout(r,80));};
  await click('title');await type('Luna test');
  if(!await win.webContents.executeJavaScript(`document.querySelector('#reminder-frame').contentDocument.querySelector('#title').value==='Luna test'`))throw Error('title keyboard typing');
  const before=await win.webContents.executeJavaScript(`document.querySelector('#reminder-frame').contentDocument.querySelector('#time').value`);
  await click('time',18);key('Up');await new Promise(r=>setTimeout(r,80));
  if(await win.webContents.executeJavaScript(`document.querySelector('#reminder-frame').contentDocument.querySelector('#time').value`)===before)throw Error('datetime keyboard edit');
  await win.webContents.executeJavaScript(`document.querySelector('#reminder-frame').contentDocument.querySelector('#mode-countdown').click()`);
  for(const [id,value]of [['hours','2'],['minutes','17'],['seconds','39']]){
    await click(id);await type(value);if(await win.webContents.executeJavaScript(`document.querySelector('#reminder-frame').contentDocument.querySelector('#${id}').value`)!==value)throw Error('countdown keyboard typing: '+id);
  }
  await win.webContents.executeJavaScript(`{const frame=document.querySelector('#reminder-frame');frame.contentWindow.reset();frame.contentDocument.querySelector('#mode-scheduled').click();}`);
  return {nativeClickFocus:true,titleTyping:true,datetimeKeyboard:true,countdownTyping:true};
};
