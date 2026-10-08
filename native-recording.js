const fs=require('node:fs'),path=require('node:path');
const {spawn}=require('node:child_process');

function executable(){
  for(const file of [path.join(__dirname,'tools','ffmpeg.exe'),path.join(__dirname,'.build-tools','ffmpeg-8.0.1','ffmpeg-8.0.1-essentials_build','bin','ffmpeg.exe')])if(fs.existsSync(file))return file;
  return null;
}
function captureRect(config,screen){
  const {rect,bounds}=config;
  const value=screen.dipToScreenRect(null,{x:Math.round(bounds.x+rect.x),y:Math.round(bounds.y+rect.y),width:Math.round(rect.width),height:Math.round(rect.height)});
  const result={x:Math.round(value.x),y:Math.round(value.y),width:Math.floor(value.width/2)*2,height:Math.floor(value.height/2)*2};
  if(!Object.values(result).every(Number.isFinite)||result.width<2||result.height<2)throw Error('录屏范围无效。');
  return result;
}
function encoderArgs(hardware){return hardware?['-c:v','h264_nvenc','-preset','p5','-tune','hq','-rc','vbr','-cq','18','-b:v','0']:['-c:v','libx264','-preset','veryfast','-crf','16'];}
function captureArgs(rect,fps,hardware){
  return ['-hide_banner','-loglevel','warning','-f','gdigrab','-framerate',String(fps),'-draw_mouse','1','-offset_x',String(rect.x),'-offset_y',String(rect.y),'-video_size',`${rect.width}x${rect.height}`,'-i','desktop','-an',...encoderArgs(hardware),'-pix_fmt','yuv420p','-g',String(fps*2),'-movflags','frag_keyframe+empty_moov+default_base_moof','-f','mp4','pipe:1'];
}
function probe(file){return new Promise(resolve=>{
  const child=spawn(file,['-hide_banner','-loglevel','error','-f','lavfi','-i','color=size=256x256:rate=30','-frames:v','1',...encoderArgs(true),'-f','null','-'],{windowsHide:true,stdio:'ignore'});
  const timer=setTimeout(()=>child.kill(),8000);child.once('error',()=>{clearTimeout(timer);resolve(false);});child.once('close',code=>{clearTimeout(timer);resolve(code===0);});
});}
function createNativeRecording({screen,file=executable(),spawnProcess=spawn,probeCapability=probe}={}){
  let capability;
  return {available:!!file,async start(config,{onChunk,onStarted,onFinish,onError}){
    if(!file)throw Error('缺少本地视频编码器，请重新打包。');
    const rect=captureRect(config,screen);
    // Use software for regions outside conservative H.264 hardware dimensions;
    // preserve the selected pixels rather than resize to fit the encoder.
    const hardware=rect.width>=256&&rect.height>=144&&rect.width<=4096&&rect.height<=4096&&await (capability??=probeCapability(file));
    const child=spawnProcess(file,captureArgs(rect,config.fps,hardware),{windowsHide:true,stdio:['pipe','pipe','pipe']});
    let queue=Promise.resolve(),started=false,stopping=false,aborted=false,errorText='',failure=null;
    const done=new Promise(resolve=>{
      child.once('error',error=>{failure=error;});
      child.stderr.on('data',data=>{errorText=(errorText+data.toString()).slice(-4000);});
      child.stdin.on('error',()=>{});
      child.stdout.on('data',data=>{
        child.stdout.pause();
        queue=queue.then(async()=>{if(aborted)return;if(!started){started=true;await onStarted({encoder:hardware?'nvenc':'x264',...rect});}await onChunk(new Uint8Array(data));}).catch(error=>{failure=error;child.kill();}).finally(()=>{if(!aborted)child.stdout.resume();});
      });
      child.once('close',async code=>{
        clearTimeout(timer);await queue;
        try{if(!aborted){if(failure||code!==0||!started||!stopping)await onError(failure?.message||('本地视频编码失败。 '+errorText.trim()).slice(0,200));else await onFinish();}}catch{/* The controller owns save/error reporting. */}finally{resolve();}
      });
    });
    let timer=setTimeout(()=>{failure=Error('屏幕采集启动超时，请重试。');child.kill();},15000);
    const originalStarted=onStarted;onStarted=async value=>{clearTimeout(timer);await originalStarted(value);};
    return {encoder:hardware?'nvenc':'x264',done,stop(){if(stopping||aborted)return;stopping=true;clearTimeout(timer);timer=setTimeout(()=>{failure=Error('录屏保存超时，请重新录制。');child.kill();},20000);if(child.stdin.writable)child.stdin.end('q\n');},abort(){aborted=true;clearTimeout(timer);child.kill();return queue;}};
  }};
}
module.exports={createNativeRecording,captureRect,captureArgs,encoderArgs};
