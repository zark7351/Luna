const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
async function check(win){
  const result=await win.webContents.executeJavaScript(`(async()=>{
    const frame=document.querySelector('#library-frame'),doc=frame.contentDocument,video=doc.querySelector('video');
    if(!video||video.controls)throw Error('compact video still uses native controls');
    const stage=video.closest('.preview-stage'),more=stage.querySelector('.video-more');stage.scrollIntoView({block:'center'});await new Promise(r=>setTimeout(r,80));more.click();
    const menu=doc.querySelector('#video-menu');
    function bounds(){const box=menu.getBoundingClientRect();if(!menu.matches(':popover-open')||box.left<0||box.top<0||box.right>doc.documentElement.clientWidth||box.bottom>doc.documentElement.clientHeight||menu.scrollWidth>menu.clientWidth)throw Error('video menu clipped '+JSON.stringify({left:box.left,top:box.top,right:box.right,bottom:box.bottom}));}
    bounds();menu.querySelectorAll('.video-speeds button')[2].click();if(video.playbackRate!==1.5||menu.matches(':popover-open'))throw Error('video rate selection');
    more.click();menu.querySelector('.video-menu-action').click();if(!video.muted)throw Error('video mute selection');
    more.click();const fullscreen=menu.querySelectorAll('.video-menu-action')[1];await fullscreen.onclick();if(doc.fullscreenElement!==stage)throw Error('custom video fullscreen');await doc.exitFullscreen();
    await new Promise(r=>setTimeout(r,150));stage.querySelector('.video-play').click();await new Promise(r=>setTimeout(r,100));if(video.paused)throw Error('custom play');stage.querySelector('.video-play').click();if(!video.paused)throw Error('custom pause');
    const holder=doc.querySelector('#items'),spacer=doc.createElement('div');spacer.style.height='800px';spacer.style.gridColumn='1 / -1';holder.prepend(spacer);holder.append(stage.closest('.item'));stage.scrollIntoView({block:'end'});await new Promise(r=>setTimeout(r,80));more.click();await new Promise(r=>setTimeout(r,80));bounds();
    return {boundedMenu:true,speed:true,mute:true,fullscreen:true,playPause:true,nearBottom:true};
  })()`,true);
  fs.writeFileSync(path.join(os.tmpdir(),'luna-video-menu.png'),(await win.webContents.capturePage()).toPNG());
  await win.webContents.executeJavaScript(`document.querySelector('#library-frame').contentWindow.lunaVideo.closeMenu();document.querySelector('#library-frame').contentWindow.refresh()`);
  return result;
}
module.exports={check};
