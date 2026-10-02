// Real provider check, isolated from personal application state and location settings.
const {app,net}=require('electron');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {createWeather}=require('../weather');
app.setPath('userData',path.join(os.tmpdir(),'luna-weather-network-'+process.pid));
app.whenReady().then(async()=>{
  const directory=app.getPath('userData');
  const service=createWeather({directory,fetch:net.fetch.bind(net)});
  const checks={};
  try{
    const results=await service.search('Hangzhou');checks.citySearch=results.length>0;
    const data=await service.current({name:'杭州',latitude:30.27,longitude:120.15});checks.weather=data.status==='ready';
    try{const place=await service.locate();checks.ipLocation=!!place;}catch(error){checks.ipLocation=false;checks.locationError=error.message;}
    console.log(JSON.stringify(checks));
  }catch(error){checks.error=error.message;console.error(JSON.stringify(checks));}
  finally{await fs.rm(directory,{recursive:true,force:true}).catch(()=>{});app.exit(checks.citySearch&&checks.weather&&checks.ipLocation?0:1);}
});
