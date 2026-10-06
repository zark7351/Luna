const names=['click','tab','select','toggle','open','close','save','collect','copy','delete','refresh','error','capture-start','capture-done','capture-cancel','complete','snooze','reminder'];
function operationSound(channel,value,input,failed=false){
  const map={'settings':'save','appearance':'save','hide':'close','collection-add-text':'collect','collection-add-clipboard':'collect','collection-copy':'copy','collection-reveal':'open','collection-open':'open','collection-delete':'delete','collection-link-preview':'refresh','reminder-complete':'complete','reminder-save':'save','reminder-action':({complete:'complete',snooze:'snooze',delete:'delete'})[input?.action]};
  const batch=['collection-add-files','collection-add-drop','library-add-files'].includes(channel)||(channel==='collection-add-clipboard'&&value?.kind==='files');
  if(failed)return map[channel]||batch?'error':null;
  if(batch)return value?.saved>0?'collect':value?.failed?.length?'error':null;
  return map[channel]||null;
}
function createSoundDispatch({enabled,live,send,now=Date.now}){
  const last=new Map();
  return name=>{if(!names.includes(name)||!enabled()||!live())return false;const time=now();if(name!=='reminder'&&time-(last.get(name)??-Infinity)<85)return false;last.set(name,time);send(name);return true;};
}
module.exports={names,operationSound,createSoundDispatch};
