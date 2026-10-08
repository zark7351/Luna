const fs=require('node:fs'),assert=require('node:assert/strict');
async function check({win,libraryWin,stateFile,trayMenu}){
  const before=JSON.parse(fs.readFileSync(stateFile)).settings;
  await win.webContents.executeJavaScript(`(async()=>{
    await openSettings();document.querySelector('#language').value='en';document.querySelector('#settings-form').requestSubmit();
    const until=Date.now()+5000;while(!document.querySelector('#settings').hidden&&Date.now()<until)await new Promise(r=>setTimeout(r,30));
    if(document.documentElement.lang!=='en'||document.querySelector('#library-button').title!=='Collection')throw Error('English pet toolbar');
    if(document.querySelector('[data-region=head]').textContent!=='Head'||document.querySelector('[data-action=settings] span').textContent!=='Settings')throw Error('English body settings');
    for(const id of ['library','reminder','recording'])if(document.querySelector('#'+id+'-frame').contentDocument.documentElement.lang!=='en')throw Error('English panel '+id);
    await openSettings();if(document.querySelector('#language').value!=='en'||document.querySelector('#settings h1').textContent!=='Settings')throw Error('English settings reopen');
  })()`);
  assert.equal(JSON.parse(fs.readFileSync(stateFile)).settings.language,'en');
  assert.equal(trayMenu().getMenuItemById('settings').label,'Settings');
  assert.equal(JSON.parse(fs.readFileSync(stateFile)).settings.name,before.name);
  await new Promise(resolve=>{libraryWin.webContents.once('did-finish-load',resolve);libraryWin.reload();});
  await libraryWin.webContents.executeJavaScript(`(async()=>{const until=Date.now()+5000;while(document.documentElement.lang!=='en'&&Date.now()<until)await new Promise(r=>setTimeout(r,30));if(document.documentElement.lang!=='en'||document.querySelector('#add-file').title!=='Add files')throw Error('New window language');})()`);
  await win.webContents.executeJavaScript(`document.querySelector('#settings').scrollTop=0`);
  fs.writeFileSync(require('node:path').join(require('node:os').tmpdir(),'luna-language-settings.png'),(await win.webContents.capturePage()).toPNG());
  await win.webContents.executeJavaScript(`(async()=>{document.querySelector('#language').value='zh-CN';document.querySelector('#settings-form').requestSubmit();const until=Date.now()+5000;while(document.documentElement.lang!=='zh-CN'&&Date.now()<until)await new Promise(r=>setTimeout(r,30));if(document.querySelector('#library-button').title!=='收藏夹')throw Error('Chinese restore');})()`);
  assert.equal(JSON.parse(fs.readFileSync(stateFile)).settings.language,'zh-CN');
  return {settingsSave:true,panels:true,tray:true,newWindow:true,persisted:true,chineseRestore:true};
}
module.exports={check};
