(function(root){
  const formats={mp4:['video/mp4']};
  function validateOptions(input){if(!input||![15,24,30,60].includes(input.fps)||!Object.hasOwn(formats,input.format))throw Error('请选择有效格式与帧率。');return {fps:input.fps,format:input.format};}
  function region(rect,bounds,width,height){
    if(!rect||![rect.x,rect.y,rect.width,rect.height,bounds.width,bounds.height,width,height].every(Number.isFinite)||bounds.width<=0||bounds.height<=0||width<=0||height<=0)throw Error('录屏区域无效。');
    const x=Math.floor(Math.max(0,rect.x)*width/bounds.width),y=Math.floor(Math.max(0,rect.y)*height/bounds.height);
    // Native-sized crops must not resample the whole image just to drop an odd edge pixel.
    const w=Math.floor(Math.min(rect.width*width/bounds.width,width-x)/2)*2,h=Math.floor(Math.min(rect.height*height/bounds.height,height-y)/2)*2;
    if(w<2||h<2)throw Error('录屏区域太小。');
    return {x,y,width:w,height:h,outputWidth:w,outputHeight:h};
  }
  function captureOptions(config){
    const {width,height}=config.captureSize;
    if(!Number.isInteger(width)||!Number.isInteger(height)||width<2||height<2)throw Error('录屏区域无效。');
    return {audio:false,video:{mandatory:{chromeMediaSource:'desktop',chromeMediaSourceId:config.sourceId,minWidth:width,maxWidth:width,minHeight:height,maxHeight:height,minFrameRate:config.fps,maxFrameRate:config.fps}}};
  }
  function bitrate(width,height,fps){return Math.round(Math.min(100000000,Math.max(4000000,width*height*fps*.3)));}
  const api={formats,validateOptions,region,captureOptions,bitrate};if(typeof module==='object')module.exports=api;else root.recordingOptions=api;
})(globalThis);
