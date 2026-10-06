const $=id=>document.getElementById(id);
const api=async(name,payload)=>{const r=await window.pet.call(name,payload);if(!r.ok)throw Error(r.error);return r.value;};
let items=[],activeTab='media';
const category=item=>item.kind==='file'?(item.mediaType?'media':'files'):item.kind==='link'?'links':'text';
function button(label,fn,extra=''){const b=document.createElement('button');b.textContent=label;if(extra)b.className=extra;b.onclick=fn;return b;}
function makeIcon(icon){return window.lunaIcons.create(icon);}
function iconButton(icon,label,fn,extra=''){
  const b=button('',fn,extra);b.title=label;b.setAttribute('aria-label',label);b.append(makeIcon(icon));b.dataset.uiSound='none';return b;
}
async function operate(name,item,message){try{await api(name,item.id);if(message)$('status').textContent=message;}catch(e){$('status').textContent=e.message;}}
let knownItems=null;
function render(newIds=new Set(),enter=false){
  const query=$('search').value.trim().toLocaleLowerCase();
  const shown=items.filter(item=>category(item)===activeTab&&(item.title+' '+(item.content||'')+' '+(item.linkPreview?.title||'')+' '+(item.linkPreview?.description||'')).toLocaleLowerCase().includes(query));
  for(const tab of $('tabs').querySelectorAll('[role=tab]')){
    const selected=tab.dataset.tab===activeTab;tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;
    tab.querySelector('span').textContent=items.filter(item=>category(item)===tab.dataset.tab).length;
  }
  $('items').setAttribute('aria-labelledby','tab-'+activeTab);
  for(const video of $('items').querySelectorAll('video')){video.pause();video.removeAttribute('src');video.load();}
  $('items').replaceChildren();
  if(!shown.length){const empty=document.createElement('div');empty.className='empty';empty.textContent=query?'没有匹配的收藏':'暂无收藏';$('items').append(empty);return;}
  for(const item of shown){
    const card=document.createElement('article');card.className='item'+(item.kind==='file'&&!item.mediaType?' file-item':'');card.dataset.id=item.id;
    card.setAttribute('aria-label',item.title);card.title=item.title;
    if(item.kind==='file'){
      const stage=document.createElement('div');stage.className='preview-stage';
      const fallback=document.createElement('div');fallback.className='media-fallback';fallback.hidden=true;fallback.textContent='无法预览';
      if(item.previewUrl){
        const isVideo=item.mediaType.startsWith('video/');
        const media=document.createElement(isVideo?'video':'img');media.className='media-preview';
        media.onerror=()=>{media.hidden=true;fallback.hidden=false;};
        if(isVideo){
          media.controls=true;media.preload='metadata';media.playsInline=true;media.setAttribute('aria-label',item.title+' 视频预览');
          media.onloadedmetadata=()=>{if(Number.isFinite(media.duration)&&media.duration>0)media.currentTime=Math.min(.1,media.duration/2);};
          media.onplay=()=>{for(const other of $('items').querySelectorAll('video'))if(other!==media)other.pause();};
        }else{
          media.alt='图片预览';media.loading='lazy';media.tabIndex=0;media.title='打开图片';
          media.onclick=()=>operate('collection-open',item);media.onkeydown=e=>{if(e.key==='Enter')media.click();};
        }
        media.src=item.previewUrl;stage.append(media);
      }else{
        const icon=document.createElement('img');icon.className='file-icon';icon.alt='文件图标';
        api('collection-file-icon',item.id).then(url=>{if(icon.isConnected)icon.src=url;}).catch(()=>{icon.hidden=true;fallback.hidden=false;fallback.textContent='文件不可用';});
        stage.append(icon);
      }
      stage.append(fallback);card.append(stage);
      if(!item.mediaType){const filename=document.createElement('div');filename.className='file-name';filename.textContent=item.title;card.append(filename);}
    }else if(item.kind==='link'){
      const preview=item.linkPreview||{};
      const link=document.createElement('div');link.className='web-card';link.tabIndex=0;link.setAttribute('role','link');link.title='打开网页';link.onclick=()=>operate('collection-open',item);link.onkeydown=e=>{if(e.key==='Enter')link.click();};
      const cover=document.createElement('div');cover.className='web-cover';
      if(typeof preview.image==='string'&&preview.image.startsWith('data:image/jpeg;base64,')){
        const img=document.createElement('img');img.src=preview.image;img.alt='网页封面';img.loading='lazy';img.onerror=()=>{img.remove();cover.append(makeIcon('web'));};cover.append(img);
      }else cover.append(makeIcon('web'));
      const details=document.createElement('div');details.className='web-details';
      const title=document.createElement('div');title.className='web-title';title.textContent=preview.title||new URL(item.content).hostname;
      const description=document.createElement('div');description.className='web-description';description.textContent=preview.description||(preview.status==='ready'?'':'获取预览中…');
      const address=document.createElement('div');address.className='web-address';address.textContent=item.content;
      details.append(title,description,address);link.append(cover,details);card.append(link);
    }else{
      const preview=document.createElement('div');preview.className='item-preview';preview.textContent=item.content;card.append(preview);
      if(item.kind==='link'){preview.classList.add('link-preview');preview.tabIndex=0;preview.setAttribute('role','link');preview.title='打开链接';preview.onclick=()=>operate('collection-open',item);preview.onkeydown=e=>{if(e.key==='Enter')preview.click();};}
      if(item.content.length>160)card.append(iconButton('expand','展开内容',e=>{preview.classList.toggle('expanded');const expanded=preview.classList.contains('expanded');window.uiSound(expanded?'open':'close');e.currentTarget.classList.toggle('is-expanded',expanded);e.currentTarget.title=expanded?'收起内容':'展开内容';e.currentTarget.setAttribute('aria-label',e.currentTarget.title);},'expand'));
    }
    const actions=document.createElement('div');actions.className='actions';
    actions.append(iconButton('copy',item.kind==='file'?'复制文件':'复制内容',()=>operate('collection-copy',item,'已复制')));
    if(item.kind==='file')actions.append(iconButton('folder','打开所在文件夹',()=>operate('collection-reveal',item)));
    if(item.kind==='link')actions.append(iconButton('refresh','重新获取网页预览',async e=>{const b=e.currentTarget;b.disabled=true;try{await api('collection-link-preview',item.id);await refresh();}catch(error){$('status').textContent=error.message;}finally{b.disabled=false;}}));
    actions.append(iconButton('trash','删除收藏',async()=>{
      const message=item.kind==='file'?(item.storage==='reference'?'移除这条收藏？不会删除原文件。':'删除这条收藏？露娜保存的副本也会删除。'):'删除这条收藏？';
      if(!confirm(message))return;
      try{await api('collection-delete',item.id);await refresh();$('status').textContent='已删除。';}catch(e){$('status').textContent=e.message;}
    },'danger'));
    card.append(actions);$('items').append(card);if(newIds.has(item.id)||enter&&$('items').children.length<=6)window.lunaEffects.pulse(card,'enter');
  }
}
for(const tab of $('tabs').querySelectorAll('[role=tab]')){
  tab.onclick=()=>{activeTab=tab.dataset.tab;$('status').textContent='';render(new Set(),true);};
  tab.onkeydown=e=>{const all=Array.from($('tabs').children);let index=all.indexOf(tab);if(e.key==='ArrowRight')index=(index+1)%all.length;else if(e.key==='ArrowLeft')index=(index+all.length-1)%all.length;else if(e.key==='Home')index=0;else if(e.key==='End')index=all.length-1;else return;e.preventDefault();all[index].click();all[index].focus();};
}
async function refresh(){try{items=await api('collection-list');const added=new Set(knownItems?items.filter(item=>!knownItems.has(item.id)).map(item=>item.id):[]);knownItems=new Set(items.map(item=>item.id));render(added);}catch(e){$('status').textContent=e.message;}}
$('search').oninput=()=>render();$('refresh').onclick=refresh;
$('add-file').onclick=async()=>{try{const result=await api('library-add-files');if(result.saved){$('status').textContent=`已收藏 ${result.saved} 个文件。`;await refresh();}else if(result.failed.length)$('status').textContent=result.failed[0];}catch(e){$('status').textContent=e.message;}};
let pasting=false;
async function pasteClipboard(){
  if(pasting)return;pasting=true;$('paste').disabled=true;
  try{
    const result=await api('collection-add-clipboard');
    if(result.kind==='files'){
      if(result.saved){activeTab=result.items.some(item=>item.mediaType)?'media':'files';$('search').value='';await refresh();}
      $('status').textContent=(result.saved?`已收藏 ${result.saved} 个文件。`:'')+(result.failed.length?` ${result.failed.length} 个失败：${result.failed[0]}`:'');
    }else{activeTab=category(result);$('search').value='';await refresh();$('status').textContent=result.kind==='link'?'剪贴板链接已收藏。':'剪贴板文字已收藏。';}
  }catch(e){$('status').textContent=e.message;}finally{pasting=false;$('paste').disabled=false;}
}
$('paste').onclick=pasteClipboard;
document.addEventListener('paste',event=>{if(event.target.closest('input,textarea,[contenteditable="true"]'))return;event.preventDefault();pasteClipboard();});
window.pet.onCollectionUpdated(refresh);window.pet.onEffect(name=>{if(window.parent===window&&['collect','capture','recording'].includes(name))window.lunaEffects.burst(name);});refresh();

$('screenshot-button').onclick=async()=>{try{await api('screenshot-start');}catch(e){$('status').textContent=e.message;}};
window.pet.onScreenshotMessage(value=>{if(value.saved){activeTab='media';$('search').value='';refresh();}$('status').textContent=value.message;});
function shortcutHint(status){$('screenshot-button').title=status.enabled?(status.available?'截图收藏 · Ctrl+Alt+A':'截图收藏 · 快捷键被占用，请点击图标'):'截图收藏 · 快捷键已关闭';}
window.pet.onScreenshotShortcutChanged(shortcutHint);
api('screenshot-shortcut').then(shortcutHint).catch(()=>{});

$('expand-library').onclick=async()=>{try{await api('library-expand',{tab:activeTab,query:$('search').value});window.parent.lunaPanels.closeSheet('library');}catch(e){$('status').textContent=e.message;}};
$('close-library').onclick=()=>window.parent!==window?window.parent.lunaPanels.closeSheet('library'):api('library-window','close');
$('maximize-library').onclick=()=>api('library-window','maximize');
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!document.fullscreenElement){if(window.parent!==window)window.parent.lunaPanels.closeSheet('library');else api('library-window','close');}});

let statusTimer;new MutationObserver(()=>{clearTimeout(statusTimer);if($('status').textContent)statusTimer=setTimeout(()=>$('status').textContent='',4500);}).observe($('status'),{childList:true,characterData:true,subtree:true});

window.pet.onLibraryView(value=>{if(!['media','files','text','links'].includes(value.tab))return;activeTab=value.tab;$('search').value=value.query;render();});

document.addEventListener('drop',async event=>{event.preventDefault();try{const files=Array.from(event.dataTransfer.files);if(files.length){const result=await window.pet.saveDroppedFiles(files);if(!result.ok)throw Error(result.error);if(!result.value.saved)throw Error(result.value.failed[0]||'未收到文件');await refresh();activeTab=category(items[0]);$('search').value='';render();$('status').textContent='已收藏'+(result.value.failed.length?'，部分文件未成功':'');}else{const content=event.dataTransfer.getData('text/uri-list').split(/\r?\n/).find(line=>line&&!line.startsWith('#'))||event.dataTransfer.getData('text/plain');const item=await api('collection-add-text',content);activeTab=category(item);$('search').value='';await refresh();$('status').textContent='已收藏';}}catch(error){$('status').textContent=error.message;}});
