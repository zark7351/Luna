const selection=document.getElementById('selection'),label=document.getElementById('size');
let start=null,ready=false,busy=false,rect=null;
window.capture.state().then(state=>{if(!state)return window.capture.cancel();const image=document.getElementById('screen');image.onload=()=>{ready=true;};image.src=state.image;}).catch(()=>window.capture.cancel());
function point(event){return {x:Math.max(0,Math.min(innerWidth,event.clientX)),y:Math.max(0,Math.min(innerHeight,event.clientY))};}
function update(event){const p=point(event);rect={x:Math.min(start.x,p.x),y:Math.min(start.y,p.y),width:Math.abs(p.x-start.x),height:Math.abs(p.y-start.y)};Object.assign(selection.style,{left:rect.x+'px',top:rect.y+'px',width:rect.width+'px',height:rect.height+'px'});label.textContent=Math.round(rect.width)+' × '+Math.round(rect.height);Object.assign(label.style,{left:Math.min(innerWidth-120,rect.x+rect.width+8)+'px',top:Math.min(innerHeight-35,rect.y+rect.height+8)+'px'});}
document.addEventListener('pointerdown',event=>{if(event.button!==0 || !ready || busy)return;start=point(event);document.body.setPointerCapture(event.pointerId);selection.hidden=false;label.hidden=false;document.body.classList.add('selecting');update(event);});
document.addEventListener('pointermove',event=>{if(start && !busy)update(event);});
document.addEventListener('pointerup',async event=>{if(event.button!==0 || !start || busy)return;update(event);start=null;if(rect.width<2 || rect.height<2){selection.hidden=true;label.hidden=true;document.body.classList.remove('selecting');return;}busy=true;await window.capture.select(rect);});
document.addEventListener('pointercancel',()=>{if(!busy)window.capture.cancel();});
document.addEventListener('contextmenu',event=>{event.preventDefault();if(!busy)window.capture.cancel();});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!busy)window.capture.cancel();});
