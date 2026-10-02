(()=>{
  const el=id=>document.getElementById(id);
  const call=async(name,payload)=>{const r=await window.pet.call(name,payload);if(!r.ok)throw Error(r.error);return r.value;};
  let draft=null,places=[],revision=0,settingsRevision=0,busy=false,requesting=false,lastCheck=0;
  function clock(date=new Date()){
    const hour=date.getHours(),kind=hour<5?'night':hour<8?'sunrise':hour<17?'day':hour<20?'sunset':'night';
    const sky=el('day-cycle');sky.dataset.period=kind;
    const period={sunrise:'清晨',day:'白天',sunset:'傍晚',night:'夜晚'}[kind];
    sky.setAttribute('aria-label',period);sky.closest('.clock-block').title=period;
    el('calendar-weekday').textContent=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][date.getDay()];
  }
  clock();setInterval(clock,30000);
  function show(data){
    const {reading:r,status,location}=data;
    el('weather-city').textContent=location?.name||'今日陪伴';
    el('weather-temperature').textContent=r?`${Math.round(r.temperature)}°`:'天气';
    el('weather-description').textContent=r?r.label:status==='unset'?'选择城市':'暂不可用';
    el('weather-icon').dataset.kind=r?r.kind:'unset';el('weather-icon').classList.toggle('night',!!r&&!r.day);
    el('weather-status').textContent=status==='stale'?'旧数据':status==='unavailable'?'离线':status==='unset'?'✦':'已更新';
    const title=status==='unset'?'点击设置城市或自动定位':`${location.name} · ${r?`${r.label} ${r.temperature}°C · `:''}${status==='stale'?'连接失败，显示上次天气 · ':''}点击刷新（每 30 分钟更新） · Open-Meteo`;
    el('weather-button').title=title;el('weather-button').setAttribute('aria-label',title);el('weather-city').title=location?.detail||'';
    el('today-panel').dataset.weatherStatus=status;
  }
  async function refresh(){
    if(requesting)return;requesting=true;lastCheck=Date.now();const token=revision;
    el('weather-button').classList.add('loading');
    try{const data=await call('weather-current');if(token===revision)show(data);}
    catch{if(token===revision){el('weather-description').textContent='连接失败';el('weather-status').textContent='稍后重试';}}
    finally{requesting=false;el('weather-button').classList.remove('loading');if(token!==revision)refresh();}
  }
  el('weather-button').onclick=()=>{if(el('today-panel').dataset.weatherStatus==='unset')window.lunaPanels.openSettings();else refresh();};
  setInterval(refresh,30*60*1000);
  window.addEventListener('focus',()=>{clock();if(Date.now()-lastCheck>=30*60*1000)refresh();});
  function selected(){el('weather-selected').textContent=draft?`${draft.name}${draft.source==='ip'?' · IP 定位':''}`:'未设置城市';el('weather-selected').title=draft?.detail||'';}
  function fill(place){settingsRevision++;draft=place;places=[];el('weather-results').hidden=true;el('weather-query').value=place?.name||'';el('weather-setting-status').textContent='';selected();}
  function loading(value){busy=value;for(const id of ['weather-locate','weather-search','weather-clear'])el(id).disabled=value;el('weather-results').disabled=value;}
  async function find(auto){
    if(busy)return;loading(true);const token=settingsRevision;
    el('weather-setting-status').textContent=auto?'正在定位城市…':'正在搜索…';
    try{
      const found=await call(auto?'weather-locate':'weather-search',auto?undefined:el('weather-query').value);
      if(token!==settingsRevision)return;
      if(auto){draft=found;el('weather-query').value=found.name;el('weather-results').hidden=true;selected();el('weather-setting-status').textContent='';}
      else{
        places=found;const select=el('weather-results');select.replaceChildren();
        const hint=document.createElement('option');hint.value='';hint.textContent='请选择匹配的城市';select.append(hint);
        places.forEach((place,i)=>{const option=document.createElement('option');option.value=String(i);option.textContent=`${place.name} · ${place.detail}`;select.append(option);});
        select.hidden=!places.length;el('weather-setting-status').textContent=places.length?'':'没有找到，可尝试拼音或加上省份。';
      }
    }catch(error){if(token===settingsRevision)el('weather-setting-status').textContent=/[\u4e00-\u9fff]/.test(error.message)?error.message:'连接失败，请检查网络或稍后重试。';}
    finally{loading(false);}
  }
  el('weather-locate').onclick=()=>find(true);el('weather-search').onclick=()=>find(false);
  el('weather-query').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();find(false);}};
  el('weather-results').onchange=e=>{if(e.target.value==='')return;draft=places[Number(e.target.value)]||draft;selected();};
  el('weather-clear').onclick=()=>fill(null);
  document.querySelectorAll('[data-provider]').forEach(button=>{button.onclick=()=>call('weather-provider',button.dataset.provider).catch(()=>{el('weather-setting-status').textContent='暂时无法打开浏览器。';});});
  window.lunaWeather={fill,getLocation:()=>draft,changed:()=>{revision++;show({status:'unset'});refresh();},refresh,updateTime:clock};
})();
