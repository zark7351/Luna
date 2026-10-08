(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.createAngerInteraction=factory().createAngerInteraction;})(globalThis,()=>{
  function createAngerInteraction({now=Date.now,schedule=setTimeout,cancel=clearTimeout,onStage=()=>{}}={}){
    let phase='normal',deadline=0,extra=0,timer=null,expiry=null,stopped=false;
    const stage=value=>{phase=value;onStage(value);};
    function furious(){if(stopped)return;cancel(expiry);stage('furious');timer=schedule(()=>{timer=null;if(!stopped)stage('absent');},3000);}
    function trigger(){if(stopped||phase!=='normal')return false;deadline=now()+10000;extra=0;stage('angry');timer=schedule(()=>{timer=null;if(stopped)return;if(extra>=3)furious();else{stage('watching');expiry=schedule(()=>{expiry=null;if(!stopped)stage('normal');},Math.max(0,deadline-now()));}},3000);return true;}
    function click(region){if(stopped)return false;if(['angry','watching'].includes(phase)&&['chest','forbidden'].includes(region)&&now()<deadline){extra++;if(phase==='watching'&&extra>=3)furious();return true;}return ['angry','furious','absent'].includes(phase);}
    function returned(){cancel(timer);cancel(expiry);timer=expiry=null;extra=0;deadline=0;stage('returned');phase='normal';}
    function stop(){stopped=true;cancel(timer);cancel(expiry);timer=expiry=null;phase='normal';}
    return {trigger,click,returned,stop,get phase(){return phase;},get protected(){return ['angry','furious','absent'].includes(phase);}};
  }
  return {createAngerInteraction};
});
