(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.createShortcutBubbles=factory().createShortcutBubbles;})(globalThis,()=>{
  function dateText(date,language='zh-CN'){
    if(language==='en')return 'Today is '+date.toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'})+'.\nIt is '+date.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})+'.';
    const hour=date.getHours(),minute=date.getMinutes(),period=hour<6?'凌晨':hour<12?'上午':hour<13?'中午':hour<18?'下午':'晚上';
    const clock=(hour===0?'零':String(hour%12||12))+'点'+(minute===0?'整':String(minute).padStart(2,'0')+'分');
    return '今天是'+date.getFullYear()+'年'+(date.getMonth()+1)+'月'+date.getDate()+'日，星期'+['日','一','二','三','四','五','六'][date.getDay()]+'。\n现在是'+period+clock+'哦。';
  }
  function statsText(value,translate=text=>text){const percent=(number,pending)=>typeof number==='number'&&Number.isFinite(number)?Math.round(Math.max(0,Math.min(100,number)))+'%':pending?translate('读取中'):translate('暂不可用');return 'CPU '+percent(value?.cpu,value?.pending?.cpu)+(' · '+translate('内存')+' ' )+percent(value?.memory)+'\nGPU '+percent(value?.gpu,value?.pending?.gpu);}
  function weatherText(data,translate=text=>text){if(data?.status==='unset')return translate('先在设置里选择天气城市吧。');if(!data?.reading)return translate('天气暂时查询不到，请稍后再试。');return data.location.name+' · '+translate(data.reading.label)+' '+Math.round(data.reading.temperature)+'°C'+(data.status==='stale'?translate('\n上次天气 · 暂时离线'):'');}
  function createShortcutBubbles({show,update,requestStats,requestWeather,language=()=>'zh-CN',translate=text=>text,now=()=>new Date(),schedule=setTimeout,cancel=clearTimeout}){
    let revision=0,timer=null,expiry=null,kind=null,stopped=false;
    function stop(){revision++;if(timer!==null)cancel(timer);if(expiry!==null)cancel(expiry);timer=expiry=null;kind=null;}
    function start(action){
      stop();if(stopped)return false;kind=action;const token=revision;
      if(action==='datetime'){show(dateText(now(),language()),5000);expiry=schedule(stop,5000);return true;}
      if(action==='stats'){
        show(translate('正在读取系统信息…'),5000);expiry=schedule(stop,5000);
        const refresh=async()=>{if(token!==revision||stopped)return;try{const value=await requestStats();if(token===revision&&!stopped)update(statsText(value,translate));}catch{if(token===revision&&!stopped)update(statsText(null,translate));}if(token===revision&&!stopped)timer=schedule(refresh,1000);};refresh();return true;
      }
      if(action==='weather'){
        show(translate('正在查询天气…'),0);
        Promise.resolve().then(requestWeather).then(value=>{if(token===revision&&!stopped){show(weatherText(value,translate),5000);expiry=schedule(stop,5000);}}).catch(()=>{if(token===revision&&!stopped){show(translate('天气连接失败，请稍后再试。'),5000);expiry=schedule(stop,5000);}});return true;
      }
      stop();return false;
    }
    return {start,cancel:stop,get active(){return kind;},stop(){stopped=true;stop();}};
  }
  return {createShortcutBubbles,dateText,statsText,weatherText};
});
