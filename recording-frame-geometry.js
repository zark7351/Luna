(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.recordingFrameGeometry=factory();})(globalThis,()=>{
  function clamp(rect,bounds){
    if(!rect||!['x','y','width','height'].every(key=>Number.isFinite(rect[key])))throw Error('录屏范围无效。');
    const width=Math.min(bounds.width,Math.max(Math.min(32,bounds.width),Math.round(rect.width))),height=Math.min(bounds.height,Math.max(Math.min(32,bounds.height),Math.round(rect.height)));
    return {x:Math.max(0,Math.min(bounds.width-width,Math.round(rect.x))),y:Math.max(0,Math.min(bounds.height-height,Math.round(rect.y))),width,height};
  }
  function drag(rect,edge,dx,dy,bounds){
    if(edge==='move')return clamp({...rect,x:rect.x+dx,y:rect.y+dy},bounds);
    const minW=Math.min(32,bounds.width),minH=Math.min(32,bounds.height);let left=rect.x,top=rect.y,right=left+rect.width,bottom=top+rect.height;
    if(edge.includes('w'))left=Math.max(0,Math.min(right-minW,left+dx));if(edge.includes('e'))right=Math.min(bounds.width,Math.max(left+minW,right+dx));
    if(edge.includes('n'))top=Math.max(0,Math.min(bottom-minH,top+dy));if(edge.includes('s'))bottom=Math.min(bounds.height,Math.max(top+minH,bottom+dy));
    return clamp({x:left,y:top,width:right-left,height:bottom-top},bounds);
  }
  function toolbar(rect,bounds,width=180,height=32){width=Math.min(width,bounds.width);height=Math.min(height,bounds.height);const outside=rect.y>=height+8;return {x:Math.max(0,Math.min(bounds.width-width,rect.x+rect.width-width)),y:Math.max(0,Math.min(bounds.height-height,outside?rect.y-height-6:rect.y+6)),width,height,inside:!outside};}
  return {clamp,drag,toolbar};
});
