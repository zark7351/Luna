const fs = require('node:fs');
const path = require('node:path');
const {ensureRcedit,ensureFFmpeg,run}=require('./prepare-build-tools.cjs');
try {
  if (process.platform !== 'win32') throw Error('Please build the Windows portable app on Windows.');
  const source = __dirname;
  const runtime = path.join(source, 'node_modules', 'electron', 'dist');
  const output = path.resolve(source, '..', 'LunaPet-Windows');
  const appDir = path.join(output, 'resources', 'app');
  const files = ['translations.js','i18n.js','language-smoke.js','pure-mode-smoke.js','package.json','app-branding.js','effect-events.js','ui-effects.js','ui-effects.css','icons.js','panel-bridge.js','main.js','recording.js','recording-frame-smoke.js','recording-frame-geometry.js','recording-border-preload.js','recording-border.html','recording-border.css','recording-border.js','recording-options.js','recording-preload.js','recording.html','recording.css','recording-renderer.js','sound-events.js','ui-sounds.js','preload.js','core.js','idle.js','reminders.js','reminder-preload.js','reminder.html','reminder.css','reminder-renderer.js','live-selection-smoke.js','screenshot.js','screenshot-preload.js','screenshot-renderer.js','screenshot.html','screenshot.css','system-stats.js','weather.js','weather-ui.js','body-shortcuts.js','shortcut-bubbles.js','body-shortcut-smoke.js','edge-dock.js','edge-smoke.js','collection.js','media.js','file-actions.js','link-preview.js','renderer.js','anger-interaction.js','anger-smoke.js','character.js','character-assets.js','CHARACTER-ASSETS.md','character-smoke.js','reminder-input-smoke.js','bubble-smoke.js','pet-feedback.js','reminder-alerts.js','style.css','index.html','video-menu-smoke.js','compact-video.js','library.js','library.css','library.html','README.md','ASSET-PROMPT.txt','ASSET-AUDIO-CREDITS.md','ASSET-WARDROBE-PROMPT.txt','ASSET-WARDROBE-ITEMS-PROMPT.txt','CROSS-COMPUTER.md','HANDOFF.md','ROADMAP.md','AGENTS.md'];
  if (!fs.existsSync(path.join(runtime, 'electron.exe'))) throw Error('Missing Electron runtime. Run npm ci, then node node_modules/electron/install.js.');
  for (const name of [...files, 'assets']) {
    if (!fs.existsSync(path.join(source, name))) throw Error(`Missing source: ${name}`);
  }
  fs.mkdirSync(output, {recursive:true});
  for (const entry of fs.readdirSync(runtime)) {
    const targetName = entry === 'electron.exe' ? 'LunaPet.exe' : entry;
    fs.cpSync(path.join(runtime, entry), path.join(output, targetName), {recursive:true,force:true});
  }
  fs.mkdirSync(appDir, {recursive:true});
  const ffmpeg=ensureFFmpeg();
  fs.mkdirSync(path.join(appDir,'tools'),{recursive:true});
  fs.copyFileSync(path.join(ffmpeg,'bin','ffmpeg.exe'),path.join(appDir,'tools','ffmpeg.exe'));
  for(const name of ['LICENSE','README.txt'])if(fs.existsSync(path.join(ffmpeg,name)))fs.copyFileSync(path.join(ffmpeg,name),path.join(appDir,'tools',name));
  fs.copyFileSync(path.join(source,'native-recording.js'),path.join(appDir,'native-recording.js'));
  fs.copyFileSync(path.join(source,'FFMPEG-NOTICE.md'),path.join(appDir,'tools','FFMPEG-NOTICE.md'));
  // Remove the obsolete online transport from an existing portable output.
  for (const retired of ['network.js','info-ui.js','preview.png','smoke-result.json']) fs.rmSync(path.join(appDir, retired), {force:true});
  for (const name of files) fs.copyFileSync(path.join(source,name), path.join(appDir,name));
  fs.mkdirSync(path.join(appDir,'installer'), {recursive:true});
  fs.copyFileSync(path.join(source,'installer','README.md'), path.join(appDir,'installer','README.md'));
  fs.cpSync(path.join(source,'assets'), path.join(appDir,'assets'), {recursive:true,force:true});
  fs.copyFileSync(path.join(source,'README.md'), path.join(output,'使用说明.md'));
  const version=require('./package.json').version;
  run(ensureRcedit(),[path.join(output,'LunaPet.exe'),'--set-icon',path.join(source,'assets','luna.ico'),'--set-file-version',version,'--set-product-version',version,'--set-version-string','ProductName','露娜','--set-version-string','FileDescription','露娜 '+version+' 桌面宠物','--set-version-string','OriginalFilename','LunaPet.exe','--set-version-string','InternalName','LunaPet','--set-requested-execution-level','asInvoker']);
  console.log(`Build complete: ${path.join(output,'LunaPet.exe')}`);
} catch (error) {
  console.error(`Build failed: ${error.message}`);
  if (['EBUSY','EPERM','EACCES'].includes(error.code)) console.error('Close the running LunaPet portable app and retry.');
  process.exitCode = 1;
}
