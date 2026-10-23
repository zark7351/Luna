const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'claude-sleep-export-')));
const output = path.join(__dirname, 'frames');
fs.mkdirSync(output, { recursive: true });
let win;
async function main() {
  await app.whenReady();
  win = new BrowserWindow({
    show: false,
    webPreferences: { sandbox: true, contextIsolation: true, backgroundThrottling: false }
  });
  await win.loadFile(path.join(__dirname, 'index.html'), { query: { export: '1' } });
  await win.webContents.executeJavaScript('window.sleepAnimator.ready');
  const frame = async index => {
    if (!win || win.isDestroyed() || win.webContents.isDestroyed()) throw Error('导出窗口已关闭');
    const url = await win.webContents.executeJavaScript(`window.sleepAnimator.renderFrame(${index})`);
    return Buffer.from(url.split(',')[1], 'base64');
  };
  const first = await frame(0);
  if (!first.equals(await frame(144))) throw Error('睡眠循环首尾不一致');
  for (let i = 0; i < 144; i++) {
    fs.writeFileSync(path.join(output, `frame-${String(i).padStart(3, '0')}.png`), i === 0 ? first : await frame(i));
    if (i % 24 === 0) console.log(`SLEEP_EXPORT ${i}/144`);
  }
  console.log('SLEEP_EXPORT_OK: 144 frames; seam identical');
}
main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    if (win && !win.isDestroyed()) win.destroy();
    app.quit();
  });
