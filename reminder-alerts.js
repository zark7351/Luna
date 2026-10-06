const REMINDER_SOUND_INTERVAL=15000;
function createReminderAlerts({getDue,isPaused,send,play,now=Date.now,interval=REMINDER_SOUND_INTERVAL}){
  let lastKey=null,lastSound=-Infinity,soundingId=null,stopped=false;
  function tick(){
    if(stopped||isPaused())return;
    const due=getDue(),first=due[0];
    const key=first?JSON.stringify([first.id,first.title,due.length]):'';
    if(key!==lastKey&&send(first?{id:first.id,title:first.title,remaining:due.length}:null)!==false)lastKey=key;
    if(!first){soundingId=null;lastSound=-Infinity;return;}
    const time=now();
    if(first.id!==soundingId||time-lastSound>=interval||time<lastSound){
      if(play()!==false){lastSound=time;soundingId=first.id;}
    }
  }
  return {tick,stop:()=>{stopped=true;}};
}
module.exports={createReminderAlerts,REMINDER_SOUND_INTERVAL};
