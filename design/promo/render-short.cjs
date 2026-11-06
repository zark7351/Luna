const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { pathToFileURL } = require('node:url');
const { spawn, spawnSync } = require('node:child_process');
const { once } = require('node:events');
const assert = require('node:assert/strict');
const output = path.resolve(__dirname, '../../../Claudy-Promo');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'claudy-short-')));
let win, encoder;
function run(exe, args, options = {}) {
  const result = spawnSync(exe, args, { encoding: 'utf8', windowsHide: true, ...options });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}
async function main() {
  const bin = path.join(require('../../prepare-build-tools.cjs').ensureFFmpeg(), 'bin');
  const ffmpeg = path.join(bin, 'ffmpeg.exe');
  const ffprobe = path.join(bin, 'ffprobe.exe');
  const v4 = process.argv.includes('--v4');
  const version = v4 ? 'v4' : 'v3';
  const voiceDir = path.join(output, 'voice-' + version);
  const scriptPath = path.join(__dirname, v4 ? 'narration-v4.json' : 'short-script.json');
  fs.mkdirSync(voiceDir, { recursive: true });
  if (!v4)
    run(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        '& ([scriptblock]::Create([IO.File]::ReadAllText($env:CLAUDIE_VOICE_SCRIPT)))'
      ],
      {
        env: {
          ...process.env,
          CLAUDIE_VOICE_SCRIPT: path.join(__dirname, 'voice.ps1'),
          CLAUDIE_SCRIPT: scriptPath,
          CLAUDIE_AUDIO: voiceDir
        }
      }
    );
  const script = require(scriptPath);
  const inputs = script.map((_, i) => {
    const wav = path.join(voiceDir, `line-${i}.wav`);
    const file = !v4 || fs.existsSync(wav) ? wav : path.join(voiceDir, `line-${i}.mp3`);
    assert.ok(fs.existsSync(file), `缺少第 ${i + 1} 段旁白：${file}`);
    return file;
  });
  let frames = 0;
  const plan = script.map((scene, i) => {
    const duration = Number(
      run(ffprobe, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', inputs[i]]).trim()
    );
    assert.ok(duration > 1 && duration < (v4 ? 30 : 10));
    const count = Math.ceil((duration + (i === script.length - 1 ? 0.45 : 0.15)) * 24);
    const result = { ...scene, start: frames, frames: count, v4 };
    frames += count;
    return result;
  });
  const wav = path.join(output, `Claudy-普通话旁白-${version}.wav`);
  const mix = plan
    .map(
      (scene, i) =>
        `[${i}:a]aresample=24000,aformat=channel_layouts=mono,apad,atrim=end_sample=${scene.frames * 1000}[a${i}]`
    )
    .join(';');
  const concat = plan.map((_, i) => '[a' + i + ']').join('');
  run(ffmpeg, [
    '-v',
    'error',
    '-y',
    ...inputs.flatMap(file => ['-i', file]),
    '-filter_complex',
    mix + ';' + concat + 'concat=n=' + plan.length + ':v=0:a=1,loudnorm=I=-17:TP=-2:LRA=7',
    '-ar',
    '48000',
    '-ac',
    '1',
    wav
  ]);
  await app.whenReady();
  win = new BrowserWindow({
    show: false,
    width: 1920,
    height: 1080,
    webPreferences: { sandbox: true, contextIsolation: true, backgroundThrottling: false }
  });
  await win.loadFile(path.join(__dirname, 'short.html'));
  const base = pathToFileURL(path.join(output, 'functional-captures') + path.sep).href;
  await win.webContents.executeJavaScript(
    'window.prepareShort(' + JSON.stringify(plan) + ',' + JSON.stringify(base) + ')'
  );
  const video = path.join(output, `Claudy-功能速览-${version}.mp4`);
  encoder = spawn(
    ffmpeg,
    [
      '-v',
      'error',
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
      wav,
      '-map',
      '0:v:0',
      '-map',
      '1:a:0',
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
      '128k',
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
  const completed = once(encoder, 'close');
  const checks = new Map(
    plan.flatMap((scene, i) =>
      scene.shots.map((_, j) => [
        scene.start + Math.floor(((j + 0.5) * scene.frames) / scene.shots.length),
        version + '-' + (i + 1) + '-' + (j + 1)
      ])
    )
  );
  for (let i = 0; i < frames; i++) {
    if (win.isDestroyed() || win.webContents.isDestroyed()) throw Error('导出窗口已关闭');
    const data = await win.webContents.executeJavaScript('window.shortFrame(' + i + ')');
    const png = Buffer.from(data.split(',')[1], 'base64');
    if (checks.has(i)) fs.writeFileSync(path.join(voiceDir, checks.get(i) + '.png'), png);
    if (!encoder.stdin.write(png)) await once(encoder.stdin, 'drain');
    if (i % 120 === 0) console.log('SHORT_RENDER ' + i + '/' + frames);
  }
  encoder.stdin.end();
  const [code] = await completed;
  assert.equal(code, 0, log);
  const stamp = frame => new Date(Math.round((frame * 1000) / 24)).toISOString().slice(11, 23).replace('.', ',');
  fs.writeFileSync(
    path.join(output, `Claudy-口播字幕-${version}.srt`),
    plan
      .map((s, i) => i + 1 + '\n' + stamp(s.start) + ' --> ' + stamp(s.start + s.frames) + '\n' + s.say + '\n')
      .join('\n')
  );
  const probe = JSON.parse(run(ffprobe, ['-v', 'error', '-count_frames', '-show_streams', '-of', 'json', video]));
  const [picture, audio] = probe.streams;
  assert.equal(Number(picture.nb_read_frames), frames);
  assert.equal(picture.width, 1920);
  assert.equal(picture.height, 1080);
  assert.equal(audio.channels, 1);
  assert.ok(Math.abs(Number(audio.duration) - frames / 24) < 0.07);
  run(ffmpeg, ['-v', 'error', '-i', video, '-map', '0', '-f', 'null', '-']);
  fs.writeFileSync(
    path.join(voiceDir, 'verification.json'),
    JSON.stringify(
      {
        frames,
        seconds: frames / 24,
        width: 1920,
        height: 1080,
        fps: 24,
        audio: v4 ? '导入普通话旁白，无配乐' : '本地合成普通话旁白，无配乐',
        fullDecode: 'passed'
      },
      null,
      2
    )
  );
  console.log('SHORT_VIDEO_OK ' + frames / 24 + 's ' + video);
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
