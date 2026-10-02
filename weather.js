const fs=require('node:fs');
const path=require('node:path');
const REFRESH_MS=30*60*1000;
function location(value){
  if(!value||typeof value!=='object'||typeof value.name!=='string')return null;
  const name=value.name.trim().slice(0,60),{latitude,longitude}=value;
  if(!name||!Number.isFinite(latitude)||Math.abs(latitude)>90||!Number.isFinite(longitude)||Math.abs(longitude)>180)return null;
  return {name,latitude,longitude,detail:String(value.detail||'').slice(0,120),source:value.source==='ip'?'ip':'manual'};
}
function weatherKind(code){
  if(code===0)return ['clear','晴'];
  if(code===1||code===2)return ['partly','多云'];
  if(code===3)return ['cloud','阴'];
  if(code===45||code===48)return ['fog','雾'];
  if([71,73,75,77,85,86].includes(code))return ['snow','雪'];
  if([95,96,99].includes(code))return ['storm','雷雨'];
  if([51,53,55,56,57,61,63,65,66,67,80,81,82].includes(code))return ['rain','雨'];
  return ['cloud','天气'];
}
function createWeather({directory,fetch,now=Date.now,timeout=10000}){
  const file=path.join(directory,'weather.json');
  let cache=null;
  try{const saved=JSON.parse(fs.readFileSync(file,'utf8'));if(typeof saved.key==='string'&&validReading(saved.reading))cache=saved;}catch{}
  const pending=new Map(),attempts=new Map();
  function validReading(r){return r&&Number.isFinite(r.temperature)&&r.temperature>=-100&&r.temperature<=70&&Number.isInteger(r.code)&&typeof r.day==='boolean'&&Number.isFinite(r.fetchedAt)&&r.fetchedAt<=now()+60000;}
  async function json(url){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
    try{
      const response=await fetch(url,{signal:controller.signal,credentials:'omit',redirect:'error',headers:{Accept:'application/json'}});
      if(!response.ok)throw Error('服务暂时不可用');
      const reader=response.body.getReader(),chunks=[];let size=0;
      try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>256*1024)throw Error('服务响应过大');chunks.push(Buffer.from(value));}}finally{await reader.cancel().catch(()=>{});}
      return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    }catch(error){if(controller.signal.aborted)throw Error('连接超时，请稍后再试。');throw error;}finally{clearTimeout(timer);}
  }
  async function search(query){
    if(typeof query!=='string'||query.trim().length<2||query.length>80)throw Error('请输入至少两个字的城市名。');
    const url=new URL('https://geocoding-api.open-meteo.com/v1/search');url.search=new URLSearchParams({name:query.trim(),count:'8',language:'zh',format:'json'});
    const data=await json(url.href);
    return (Array.isArray(data.results)?data.results:[]).map(r=>location({name:r.name,latitude:r.latitude,longitude:r.longitude,detail:[r.admin1,r.country].filter(Boolean).join(' · ')})).filter(Boolean);
  }
  async function locate(){
    const data=await json('https://ipwho.is/?fields=success,city,region,country,latitude,longitude&lang=zh-CN');
    const result=data.success===true&&location({name:data.city,latitude:data.latitude,longitude:data.longitude,detail:[data.region,data.country].filter(Boolean).join(' · '),source:'ip'});
    if(!result)throw Error('暂时无法定位，请手动搜索城市。');
    return result;
  }
  async function current(input){
    const place=location(input);if(!place)return {status:'unset'};
    const key=JSON.stringify([place.latitude,place.longitude]);
    const cached=cache?.key===key?cache.reading:null;
    const result=(reading,status)=>({status,location:place,reading:reading?{...reading,kind:weatherKind(reading.code)[0],label:weatherKind(reading.code)[1]}:null});
    if(cached&&now()-cached.fetchedAt<REFRESH_MS)return result(cached,'ready');
    if(pending.has(key))return pending.get(key);
    if(attempts.has(key)&&now()-attempts.get(key)<60000)return result(cached,cached?'stale':'unavailable');
    const task=(async()=>{
      attempts.set(key,now());
      // Bound retained retry state when switching between many cities.
      if(attempts.size>20)attempts.delete(attempts.keys().next().value);
      try{
        const url=new URL('https://api.open-meteo.com/v1/forecast');url.search=new URLSearchParams({latitude:String(place.latitude),longitude:String(place.longitude),current:'temperature_2m,weather_code,is_day',timezone:'auto',forecast_days:'1'});
        const data=await json(url.href),r=data.current;
        const reading={temperature:r?.temperature_2m,code:r?.weather_code,day:r?.is_day===1,fetchedAt:now()};
        if(![0,1].includes(r?.is_day)||!validReading(reading))throw Error('天气数据无效');
        cache={key,reading};
        try{fs.mkdirSync(directory,{recursive:true});fs.writeFileSync(file+'.tmp',JSON.stringify(cache),'utf8');fs.renameSync(file+'.tmp',file);}catch{}
        return result(reading,'ready');
      }catch{return result(cached,cached?'stale':'unavailable');}
    })();
    pending.set(key,task);try{return await task;}finally{pending.delete(key);}
  }
  return {search,locate,current};
}
module.exports={location,weatherKind,createWeather,REFRESH_MS};
