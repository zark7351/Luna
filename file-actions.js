const fs=require('node:fs/promises');
const path=require('node:path');
const {execFile}=require('node:child_process');
const {promisify}=require('node:util');
const run=promisify(execFile);

// The path is data in an environment variable, never executable PowerShell text.
const clipboardScript=`
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Windows.Forms
$lunaFile=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($env:LUNA_CLIPBOARD_FILE))
if(-not [IO.File]::Exists($lunaFile)){throw 'File unavailable'}
$lunaFiles=New-Object System.Collections.Specialized.StringCollection
[void]$lunaFiles.Add($lunaFile)
[System.Windows.Forms.Clipboard]::SetFileDropList($lunaFiles)
$lunaRead=[System.Windows.Forms.Clipboard]::GetFileDropList()
if($lunaRead.Count -ne 1 -or $lunaRead[0] -ne $lunaFile){throw 'Clipboard verification failed'}
`;
async function requireFile(target){
  try{if(typeof target!=='string' || !path.isAbsolute(target) || !(await fs.stat(target)).isFile())throw Error();}
  catch{throw Error('文件已移动、删除或所在磁盘不可用。');}
}
async function copyFileToClipboard(target,execute=run){
  await requireFile(target);
  if(process.platform!=='win32')throw Error('文件复制仅支持 Windows。');
  const executable=path.join(process.env.SystemRoot || process.env.WINDIR,'System32','WindowsPowerShell','v1.0','powershell.exe');
  try{
    await execute(executable,['-NoProfile','-NonInteractive','-STA','-EncodedCommand',Buffer.from(clipboardScript,'utf16le').toString('base64')],{
      windowsHide:true,timeout:15000,maxBuffer:16384,env:{...process.env,LUNA_CLIPBOARD_FILE:Buffer.from(target,'utf8').toString('base64')}
    });
  }catch{throw Error('文件复制失败，请稍后重试；剪贴板可能正被其他程序占用。');}
  return true;
}
module.exports={copyFileToClipboard,requireFile};
