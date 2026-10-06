// Visual feedback is independent of the global audio switch and only follows committed operations.
const effectNames=['collect','capture','recording','wardrobe','reminder-save','complete'];
function operationEffect(channel,value,input){
  if(['collection-add-files','collection-add-drop','library-add-files'].includes(channel)||channel==='collection-add-clipboard'&&value?.kind==='files')return value?.saved>0?'collect':null;
  if(['collection-add-text','collection-add-clipboard'].includes(channel))return value?.id?'collect':null;
  if(channel==='appearance')return 'wardrobe';
  if(channel==='reminder-save')return 'reminder-save';
  if(channel==='reminder-complete'||channel==='reminder-action'&&input?.action==='complete')return 'complete';
  return null;
}
module.exports={effectNames,operationEffect};
