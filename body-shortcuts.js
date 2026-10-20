(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.lunaBodyShortcuts = factory();
})(globalThis, () => {
  const regions = Object.freeze({
    head: '脑袋',
    chest: '胸部',
    arms: '手臂',
    forbidden: '禁区',
    legs: '腿',
    feet: '脚'
  });
  const actions = Object.freeze({
    library: { hint: '点击打开收藏', label: '收藏', icon: 'folder' },
    screenshot: { hint: '点击截图', label: '截图', icon: 'capture' },
    recording: { hint: '点击打开录屏', label: '录屏', icon: 'record' },
    reminder: { hint: '点击打开提醒', label: '提醒', icon: 'bell' },
    datetime: { hint: '点击查看日期时间', label: '日期时间', icon: 'clock' },
    stats: { hint: '点击查看系统占用', label: '系统占用', icon: 'stats' },
    weather: { hint: '点击查看天气', label: '天气', icon: 'sun' },
    settings: { hint: '点击打开设置', label: '设置', icon: 'settings' }
  });
  const defaults = Object.freeze({
    head: 'datetime',
    chest: 'weather',
    arms: 'library',
    forbidden: '',
    legs: 'stats',
    feet: 'reminder'
  });
  function validate(value) {
    return Object.fromEntries(
      Object.keys(regions).map(region => [
        region,
        value?.[region] === '' ? '' : Object.hasOwn(actions, value?.[region]) ? value[region] : defaults[region]
      ])
    );
  }
  // Points are in the 270 x 332 Q-version frame. The big head ends at the chin; sleeves and hands are arms,
  // the skirt centre and legs are legs. The tail on the far left does not trigger a shortcut.
  function regionAt(x, y, center = 165, forbidden = { y: 262, radiusX: 12, radiusY: 9 }) {
    if (![x, y, center].every(Number.isFinite) || x < 0 || x >= 270 || y < 0 || y >= 332) return null;
    if (y < 152) return 'head';
    if (x < center - 88) return null;
    if (y < 212 && Math.abs(x - center) < 36) return 'chest';
    if (forbidden && Math.hypot((x - center) / forbidden.radiusX, (y - forbidden.y) / forbidden.radiusY) < 1 - 1e-9)
      return 'forbidden';
    if (y < 270 && Math.abs(x - center) >= 38) return 'arms';
    if (y < 312) return 'legs';
    return 'feet';
  }
  function createReactions({ now = Date.now } = {}) {
    let sensitiveClicks = [];
    return {
      click(region) {
        if (!Object.hasOwn(regions, region)) return null;
        const time = now();
        sensitiveClicks = sensitiveClicks.filter(value => time - value >= 0 && time - value < 10000).slice(-3);
        if (['chest', 'forbidden'].includes(region)) sensitiveClicks.push(time);
        const annoyed = ['chest', 'forbidden'].includes(region) && sensitiveClicks.length >= 3;
        return {
          expression: annoyed
            ? 'angry'
            : { head: 'happy', chest: 'shy', forbidden: 'shy', arms: 'wink', legs: 'smile', feet: 'pout' }[region],
          annoyed
        };
      },
      reset() {
        sensitiveClicks = [];
      }
    };
  }
  return Object.freeze({ regions, actions, defaults, validate, regionAt, createReactions });
});
