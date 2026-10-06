(function(root){
  function createPetFeedback({render,schedule=setTimeout,cancel=clearTimeout,duration=4500}){
    let message='',reminder=null,timer=null,version=0,stopped=false;
    const emit=()=>{if(!stopped)render({message:reminder?'到时间啦：'+reminder.title+(reminder.remaining>1?'（还有 '+(reminder.remaining-1)+' 条）':''):message,reminder:reminder?{...reminder}:null});};
    function clearTimer(){version++;if(timer!==null)cancel(timer);timer=null;}
    function show(text,delay=duration){
      if(stopped||reminder)return false;clearTimer();message=String(text||'');emit();
      if(message&&delay>0){const current=version;timer=schedule(()=>{if(stopped||version!==current)return;timer=null;message='';emit();},delay);}
      return true;
    }
    function updateReminder(value){
      if(stopped)return;
      if(value){clearTimer();message='';reminder={id:value.id,title:value.title,remaining:value.remaining};emit();}
      else if(reminder){reminder=null;message='';emit();}
    }
    emit();return {show,updateReminder,getMessage:()=>message,getReminder:()=>reminder?{...reminder}:null,stop:()=>{clearTimer();stopped=true;}};
  }
  if(typeof module==='object')module.exports={createPetFeedback};else root.createPetFeedback=createPetFeedback;
})(globalThis);
