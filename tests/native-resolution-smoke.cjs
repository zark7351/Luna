// Real native full-display recording against a synthetic window, isolated data.
const {app,BrowserWindow,screen}=require('electron');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {spawnSync}=require('node:child_process');
const {createNativeRecording}=require('../native-recording');
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'luna-native-quality-'));
app.setPath('userData',path.join(directory,'data'));
app.whenReady().then(async()=>{
  let window,recorder;
  try{
    const display=screen.getPrimaryDisplay();
    window=new BrowserWindow({...display.bounds,frame:false,fullscreen:true,alwaysOnTop:true,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});
    window.setAlwaysOnTop(true,'screen-saver');
    await window.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent('<body style="background:#eee;color:#111;font:16px sans-serif"><h1>Native recording — 60 FPS</h1><p>露娜原始分辨率录屏 / ABCDEFGH 0123456789</p><p style="font-size:12px">Small text quality fixture</p><div style="height:200px;background:repeating-linear-gradient(90deg,#000 0 2px,#fff 2px 4px)"></div></body>'));
    await new Promise(resolve=>setTimeout(resolve,300));
    const output=path.join(directory,'native.mp4'),handle=fs.openSync(output,'w');let resolveStarted,rejectStarted;
    const started=new Promise((resolve,reject)=>{resolveStarted=resolve;rejectStarted=reject;});
    let info,error;
    recorder=await createNativeRecording({screen}).start({rect:{x:0,y:0,width:display.bounds.width,height:display.bounds.height},bounds:display.bounds,fps:60},{onStarted:value=>{info=value;resolveStarted();},onChunk:bytes=>fs.writeSync(handle,bytes),onFinish:()=>{},onError:message=>{error=Error(message);rejectStarted(error);}});
    await started;await new Promise(resolve=>setTimeout(resolve,2000));recorder.stop();await recorder.done;fs.closeSync(handle);if(error)throw error;
    if(info.encoder!=='nvenc')throw Error('This hardware fixture must exercise NVENC');
    const bin=path.join(__dirname,'..','.build-tools','ffmpeg-8.0.1','ffmpeg-8.0.1-essentials_build','bin');
    const probe=spawnSync(path.join(bin,'ffprobe.exe'),['-v','error','-select_streams','v:0','-count_frames','-show_entries','stream=codec_name,width,height,r_frame_rate,nb_read_frames:format=duration','-of','json',output],{encoding:'utf8',windowsHide:true});if(probe.status!==0)throw Error(probe.stderr);
    const metadata=JSON.parse(probe.stdout),video=metadata.streams[0];
    if(video.width!==info.width||video.height!==info.height||video.r_frame_rate!=='60/1'||Number(video.nb_read_frames)<60)throw Error('native dimensions/FPS '+probe.stdout);
    const frame=path.join(directory,'frame.png');const decode=spawnSync(path.join(bin,'ffmpeg.exe'),['-v','error','-i',output,'-frames:v','1',frame],{windowsHide:true,encoding:'utf8'});if(decode.status!==0)throw Error(decode.stderr);
    console.log(JSON.stringify({directory,encoder:info.encoder,...metadata,frame}));window.destroy();app.exit(0);
  }catch(error){console.error(error);await recorder?.abort();if(window&&!window.isDestroyed())window.destroy();app.exit(1);}
});
