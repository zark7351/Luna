const hotkeys = require('./hotkeys');

function createHotkeyManager(registry, dispatch) {
  let bindings = { ...hotkeys.defaults },
    suspended = false,
    stopped = false;
  const registered = new Set();
  const pending = new Set();
  const lastFire = new Map();
  function register(key) {
    try {
      if (
        !registry.register(key, () => {
          if (stopped || suspended) return;
          const action = hotkeys.actions.find(action => bindings[action] === key);
          if (!action || pending.has(action) || Date.now() - (lastFire.get(action) || 0) < 400) return;
          lastFire.set(action, Date.now());
          pending.add(action);
          Promise.resolve()
            .then(() => {
              if (!stopped && !suspended) return dispatch(action);
            })
            .catch(() => {})
            .finally(() => pending.delete(action));
        })
      )
        return false;
      registered.add(key);
      return true;
    } catch {
      return false;
    }
  }
  function release(key) {
    registry.unregister(key);
    registered.delete(key);
  }
  function resume() {
    if (stopped) return;
    suspended = false;
    for (const key of Object.values(bindings)) if (key && !registered.has(key)) register(key);
  }
  function status() {
    return {
      suspended,
      bindings: Object.fromEntries(
        hotkeys.actions.map(action => [
          action,
          {
            accelerator: bindings[action],
            enabled: !!bindings[action],
            available: registered.has(bindings[action])
          }
        ])
      )
    };
  }
  return {
    start(input) {
      bindings = hotkeys.validate(input);
      resume();
    },
    prepare(input) {
      if (stopped) throw Error('窗口已关闭');
      const next = hotkeys.validate(input),
        added = [];
      if (suspended) throw Error('请先结束快捷键录入，再保存。');
      for (const key of Object.values(next))
        if (key && !registered.has(key)) {
          if (!register(key)) {
            for (const key of added) release(key);
            const error = Error('快捷键被占用或不受系统支持，请换一个组合键。');
            error.shortcut = hotkeys.display(key);
            throw error;
          }
          added.push(key);
        }
      return {
        commit() {
          bindings = next;
          for (const key of [...registered]) if (!Object.values(next).includes(key)) release(key);
        },
        rollback() {
          for (const key of added) release(key);
        }
      };
    },
    suspend() {
      suspended = true;
      for (const key of [...registered]) release(key);
    },
    resume,
    status,
    stop() {
      stopped = true;
      for (const key of [...registered]) release(key);
    }
  };
}
module.exports = { createHotkeyManager };
