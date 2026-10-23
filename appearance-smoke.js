const fs = require('node:fs'),
  assert = require('node:assert/strict');
const size = require('./pet-size');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function check({ win, edgeDock, restore, stateFile }) {
  const read = script => win.webContents.executeJavaScript(script);
  const until = async (fn, label) => {
    const end = Date.now() + 4000;
    while (!(await fn())) {
      if (Date.now() > end) throw Error(label);
      await sleep(40);
    }
  };
  const original = win.getBounds();
  const setScale = value =>
    read(`api('pet-scale',${value}).then(state=>{applySettings(state.settings);return state.settings.petScale;})`);
  const wheel = async (direction, transparent = false) => {
    const p = transparent
      ? await read(
          `(()=>{const b=document.querySelector('#pet').getBoundingClientRect();return {x:Math.round(b.left+1),y:Math.round(b.top+1)};})()`
        )
      : await require('./body-shortcut-smoke').point(win, 'head');
    win.webContents.sendInputEvent({ type: 'mouseMove', ...p });
    win.webContents.sendInputEvent({ type: 'mouseWheel', ...p, deltaY: direction, deltaX: 0, canScroll: true });
    await sleep(160);
    await read('sizeQueue');
  };
  const middle = async (transparent = false) => {
    const p = transparent
      ? await read(
          `(()=>{const b=document.querySelector('#pet').getBoundingClientRect();return {x:Math.round(b.left+1),y:Math.round(b.top+1)};})()`
        )
      : await require('./body-shortcut-smoke').point(win, 'head');
    win.webContents.sendInputEvent({ type: 'mouseMove', ...p });
    win.webContents.sendInputEvent({ type: 'mouseDown', ...p, button: 'middle', clickCount: 1 });
    win.webContents.sendInputEvent({ type: 'mouseUp', ...p, button: 'middle', clickCount: 1 });
    await sleep(160);
    await read('sizeQueue');
  };
  try {
    await read(`closeSheets();document.querySelector('#settings').hidden=true;showMessage('');void 0`);
    await setScale(1);
    assert.match(win.getTitle(), /claude maid/);
    assert.equal(JSON.parse(fs.readFileSync(stateFile)).settings.name, '克劳德');
    await wheel(120, true);
    assert.equal(await read('settings.petScale'), 1, 'transparent pixels must not zoom');
    await wheel(120);
    await until(() => read('settings.petScale===1.1'), 'native wheel up did not enlarge portrait');
    await wheel(-120);
    await until(() => read('settings.petScale===1'), 'native wheel down did not shrink portrait');
    for (const value of [1.5, 0.7]) {
      await setScale(value);
      await middle(true);
      assert.equal(await read('settings.petScale'), value, 'transparent middle click reset size');
      await middle();
      assert.equal(await read('settings.petScale'), 1, 'native middle click did not reset size');
      assert.equal(JSON.parse(fs.readFileSync(stateFile)).settings.petScale, 1, 'reset not persisted');
      assert.equal(await read('!!dragStart || !!dragging'), false, 'middle click started drag');
    }
    await read(`(()=>{window.lunaCharacter.cancel();queueScale(1.4);queueScale(0.8);queueScale(1);})()`);
    await read('sizeQueue');
    assert.equal(await read('settings.petScale'), 1, 'queued zoom overwrote reset');
    assert.equal(await read('window.lunaCharacter.expression'), 'neutral', 'middle click triggered reaction');
    for (const value of [100, -100]) {
      const expected = value > 0 ? size.max : size.min;
      assert.equal(await setScale(value), expected);
      await until(
        () => read(`Math.abs(document.querySelector('#pet').getBoundingClientRect().width-256*${expected})<1`),
        'portrait CSS size'
      );
      await wheel(value > 0 ? 120 : -120);
      assert.equal(await read('settings.petScale'), expected, 'wheel exceeded limit');
      assert.equal(JSON.parse(fs.readFileSync(stateFile)).settings.petScale, expected);
      await read(
        `(()=>{const p=document.querySelector('#pet').getBoundingClientRect();if(p.left<0||p.right>innerWidth+1||p.top<0||p.bottom>innerHeight||Math.abs(p.width/p.height-384/292)>0.003)throw Error('zoom clips or distorts portrait');showMessage('缩放检查',0);const b=document.querySelector('#bubble').getBoundingClientRect();if(b.bottom>p.top+12||b.top<0)throw Error('scaled bubble placement');showMessage('');})()`
      );
    }
    await setScale(size.max);
    const before = win.getBounds();
    const area = require('electron').screen.getDisplayMatching(before).workArea;
    edgeDock.beginDrag();
    win.setBounds({ ...before, x: area.x - 22 });
    await until(() => Math.abs(win.getBounds().x - area.x + 22) <= 1, 'zoom edge move');
    edgeDock.noteMove(win.getBounds());
    edgeDock.finishDrag();
    assert.equal(edgeDock.read().collapsed, true, 'zoomed pet failed to dock');
    edgeDock.expand();
    // Native bounds can round by one DIP on displays with fractional scaling.
    const expandedWidth = win.getBounds().width;
    const expectedWidth = size.windowWidth(size.max);
    assert.ok(
      Math.abs(expandedWidth - expectedWidth) <= 1,
      `edge expansion lost zoom: actual ${expandedWidth}, expected ${expectedWidth}`
    );
    await read(`openSettings()`);
    assert.equal(await read(`getComputedStyle(document.querySelector('#settings')).fontSize`), '13px');
    await read(`document.querySelector('#settings-close').click();void 0`);
    win.close();
    await until(() => !win.isVisible(), 'native close did not hide');
    assert.equal(win.isDestroyed(), false);
    assert.equal((await read(`window.pet.call('state')`)).ok, true, 'background process stopped');
    restore();
    assert.equal(win.isVisible(), true);
    return {
      nativeWheel: true,
      middleReset: true,
      resetPersisted: true,
      queuedReset: true,
      transparentIgnored: true,
      sizeLimits: true,
      scalePersisted: true,
      portraitNotClipped: true,
      bubbleTracksSize: true,
      zoomedEdgeDock: true,
      controlsKeepSize: true,
      closeToBackground: true,
      trayRestore: true
    };
  } finally {
    if (!win.isDestroyed()) {
      restore();
      edgeDock.beginDrag();
      await setScale(1);
      win.setBounds(original);
      edgeDock.noteMove(win.getBounds());
      await read(`closeSheets();document.querySelector('#settings').hidden=true;showMessage('');void 0`);
    }
  }
}
module.exports = { check };
