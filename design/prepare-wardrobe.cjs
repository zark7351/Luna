// Technical export only: resize generated alpha PNGs without repainting/removing pixels.
// Run with Electron: electron design/prepare-wardrobe.cjs
const {app,nativeImage}=require('electron');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const isolated=fs.mkdtempSync(path.join(os.tmpdir(),'luna-asset-export-'));app.setPath('userData',isolated);
const source=path.join(__dirname,'wardrobe-runtime'),output=path.join(__dirname,'..','assets');
try{
  const metadata={};
  for(const file of fs.readdirSync(source).filter(name=>/^luna-.*\.png$/.test(name))){
    const input=nativeImage.createFromPath(path.join(source,file));if(input.isEmpty())throw Error('Cannot decode '+file);
    const size=input.getSize(),scale=Math.min(512/size.width,1024/size.height),width=Math.round(size.width*scale),height=Math.round(size.height*scale);
    const resized=input.resize({width,height,quality:'best'}),pixels=resized.toBitmap(),canvas=Buffer.alloc(512*1024*4),left=Math.round((512-width)/2),top=0;
    for(let y=0;y<height;y++)pixels.copy(canvas,((top+y)*512+left)*4,y*width*4,(y+1)*width*4);
    let sum=0,count=0,transparent=0;
    for(let y=0;y<1024;y++)for(let x=0;x<512;x++){const alpha=canvas[(y*512+x)*4+3];if(!alpha)transparent++;if(y>=250&&y<950&&alpha>200){sum+=x;count++;}}
    if(transparent/(512*1024)<.25||!count)throw Error('Missing transparent full-body drawing: '+file);
    const normalized=nativeImage.createFromBitmap(canvas,{width:512,height:1024});fs.writeFileSync(path.join(output,file),normalized.toPNG());
    metadata[file]={sourceWidth:size.width,sourceHeight:size.height,width:512,height:1024,center:Math.round(sum/count*10)/10,transparent:Math.round(transparent/(512*1024)*100)};
  }
  fs.writeFileSync(path.join(source,'export.json'),JSON.stringify(metadata,null,2)+'\n');console.log(JSON.stringify(metadata));
}catch(error){console.error(error);process.exitCode=1;}
app.quit();
