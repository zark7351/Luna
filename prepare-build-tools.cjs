// Build-time downloads only. Runtime and installers never download these tools.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const cache=path.join(__dirname,'.build-tools');
const tools={
  rcedit:{file:'rcedit-x64.exe',url:'https://github.com/electron/rcedit/releases/download/v2.0.0/rcedit-x64.exe',sha:'3e7801db1a5edbec91b49a24a094aad776cb4515488ea5a4ca2289c400eade2a'},
  inno:{file:'innosetup-6.7.3.exe',url:'https://github.com/jrsoftware/issrc/releases/download/is-6_7_3/innosetup-6.7.3.exe',sha:'9c73c3bae7ed48d44112a0f48e66742c00090bdb5bef71d9d3c056c66e97b732'}
};
function verify(file,sha){if(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')!==sha)throw Error('Build tool SHA256 mismatch: '+path.basename(file));}
function run(executable,args,options={}){const result=spawnSync(executable,args,{windowsHide:true,stdio:'inherit',timeout:120000,...options});if(result.error)throw result.error;if(result.status!==0)throw Error('Build tool exited '+result.status);}
function download(definition){
  if(process.platform!=='win32')throw Error('Windows is required');fs.mkdirSync(cache,{recursive:true});
  const file=path.join(cache,definition.file);
  if(!fs.existsSync(file)){
    console.log('Downloading verified build tool: '+definition.file);
    run('powershell.exe',['-NoProfile','-NonInteractive','-Command','$ErrorActionPreference="Stop"; $ProgressPreference="SilentlyContinue"; Invoke-WebRequest -Uri $env:LUNA_BUILD_DOWNLOAD_URL -OutFile $env:LUNA_BUILD_DOWNLOAD_FILE'],{env:{...process.env,LUNA_BUILD_DOWNLOAD_URL:definition.url,LUNA_BUILD_DOWNLOAD_FILE:file}});
  }
  verify(file,definition.sha);return file;
}
function ensureRcedit(){return download(tools.rcedit);}
function ensureInno(){
  const root=path.join(cache,'inno-6.7.3'),compiler=path.join(root,'ISCC.exe');
  if(!fs.existsSync(compiler))run(download(tools.inno),['/PORTABLE=1','/CURRENTUSER','/NOICONS','/TASKS=','/SP-','/VERYSILENT','/SUPPRESSMSGBOXES','/NORESTART','/DIR='+root]);
  verify(compiler,'0a8757031b33777e4c9cbffee40f11a5062b36d25cbe144c1db73b6102b80ad7');return compiler;
}
module.exports={ensureRcedit,ensureInno,run};
if(require.main===module){try{ensureRcedit();ensureInno();console.log('Build tools ready.');}catch(error){console.error(error.message);process.exitCode=1;}}
