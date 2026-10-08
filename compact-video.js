// Embedded video controls stay inside the collection iframe, including popovers.
(()=>{
  const t=window.lunaI18n.t;
  const menu=document.createElement('div');menu.id='video-menu';menu.className='video-menu';menu.setAttribute('popover','auto');
  document.addEventListener('DOMContentLoaded',()=>document.body.append(menu));
  let active=null;
  function closeMenu(){if(menu.matches(':popover-open'))menu.hidePopover();active=null;}
  menu.addEventListener('toggle',event=>{if(event.newState==='closed')active=null;});
  const paths={play:'m8 5 11 7-11 7Z',pause:'M8 5v14M16 5v14',more:'M5 12h.01M12 12h.01M19 12h.01'};
  function iconButton(label,icon,action){
    const button=document.createElement('button');button.type='button';button.title=t(label);button.setAttribute('aria-label',t(label));
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');
    const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',paths[icon]);svg.append(path);button.append(svg);button.onclick=action;return button;
  }
  function positionMenu(button){
    const anchor=button.getBoundingClientRect(),box=menu.getBoundingClientRect(),width=document.documentElement.clientWidth,height=document.documentElement.clientHeight;
    menu.style.left=Math.max(8,Math.min(width-box.width-8,anchor.right-box.width))+'px';
    const top=anchor.top-box.height-6;
    menu.style.top=Math.max(8,Math.min(height-box.height-8,top>=8?top:anchor.bottom+6))+'px';
  }
  function openMenu(video,stage,button){
    if(active?.video===video&&menu.matches(':popover-open')){closeMenu();return;}
    closeMenu();active={video,button};menu.replaceChildren();
    const heading=document.createElement('div');heading.className='video-menu-label';heading.textContent=t('播放速度');menu.append(heading);
    const speeds=document.createElement('div');speeds.className='video-speeds';
    for(const rate of [.5,1,1.5,2]){const choice=document.createElement('button');choice.type='button';choice.textContent=rate+'×';choice.setAttribute('aria-pressed',String(video.playbackRate===rate));choice.onclick=()=>{video.playbackRate=rate;closeMenu();};speeds.append(choice);}menu.append(speeds);
    for(const [label,action]of [[video.muted?'取消静音':'静音',()=>{video.muted=!video.muted;}],['全屏播放',async()=>{await stage.requestFullscreen();}],['在大收藏夹查看',()=>document.getElementById('expand-library').click()]]){
      const choice=document.createElement('button');choice.type='button';choice.className='video-menu-action';choice.textContent=t(label);choice.onclick=async()=>{closeMenu();try{await action();}catch(error){document.getElementById('status').textContent=error.message;}};menu.append(choice);
    }
    menu.showPopover();positionMenu(button);menu.querySelector('button').focus({preventScroll:true});
  }
  window.addEventListener('resize',()=>{if(active&&menu.matches(':popover-open'))positionMenu(active.button);});
  document.addEventListener('scroll',event=>{if(!menu.contains(event.target))closeMenu();},true);
  document.addEventListener('fullscreenchange',closeMenu);
  function attach(stage,video){
    stage.classList.add('compact-video');video.controls=false;
    const controls=document.createElement('div');controls.className='video-controls';
    const seek=document.createElement('input');seek.type='range';seek.min=0;seek.max=1000;seek.value=0;seek.step=1;seek.setAttribute('aria-label',t('播放进度'));seek.disabled=true;
    seek.oninput=()=>{if(Number.isFinite(video.duration)&&video.duration>0)video.currentTime=Number(seek.value)*video.duration/1000;};
    const toggle=()=>{if(video.paused)video.play().catch(error=>document.getElementById('status').textContent=error.message);else video.pause();};
    const play=iconButton('播放','play',toggle);play.className='video-play';
    function sync(){const label=t(video.paused?'播放':'暂停');play.title=label;play.setAttribute('aria-label',label);play.querySelector('path').setAttribute('d',paths[video.paused?'play':'pause']);seek.disabled=!Number.isFinite(video.duration)||video.duration<=0;seek.value=seek.disabled?0:Math.round(video.currentTime/video.duration*1000);}
    for(const event of ['play','pause','timeupdate','loadedmetadata','durationchange','ended'])video.addEventListener(event,sync);
    const more=iconButton('更多播放选项','more',()=>openMenu(video,stage,more));more.className='video-more';
    controls.append(play,seek,more);stage.append(controls);video.onclick=toggle;video.tabIndex=0;
    video.onkeydown=event=>{if(event.key===' '||event.key==='Enter'){event.preventDefault();toggle();}};
    sync();
  }
  window.lunaVideo={attach,closeMenu};
})();
