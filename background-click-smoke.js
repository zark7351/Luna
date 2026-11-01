const assert = require('node:assert/strict');
const { BrowserWindow } = require('electron');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function check({ win }) {
  const read = code => win.webContents.executeJavaScript(code);
  const until = async (check, label) => {
    const end = Date.now() + 5000;
    while (!(await check())) {
      if (Date.now() > end)
        throw Error(
          label +
            JSON.stringify({
              visible: win.isVisible(),
              focused: win.isFocused(),
              minimized: win.isMinimized(),
              renderer: await read(
                '({ignore,dragStart,pure:settings.pureMode,savedTop:settings.top,opening:flowerWheelOpening,wheel:wheel.isOpen,focus:document.hasFocus()})'
              )
            })
        );
      await wait(40);
    }
  };
  const original = await read('({...settings})');
  const other = new BrowserWindow({
    width: 260,
    height: 180,
    show: false,
    webPreferences: { sandbox: true, contextIsolation: true }
  });
  try {
    await other.loadURL('data:text/html,<title>Isolated foreground window</title><p>Focus test</p>');
    for (const pure of [false, true]) {
      await read(`closeSheets();document.querySelector('#settings').hidden=true;wheel.close({silent:true});
        saveQuickSetting({pureMode:${pure},top:true});`);
      await wait(300);
      other.show();
      other.focus();
      await until(() => !win.isFocused(), 'Pet still focused before test');
      const point = pure
        ? await read(
            `(()=>{const b=document.querySelector('#pure-flower').getBoundingClientRect();return{x:Math.round(b.x+b.width/2),y:Math.round(b.y+b.height/2)}})()`
          )
        : await require('./body-shortcut-smoke').point(win, 'head');
      win.webContents.sendInputEvent({ type: 'mouseMove', ...point });
      await wait(100);
      assert.equal(win.isFocused(), false, 'Hover stole focus from the foreground window');
      win.webContents.sendInputEvent({ type: 'mouseDown', button: 'left', clickCount: 1, ...point });
      win.webContents.sendInputEvent({ type: 'mouseUp', button: 'left', clickCount: 1, ...point });
      await until(
        () => win.isVisible() && win.isFocused() && !win.isMinimized(),
        'Background click did not restore focus/visibility'
      );
      if (pure) await until(() => read('wheel.isOpen'), 'Flower click failed to open wheel');
      await read('wheel.close({silent:true})');
    }
    await read('saveQuickSetting({pureMode:false,top:false})');
    other.focus();
    await wait(100);
    const point = await require('./body-shortcut-smoke').point(win, 'head');
    win.webContents.sendInputEvent({ type: 'mouseMove', ...point });
    win.webContents.sendInputEvent({ type: 'mouseDown', button: 'left', clickCount: 1, ...point });
    win.webContents.sendInputEvent({ type: 'mouseUp', button: 'left', clickCount: 1, ...point });
    await wait(150);
    assert.equal(win.isAlwaysOnTop(), false, 'Disabled topmost preference was overridden');
    await read(`endDrag();`);
    win.close();
    await wait(100);
    other.focus();
    await wait(100);
    assert.equal(win.isVisible(), false, 'Explicitly hidden pet was restored on blur');
    assert.equal(await read("api('panel-focus').catch(()=>false)"), false);
    assert.equal(win.isVisible(), false, 'A delayed focus request restored a hidden pet');
    return {
      normalFirstClick: true,
      compactFirstClick: true,
      hoverPreservesFocus: true,
      disabledPreferenceRespected: true,
      intentionalHidePreserved: true
    };
  } finally {
    if (!other.isDestroyed()) other.destroy();
    if (!win.isDestroyed() && !win.webContents.isDestroyed()) {
      win.show();
      win.focus();
      await read(
        `endDrag();wheel.close({silent:true});saveQuickSetting(${JSON.stringify({ pureMode: original.pureMode, top: original.top })});`
      );
    }
  }
}
module.exports = { check };
