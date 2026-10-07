const {app,nativeImage}=require('electron');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
app.setPath('userData',fs.mkdtempSync(path.join(os.tmpdir(),'luna-icon-export-')));
try{
  const source=nativeImage.createFromPath(path.join(__dirname,'app-icon','luna-avatar-source.png'));
  if(source.isEmpty()||source.getSize().width!==source.getSize().height)throw Error('Square avatar required');
  fs.writeFileSync(path.join(__dirname,'..','assets','luna-avatar.png'),source.resize({width:256,height:256,quality:'best'}).toPNG());
  const sizes=[16,24,32,48,64,128,256],images=sizes.map(size=>source.resize({width:size,height:size,quality:'best'}).toPNG());
  const header=Buffer.alloc(6+16*sizes.length);header.writeUInt16LE(1,2);header.writeUInt16LE(sizes.length,4);let offset=header.length;
  images.forEach((bytes,index)=>{const entry=6+index*16;header[entry]=sizes[index]===256?0:sizes[index];header[entry+1]=header[entry];header.writeUInt16LE(1,entry+4);header.writeUInt16LE(32,entry+6);header.writeUInt32LE(bytes.length,entry+8);header.writeUInt32LE(offset,entry+12);offset+=bytes.length;});
  fs.writeFileSync(path.join(__dirname,'..','assets','luna.ico'),Buffer.concat([header,...images]));console.log('Exported 256px PNG and seven-size Windows ICO.');
}catch(error){console.error(error);process.exitCode=1;}app.quit();
