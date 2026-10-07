const path=require('node:path');
const APP_ID='LunaPet.Desktop';
const appIcon=path.join(__dirname,'assets','luna.ico');
// Windows nativeImage bitmap data is premultiplied BGRA. Supersample the ring edges.
function trayBitmap(size=32){
  if(!Number.isInteger(size)||size<16||size>256)throw Error('Invalid tray size');
  const bytes=Buffer.alloc(size*size*4),outer=size*.43,inner=size*.31;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    let covered=0;
    for(let sy=0;sy<4;sy++)for(let sx=0;sx<4;sx++){
      const radius=Math.hypot(x+(sx+.5)/4-size/2,y+(sy+.5)/4-size/2);
      if(radius<=outer&&radius>=inner)covered++;
    }
    const alpha=Math.round(covered/16*255),offset=(y*size+x)*4;
    bytes[offset]=Math.round(170*alpha/255);bytes[offset+1]=Math.round(104*alpha/255);bytes[offset+2]=Math.round(144*alpha/255);bytes[offset+3]=alpha;
  }
  return bytes;
}
function createTrayIcon(nativeImage){return nativeImage.createFromBitmap(trayBitmap(),{width:32,height:32});}
module.exports={APP_ID,appIcon,trayBitmap,createTrayIcon};
