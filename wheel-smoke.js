// Radial menu inside the real pet window: opening, sector hit testing, hover/keyboard focus, Esc, a toggle action,
// and dismissal without clicking through to Luna. Saves screenshots of the animation and the settled wheel.
const fs = require('node:fs'),
  path = require('node:path');
async function check({ win, output }) {
  const run = code => win.webContents.executeJavaScript(code);
  const snap = async name => fs.writeFileSync(path.join(output, name), (await win.webContents.capturePage()).toPNG());
  await run(`(()=>{feedback.show('');const pet=document.querySelector('#pet').getBoundingClientRect();
    window.smokeWheelPoint={x:pet.left+pet.width/2,y:pet.top+pet.height*0.42};
    document.querySelector('#pet').dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:smokeWheelPoint.x,clientY:smokeWheelPoint.y}));})()`);
  const animated = await run(
    `[...document.querySelectorAll('#wheel .wheel-item')].filter(item=>item.getAnimations().some(a=>a.animationName==='wheel-item-in')).length`
  );
  if (animated !== 10 && !(await run(`matchMedia('(prefers-reduced-motion: reduce)').matches`)))
    throw Error('wheel opening animation missing: ' + animated);
  // Freeze the spin-in 180 ms in for a deterministic mid-animation screenshot, then let it finish.
  await run(`document.getAnimations().forEach(a=>{a.pause();a.currentTime=180;})`);
  await new Promise(resolve => setTimeout(resolve, 80));
  await snap('luna-wheel-opening.png');
  await run(`document.getAnimations().forEach(a=>a.play())`);
  await new Promise(resolve => setTimeout(resolve, 600));
  await snap('luna-wheel-open.png');
  const opened = await run(`(()=>{
    const node=document.querySelector('#wheel'),items=[...node.querySelectorAll('.wheel-item')];
    if(node.hidden||!wheel.isOpen||items.length!==10)throw Error('wheel not open');
    if(!items[0].classList.contains('active')||document.activeElement!==items[0])throw Error('first item not focused');
    if(document.querySelector('.wheel-center-label').textContent!=='收藏夹')throw Error('center label');
    // Each icon position must hit its own clipped sector; the transparent corner must hit the wheel itself.
    const hits=items.every(item=>{const box=item.querySelector('.wheel-icon').getBoundingClientRect();return document.elementFromPoint(box.left+box.width/2,box.top+box.height/2)?.closest('.wheel-item')===item;});
    const box=node.getBoundingClientRect(),corner=document.elementFromPoint(box.left+6,box.top+6);
    const inside=box.left>=0&&box.right<=innerWidth&&box.top>=0&&box.bottom<=innerHeight;
    return {hits,corner:corner===node,inside,held:lastDockHold===true};
  })()`);
  if (!opened.hits || !opened.corner || !opened.inside || !opened.held)
    throw Error('wheel geometry ' + JSON.stringify(opened));
  await run(`document.querySelectorAll('.wheel-item')[7].dispatchEvent(new PointerEvent('pointerenter'))`);
  await new Promise(resolve => setTimeout(resolve, 260));
  await snap('luna-wheel-hover.png');
  const hovered = await run(`(()=>{const items=document.querySelectorAll('.wheel-item');
    const ok=items[7].classList.contains('active')&&!items[0].classList.contains('active')&&document.querySelector('.wheel-center-label').textContent==='陪伴互动'&&document.querySelector('.wheel-center-state').textContent==='已开启';
    items[7].focus();document.querySelector('#wheel').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));
    const keyboard=document.activeElement===items[8]&&document.querySelector('.wheel-center-label').textContent==='隐藏到托盘';
    document.querySelector('#wheel').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
    return {ok,keyboard,closing:!wheel.isOpen};})()`);
  await new Promise(resolve => setTimeout(resolve, 260));
  const escaped = await run(`document.querySelector('#wheel').hidden&&lastDockHold===false`);
  if (!hovered.ok || !hovered.keyboard || !hovered.closing || !escaped)
    throw Error('wheel focus ' + JSON.stringify({ ...hovered, escaped }));
  const toggled = await run(`(async()=>{
    const wait=async(test,label)=>{const until=Date.now()+5000;while(!test()){if(Date.now()>until)throw Error('wheel wait: '+label);await new Promise(r=>setTimeout(r,30));}};
    const open=()=>document.querySelector('#pet').dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:smokeWheelPoint.x,clientY:smokeWheelPoint.y}));
    open();await new Promise(r=>setTimeout(r,450));
    document.querySelector('[data-wheel=companion]').click();
    await wait(()=>settings.companion===false,'companion off');
    await wait(()=>document.querySelector('#bubble-message').textContent==='好，那我安静陪着你。','off message');
    open();await new Promise(r=>setTimeout(r,450));
    const offShown=document.querySelector('[data-wheel=companion]').classList.contains('off');
    document.querySelector('[data-wheel=companion]').click();
    await wait(()=>settings.companion===true,'companion on');
    open();await new Promise(r=>setTimeout(r,450));
    // Pressing outside the sectors closes the menu and must not reach Luna's own click handler.
    let petClicked=false;const spy=()=>{petClicked=true;};document.querySelector('#pet').addEventListener('click',spy);
    const point=smokeWheelPoint,target=document.querySelector('#wheel .wheel-center');
    target.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,clientX:point.x,clientY:point.y}));
    document.querySelector('#pet').dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:point.x,clientY:point.y}));
    document.querySelector('#pet').removeEventListener('click',spy);
    await new Promise(r=>setTimeout(r,260));
    const dismissed=!wheel.isOpen&&document.querySelector('#wheel').hidden&&!petClicked;
    feedback.show('');
    return {offShown,dismissed};
  })()`);
  if (!toggled.offShown || !toggled.dismissed) throw Error('wheel actions ' + JSON.stringify(toggled));
  return {
    opens: true,
    openingAnimation: true,
    sectorHitTest: true,
    insideWindow: true,
    edgeHold: true,
    hoverCenter: true,
    keyboard: true,
    escape: true,
    toggleAction: true,
    dismissWithoutClickThrough: true
  };
}
module.exports = { check };
