const IDLE_SECONDS=5*60;
function startIdleMonitor({powerMonitor,readIdleSeconds=()=>powerMonitor.getSystemIdleTime(),getWindow,threshold=IDLE_SECONDS,interval=2000,schedule=setInterval,cancel=clearInterval}){
  let sleeping=false,locked=false,suspended=false,stopped=false;
  function check(force=false){
    if(stopped)return;
    const window=getWindow();if(!window||window.isDestroyed())return;
    let idleSeconds;
    try{idleSeconds=readIdleSeconds();}catch{return;}
    if(!Number.isFinite(idleSeconds)||idleSeconds<0)return;
    const next=locked||suspended||idleSeconds>=threshold;
    if(force||next!==sleeping){sleeping=next;window.webContents.send('idle-changed',sleeping);}
  }
  const handlers={
    'lock-screen':()=>{locked=true;check();},
    'unlock-screen':()=>{locked=false;check();},
    suspend:()=>{suspended=true;check();},
    resume:()=>{suspended=false;check();}
  };
  for(const [event,handler] of Object.entries(handlers))powerMonitor.on(event,handler);
  const timer=schedule(check,interval);
  return {check,isSleeping:()=>sleeping,stop:()=>{
    if(stopped)return;stopped=true;cancel(timer);
    for(const [event,handler] of Object.entries(handlers))powerMonitor.removeListener(event,handler);
  }};
}
module.exports={startIdleMonitor,IDLE_SECONDS};
