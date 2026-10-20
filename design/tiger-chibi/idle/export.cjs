const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'luna-chibi-idle-'));
app.setPath('userData', profile);
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');
const output = path.join(__dirname, 'frames');
fs.mkdirSync(output, { recursive: true });
let win;

async function main() {
  await app.whenReady();
  win = new BrowserWindow({
    show: false,
    width: 900,
    height: 1000,
    backgroundColor: '#00000000',
    webPreferences: { contextIsolation: true, sandbox: true, backgroundThrottling: false }
  });
  win.webContents.on('console-message', (_event, ...args) => console.log(...args));
  await win.loadFile(path.join(__dirname, 'index.html'), { query: { export: '1' } });
  await win.webContents.executeJavaScript('window.idleAnimator.ready');
  const frame = async index => {
    if (!win || win.isDestroyed() || win.webContents.isDestroyed()) throw new Error('导出窗口已关闭');
    const url = await win.webContents.executeJavaScript(`window.idleAnimator.renderFrame(${index})`);
    return Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
  };
  const first = await frame(0);
  const seam = await frame(180);
  if (!first.equals(seam)) throw new Error('循环首尾不一致');
  for (let i = 0; i < 180; i++) {
    fs.writeFileSync(path.join(output, `frame-${String(i).padStart(3, '0')}.png`), i === 0 ? first : await frame(i));
    if (i % 30 === 0) console.log(`导出 ${i}/180`);
  }
  const samples = await win.webContents.executeJavaScript(`(() => {
    const times = [0, 0.75, 1.73, 2.25, 3.75, 4.43];
    const sheet = document.createElement('canvas'); sheet.width = 1200; sheet.height = 900;
    const ctx = sheet.getContext('2d'); ctx.fillStyle = '#e9e6ef'; ctx.fillRect(0, 0, 1200, 900);
    const pet = document.getElementById('pet');
    times.forEach((t, i) => {
      window.idleAnimator.drawAt(t);
      const x = i % 3 * 400, y = Math.floor(i / 3) * 450;
      ctx.drawImage(pet, x + 20, y + 10, 360, 379);
      ctx.fillStyle = '#50485c'; ctx.font = '20px sans-serif'; ctx.fillText(t.toFixed(2) + ' s', x + 165, y + 425);
    });
    return sheet.toDataURL('image/png');
  })()`);
  fs.writeFileSync(path.join(__dirname, 'contact-sheet.png'), Buffer.from(samples.split(',')[1], 'base64'));
  fs.writeFileSync(
    path.join(__dirname, 'animation.json'),
    JSON.stringify(
      {
        source: '../standing-front-v4.png',
        closedEyes: 'blink-closed-source.png',
        width: 768,
        height: 808,
        fps: 30,
        frames: 180,
        durationSeconds: 6,
        loop: true,
        effects: ['local-breathing-deformation', 'eyelid-blink', 'local-tail-sway'],
        blinkStartSeconds: [1.62, 4.32],
        feetFixed: true,
        loopSeamIdentical: true,
        firstFrameSha256: crypto.createHash('sha256').update(first).digest('hex')
      },
      null,
      2
    ) + '\n'
  );
  console.log('IDLE_EXPORT_OK: 180 帧；t=0 与 t=6 完全一致');
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
