// Capture actual application UI using the existing isolated smoke-test bootstrap.
// Only the screen source is a local fixture; no personal desktop, clipboard or files are read.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { app, BrowserWindow, nativeImage, screen } = require('electron');
const root = path.resolve(__dirname, '../..');
app.setAppPath(root);
const output = path.resolve(root, '../Claudy-Promo/functional-captures');
fs.mkdirSync(output, { recursive: true });
let fixture;
const screenshotModule = require('../../screenshot');
const originalCreate = screenshotModule.createScreenshot;
screenshotModule.createScreenshot = options =>
  originalCreate({
    ...options,
    getSources: async () =>
      screen.getAllDisplays().map((display, index) => ({
        id: `screen:promo:${index}`,
        display_id: String(display.id),
        name: 'Local demonstration',
        thumbnail: fixture
      }))
  });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const manifest = {};
async function run(live) {
  const { win, screenshot } = live;
  const read = code => {
    if (win.isDestroyed() || win.webContents.isDestroyed()) throw Error('演示窗口已关闭');
    return win.webContents.executeJavaScript(code);
  };
  const frame = (name, code) => {
    const f = win.webContents.mainFrame.frames.find(f => f.url.includes(name + '.html'));
    if (!f || f.detached) throw Error('演示面板不可用：' + name);
    return f.executeJavaScript(code);
  };
  async function capture(name, current = win, selector = null) {
    await delay(650);
    if (current.isDestroyed() || current.webContents.isDestroyed()) throw Error('截图窗口已关闭');
    let bounds;
    if (selector)
      bounds = await current.webContents.executeJavaScript(
        `(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:Math.max(0,Math.floor(r.x)),y:Math.max(0,Math.floor(r.y)),width:Math.ceil(r.width),height:Math.ceil(r.height)}})()`
      );
    const captured = await current.webContents.capturePage(bounds);
    assert.ok(!captured.isEmpty(), name);
    // Editing crops use CSS pixels; capturePage returns physical pixels on HiDPI displays.
    const dimensions =
      bounds || (await current.webContents.executeJavaScript('({width:innerWidth,height:innerHeight})'));
    const image = captured.resize({ width: dimensions.width, height: dimensions.height, quality: 'best' });
    fs.writeFileSync(path.join(output, name + '.png'), image.toPNG());
    manifest[name] = { ...image.getSize(), file: name + '.png' };
    console.log('UI_CAPTURE ' + name);
  }
  try {
    live.smokeIdleNow = new Date(2026, 10, 3, 10).getTime();
    live.idle.check(true);
    await read(`api('settings',{...settings,companion:false,sound:false});`);
    await delay(500);
    const demo = new BrowserWindow({
      show: false,
      width: 1000,
      height: 650,
      webPreferences: { sandbox: true, contextIsolation: true }
    });
    await demo.loadURL(
      'data:text/html;charset=utf-8,' +
        encodeURIComponent(
          '<body style="margin:0;background:#e9edf2;font-family:Microsoft YaHei"><div style="margin:60px;background:white;padding:55px;border-radius:18px"><h1>截图功能演示</h1><p>按住鼠标左键拖动，框选需要保存的区域。</p><p>松开后保存 PNG，并自动加入收藏夹。</p><hr><p>本页面仅包含演示内容。</p></div>'
        )
    );
    fixture = await demo.webContents.capturePage();
    demo.destroy();
    await capture('pet', win, '#pet');
    await read(`closeSheets();document.querySelector('#settings').hidden=true;wheel.show(140,300);`);
    await capture('menu', win, '#wheel');
    await read(`wheel.close();`);
    await delay(350);
    await read(
      `(()=>{const data=new DataTransfer();data.setData('text/plain','产品演示：周五整理项目资料');document.querySelector('#pet').dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:data}));})()`
    );
    await delay(500);
    assert.ok(live.collection.list().some(x => x.content?.includes('周五')));
    await capture('drop-result', win, '#companion');
    await live.collection.addText('项目素材清单\n界面截图、演示视频、说明文档');
    await live.collection.addBytes('演示图片.png', fixture.toPNG());
    live.notifyCollection();
    await read(`api('library-expand');`);
    await delay(750);
    const library = live.libraryWin;
    assert.ok(library && !library.isDestroyed());
    await capture('library', library);
    await library.webContents.executeJavaScript(
      `document.querySelector('#search').value='周五';document.querySelector('#search').dispatchEvent(new Event('input'));`
    );
    await capture('library-search', library);
    library.hide();
    await read(`closeSheets();document.querySelector('#settings').hidden=true;`);
    await screenshot.start();
    const overlay = screenshot.getWindows()[0];
    await delay(450);
    overlay.webContents.sendInputEvent({ type: 'mouseDown', button: 'left', clickCount: 1, x: 120, y: 110 });
    overlay.webContents.sendInputEvent({ type: 'mouseMove', x: 800, y: 470, buttons: 1 });
    await capture('screenshot-selection', overlay);
    overlay.webContents.sendInputEvent({ type: 'mouseUp', button: 'left', clickCount: 1, x: 800, y: 470 });
    await delay(800);
    assert.ok(live.collection.list().some(x => x.kind === 'file' && x.title.includes('截图')));
    await read(`api('library-expand');`);
    await delay(400);
    await library.webContents.executeJavaScript(
      `document.querySelector('#search').value='';document.querySelector('#search').dispatchEvent(new Event('input'));document.querySelector('#tab-media').click();`
    );
    await capture('screenshot-saved', library);
    library.hide();
    await read(`api('recording-show');`);
    await capture('recording', win, '#recording-sheet');
    await live.recording.select({ format: 'mp4', fps: 60 });
    await delay(350);
    const selection = screenshot.getWindows()[0];
    await selection.webContents
      .executeJavaScript(`void window.capture.select({x:160,y:150,width:640,height:360});true`)
      .catch(async () => {
        selection.webContents.sendInputEvent({ type: 'mouseDown', button: 'left', clickCount: 1, x: 160, y: 150 });
        selection.webContents.sendInputEvent({ type: 'mouseMove', x: 800, y: 510, buttons: 1 });
        selection.webContents.sendInputEvent({ type: 'mouseUp', button: 'left', clickCount: 1, x: 800, y: 510 });
      });
    await delay(600);
    if (live.recording.getBorders().length) await capture('recording-adjust', live.recording.getBorders()[0]);
    await live.recording.stop();
    await read(`closeSheets();openSheet('reminder');`);
    await delay(400);
    live.smokeReminderNow = new Date(2026, 10, 3, 10).getTime();
    await frame(
      'reminder',
      `reset();setMode('scheduled');$('title').value='整理项目资料';$('repeat').value='weekly';syncRecurrence();$('repeat-time').value='16:00';setDays([1,3,5]);`
    );
    await capture('reminder-weekly', win, '#reminder-sheet');
    await frame('reminder', `$('form').requestSubmit();`);
    await delay(400);
    assert.ok(live.reminders.list().some(x => x.recurrence?.kind === 'weekly'));
    await delay(2500);
    await frame('reminder', `$('status').textContent='';`);
    await capture('reminder-saved', win, '#reminder-sheet');
    await frame(
      'reminder',
      `reset();setMode('countdown');$('title').value='检查导出结果';$('hours').value='0';$('minutes').value='15';$('seconds').value='0';`
    );
    await capture('reminder-countdown', win, '#reminder-sheet');
    await read(`closeSheets();openSettings();`);
    await capture('settings', win, '#settings');
    await read(`document.querySelector('#hotkeys-settings').scrollIntoView({block:'start'});`);
    await capture('hotkeys', win, '#hotkeys-settings');
    await read(`document.querySelector('#settings').hidden=true;saveQuickSetting({pureMode:true});`);
    await delay(600);
    await capture('compact', win, '#pure-flower');
    fs.writeFileSync(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2));
    console.log('FUNCTIONAL_CAPTURE_OK');
  } finally {
    screenshot.cancel();
    await live.recording.stop();
    app.quit();
  }
}
process.argv.push('--smoke-test');
const entry = require.resolve('../../desktop-smoke');
require.cache[entry] = {
  id: entry,
  filename: entry,
  loaded: true,
  exports: live =>
    run(live).catch(error => {
      console.error(error);
      app.exit(1);
    })
};
require('../../main');
