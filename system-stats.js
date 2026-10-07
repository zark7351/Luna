const os=require('node:os');
const path=require('node:path');
const {spawn}=require('node:child_process');
const percent=value=>Number.isFinite(value)?Math.max(0,Math.min(100,value)):null;
function cpuTimes(cpus){
  if(!Array.isArray(cpus)||!cpus.length)return null;
  let idle=0,total=0;
  for(const cpu of cpus){if(!cpu?.times||!Object.values(cpu.times).every(Number.isFinite))return null;idle+=cpu.times.idle;total+=Object.values(cpu.times).reduce((sum,value)=>sum+value,0);}
  return {idle,total,count:cpus.length};
}
function gpuUsage(engines){
  if(!Array.isArray(engines)||engines.length>4096)return null;
  const totals=new Map();
  for(const item of engines){if(!item||typeof item.engine!=='string'||!/^luid_0x[0-9a-f]+_0x[0-9a-f]+_phys_\d+_eng_\d+$/i.test(item.engine)||!Number.isFinite(item.usage)||item.usage<0)continue;totals.set(item.engine,(totals.get(item.engine)||0)+item.usage);}
  // Windows represents overall utilization with the busiest physical GPU engine.
  // https://devblogs.microsoft.com/directx/gpus-in-the-task-manager/
  return totals.size?percent(Math.max(...totals.values())):null;
}
const gpuScript=`
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=New-Object Text.UTF8Encoding($false)
$lunaParent=[Diagnostics.Process]::GetProcessById([int]$env:LUNA_STATS_PARENT)
while(-not $lunaParent.HasExited){
  try{
    $lunaRows=@(Get-CimInstance Win32_PerfFormattedData_GPUPerformanceCounters_GPUEngine -OperationTimeoutSec 3 | ForEach-Object {
      if($_.Name -match '^pid_\\d+_(luid_0x[0-9a-f]+_0x[0-9a-f]+_phys_\\d+_eng_\\d+)_engtype_'){
        @{engine=$Matches[1];usage=[double]$_.UtilizationPercentage}
      }
    })
    [Console]::WriteLine((ConvertTo-Json -InputObject @{engines=$lunaRows} -Depth 3 -Compress))
  }catch{[Console]::WriteLine('{"engines":null}')}
  Start-Sleep -Seconds 5
}
`;
function createSystemStats({system=os,startWorker,now=Date.now,schedule=setInterval,cancel=clearInterval}={}){
  let stopped=false,previous=null,cpu=null,memory=null,gpu=null,cpuPending=true,gpuPending=false,gpuAt=0,worker=null,buffer='',restartAt=0;
  const sample=()=>{
    if(stopped)return;
    try{const current=cpuTimes(system.cpus()),elapsed=current&&previous?current.total-previous.total:0,idle=current&&previous?current.idle-previous.idle:0;cpuPending=!!current&&!previous;cpu=current&&previous&&current.count===previous.count&&elapsed>0&&idle>=0&&idle<=elapsed?percent(100*(1-idle/elapsed)):null;previous=current;}catch{cpu=null;previous=null;cpuPending=false;}
    try{const total=system.totalmem(),free=system.freemem();memory=Number.isFinite(total)&&total>0&&Number.isFinite(free)&&free>=0&&free<=total?percent(100*(1-free/total)):null;}catch{memory=null;}
    if(worker&&now()-gpuAt>20000){const old=worker;worker=null;old.kill();gpu=null;gpuPending=false;restartAt=now()+60000;}
    if(!worker&&now()>=restartAt)launch();
  };
  function launch(){
    if(stopped)return;
    restartAt=now()+60000;buffer='';
    try{
      const current=(startWorker||(()=>process.platform==='win32'?spawn(path.join(process.env.SystemRoot||process.env.WINDIR,'System32','WindowsPowerShell','v1.0','powershell.exe'),['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(gpuScript,'utf16le').toString('base64')],{windowsHide:true,stdio:['ignore','pipe','ignore'],env:{...process.env,LUNA_STATS_PARENT:String(process.pid)}}):null))();
      if(!current){gpuPending=false;return;}worker=current;gpuAt=now();gpuPending=true;
      const finish=()=>{if(worker!==current)return;worker=null;gpu=null;gpuPending=false;buffer='';restartAt=now()+60000;};
      current.on('error',finish);current.on('exit',finish);
      current.stdout.setEncoding('utf8');current.stdout.on('data',chunk=>{
        if(stopped||worker!==current)return;buffer+=chunk;
        if(buffer.length>262144){finish();current.kill();return;}
        let newline;while((newline=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,newline).trim();buffer=buffer.slice(newline+1);if(!line)continue;try{gpu=gpuUsage(JSON.parse(line).engines);}catch{gpu=null;}gpuPending=false;gpuAt=now();}
      });
    }catch{gpu=null;gpuPending=false;}
  }
  sample();const timer=schedule(sample,1000);
  return {read:()=>stopped?{cpu:null,memory:null,gpu:null,pending:{cpu:false,gpu:false}}:{cpu,memory,gpu:now()-gpuAt<=15000?gpu:null,pending:{cpu:cpuPending,gpu:gpuPending}},stop:()=>{if(stopped)return;stopped=true;cancel(timer);const old=worker;worker=null;old?.kill();buffer='';}};
}
module.exports={createSystemStats,cpuTimes,gpuUsage};
