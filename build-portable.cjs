const fs = require('node:fs');
const path = require('node:path');
try {
  if (process.platform !== 'win32') throw Error('Please build the Windows portable app on Windows.');
  const source = __dirname;
  const runtime = path.join(source, 'node_modules', 'electron', 'dist');
  const output = path.resolve(source, '..', 'LunaPet-Windows');
  const appDir = path.join(output, 'resources', 'app');
  const files = ['package.json','main.js','preload.js','core.js','renderer.js','style.css','index.html','README.md','ASSET-PROMPT.txt','CROSS-COMPUTER.md','HANDOFF.md','ROADMAP.md','AGENTS.md'];
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
  // Remove the obsolete online transport from an existing portable output.
  fs.rmSync(path.join(appDir, 'network.js'), {force:true});
  for (const name of files) fs.copyFileSync(path.join(source,name), path.join(appDir,name));
  fs.cpSync(path.join(source,'assets'), path.join(appDir,'assets'), {recursive:true,force:true});
  fs.copyFileSync(path.join(source,'README.md'), path.join(output,'使用说明.md'));
  console.log(`Build complete: ${path.join(output,'LunaPet.exe')}`);
} catch (error) {
  console.error(`Build failed: ${error.message}`);
  if (['EBUSY','EPERM','EACCES'].includes(error.code)) console.error('Close the running LunaPet portable app and retry.');
  process.exitCode = 1;
}
