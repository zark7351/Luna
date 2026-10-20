const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const {
  app,
  BrowserWindow,
  ClipboardItem,
  clipboard,
  desktopCapturer,
  globalShortcut,
  ipcMain,
  nativeImage,
  powerMonitor,
  screen
} = require('electron');
const { WINDOW_WIDTH, WINDOW_HEIGHT } = require('./core');
const { copyFileToClipboard, readClipboardFiles } = require('./file-actions');
const { createSystemStats } = require('./system-stats');

// Desktop integration check for `electron . --smoke-test`; main.js runs it with an isolated temporary user directory.
// `live` exposes main-process objects and helpers; state that changes during the run (window, settings, fake clocks)
// is read and written through its accessors.
module.exports = async function runDesktopSmoke(live) {
  const {
    win,
    edgeDock,
    idle,
    collection,
    reminders,
    recording,
    screenshot,
    reminderAlerts,
    stateFile,
    checkReminders,
    lockReminders,
    unlockReminders,
    mutateCollection,
    notifyCollection,
    notifyReminders,
    presentReminders,
    restore,
    shortcutStatus,
    showReminders
  } = live;
  let smokeStage = 'startup';
  try {
    await new Promise(r => setTimeout(r, 1200));
    if (process.argv.includes('--edge-dock-test')) {
      console.log(
        JSON.stringify(
          await require('./edge-smoke').check({
            win,
            dock: edgeDock,
            screen,
            ipcMain,
            stateFile,
            fireReminder: async () => {
              await reminders.save({ title: '贴边提醒测试', mode: 'countdown', durationSeconds: 1 });
              live.smokeReminderNow += 2000;
              await reminders.check();
            }
          })
        )
      );
      app.exit(0);
      return;
    }
    if (process.argv.includes('--pure-mode-test')) {
      console.log(
        JSON.stringify(await require('./pure-mode-smoke')({ win, restore, stateFile, output: app.getPath('temp') }))
      );
      live.trayMenu.items.at(-1).click();
      return;
    }
    if (process.argv.includes('--anger-sequence-test')) {
      await require('./character-smoke').checkCharacter(win, app.getPath('temp'), 'anger-preview');
      console.log(
        JSON.stringify(
          await require('./anger-smoke')({
            win,
            trayMenu: () => live.trayMenu,
            phase: () => live.angerPhase,
            restore,
            output: app.getPath('temp')
          })
        )
      );
      app.exit(0);
      return;
    }
    win.hide();
    live.trayMenu.getMenuItemById('settings').click();
    await new Promise(r => setTimeout(r, 200));
    if (!win.isVisible() || !(await win.webContents.executeJavaScript(`!document.querySelector('#settings').hidden`)))
      throw Error('tray settings restore');
    const result = await win.webContents.executeJavaScript(
      `(async()=>{const s=await window.pet.call('state');if(!s.ok||'history' in s.value||document.querySelector('#chat-form'))throw Error('chat remains');openSettings();await new Promise(r=>setTimeout(r,200));if(document.querySelector('#settings').hidden)throw Error('settings');document.querySelector('#settings-close').click();document.querySelector('#pet').click();if(!document.querySelector('#pet').classList.contains('happy'))throw Error('expression');return {settings:true,expression:true,bridge:true,noChat:true};})()`
    );
    const migrated = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    if (
      Object.hasOwn(migrated, 'key') ||
      Object.hasOwn(migrated, 'history') ||
      Object.hasOwn(migrated.settings, 'online') ||
      migrated.layoutVersion !== 3
    )
      throw Error('legacy storage migration');
    result.legacyStorage = true;
    smokeStage = 'info-hover';
    // Isolate synthetic hover regression from the OS forwarded cursor stream. Native clicks below remain visible.
    win.hide();
    const today = await win.webContents.executeJavaScript(`(async()=>{
    document.querySelector('.petbar').style.transition='none';
    const wait=async check=>{const end=Date.now()+4000;while(!check()){if(Date.now()>end)throw Error('information UI timeout');await new Promise(r=>setTimeout(r,30));}};
    if(document.querySelector('#today-panel,#info-bar-enabled,#time-clock'))throw Error('permanent information UI remains');
    if(document.querySelectorAll('#body-region-tabs button').length!==Object.keys(window.lunaBodyShortcuts.regions).length||document.querySelectorAll('#body-action-grid button').length!==8)throw Error('body shortcut choices');
    const stats=await window.pet.call('system-stats');if(!stats.ok||JSON.stringify(stats.value)!==JSON.stringify({cpu:25,memory:50,gpu:75}))throw Error('system stats bridge');
    openSettings();await wait(()=>!document.querySelector('#settings').hidden);document.querySelector('#settings-form').requestSubmit();await wait(()=>document.querySelector('#settings').hidden);showMessage('');
    showMessage('短暂消息',60);if(document.querySelector('#bubble').hidden)throw Error('bubble missing');await new Promise(r=>setTimeout(r,100));if(!document.querySelector('#bubble').hidden)throw Error('temporary bubble timeout');
    showControls();document.querySelector('#pet').dispatchEvent(new MouseEvent('mousemove',{bubbles:true}));await new Promise(r=>setTimeout(r,200));
    if(getComputedStyle(document.querySelector('.petbar')).display!=='none')throw Error('normal mode must not show the bottom toolbar');
    hideControls();
    if(!document.querySelector('#recording-button svg[data-icon=record] path')||document.querySelector('#recording-button circle')||document.querySelectorAll('#library-button path').length!==1)throw Error('toolbar camera/folder icons');
    return {noInfoBar:true,bodyShortcutChoices:true,localStats:true,transientBubble:true,normalToolbarRemoved:true,toolbarCameraFolder:true};
  })()`);
    Object.assign(result, today);
    await win.webContents.executeJavaScript(
      `document.querySelector('.petbar').style.removeProperty('transition');void 0;`
    );
    win.show();
    await new Promise(r => setTimeout(r, 250));
    // Real input: right-click Luna for the wheel, then left-click the collection sector through its clip path.
    const wheelInput = require('./wheel-smoke');
    if (!(await wheelInput.openNatively(win))) throw Error('native right click did not open the wheel');
    const sectorPoint = await win.webContents.executeJavaScript(
      `(()=>{const box=document.querySelector('[data-wheel=library] .wheel-icon').getBoundingClientRect();return {x:Math.round(box.left+box.width/2),y:Math.round(box.top+box.height/2)};})()`
    );
    if (!(await wheelInput.clickSector(win, 'library'))) throw Error('wheel closed before choosing a sector');
    await new Promise(r => setTimeout(r, 500));
    if (
      !(await win.webContents.executeJavaScript(
        `!document.querySelector('#library-sheet').hidden && !ignore && !wheel.isOpen`
      ))
    )
      throw Error(
        'wheel input cannot open library: ' +
          (await win.webContents.executeJavaScript(
            `JSON.stringify({hidden:document.querySelector('#library-sheet').hidden,ignore,open:wheel.isOpen,hit:document.elementFromPoint(${sectorPoint.x},${sectorPoint.y})?.outerHTML.slice(0,120)})`
          ))
      );
    await win.webContents.executeJavaScript(`window.lunaPanels.closeSheet('library')`);
    result.wheelInputClick = true;
    await win.webContents.executeJavaScript(`showMessage('');hideControls();void 0;`);
    await new Promise(r => setTimeout(r, 200));
    fs.writeFileSync(
      path.join(app.getPath('temp'), 'luna-quiet-preview.png'),
      (await win.webContents.capturePage()).toPNG()
    );
    await win.webContents.executeJavaScript(
      `document.querySelector('#pet').dispatchEvent(new MouseEvent('mousemove',{bubbles:true}));void 0;`
    );
    await new Promise(r => setTimeout(r, 200));
    fs.writeFileSync(
      path.join(app.getPath('temp'), 'luna-hover-preview.png'),
      (await win.webContents.capturePage()).toPNG()
    );
    await win.webContents.executeJavaScript(`(async()=>{await performBodyShortcut('head');void 0;})()`);
    fs.writeFileSync(
      path.join(app.getPath('temp'), 'luna-info-system-preview.png'),
      (await win.webContents.capturePage()).toPNG()
    );
    await win.webContents.executeJavaScript(`showMessage('');void 0;`);
    if (process.argv.includes('--stats-live-test')) {
      const probe = createSystemStats();
      try {
        const until = Date.now() + 12000;
        let measured = probe.read();
        const cold = measured;
        if (!cold.pending.cpu) throw Error('initial CPU sample not marked pending');
        await win.webContents.executeJavaScript(
          `(async()=>{showMessage(${JSON.stringify(require('./shortcut-bubbles').statsText(cold))},0);await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));void 0;})()`
        );
        fs.writeFileSync(
          path.join(app.getPath('temp'), 'luna-stats-loading-preview.png'),
          (await win.webContents.capturePage()).toPNG()
        );
        while ((measured.cpu === null || measured.gpu === null) && Date.now() < until) {
          await new Promise(r => setTimeout(r, 250));
          measured = probe.read();
        }
        if (
          measured.cpu === null ||
          measured.memory === null ||
          ['cpu', 'memory', 'gpu'].some(
            key =>
              measured[key] !== null && (!Number.isFinite(measured[key]) || measured[key] < 0 || measured[key] > 100)
          )
        )
          throw Error('live Windows system stats');
        result.liveSystemStats = {
          initialLoading: true,
          cpuSampled: true,
          memorySampled: true,
          gpuAvailable: measured.gpu !== null,
          reading: measured
        };
        await win.webContents.executeJavaScript(
          `showMessage(${JSON.stringify(require('./shortcut-bubbles').statsText(measured))},0);void 0;`
        );
        fs.writeFileSync(
          path.join(app.getPath('temp'), 'luna-info-live-preview.png'),
          (await win.webContents.capturePage()).toPNG()
        );
        await win.webContents.executeJavaScript(`showMessage('');void 0;`);
      } finally {
        probe.stop();
        const stopped = probe.read();
        if (['cpu', 'memory', 'gpu'].some(key => stopped[key] !== null) || stopped.pending.cpu || stopped.pending.gpu)
          throw Error('system stats accepted reads after stop');
      }
    }
    await win.webContents.executeJavaScript(`hideControls();void 0;`);

    win.hide();
    live.trayMenu.getMenuItemById('help').click();
    await new Promise(r => setTimeout(r, 100));
    if (!win.isVisible() || !(await win.webContents.executeJavaScript(`document.querySelector('#help').open`)))
      throw Error('tray help restore');
    result.trayPanels = true;
    const controls = await win.webContents.executeJavaScript(`(()=>{
    const buttons=[...document.querySelectorAll('.petbar button:not(#edge-expand)')];
    if(buttons.length!==6||getComputedStyle(document.querySelector('#edge-expand')).display!=='none'||!document.querySelector('#hide svg[data-icon=hide]')||buttons.some(button=>button.textContent.trim()||!button.querySelector('svg')||!button.title||!button.getAttribute('aria-label'))||document.querySelector('.caption')||document.querySelector('#sleep')||document.querySelector('#settings-button')||document.querySelector('#help-button'))throw Error('pet icon toolbar');
    openHelp();const help=document.querySelector('#help'),bounds=help.getBoundingClientRect();
    if(!help.open||!help.contains(document.activeElement)||!help.textContent.includes('本地文件只保存路径')||bounds.top<0||bounds.bottom>document.body.clientHeight)throw Error('help dialog');
    if(getComputedStyle(help,'::backdrop').backgroundColor!=='rgba(0, 0, 0, 0)')throw Error('help backdrop must be transparent');
    return {petIconToolbar:true,helpDialog:true};
  })()`);
    Object.assign(result, controls);
    await new Promise(r => setTimeout(r, 150));
    fs.writeFileSync(
      path.join(app.getPath('temp'), 'luna-help-preview.png'),
      (await win.webContents.capturePage()).toPNG()
    );
    win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' });
    win.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' });
    await new Promise(r => setTimeout(r, 100));
    await win.webContents.executeJavaScript(
      `{if(document.querySelector('#help').open)throw Error('help Escape');openHelp();document.querySelector('#help-close').click();if(document.querySelector('#help').open)throw Error('help close');}`
    );
    smokeStage = 'bubble-and-character';
    result.helpClose = true;
    result.pureMode = await require('./pure-mode-smoke')({ win, restore, stateFile, output: app.getPath('temp') });
    result.bubbleInteraction = await require('./bubble-smoke').checkOrdinary(win);
    result.angerSequence = await require('./anger-smoke')({
      win,
      trayMenu: () => live.trayMenu,
      phase: () => live.angerPhase,
      restore,
      output: app.getPath('temp')
    });
    result.bodyShortcuts = await require('./body-shortcut-smoke').check(
      win,
      app.getPath('temp'),
      stateFile,
      live.systemStats
    );
    await require('./character-smoke').checkCharacter(win, app.getPath('temp'), 'idle');
    result.character = {
      animatedIdle: true,
      transparent: true,
      centredTorso: true,
      reactionPoses: true,
      noWardrobe: true
    };
    await win.webContents.executeJavaScript(
      `(async()=>{if(document.querySelector('#wardrobe,#wardrobe-button')||'hair' in (await window.pet.call('state')).value.settings)throw Error('wardrobe remains');})()`
    );
    const measuredIdle = powerMonitor.getSystemIdleTime();
    if (!Number.isFinite(measuredIdle) || measuredIdle < 0) throw Error('system idle API');
    result.systemIdleAPI = true;
    live.smokeIdleSeconds = 299;
    idle.check();
    if (await win.webContents.executeJavaScript(`document.querySelector('#pet').classList.contains('sleeping')`))
      throw Error('sleep before threshold');
    live.smokeIdleSeconds = 300;
    idle.check();
    await new Promise(r => setTimeout(r, 50));
    if (!(await win.webContents.executeJavaScript(`document.querySelector('#pet').classList.contains('sleeping')`)))
      throw Error('automatic sleep');
    live.smokeIdleSeconds = 0;
    idle.check();
    await new Promise(r => setTimeout(r, 50));
    if (await win.webContents.executeJavaScript(`document.querySelector('#pet').classList.contains('sleeping')`))
      throw Error('automatic wake');
    result.automaticIdleRest = true;
    await win.webContents.executeJavaScript(
      `(async()=>{openSettings();await new Promise(r=>setTimeout(r,100));const panel=document.querySelector('#settings');panel.scrollTop=panel.scrollHeight;await new Promise(r=>setTimeout(r,80));if(document.querySelector('#settings-form .primary').getBoundingClientRect().bottom>document.body.clientHeight)throw Error('settings footer inaccessible');panel.scrollTop=0;const buttons=[...document.querySelectorAll('#settings header button,#settings .settings-actions button,#settings .storage-row button,#settings .weather-search-row button')];if(buttons.some(button=>button.textContent.trim()||!button.querySelector('svg')||!button.title||!button.getAttribute('aria-label'))||document.querySelector('#settings [data-provider]')||document.querySelector('#top').getAttribute('role')!=='switch')throw Error('settings icon actions');})()`
    );
    result.settingsIconActions = true;
    fs.writeFileSync(
      path.join(app.getPath('temp'), 'luna-settings-preview.png'),
      (await win.webContents.capturePage()).toPNG()
    );
    await win.webContents.executeJavaScript(`document.querySelector('#settings-close').click()`);
    // Windows may expand a shown window to its native minimum width at higher DPI.
    if (
      win.getSize()[0] < WINDOW_WIDTH ||
      (await win.webContents.executeJavaScript('document.body.clientWidth')) !== WINDOW_WIDTH
    )
      throw Error('window width: ' + win.getSize()[0]);
    const waitDroppedCount = async count => {
      const until = Date.now() + 4000;
      while (collection.list().length < count) {
        if (Date.now() > until)
          throw Error(
            'drop save did not finish: ' +
              (await win.webContents.executeJavaScript(`document.querySelector('#bubble-message').textContent`))
          );
        await new Promise(r => setTimeout(r, 40));
      }
    };
    await win.webContents.executeJavaScript(
      `(async()=>{const data=new DataTransfer();data.setData('text/plain','https://example.com/for-luna');document.querySelector('#pet').dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:data}));await new Promise(r=>setTimeout(r,300));})()`
    );
    await waitDroppedCount(1);
    if (collection.list().length !== 1 || collection.list()[0].kind !== 'link') throw Error('collection drop');
    result.collectionDrop = true;
    await win.webContents.executeJavaScript(
      `(async()=>{const data=new DataTransfer();data.items.add(new File([new Uint8Array([0,1,2,255])],'临时图片.png',{type:'image/png'}));document.querySelector('#pet').dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:data}));await new Promise(r=>setTimeout(r,300));})()`
    );
    await waitDroppedCount(2);
    if (collection.list().length !== 2 || collection.list()[0].kind !== 'file')
      throw Error(
        'virtual file drop: ' +
          (await win.webContents.executeJavaScript(`document.querySelector('#bubble').textContent`))
      );
    result.virtualFileDrop = true;
    const videoPath = path.join(app.getPath('userData'), '本地视频.mp4');
    fs.writeFileSync(videoPath, Buffer.from([0, 1, 2, 255]));
    await win.webContents.executeJavaScript(
      `{const input=document.createElement('input');input.type='file';input.id='smoke-file';document.body.append(input);}`
    );
    win.webContents.debugger.attach('1.3');
    try {
      const { root } = await win.webContents.debugger.sendCommand('DOM.getDocument');
      const { nodeId } = await win.webContents.debugger.sendCommand('DOM.querySelector', {
        nodeId: root.nodeId,
        selector: '#smoke-file'
      });
      await win.webContents.debugger.sendCommand('DOM.setFileInputFiles', { nodeId, files: [videoPath] });
      await win.webContents.executeJavaScript(
        `(async()=>{const input=document.querySelector('#smoke-file');const data=new DataTransfer();data.items.add(input.files[0]);document.querySelector('#pet').dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:data}));await new Promise(r=>setTimeout(r,300));input.remove();})()`
      );
    } finally {
      if (!win.isDestroyed() && win.webContents.debugger.isAttached()) win.webContents.debugger.detach();
    }
    await waitDroppedCount(3);
    if (collection.list().length !== 3 || collection.list()[0].title !== '本地视频.mp4')
      throw Error(
        'local file drop: ' + (await win.webContents.executeJavaScript(`document.querySelector('#bubble').textContent`))
      );
    if (!fs.readFileSync(collection.openTarget(collection.list()[0].id).target).equals(fs.readFileSync(videoPath)))
      throw Error('local file bytes');
    if (
      collection.openTarget(collection.list()[0].id).target !== videoPath ||
      collection.list()[0].storage !== 'reference'
    )
      throw Error('local file reference');
    result.localFileDrop = true;
    const imageBytes = nativeImage
      .createFromPath(path.join(__dirname, 'assets', 'luna-avatar.png'))
      .resize({ width: 240 })
      .toPNG();
    await collection.addBytes('预览图片.png', new Uint8Array(imageBytes));
    const videoBytes = await win.webContents.executeJavaScript(`(async()=>{
    const canvas=document.createElement('canvas');canvas.width=320;canvas.height=180;const ctx=canvas.getContext('2d');
    const draw=()=>{ctx.fillStyle='#d9c8ee';ctx.fillRect(0,0,320,180);ctx.fillStyle='#6d4c8d';ctx.font='24px sans-serif';ctx.fillText('Luna video preview',40,95);};draw();
    const stream=canvas.captureStream(10);const recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8'});const chunks=[];
    return new Promise((resolve,reject)=>{recorder.ondataavailable=e=>chunks.push(e.data);recorder.onerror=e=>reject(Error('video fixture recording'));recorder.onstop=async()=>{clearInterval(timer);stream.getTracks().forEach(t=>t.stop());resolve(Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer())));};const timer=setInterval(draw,80);recorder.start();setTimeout(()=>recorder.stop(),600);});
  })()`);
    await collection.addBytes('预览视频.webm', new Uint8Array(videoBytes));
    const referenceImage = path.join(app.getPath('userData'), '原图预览.png');
    fs.writeFileSync(referenceImage, imageBytes);
    await collection.addFile(referenceImage);
    const otherFile = path.join(app.getPath('userData'), '笔记.txt');
    fs.writeFileSync(otherFile, 'file fixture');
    await collection.addFile(otherFile);
    const linkItem = collection.list().find(entry => entry.kind === 'link');
    await collection.setLinkPreview(linkItem.id, {
      status: 'ready',
      title: '露娜网页卡片',
      description: '这是本地测试的网页简介。',
      image: 'data:image/jpeg;base64,' + nativeImage.createFromBuffer(imageBytes).toJPEG(80).toString('base64')
    });
    await collection.addText('测试文字收藏');
    const smallWindowCount = BrowserWindow.getAllWindows().length;
    const beforePanelLayout = win.getBounds();
    win.setSize(WINDOW_WIDTH + 40, WINDOW_HEIGHT);
    await win.webContents.executeJavaScript(
      `(async()=>{document.querySelector('#library-button').click();await new Promise(r=>setTimeout(r,260));const sheet=document.querySelector('#library-sheet'),doc=document.querySelector('#library-frame').contentDocument;if(sheet.hidden||!doc.documentElement.classList.contains('embedded')||doc.querySelectorAll('#items .item').length<2)throw Error('embedded library content');if(doc.body.scrollWidth>doc.body.clientWidth||doc.querySelector('#items').getBoundingClientRect().bottom>doc.body.clientHeight)throw Error('embedded library overflow');const cards=[...doc.querySelectorAll('#items .item')].map(card=>card.getBoundingClientRect());if(cards[2]&&cards[2].top<Math.max(cards[0].bottom,cards[1].bottom))throw Error('embedded library overlapping rows');})()`
    );
    await win.webContents.executeJavaScript(
      `(()=>{const body=document.body.getBoundingClientRect(),center=document.querySelector('#companion').getBoundingClientRect();for(const id of ['library-sheet','recording-sheet','reminder-sheet','settings']){const node=document.getElementById(id),hidden=node.hidden;node.hidden=false;const box=node.getBoundingClientRect();node.hidden=hidden;if(Math.abs(box.width-256)>1||Math.abs((box.left+box.right-center.left-center.right)/2)>1||box.right>body.right-11||box.left<body.left+11)throw Error('pet panel exceeds fixed content: '+id+' '+JSON.stringify({left:box.left,right:box.right,width:box.width}));}if(!document.querySelector('#library-frame').contentDocument.querySelector('#paste svg[data-icon=clipboard]'))throw Error('rounded clipboard icon');})()`
    );
    win.setBounds(beforePanelLayout);
    await new Promise(r => setTimeout(r, 200));
    await win.webContents.executeJavaScript(
      `(()=>{ignore=true;window.pet.passthrough(true);document.querySelector('#library-frame').contentDocument.body.dispatchEvent(new MouseEvent('mousemove',{bubbles:true}));if(ignore||!document.querySelector('#companion').classList.contains('controls-visible'))throw Error('embedded panel mouse passthrough');})()`
    );
    if (BrowserWindow.getAllWindows().length !== smallWindowCount || live.libraryWin)
      throw Error('small library opened native window');
    result.videoMenu = await require('./video-menu-smoke').check(win);
    const beforeVideoFullscreen = win.getBounds();
    await win.webContents.executeJavaScript(
      `(async()=>{const doc=document.querySelector('#library-frame').contentDocument;doc.querySelector('#search').value='预览视频';doc.querySelector('#search').dispatchEvent(new Event('input'));const video=doc.querySelector('video');if(!video)throw Error('embedded video');await video.requestFullscreen();})()`,
      true
    );
    await new Promise(r => setTimeout(r, 200));
    const fullscreenBounds = win.getBounds(),
      fullscreenDisplay = screen.getDisplayMatching(fullscreenBounds).bounds;
    if (
      fullscreenBounds.width < fullscreenDisplay.width ||
      fullscreenBounds.height < fullscreenDisplay.height ||
      !(await win.webContents.executeJavaScript(
        `document.querySelector('#library-frame').contentDocument.fullscreenElement?.tagName==='VIDEO'`
      ))
    )
      throw Error('embedded video fullscreen');
    await win.webContents.executeJavaScript(
      `document.querySelector('#library-frame').contentDocument.exitFullscreen()`
    );
    await new Promise(r => setTimeout(r, 200));
    if (['x', 'y', 'width', 'height'].some(key => Math.abs(win.getBounds()[key] - beforeVideoFullscreen[key]) > 1))
      throw Error(
        'embedded fullscreen did not restore pet ' +
          JSON.stringify({ before: beforeVideoFullscreen, after: win.getBounds() })
      );
    await win.webContents.executeJavaScript(
      `(()=>{const doc=document.querySelector('#library-frame').contentDocument;doc.querySelector('#search').value='';doc.querySelector('#search').dispatchEvent(new Event('input'));})()`
    );
    fs.writeFileSync(
      path.join(app.getPath('temp'), 'luna-library-sheet.png'),
      (await win.webContents.capturePage()).toPNG()
    );
    const panelDropCount = collection.list().length;
    await win.webContents.executeJavaScript(
      `(()=>{const frame=document.querySelector('#library-frame').contentWindow,data=new frame.DataTransfer();data.setData('text/uri-list',['# fixture','https://example.com/embedded'].join(String.fromCharCode(13,10)));frame.document.body.dispatchEvent(new frame.DragEvent('drop',{dataTransfer:data,bubbles:true,cancelable:true}));})()`
    );
    const panelDropUntil = Date.now() + 4000;
    while (collection.list().length === panelDropCount) {
      if (Date.now() > panelDropUntil) throw Error('embedded drop timeout');
      await new Promise(r => setTimeout(r, 30));
    }
    const panelDropItem = collection.list()[0];
    if (panelDropItem.kind !== 'link' || panelDropItem.content !== 'https://example.com/embedded')
      throw Error('embedded URI drop');
    await mutateCollection(() => collection.remove(panelDropItem.id));
    notifyCollection();
    await win.webContents.executeJavaScript(
      `document.querySelector('#library-frame').contentDocument.querySelector('#tab-files').click();const doc=document.querySelector('#library-frame').contentDocument;doc.querySelector('#search').value='笔记';doc.querySelector('#search').dispatchEvent(new Event('input'));doc.querySelector('#expand-library').click()`
    );
    const libraryUntil = Date.now() + 4000;
    while (!live.libraryWin || live.libraryWin.isDestroyed() || live.libraryWin.webContents.isLoading()) {
      if (Date.now() > libraryUntil) throw Error('expand library timeout');
      await new Promise(r => setTimeout(r, 50));
    }
    await new Promise(r => setTimeout(r, 200));
    if (!(await win.webContents.executeJavaScript(`document.querySelector('#library-sheet').hidden`)))
      throw Error('expanded library did not close sheet');
    if (
      !(await live.libraryWin.webContents.executeJavaScript(
        `document.querySelector('#tab-all').getAttribute('aria-selected')==='true'&&document.querySelector('#search').value==='笔记'`
      ))
    )
      throw Error('expanded library lost view');
    await live.libraryWin.webContents.executeJavaScript(
      `document.querySelector('#search').value='';document.querySelector('#search').dispatchEvent(new Event('input'));`
    );
    result.librarySheet = {
      embedded: true,
      noExtraWindow: true,
      expand: true,
      clippedScroll: true,
      videoFullscreen: true,
      preserveView: true,
      fixedContentBounds: true,
      roundedIcons: true
    };
    if (
      !live.libraryWin ||
      live.libraryWin.isDestroyed() ||
      !(await live.libraryWin.webContents.executeJavaScript(
        `{document.querySelector('#tab-links').click();document.querySelector('#items').textContent.includes('example.com/for-luna');}`
      ))
    )
      throw Error('library view');
    result.library = true;
    await copyFileToClipboard(videoPath);
    if (JSON.stringify(await readClipboardFiles()) !== JSON.stringify([videoPath]))
      throw Error('native clipboard video file list');
    const filePaste = await live.libraryWin.webContents.executeJavaScript(
      "window.pet.call('collection-add-clipboard')"
    );
    if (
      !filePaste.ok ||
      filePaste.value.saved !== 1 ||
      filePaste.value.items[0].mediaType !== 'video/mp4' ||
      filePaste.value.items[0].storage !== 'reference' ||
      collection.openTarget(filePaste.value.items[0].id).target !== videoPath
    )
      throw Error('clipboard video paste');
    // Pasting the same file again through Ctrl+V refreshes the existing entry instead of duplicating it.
    const beforePaste = collection.list().length,
      pastedId = filePaste.value.items[0].id,
      pastedAt = collection.list().find(item => item.id === pastedId).createdAt;
    await new Promise(r => setTimeout(r, 20));
    await live.libraryWin.webContents.executeJavaScript(
      "document.body.dispatchEvent(new Event('paste',{bubbles:true,cancelable:true}));void 0;"
    );
    const pasteUntil = Date.now() + 18000;
    while (collection.list().find(item => item.id === pastedId).createdAt === pastedAt) {
      if (Date.now() > pasteUntil) throw Error('clipboard shortcut timeout');
      await new Promise(r => setTimeout(r, 50));
    }
    if (collection.list().length !== beforePaste || collection.list()[0].id !== pastedId)
      throw Error('clipboard duplicate was not merged');
    const renderUntil = Date.now() + 3000;
    while (
      !(await live.libraryWin.webContents.executeJavaScript(
        "document.querySelector('#tab-all').getAttribute('aria-selected')==='true' && !document.querySelector('#paste').disabled"
      ))
    ) {
      if (Date.now() > renderUntil) throw Error('clipboard shortcut render timeout');
      await new Promise(r => setTimeout(r, 50));
    }
    await clipboard.write([
      new ClipboardItem({ 'video/webm': new Blob([new Uint8Array(videoBytes)], { type: 'video/webm' }) })
    ]);
    const mediaPaste = await live.libraryWin.webContents.executeJavaScript(
      "window.pet.call('collection-add-clipboard')"
    );
    if (
      !mediaPaste.ok ||
      mediaPaste.value.items[0].mediaType !== 'video/webm' ||
      !fs.readFileSync(collection.openTarget(mediaPaste.value.items[0].id).target).equals(Buffer.from(videoBytes))
    )
      throw Error(
        'clipboard video bytes paste: ' +
          JSON.stringify({ result: mediaPaste, types: (await clipboard.read()).map(item => item.types) })
      );
    await clipboard.write([new ClipboardItem({ 'image/png': new Blob([imageBytes], { type: 'image/png' }) })]);
    const imagePaste = await live.libraryWin.webContents.executeJavaScript(
      "window.pet.call('collection-add-clipboard')"
    );
    if (
      !imagePaste.ok ||
      imagePaste.value.items[0].mediaType !== 'image/png' ||
      imagePaste.value.items[0].storage !== 'copy'
    )
      throw Error('clipboard image paste');
    await clipboard.writeText('剪贴板文字回归');
    const textPaste = await live.libraryWin.webContents.executeJavaScript(
      "window.pet.call('collection-add-clipboard')"
    );
    if (!textPaste.ok || textPaste.value.kind !== 'text') throw Error('clipboard text regression');
    const searchCount = collection.list().length;
    await live.libraryWin.webContents.executeJavaScript(
      "document.querySelector('#search').dispatchEvent(new Event('paste',{bubbles:true,cancelable:true}));void 0;"
    );
    await new Promise(r => setTimeout(r, 100));
    if (collection.list().length !== searchCount) throw Error('search paste should not collect');
    clipboard.clear();
    const emptyPaste = await live.libraryWin.webContents.executeJavaScript(
      "window.pet.call('collection-add-clipboard')"
    );
    if (emptyPaste.ok) throw Error('empty clipboard accepted');
    result.clipboardPaste = {
      nativeVideoFile: true,
      reference: true,
      shortcut: true,
      videoBytes: true,
      image: true,
      text: true,
      searchExcluded: true,
      emptyRejected: true
    };

    const previews = await live.libraryWin.webContents.executeJavaScript(`(async()=>{
    const wait=async test=>{const end=Date.now()+5000;while(!test()){if(Date.now()>end)throw Error('media preview timeout');await new Promise(r=>setTimeout(r,50));}};
    if([...document.querySelectorAll('.header-actions button')].some(button=>button.textContent.trim()||!button.querySelector('svg')||!button.title||!button.getAttribute('aria-label')))throw Error('library icon toolbar');
    if([...document.querySelectorAll('#tabs button')].some(button=>!button.querySelector('svg')||!button.title||!button.getAttribute('aria-label')))throw Error('library icon tabs');
    document.querySelector('#tab-media').click();document.querySelector('#tab-media').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));
    if(document.querySelector('#tab-files').getAttribute('aria-selected')!=='true')throw Error('icon tab keyboard navigation');
    document.querySelector('#tab-links').click();
    if(document.querySelector('.web-title')?.textContent!=='露娜网页卡片' || !document.querySelector('.web-description')?.textContent.includes('网页简介'))throw Error('link card');
    await wait(()=>{const img=document.querySelector('.web-cover img');return img&&img.complete&&img.naturalWidth>0;});
    document.querySelector('#tab-text').click();if(!document.querySelector('#items').textContent.includes('测试文字收藏'))throw Error('text tab');
    document.querySelector('#tab-files').click();await wait(()=>{const icon=document.querySelector('.file-icon');return icon&&icon.complete&&icon.naturalWidth>0;});
    if(!document.querySelector('#items .file-name')?.textContent.includes('笔记.txt'))throw Error('file name missing');
    if(!document.querySelector('#items button[aria-label="打开所在文件夹"]'))throw Error('reveal button');
    if(Array.from(document.querySelectorAll('#items .actions button')).some(b=>b.textContent.trim() || !b.querySelector('svg') || !b.title || !b.getAttribute('aria-label')))throw Error('icon actions');
    document.querySelector('#tab-media').click();
    const search=document.querySelector('#search');search.value='预览图片';search.dispatchEvent(new Event('input'));
    await wait(()=>{const img=document.querySelector('img.media-preview');return img&&img.complete&&img.naturalWidth>0;});
    search.value='原图预览';search.dispatchEvent(new Event('input'));
    await wait(()=>{const img=document.querySelector('img.media-preview');return img&&img.complete&&img.naturalWidth>0;});
    search.value='预览视频';search.dispatchEvent(new Event('input'));
    await wait(()=>{const video=document.querySelector('video.media-preview');return video&&video.readyState>=2&&video.videoWidth===320;});
    const video=document.querySelector('video.media-preview');video.currentTime=Math.min(.3,video.duration/2);await wait(()=>!video.seeking);
    search.value='预览';search.dispatchEvent(new Event('input'));
    const cards=Array.from(document.querySelectorAll('#items .item'));
    if(cards.length!==3 || cards[0].getBoundingClientRect().top!==cards[1].getBoundingClientRect().top)throw Error('grid layout: '+JSON.stringify(cards.map(card=>({top:card.getBoundingClientRect().top,left:card.getBoundingClientRect().left,transform:getComputedStyle(card).transform})))+' count='+cards.length);
    if(document.querySelector('#items').textContent.includes('预览图片.png'))throw Error('media filename visible');
    return {imagePreview:true,videoPreview:true,referencePreview:true,libraryTabs:true,libraryGrid:true,fileIcon:true,fileName:true,linkCard:true,libraryIconTabs:true};
  })()`);
    Object.assign(result, previews);
    smokeStage = 'library-organise';
    result.libraryOrganise = await require('./library-smoke').check({
      win,
      libraryWin: live.libraryWin,
      output: app.getPath('temp')
    });
    smokeStage = 'library-video-fullscreen';
    await live.libraryWin.webContents.executeJavaScript(
      `{document.querySelector('#search').value='预览视频';document.querySelector('#search').dispatchEvent(new Event('input'));}`
    );
    await live.libraryWin.webContents.executeJavaScript(`document.querySelector('video').requestFullscreen()`, true);
    await new Promise(r => setTimeout(r, 300));
    if (
      !live.libraryWin.isFullScreen() ||
      !(await live.libraryWin.webContents.executeJavaScript(
        `document.fullscreenElement===document.querySelector('video')`
      ))
    )
      throw Error('video fullscreen');
    await live.libraryWin.webContents.executeJavaScript(`document.exitFullscreen()`);
    await new Promise(r => setTimeout(r, 300));
    if (
      live.libraryWin.isFullScreen() ||
      (await live.libraryWin.webContents.executeJavaScript(`!!document.fullscreenElement`))
    )
      throw Error('video fullscreen exit');
    result.videoFullscreen = true;
    result.iconActions = true;
    await live.libraryWin.webContents.executeJavaScript(
      `{document.querySelector('#search').value='';document.querySelector('#tab-links').click();}`
    );
    await new Promise(r => setTimeout(r, 200));
    fs.writeFileSync(
      path.join(app.getPath('temp'), 'luna-link-card-preview.png'),
      (await live.libraryWin.webContents.capturePage()).toPNG()
    );
    await live.libraryWin.webContents.executeJavaScript(`document.querySelector('#tab-files').click()`);
    await new Promise(r => setTimeout(r, 200));
    fs.writeFileSync(
      path.join(app.getPath('temp'), 'luna-file-card-preview.png'),
      (await live.libraryWin.webContents.capturePage()).toPNG()
    );
    await live.libraryWin.webContents.executeJavaScript(`document.querySelector('#tab-media').click()`);
    await live.libraryWin.webContents.executeJavaScript(
      `{document.querySelector('#search').value='预览';document.querySelector('#search').dispatchEvent(new Event('input'));}`
    );
    fs.writeFileSync(
      path.join(app.getPath('temp'), 'luna-library-preview.png'),
      (await live.libraryWin.webContents.capturePage()).toPNG()
    );
    smokeStage = 'screenshots';
    const countBeforeCapture = collection.list().length;
    if (!(await screenshot.start()) || (await screenshot.start())) throw Error('screenshot single session');
    let capture = screenshot.getWindows()[0];
    await new Promise(r => setTimeout(r, 150));
    capture.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' });
    if (!capture.isDestroyed()) capture.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' });
    await new Promise(r => setTimeout(r, 100));
    if (
      screenshot.getWindows().length ||
      collection.list().length !== countBeforeCapture ||
      !win.isVisible() ||
      !live.libraryWin.isVisible()
    )
      throw Error('screenshot cancel restore');
    if (!(await screenshot.start())) throw Error('screenshot restart');
    capture = screenshot.getWindows()[0];
    await capture.webContents.executeJavaScript(
      `new Promise((resolve,reject)=>{const until=Date.now()+3000;const timer=setInterval(()=>{if(document.querySelector('#screen').complete&&document.querySelector('#screen').naturalWidth){clearInterval(timer);resolve(true);}else if(Date.now()>until){clearInterval(timer);reject(Error('capture image'));}},30);})`
    );
    capture.webContents.sendInputEvent({ type: 'mouseDown', x: 200, y: 160, button: 'left', clickCount: 1 });
    capture.webContents.sendInputEvent({ type: 'mouseMove', x: 40, y: 60 });
    await new Promise(r => setTimeout(r, 100));
    fs.writeFileSync(
      path.join(app.getPath('temp'), 'luna-screenshot-selection.png'),
      (await capture.webContents.capturePage()).toPNG()
    );
    capture.webContents.sendInputEvent({ type: 'mouseUp', x: 40, y: 60, button: 'left', clickCount: 1 });
    const captureUntil = Date.now() + 4000;
    while (collection.list().length === countBeforeCapture) {
      if (Date.now() > captureUntil) throw Error('screenshot automatic collection');
      await new Promise(r => setTimeout(r, 40));
    }
    const captureItem = collection.list()[0],
      captureImage = nativeImage.createFromPath(collection.openTarget(captureItem.id).target);
    if (
      captureItem.mediaType !== 'image/png' ||
      captureItem.storage !== 'copy' ||
      captureImage.getSize().width !== 320 ||
      captureImage.getSize().height !== 200 ||
      screenshot.getWindows().length
    )
      throw Error(
        'screenshot crop and cleanup: ' +
          JSON.stringify({
            item: captureItem,
            size: captureImage.getSize(),
            windows: screenshot.getWindows().length
          })
      );
    await new Promise(r => setTimeout(r, 200));
    live.libraryWin.show();
    live.libraryWin.focus();
    await live.libraryWin.webContents.executeJavaScript(
      `(async()=>{const end=Date.now()+4000;while(true){const image=document.querySelector('[data-id="${captureItem.id}"] img');if(image){image.loading='eager';image.scrollIntoView();}if(document.querySelector('#tab-all').getAttribute('aria-selected')==='true'&&image?.naturalWidth>0)return true;if(Date.now()>end)throw Error('screenshot library preview: '+JSON.stringify({status:document.querySelector('#status').textContent,tab:document.querySelector('#tab-all').getAttribute('aria-selected'),search:document.querySelector('#search').value,images:[...document.querySelectorAll('#items img')].map(i=>({src:i.src,width:i.naturalWidth,hidden:i.hidden})),ids:[...document.querySelectorAll('#items article')].map(i=>i.dataset.id)}));await new Promise(r=>setTimeout(r,50));}})()`
    );
    result.screenshot = {
      cancel: true,
      reverseSelection: true,
      automaticCollection: true,
      scaledCrop: true,
      mediaPreview: true
    };
    await win.webContents.executeJavaScript(
      `(async()=>{openSettings();await new Promise(r=>setTimeout(r,120));const toggle=document.querySelector('#screenshot-shortcut');if(!toggle.checked)throw Error('shortcut default');toggle.checked=false;document.querySelector('#settings-form').requestSubmit();await new Promise(r=>setTimeout(r,150));const state=await window.pet.call('state');if(state.value.settings.screenshotShortcut!==false||!document.querySelector('#screenshot-button').title.includes('已关闭'))throw Error('shortcut disable UI');})()`
    );
    if (
      JSON.parse(fs.readFileSync(stateFile, 'utf8')).settings.screenshotShortcut !== false ||
      shortcutStatus().enabled ||
      live.captureShortcut ||
      globalShortcut.isRegistered('CommandOrControl+Alt+A')
    )
      throw Error('shortcut disable persist');
    if (
      !(await live.libraryWin.webContents.executeJavaScript(
        `document.querySelector('#screenshot-button').title.includes('已关闭')`
      ))
    )
      throw Error('library shortcut status');
    await win.webContents.executeJavaScript(
      `(async()=>{openSettings();await new Promise(r=>setTimeout(r,120));if(document.querySelector('#screenshot-shortcut').checked)throw Error('shortcut reopened preference');document.querySelector('#screenshot-shortcut').checked=true;document.querySelector('#settings-form').requestSubmit();await new Promise(r=>setTimeout(r,150));})()`
    );
    if (!shortcutStatus().enabled || !JSON.parse(fs.readFileSync(stateFile, 'utf8')).settings.screenshotShortcut)
      throw Error('shortcut reenable');
    result.screenshotShortcutSettings = true;
    smokeStage = 'recording';
    const waitRecording = async phase => {
      const until = Date.now() + 18000;
      while (true) {
        const current = recording.getWindow();
        if (!current || current.isDestroyed()) throw Error('recording window destroyed');
        const status = await current.webContents.executeJavaScript(
          `document.querySelector('#recording-frame').contentDocument.body.classList.contains('recording')`
        );
        if (phase === 'recording' && status) return;
        if (!recording.isActive())
          throw Error(
            'recording failed: ' +
              (await current.webContents.executeJavaScript(
                `document.querySelector('#recording-frame').contentDocument.querySelector('#status').textContent`
              ))
          );
        if (Date.now() > until) throw Error('recording start timeout');
        await new Promise(r => setTimeout(r, 50));
      }
    };
    await win.webContents.executeJavaScript(
      `(async()=>{document.querySelector('#recording-button').click();await new Promise(r=>setTimeout(r,150));})()`
    );
    if (
      recording.getWindow() !== win ||
      !(await win.webContents.executeJavaScript(
        `!document.querySelector('#recording-sheet').hidden && document.querySelector('#library-sheet').hidden`
      ))
    )
      throw Error('recording not embedded');
    fs.writeFileSync(
      path.join(app.getPath('temp'), 'luna-recording-sheet.png'),
      (await win.webContents.capturePage()).toPNG()
    );
    await recording.show();
    const recordingFormats = ['mp4'];
    if (
      !(await recording
        .getWindow()
        .webContents.executeJavaScript(
          `document.querySelector('#recording-frame').contentWindow.recordingOptions.formats.mp4.some(type=>MediaRecorder.isTypeSupported(type)) && !document.querySelector('#recording-frame').contentDocument.querySelector('#format') && !document.querySelector('#recording-frame').contentDocument.querySelector('#fps')`
        ))
    )
      throw Error('MP4 encoder unavailable');
    const customDirectory = path.join(app.getPath('userData'), 'custom-captures');
    await win.webContents.executeJavaScript(
      `(async()=>window.pet.call('settings',{...(await window.pet.call('state')).value.settings,saveDirectory:${JSON.stringify(customDirectory)},recordFrameRate:60}))()`
    );
    if (live.state.settings.recordFrameRate !== 60) throw Error('recording FPS settings');
    if (live.state.settings.saveDirectory !== customDirectory) throw Error('custom storage settings');
    result.adjustableRecording = await require('./recording-frame-smoke').check({
      recording,
      display: screen.getPrimaryDisplay(),
      temp: app.getPath('temp'),
      collection
    });
    for (const format of recordingFormats) {
      await recording.select(
        { format, fps: 30 },
        {
          rect: { x: 40, y: 30, width: 160, height: 100 },
          bounds: { x: 0, y: 0, width: 320, height: 180 },
          sourceId: 'test'
        }
      );
      await waitRecording('recording');
      if (
        recording.getBorders().length !== 1 ||
        recording.getBorders().some(border => border.isDestroyed() || !border.isVisible())
      )
        throw Error('recording border visibility');
      // Chromium rounds border widths to physical pixels at fractional display scales.
      const border = recording.getBorders()[0];
      const outline = await border.webContents.executeJavaScript(
        `(()=>{const css=getComputedStyle(document.querySelector('#outline')),body=getComputedStyle(document.body);return {edges:[css.borderTopWidth,css.borderRightWidth,css.borderBottomWidth,css.borderLeftWidth],center:body.backgroundColor,scale:devicePixelRatio};})()`
      );
      if (
        outline.center !== 'rgba(0, 0, 0, 0)' ||
        outline.edges.some(width => Math.abs(parseFloat(width) - 3) > 1 / outline.scale + 0.0001)
      )
        throw Error('recording border not thick and transparent: ' + JSON.stringify(outline));
      fs.writeFileSync(
        path.join(app.getPath('temp'), 'luna-recording-border.png'),
        (await border.webContents.capturePage()).toPNG()
      );
      await new Promise(r => setTimeout(r, 1300));
      const spoof = await win.webContents.executeJavaScript(
        `(()=>{try{window.pet.call('recording-chunk',new ArrayBuffer(1));return false;}catch{return true;}})()`
      );
      if (!spoof) throw Error('recording bridge unrestricted');
      await win.webContents.executeJavaScript(
        `document.querySelector('#recording-frame').contentDocument.querySelector('#close-recording').click();void 0;`
      );
      const saveUntil = Date.now() + 10000;
      while (
        recording.isActive() ||
        !(await win.webContents.executeJavaScript(`document.querySelector('#recording-sheet').hidden`))
      ) {
        if (Date.now() > saveUntil) throw Error('close recording panel did not save');
        await new Promise(r => setTimeout(r, 50));
      }
      if (win.isDestroyed() || !win.isVisible()) throw Error('closing recorder destroyed pet');
      if (recording.getBorders().length) throw Error('recording border cleanup');
      const item = collection.list()[0];
      if (fs.readFileSync(collection.openTarget(item.id).target).toString('ascii', 4, 8) !== 'ftyp')
        throw Error('MP4 container header');
      if (
        item.mediaType !== 'video/' + format ||
        path.dirname(collection.openTarget(item.id).target) !== customDirectory
      )
        throw Error('recording file location/format');
      const metadata = await live.libraryWin.webContents.executeJavaScript(
        `(async()=>{const video=document.createElement('video');video.muted=true;video.src='${item.previewUrl}';return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('recording video decode')),6000);video.onerror=()=>reject(Error('recording decode error'));video.onloadeddata=()=>{clearTimeout(timer);resolve({width:video.videoWidth,height:video.videoHeight});video.removeAttribute('src');video.load();};video.load();});})()`
      );
      if (metadata.width !== 160 || metadata.height !== 100) throw Error('recording crop');
    }
    await recording.show();
    if (process.argv.includes('--recording-live-test')) {
      const display = screen.getPrimaryDisplay(),
        source = (await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 0, height: 0 } })).find(
          item => item.display_id === String(display.id)
        );
      const fixture = new BrowserWindow({
        x: display.workArea.x + 20,
        y: display.workArea.y + 20,
        width: 320,
        height: 180,
        frame: false,
        alwaysOnTop: true,
        webPreferences: {
          sandbox: true,
          contextIsolation: true,
          nodeIntegration: false,
          backgroundThrottling: false
        }
      });
      try {
        await fixture.loadURL(
          'data:text/html,' +
            encodeURIComponent(
              '<body style="margin:0;background:rgb(180,110,210)"><h1>Luna recording test</h1><div style="position:absolute;left:0;top:80px;width:320px;height:40px;background:repeating-linear-gradient(90deg,#000 0px 2px,#fff 2px 4px)"></div></body>'
            )
        );
        await new Promise(r => setTimeout(r, 250));
        result.liveSelection = await require('./live-selection-smoke').check({ screenshot, display });
        await recording.select(
          { format: 'mp4', fps: 60 },
          {
            rect: {
              x: display.workArea.x + 20 - display.bounds.x,
              y: display.workArea.y + 20 - display.bounds.y,
              width: 320,
              height: 180
            },
            bounds: display.bounds,
            sourceId: source.id,
            test: false,
            adjust: true
          }
        );
        const readyBorder = recording.getBorders()[0];
        if (
          !(await readyBorder.webContents.executeJavaScript(
            "recordingFrame.call('recording-state').then(result=>result.value.phase==='adjusting')"
          ))
        )
          throw Error('live recording must wait for start');
        await readyBorder.webContents.executeJavaScript("document.querySelector('#start').click();void 0");
        await waitRecording('recording');
        const encoding = await win.webContents.executeJavaScript(
          "document.querySelector('#recording-frame').contentWindow.recorder.call('recording-state').then(result=>result.value)"
        );
        if (!encoding.nativeAvailable || encoding.backend !== 'native') throw Error('native recording backend missing');
        await new Promise(r => setTimeout(r, 1500));
        if (
          (
            await readyBorder.webContents.executeJavaScript(
              "recordingFrame.call('recording-adjust',{x:0,y:0,width:100,height:100})"
            )
          ).ok
        )
          throw Error('recording region changed while encoding');
        await readyBorder.webContents.executeJavaScript("document.querySelector('#stop').click();void 0");
        await recording.stop();
        const item = collection.list()[0];
        if (!item.title.startsWith('录屏-') || item.size < 100) throw Error('live screen recording save');
        const captured = await fixture.webContents.executeJavaScript(
          `(async()=>{try{const video=document.createElement('video');video.muted=true;const url=URL.createObjectURL(new Blob([new Uint8Array(${JSON.stringify([...fs.readFileSync(collection.openTarget(item.id).target)])})],{type:'video/mp4'}));video.src=url;await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('live decode timeout')),6000);video.onloadeddata=()=>{clearTimeout(timer);resolve();};video.onerror=()=>reject(Error('live decode failed'));});video.style.position='fixed';video.style.left='-10000px';document.body.append(video);await video.play();await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('live frame timeout')),5000);video.requestVideoFrameCallback(()=>{clearTimeout(timer);resolve();});});const canvas=document.createElement('canvas');canvas.width=video.videoWidth;canvas.height=video.videoHeight;const ctx=canvas.getContext('2d');ctx.drawImage(video,0,0);const pixel=Array.from(ctx.getImageData(canvas.width/2,canvas.height*.8,1,1).data);const scale=canvas.width/320;let contrast=0;for(let i=0;i<32;i++){const dark=ctx.getImageData(Math.round((8+i*4+.5)*scale),Math.round(100*scale),1,1).data[0],light=ctx.getImageData(Math.round((8+i*4+2.5)*scale),Math.round(100*scale),1,1).data[0];contrast+=light-dark;}contrast/=32;video.pause();video.removeAttribute('src');video.load();video.remove();URL.revokeObjectURL(url);const controlPixel=Array.from(ctx.getImageData(Math.round(290*scale),Math.round(16*scale),1,1).data);return {pixel,controlPixel,width:canvas.width,height:canvas.height,contrast};}catch(error){throw Error('live playback '+error.name+': '+error.message);}})()`
        );
        const pixel = captured.pixel;
        const controlPixel = captured.controlPixel;
        if (
          Math.abs(controlPixel[0] - 180) > 25 ||
          Math.abs(controlPixel[1] - 110) > 25 ||
          Math.abs(controlPixel[2] - 210) > 25
        )
          throw Error('frame toolbar recorded ' + controlPixel);
        if (
          captured.width !== Math.floor((320 * display.scaleFactor) / 2) * 2 ||
          captured.height !== Math.floor((180 * display.scaleFactor) / 2) * 2 ||
          captured.contrast < 150
        )
          throw Error('live recording detail loss ' + JSON.stringify(captured));
        if (Math.abs(pixel[0] - 180) > 25 || Math.abs(pixel[1] - 110) > 25 || Math.abs(pixel[2] - 210) > 25)
          throw Error('transparent overlay blocked capture: ' + pixel);
        result.liveScreenRecording = {
          backend: encoding.backend,
          encoder: encoding.encoder,
          fps: encoding.fps,
          desktopSource: true,
          transparentOverlay: true,
          decodedPixel: pixel,
          quality: captured
        };
      } finally {
        fixture.destroy();
      }
    }
    await win.webContents.executeJavaScript(
      `(async()=>window.pet.call('settings',{...(await window.pet.call('state')).value.settings,saveDirectory:''}))()`
    );
    if (collection.openTarget(captureItem.id).target.startsWith(customDirectory)) throw Error('old capture moved');
    if (!fs.existsSync(collection.openTarget(collection.list()[0].id).target)) throw Error('custom file lost on reset');
    await win.webContents.executeJavaScript(`window.lunaPanels.closeSheet('recording')`);
    result.recording = {
      formats: recordingFormats,
      frameRates: true,
      persistentBorder: true,
      compactControls: true,
      crop: true,
      encodedPlayback: true,
      autoCollection: true,
      customDirectory: true,
      preservedExistingFiles: true,
      embeddedPanel: true,
      closedThickBorder: true
    };
    await win.webContents.executeJavaScript(
      `sounds.reminder.volume=0;window.smokeSoundCount=0;window.pet.onSound(name=>{if(name==='reminder')window.smokeSoundCount++;});void 0;`
    );
    smokeStage = 'reminders';
    const reminderWindowCount = BrowserWindow.getAllWindows().length;
    await showReminders();
    await new Promise(r => setTimeout(r, 200));
    result.reminderInput = await require('./reminder-input-smoke')(win);
    const reminderFrame = () => {
      const frame = win.webContents.mainFrame.frames.find(
        frame => frame.url === pathToFileURL(path.join(__dirname, 'reminder.html')).href
      );
      return (
        frame && {
          executeJavaScript: async source => {
            try {
              return await frame.executeJavaScript(source);
            } catch (error) {
              console.error('REMINDER_SMOKE_SOURCE', source);
              throw error;
            }
          }
        }
      );
    };
    if (!reminderFrame() || BrowserWindow.getAllWindows().length !== reminderWindowCount)
      throw Error('reminder opened native window');
    if (
      !(await win.webContents.executeJavaScript(
        `!document.querySelector('#reminder-sheet').hidden && document.querySelector('#library-sheet').hidden && document.querySelector('#recording-sheet').hidden`
      ))
    )
      throw Error('reminder sheet mutual exclusion');
    await win.webContents.executeJavaScript(
      `(()=>{const pane=document.querySelector('#reminder-sheet'),box=pane.getBoundingClientRect();if(Math.abs(box.bottom-(document.body.clientHeight-60))>1||getComputedStyle(pane).animationName!=='sheet-in')throw Error('reminder bottom sheet layout');})()`
    );
    await reminderFrame().executeJavaScript(
      `(()=>{const doc=document.documentElement;if(doc.scrollWidth>doc.clientWidth||doc.scrollHeight>doc.clientHeight)throw Error('reminder compact overflow');document.querySelector('#title').value='未保存草稿';document.querySelector('#close-reminder').click();})()`
    );
    if (!(await win.webContents.executeJavaScript(`document.querySelector('#reminder-sheet').hidden`)))
      throw Error('reminder close button');
    await showReminders();
    await new Promise(r => setTimeout(r, 250));
    await reminderFrame().executeJavaScript(
      `(()=>{if(document.querySelector('#title').value!=='未保存草稿')throw Error('reminder close lost draft');const clock=document.querySelector('#mode-scheduled');clock.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));if(document.querySelector('#countdown-fields').hidden||document.activeElement.id!=='mode-countdown')throw Error('reminder keyboard mode');document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true}));})()`
    );
    await reminderFrame().executeJavaScript(
      `(async()=>{document.querySelector('#title').value='喝水，放松一下';document.querySelector('#time').value=new Date(Date.now()+600000-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16);document.querySelector('#form').requestSubmit();const until=Date.now()+2000;while(!document.querySelector('.item')?.textContent.includes('喝水')&&Date.now()<until)await new Promise(r=>setTimeout(r,30));if(!document.querySelector('.item')?.textContent.includes('喝水'))throw Error('reminder form');})()`
    );
    const reminderItem = reminders.list()[0];
    if (!reminderItem || reminderItem.status !== 'pending') throw Error('reminder saved');
    await win.webContents.executeJavaScript(`window.lunaPanels.closeSheet('reminder')`);
    lockReminders();
    live.smokeReminderNow = reminderItem.dueAt + 1;
    checkReminders();
    await new Promise(r => setTimeout(r, 30));
    if (
      reminders.list()[0].status !== 'pending' ||
      !(await win.webContents.executeJavaScript(`document.querySelector('#reminder-sheet').hidden`))
    )
      throw Error('reminder lock deferral');
    unlockReminders();
    await reminders.settled();
    const reminderUntil = Date.now() + 4000;
    while (!(await win.webContents.executeJavaScript(`feedback.getReminder()?.id==='${reminderItem.id}'`))) {
      if (Date.now() > reminderUntil) throw Error('reminder alert bubble');
      await new Promise(r => setTimeout(r, 40));
    }
    await new Promise(r => setTimeout(r, 150));
    if (
      !win.isVisible() ||
      !(await win.webContents.executeJavaScript(`document.querySelector('#reminder-sheet').hidden`))
    )
      throw Error('reminder auto opened panel');
    await require('./bubble-smoke').checkReminderLayout(win);
    fs.writeFileSync(
      path.join(app.getPath('temp'), 'luna-reminder-inline-action.png'),
      (await win.webContents.capturePage()).toPNG()
    );
    await require('./bubble-smoke').click(win, 'bubble-body');
    if (
      !(await win.webContents.executeJavaScript(
        `!document.querySelector('#reminder-sheet').hidden && feedback.getReminder()?.id==='${reminderItem.id}'`
      ))
    )
      throw Error('reminder body click did not open panel');
    if (
      reminders.list().find(item => item.id === reminderItem.id).status !== 'fired' ||
      !(await reminderFrame().executeJavaScript(`!!document.querySelector('.item.fired')`))
    )
      throw Error('reminder body click completed instead of opening');
    if (
      !(await win.webContents.executeJavaScript(
        `window.smokeSoundCount===1 && !sounds.reminder.paused && sounds.reminder.readyState>=2`
      ))
    )
      throw Error('reminder sound playback');
    presentReminders();
    await new Promise(r => setTimeout(r, 40));
    if (
      !(await win.webContents.executeJavaScript(
        `window.smokeSoundCount===1 && !document.querySelector('#bubble').hidden && feedback.getReminder()?.id==='${reminderItem.id}'`
      ))
    )
      throw Error('persistent reminder bubble');
    await win.webContents.executeJavaScript(`showMessage('普通消息不应覆盖提醒',10);void 0;`);
    await new Promise(r => setTimeout(r, 40));
    if (!(await win.webContents.executeJavaScript(`document.querySelector('#bubble').textContent.includes('喝水')`)))
      throw Error('ordinary message overrides reminder');
    fs.writeFileSync(
      path.join(app.getPath('temp'), 'luna-reminder-bubble.png'),
      (await win.webContents.capturePage()).toPNG()
    );
    live.smokeReminderNow += 15000;
    reminderAlerts.tick();
    await new Promise(r => setTimeout(r, 50));
    if (!(await win.webContents.executeJavaScript(`window.smokeSoundCount===2`)))
      throw Error('reminder interval sound');
    await win.webContents.executeJavaScript(
      `(async()=>{openSettings();await new Promise(r=>setTimeout(r,100));const toggle=document.querySelector('#sound-enabled');if(!toggle.checked)throw Error('sound default');toggle.checked=false;document.querySelector('#settings-form').requestSubmit();await new Promise(r=>setTimeout(r,150));})()`
    );
    if (
      live.state.settings.soundEnabled ||
      !win.webContents.isAudioMuted() ||
      !live.libraryWin.webContents.isAudioMuted() ||
      JSON.parse(fs.readFileSync(stateFile, 'utf8')).settings.soundEnabled !== false
    )
      throw Error('global sound mute persisted');
    if (
      await win.webContents.executeJavaScript(
        `(async()=>{const before=window.smokeUiSounds.length;const r=await window.pet.call('ui-sound','click');await new Promise(r=>setTimeout(r,50));return r.value!==false||window.smokeUiSounds.length!==before;})()`
      )
    )
      throw Error('muted UI feedback sent');
    await showReminders();
    await new Promise(r => setTimeout(r, 250));
    fs.writeFileSync(
      path.join(app.getPath('temp'), 'luna-reminder-preview.png'),
      (await win.webContents.capturePage()).toPNG()
    );
    await reminderFrame().executeJavaScript(
      `(async()=>{document.querySelector('button[aria-label="稍后 5 分钟"]').click();await new Promise(r=>setTimeout(r,150));if(document.querySelector('.item.fired'))throw Error('reminder snooze UI');})()`
    );
    if (reminders.list()[0].dueAt !== live.smokeReminderNow + 300000 || reminders.list()[0].status !== 'pending')
      throw Error('reminder snooze');
    await reminderFrame().executeJavaScript(
      `(async()=>{document.querySelector('button[aria-label="完成"]').click();document.querySelector('#done').click();const until=Date.now()+4000;while(!document.querySelector('.item.done')){if(Date.now()>until)throw Error('reminder complete UI: '+document.querySelector('#status').textContent);await new Promise(r=>setTimeout(r,40));}})()`
    );
    if (
      reminders.list()[0].status !== 'done' ||
      JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'reminders.json'), 'utf8'))[0].status !== 'done'
    )
      throw Error('reminder persistence');
    await reminderFrame().executeJavaScript(
      `(async()=>{document.querySelector('#mode-countdown').click();document.querySelector('[data-minutes="60"]').click();if(!document.querySelector('#time').disabled||document.querySelector('#hours').value!=='1'||document.querySelector('#minutes').value!=='0')throw Error('countdown mode preset');document.querySelector('#hours').value='0';document.querySelector('#minutes').value='0';document.querySelector('#seconds').value='10';document.querySelector('#title').value='倒计时测试';document.querySelector('#form').requestSubmit();await new Promise(r=>setTimeout(r,150));if(!document.querySelector('.item.countdown time')?.textContent.includes('剩余'))throw Error('countdown display');})()`
    );
    const countdownItem = reminders.list().find(item => item.title === '倒计时测试');
    if (!(await win.webContents.executeJavaScript(`window.smokeUiEffects.at(-1)==='reminder-save'`)))
      throw Error('muted reminder lost visual feedback');
    if (countdownItem?.mode !== 'countdown' || countdownItem.dueAt !== live.smokeReminderNow + 10000)
      throw Error('countdown deadline');
    fs.writeFileSync(
      path.join(app.getPath('temp'), 'luna-countdown-preview.png'),
      (await win.webContents.capturePage()).toPNG()
    );
    live.smokeReminderNow = countdownItem.dueAt;
    await reminders.check();
    await new Promise(r => setTimeout(r, 150));
    if (
      !(await reminderFrame().executeJavaScript(
        `document.querySelector('.item.countdown.fired')?.textContent.includes('到时间啦')`
      ))
    )
      throw Error('countdown due popup');
    if (!(await win.webContents.executeJavaScript(`window.smokeSoundCount===2`))) throw Error('muted reminder played');
    await win.webContents.executeJavaScript(
      `(async()=>{openSettings();await new Promise(r=>setTimeout(r,100));document.querySelector('#sound-enabled').checked=true;document.querySelector('#settings-form').requestSubmit();await new Promise(r=>setTimeout(r,150));})()`
    );
    if (!live.state.settings.soundEnabled || win.webContents.isAudioMuted()) throw Error('sound reenable');
    await win.webContents.executeJavaScript(
      `(async()=>{await Promise.all(Object.values(sounds).map(sound=>new Promise((resolve,reject)=>{if(sound.readyState>=2)return resolve();const timer=setTimeout(()=>reject(Error('UI sound decode: '+sound.src)),4000);sound.addEventListener('loadeddata',()=>{clearTimeout(timer);resolve();},{once:true});sound.load();})));for(const name of ['tab','select','open','save','collect','capture-start','capture-done','capture-cancel'])if(!window.smokeUiSounds.includes(name))throw Error('Missing UI feedback: '+name);const unknown=await window.pet.call('ui-sound','unknown');if(unknown.value!==false)throw Error('Unknown sound accepted');})()`
    );
    reminderAlerts.tick();
    await new Promise(r => setTimeout(r, 50));
    if (!(await win.webContents.executeJavaScript(`window.smokeSoundCount===3`)))
      throw Error('unmuted reminder resume');
    await win.webContents.executeJavaScript(`closeSheets();void 0;`);
    await require('./bubble-smoke').click(win, 'bubble-complete');
    const completeUntil = Date.now() + 4000;
    while (reminders.list().find(item => item.id === countdownItem.id).status !== 'done') {
      if (Date.now() > completeUntil) throw Error('bubble reminder complete');
      await new Promise(r => setTimeout(r, 40));
    }
    live.smokeReminderNow += 15000;
    reminderAlerts.tick();
    await new Promise(r => setTimeout(r, 50));
    if (
      !(await win.webContents.executeJavaScript(
        `window.smokeSoundCount===3 && !feedback.getReminder() && sounds.reminder.paused`
      ))
    )
      throw Error('completed reminder continued');
    if (!(await win.webContents.executeJavaScript(`document.querySelector('#reminder-sheet').hidden`)))
      throw Error('complete opened reminder panel');
    result.sound = {
      uiVariants: 17,
      uiEvents: true,
      decodedPlayback: true,
      repeatedReminder: true,
      globalMute: true,
      persisted: true,
      reenabled: true
    };
    result.countdown = { preset: true, customSeconds: true, remainingTime: true, due: true };
    const simultaneous = [];
    for (const title of ['连续提醒第一条', '连续提醒第二条'])
      simultaneous.push(await reminders.save({ title, mode: 'countdown', durationSeconds: 1 }));
    await win.webContents.executeJavaScript(`closeSheets();void 0;`);
    live.smokeReminderNow += 1000;
    await reminders.check();
    await new Promise(r => setTimeout(r, 100));
    for (const item of simultaneous) {
      if (
        !(await win.webContents.executeJavaScript(
          `feedback.getReminder()?.id==='${item.id}' && document.querySelector('#reminder-sheet').hidden`
        ))
      )
        throw Error('simultaneous reminder did not advance in bubble');
      await require('./bubble-smoke').checkReminderLayout(win);
      await require('./bubble-smoke').click(win, 'bubble-complete');
      if (reminders.list().find(value => value.id === item.id).status !== 'done')
        throw Error('inline complete did not finish item');
    }
    const afterInlineSound = await win.webContents.executeJavaScript(`window.smokeSoundCount`);
    live.smokeReminderNow += 15000;
    reminderAlerts.tick();
    await new Promise(r => setTimeout(r, 60));
    if (
      !(await win.webContents.executeJavaScript(
        `!feedback.getReminder() && document.querySelector('#reminder-sheet').hidden && window.smokeSoundCount===${afterInlineSound}`
      ))
    )
      throw Error('inline complete opened panel or kept sound');
    result.bubbleInteraction.inlineMultiReminder = true;

    await win.webContents.executeJavaScript(`window.lunaPanels.closeSheet('reminder')`);
    notifyReminders();
    result.reminders = {
      form: true,
      dueBubble: true,
      bodyOpensPanel: true,
      inlineComplete: true,
      completeWithoutPanel: true,
      embeddedPanel: true,
      noExtraWindow: true,
      persistentBubble: true,
      bubbleComplete: true,
      snooze: true,
      complete: true,
      persisted: true
    };
    smokeStage = 'companion';
    result.companion = await require('./life-smoke').check({ win, stateFile });
    smokeStage = 'wheel';
    result.wheel = await require('./wheel-smoke').check({ win, output: app.getPath('temp') });
    smokeStage = 'language';
    result.language = await require('./language-smoke').check({
      win,
      libraryWin: live.libraryWin,
      stateFile,
      trayMenu: () => live.trayMenu
    });
    live.libraryWin.destroy();
    smokeStage = 'hybrid-and-effects';
    result.effects = await require('./character-smoke').checkReactions(win);
    smokeStage = 'edge-dock';
    result.edgeDock = await require('./edge-smoke').check({
      win,
      dock: edgeDock,
      screen,
      ipcMain,
      stateFile,
      fireReminder: async () => {
        await reminders.save({ title: '贴边提醒测试', mode: 'countdown', durationSeconds: 1 });
        live.smokeReminderNow += 2000;
        await reminders.check();
      }
    });
    await new Promise(r => setTimeout(r, 250));
    const shot = await win.webContents.capturePage();
    fs.writeFileSync(path.join(__dirname, 'preview.png'), shot.toPNG());
    const oldSender = win.webContents;
    win.destroy();
    idle.check(true);
    ipcMain.emit('passthrough', { sender: oldSender }, true);
    ipcMain.emit('drag', { sender: oldSender }, false);
    result.lateEventsAfterWindowDestroyed = true;
    fs.writeFileSync(path.join(__dirname, 'smoke-result.json'), JSON.stringify(result));
    console.log(JSON.stringify(result));
    app.exit(0);
  } catch (e) {
    console.error('SMOKE_STAGE', smokeStage, e);
    app.exit(1);
  }
};
