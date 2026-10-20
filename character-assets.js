// Q-version Luna is a set of looping poses. Each pose is one WebP atlas of equal-sized transparent frames,
// exported by design/chibi/build-atlas.py. Poses that have no art yet fall back to idle.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.lunaCharacterAssets = factory();
})(typeof window === 'object' ? window : globalThis, () => {
  // Frame size in atlas pixels; the body centre is where the torso sits, the tail extends to the left.
  const stage = Object.freeze({ width: 270, height: 332, center: 165 });
  const poses = {
    idle: { file: 'chibi/idle.webp', frames: 117, columns: 12, fps: 16, loop: 'pingpong' }
  };
  // Expressions requested by the app map to poses; missing poses play idle with a small hop.
  const expressionPoses = Object.freeze({
    neutral: 'idle',
    closed: 'idle',
    sleeping: 'sleep',
    working: 'work',
    happy: 'happy',
    smile: 'happy',
    wink: 'happy',
    shy: 'shy',
    angry: 'angry',
    furious: 'angry',
    pout: 'angry'
  });
  function validatePose(pose) {
    if (
      !pose ||
      typeof pose.file !== 'string' ||
      !/^[a-z0-9/_-]+\.(webp|png)$/.test(pose.file) ||
      /\.\./.test(pose.file)
    )
      throw Error('Invalid pose file');
    for (const key of ['frames', 'columns', 'fps'])
      if (!Number.isInteger(pose[key]) || pose[key] < 1) throw Error('Invalid pose ' + key);
    if (!['loop', 'pingpong', 'once'].includes(pose.loop)) throw Error('Invalid pose loop');
    return pose;
  }
  function validateImage(pose, image) {
    const rows = Math.ceil(pose.frames / pose.columns);
    if (image.naturalWidth !== stage.width * pose.columns || image.naturalHeight !== stage.height * rows)
      throw Error('Pose atlas size does not match its frame layout');
  }
  function poseFor(expression) {
    const name = expressionPoses[expression] || 'idle';
    return Object.hasOwn(poses, name) ? name : 'idle';
  }
  // Frame order for a time in seconds; ping-pong plays forward then back without repeating the end frames.
  function frameAt(pose, seconds) {
    const step = Math.max(0, Math.floor(seconds * pose.fps));
    if (pose.frames === 1) return 0;
    if (pose.loop === 'once') return Math.min(step, pose.frames - 1);
    if (pose.loop === 'loop') return step % pose.frames;
    const cycle = pose.frames * 2 - 2,
      index = step % cycle;
    return index < pose.frames ? index : cycle - index;
  }
  function freeze(value) {
    Object.values(value).forEach(item => {
      if (item && typeof item === 'object') freeze(item);
    });
    return Object.freeze(value);
  }
  Object.values(poses).forEach(validatePose);
  return freeze({ stage, poses, expressionPoses, validatePose, validateImage, poseFor, frameAt });
});
