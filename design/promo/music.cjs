const fs = require('node:fs');
// An original, deterministic instrumental cue: soft electric keys and a sine pad.
// No samples, external songs, downloaded assets, speech or imitation of an artist.
module.exports = function writeMusic(file, seconds = 20) {
  const rate = 48000,
    frames = rate * seconds;
  const left = new Float32Array(frames),
    right = new Float32Array(frames);
  const beat = 60 / 72;
  const frequency = midi => 440 * 2 ** ((midi - 69) / 12);
  function note(start, length, midi, gain, pan, pad = false) {
    const hz = frequency(midi);
    const begin = Math.floor(start * rate),
      count = Math.floor(length * rate);
    for (let i = 0; i < count && begin + i < frames; i++) {
      const t = i / rate;
      const envelope = pad
        ? Math.min(1, t / 0.65) * Math.min(1, (length - t) / 1.0) * 0.55
        : (1 - Math.exp(-t * 90)) * Math.exp(-t * 1.7) * Math.min(1, (length - t) / 0.3);
      const fundamental = Math.sin(2 * Math.PI * hz * t);
      const wave = pad ? fundamental : fundamental + 0.18 * Math.sin(2 * Math.PI * hz * 2 * t) * Math.exp(-t * 3);
      const value = gain * envelope * wave;
      left[begin + i] += value * Math.sqrt((1 - pan) / 2);
      right[begin + i] += value * Math.sqrt((1 + pan) / 2);
    }
  }
  const chords = [
    [50, 57, 61, 66],
    [47, 54, 57, 62],
    [43, 50, 54, 59],
    [45, 52, 57, 62]
  ];
  const melody = [74, 69, 78, 76, 74, 73, 71, 69, 71, 74, 78, 76, 74, 69, 73, 74];
  for (let bar = 0; bar * 4 * beat < seconds; bar++) {
    const at = bar * 4 * beat,
      chord = chords[bar % chords.length];
    chord.forEach((midi, i) => note(at, 5, midi, 0.022, (i - 1.5) / 2, true));
    note(at, 3.2, chord[0], 0.09, 0);
    [0, 1.5, 2.5, 3.5].forEach((offset, i) =>
      note(at + offset * beat, 3.4, melody[(bar * 4 + i) % melody.length], 0.095, i % 2 ? 0.3 : -0.3)
    );
  }
  // Small, quiet stereo delay; only the original generated signal is used.
  const delay = Math.floor(rate * 0.31);
  for (let i = frames - 1; i >= delay; i--) {
    left[i] += right[i - delay] * 0.18;
    right[i] += left[i - delay] * 0.18;
  }
  const buffer = Buffer.alloc(44 + frames * 4);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(buffer.length - 8, 4);
  buffer.write('WAVEfmt ', 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(2, 22);
  buffer.writeUInt32LE(rate, 24);
  buffer.writeUInt32LE(rate * 4, 28);
  buffer.writeUInt16LE(4, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(frames * 4, 40);
  for (let i = 0; i < frames; i++) {
    const t = i / rate;
    const fade = 2 * Math.min(1, t / 1.1, (seconds - t) / 1.8);
    buffer.writeInt16LE(Math.round(Math.max(-1, Math.min(1, left[i] * fade)) * 32767), 44 + i * 4);
    buffer.writeInt16LE(Math.round(Math.max(-1, Math.min(1, right[i] * fade)) * 32767), 46 + i * 4);
  }
  fs.writeFileSync(file, buffer);
};
