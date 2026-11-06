const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { pathToFileURL } = require('node:url');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const output = path.resolve(__dirname, '../../../Claudy-Promo');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'claudy-functional-video-')));
let win, encoder;
async function main() {
  const ffmpeg = path.join(require('../../prepare-build-tools.cjs').ensureFFmpeg(), 'bin/ffmpeg.exe');
  const music = path.join(output, 'claudy-functional-music.wav');
  await app.whenReady();
  win = new BrowserWindow({
    show: false,
    width: 1920,
    height: 1080,
    webPreferences: { sandbox: true, contextIsolation: true, backgroundThrottling: false }
  });
  await win.loadFile(path.join(__dirname, 'functional.html'));
  const base = pathToFileURL(path.join(output, 'functional-captures') + path.sep).href;
  const plan = await win.webContents.executeJavaScript(`window.initializeFunctional(${JSON.stringify(base)})`);
  require('./music.cjs')(music, plan.seconds);
  const video = path.join(output, 'Claudy-功能操作演示-v2.mp4');
  encoder = spawn(
    ffmpeg,
    [
      '-hide_banner',
      '-y',
      '-f',
      'image2pipe',
      '-vcodec',
      'png',
      '-framerate',
      '24',
      '-i',
      'pipe:0',
      '-i',
      music,
      '-c:v',
      'libx264',
      '-preset',
      'fast',
      '-crf',
      '18',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-b:a',
      '192k',
      '-t',
      String(plan.seconds),
      '-movflags',
      '+faststart',
      video
    ],
    { windowsHide: true, stdio: ['pipe', 'ignore', 'pipe'] }
  );
  let log = '';
  encoder.stderr.on('data', chunk => {
    log += chunk;
  });
  encoder.stdin.on('error', error => console.error(error.message));
  const complete = once(encoder, 'close');
  const starts = new Map(plan.scenes.map((scene, i) => [Math.round((scene.start + 1.2) * 24), i]));
  for (let i = 0; i < plan.seconds * 24; i++) {
    if (win.isDestroyed() || win.webContents.isDestroyed()) throw Error('导出窗口已关闭');
    const data = await win.webContents.executeJavaScript(`window.renderFunctionalFrame(${i})`);
    const png = Buffer.from(data.split(',')[1], 'base64');
    if (starts.has(i))
      fs.writeFileSync(path.join(output, `v2-scene-${String(starts.get(i) + 1).padStart(2, '0')}.png`), png);
    if (!encoder.stdin.write(png)) await once(encoder.stdin, 'drain');
    if (i % 120 === 0) console.log(`FUNCTIONAL_RENDER ${i}/${plan.seconds * 24}`);
  }
  encoder.stdin.end();
  const [code] = await complete;
  fs.writeFileSync(path.join(output, 'functional-encode.log'), log);
  if (code !== 0) throw Error(log.slice(-1600));
  fs.writeFileSync(path.join(output, 'functional-plan.json'), JSON.stringify(plan, null, 2));
  const stamp = seconds =>
    `${String(Math.floor(seconds / 3600)).padStart(2, '0')}:${String(Math.floor(seconds / 60) % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')},000`;
  fs.writeFileSync(
    path.join(output, 'Claudy-功能操作字幕-v2.srt'),
    plan.scenes.map((s, i) => `${i + 1}\n${stamp(s.start)} --> ${stamp(s.start + s.length)}\n${s.caption}\n`).join('\n')
  );
  console.log('FUNCTIONAL_VIDEO_OK ' + video + ' ' + plan.seconds + 's');
}
main()
  .catch(error => {
    console.error(error);
    encoder?.kill();
    process.exitCode = 1;
  })
  .finally(() => {
    if (win && !win.isDestroyed()) win.destroy();
    app.quit();
  });
