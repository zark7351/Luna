const fs=require('node:fs'),path=require('node:path');
const {ensureInno,run}=require('./prepare-build-tools.cjs');
try{
  if(process.platform!=='win32')throw Error('Build the installer on Windows.');
  run(process.execPath,[path.join(__dirname,'build-portable.cjs')]);
  const version=require('./package.json').version,output=path.resolve(__dirname,'..','LunaPet-Release');
  const source=path.resolve(__dirname,'..','LunaPet-Windows');fs.mkdirSync(output,{recursive:true});
  run(ensureInno(),['/Q','/DAppVersion='+version,'/DSourceDir='+source,'/DReleaseDir='+output,path.join(__dirname,'installer','LunaPet.iss')],{timeout:300000});
  const installer=path.join(output,'LunaPet-'+version+'-Setup.exe');if(!fs.existsSync(installer))throw Error('Installer was not produced.');
  console.log('Installer complete: '+installer);
}catch(error){console.error('Installer build failed: '+error.message);process.exitCode=1;}
