const {app,nativeImage}=require('electron');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {createTrayIcon,appIcon}=require('../app-branding');
const output=fs.mkdtempSync(path.join(os.tmpdir(),'luna-branding-test-'));app.setPath('userData',path.join(output,'data'));
app.whenReady().then(()=>{
  const avatar=nativeImage.createFromPath(appIcon),tray=createTrayIcon(nativeImage);
  assert.equal(avatar.isEmpty(),false);assert.equal(tray.isEmpty(),false);assert.deepEqual(tray.getSize(),{width:32,height:32});
  fs.writeFileSync(path.join(output,'tray.png'),tray.toPNG());
  const decoded=nativeImage.createFromBuffer(tray.toPNG()).toBitmap();
  const center=(16*32+16)*4;assert.equal(decoded[center+3],0);
  const ring=(3*32+16)*4;assert.deepEqual([...decoded.subarray(ring,ring+4)],[170,104,144,255]);
  console.log('NATIVE_BRANDING_PASS '+output);app.exit(0);
}).catch(error=>{console.error(error);app.exit(1);});
