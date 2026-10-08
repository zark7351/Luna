(function(root){
  function createPetFeedback({render,schedule=setTimeout,cancel=clearTimeout,duration=4500,translate=text=>text}){
    let message='',pending=[],messageDelay=duration,reminder=null,timer=null,version=0,stopped=false;
    const emit=()=>{if(!stopped)render({message:reminder?translate('到时间啦：')+reminder.title+(reminder.remaining>1?translate('（还有 ')+(reminder.remaining-1)+translate(' 条）'):''):message,hasNext:!reminder&&pending.length>0,reminder:reminder?{...reminder}:null});};
    function clearTimer(){version++;if(timer!==null)cancel(timer);timer=null;}
    function expire(){
      if(message&&messageDelay>0){const current=version;timer=schedule(()=>{if(stopped||version!==current)return;timer=null;message='';pending=[];emit();},messageDelay);}
    }
    function show(text,delay=duration){
      if(stopped||reminder)return false;clearTimer();pending=(Array.isArray(text)?text:[text]).map(value=>String(value||'')).filter(Boolean);message=pending.shift()||'';messageDelay=delay;emit();expire();return true;
    }
    function advance(){
      if(stopped||reminder)return false;clearTimer();message=pending.shift()||'';emit();expire();return true;
    }
    function updateReminder(value){
      if(stopped)return;
      if(value){clearTimer();message='';pending=[];reminder={id:value.id,title:value.title,remaining:value.remaining};emit();}
      else if(reminder){reminder=null;message='';emit();}
    }
    function update(text){if(stopped||reminder||!message)return false;message=String(text||'');emit();return true;}
    emit();return {show,update,advance,updateReminder,getMessage:()=>message,getReminder:()=>reminder?{...reminder}:null,stop:()=>{clearTimer();pending=[];stopped=true;}};
  }
  if(typeof module==='object')module.exports={createPetFeedback};else root.createPetFeedback=createPetFeedback;
})(globalThis);
