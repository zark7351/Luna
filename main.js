const {
  app,
  BrowserWindow,
  ipcMain,
  screen,
  Tray,
  Menu,
  nativeImage,
  shell,
  clipboard,
  dialog,
  protocol,
  net,
  powerMonitor,
  desktopCapturer,
  globalShortcut
} = require('electron');
const i18n = require('./i18n');
const t = text => i18n.translate(text, state?.settings.language);
const fs = require('node:fs');
const path = require('node:path');
const { APP_ID, appIcon, createTrayIcon } = require('./app-branding');
if (process.platform === 'win32') app.setAppUserModelId(APP_ID);
const { pathToFileURL } = require('node:url');
const reportFatal = error => {
  fs.writeFileSync(path.join(app.getPath('temp'), 'lunapet-startup-error.log'), String(error.stack || error));
  app.exit(1);
};
process.on('uncaughtException', reportFatal);
process.on('unhandledRejection', reportFatal);
const {
  defaults,
  validate,
  migrateState,
  WINDOW_WIDTH,
  WINDOW_HEIGHT,
  TOOLBAR_WIDTH,
  TOOLBAR_INSET
} = require('./core');
const { createCollection } = require('./collection');
const { mediaResponse } = require('./media');
const { copyFileToClipboard, readClipboardFiles, requireFile } = require('./file-actions');
const { fetchLinkPreview } = require('./link-preview');
const { createSystemStats } = require('./system-stats');
const { createWeather } = require('./weather');
const { createEdgeDock, clampHorizontal } = require('./edge-dock');
const { startIdleMonitor } = require('./idle');
const { createScreenshot } = require('./screenshot');
const { createReminders } = require('./reminders');
const { createReminderAlerts } = require('./reminder-alerts');
const { createRecording } = require('./recording');
const { operationSound, createSoundDispatch } = require('./sound-events');
const { effectNames, operationEffect } = require('./effect-events');
const { validateMemory } = require('./life');
protocol.registerSchemesAsPrivileged([
  { scheme: 'luna-media', privileges: { standard: true, secure: true, stream: true } }
]);
const smoke = process.argv.includes('--smoke-test');
if (smoke) app.setPath('userData', path.join(app.getPath('temp'), 'lunapet-smoke-' + process.pid));
let recording,
  win,
  libraryWin,
  tray,
  state,
  stateFile,
  collection,
  systemStats,
  systemStatsTimer,
  weather,
  idle,
  screenshot,
  reminders,
  reminderTimer,
  reminderAlertTimer,
  drag = null;
const reminderPauses = new Set();
let reminderAlerts,
  edgeDock,
  petVideoFullscreen = false;
function configureAudio(current) {
  current.webContents.setAudioMuted(!state.settings.soundEnabled);
}
const playSound = createSoundDispatch({
  enabled: () => !quitting && state?.settings.soundEnabled,
  live: () => liveWindow() && !win.webContents.isDestroyed(),
  send: name => win.webContents.send('sound-play', name)
});
function playEffect(name) {
  if (quitting || !effectNames.includes(name)) return;
  for (const current of [win, libraryWin])
    if (current && !current.isDestroyed() && !current.webContents.isDestroyed())
      current.webContents.send('ui-effect', name);
}
let smokeIdleSeconds = 0;
let smokeReminderNow = Date.now(),
  quitting = false,
  quitSettled = false;
let pureExpanded = false,
  pureAnchor = null,
  petPanelsOpen = false;
function setPureLayout(expanded = false) {
  if (!liveWindow() || !state.settings.pureMode) return;
  if (edgeDock?.read().collapsed) {
    if (expanded !== true) return;
    edgeDock.expand();
  }
  const current = win.getBounds();
  if (!pureExpanded && current.height <= 128) pureAnchor = { ...current };
  pureExpanded = expanded === true;
  const area = screen.getDisplayMatching(pureAnchor || current).workArea,
    anchor = pureAnchor || current,
    height = pureExpanded ? WINDOW_HEIGHT : 128,
    bottom = anchor.y + anchor.height;
  win.setBounds({
    x: Math.round(clampHorizontal(anchor.x, area, WINDOW_WIDTH, pureExpanded ? 0 : TOOLBAR_INSET)),
    y: Math.round(Math.max(area.y, Math.min(bottom - height, area.y + area.height - height))),
    width: WINDOW_WIDTH,
    height
  });
  edgeDock?.noteMove(win.getBounds());
  if (!pureExpanded) pureAnchor = win.getBounds();
}
let trayMenu,
  angerPhase = 'normal',
  absenceTimer = null,
  angerWatchdog = null;
const angerLocked = () => ['angry', 'furious', 'absent'].includes(angerPhase);
function openPetPanel(name) {
  if (quitting || angerLocked() || !liveWindow()) return;
  restore();
  win.webContents.send('panel-open', name);
}
let collectionOp = Promise.resolve();
let previewOp = Promise.resolve();
const previewPending = new Map();
function queuePreview(id, force = false) {
  if (previewPending.has(id)) return previewPending.get(id);
  const task = previewOp.then(async () => {
    const item = collection.list().find(entry => entry.id === id);
    if (!item || item.kind !== 'link' || (!force && item.linkPreview)) return;
    let preview;
    try {
      preview = await fetchLinkPreview(item.content, {
        fetch: net.fetch.bind(net),
        thumbnail: bytes => {
          const image = nativeImage.createFromBuffer(bytes);
          if (image.isEmpty()) return '';
          const { width, height } = image.getSize();
          const scale = Math.min(1, 360 / width, 240 / height);
          return (
            'data:image/jpeg;base64,' +
            image
              .resize({
                width: Math.max(1, Math.round(width * scale)),
                height: Math.max(1, Math.round(height * scale))
              })
              .toJPEG(80)
              .toString('base64')
          );
        }
      });
    } catch {
      preview = {
        status: 'failed',
        description: '暂时无法获取网页预览，可点击链接打开。',
        fetchedAt: new Date().toISOString()
      };
    }
    await mutateCollection(() => collection.setLinkPreview(id, preview));
    notifyCollection();
  });
  previewOp = task.catch(() => {});
  previewPending.set(id, task);
  task.finally(() => previewPending.delete(id)).catch(() => {});
  return task;
}
function mutateCollection(task) {
  const pending = collectionOp.then(task);
  collectionOp = pending.catch(() => {});
  return pending;
}
function notifyCollection() {
  for (const current of [win, libraryWin])
    if (current && !current.isDestroyed()) current.webContents.send('collection-updated');
}
function addFiles(paths) {
  return mutateCollection(async () => {
    if (!Array.isArray(paths) || !paths.length || paths.length > 10) throw Error('每次最多收藏 10 个本机文件。');
    let saved = 0;
    const failed = [],
      ids = [];
    for (const file of paths) {
      try {
        const item = await collection.addFile(file);
        ids.push(item.id);
        saved++;
      } catch (error) {
        failed.push(t(error.message || '文件收藏失败'));
      }
    }
    if (saved) notifyCollection();
    return { saved, failed, items: collection.list().filter(item => ids.includes(item.id)) };
  });
}
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
function persist() {
  fs.mkdirSync(path.dirname(stateFile), { recursive: true });
  fs.writeFileSync(stateFile + '.tmp', JSON.stringify(state, null, 2), 'utf8');
  fs.renameSync(stateFile + '.tmp', stateFile);
}
function publicState() {
  return {
    settings: state.settings,
    toolbarWidth: TOOLBAR_WIDTH,
    edgeDock: edgeDock?.read() || { side: null, collapsed: false },
    sleeping: idle?.isSleeping() || false,
    // Proactive companion lines would race the integration check's bubble assertions.
    lifePaused: smoke,
    fileDirectory: state.settings.saveDirectory || path.join(app.getPath('userData'), 'collection-files')
  };
}
function safePosition(x, y) {
  const a = screen.getDisplayNearestPoint({
    x: Math.round(x + WINDOW_WIDTH / 2),
    y: Math.round(y + (liveWindow() ? win.getBounds().height : state?.settings.pureMode ? 128 : WINDOW_HEIGHT) / 2)
  }).workArea;
  return [
    Math.round(clampHorizontal(x, a, WINDOW_WIDTH, petPanelsOpen ? 0 : TOOLBAR_INSET)),
    Math.round(
      clamp(
        y,
        a.y,
        a.y +
          Math.max(
            0,
            a.height - (liveWindow() ? win.getBounds().height : state?.settings.pureMode ? 128 : WINDOW_HEIGHT)
          )
      )
    )
  ];
}
function liveWindow() {
  return win && !win.isDestroyed();
}
function allowFullscreen(contents, permission) {
  return (
    permission === 'fullscreen' &&
    ((liveWindow() &&
      contents === win.webContents &&
      contents.getURL() === pathToFileURL(path.join(__dirname, 'index.html')).href) ||
      (libraryWin &&
        !libraryWin.isDestroyed() &&
        contents === libraryWin.webContents &&
        contents.getURL() === pathToFileURL(path.join(__dirname, 'library.html')).href))
  );
}
function restore() {
  if (angerLocked() || !liveWindow()) return;
  edgeDock?.expand();
  win.setIgnoreMouseEvents(false);
  win.show();
  win.focus();
}
async function showLibrary(view) {
  if (angerLocked()) return;
  const initial =
    view && ['all', 'media', 'files', 'text', 'links'].includes(view.tab)
      ? { tab: view.tab, query: typeof view.query === 'string' ? view.query.slice(0, 300) : '' }
      : null;
  if (libraryWin && !libraryWin.isDestroyed()) {
    libraryWin.show();
    libraryWin.focus();
    if (initial) libraryWin.webContents.send('library-view', initial);
    playSound('open');
    return;
  }
  libraryWin = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 560,
    minHeight: 400,
    frame: false,
    title: '露娜收藏夹',
    icon: appIcon,
    backgroundColor: '#fffbf9',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  configureAudio(libraryWin);
  const current = libraryWin;
  current.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  current.webContents.on('will-navigate', e => e.preventDefault());
  current.once('ready-to-show', () => {
    if (!angerLocked() && !current.isDestroyed()) current.show();
  });
  current.on('closed', () => {
    if (libraryWin === current) libraryWin = null;
    playSound('close');
  });
  await current.loadFile('library.html');
  if (!current.isDestroyed()) {
    if (initial) current.webContents.send('library-view', initial);
    playSound('open');
  }
  if (!smoke)
    for (const item of collection.list())
      if (item.kind === 'link' && !item.linkPreview) queuePreview(item.id).catch(() => {});
}
function notifyReminders() {
  if (quitting) return;
  if (liveWindow()) win.webContents.send('reminders-updated');
  if (liveWindow())
    win.webContents.send('reminder-count', reminders.list().filter(item => item.status !== 'done').length);
  reminderAlerts?.tick();
}
async function showReminders() {
  if (quitting || !liveWindow()) return;
  openPetPanel('reminder');
}
function presentReminders() {
  if (quitting || reminderPauses.size) return;
  clearTimeout(reminderAlertTimer);
  if (angerLocked() || screenshot?.isActive() || recording?.isActive()) {
    reminderAlertTimer = setTimeout(presentReminders, 500);
    return;
  }
  reminderAlerts?.tick();
  if (!reminders.list().some(item => item.status === 'fired')) return;
  if (liveWindow()) win.showInactive();
}
if (!app.requestSingleInstanceLock() && !smoke) app.quit();
else {
  app.on('second-instance', () => {
    if (win) restore();
  });
  app.whenReady().then(async () => {
    stateFile = path.join(app.getPath('userData'), 'state.json');
    if (smoke) {
      fs.mkdirSync(path.dirname(stateFile), { recursive: true });
      fs.writeFileSync(
        stateFile,
        JSON.stringify({
          settings: {
            name: '露娜',
            nickname: '',
            top: true,
            online: true,
            baseUrl: 'https://example.test/v1',
            model: 'old-model'
          },
          key: 'fake-encrypted-key',
          history: [{ role: 'assistant', content: '旧版测试回复', online: true }],
          position: [100, 100]
        }),
        'utf8'
      );
    }
    state = { settings: { ...defaults }, layoutVersion: 3 };
    try {
      state = migrateState(JSON.parse(fs.readFileSync(stateFile, 'utf8')));
      persist();
    } catch {}
    collection = await createCollection(app.getPath('userData'), { getDirectory: () => state.settings.saveDirectory });
    reminders = await createReminders(app.getPath('userData'), {
      now: smoke ? () => smokeReminderNow : Date.now,
      onChange: notifyReminders,
      onDue: () => presentReminders()
    });
    reminderAlerts = createReminderAlerts({
      getDue: () => reminders.list().filter(item => item.status === 'fired'),
      isPaused: () => quitting || reminderPauses.size > 0 || screenshot?.isActive() || recording?.isActive(),
      send: value => {
        if (!liveWindow()) return false;
        if (value) edgeDock?.expand();
        win.webContents.send('reminder-due', value);
        if (value) win.showInactive();
        return true;
      },
      play: () => playSound('reminder'),
      now: smoke ? () => smokeReminderNow : Date.now
    });
    systemStats = smoke ? { read: () => ({ cpu: 25, memory: 50, gpu: 75 }), stop: () => {} } : null;
    const smokePlace = { name: '杭州', latitude: 30.27, longitude: 120.15, detail: '浙江 · 中国', source: 'manual' };
    weather = smoke
      ? {
          current: async place =>
            place
              ? { status: 'ready', location: place, reading: { label: '晴', temperature: 24 } }
              : { status: 'unset' },
          search: async () => [smokePlace],
          locate: async () => ({ ...smokePlace, source: 'ip' })
        }
      : createWeather({ directory: app.getPath('userData'), fetch: (...args) => net.fetch(...args) });
    protocol.handle('luna-media', request => mediaResponse(request, collection));
    const area = screen.getPrimaryDisplay().workArea;
    const p = state.position || [area.x + area.width - WINDOW_WIDTH - 30, area.y + area.height - WINDOW_HEIGHT - 20];
    const [x, y] = safePosition(Number(p[0]) || 0, Number(p[1]) || 0);
    win = new BrowserWindow({
      width: WINDOW_WIDTH,
      height: state.settings.pureMode ? 128 : WINDOW_HEIGHT,
      x,
      y,
      icon: appIcon,
      transparent: true,
      frame: false,
      resizable: false,
      hasShadow: false,
      alwaysOnTop: state.settings.top,
      show: false,
      skipTaskbar: false,
      backgroundColor: '#00000000',
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        backgroundThrottling: false,
        autoplayPolicy: 'no-user-gesture-required'
      }
    });
    win.on('close', event => {
      if (!quitting) {
        event.preventDefault();
        if (liveWindow()) win.hide();
      }
    });
    configureAudio(win);
    let normalPetBounds = win.getBounds();
    edgeDock = createEdgeDock({
      getWindow: () => win,
      getArea: bounds => screen.getDisplayMatching(bounds).workArea,
      getInset: () => (petPanelsOpen ? 0 : TOOLBAR_INSET),
      getHeight: () => (state.settings.pureMode ? (pureExpanded ? WINDOW_HEIGHT : 128) : WINDOW_HEIGHT),
      onChange: value => {
        if (liveWindow() && !win.webContents.isDestroyed()) {
          if (!value.collapsed) normalPetBounds = win.getBounds();
          win.webContents.send('edge-dock-changed', value);
        }
      },
      onPosition: position => {
        state.position = position;
        persist();
      },
      canCollapse: () =>
        !angerLocked() &&
        !quitting &&
        !drag &&
        !petVideoFullscreen &&
        !screenshot?.isActive() &&
        !recording?.isActive() &&
        !reminders.list().some(item => item.status === 'fired')
    });
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.webContents.on('will-navigate', e => e.preventDefault());
    const panelURLs = new Set(
      ['library.html', 'recording.html', 'reminder.html'].map(file => pathToFileURL(path.join(__dirname, file)).href)
    );
    win.webContents.on('will-frame-navigate', event => {
      if (event.isMainFrame || !panelURLs.has(event.url)) event.preventDefault();
    });
    win.webContents.session.setPermissionRequestHandler((contents, permission, cb, details) =>
      cb(
        allowFullscreen(contents, permission) ||
          (['display-capture', 'media'].includes(permission) &&
            !details.mediaTypes?.includes('audio') &&
            recording?.canCapture(contents) === true)
      )
    );
    win.webContents.session.setPermissionCheckHandler(
      (contents, permission) =>
        allowFullscreen(contents, permission) ||
        (['display-capture', 'media'].includes(permission) && recording?.canCapture(contents) === true)
    );
    win.once('ready-to-show', () => {
      if (liveWindow()) win.show();
    });
    win.webContents.on('enter-html-full-screen', () => {
      petVideoFullscreen = true;
      win.setIgnoreMouseEvents(false);
    });
    win.webContents.on('leave-html-full-screen', () => {
      petVideoFullscreen = false;
      const restoreBounds = { ...normalPetBounds };
      setTimeout(() => {
        if (liveWindow() && !petVideoFullscreen) {
          if (state.settings.pureMode) setPureLayout(pureExpanded);
          else win.setBounds(restoreBounds);
        }
      }, 0);
    });
    win.on('moved', () => {
      if (!liveWindow() || petVideoFullscreen || edgeDock.read().collapsed || edgeDock.isAdjusting()) return;
      const bounds = win.getBounds();
      if (state.settings.pureMode) {
        if (!pureExpanded) {
          pureAnchor = { ...bounds };
          state.position = win.getPosition();
        }
        edgeDock.noteMove(bounds);
        return;
      }
      if (Math.abs(bounds.width - WINDOW_WIDTH) <= 16 && Math.abs(bounds.height - WINDOW_HEIGHT) <= 16) {
        edgeDock.noteMove(bounds);
        normalPetBounds = { ...normalPetBounds, x: bounds.x, y: bounds.y };
        state.position = win.getPosition();
      }
    });
    const reflowPet = () => {
      if (liveWindow() && !petVideoFullscreen) {
        if (state.settings.pureMode && !edgeDock.read().collapsed) setPureLayout(pureExpanded);
        else edgeDock.reflow();
      }
    };
    screen.on('display-removed', reflowPet);
    screen.on('display-metrics-changed', reflowPet);
    win.once('closed', () => {
      edgeDock.stop();
      screen.removeListener('display-removed', reflowPet);
      screen.removeListener('display-metrics-changed', reflowPet);
    });
    tray = new Tray(createTrayIcon(nativeImage));
    function syncTray() {
      if (quitting || !tray || tray.isDestroyed()) return;
      tray.setToolTip(t('露娜 · 桌面伙伴'));
      trayMenu = Menu.buildFromTemplate([
        { id: 'settings', label: t('设置'), click: () => openPetPanel('settings') },
        { id: 'help', label: t('使用说明'), click: () => openPetPanel('help') },
        { type: 'separator' },
        { label: t('区域录屏'), click: () => recording?.show().catch(() => {}) },
        { label: t('提醒'), click: () => showReminders().catch(() => {}) },
        {
          label: t('截图收藏（Ctrl+Alt+A）'),
          click: () => {
            if (!angerLocked() && !recording?.isActive()) screenshot?.start();
          }
        },
        { type: 'separator' },
        { label: t('显示宠物'), click: restore },
        {
          label: t('隐藏宠物'),
          click: () => {
            if (liveWindow()) win.hide();
          }
        },
        { type: 'separator' },
        { label: t('退出'), click: () => app.quit() }
      ]);
      for (const item of trayMenu.items)
        if (item.type !== 'separator' && item.label !== t('退出')) item.enabled = !angerLocked();
      tray.setContextMenu(trayMenu);
    }
    syncTray();
    tray.on('double-click', restore);
    const handle = (name, fn, allowLibrary = false) =>
      ipcMain.handle(name, async (e, ...args) => {
        const petSender = liveWindow() && e.sender === win.webContents;
        const librarySender =
          allowLibrary && libraryWin && !libraryWin.isDestroyed() && e.sender === libraryWin.webContents;
        if (quitting || (!petSender && !librarySender)) return { ok: false, error: '窗口已关闭' };
        if (angerLocked() && !['anger-mode', 'anger-hide', 'state', 'quit'].includes(name))
          return { ok: false, error: t('露娜暂时不理你，请稍后再试。') };
        try {
          const value = await fn(...args);
          const sound = operationSound(name, value, args[0]);
          if (sound) playSound(sound);
          const effect = operationEffect(name, value, args[0]);
          if (effect) playEffect(effect);
          return { ok: true, value };
        } catch (err) {
          const sound = operationSound(name, null, args[0], true);
          if (sound) playSound(sound);
          return { ok: false, error: t(err.message || '操作失败') };
        }
      });
    handle('anger-mode', phase => {
      if (!['normal', 'angry', 'furious'].includes(phase) || angerPhase === 'absent')
        throw Error('Invalid interaction phase');
      angerPhase = phase;
      clearTimeout(angerWatchdog);
      if (phase !== 'normal')
        angerWatchdog = setTimeout(() => {
          if (quitting || !liveWindow() || angerPhase === 'absent') return;
          angerPhase = 'normal';
          reminderPauses.delete('anger');
          win.webContents.send('pet-absence', false);
          syncTray();
        }, 30000);
      if (phase === 'normal') reminderPauses.delete('anger');
      else reminderPauses.add('anger');
      syncTray();
      return true;
    });
    handle('anger-hide', async () => {
      if (angerPhase !== 'furious') throw Error('Invalid interaction phase');
      // Cancel a selection or finish active capture before hiding its controls.
      screenshot.cancel();
      await recording.stop();
      if (!liveWindow() || quitting) return false;
      clearTimeout(angerWatchdog);
      angerPhase = 'absent';
      drag = null;
      for (const current of [win, libraryWin]) if (current && !current.isDestroyed()) current.hide();
      syncTray();
      clearTimeout(absenceTimer);
      absenceTimer = setTimeout(() => {
        absenceTimer = null;
        angerPhase = 'normal';
        reminderPauses.delete('anger');
        if (quitting || !liveWindow()) return;
        edgeDock?.expand();
        win.setIgnoreMouseEvents(false);
        win.showInactive();
        win.webContents.send('pet-absence', false);
        syncTray();
      }, 10000);
      return true;
    });
    handle('ui-sound', name => playSound(name), true);
    handle('panel-focus', () => {
      if (liveWindow() && win.isVisible()) {
        win.setIgnoreMouseEvents(false);
        win.focus();
        return true;
      }
      return false;
    });
    const captureMessage = (message, saved) => {
      for (const window of [win, libraryWin])
        if (window && !window.isDestroyed())
          window.webContents.send('screenshot-message', { message: t(message), saved });
    };
    screenshot = createScreenshot({
      getLanguage: () => state.settings.language,
      BrowserWindow,
      ipcMain,
      screen,
      getWindows: () => [win, libraryWin],
      getSources: smoke
        ? async () =>
            screen.getAllDisplays().map(display => ({
              display_id: String(display.id),
              thumbnail: nativeImage
                .createFromPath(path.join(__dirname, 'assets', 'luna-avatar.png'))
                .resize({ width: display.bounds.width * 2, height: display.bounds.height * 2 })
            }))
        : desktopCapturer.getSources.bind(desktopCapturer),
      save: png =>
        mutateCollection(async () => {
          await collection.addBytes('截图-' + new Date().toISOString().replace(/[:.]/g, '-') + '.png', png);
          notifyCollection();
        }),
      onMessage: (message, saved) => {
        captureMessage(message, saved);
        if (saved) playEffect('capture');
      },
      onEvent: playSound
    });
    recording = createRecording({
      isBlocked: angerLocked,
      nativeRecorder: require('./native-recording').createNativeRecording({ screen }),
      getHostWindow: () => win,
      onShow: () => openPetPanel('recording'),
      BrowserWindow,
      ipcMain,
      screen,
      powerMonitor,
      screenshot,
      collection,
      getWindows: () => [win, libraryWin],
      getSettings: () => state.settings,
      remember: options => {
        const previous = state;
        state = { ...state, settings: { ...state.settings, recordFrameRate: options.fps, recordFormat: 'mp4' } };
        try {
          persist();
        } catch (error) {
          state = previous;
          throw error;
        }
      },
      commit: writer =>
        mutateCollection(async () => {
          const item = await writer.finish();
          notifyCollection();
          return item;
        }),
      onMessage: (message, saved) => {
        captureMessage(message, saved);
        if (saved) playEffect('recording');
      },
      onSound: playSound,
      smoke
    });
    handle('recording-show', () => recording.show(), true);
    handle(
      'screenshot-start',
      () => {
        if (recording.isActive()) throw Error('请先停止录屏。');
        return screenshot.start();
      },
      true
    );
    handle('storage-choose', async () => {
      if (!liveWindow()) throw Error('窗口已关闭');
      const current = win;
      const result = await dialog.showOpenDialog(current, {
        title: t('选择露娜文件保存目录'),
        defaultPath: state.settings.saveDirectory || app.getPath('documents'),
        properties: ['openDirectory', 'createDirectory']
      });
      if (current.isDestroyed()) throw Error('窗口已关闭');
      return result.canceled ? null : result.filePaths[0];
    });
    let captureShortcut = false;
    const shortcutStatus = () => ({ enabled: state.settings.screenshotShortcut, available: captureShortcut });
    function syncCaptureShortcut() {
      if (!state.settings.screenshotShortcut) {
        if (captureShortcut) globalShortcut.unregister('CommandOrControl+Alt+A');
        captureShortcut = false;
      } else if (!captureShortcut && !smoke) {
        try {
          captureShortcut = globalShortcut.register('CommandOrControl+Alt+A', () => {
            if (!angerLocked() && state.settings.screenshotShortcut && !recording.isActive())
              screenshot.start().catch(() => captureMessage('截图启动失败。', false));
          });
        } catch {
          captureShortcut = false;
        }
      }
      for (const window of [win, libraryWin])
        if (window && !window.isDestroyed()) window.webContents.send('screenshot-shortcut-changed', shortcutStatus());
    }
    syncCaptureShortcut();
    handle('screenshot-shortcut', shortcutStatus, true);
    handle('reminder-show', () => showReminders());
    handle('reminder-list', () => reminders.list(), false);
    handle('reminder-complete', id => reminders.action({ id, action: 'complete' }, true));
    handle('reminder-save', input => reminders.save(input), false);
    handle('reminder-action', input => reminders.action(input), false);
    handle('state', () => publicState(), true);
    handle('life-memory', input => {
      if (input !== undefined) {
        const previous = state;
        state = { ...state, life: validateMemory(input) };
        try {
          persist();
        } catch (error) {
          state = previous;
          throw error;
        }
      }
      return validateMemory(state.life);
    });
    handle('system-stats', () => {
      if (!systemStats) systemStats = createSystemStats();
      if (!smoke) {
        clearTimeout(systemStatsTimer);
        systemStatsTimer = setTimeout(() => {
          systemStats?.stop();
          systemStats = null;
        }, 7000);
      }
      return systemStats.read();
    });
    handle('weather-current', () => weather.current(state.settings.weatherLocation));
    handle('weather-search', query => weather.search(query));
    handle('weather-locate', () => weather.locate());
    handle('edge-expand', () => edgeDock.expand());
    handle('settings', async input => {
      const next = validate({
        ...input,
        language: input?.language ?? state.settings.language,
        pureMode: input?.pureMode ?? state.settings.pureMode,
        companion: input?.companion ?? state.settings.companion,
        weatherLocation: Object.hasOwn(input || {}, 'weatherLocation')
          ? input.weatherLocation
          : state.settings.weatherLocation,
        recordFrameRate: input?.recordFrameRate ?? state.settings.recordFrameRate,
        recordFormat: state.settings.recordFormat
      });
      if (next.saveDirectory !== state.settings.saveDirectory) {
        if (recording.isActive()) throw Error('停止录屏后再修改保存位置。');
        if (next.saveDirectory) {
          await fs.promises.mkdir(next.saveDirectory, { recursive: true });
          await fs.promises.access(next.saveDirectory, fs.constants.W_OK);
        }
      }
      const previous = state;
      state = { ...state, settings: next };
      try {
        persist();
      } catch (e) {
        state = previous;
        throw e;
      }
      if (liveWindow() && next.pureMode !== previous.settings.pureMode) {
        edgeDock.beginDrag();
        const bounds = win.getBounds();
        if (next.pureMode) {
          pureAnchor = { ...bounds };
          pureExpanded = true;
          setPureLayout(false);
        } else {
          pureExpanded = false;
          const modeArea = screen.getDisplayMatching(bounds).workArea;
          const pos = [
            clampHorizontal(bounds.x, modeArea, WINDOW_WIDTH, petPanelsOpen ? 0 : TOOLBAR_INSET),
            Math.max(
              modeArea.y,
              Math.min(bounds.y + bounds.height - WINDOW_HEIGHT, modeArea.y + modeArea.height - WINDOW_HEIGHT)
            )
          ];
          win.setBounds({ x: pos[0], y: pos[1], width: WINDOW_WIDTH, height: WINDOW_HEIGHT });
          edgeDock.noteMove(win.getBounds());
          normalPetBounds = win.getBounds();
        }
        state.position = win.getPosition();
        persist();
      }
      syncTray();
      for (const current of [win, libraryWin])
        if (current && !current.isDestroyed() && !current.webContents.isDestroyed())
          current.webContents.send('settings-changed', next);
      if (liveWindow()) win.setAlwaysOnTop(next.top);
      for (const current of [win, libraryWin]) if (current && !current.isDestroyed()) configureAudio(current);
      syncCaptureShortcut();
      return publicState();
    });
    handle('pure-layout', expanded => {
      setPureLayout(expanded);
      return true;
    });
    handle('hide', () => win.hide());
    handle('quit', () => app.quit());
    handle('library-show', () => openPetPanel('library'));
    handle('library-expand', showLibrary);
    ipcMain.handle('library-window', async (event, action) => {
      const current = libraryWin;
      if (angerLocked() || quitting || !current || current.isDestroyed() || event.sender !== current.webContents)
        return { ok: false, error: '窗口已关闭' };
      if (action === 'close') current.close();
      else if (action === 'maximize') current.isMaximized() ? current.unmaximize() : current.maximize();
      else return { ok: false, error: '未知操作' };
      return { ok: true };
    });
    handle('collection-list', () => collection.list(), true);
    const addText = content =>
      mutateCollection(async () => {
        const item = await collection.addText(content);
        notifyCollection();
        if (item.kind === 'link' && !smoke) queuePreview(item.id).catch(() => {});
        return item;
      });
    handle('collection-add-text', addText, true);
    handle(
      'collection-add-clipboard',
      async () => {
        const files = await readClipboardFiles();
        if (files.length) return { kind: 'files', ...(await addFiles(files)) };
        const contents = await clipboard.read(),
          extensions = {
            'video/mp4': 'mp4',
            'video/webm': 'webm',
            'image/png': 'png',
            'image/jpeg': 'jpg',
            'image/gif': 'gif',
            'image/webp': 'webp'
          };
        for (const type of Object.keys(extensions)) {
          const rawType = 'electron application/osclipboard;format="' + type + '"';
          const source = contents.find(item => item.types.includes(type) || item.types.includes(rawType));
          if (!source) continue;
          const blob = await source.getType(source.types.includes(type) ? type : rawType);
          if (!blob.size || blob.size > 64 * 1024 * 1024)
            throw Error('剪贴板文件无效或超过 64 MB，请先保存到电脑再收藏。');
          const bytes = new Uint8Array(await blob.arrayBuffer());
          return mutateCollection(async () => {
            const item = await collection.addBytes('剪贴板-' + Date.now() + '.' + extensions[type], bytes);
            notifyCollection();
            return {
              kind: 'files',
              saved: 1,
              failed: [],
              items: collection.list().filter(entry => entry.id === item.id)
            };
          });
        }
        const text = await clipboard.readText();
        if (!text.trim()) throw Error('剪贴板没有可收藏的文件、图片、文字或链接。');
        return addText(text);
      },
      true
    );
    handle(
      'collection-link-preview',
      async id => {
        const item = collection.openTarget(id);
        if (item.kind !== 'link') throw Error('不是网页链接。');
        await queuePreview(id, true);
        return true;
      },
      true
    );
    handle('collection-add-files', addFiles, true);
    handle(
      'collection-add-drop',
      entries =>
        mutateCollection(async () => {
          if (!Array.isArray(entries) || !entries.length || entries.length > 10)
            throw Error('每次最多收藏 10 个文件。');
          let saved = 0;
          const failed = [];
          for (const entry of entries) {
            try {
              if (!entry || typeof entry !== 'object') throw Error('拖入文件无效。');
              if (typeof entry.path === 'string') await collection.addFile(entry.path);
              else if (entry.bytes instanceof ArrayBuffer)
                await collection.addBytes(entry.name, new Uint8Array(entry.bytes));
              else throw Error('没有收到可用文件，请先保存到电脑再拖入。');
              saved++;
            } catch (error) {
              failed.push(t(error.message || '文件收藏失败'));
            }
          }
          if (saved) notifyCollection();
          return { saved, failed };
        }),
      true
    );
    handle(
      'library-add-files',
      async () => {
        const current = libraryWin && !libraryWin.isDestroyed() && libraryWin.isFocused() ? libraryWin : win;
        if (!current || current.isDestroyed()) throw Error('收藏窗口已关闭。');
        const chosen = await dialog.showOpenDialog(current, {
          title: t('选择要收藏的文件'),
          properties: ['openFile', 'multiSelections']
        });
        if (current.isDestroyed()) throw Error('收藏窗口已关闭。');
        if (chosen.canceled) return { saved: 0, failed: [] };
        return addFiles(chosen.filePaths);
      },
      true
    );
    handle(
      'collection-open',
      async id => {
        const item = collection.openTarget(id);
        if (item.kind === 'file') {
          const error = await shell.openPath(item.target);
          if (error)
            throw Error(
              item.storage === 'reference'
                ? '无法打开原文件，可能已移动、删除或所在磁盘不可用。'
                : '无法打开文件，请检查收藏副本是否还在。'
            );
        } else if (item.kind === 'link') {
          const url = new URL(item.target);
          if (!['http:', 'https:'].includes(url.protocol)) throw Error('不支持打开这个链接。');
          await shell.openExternal(url.href);
        } else throw Error('文字内容请使用复制按钮。');
        return true;
      },
      true
    );
    handle(
      'collection-copy',
      async id => {
        const item = collection.openTarget(id);
        if (item.kind === 'file') return copyFileToClipboard(item.target);
        await clipboard.writeText(item.target);
        return true;
      },
      true
    );
    handle(
      'collection-reveal',
      async id => {
        const item = collection.openTarget(id);
        if (item.kind !== 'file') throw Error('只有文件可打开所在文件夹。');
        await requireFile(item.target);
        shell.showItemInFolder(item.target);
        return true;
      },
      true
    );
    handle(
      'collection-file-icon',
      async id => {
        const item = collection.openTarget(id);
        if (item.kind !== 'file') throw Error('不是文件。');
        await requireFile(item.target);
        return (await app.getFileIcon(item.target, { size: 'large' })).toDataURL();
      },
      true
    );
    handle(
      'collection-delete',
      id =>
        mutateCollection(async () => {
          const removed = await collection.remove(id);
          notifyCollection();
          return removed;
        }),
      true
    );
    handle(
      'collection-pin',
      input =>
        mutateCollection(async () => {
          if (!input || typeof input.id !== 'string') throw Error('收藏项不存在。');
          const pinned = await collection.setPinned(input.id, input.pinned === true);
          notifyCollection();
          return pinned;
        }),
      true
    );
    handle(
      'collection-keep-copy',
      id =>
        mutateCollection(async () => {
          const copied = await collection.keepCopy(id);
          notifyCollection();
          return copied;
        }),
      true
    );
    handle(
      'collection-cleanup',
      input =>
        mutateCollection(async () => {
          const dryRun = input?.dryRun === true;
          const removed = await collection.cleanup({ days: 30, dryRun });
          if (!dryRun && removed) notifyCollection();
          return removed;
        }),
      true
    );
    ipcMain.on('passthrough', (e, value) => {
      if (liveWindow() && e.sender === win.webContents && !drag)
        win.setIgnoreMouseEvents(edgeDock.read().collapsed ? false : value === true, { forward: true });
    });
    ipcMain.on('edge-hold', (e, value, expanded) => {
      if (liveWindow() && e.sender === win.webContents) {
        const changed = petPanelsOpen !== (expanded === true);
        petPanelsOpen = expanded === true;
        edgeDock.hold(value === true);
        if (changed && !state.settings.pureMode && !petVideoFullscreen) edgeDock.reflow();
      }
    });
    ipcMain.on('drag', (e, start) => {
      if (!liveWindow() || e.sender !== win.webContents) return;
      if (start) {
        if (angerLocked()) return;
        if (petVideoFullscreen || screenshot?.isActive()) return;
        edgeDock.beginDrag();
        drag = { cursor: screen.getCursorScreenPoint(), pos: win.getPosition() };
        win.setIgnoreMouseEvents(false);
      } else if (drag) {
        drag = null;
        edgeDock.finishDrag();
      }
    });
    const timer = setInterval(() => {
      if (drag && !win.isDestroyed()) {
        const c = screen.getCursorScreenPoint();
        win.setPosition(...safePosition(drag.pos[0] + c.x - drag.cursor.x, drag.pos[1] + c.y - drag.cursor.y));
      }
    }, 16);
    win.on('closed', () => {
      drag = null;
      clearInterval(timer);
      idle?.stop();
    });
    idle = startIdleMonitor({
      powerMonitor,
      getWindow: () => win,
      readIdleSeconds: () => (smoke ? smokeIdleSeconds : powerMonitor.getSystemIdleTime())
    });
    win.webContents.on('did-finish-load', () => {
      if (liveWindow()) idle.check(true);
    });
    if (smoke)
      win.webContents.on('console-message', details => {
        if (details.level === 'error') console.error('SMOKE_RENDERER_ERROR', details.message);
      });
    await win.loadFile('index.html');
    if (smoke)
      await win.webContents.executeJavaScript(
        `Object.values(sounds).forEach(sound=>sound.volume=0);window.smokeUiSounds=[];window.smokeUiEffects=[];window.pet.onEffect(name=>window.smokeUiEffects.push(name));window.pet.onSound(name=>window.smokeUiSounds.push(name));void 0;`
      );
    notifyReminders();
    const checkReminders = () => {
      if (!quitting && !reminderPauses.size)
        reminders
          .check()
          .then(() => reminderAlerts.tick())
          .catch(() => captureMessage('提醒保存失败，请检查磁盘空间。', false));
    };
    const suspendReminders = () => reminderPauses.add('suspend'),
      lockReminders = () => reminderPauses.add('lock');
    const resumeReminders = () => {
        reminderPauses.delete('suspend');
        checkReminders();
        presentReminders();
      },
      unlockReminders = () => {
        reminderPauses.delete('lock');
        checkReminders();
        presentReminders();
      };
    powerMonitor.on('suspend', suspendReminders);
    powerMonitor.on('lock-screen', lockReminders);
    powerMonitor.on('resume', resumeReminders);
    powerMonitor.on('unlock-screen', unlockReminders);
    app.once('before-quit', () => {
      for (const [name, listener] of [
        ['suspend', suspendReminders],
        ['lock-screen', lockReminders],
        ['resume', resumeReminders],
        ['unlock-screen', unlockReminders]
      ])
        powerMonitor.removeListener(name, listener);
    });
    if (!smoke) {
      reminderTimer = setInterval(checkReminders, 1000);
      checkReminders();
    }
    if (smoke)
      await require('./desktop-smoke')({
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
        showReminders,
        get angerPhase() {
          return angerPhase;
        },
        get captureShortcut() {
          return captureShortcut;
        },
        get libraryWin() {
          return libraryWin;
        },
        get state() {
          return state;
        },
        get systemStats() {
          return systemStats;
        },
        get trayMenu() {
          return trayMenu;
        },
        get smokeIdleSeconds() {
          return smokeIdleSeconds;
        },
        set smokeIdleSeconds(value) {
          smokeIdleSeconds = value;
        },
        get smokeReminderNow() {
          return smokeReminderNow;
        },
        set smokeReminderNow(value) {
          smokeReminderNow = value;
        }
      });
  });
  app.on('before-quit', event => {
    quitting = true;
    clearTimeout(absenceTimer);
    clearTimeout(angerWatchdog);
    edgeDock?.stop();
    clearInterval(reminderTimer);
    clearTimeout(systemStatsTimer);
    systemStats?.stop();
    reminderAlerts?.stop();
    clearTimeout(reminderAlertTimer);
    reminders?.stop();
    screenshot?.stop();
    globalShortcut.unregisterAll();
    if (stateFile && state) persist();
    if ((reminders || recording) && !quitSettled) {
      event.preventDefault();
      Promise.all([reminders?.settled(), recording?.stop()]).finally(() => {
        quitSettled = true;
        app.quit();
      });
    }
  });
  app.on('window-all-closed', () => app.quit());
}
