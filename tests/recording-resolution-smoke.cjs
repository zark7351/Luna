// Run with Electron; inspect a real desktop source in an isolated profile.
const {app,BrowserWindow,desktopCapturer,screen}=require('electron');
const os=require('node:os'),path=require('node:path');
app.setPath('userData',path.join(os.tmpdir(),'luna-resolution-test-'+process.pid));
app.whenReady().then(async()=>{
  const win=new BrowserWindow({show:false,webPreferences:{contextIsolation:true,sandbox:true}});
  try{
    await win.loadFile(path.join(__dirname,'..','recording-border.html'));
    const display=screen.getPrimaryDisplay(),source=(await desktopCapturer.getSources({types:['screen'],thumbnailSize:{width:0,height:0}})).find(s=>s.display_id===String(display.id));
    const dimensions={width:Math.round(display.size.width*display.scaleFactor),height:Math.round(display.size.height*display.scaleFactor)};
    const result=await win.webContents.executeJavaScript(`(async()=>{const results=[];for(const dimensions of [null,${JSON.stringify(dimensions)}]){const stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{mandatory:{chromeMediaSource:'desktop',chromeMediaSourceId:${JSON.stringify(source.id)},minFrameRate:30,maxFrameRate:30,...dimensions?{minWidth:dimensions.width,maxWidth:dimensions.width,minHeight:dimensions.height,maxHeight:dimensions.height}:{}}}});results.push(stream.getVideoTracks()[0].getSettings());stream.getTracks().forEach(track=>track.stop());}return results;})()`);
    console.log(JSON.stringify({native:dimensions,previous:result[0],explicitNative:result[1]}));
    if(result[1].width!==dimensions.width||result[1].height!==dimensions.height)throw Error('Native capture dimensions mismatch');
    win.destroy();app.exit(0);
  }catch(error){console.error(error);win.destroy();app.exit(1);}
});
