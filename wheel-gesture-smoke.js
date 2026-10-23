const assert = require('node:assert/strict');
const { screen } = require('electron');
const compact = require('./compact-layout');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function check({ win }) {
  const read = code => win.webContents.executeJavaScript(code);
  const until = async (fn, label) => {
    const end = Date.now() + 5000;
    while (!(await fn())) {
      if (Date.now() > end)
        throw Error(
          label +
            ' ' +
            (await read('JSON.stringify({open:wheel.isOpen,gesture:wheel.isGesturing,ignore,panels:panelsOpen()})'))
        );
      await sleep(30);
    }
  };
  const point = id =>
    read(
      `(()=>{const b=document.querySelector('#${id}').getBoundingClientRect();return {x:Math.round(b.x+b.width/2),y:Math.round(b.y+b.height*.45)};})()`
    );
  const sector = index =>
    read(
      `(()=>{const p=window.lunaWheel.iconPosition(${index},9),b=document.querySelector('#wheel').getBoundingClientRect();return {x:Math.round(b.x+p[0]),y:Math.round(b.y+p[1])};})()`
    );
  const move = p => win.webContents.sendInputEvent({ type: 'mouseMove', modifiers: ['rightButtonDown'], ...p });
  const release = async p => {
    win.webContents.sendInputEvent({ type: 'mouseUp', button: 'right', clickCount: 1, ...p });
    await sleep(260);
  };
  const begin = async (id = 'pet') => {
    win.show();
    win.focus();
    const p = await point(id);
    win.webContents.sendInputEvent({ type: 'mouseMove', ...p });
    await sleep(70);
    win.webContents.sendInputEvent({ type: 'mouseDown', button: 'right', clickCount: 1, ...p });
    await until(() => read('wheel.isOpen&&wheel.isGesturing'), 'right hold did not open wheel');
    return p;
  };
  const cancelKey = () => {
    win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' });
    win.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' });
  };
  const saved = await read('JSON.parse(JSON.stringify(settings))');
  try {
    await read(`closeSheets();document.querySelector('#settings').hidden=true;feedback.show('');void 0`);
    assert.ok(await require('./wheel-smoke').openNatively(win), 'ordinary right click must still work');
    cancelKey();
    await sleep(260);
    await begin();
    const library = await sector(0);
    move(library);
    await until(
      () => read(`document.querySelector('[data-wheel=library]').classList.contains('active')`),
      'drag preview'
    );
    await release(library);
    await until(
      () => read(`!document.querySelector('#library-sheet').hidden&&!wheel.isOpen&&!wheel.isGesturing`),
      'drag release did not select library'
    );
    await read(`closeSheet('library');void 0`);
    await begin();
    const outside = { x: 1, y: 1 };
    move(outside);
    await until(
      () => read(`document.querySelector('.wheel-center-label').textContent==='松开取消'`),
      'outside must preview cancellation'
    );
    assert.equal(await read('ignore'), false, 'drag enabled mouse passthrough');
    await release(outside);
    assert.equal(await read('wheel.isOpen||panelsOpen()'), false);
    await begin();
    move(await sector(0));
    await until(
      () => read(`document.querySelector('#wheel').classList.contains('gesture-dragging')`),
      'center cancellation drag did not move'
    );
    const center = await read(
      `(()=>{const b=document.querySelector('#wheel').getBoundingClientRect();return {x:Math.round(b.x+b.width/2),y:Math.round(b.y+b.height/2)};})()`
    );
    move(center);
    await release(center);
    assert.equal(await read('wheel.isOpen||panelsOpen()'), false, 'center release activated an action');
    const stationary = await begin();
    await sleep(330);
    await release(stationary);
    assert.equal(await read('wheel.isOpen||panelsOpen()'), false, 'stationary hold activated an action');
    await begin();
    const target = await sector(0);
    move(target);
    cancelKey();
    await release(target);
    await sleep(300);
    assert.equal(
      await read('wheel.isOpen||panelsOpen()||wheel.isGesturing'),
      false,
      'Esc reopened the wheel or selected an action'
    );
    await begin();
    move(await sector(0));
    await read(`window.dispatchEvent(new Event('blur'));void 0`);
    await release(await point('pet'));
    assert.equal(await read('wheel.isOpen||panelsOpen()||wheel.isGesturing'), false, 'blur left a pending gesture');
    await read(`api('settings',{...settings,pureMode:true}).then(s=>applySettings(s.settings))`);
    await until(() => win.getBounds().height === 128, 'compact layout');
    const area = screen.getDisplayMatching(win.getBounds()).workArea;
    const bounds = compact.compact({ x: area.x - 9999, y: area.y + area.height + 9999 }, area);
    win.setBounds(bounds);
    await sleep(120);
    const initial = win.getBounds();
    const originalPoint = await begin('pure-flower');
    await release({
      x: initial.x + originalPoint.x - win.getBounds().x,
      y: initial.y + originalPoint.y - win.getBounds().y
    });
    assert.equal(
      await read('wheel.isOpen'),
      true,
      'stationary compact right click was mistaken for dragging during resize'
    );
    cancelKey();
    await until(() => win.getBounds().height === 128, 'compact click cancellation');
    await begin('pure-flower');
    const reminder = await sector(3);
    move(reminder);
    await until(
      () => read(`document.querySelector('[data-wheel=reminder]').classList.contains('active')`),
      'compact drag preview after window moved'
    );
    await release(reminder);
    await until(
      () => read(`!document.querySelector('#reminder-sheet').hidden&&!wheel.isGesturing`),
      'compact drag release'
    );
    await read(`closeSheet('reminder');void 0`);
    await until(() => win.getBounds().height === 128, 'compact return');
    assert.ok(
      Math.abs(win.getBounds().x - bounds.x) <= 1 && Math.abs(win.getBounds().y - bounds.y) <= 1,
      'gesture moved the flower anchor'
    );
    return {
      ordinaryRightClick: true,
      nativeRightDrag: true,
      releaseSelects: true,
      centerCancels: true,
      outsideCancels: true,
      stationaryHoldCancels: true,
      escapeCancels: true,
      blurCancels: true,
      noMousePassthrough: true,
      compactRightClick: true,
      compactCornerGesture: true,
      compactAnchorPreserved: true
    };
  } finally {
    win.webContents.sendInputEvent({ type: 'mouseUp', button: 'right', clickCount: 1, x: 1, y: 1 });
    await read(
      `wheel.close({silent:true});closeSheets();api('settings',${JSON.stringify(saved)}).then(s=>applySettings(s.settings))`
    );
  }
}
module.exports = { check };
