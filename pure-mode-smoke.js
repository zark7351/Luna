const fs = require('node:fs'),
  path = require('node:path');
const { WINDOW_WIDTH } = require('./core');
const compact = require('./compact-layout');
const sleep = ms => new Promise(r => setTimeout(r, ms));
module.exports = async ({ win, restore, stateFile, output }) => {
  const read = code => win.webContents.executeJavaScript(code);
  const wait = async (test, label, timeout = 4500) => {
    const end = Date.now() + timeout;
    while (!(await test())) {
      if (Date.now() > end)
        throw Error(
          label +
            ' ' +
            (await read(
              "JSON.stringify({ignore,edgeState,classes:document.querySelector('#companion').className,settingsHidden:document.querySelector('#settings').hidden,bar:document.querySelector('.petbar').getBoundingClientRect().toJSON(),button:document.querySelector('#toolbar-settings').getBoundingClientRect().toJSON()})"
            ))
        );
      await sleep(40);
    }
  };
  const click = async id => {
    const p = await read(
      "(()=>{showControls();const b=document.querySelector('#" +
        id +
        "').getBoundingClientRect();return {x:Math.round(b.x+b.width/2),y:Math.round(b.y+b.height/2)};})()"
    );
    win.webContents.sendInputEvent({ type: 'mouseMove', ...p });
    await sleep(180);
    win.webContents.sendInputEvent({ type: 'mouseDown', button: 'left', clickCount: 1, ...p });
    win.webContents.sendInputEvent({ type: 'mouseUp', button: 'left', clickCount: 1, ...p });
    await sleep(120);
  };
  // Normal mode has no bottom toolbar: right-click Luna and pick a wheel sector with real input.
  // Normal mode has no bottom toolbar: right-click Luna and pick a wheel sector with real input.
  const { openNatively, clickSector } = require('./wheel-smoke');
  const wheelClick = async item => {
    if (!(await openNatively(win)) || !(await clickSector(win, item)))
      throw Error(
        'wheel did not open for ' +
          item +
          ' ' +
          (await read(
            'JSON.stringify({focus:document.hasFocus(),panels:panelsOpen(),inert:document.body.inert,pure:settings.pureMode,ignore})'
          ))
      );
    await sleep(350);
  };
  const flowerPoint = async () => {
    // The page must have caught up with the window size, or the point lands in the old layout.
    await wait(
      async () =>
        (await read('innerHeight')) === win.getBounds().height &&
        (await read("document.querySelector('#pure-flower').getBoundingClientRect().top>0")),
      'flower layout settled'
    );
    return read(
      "(()=>{const b=document.querySelector('#pure-flower').getBoundingClientRect();return {x:Math.round(b.x+b.width/2),y:Math.round(b.y+b.height/2)};})()"
    );
  };
  // Compact mode replaces the flower with a wheel centered on its screen position.
  const flowerWheel = async item => {
    const p = await flowerPoint();
    const origin = win.getBounds();
    const workArea = require('electron').screen.getDisplayMatching(origin).workArea;
    const expected = compact.expand(origin, workArea, true);
    win.webContents.sendInputEvent({ type: 'mouseMove', ...p });
    await sleep(150);
    win.webContents.sendInputEvent({ type: 'mouseDown', button: 'left', clickCount: 1, ...p });
    win.webContents.sendInputEvent({ type: 'mouseUp', button: 'left', clickCount: 1, ...p });
    const opened = Date.now() + 4500;
    while (!((await read('wheel.isOpen')) && win.getBounds().height === 640)) {
      if (Date.now() > opened)
        throw Error(
          'flower wheel open ' +
            JSON.stringify(win.getBounds()) +
            JSON.stringify(p) +
            (await read(
              "JSON.stringify({open:wheel.isOpen,panels:panelsOpen(),inert:document.body.inert,press:flowerPress,dragStart,dragging,flower:document.querySelector('#pure-flower').getBoundingClientRect().toJSON(),h:innerHeight})"
            ))
        );
      await sleep(40);
    }
    await sleep(550);
    const placement = await read(
      "(()=>{const w=document.querySelector('#wheel').getBoundingClientRect(),f=document.querySelector('#pure-flower').getBoundingClientRect();return {w:w.toJSON(),f:f.toJSON(),h:innerHeight};})()"
    );
    const { w, h } = placement;
    const bounds = win.getBounds();
    const flowerHidden = await read("getComputedStyle(document.querySelector('#pure-flower')).visibility==='hidden'");
    if (
      w.top < 0 ||
      w.bottom > h ||
      !flowerHidden ||
      Math.abs(bounds.x + w.x + w.width / 2 - expected.bounds.x - expected.center.x) > 1 ||
      Math.abs(bounds.y + w.y + w.height / 2 - expected.bounds.y - expected.center.y) > 1
    )
      throw Error('flower wheel placement ' + JSON.stringify({ ...placement, bounds: win.getBounds() }));
    if (item === 'settings')
      fs.writeFileSync(path.join(output, 'luna-pure-wheel.png'), (await win.webContents.capturePage()).toPNG());
    if (!item) {
      win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' });
      win.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' });
      await wait(
        () =>
          read("!wheel.isOpen&&getComputedStyle(document.querySelector('#pure-flower')).visibility==='visible'") &&
          win.getBounds().height === 128,
        'dismiss restores flower'
      );
      if (Math.abs(win.getBounds().x - origin.x) > 1 || Math.abs(win.getBounds().y - origin.y) > 1)
        throw Error('dismiss moved flower');
      return;
    }
    if (!(await clickSector(win, item))) throw Error('flower wheel sector ' + item);
    await sleep(350);
  };
  await read(
    "closeSheets();document.querySelector('#settings').hidden=true;if(document.querySelector('#help').open)document.querySelector('#help').close();void 0;"
  );
  const saved = await read('JSON.parse(JSON.stringify(settings))');
  try {
    await wheelClick('hide');
    await wait(() => !win.isVisible() && !win.isDestroyed(), 'normal wheel hide');
    restore();
    await wait(() => win.isVisible(), 'normal toolbar tray restore');
    win.close();
    await sleep(100);
    if (win.isDestroyed() || win.isVisible()) throw Error('native close did not hide to tray');
    restore();
    await wait(() => win.isVisible(), 'tray restore');
    await wheelClick('settings');
    await wait(() => read("!document.querySelector('#settings').hidden"), 'wheel settings');
    await read(
      "document.querySelector('#pure-mode').checked=true;document.querySelector('#settings-form').requestSubmit();void 0;"
    );
    await wait(
      () => read("settings.pureMode&&document.querySelector('#settings').hidden") && win.getBounds().height === 128,
      'pure mode compact'
    );
    if (!JSON.parse(fs.readFileSync(stateFile)).settings.pureMode) throw Error('pure mode not persisted');
    if (
      !(await read(
        "(()=>{hideControls();const f=document.querySelector('#pure-flower').getBoundingClientRect();return getComputedStyle(document.querySelector('.petbar')).display==='none'&&getComputedStyle(document.querySelector('#pet')).display==='none'&&f.width===56&&f.bottom<=innerHeight&&!overControls(1,1)&&overControls(f.left+f.width/2,f.top+f.height/2);})()"
      ))
    )
      throw Error('clean flower layout/input');
    fs.writeFileSync(path.join(output, 'luna-pure-mode-preview.png'), (await win.webContents.capturePage()).toPNG());
    await flowerWheel('hide');
    await wait(() => !win.isVisible() && !win.isDestroyed(), 'pure flower hide');
    restore();
    await wait(() => win.isVisible() && win.getBounds().height === 128, 'pure toolbar tray restore');
    await flowerWheel('library');
    await wait(
      () => read("!document.querySelector('#library-sheet').hidden") && win.getBounds().height === 640,
      'pure library expansion'
    );
    await read("closeSheet('library');void 0");
    await wait(() => win.getBounds().height === 128, 'panel close did not compact');
    const beforeEdges = win.getBounds(),
      area = require('electron').screen.getDisplayMatching(beforeEdges).workArea;
    await flowerWheel(null);
    for (const side of ['left', 'right']) {
      restore();
      await wait(() => win.getBounds().height === 128, 'pure edge restore');
      const edgeX = side === 'left' ? area.x - compact.inset : area.x + area.width - WINDOW_WIDTH + compact.inset;
      win.setBounds({ ...beforeEdges, x: edgeX });
      await wait(() => Math.abs(win.getBounds().x - edgeX) <= 1, 'pure edge position');
      const { ipcMain } = require('electron');
      ipcMain.emit('drag', { sender: win.webContents }, true);
      ipcMain.emit('drag', { sender: win.webContents }, false);
      await wait(
        () => read("edgeState.collapsed&&edgeState.side==='" + side + "'") && win.getBounds().height === 44,
        'pure toolbar collapse'
      );
      await wait(
        () =>
          read(
            "(()=>{const bar=document.querySelector('.petbar').getBoundingClientRect();return Math.abs(bar.width-36)<1&&Math.abs(bar.height-44)<1&&[...document.querySelectorAll('.petbar button')].filter(b=>getComputedStyle(b).display!=='none').every(b=>b.id==='edge-expand');})()"
          ),
        'pure collapsed arrow bounds'
      );
      fs.writeFileSync(
        path.join(output, 'luna-pure-edge-' + side + '.png'),
        (await win.webContents.capturePage()).toPNG()
      );
      await click('edge-expand');
      await wait(() => read('!edgeState.collapsed') && win.getBounds().height === 128, 'pure arrow expansion');
      await read("api('pure-layout',false)");
      const flowerBox = await read("document.querySelector('#pure-flower').getBoundingClientRect().toJSON()");
      if (win.getBounds().x + flowerBox.left < area.x || win.getBounds().x + flowerBox.right > area.x + area.width)
        throw Error('pure flower off screen at edge');
      await flowerWheel('library');
      await wait(
        () => read("!document.querySelector('#library-sheet').hidden") && win.getBounds().height === 640,
        'pure edge library expansion'
      );
      if (win.getBounds().x < area.x - 1 || win.getBounds().x + WINDOW_WIDTH > area.x + area.width + 1)
        throw Error('pure edge panel clipped');
      await read("closeSheet('library');void 0");
      await wait(
        () => win.getBounds().height === 128 && Math.abs(win.getBounds().x - edgeX) <= 1,
        'pure edge anchor restoration'
      );
      await wait(
        () => read('edgeState.collapsed') && win.getBounds().height === 44,
        'pure toolbar automatic recollapse',
        7500
      );
    }
    restore();
    await wait(() => win.getBounds().height === 128, 'pure final expansion');
    // All corners: the flower can touch the actual work-area edge; opening adjusts only the temporary wheel.
    for (const x of [area.x - compact.inset, area.x + area.width - WINDOW_WIDTH + compact.inset]) {
      for (const y of [
        area.y - compact.verticalInsets.top,
        area.y + area.height - 128 + compact.verticalInsets.bottom
      ]) {
        win.setBounds({ ...beforeEdges, x, y });
        await sleep(100);
        await flowerWheel('library');
        await wait(() => read("!document.querySelector('#library-sheet').hidden"), 'corner library');
        await read("closeSheet('library');void 0");
        await wait(() => win.getBounds().height === 128, 'corner panel close');
        if (Math.abs(win.getBounds().x - x) > 1 || Math.abs(win.getBounds().y - y) > 1)
          throw Error('corner anchor drift');
      }
    }
    win.setBounds(beforeEdges);
    await wait(() => Math.abs(win.getBounds().x - beforeEdges.x) <= 1, 'pure original position');
    require('electron').ipcMain.emit('drag', { sender: win.webContents }, true);
    require('electron').ipcMain.emit('drag', { sender: win.webContents }, false);
    await read("api('pure-layout',false)");
    const grip = await flowerPoint();
    win.webContents.sendInputEvent({ type: 'mouseMove', ...grip });
    await sleep(180);
    win.webContents.sendInputEvent({ type: 'mouseDown', button: 'left', clickCount: 1, ...grip });
    await sleep(50);
    win.webContents.sendInputEvent({ type: 'mouseMove', modifiers: ['leftButtonDown'], x: grip.x + 15, y: grip.y });
    await sleep(100);
    if (!(await read('!!dragStart&&dragging')))
      throw Error(
        'flower did not drag ' +
          JSON.stringify(win.getBounds()) +
          JSON.stringify(grip) +
          (await read(
            `JSON.stringify({dragStart,dragging,ignore,h:innerHeight,flower:document.querySelector('#pure-flower').getBoundingClientRect().toJSON(),hit:document.elementFromPoint(${grip.x},${grip.y})?.id,wheel:wheel.isOpen})`
          ))
      );
    win.webContents.sendInputEvent({ type: 'mouseUp', button: 'left', clickCount: 1, x: grip.x + 15, y: grip.y });
    await sleep(100);
    if (!(await read('!dragStart&&!dragging&&!wheel.isOpen')))
      throw Error(
        'flower drag not released or opened the wheel ' + (await read('JSON.stringify({dragStart,dragging,ignore})'))
      );
    await flowerWheel('settings');
    await wait(() => read("!document.querySelector('#settings').hidden"), 'clean settings reopen');
    await read("document.querySelector('#settings-close').click();void 0");
    await wait(() => win.getBounds().height === 128, 'settings close compact');
    await flowerWheel('pure');
    await wait(
      () =>
        read("!settings.pureMode&&getComputedStyle(document.querySelector('#pet')).display!=='none'") &&
        win.getBounds().height === 640,
      'normal mode restore'
    );
    return {
      toolbarHideNormal: true,
      toolbarHidePure: true,
      closeToTray: true,
      restore: true,
      flowerOnly: true,
      flowerWheel: true,
      settingsEntry: true,
      characterHidden: true,
      compactWindow: true,
      persisted: true,
      panelsExpand: true,
      flowerEdges: true,
      edgePanelsFit: true,
      sideHide: true,
      halfFlowerExpandsCompact: true,
      centeredWheel: true,
      hiddenFlower: true,
      fourCorners: true,
      dismissRestoresAnchor: true,
      autoRecollapse: true,
      flowerDrag: true,
      wheelLeavesCleanMode: true,
      normalModeRestore: true
    };
  } finally {
    await read(
      "api('settings'," +
        JSON.stringify(saved) +
        ").then(()=>{closeSheets();document.querySelector('#settings').hidden=true;void 0;})"
    );
  }
};
