const $=id=>document.getElementById(id);
window.lunaCharacter=createLunaCharacter($('pet'));
let settings, sleeping=false, happyTimer, dragStart, dragging=false, ignore=false;
const api=async(name,payload)=>{const r=await window.pet.call(name,payload);if(!r.ok)throw Error(r.error);return r.value;};
function appearance(node,hair,outfit){
  // The neutral cell stays fixed; character.js overlays only eyes and mouth.
  const sprites={'original-original':{file:'character.png',center:274},'original-jk':{file:'luna-silver-jk.png',center:276},'straight-original':{file:'luna-straight-original.png',center:291},'straight-jk':{file:'luna-straight-jk.png',center:291}};
  const sprite=sprites[hair+'-'+outfit]||sprites['original-original'];
  node.style.backgroundImage="url('assets/"+sprite.file+"')";node.style.setProperty('--sprite-height','100%');node.style.setProperty('--sprite-row','0%');
  node.style.setProperty('--body-offset',(256-sprite.center)/512*100+'%');
  node.dataset.hair=hair;node.dataset.outfit=outfit;if(node.id==='pet')return window.lunaCharacter.setLook(hair,outfit);
}
function wardrobeTab(name,focus=false){if(focus&&$('wardrobe-tab-'+name).getAttribute('aria-selected')!=='true')window.uiSound('tab');for(const group of ['hair','outfit']){const tab=$('wardrobe-tab-'+group),active=group===name;tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;$(group+'-items').hidden=!active;}if(focus)$('wardrobe-tab-'+name).focus();}
for(const group of ['hair','outfit']){const tab=$('wardrobe-tab-'+group);tab.onclick=()=>wardrobeTab(group,true);tab.onkeydown=event=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();wardrobeTab(event.key==='Home'?'hair':event.key==='End'?'outfit':group==='hair'?'outfit':'hair',true);}};}
function previewLook(){const hair=$('hair').value,outfit=$('outfit').value;appearance($('look-preview'),hair,outfit);window.lunaEffects.pulse($('look-preview'),'reveal');for(const card of document.querySelectorAll('.look-card')){const group=card.dataset.group,value=card.dataset.choice;card.setAttribute('aria-pressed',String($(group).value===value));}}
for(const card of document.querySelectorAll('.look-card'))card.onclick=()=>{$(card.dataset.group).value=card.dataset.choice;previewLook();};
$('hair').onchange=previewLook;$('outfit').onchange=previewLook;
let completingReminder=false;
let lastFeedback='';
const feedback=createPetFeedback({render:value=>{
  const bubble=$('bubble');bubble.textContent=value.message;bubble.hidden=!value.message;$('today-panel').hidden=!!value.message;
  bubble.classList.toggle('reminder-alert',!!value.reminder);bubble.disabled=!value.reminder||completingReminder;
  const feedbackKey=(value.reminder?.id||'')+value.message;if(value.message&&feedbackKey!==lastFeedback)window.lunaEffects.pulse(bubble,'reveal');lastFeedback=feedbackKey;
  bubble.title=value.reminder?'点击完成：'+value.reminder.title:'';bubble.setAttribute('aria-label',value.reminder?'完成提醒：'+value.reminder.title:value.message);
}});
const showMessage=(text,delay)=>feedback.show(text,delay);
$('bubble').onclick=async()=>{
  const reminder=feedback.getReminder();if(!reminder||completingReminder)return;
  completingReminder=true;$('bubble').disabled=true;
  try{await api('reminder-complete',reminder.id);showMessage('提醒完成啦。');}
  catch(error){$('bubble').title=error.message;}
  finally{completingReminder=false;$('bubble').disabled=!feedback.getReminder();}
};
let controlsTimer=null;
function overControls(x,y){
  if(!Number.isFinite(x)||!Number.isFinite(y))return false;
  const pet=$('pet').getBoundingClientRect(),bar=document.querySelector('.petbar').getBoundingClientRect();
  const inside=box=>x>=box.left&&x<=box.right&&y>=box.top&&y<=box.bottom;
  // Hidden controls still have a layout box. Include the gap so crossing it never enables click-through.
  return inside(pet)||inside({left:Math.min(pet.left,bar.left)-6,right:Math.max(pet.right,bar.right)+6,top:Math.min(pet.bottom,bar.top)-8,bottom:bar.bottom+8});
}
function showControls(){clearTimeout(controlsTimer);controlsTimer=null;$('companion').classList.add('controls-visible');document.querySelector('.petbar').setAttribute('aria-hidden','false');}
function hideControls(){clearTimeout(controlsTimer);controlsTimer=null;$('companion').classList.remove('controls-visible');document.querySelector('.petbar').setAttribute('aria-hidden','true');}
function leaveControls(){if(controlsTimer===null)controlsTimer=setTimeout(hideControls,350);}
window.addEventListener('pagehide',()=>{feedback.stop();clearTimeout(controlsTimer);});
function happy(text){if(sleeping)return;window.lunaCharacter.react(['wink','smile','shy'][Math.floor(Math.random()*3)]);showMessage(text);clearTimeout(happyTimer);$('pet').classList.remove('blink');$('pet').classList.add('happy');happyTimer=setTimeout(()=>$('pet').classList.remove('happy'),1900);}
function droppedText(data){
  const uri=data.getData('text/uri-list').split(/\r?\n/).find(line=>line && !line.startsWith('#'));
  return (uri || data.getData('text/plain') || '').trim();
}

$('recording-button').onclick=()=>api('recording-show').catch(error=>showMessage(error.message));
$('storage-choose').onclick=async()=>{try{const directory=await api('storage-choose');if(directory)$('save-directory').value=directory;}catch(error){$('settings-status').textContent=error.message;}};
$('storage-reset').onclick=()=>{$('save-directory').value='';};
$('screenshot-button').onclick=async()=>{try{await api('screenshot-start');}catch(e){showMessage(e.message);}};
window.pet.onScreenshotMessage(value=>{showMessage(value.message);});
function shortcutHint(status){$('screenshot-button').title=status.enabled?(status.available?'截图收藏 · Ctrl+Alt+A':'截图收藏 · 快捷键被占用，请点击图标'):'截图收藏 · 快捷键已关闭';}
window.pet.onScreenshotShortcutChanged(shortcutHint);
api('screenshot-shortcut').then(shortcutHint).catch(()=>{});
$('reminder-button').onclick=async()=>{try{await api('reminder-show');}catch(error){showMessage(error.message);}};
function reminderCount(count){$('reminder-button').classList.toggle('has-reminders',count>0);$('reminder-button').title=count?'提醒 · '+count+' 条待处理':'提醒';}
window.pet.onReminderCount(reminderCount);
const sounds={reminder:new Audio('assets/reminder.wav')};sounds.reminder.volume=.65;
for(const name of ['click','tab','select','toggle','open','close','save','collect','copy','delete','refresh','error','capture-start','capture-done','capture-cancel','complete','snooze']){sounds[name]=new Audio('assets/sounds/'+name+'.wav');sounds[name].volume=.65;}
window.pet.onSound(name=>{const sound=sounds[name];if(!sound)return;sound.currentTime=0;sound.play().catch(error=>console.warn('提示音播放失败',error.message));});
window.pet.onEffect(name=>{window.lunaEffects.burst(name);const buttons={collect:'library-button',capture:'screenshot-button',recording:'recording-button',wardrobe:'wardrobe-button','reminder-save':'reminder-button',complete:'reminder-button'};if(buttons[name])window.lunaEffects.pulse($(buttons[name]),'select');});
window.pet.onReminderDue(value=>{if(value){rest(false);if(feedback.getReminder()?.id!==value.id)window.lunaEffects.burst('reminder');}else{sounds.reminder.pause();sounds.reminder.currentTime=0;}feedback.updateReminder(value);});
api('reminder-list').then(items=>{reminderCount(items.filter(item=>item.status!=='done').length);const due=items.filter(item=>item.status==='fired');if(due.length){window.lunaEffects.burst('reminder');feedback.updateReminder({id:due[0].id,title:due[0].title,remaining:due.length});}}).catch(()=>{});
$('hide').onclick=()=>api('hide');
$('library-button').onclick=()=>openSheet('library');
function rest(value){
  if(sleeping===value)return;sleeping=value;clearTimeout(happyTimer);
  window.lunaCharacter.cancel();$('pet').classList.toggle('sleeping',sleeping);$('pet').classList.remove('happy','blink');
  if(!dropDepth)showMessage(sleeping?'你先忙，我小憩一下。':'你回来啦。');
}
window.pet.onIdleChanged(rest);
function openHelp(){ closeSheets(); $('settings').hidden=true;$('wardrobe').hidden=true;if(!$('help').open){$('help').showModal();window.uiSound('open');ignore=false;window.pet.passthrough(false);}}
$('help-close').onclick=()=>{$('help').close();window.uiSound('close');};
$('help').addEventListener('cancel',()=>window.uiSound('close'));
$('settings-help').onclick=openHelp;
async function openSettings(){
  closeSheets();
  $('wardrobe').hidden=true;
  if($('help').open)$('help').close();ignore=false;window.pet.passthrough(false);
  try{const state=await api('state');settings=state.settings;for(const k of ['name','nickname'])$(k).value=settings[k];$('top').checked=settings.top;$('screenshot-shortcut').checked=settings.screenshotShortcut;$('sound-enabled').checked=settings.soundEnabled;$('record-frame-rate').value=String(settings.recordFrameRate);$('save-directory').value=settings.saveDirectory;$('save-directory').placeholder=state.fileDirectory;$('save-directory').title=state.fileDirectory;window.lunaWeather.fill(settings.weatherLocation);$('settings-status').textContent='';$('settings').hidden=false;window.uiSound('open');}catch(e){showMessage(e.message);}
};
function closeSheets(){for(const name of ['library','recording','reminder'])$(name+'-sheet').hidden=true;}
function openSheet(name){if($('help').open)$('help').close();$('settings').hidden=true;$('wardrobe').hidden=true;closeSheets();ignore=false;window.pet.passthrough(false);$(name+'-sheet').hidden=false;showControls();window.uiSound('open');if(['library','reminder'].includes(name))$(name+'-frame').contentWindow.refresh?.();}
function closeSheet(name){$(name+'-sheet').hidden=true;window.uiSound('close');}
function hoverSheet(){if(ignore){ignore=false;window.pet.passthrough(false);}showControls();}
async function focusSheet(){hoverSheet();return api('panel-focus');}
window.lunaPanels={openSettings,openHelp,openSheet,closeSheet,hoverSheet,focusSheet};
window.pet.onPanel(name=>{if(name==='settings')openSettings();else if(name==='help')openHelp();else if(['library','recording','reminder'].includes(name))openSheet(name);});
$('settings-close').onclick=()=>{$('settings').hidden=true;window.uiSound('close');};
async function openWardrobe(){closeSheets();if($('help').open)$('help').close();$('settings').hidden=true;ignore=false;window.pet.passthrough(false);try{const state=await api('state');$('hair').value=state.settings.hair;$('outfit').value=state.settings.outfit;previewLook();wardrobeTab('hair');$('wardrobe-status').textContent='';$('wardrobe').hidden=false;window.uiSound('open');}catch(error){showMessage(error.message);}}
$('wardrobe-button').onclick=openWardrobe;$('wardrobe-close').onclick=()=>{$('wardrobe').hidden=true;window.uiSound('close');};
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!$('wardrobe').hidden){$('wardrobe').hidden=true;window.uiSound('close');}});
$('wardrobe-form').onsubmit=async event=>{event.preventDefault();const save=$('wardrobe-form').querySelector('button[type=submit]');save.disabled=true;try{const state=await api('appearance',{hair:$('hair').value,outfit:$('outfit').value});settings=state.settings;await appearance($('pet'),settings.hair,settings.outfit);window.lunaCharacter.react('wardrobe');$('wardrobe').hidden=true;showMessage('换好啦。');}catch(error){$('wardrobe-status').textContent=error.message;}finally{save.disabled=false;}};
$('settings-form').onsubmit=async e=>{e.preventDefault();const input={name:$('name').value,nickname:$('nickname').value,top:$('top').checked,screenshotShortcut:$('screenshot-shortcut').checked,soundEnabled:$('sound-enabled').checked,saveDirectory:$('save-directory').value,recordFrameRate:Number($('record-frame-rate').value),weatherLocation:window.lunaWeather.getLocation()};
  try{const state=await api('settings',input);settings=state.settings;appearance($('pet'),settings.hair,settings.outfit);document.title=settings.name+' · 桌面宠物';$('settings').hidden=true;window.lunaWeather.changed();showMessage('好，我记住你的设置啦。');}catch(err){$('settings-status').textContent=err.message;}
};
$('pet').onclick=()=>{if(dragging){dragging=false;return;}rest(false);happy(['今天也一起慢慢来吧。','被你发现我在发呆了。','见到你，心情就变好啦。'][Math.floor(Math.random()*3)]);};
$('pet').onpointerdown=e=>{if(e.button!==0)return;dragStart={x:e.screenX,y:e.screenY};dragging=false;$('pet').setPointerCapture(e.pointerId);};
$('pet').onpointermove=e=>{if(dragStart&&!dragging&&Math.hypot(e.screenX-dragStart.x,e.screenY-dragStart.y)>5){dragging=true;window.pet.drag(true);}};
function endDrag(){if(dragStart&&dragging)window.pet.drag(false);dragStart=null;}
$('pet').onpointerup=endDrag;$('pet').onpointercancel=endDrag;window.addEventListener('blur',endDrag);
let dropDepth=0;
let beforeDropText='';
document.addEventListener('mousemove',e=>{const controls=overControls(e.clientX,e.clientY);if(controls||e.target.closest('#pet,.petbar,.bottom-sheet')||dragStart)showControls();else leaveControls();const value=!controls&&!$('help').open&&!dropDepth&&!e.target.closest('.interactive')&&!dragStart;if(value!==ignore){ignore=value;window.pet.passthrough(value);}});
document.addEventListener('mouseleave',e=>{if(overControls(e.clientX,e.clientY)||dragStart){showControls();if(ignore){ignore=false;window.pet.passthrough(false);}return;}leaveControls();if(!$('library-sheet').hidden||!$('recording-sheet').hidden||!$('reminder-sheet').hidden||!$('wardrobe').hidden)return;if(!$('help').open&&!dragStart&&!dropDepth){ignore=true;window.pet.passthrough(true);}});
document.addEventListener('dragenter',e=>{e.preventDefault();if(!dropDepth)beforeDropText=$('bubble').textContent;dropDepth++;$('companion').classList.add('drop-ready');showMessage('放到这里，我会帮你收藏。',0);ignore=false;window.pet.passthrough(false);});
document.addEventListener('dragover',e=>{e.preventDefault();e.dataTransfer.dropEffect='copy';});
document.addEventListener('dragleave',()=>{dropDepth=Math.max(0,dropDepth-1);if(!dropDepth){$('companion').classList.remove('drop-ready');showMessage(beforeDropText);ignore=true;window.pet.passthrough(true);}});
document.addEventListener('drop',async e=>{
  e.preventDefault();dropDepth=0;$('companion').classList.remove('drop-ready');
  rest(false);
  showMessage('正在收藏…',0);
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
        if(failed.length && saved)showMessage(feedback.getMessage()+`另有 ${failed.length} 个未成功。`);
      }
    }else{
      const content=droppedText(e.dataTransfer);
      if(!content)throw Error('没有识别到文件、文字或链接。');
      const item=await api('collection-add-text',content);
      happy(item.kind==='link'?'链接收好啦。':'文字收好啦。');
    }
  }catch(error){showMessage(error.message);}
});
function blink(){if(!sleeping&&!$('pet').classList.contains('happy')){$('pet').classList.add('blink');setTimeout(()=>$('pet').classList.remove('blink'),140);}setTimeout(blink,3200+Math.random()*2400);}setTimeout(blink,3000);
(async()=>{try{const s=await api('state');settings=s.settings;appearance($('pet'),settings.hair,settings.outfit);rest(s.sleeping===true);document.title=settings.name+' · 桌面宠物';window.lunaWeather.refresh();}catch(e){showMessage('初始化失败：'+e.message);}})();
