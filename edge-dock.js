// Bounds are DIP. Keep the normal position separate from the small edge handle.
function createEdgeDock({getWindow,getArea,onChange=()=>{},onPosition=()=>{},canCollapse=()=>true,schedule=setTimeout,cancel=clearTimeout,delay=5000,width=280,height=640}){
  let side=null,collapsed=false,held=false,stopped=false,timer=null,version=0,adjusting=false;
  let bounds={...getWindow().getBounds()};
  const live=()=>{const win=getWindow();return !stopped&&win&&!win.isDestroyed()?win:null;};
  const read=()=>({side,collapsed});
  function clear(){version++;if(timer!==null)cancel(timer);timer=null;}
  function fit(){const area=getArea(bounds);bounds={x:side==='left'?area.x:side==='right'?area.x+Math.max(0,area.width-width):Math.max(area.x,Math.min(bounds.x,area.x+Math.max(0,area.width-width))),y:Math.max(area.y,Math.min(bounds.y,area.y+Math.max(0,area.height-height))),width,height};return area;}
  function apply(next){const win=live();if(!win)return;adjusting=true;try{win.setIgnoreMouseEvents(false);win.setBounds(next);}finally{adjusting=false;}onChange(read());}
  function arm(){clear();if(!live()||!side||collapsed||held)return;const token=version;timer=schedule(()=>{timer=null;if(stopped||token!==version)return;collapse();},delay);}
  function collapse(){const win=live();if(!win||!side||collapsed)return false;if(held||!win.isVisible()||!canCollapse()){arm();return false;}clear();const area=fit();onPosition([bounds.x,bounds.y]);collapsed=true;apply({x:side==='left'?area.x:area.x+area.width-36,y:Math.max(area.y,Math.min(bounds.y+height-60,area.y+area.height-44)),width:36,height:44});return true;}
  function expand(){if(!live())return false;clear();if(collapsed){fit();collapsed=false;apply({...bounds});}arm();return true;}
  function beginDrag(){if(!live())return;expand();clear();side=null;onChange(read());}
  function finishDrag(){const win=live();if(!win)return;bounds={...win.getBounds(),width,height};const area=fit();side=bounds.x-area.x<=12?'left':area.x+area.width-width-bounds.x<=12?'right':null;fit();onPosition([bounds.x,bounds.y]);if(side){apply({...bounds});collapse();}else onChange(read());}
  function hold(value){held=value===true;if(held)clear();else arm();}
  function noteMove(next){if(!stopped&&!collapsed&&!adjusting&&next.width===width&&next.height===height)bounds={...next};}
  function reflow(){if(!live())return;const wasCollapsed=collapsed;clear();fit();if(wasCollapsed){collapsed=false;apply({...bounds});collapse();}else{apply({...bounds});arm();}onPosition([bounds.x,bounds.y]);}
  return {read,expand,beginDrag,finishDrag,hold,noteMove,reflow,isAdjusting:()=>adjusting,stop:()=>{clear();stopped=true;}};
}
module.exports={createEdgeDock};
