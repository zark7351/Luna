// Only these packaged local pages are embedded; no remote documents or scripts are loaded.
if(window.parent!==window){
  window.pet=window.parent.pet;window.recorder=window.parent.recorder;window.reminder=window.parent.reminder;
  document.documentElement.classList.add('embedded');
}

// Dropped files must be collected, never navigate the packaged panel to a file.
document.addEventListener('dragover',event=>event.preventDefault());
document.addEventListener('drop',event=>event.preventDefault());

if(window.parent!==window)document.addEventListener('mousemove',()=>window.parent.lunaPanels?.hoverSheet());
if(window.parent!==window)document.addEventListener('pointerdown',event=>{
  const field=event.target.closest('input,textarea,select,[contenteditable="true"]');
  if(!field||field.disabled||field.readOnly)return;
  window.parent.lunaPanels?.focusSheet()?.then(focused=>{if(focused&&field.isConnected&&!document.hidden&&document.activeElement!==field)field.focus({preventScroll:true});}).catch(()=>{});
});
