const $=id=>document.getElementById(id);
let settings, sleeping=false, happyTimer, dragStart, dragging=false, ignore=false;
const api=async(name,payload)=>{const r=await window.pet.call(name,payload);if(!r.ok)throw Error(r.error);return r.value;};
function happy(text){if(sleeping)return;$('bubble').textContent=text;clearTimeout(happyTimer);$('pet').classList.remove('blink');$('pet').classList.add('happy');happyTimer=setTimeout(()=>$('pet').classList.remove('happy'),1900);}
function droppedText(data){
  const uri=data.getData('text/uri-list').split(/\r?\n/).find(line=>line && !line.startsWith('#'));
  return (uri || data.getData('text/plain') || '').trim();
}

$('hide').onclick=()=>api('hide');
$('library-button').onclick=async()=>{try{await api('library-show');}catch(e){$('bubble').textContent=e.message;}};
$('sleep').onclick=()=>{sleeping=!sleeping;$('pet').classList.toggle('sleeping',sleeping);$('pet').classList.remove('happy','blink');$('sleep').textContent=sleeping?'☀ 唤醒':'☾ 休息';$('bubble').textContent=sleeping?'小憩一下，叫我就好。':'醒来就能见到你，真好。';};
$('settings-button').onclick=async()=>{
  try{const state=await api('state');settings=state.settings;for(const k of ['name','nickname'])$(k).value=settings[k];$('top').checked=settings.top;$('settings-status').textContent='';$('settings').hidden=false;}catch(e){$('bubble').textContent=e.message;}
};
$('settings-close').onclick=()=>{$('settings').hidden=true;};
$('settings-form').onsubmit=async e=>{e.preventDefault();const input={name:$('name').value,nickname:$('nickname').value,top:$('top').checked};
  try{const state=await api('settings',input);settings=state.settings;document.title=settings.name+' · 桌面宠物';$('settings').hidden=true;$('bubble').textContent='好，我记住你的设置啦。';}catch(err){$('settings-status').textContent=err.message;}
};
$('pet').onclick=()=>{if(dragging){dragging=false;return;}if(sleeping){$('sleep').click();return;}happy(['今天也一起慢慢来吧。','被你发现我在发呆了。','见到你，心情就变好啦。'][Math.floor(Math.random()*3)]);};
$('pet').onpointerdown=e=>{if(e.button!==0)return;dragStart={x:e.screenX,y:e.screenY};dragging=false;$('pet').setPointerCapture(e.pointerId);};
$('pet').onpointermove=e=>{if(dragStart&&!dragging&&Math.hypot(e.screenX-dragStart.x,e.screenY-dragStart.y)>5){dragging=true;window.pet.drag(true);}};
function endDrag(){if(dragStart&&dragging)window.pet.drag(false);dragStart=null;}
$('pet').onpointerup=endDrag;$('pet').onpointercancel=endDrag;window.addEventListener('blur',endDrag);
let dropDepth=0;
let beforeDropText='';
document.addEventListener('mousemove',e=>{const value=!dropDepth&&!e.target.closest('.interactive')&&!dragStart;if(value!==ignore){ignore=value;window.pet.passthrough(value);}});
document.addEventListener('mouseleave',()=>{if(!dragStart&&!dropDepth){ignore=true;window.pet.passthrough(true);}});
document.addEventListener('dragenter',e=>{e.preventDefault();if(!dropDepth)beforeDropText=$('bubble').textContent;dropDepth++;$('companion').classList.add('drop-ready');$('bubble').textContent='放到这里，我会帮你收藏。';ignore=false;window.pet.passthrough(false);});
document.addEventListener('dragover',e=>{e.preventDefault();e.dataTransfer.dropEffect='copy';});
document.addEventListener('dragleave',()=>{dropDepth=Math.max(0,dropDepth-1);if(!dropDepth){$('companion').classList.remove('drop-ready');$('bubble').textContent=beforeDropText;ignore=true;window.pet.passthrough(true);}});
document.addEventListener('drop',async e=>{
  e.preventDefault();dropDepth=0;$('companion').classList.remove('drop-ready');
  if(sleeping)$('sleep').click();
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
(async()=>{try{const s=await api('state');settings=s.settings;document.title=settings.name+' · 桌面宠物';}catch(e){$('bubble').textContent='初始化失败：'+e.message;}})();
