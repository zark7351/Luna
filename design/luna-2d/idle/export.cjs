const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'luna-2d-idle-'));
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
  const seam = await frame(192);
  if (!first.equals(seam)) throw new Error('循环首尾不一致');
  for (let i = 0; i < 192; i++) {
    fs.writeFileSync(path.join(output, `frame-${String(i).padStart(3, '0')}.png`), i === 0 ? first : await frame(i));
    if (i % 24 === 0) console.log(`导出 ${i}/192`);
  }
  const samples = await win.webContents.executeJavaScript(`(() => {
    const times = [0, 1.78, 2.52, 4.0, 5.24, 6.15];
    const sheet = document.createElement('canvas'); sheet.width = 1440; sheet.height = 840;
    const ctx = sheet.getContext('2d'); ctx.fillStyle = '#f1eae0'; ctx.fillRect(0, 0, 1440, 840);
    const pet = document.getElementById('pet');
    times.forEach((t, i) => {
      window.idleAnimator.drawAt(t);
      const x = i % 3 * 480, y = Math.floor(i / 3) * 420;
      ctx.drawImage(pet, x + 10, y + 10, 460, 350);
      ctx.fillStyle = '#504034'; ctx.font = '20px sans-serif'; ctx.fillText(t.toFixed(2) + ' s', x + 200, y + 397);
    });
    return sheet.toDataURL('image/png');
  })()`);
  fs.writeFileSync(path.join(__dirname, 'contact-sheet.png'), Buffer.from(samples.split(',')[1], 'base64'));
  fs.writeFileSync(
    path.join(__dirname, 'animation.json'),
    JSON.stringify(
      {
        reference: '../default-pose.png',
        source: 'base-transparent.png',
        closedEyes: 'blink-closed-source.png',
        width: 768,
        height: 584,
        fps: 24,
        frames: 192,
        durationSeconds: 8,
        loop: true,
        effects: ['eyelid-blink', 'ear-twitch', 'local-tail-sway'],
        blinkStartSeconds: [1.65, 5.1, 5.55],
        faceAndHandsFixed: true,
        loopSeamIdentical: true,
        firstFrameSha256: crypto.createHash('sha256').update(first).digest('hex')
      },
      null,
      2
    ) + '\n'
  );
  console.log('IDLE_EXPORT_OK: 192 帧；t=0 与 t=8 完全一致');
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
