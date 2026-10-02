const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {createWeather,location,weatherKind,REFRESH_MS}=require('../weather');
const {validate}=require('../core');
const place={name:'杭州',latitude:30.27,longitude:120.15,detail:'浙江 · 中国',source:'manual'};
async function fixture(t){const directory=await fs.mkdtemp(path.join(os.tmpdir(),'luna-weather-'));t.after(()=>fs.rm(directory,{recursive:true,force:true}));return directory;}
const response=data=>new Response(JSON.stringify(data));
test('location validation strips extra data and rejects invalid coordinates',()=>{
  assert.equal(location({...place,latitude:NaN}),null);assert.equal(location({...place,longitude:181}),null);
  assert.equal(location({...place,latitude:'30'}),null);
  assert.deepEqual(validate({weatherLocation:{...place,ip:'private',token:'secret'}}).weatherLocation,place);
  assert.deepEqual(weatherKind(95),['storm','雷雨']);assert.deepEqual(weatherKind(85),['snow','雪']);
});
test('weather requests deduplicate, cache across restarts, and retain stale readings on failure',async t=>{
  const directory=await fixture(t);let time=1000000,calls=0,failed=false;
  const fetch=async(url,options)=>{calls++;assert.equal(new URL(url).hostname,'api.open-meteo.com');assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');assert.equal(new URL(url).searchParams.get('latitude'),'30.27');if(failed)throw Error('offline');return response({current:{temperature_2m:22.3,weather_code:2,is_day:0}});};
  const service=createWeather({directory,fetch,now:()=>time});assert.deepEqual(await service.current(null),{status:'unset'});assert.equal(calls,0);
  const [a,b]=await Promise.all([service.current(place),service.current(place)]);assert.deepEqual(a,b);assert.equal(calls,1);assert.equal(a.reading.day,false);
  const reopened=createWeather({directory,fetch,now:()=>time});assert.equal((await reopened.current(place)).status,'ready');assert.equal(calls,1);
  time+=REFRESH_MS+1;failed=true;const stale=await reopened.current(place);assert.equal(stale.status,'stale');assert.equal(stale.reading.temperature,22.3);
  await reopened.current(place);assert.equal(calls,2);
  assert.equal((await reopened.current({...place,latitude:20})).status,'unavailable');
});
test('search and IP location use fixed endpoints without retaining the public IP',async t=>{
  const directory=await fixture(t),urls=[];
  const service=createWeather({directory,fetch:async url=>{urls.push(new URL(url));return response(url.includes('ipwho.is')?{success:true,city:'杭州',latitude:30.27,longitude:120.15,region:'浙江',country:'中国',ip:'private'}:{results:[{...place,admin1:'浙江',country:'中国'},{name:'bad',latitude:999,longitude:1}]});}});
  assert.deepEqual(await service.search('杭州'),[place]);assert.equal(urls[0].searchParams.get('language'),'zh');
  const auto=await service.locate();assert.equal(auto.source,'ip');assert.equal(Object.hasOwn(auto,'ip'),false);assert.equal(urls[1].protocol,'https:');
  await assert.rejects(service.search('a'));
});
test('invalid weather data and oversized responses never become a current reading',async t=>{
  const directory=await fixture(t);
  const invalid=createWeather({directory,fetch:async()=>response({current:{temperature_2m:null,weather_code:0,is_day:1}})});
  assert.equal((await invalid.current(place)).status,'unavailable');
  const oversized=createWeather({directory,fetch:async()=>new Response('x'.repeat(300000))});
  await assert.rejects(oversized.search('杭州'),/响应过大/);
});
