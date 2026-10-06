(function(root){
  const formats={mp4:['video/mp4']};
  function validateOptions(input){if(!input||![15,24,30,60].includes(input.fps)||!Object.hasOwn(formats,input.format))throw Error('请选择有效格式与帧率。');return {fps:input.fps,format:input.format};}
  function region(rect,bounds,width,height){
    if(!rect||![rect.x,rect.y,rect.width,rect.height,bounds.width,bounds.height,width,height].every(Number.isFinite)||bounds.width<=0||bounds.height<=0||width<=0||height<=0)throw Error('录屏区域无效。');
    const x=Math.max(0,rect.x)*width/bounds.width,y=Math.max(0,rect.y)*height/bounds.height;
    const w=Math.min(rect.width*width/bounds.width,width-x),h=Math.min(rect.height*height/bounds.height,height-y);
    if(w<2||h<2)throw Error('录屏区域太小。');
    const scale=Math.min(1,4096/w,4096/h,Math.sqrt(8388608/(w*h)));
    return {x,y,width:w,height:h,outputWidth:Math.max(2,Math.floor(w*scale/2)*2),outputHeight:Math.max(2,Math.floor(h*scale/2)*2)};
  }
  const api={formats,validateOptions,region};if(typeof module==='object')module.exports=api;else root.recordingOptions=api;
})(globalThis);
