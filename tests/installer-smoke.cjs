// Explicit Windows release verification; never reads real user data or installs shortcuts.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {spawn}=require('node:child_process');
const version=require('../package.json').version;
const setup=path.resolve(__dirname,'..','..','LunaPet-Release',`LunaPet-${version}-Setup.exe`);
const root=fs.mkdtempSync(path.join(os.tmpdir(),'luna-installer-test-')),target=path.join(root,'app');
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function run(exe,args,timeout=90000){
  return new Promise((resolve,reject)=>{
    const child=spawn(exe,args,{windowsHide:true,stdio:['ignore','pipe','pipe']});
    let output='';child.stdout.on('data',data=>{output+=data;process.stdout.write(data);});child.stderr.on('data',data=>{output+=data;process.stderr.write(data);});
    const timer=setTimeout(()=>{child.kill();reject(Error('Timed out: '+path.basename(exe)));},timeout);
    child.once('error',error=>{clearTimeout(timer);reject(error);});
    child.once('exit',code=>{clearTimeout(timer);if(code!==0)reject(Error(path.basename(exe)+' exited '+code));else resolve({pid:child.pid,output});});
  });
}
async function check(){
  assert.equal(process.platform,'win32');assert.ok(fs.existsSync(setup));console.log('ISOLATED_TEST_DIR='+root);
  const install=log=>run(setup,['/LUNATEST=1','/VERYSILENT','/SUPPRESSMSGBOXES','/SP-','/NORESTART','/NOICONS','/TASKS=','/NOCLOSEAPPLICATIONS','/DIR='+target,'/LOG='+path.join(root,log)]);
  await install('install.log');
  const exe=path.join(target,'LunaPet.exe'),appDir=path.join(target,'resources','app');assert.ok(fs.existsSync(exe));
  assert.equal(JSON.parse(fs.readFileSync(path.join(appDir,'package.json'))).version,version);
  assert.equal(hash(path.join(appDir,'assets','luna.ico')),hash(path.join(__dirname,'..','assets','luna.ico')));
  const originalExe=hash(exe);console.log('INSTALL_PASS');
  if(process.argv.includes('--package-only')){
    const portable=path.resolve(__dirname,'..','..','LunaPet-Windows');let count=0;
    function compare(relative=''){for(const entry of fs.readdirSync(path.join(portable,relative),{withFileTypes:true})){const file=path.join(relative,entry.name);if(entry.isDirectory())compare(file);else{assert.equal(hash(path.join(target,file)),hash(path.join(portable,file)),file);count++;}}}
    compare();console.log('FINAL_PACKAGE_FILES_PASS '+count);
    await run(path.join(target,'unins000.exe'),['/VERYSILENT','/SUPPRESSMSGBOXES','/NORESTART','/LOG='+path.join(root,'uninstall.log')]);
    const until=Date.now()+15000;while(fs.existsSync(exe)&&Date.now()<until)await new Promise(resolve=>setTimeout(resolve,100));assert.equal(fs.existsSync(exe),false);
    fs.writeFileSync(path.join(root,'verification.json'),JSON.stringify({version,installerSha256:hash(setup),installedFiles:count,packageFilesMatch:true,uninstall:true},null,2));console.log('FINAL_PACKAGE_PASS');return;
  }
  const smoke=await run(exe,['--smoke-test','--capture-debug'],180000);
  const dataDir=path.join(os.tmpdir(),'lunapet-smoke-'+smoke.pid);
  const preserveFiles=['state.json','collection.json','reminders.json'].map(name=>path.join(dataDir,name));
  const customFiles=fs.readdirSync(path.join(dataDir,'custom-captures')).map(name=>path.join(dataDir,'custom-captures',name));assert.ok(customFiles.length>0);preserveFiles.push(...customFiles);
  const before=new Map(preserveFiles.map(file=>[file,hash(file)]));
  const results=JSON.parse(fs.readFileSync(path.join(appDir,'smoke-result.json')));assert.equal(results.lateEventsAfterWindowDestroyed,true);
  console.log('INSTALLED_DESKTOP_SMOKE_PASS');
  await install('reinstall.log');assert.equal(hash(exe),originalExe);for(const [file,digest]of before)assert.equal(hash(file),digest);console.log('REINSTALL_PRESERVES_DATA_PASS');
  await run(path.join(target,'unins000.exe'),['/VERYSILENT','/SUPPRESSMSGBOXES','/NORESTART','/LOG='+path.join(root,'uninstall.log')]);
  const until=Date.now()+15000;while(fs.existsSync(exe)&&Date.now()<until)await new Promise(resolve=>setTimeout(resolve,100));
  assert.equal(fs.existsSync(exe),false);for(const [file,digest]of before)assert.equal(hash(file),digest);
  console.log('UNINSTALL_PRESERVES_DATA_PASS');
  fs.writeFileSync(path.join(root,'verification.json'),JSON.stringify({version,installer:setup,installerSha256:hash(setup),install:true,reinstall:true,desktopSmoke:true,uninstall:true,preservedFiles:preserveFiles,results},null,2));
  console.log('INSTALLER_SMOKE_PASS');
}
check().catch(error=>{console.error(error);process.exitCode=1;});
