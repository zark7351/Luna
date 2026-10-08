const test=require('node:test'),assert=require('node:assert/strict');
const {createNativeRecording,captureRect,captureArgs,encoderArgs}=require('../native-recording');
test('native recording maps mixed-DPI bounds through Electron without scaling output',()=>{
  let input;const screen={dipToScreenRect(window,rect){assert.equal(window,null);input=rect;return {x:-2560,y:24,width:1001,height:601};}};
  assert.deepEqual(captureRect({rect:{x:10,y:20,width:667,height:401},bounds:{x:-1700,y:0}},screen),{x:-2560,y:24,width:1000,height:600});
  assert.deepEqual(input,{x:-1690,y:20,width:667,height:401});
});
function fixture(){
  const {EventEmitter}=require('node:events'),{PassThrough}=require('node:stream');
  const child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();child.stdin=new PassThrough();child.kill=()=>{child.killed=true;setImmediate(()=>child.emit('close',1));};
  return child;
}
test('native writer serializes chunks, stop finalizes, and unavailable hardware falls back',async()=>{
  const child=fixture(),events=[];let probes=0;
  const backend=createNativeRecording({file:'local.exe',screen:{dipToScreenRect:(_window,rect)=>rect},spawnProcess:()=>child,probeCapability:async()=>{probes++;return false;}});
  const recorder=await backend.start({rect:{x:0,y:0,width:320,height:180},bounds:{x:0,y:0},fps:60},{onStarted:info=>events.push(info.encoder),onChunk:async bytes=>{await new Promise(resolve=>setTimeout(resolve,5));events.push(bytes[0]);},onFinish:()=>events.push('saved'),onError:()=>assert.fail('unexpected error')});
  child.stdout.write(Buffer.from([1]));child.stdout.write(Buffer.from([2]));await new Promise(resolve=>setTimeout(resolve,30));
  let input='';child.stdin.on('data',data=>input+=data);recorder.stop();child.emit('close',0);await recorder.done;
  assert.equal(probes,1);assert.equal(input,'q\n');assert.deepEqual(events,['x264',1,2,'saved']);
});
test('native failure aborts from its callback without deadlock or committing partial video',async()=>{
  const child=fixture();let recorder,errors=0;
  const backend=createNativeRecording({file:'local.exe',screen:{dipToScreenRect:(_window,rect)=>rect},spawnProcess:()=>child,probeCapability:async()=>true});
  recorder=await backend.start({rect:{x:0,y:0,width:320,height:180},bounds:{x:0,y:0},fps:60},{onStarted:()=>{},onChunk:()=>{},onFinish:()=>assert.fail('partial video committed'),onError:async()=>{errors++;await recorder.abort();}});
  child.stderr.write('driver error');child.emit('close',1);await recorder.done;assert.equal(errors,1);assert.equal(child.killed,true);
});
test('tiny and 8K regions use software at original size without hardware probing',async()=>{
  for(const [width,height]of [[192,100],[7680,4320]]){
    const child=fixture();let args;
    const backend=createNativeRecording({file:'local.exe',screen:{dipToScreenRect:(_window,rect)=>rect},spawnProcess:(_file,value)=>{args=value;return child;},probeCapability:()=>assert.fail('unsupported region probed')});
    const recorder=await backend.start({rect:{x:0,y:0,width,height},bounds:{x:0,y:0},fps:60},{onStarted:()=>{},onChunk:()=>{},onFinish:()=>assert.fail('aborted video saved'),onError:()=>assert.fail('abort reported as error')});
    assert.equal(args[args.indexOf('-video_size')+1],`${width}x${height}`);assert.ok(args.includes('libx264'));await recorder.abort();await recorder.done;
  }
});
test('native encoder uses original size, requested FPS, local capture and quality VBR',()=>{
  const args=captureArgs({x:-320,y:0,width:3840,height:2160},60,true);
  assert.equal(args[args.indexOf('-video_size')+1],'3840x2160');assert.equal(args[args.indexOf('-framerate')+1],'60');
  assert.equal(args[args.indexOf('-cq')+1],'18');assert.equal(args[args.indexOf('-c:v')+1],'h264_nvenc');
  assert.ok(!args.includes('-vf'));assert.equal(args.at(-1),'pipe:1');assert.ok(args.includes('desktop'));
  assert.ok(encoderArgs(false).includes('libx264'));
});
