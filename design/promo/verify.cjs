const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const bin = path.join(require('../../prepare-build-tools.cjs').ensureFFmpeg(), 'bin');
const output = path.resolve(__dirname, '../../../Claudie-Promo');
const functional = process.argv.includes('--functional');
const seconds = functional ? 80 : 20;
const video = path.join(output, functional ? 'Claudie-功能操作演示-v2.mp4' : 'Claudie-B站视觉样片-v1.mp4');
function run(tool, args) {
  const result = spawnSync(path.join(bin, tool + '.exe'), args, { encoding: 'utf8', windowsHide: true });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, result.stderr);
  return result;
}
const media = JSON.parse(
  run('ffprobe', ['-v', 'error', '-count_frames', '-show_streams', '-show_format', '-of', 'json', video]).stdout
);
const picture = media.streams.find(stream => stream.codec_type === 'video');
const sound = media.streams.find(stream => stream.codec_type === 'audio');
assert.equal(picture.codec_name, 'h264');
assert.equal(picture.width, 1920);
assert.equal(picture.height, 1080);
assert.equal(picture.r_frame_rate, '24/1');
assert.equal(Number(picture.nb_read_frames), seconds * 24);
assert.equal(Number(media.format.duration), seconds);
assert.equal(sound.codec_name, 'aac');
assert.equal(sound.channels, 2);
assert.equal(Number(sound.sample_rate), 48000);
run('ffmpeg', ['-v', 'error', '-i', video, '-map', '0', '-f', 'null', '-']);
const volume = run('ffmpeg', ['-hide_banner', '-i', video, '-vn', '-af', 'volumedetect', '-f', 'null', '-']).stderr;
const mean = Number(volume.match(/mean_volume: ([\d.-]+) dB/)[1]);
const peak = Number(volume.match(/max_volume: ([\d.-]+) dB/)[1]);
assert.ok(mean > -40 && mean < -15, '背景音乐音量异常');
assert.ok(peak < -1, '音频峰值需保留余量');
const summary = {
  width: 1920,
  height: 1080,
  fps: 24,
  frames: seconds * 24,
  duration: seconds,
  video: 'H.264',
  audio: 'AAC stereo 48kHz',
  fullDecode: 'passed',
  audioMeanDb: mean,
  audioPeakDb: peak,
  bytes: fs.statSync(video).size,
  visualReview: functional
    ? 'Actual isolated application UI screenshots, annotated in 14 tutorial scenes; not continuous desktop footage.'
    : 'Six sampled frames inspected; composite demonstration, not live desktop capture.',
  scope: functional
    ? '80-second function and usage tutorial; background music, no narration or companionship copy.'
    : '20-second style sample; retired direction.'
};
if (functional) {
  const plan = JSON.parse(fs.readFileSync(path.join(output, 'functional-plan.json'), 'utf8'));
  assert.equal(plan.seconds, 80);
  assert.equal(plan.scenes.length, 14);
  const copy = plan.scenes.map(s => [...s.title, ...s.lines, s.caption].join('\n')).join('\n');
  assert.ok(!/陪伴|陪你|慵懒|托着|发呆|治愈/.test(copy), '功能视频不包含氛围叙述');
}
fs.writeFileSync(
  path.join(output, functional ? 'verification-functional.json' : 'verification.json'),
  JSON.stringify(summary, null, 2) + '\n'
);
console.log(JSON.stringify(summary, null, 2));
