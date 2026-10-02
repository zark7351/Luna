const $=id=>document.getElementById(id);
let settings, sleeping=false, happyTimer, dragStart, dragging=false, ignore=false;
const api=async(name,payload)=>{const r=await window.pet.call(name,payload);if(!r.ok)throw Error(r.error);return r.value;};
function happy(text){if(sleeping)return;$('bubble').textContent=text;clearTimeout(happyTimer);$('pet').classList.remove('blink');$('pet').classList.add('happy');happyTimer=setTimeout(()=>$('pet').classList.remove('happy'),1900);}
function droppedText(data){
  const uri=data.getData('text/uri-list').split(/\r?\n/).find(line=>line && !line.startsWith('#'));
  return (uri || data.getData('text/plain') || '').trim();
}

$('screenshot-button').onclick=async()=>{try{await api('screenshot-start');}catch(e){$('bubble').textContent=e.message;}};
window.pet.onScreenshotMessage(value=>{$('bubble').textContent=value.message;});
function shortcutHint(status){$('screenshot-button').title=status.enabled?(status.available?'截图收藏 · Ctrl+Alt+A':'截图收藏 · 快捷键被占用，请点击图标'):'截图收藏 · 快捷键已关闭';}
window.pet.onScreenshotShortcutChanged(shortcutHint);
api('screenshot-shortcut').then(shortcutHint).catch(()=>{});
$('reminder-button').onclick=async()=>{try{await api('reminder-show');}catch(error){$('bubble').textContent=error.message;}};
function reminderCount(count){$('reminder-button').classList.toggle('has-reminders',count>0);$('reminder-button').title=count?'提醒 · '+count+' 条待处理':'提醒';}
window.pet.onReminderCount(reminderCount);
const sounds={reminder:new Audio('assets/reminder.wav')};sounds.reminder.volume=.65;
window.pet.onSound(name=>{const sound=sounds[name];if(!sound)return;sound.currentTime=0;sound.play().catch(error=>console.warn('提示音播放失败',error.message));});
window.pet.onReminderDue(message=>{rest(false);$('bubble').textContent=message;});
api('reminder-list').then(items=>reminderCount(items.filter(item=>item.status!=='done').length)).catch(()=>{});
$('hide').onclick=()=>api('hide');
$('library-button').onclick=async()=>{try{await api('library-show');}catch(e){$('bubble').textContent=e.message;}};
function rest(value){
  if(sleeping===value)return;sleeping=value;clearTimeout(happyTimer);
  $('pet').classList.toggle('sleeping',sleeping);$('pet').classList.remove('happy','blink');
  if(!dropDepth)$('bubble').textContent=sleeping?'你先忙，我小憩一下。':'你回来啦。';
}
window.pet.onIdleChanged(rest);
function openHelp(){ $('settings').hidden=true;if(!$('help').open){$('help').showModal();ignore=false;window.pet.passthrough(false);}}
$('help-close').onclick=()=>$('help').close();
$('settings-help').onclick=openHelp;
async function openSettings(){
  if($('help').open)$('help').close();ignore=false;window.pet.passthrough(false);
  try{const state=await api('state');settings=state.settings;for(const k of ['name','nickname'])$(k).value=settings[k];$('top').checked=settings.top;$('screenshot-shortcut').checked=settings.screenshotShortcut;$('sound-enabled').checked=settings.soundEnabled;window.lunaWeather.fill(settings.weatherLocation);$('settings-status').textContent='';$('settings').hidden=false;}catch(e){$('bubble').textContent=e.message;}
};
window.lunaPanels={openSettings,openHelp};
window.pet.onPanel(name=>{if(name==='settings')openSettings();else if(name==='help')openHelp();});
$('settings-close').onclick=()=>{$('settings').hidden=true;};
$('settings-form').onsubmit=async e=>{e.preventDefault();const input={name:$('name').value,nickname:$('nickname').value,top:$('top').checked,screenshotShortcut:$('screenshot-shortcut').checked,soundEnabled:$('sound-enabled').checked,weatherLocation:window.lunaWeather.getLocation()};
  try{const state=await api('settings',input);settings=state.settings;document.title=settings.name+' · 桌面宠物';$('settings').hidden=true;window.lunaWeather.changed();$('bubble').textContent='好，我记住你的设置啦。';}catch(err){$('settings-status').textContent=err.message;}
};
$('pet').onclick=()=>{if(dragging){dragging=false;return;}rest(false);happy(['今天也一起慢慢来吧。','被你发现我在发呆了。','见到你，心情就变好啦。'][Math.floor(Math.random()*3)]);};
$('pet').onpointerdown=e=>{if(e.button!==0)return;dragStart={x:e.screenX,y:e.screenY};dragging=false;$('pet').setPointerCapture(e.pointerId);};
$('pet').onpointermove=e=>{if(dragStart&&!dragging&&Math.hypot(e.screenX-dragStart.x,e.screenY-dragStart.y)>5){dragging=true;window.pet.drag(true);}};
function endDrag(){if(dragStart&&dragging)window.pet.drag(false);dragStart=null;}
$('pet').onpointerup=endDrag;$('pet').onpointercancel=endDrag;window.addEventListener('blur',endDrag);
let dropDepth=0;
let beforeDropText='';
document.addEventListener('mousemove',e=>{const value=!$('help').open&&!dropDepth&&!e.target.closest('.interactive')&&!dragStart;if(value!==ignore){ignore=value;window.pet.passthrough(value);}});
document.addEventListener('mouseleave',()=>{if(!$('help').open&&!dragStart&&!dropDepth){ignore=true;window.pet.passthrough(true);}});
document.addEventListener('dragenter',e=>{e.preventDefault();if(!dropDepth)beforeDropText=$('bubble').textContent;dropDepth++;$('companion').classList.add('drop-ready');$('bubble').textContent='放到这里，我会帮你收藏。';ignore=false;window.pet.passthrough(false);});
document.addEventListener('dragover',e=>{e.preventDefault();e.dataTransfer.dropEffect='copy';});
document.addEventListener('dragleave',()=>{dropDepth=Math.max(0,dropDepth-1);if(!dropDepth){$('companion').classList.remove('drop-ready');$('bubble').textContent=beforeDropText;ignore=true;window.pet.passthrough(true);}});
document.addEventListener('drop',async e=>{
  e.preventDefault();dropDepth=0;$('companion').classList.remove('drop-ready');
  rest(false);
  $('bubble').textContent='正在收藏…';
  try{
    // FileList itself cannot be passed through Electron's context bridge.
    const files=Array.from(e.dataTransfer.files);
    if(files.length){
      const result=await window.pet.saveDroppedFiles(files);
      if(!result.ok)throw Error(result.error);
      const {saved,failed,unavailable}=result.value;
      if(unavailable){
        const content=droppedText(e.dataTransfer);
        if(!content)throw Error('这个拖入内容没有本机文件或可用链接。');
        const item=await api('collection-add-text',content);
        happy(item.kind==='link'?'链接收好啦。':'文字收好啦。');
      }else{
        if(saved)happy(`收好啦，收藏了 ${saved} 个文件。`);
        else if(failed.length)throw Error(failed[0]);
        if(failed.length && saved)$('bubble').textContent+=`另有 ${failed.length} 个未成功。`;
      }
    }else{
      const content=droppedText(e.dataTransfer);
      if(!content)throw Error('没有识别到文件、文字或链接。');
      const item=await api('collection-add-text',content);
      happy(item.kind==='link'?'链接收好啦。':'文字收好啦。');
    }
  }catch(error){$('bubble').textContent=error.message;}
});
function blink(){if(!sleeping&&!$('pet').classList.contains('happy')){$('pet').classList.add('blink');setTimeout(()=>$('pet').classList.remove('blink'),140);}setTimeout(blink,3200+Math.random()*2400);}setTimeout(blink,3000);
(async()=>{try{const s=await api('state');settings=s.settings;rest(s.sleeping===true);document.title=settings.name+' · 桌面宠物';window.lunaWeather.refresh();}catch(e){$('bubble').textContent='初始化失败：'+e.message;}})();
