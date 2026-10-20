const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repo = path.resolve(__dirname, '../../..');
const ffmpeg =
  process.argv[2] || path.join(repo, '.build-tools/ffmpeg-8.0.1/ffmpeg-8.0.1-essentials_build/bin/ffmpeg.exe');
if (!fs.existsSync(ffmpeg)) {
  throw new Error('未找到 FFmpeg。请先准备项目构建工具，或传入 FFmpeg 可执行文件路径。');
}
const input = ['-framerate', '30', '-i', path.join(__dirname, 'frames/frame-%03d.png')];
const background = ['-f', 'lavfi', '-i', 'color=c=0xe9e6ef:s=768x808:r=30'];
function run(name, args) {
  console.log(`编码 ${name}`);
  const result = spawnSync(
    ffmpeg,
    ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y', ...args, path.join(__dirname, name)],
    { stdio: 'inherit', windowsHide: true }
  );
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${name} 编码失败：${result.status}`);
}
run('idle-transparent.webp', [
  ...input,
  '-c:v',
  'libwebp_anim',
  '-lossless',
  '0',
  '-quality',
  '90',
  '-compression_level',
  '2',
  '-loop',
  '0'
]);
run('idle-transparent-master.apng', [...input, '-c:v', 'apng', '-plays', '0', '-f', 'apng']);
run('idle-preview.mp4', [
  ...input,
  ...background,
  '-filter_complex',
  '[1:v][0:v]overlay=shortest=1:format=auto,format=yuv420p',
  '-c:v',
  'libx264',
  '-crf',
  '18',
  '-preset',
  'medium',
  '-movflags',
  '+faststart',
  '-an'
]);
run('idle-preview.gif', [
  ...input,
  ...background,
  '-filter_complex',
  '[1:v][0:v]overlay=shortest=1,scale=384:404:flags=lanczos,split[a][b];' +
    '[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle',
  '-loop',
  '0'
]);
console.log('IDLE_ENCODING_OK');
