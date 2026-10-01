// Optional real-network check, run with Electron from the repository root.
const {app,net,nativeImage}=require('electron');
const fs=require('node:fs');
const path=require('node:path');
const {fetchLinkPreview}=require('../link-preview');
app.setPath('userData',path.join(app.getPath('temp'),'luna-link-network-'+process.pid));
app.whenReady().then(async()=>{
  try{
    const preview=await fetchLinkPreview('https://ogp.me/',{fetch:net.fetch.bind(net),thumbnail:bytes=>{
      const image=nativeImage.createFromBuffer(bytes);return image.isEmpty()?'':image.resize({width:180}).toDataURL();
    }});
    const result={success:true,title:preview.title,hasImage:!!preview.image};
    fs.writeFileSync(path.join(app.getPath('temp'),'luna-link-network-result.json'),JSON.stringify(result));
    console.log(JSON.stringify(result));app.exit(0);
  }catch(error){console.error(error.message);app.exit(1);}
});
