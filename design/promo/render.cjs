const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const root = path.resolve(__dirname, '../..');
const output = path.resolve(root, '../Claudie-Promo');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'claudie-promo-'));
app.setPath('userData', profile);
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');
let win, encoder;
async function main() {
  fs.mkdirSync(output, { recursive: true });
  const ffmpeg = path.join(require('../../prepare-build-tools.cjs').ensureFFmpeg(), 'bin/ffmpeg.exe');
  const music = path.join(output, 'claudie-original-music.wav');
  require('./music.cjs')(music);
  await app.whenReady();
  win = new BrowserWindow({
    show: false,
    width: 1920,
    height: 1080,
    webPreferences: { sandbox: true, contextIsolation: true, backgroundThrottling: false }
  });
  win.webContents.on('console-message', (_event, ...args) => console.log('PAGE', ...args));
  await win.loadFile(path.join(__dirname, 'sample.html'));
  await win.webContents.executeJavaScript('window.promoReady');
  const video = path.join(output, 'Claudie-B站视觉样片-v1.mp4');
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
      'medium',
      '-crf',
      '18',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-b:a',
      '192k',
      '-t',
      '20',
      '-movflags',
      '+faststart',
      '-metadata',
      'title=Claudie visual sample v1',
      video
    ],
    { windowsHide: true, stdio: ['pipe', 'ignore', 'pipe'] }
  );
  let errors = '';
  encoder.stderr.on('data', chunk => {
    errors += chunk;
  });
  encoder.stdin.on('error', error => console.error(error.message));
  const completed = once(encoder, 'close');
  const samples = new Map([
    [48, '02-intro'],
    [120, '05-portrait'],
    [204, '08-desktop'],
    [248, '10-smile'],
    [342, '14-happy'],
    [432, '18-end']
  ]);
  for (let index = 0; index < 480; index++) {
    if (win.isDestroyed() || win.webContents.isDestroyed()) throw Error('导出窗口已关闭');
    const data = await win.webContents.executeJavaScript(`window.renderPromoFrame(${index})`);
    const png = Buffer.from(data.split(',')[1], 'base64');
    if (samples.has(index)) fs.writeFileSync(path.join(output, samples.get(index) + '.png'), png);
    if (!encoder.stdin.write(png)) await once(encoder.stdin, 'drain');
    if (index % 48 === 0) console.log(`PROMO_RENDER ${index}/480`);
  }
  encoder.stdin.end();
  const [code] = await completed;
  fs.writeFileSync(path.join(output, 'encode.log'), errors);
  if (code !== 0) throw Error('视频编码失败：' + errors.slice(-1600));
  fs.writeFileSync(
    path.join(output, 'Claudie-字幕-v1.srt'),
    '1\n00:00:00,500 --> 00:00:04,600\n……嗯？你来啦。\n\n' +
      '2\n00:00:07,300 --> 00:00:11,700\n我就在这儿，陪你一会儿。\n\n' +
      '3\n00:00:12,200 --> 00:00:15,600\n偶尔摸摸头，也会收到一个微笑。\n\n' +
      '4\n00:00:16,100 --> 00:00:19,500\n关注，等她来你的桌面\n'
  );
  console.log('PROMO_OK ' + video);
}
main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
    encoder?.kill();
  })
  .finally(() => {
    if (win && !win.isDestroyed()) win.destroy();
    app.quit();
  });
