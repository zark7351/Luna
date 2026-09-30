const $=id=>document.getElementById(id);
const api=async(name,payload)=>{const r=await window.pet.call(name,payload);if(!r.ok)throw Error(r.error);return r.value;};
let items=[];
function button(label,fn,extra='') {const b=document.createElement('button');b.textContent=label;if(extra)b.className=extra;b.onclick=fn;return b;}
function render(){
  const query=$('search').value.trim().toLocaleLowerCase();
  const shown=items.filter(item=>(item.title+' '+(item.content||'')).toLocaleLowerCase().includes(query));
  $('items').replaceChildren();
  if(!shown.length){const empty=document.createElement('div');empty.className='empty';empty.textContent=items.length?'没有找到匹配的收藏。':'还没有收藏。把文件、文字或链接拖给露娜吧。';$('items').append(empty);return;}
  for(const item of shown){
    const card=document.createElement('article');card.className='item';
    const head=document.createElement('div');head.className='item-head';
    const title=document.createElement('div');title.className='item-title';title.textContent=item.title;
    const kind=document.createElement('span');kind.className='item-kind';kind.textContent={file:'文件',link:'链接',text:'文字'}[item.kind]||'收藏';
    head.append(title,kind);card.append(head);
    const time=document.createElement('div');time.className='item-time';time.textContent=new Date(item.createdAt).toLocaleString();card.append(time);
    let preview;
    if(item.content){preview=document.createElement('div');preview.className='item-preview';preview.textContent=item.content;card.append(preview);}
    const actions=document.createElement('div');actions.className='actions';
    if(item.kind!=='text')actions.append(button('打开',async()=>{try{await api('collection-open',item.id);}catch(e){$('status').textContent=e.message;}}));
    if(item.kind!=='file')actions.append(button('复制',async()=>{try{await api('collection-copy',item.id);$('status').textContent='已复制到剪贴板。';}catch(e){$('status').textContent=e.message;}}));
    if(preview && item.content.length>160)actions.append(button('展开',e=>{preview.classList.toggle('expanded');e.currentTarget.textContent=preview.classList.contains('expanded')?'收起':'展开';}));
    actions.append(button('删除',async()=>{if(!confirm('删除这条收藏？文件副本也会删除。'))return;try{await api('collection-delete',item.id);await refresh();$('status').textContent='已删除。';}catch(e){$('status').textContent=e.message;}},'danger'));
    card.append(actions);$('items').append(card);
  }
}
async function refresh(){try{items=await api('collection-list');render();}catch(e){$('status').textContent=e.message;}}
$('search').oninput=render;
$('refresh').onclick=refresh;
$('add-file').onclick=async()=>{try{const result=await api('library-add-files');if(result.saved){$('status').textContent=`已收藏 ${result.saved} 个文件。`;await refresh();}else if(result.failed.length)$('status').textContent=result.failed[0];}catch(e){$('status').textContent=e.message;}};
$('paste').onclick=async()=>{try{const item=await api('collection-add-clipboard');$('status').textContent=item.kind==='link'?'剪贴板链接已收藏。':'剪贴板文字已收藏。';await refresh();}catch(e){$('status').textContent=e.message;}};
window.pet.onCollectionUpdated(refresh);
refresh();
