// Collection organisation inside the real library window: "all" tab with day groups, global search, pinning,
// quick notes with duplicate merging, and reference files kept as copies. Saves big and small panel screenshots.
const fs = require('node:fs'),
  path = require('node:path');
async function check({ win, libraryWin, output }) {
  const result = await libraryWin.webContents.executeJavaScript(`(async()=>{let step='tabs';try{
    const wait=async(test,label)=>{const end=Date.now()+5000;while(!test()){if(Date.now()>end)throw Error('library wait: '+label);await new Promise(r=>setTimeout(r,40));}};
    const search=document.querySelector('#search');search.value='';search.dispatchEvent(new Event('input'));
    document.querySelector('#tab-all').click();
    const tabs=[...document.querySelectorAll('#tabs [role=tab]')];
    if(tabs.length!==5||tabs[0].dataset.tab!=='all'||tabs[0].getAttribute('aria-selected')!=='true')throw Error('all tab');
    if(Number(tabs[0].querySelector('span').textContent)!==items.length)throw Error('all tab count');
    if(document.querySelector('#items .group-title')?.textContent!=='今天')throw Error('day heading');
    step='search';
    // Search from a category tab still finds items of every kind.
    document.querySelector('#tab-files').click();search.value='测试文字收藏';search.dispatchEvent(new Event('input'));
    if(activeTab!=='all'||!document.querySelector('#items').textContent.includes('测试文字收藏'))throw Error('global search');
    search.value='';search.dispatchEvent(new Event('input'));
    step='pin';
    // Pin the text item: it moves under a pinned heading at the top.
    const textCard=[...document.querySelectorAll('#items .item')].find(card=>card.textContent.includes('测试文字收藏'));
    const textId=textCard.dataset.id;
    textCard.querySelector('.actions button').click();
    await wait(()=>document.querySelector('#items .group-title')?.textContent==='已置顶','pinned heading');
    const pinnedCard=document.querySelector('#items .item');
    if(pinnedCard.dataset.id!==textId||!pinnedCard.classList.contains('pinned')||!pinnedCard.querySelector('.pin-badge'))throw Error('pinned card');
    step='note';
    // Quick note, then the same note again merges instead of duplicating.
    const before=items.length;
    document.querySelector('#new-note').click();
    if(document.querySelector('#note-editor').hidden||document.activeElement!==document.querySelector('#note-text'))throw Error('note editor');
    document.querySelector('#note-text').value='露娜便签测试';
    document.querySelector('#note-text').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',ctrlKey:true,bubbles:true}));
    await wait(()=>items.length===before+1&&document.querySelector('#note-editor').hidden,'note saved');
    const noteStatus=document.querySelector('#status').textContent;
    document.querySelector('#new-note').click();document.querySelector('#note-text').value='露娜便签测试';
    document.querySelector('#note-editor').requestSubmit();
    await wait(()=>document.querySelector('#status').textContent==='已经收藏过了，移到最前面啦。','duplicate note');
    if(items.length!==before+1||noteStatus!=='便签已保存。')throw Error('note duplicate merge');
    step='note-escape';
    // Esc inside the editor only closes the editor.
    document.querySelector('#new-note').click();
    document.querySelector('#note-text').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
    if(!document.querySelector('#note-editor').hidden)throw Error('note escape');
    step='keep-copy';
    // A dropped local file is a reference: badge plus "keep a copy" turns it into a saved copy.
    document.querySelector('#tab-files').click();
    const fileCard=[...document.querySelectorAll('#items .item')].find(card=>card.textContent.includes('笔记.txt'));
    if(fileCard.querySelector('.storage-badge')?.textContent!=='引用')throw Error('reference badge');
    const keep=fileCard.querySelector('.actions button[aria-label="保存副本"]');
    if(!keep)throw Error('keep copy button');
    const fileId=fileCard.dataset.id;keep.click();
    await wait(()=>items.find(item=>item.id===fileId)?.storage==='copy','keep copy');
    const kept=document.querySelector('[data-id="'+fileId+'"]');
    if(kept.querySelector('.storage-badge')||kept.querySelector('.actions button[aria-label="保存副本"]'))throw Error('kept copy still marked');
    if(document.querySelector('#items .cleanup'))throw Error('cleanup shown without old items');
    document.querySelector('#tab-all').click();
    return {textId,fileId};}catch(e){throw Error('library step '+step+': '+(e&&e.message)+' | '+String(e&&e.stack||'').slice(0,400));}
  })()`);
  await new Promise(resolve => setTimeout(resolve, 250));
  fs.writeFileSync(path.join(output, 'luna-library-all.png'), (await libraryWin.webContents.capturePage()).toPNG());
  await win.webContents.executeJavaScript(`openSheet('library');void 0;`);
  await new Promise(resolve => setTimeout(resolve, 900));
  fs.writeFileSync(path.join(output, 'luna-library-sheet.png'), (await win.webContents.capturePage()).toPNG());
  await win.webContents.executeJavaScript(`window.lunaPanels.closeSheet('library');void 0;`);
  // Restore the pin, then wait for the library's own refresh so later steps never hold cards it is about to replace.
  await libraryWin.webContents.executeJavaScript(`(async()=>{
    const id=${JSON.stringify(result.textId)};
    await window.pet.call('collection-pin',{id,pinned:false});
    const end=Date.now()+3000;
    while(items.find(item=>item.id===id)?.pinned&&Date.now()<end)await new Promise(r=>setTimeout(r,40));
    await new Promise(r=>setTimeout(r,200));
  })()`);
  return {
    allTab: true,
    dayGroups: true,
    globalSearch: true,
    pin: true,
    quickNote: true,
    duplicateMerge: true,
    referenceBadge: true,
    keepCopy: true
  };
}
module.exports = { check };
