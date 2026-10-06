const $=id=>document.getElementById(id),api=async(name,value)=>{const result=await window.recorder.call(name,value);if(!result.ok)throw Error(result.error);return result.value;};
let mediaRecorder,input,output,video,drawTimer,timeTimer,started=0,writing=Promise.resolve(),stopping=false,starting=false;
const cleanup=()=>{clearInterval(drawTimer);clearInterval(timeTimer);input?.getTracks().forEach(track=>track.stop());output?.getTracks().forEach(track=>track.stop());if(video){video.pause();video.srcObject=null;}input=output=video=null;};
function renderStatus(state){$('status').textContent=state.message||'';const busy=state.phase!=='idle';$('select').disabled=busy;$('stop').disabled=!['preparing','recording'].includes(state.phase);document.body.classList.toggle('recording',state.phase==='recording');window.parent.document.querySelector('#recording-button')?.classList.toggle('is-recording',busy);if(!busy){cleanup();$('elapsed').textContent='00:00';}}
window.recorder.onStatus(renderStatus);
api('recording-state').then(state=>{renderStatus(state);if(!recordingOptions.formats.mp4.some(mime=>MediaRecorder.isTypeSupported(mime))){$('select').disabled=true;$('status').textContent='当前系统没有可用的 MP4 视频编码器。';}}).catch(error=>$('status').textContent=error.message);
$('select').onclick=async()=>{try{$('select').disabled=true;await api('recording-select');}catch(error){$('select').disabled=false;$('status').textContent=error.message;}};
$('stop').onclick=()=>api('recording-stop').catch(error=>$('status').textContent=error.message);
function stop(){stopping=true;if(mediaRecorder?.state==='recording')mediaRecorder.stop();}
window.recorder.onStop(stop);
window.recorder.onStart(async config=>{
  stopping=false;starting=true;writing=Promise.resolve();mediaRecorder=null;
  try{
    const mime=recordingOptions.formats[config.format].find(type=>MediaRecorder.isTypeSupported(type));if(!mime)throw Error('当前系统不支持 MP4 视频编码。');
    if(config.test){const fixture=document.createElement('canvas');fixture.width=320;fixture.height=180;const ctx=fixture.getContext('2d');ctx.fillStyle='#9374af';ctx.fillRect(0,0,320,180);input=fixture.captureStream(config.fps);}
    else input=await navigator.mediaDevices.getUserMedia({audio:false,video:{mandatory:{chromeMediaSource:'desktop',chromeMediaSourceId:config.sourceId,minFrameRate:config.fps,maxFrameRate:config.fps}}});
    video=document.createElement('video');video.muted=true;video.srcObject=input;await video.play();
    const rect=recordingOptions.region(config.rect,config.bounds,video.videoWidth,video.videoHeight),canvas=document.createElement('canvas');canvas.width=rect.outputWidth;canvas.height=rect.outputHeight;
    const ctx=canvas.getContext('2d',{alpha:false});output=canvas.captureStream(0);const track=output.getVideoTracks()[0];
    const draw=()=>{ctx.drawImage(video,rect.x,rect.y,rect.width,rect.height,0,0,canvas.width,canvas.height);track.requestFrame();};
    mediaRecorder=new MediaRecorder(output,{mimeType:mime,videoBitsPerSecond:Math.min(16000000,Math.max(2000000,canvas.width*canvas.height*config.fps*.12))});
    mediaRecorder.ondataavailable=event=>{if(event.data.size)writing=writing.then(async()=>{for(let offset=0;offset<event.data.size;offset+=4*1024*1024){const bytes=await event.data.slice(offset,offset+4*1024*1024).arrayBuffer();await api('recording-chunk',bytes);}}).catch(async error=>{stop();await api('recording-error',error.message).catch(()=>{});throw error;});writing.catch(()=>{});};
    mediaRecorder.onstop=async()=>{clearInterval(drawTimer);clearInterval(timeTimer);try{await writing;await api('recording-finish');}catch(error){$('status').textContent=error.message;await api('recording-error',error.message).catch(()=>{});}finally{cleanup();}};
    mediaRecorder.onerror=event=>{stop();api('recording-error',event.error?.message||'视频编码失败').catch(()=>{});cleanup();};
    mediaRecorder.start(1000);draw();drawTimer=setInterval(draw,1000/config.fps);started=Date.now();timeTimer=setInterval(()=>{const seconds=Math.floor((Date.now()-started)/1000);$('elapsed').textContent=String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');},250);
    await api('recording-started',{width:canvas.width,height:canvas.height});if(stopping)stop();
    input.getVideoTracks()[0].addEventListener('ended',stop,{once:true});
  }catch(error){cleanup();await api('recording-error',error.message).catch(()=>{});}finally{starting=false;}
});

async function closePanel(){try{$('close-recording').disabled=true;await api('recording-stop');window.parent.lunaPanels.closeSheet('recording');}catch(error){$('status').textContent=error.message;}finally{$('close-recording').disabled=false;}}
$('close-recording').onclick=closePanel;
document.addEventListener('keydown',event=>{if(event.key==='Escape')closePanel();});
