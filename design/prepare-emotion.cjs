const {app,nativeImage}=require('electron');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
app.setPath('userData',fs.mkdtempSync(path.join(os.tmpdir(),'luna-emotion-export-')));
try{
  const output=path.join(__dirname,'emotions');fs.mkdirSync(output,{recursive:true});
  const source=nativeImage.createFromPath(path.join(__dirname,'..','assets','character.png'));
  fs.writeFileSync(path.join(output,'neutral-face-reference.png'),source.crop({x:180,y:40,width:160,height:160}).resize({width:1024,height:1024,quality:'best'}).toPNG());
  const angry=path.join(output,'angry-face-source.png');if(fs.existsSync(angry))fs.writeFileSync(path.join(__dirname,'..','assets','angry-face.png'),nativeImage.createFromPath(angry).resize({width:160,height:160,quality:'best'}).toPNG());
  console.log('EMOTION_REFERENCE_READY');
}catch(error){console.error(error);process.exitCode=1;}app.quit();
