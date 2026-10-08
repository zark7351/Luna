(()=>{
  const t=window.lunaI18n.t;
  const el=id=>document.getElementById(id),call=async(name,payload)=>{const r=await window.pet.call(name,payload);if(!r.ok)throw Error(t(r.error));return r.value;};
  let draft=null,revision=0,stopped=false;
  function selected(){el('weather-selected').textContent=draft?draft.name:t('未选择城市');}
  function fill(place){revision++;draft=place;el('weather-query').value=place?.name||'';el('weather-results').hidden=true;el('weather-setting-status').textContent='';selected();}
  async function find(auto){
    const token=++revision;el('weather-setting-status').textContent=auto?t('正在定位…'):t('正在搜索…');
    try{
      const value=await call(auto?'weather-locate':'weather-search',auto?undefined:el('weather-query').value);if(stopped||token!==revision)return;
      el('weather-setting-status').textContent='';
      if(auto){fill(value);return;}
      const results=el('weather-results');results.replaceChildren();results.hidden=!value.length;
      for(const place of value){const button=document.createElement('button');button.type='button';button.textContent=place.name+' · '+place.detail;button.onclick=()=>fill(place);results.append(button);}
      if(!value.length)el('weather-setting-status').textContent=t('没有找到，可试试拼音。');
    }catch(error){if(!stopped&&token===revision)el('weather-setting-status').textContent=t(error.message||'连接失败，请稍后再试。');}
  }
  el('weather-search').onclick=()=>find(false);el('weather-locate').onclick=()=>find(true);
  el('weather-query').oninput=()=>{revision++;};el('weather-query').onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();find(false);}};
  window.addEventListener('pagehide',()=>{stopped=true;revision++;});
  window.addEventListener('luna-language-changed',()=>{selected();el('weather-setting-status').textContent='';});
  window.lunaWeather={fill,getLocation:()=>draft,cancel:()=>{revision++;}};
})();
