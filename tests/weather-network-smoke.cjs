const {app,net}=require('electron');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {createWeather}=require('../weather');
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'luna-weather-live-'));app.setPath('userData',path.join(directory,'data'));
app.whenReady().then(async()=>{
  const weather=createWeather({directory,fetch:(...args)=>net.fetch(...args),timeout:8000});
  const cities=await weather.search('杭州');if(!cities.length)throw Error('Live city search returned no results');
  const result=await weather.current({name:'杭州',latitude:30.27,longitude:120.15,source:'manual'});
  if(result.status!=='ready'||!result.reading)throw Error('Live weather unavailable');
  console.log('WEATHER_LIVE_PASS '+JSON.stringify({citySearch:true,weather:true,temperature:result.reading.temperature,label:result.reading.label}));app.exit(0);
}).catch(error=>{console.error('WEATHER_LIVE_FAILED '+error.message);app.exit(1);});
