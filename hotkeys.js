(function (root, factory) {
  const value = factory();
  if (typeof module === 'object' && module.exports) module.exports = value;
  else root.claudexHotkeys = value;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  const labels = Object.freeze({
    screenshot: '截图',
    recording: '录屏',
    library: '收藏夹',
    reminder: '提醒',
    pureMode: '纯净模式'
  });
  const defaults = Object.freeze({
    screenshot: 'Ctrl+Alt+A',
    recording: 'Ctrl+Alt+R',
    library: 'Ctrl+Alt+C',
    reminder: '',
    pureMode: ''
  });
  const actions = Object.keys(defaults);
  const aliases = {
    control: 'Ctrl',
    ctrl: 'Ctrl',
    commandorcontrol: 'Ctrl',
    cmdorctrl: 'Ctrl',
    alt: 'Alt',
    shift: 'Shift',
    super: 'Super',
    win: 'Super',
    meta: 'Super'
  };
  const keys = [
    'Space',
    'Tab',
    'Enter',
    'Backspace',
    'Delete',
    'Insert',
    'Home',
    'End',
    'PageUp',
    'PageDown',
    'Left',
    'Right',
    'Up',
    'Down',
    'Esc'
  ];
  function normalize(value) {
    if (typeof value !== 'string' || value.length > 80) throw Error('快捷键格式无效。');
    if (!value.trim()) return '';
    const parts = value.split('+').map(part => part.trim());
    const rawKey = parts.pop();
    const key =
      /^[a-z0-9]$/i.test(rawKey) || /^f([1-9]|1\d|2[0-4])$/i.test(rawKey)
        ? rawKey.toUpperCase()
        : keys.find(item => item.toLowerCase() === rawKey.toLowerCase());
    const modifiers = parts.map(part => aliases[part.toLowerCase()]);
    if (
      !key ||
      modifiers.some(part => !part) ||
      new Set(modifiers).size !== modifiers.length ||
      (!modifiers.some(part => ['Ctrl', 'Alt', 'Super'].includes(part)) && !/^F\d+$/.test(key))
    )
      throw Error('请使用 Ctrl、Alt 或 Win 组合键，或 F1–F24。');
    const result = ['Ctrl', 'Alt', 'Shift', 'Super']
      .filter(part => modifiers.includes(part))
      .concat(key)
      .join('+');
    if (['Alt+F4', 'Ctrl+Alt+Delete', 'Ctrl+Shift+Esc', 'Super+L', 'Super+D', 'Super+Tab'].includes(result))
      throw Error('这个组合键由系统使用，请换一个。');
    return result;
  }
  function validate(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('快捷键格式无效。');
    const result = {},
      used = new Set();
    for (const action of actions) {
      const key = normalize(input[action] ?? defaults[action]);
      if (key && used.has(key)) throw Error('快捷键重复，请为每个功能设置不同的组合键。');
      if (key) used.add(key);
      result[action] = key;
    }
    return result;
  }
  function migrate(input, legacyEnabled = true) {
    const result = {},
      used = new Set();
    for (const action of actions) {
      let key = '';
      try {
        key = normalize(
          input?.[action] ?? (action === 'screenshot' && legacyEnabled === false ? '' : defaults[action])
        );
      } catch {}
      if (used.has(key)) key = '';
      if (key) used.add(key);
      result[action] = key;
    }
    return result;
  }
  function fromEvent(event) {
    let key = event.code || event.key;
    if (/^Key[A-Z]$/.test(key)) key = key.slice(3);
    else if (/^Digit\d$/.test(key)) key = key.slice(5);
    else
      key =
        { ArrowLeft: 'Left', ArrowRight: 'Right', ArrowUp: 'Up', ArrowDown: 'Down', Escape: 'Esc', ' ': 'Space' }[
          key
        ] || key;
    return normalize(
      [event.ctrlKey && 'Ctrl', event.altKey && 'Alt', event.shiftKey && 'Shift', event.metaKey && 'Super', key]
        .filter(Boolean)
        .join('+')
    );
  }
  const display = value => value.replace(/Super/g, 'Win').split('+').join(' + ');
  function screenshotHint(status, t) {
    return !status.enabled
      ? t('截图收藏 · 快捷键已关闭')
      : status.available
        ? `${t('截图收藏')} · ${display(status.accelerator || defaults.screenshot)}`
        : t('截图收藏 · 快捷键被占用，请点击图标');
  }
  return { actions, labels, defaults, normalize, validate, migrate, fromEvent, display, screenshotHint };
});
