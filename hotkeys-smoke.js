const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { app, globalShortcut } = require('electron');
const schema = require('./hotkeys');
const { migrateState } = require('./core');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function check(live) {
  const { win, hotkeyManager: manager, hotkeyRegistry: registry, stateFile, screenshot, recording } = live;
  const read = code => win.webContents.executeJavaScript(code);
  const until = async (test, label) => {
    const end = Date.now() + 8000;
    while (!(await test())) {
      if (Date.now() > end) throw Error(label);
      await sleep(40);
    }
  };
  let nativeKey = '';
  try {
    for (const key of ['Ctrl+Alt+Shift+F11', 'Ctrl+Alt+Shift+F12', 'Ctrl+Alt+Shift+F10']) {
      if (!globalShortcut.isRegistered(key) && globalShortcut.register(key, () => {})) {
        nativeKey = key;
        break;
      }
    }
    assert.ok(nativeKey, 'Windows did not accept a test accelerator');
    assert.equal(globalShortcut.isRegistered(nativeKey), true);
    globalShortcut.unregister(nativeKey);
    assert.equal(globalShortcut.isRegistered(nativeKey), false);
    nativeKey = '';
    assert.deepEqual(live.state.settings.hotkeys, schema.defaults);
    await read('openSettings()');
    win.show();
    win.focus();
    assert.equal(await read(`document.querySelectorAll('.hotkey-row').length`), 5);
    const edit = async (action, key, modifiers = ['control', 'alt']) => {
      await read(`document.querySelector('#hotkey-${action}').focus()`);
      await until(() => manager.status().suspended, 'capture did not suspend global keys');
      win.webContents.sendInputEvent({ type: 'keyDown', keyCode: key, modifiers });
      win.webContents.sendInputEvent({ type: 'keyUp', keyCode: key, modifiers });
      await sleep(70);
      await read(`document.querySelector('#hotkey-${action}').blur()`);
      await until(() => !manager.status().suspended, 'capture did not release');
    };
    await edit('screenshot', 'S');
    assert.equal(await read(`document.querySelector('#hotkey-screenshot').value`), 'Ctrl + Alt + S');
    await edit('reminder', 'S');
    assert.equal(await read(`document.querySelector('#hotkey-reminder').value`), '');
    assert.match(
      await read(`document.querySelector('#hotkey-reminder').parentElement.querySelector('small').textContent`),
      /^$/
    );
    await edit('reminder', 'T');
    await edit('pureMode', 'P');
    await read(`document.querySelector('#settings-form').requestSubmit()`);
    await until(() => read(`document.querySelector('#settings').hidden`), 'custom shortcuts save failed');
    const expected = { ...schema.defaults, screenshot: 'Ctrl+Alt+S', reminder: 'Ctrl+Alt+T', pureMode: 'Ctrl+Alt+P' };
    assert.deepEqual(live.state.settings.hotkeys, expected);
    const saved = JSON.parse(fs.readFileSync(stateFile));
    assert.deepEqual(migrateState(saved).settings.hotkeys, expected, 'restart migration lost bindings');
    assert.equal(registry.isRegistered('Ctrl+Alt+A'), false);
    assert.equal(registry.isRegistered('Ctrl+Alt+S'), true);
    assert.match(await read(`document.querySelector('#screenshot-button').title`), /Ctrl \+ Alt \+ S/);
    await read('openSettings()');
    registry.register('Ctrl+Alt+Q', () => {});
    // This occupies the same isolated registry used by the app; it never claims a real user shortcut.
    await edit('screenshot', 'Q');
    await read(`document.querySelector('#settings-form').requestSubmit()`);
    await until(
      () => read(`document.querySelector('#settings-status').textContent.includes('被占用')`),
      'conflict was not reported'
    );
    assert.deepEqual(live.state.settings.hotkeys, expected, 'failed save changed settings');
    assert.deepEqual(JSON.parse(fs.readFileSync(stateFile)).settings.hotkeys, expected);
    assert.equal(registry.isRegistered('Ctrl+Alt+S'), true);
    registry.unregister('Ctrl+Alt+Q');
    await read(`document.querySelector('#settings-close').click()`);
    registry.fire('Ctrl+Alt+C');
    await until(() => read(`!document.querySelector('#library-sheet').hidden`), 'collection shortcut dispatch');
    registry.fire('Ctrl+Alt+T');
    await until(() => read(`!document.querySelector('#reminder-sheet').hidden`), 'reminder shortcut dispatch');
    await read('closeSheets()');
    registry.fire('Ctrl+Alt+P');
    await until(() => live.state.settings.pureMode, 'pure mode shortcut on');
    await sleep(420);
    registry.fire('Ctrl+Alt+P');
    await until(() => !live.state.settings.pureMode, 'pure mode shortcut off');
    registry.fire('Ctrl+Alt+S');
    await until(() => screenshot.isActive(), 'screenshot shortcut dispatch');
    await screenshot.cancel();
    await until(() => !screenshot.isActive(), 'screenshot cancellation');
    await sleep(500);
    registry.fire('Ctrl+Alt+R');
    await until(() => recording.isActive() && screenshot.isActive(), 'recording shortcut selection');
    await sleep(500);
    registry.fire('Ctrl+Alt+R');
    await until(() => !recording.isActive() && !screenshot.isActive(), 'recording shortcut stop/cancel');
    await read('openSettings()');
    await read(
      `document.querySelector('#hotkey-screenshot').parentElement.querySelector('button').click();document.querySelector('#settings-form').requestSubmit()`
    );
    await until(() => !live.state.settings.hotkeys.screenshot, 'clear screenshot binding');
    await until(() => read(`document.querySelector('#settings').hidden`), 'clear save did not close settings');
    assert.equal(registry.isRegistered('Ctrl+Alt+S'), false);
    assert.equal(live.shortcutStatus().enabled, false);
    await read('openSettings()');
    await read(
      `document.querySelector('.hotkeys-heading button').click();document.querySelector('#settings-form').requestSubmit()`
    );
    await until(
      () => JSON.stringify(live.state.settings.hotkeys) === JSON.stringify(schema.defaults),
      'restore shortcut defaults'
    );
    await until(() => read(`document.querySelector('#settings').hidden`), 'reset save did not close settings');
    // An unchanged unavailable shortcut must not prevent switching compact mode or saving other settings.
    manager.suspend();
    registry.register(schema.defaults.recording, () => {});
    manager.resume();
    assert.equal(manager.status().bindings.recording.available, false);
    await read(`api('settings',{...settings,pureMode:true}).then(s=>applySettings(s.settings))`);
    assert.equal(live.state.settings.pureMode, true);
    await read(`api('settings',{...settings,pureMode:false}).then(s=>applySettings(s.settings))`);
    registry.unregister(schema.defaults.recording);
    manager.resume();
    win.show();
    win.focus();
    await sleep(100);
    await read('openSettings()');
    await read(`document.querySelector('#hotkey-screenshot').focus()`);
    await sleep(100);
    assert.equal(
      manager.status().suspended,
      true,
      'focus suspension: ' +
        JSON.stringify(
          await read(
            `({hidden:document.querySelector('#settings').hidden,focus:document.activeElement?.id,visibility:document.visibilityState,status:document.querySelector('#settings-status').textContent})`
          )
        )
    );
    win.hide();
    await until(() => !manager.status().suspended, 'hidden window retained keyboard capture');
    live.restore();
    await read(`document.querySelector('#settings-close').click();openSettings()`);
    await read(`document.querySelector('#hotkeys-settings').scrollIntoView({block:'center'})`);
    await sleep(200);
    const capture = path.join(app.getPath('temp'), 'claudex-hotkeys-settings.png');
    fs.writeFileSync(capture, (await win.webContents.capturePage()).toPNG());
    manager.stop();
    assert.equal(registry.isRegistered('Ctrl+Alt+A'), false);
    return {
      hotkeys: true,
      defaults: true,
      nativeKeyCapture: true,
      duplicateRejected: true,
      externalConflictRollback: 'isolated registry',
      settingsRoundTrip: true,
      fiveActionDispatch: 'isolated registry, real app actions',
      windowsRegistration: true,
      clearAndReset: true,
      hideResumes: true,
      unrelatedShortcutConflictDoesNotBlockMode: true,
      cleanup: true,
      capture
    };
  } finally {
    if (nativeKey) globalShortcut.unregister(nativeKey);
    await recording.stop();
    screenshot.cancel();
  }
}
module.exports = { check };
