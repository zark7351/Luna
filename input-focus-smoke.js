const assert = require('node:assert/strict');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const read = (win, code) => win.webContents.executeJavaScript(code);
async function until(test, label) {
  const end = Date.now() + 6000;
  while (!(await test())) {
    if (Date.now() > end) throw Error(label);
    await sleep(30);
  }
}
const documentCode = frame => (frame ? `document.querySelector('#${frame}').contentDocument` : 'document');
async function click(win, selector, frame = '') {
  await read(
    win,
    `${documentCode(frame)}.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center'});void 0`
  );
  await sleep(100);
  const point = await read(
    win,
    `(() => {
    const frame = ${frame ? `document.querySelector('#${frame}')` : 'null'};
    const field = (${documentCode(frame)}).querySelector(${JSON.stringify(selector)});
    const box = field.getBoundingClientRect(), offset = frame?.getBoundingClientRect();
    return {x:Math.round(box.left+(offset?.left||0)+Math.min(15,box.width/2)),
      y:Math.round(box.top+(offset?.top||0)+box.height/2)};
  })()`
  );
  win.webContents.sendInputEvent({ type: 'mouseMove', ...point });
  win.webContents.sendInputEvent({ type: 'mouseDown', ...point, button: 'left', clickCount: 1 });
  win.webContents.sendInputEvent({ type: 'mouseUp', ...point, button: 'left', clickCount: 1 });
  await sleep(130);
}
function key(win, keyCode, modifiers = []) {
  win.webContents.sendInputEvent({ type: 'keyDown', keyCode, modifiers });
  win.webContents.sendInputEvent({ type: 'keyUp', keyCode, modifiers });
}
async function type(win, selector, text, frame = '') {
  await click(win, selector, frame);
  const focused = await read(
    win,
    `(() => {const doc=${documentCode(frame)};
    return doc.hasFocus() && doc.activeElement===doc.querySelector(${JSON.stringify(selector)});})()`
  );
  assert.ok(win.isFocused() && focused, 'keyboard focus missing: ' + selector);
  key(win, 'A', ['control']);
  key(win, 'Backspace');
  for (const char of text) {
    win.webContents.sendInputEvent({ type: 'keyDown', keyCode: char });
    win.webContents.sendInputEvent({ type: 'char', keyCode: char });
    win.webContents.sendInputEvent({ type: 'keyUp', keyCode: char });
  }
  await sleep(60);
  assert.equal(await read(win, `${documentCode(frame)}.querySelector(${JSON.stringify(selector)}).value`), text);
}
async function check(live) {
  const { win, screenshot, collection } = live;
  const original = await read(win, 'JSON.parse(JSON.stringify(settings))');
  const frame = 'library-frame';
  try {
    await read(win, 'closeSheets();document.querySelector("#settings").hidden=true;void 0');
    const before = new Set(collection.list().map(item => item.id));
    assert.equal(await screenshot.start(), true);
    const overlay = screenshot.getWindows()[0];
    await until(() => read(overlay, 'ready'), 'capture not ready');
    overlay.webContents.sendInputEvent({ type: 'mouseDown', x: 40, y: 70, button: 'left', clickCount: 1 });
    overlay.webContents.sendInputEvent({ type: 'mouseMove', x: 180, y: 160 });
    overlay.webContents.sendInputEvent({ type: 'mouseUp', x: 180, y: 160, button: 'left', clickCount: 1 });
    let captured;
    await until(() => (captured = collection.list().find(item => !before.has(item.id))), 'capture not saved');
    await read(win, 'openSheet("library");void 0');
    await until(
      () => read(win, `${documentCode(frame)}.querySelector('[data-id="${captured.id}"] .danger')!==null`),
      'capture card missing'
    );
    const remove = `[data-id="${captured.id}"] .danger`;
    await click(win, remove, frame);
    assert.equal(await read(win, `${documentCode(frame)}.querySelector('#confirm-action').open`), true);
    key(win, 'Escape');
    await until(
      () => read(win, `!${documentCode(frame)}.querySelector('#confirm-action').open`),
      'Escape did not cancel confirmation'
    );
    assert.ok(collection.list().some(item => item.id === captured.id));
    assert.equal(await read(win, 'document.querySelector("#library-sheet").hidden'), false);
    await click(win, remove, frame);
    await read(win, 'openSettings()');
    await until(
      () => read(win, `!${documentCode(frame)}.querySelector('#confirm-action').open`),
      'hidden panel kept confirmation'
    );
    assert.ok(collection.list().some(item => item.id === captured.id));
    await type(win, '#name', 'after cancel');
    await read(win, 'openSheet("library");void 0');
    await type(win, '#search', 'test', frame);
    await type(win, '#search', '', frame);
    await click(win, remove, frame);
    await click(win, '#confirm-action button[value="confirm"]', frame);
    await until(() => !collection.list().some(item => item.id === captured.id), 'confirmed deletion failed');
    await type(win, '#search', 'after delete', frame);
    await click(win, '#new-note', frame);
    await type(win, '#note-text', 'note works', frame);
    await click(win, '#note-cancel', frame);
    await read(win, 'openSettings()');
    win.blur();
    win.showInactive();
    await type(win, '#name', 'Claude test');
    await type(win, '#nickname', 'Hello');
    await type(win, '#weather-query', 'Hangzhou');
    await click(win, '#hotkey-reminder');
    key(win, 'T', ['control', 'alt']);
    await sleep(80);
    assert.equal(await read(win, 'document.querySelector("#hotkey-reminder").value'), 'Ctrl + Alt + T');
    await read(win, 'hotkeysUI.close();document.querySelector("#settings").hidden=true;void 0');
    const reminder = await require('./reminder-input-smoke')(win);
    const appointment = await live.reminders.save({
      mode: 'countdown',
      durationSeconds: 3600,
      title: 'focus deletion'
    });
    live.notifyReminders();
    const reminderFrame = 'reminder-frame',
      reminderRemove = `[data-id="${appointment.id}"] .danger`;
    await until(
      () => read(win, `!!${documentCode(reminderFrame)}.querySelector(${JSON.stringify(reminderRemove)})`),
      'reminder card missing'
    );
    await click(win, reminderRemove, reminderFrame);
    await click(win, '#confirm-action button[value="cancel"]', reminderFrame);
    assert.ok(live.reminders.list().some(item => item.id === appointment.id));
    await click(win, reminderRemove, reminderFrame);
    await click(win, '#confirm-action button[value="confirm"]', reminderFrame);
    await until(() => !live.reminders.list().some(item => item.id === appointment.id), 'reminder deletion failed');
    await type(win, '#title', 'after reminder delete', reminderFrame);
    // A cold window must open and receive keyboard focus after exactly one expand click.
    for (let attempt = 0; attempt < 2; attempt++) {
      if (live.libraryWin && !live.libraryWin.isDestroyed()) live.libraryWin.destroy();
      await read(win, `api('settings',{pureMode:${attempt === 1}})`);
      await read(win, 'openSheet("library");void 0');
      await type(win, '#search', 'keep query', frame);
      await click(win, '#expand-library', frame);
      await until(
        () => live.libraryWin && !live.libraryWin.isDestroyed() && !live.libraryWin.webContents.isLoading(),
        'first expand did not create library'
      );
      const library = live.libraryWin;
      await until(() => library.isVisible() && library.isFocused(), 'first expand did not present library');
      assert.equal(await read(library, 'document.hasFocus()'), true);
      assert.equal(await read(library, 'document.querySelector("#search").value'), 'keep query');
      await type(library, '#search', 'large window');
      await click(library, '#new-note');
      await type(library, '#note-text', 'large note');
      await click(library, '#note-cancel');
      const removable = await collection.addText('large confirmation fixture');
      live.notifyCollection();
      await type(library, '#search', 'large confirmation fixture');
      await until(
        () => read(library, `!!document.querySelector('[data-id="${removable.id}"] .danger')`),
        'large card missing'
      );
      await click(library, `[data-id="${removable.id}"] .danger`);
      await click(library, '#confirm-action button[value="cancel"]');
      assert.ok(collection.list().some(item => item.id === removable.id));
      await click(library, `[data-id="${removable.id}"] .danger`);
      await click(library, '#confirm-action button[value="confirm"]');
      await until(() => !collection.list().some(item => item.id === removable.id), 'large deletion failed');
      await type(library, '#search', 'still editable');
      library.destroy();
      await read(win, 'openSettings()');
      await type(win, '#name', 'mode input');
      await read(win, 'document.querySelector("#settings-close").click();void 0');
    }
    return {
      captureDeleteCancel: true,
      captureDeleteConfirm: true,
      settingsTyping: true,
      searchAndNotes: true,
      hotkeyTyping: true,
      reminder,
      firstExpandVisibleAndFocused: true,
      recreateFirstClick: true,
      largeDeleteAndCancel: true,
      normalAndCompactInput: true,
      reminderDeleteAndCancel: true,
      hiddenConfirmationCancels: true
    };
  } finally {
    screenshot.cancel();
    if (live.libraryWin && !live.libraryWin.isDestroyed()) live.libraryWin.destroy();
    await read(
      win,
      `hotkeysUI.close();closeSheets();document.querySelector('#settings').hidden=true;
      document.querySelector('#library-frame').contentDocument.querySelector('#search').value='';
      document.querySelector('#reminder-frame').contentWindow.reset();
      document.querySelector('#library-frame').contentWindow.refresh();void 0`
    );
    await read(win, `api('settings',${JSON.stringify(original)})`);
  }
}
module.exports = { check };
