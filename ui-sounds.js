// UI feedback is requested through the restricted bridge and global mute gate.
window.uiSound=name=>{const bridge=window.pet||window.reminder;bridge.call('ui-sound',name).catch(()=>{});};
document.addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button||button.disabled)return;
  if(button.dataset.uiSound==='none'||button.closest('#wardrobe-form')&&button.type==='submit'||button.closest('#settings-form')&&button.type==='submit')return;
  const id=button.id;
  if(['screenshot-button','recording-button','library-button','reminder-button','wardrobe-button','help-close','settings-close','wardrobe-close','settings-help','hide','add-file','paste','save'].includes(id)||id.startsWith('wardrobe-tab-'))return;
  if(button.getAttribute('role')==='tab'||['active','done'].includes(id)){if(button.getAttribute('aria-selected')!=='true'&&!button.classList.contains('selected'))window.uiSound('tab');return;}
  if(button.classList.contains('look-card')){if(button.getAttribute('aria-pressed')!=='true')window.uiSound('select');return;}
  window.uiSound(button.dataset.uiSound|| (button.dataset.minutes?'select':id==='refresh'?'refresh':'click'));
},true);
document.addEventListener('change',event=>{if(event.target.matches('input[type=checkbox]'))window.uiSound('toggle');});
