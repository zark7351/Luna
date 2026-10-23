const assert = require('node:assert/strict');
const { nativeImage, screen } = require('electron');

async function check({ screenshot, collection }) {
  const before = new Set(collection.list().map(item => item.id));
  try {
    assert.equal(await screenshot.start(), true);
    const overlays = screenshot.getWindows();
    assert.equal(overlays.length, screen.getAllDisplays().length);
    const checked = [];
    let chosen;
    for (const overlay of overlays) {
      const bounds = overlay.getBounds();
      const display = screen.getDisplayMatching(bounds);
      assert.deepEqual(bounds, display.bounds, 'snapshot window must cover the display, including the taskbar');
      assert.deepEqual(overlay.getContentBounds(), display.bounds, 'invisible window frame changes snapshot size');
      assert.equal(overlay.isFullScreen(), false);
      const view = await overlay.webContents.executeJavaScript(`(async () => {
        const end = Date.now() + 4000;
        while (!ready && Date.now() < end) await new Promise(r => setTimeout(r, 20));
        if (!ready) throw Error('snapshot image not ready');
        const image = document.querySelector('#screen'), box = image.getBoundingClientRect();
        return { width: innerWidth, height: innerHeight,
          image: { x: box.x, y: box.y, width: box.width, height: box.height },
          state: await window.capture.state() };
      })()`);
      assert.equal(view.width, display.bounds.width);
      assert.equal(view.height, display.bounds.height);
      assert.deepEqual(view.image, { x: 0, y: 0, width: view.width, height: view.height });
      const source = nativeImage.createFromDataURL(view.state.image);
      const size = source.getSize();
      assert.ok(Math.abs(size.width / view.width - size.height / view.height) < 0.01, 'snapshot is distorted');
      // Check painted pixels in the bottom strip: the frozen taskbar must stay
      // at its original position, rather than being squeezed above the real one.
      const patch = { x: 32, y: view.height - 24, width: 48, height: 16 };
      const rendered = await overlay.webContents.capturePage(patch);
      const expectedData = await overlay.webContents.executeJavaScript(`(() => {
        const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d');
        canvas.width = ${rendered.getSize().width}; canvas.height = ${rendered.getSize().height};
        ctx.fillStyle = '#221814'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(document.querySelector('#screen'),
          ${(patch.x * size.width) / view.width}, ${(patch.y * size.height) / view.height},
          ${(patch.width * size.width) / view.width}, ${(patch.height * size.height) / view.height},
          0, 0, canvas.width, canvas.height);
        return canvas.toDataURL();
      })()`);
      const expected = nativeImage.createFromDataURL(expectedData);
      const actualPixels = rendered.toBitmap(),
        expectedPixels = expected.toBitmap();
      assert.equal(actualPixels.length, expectedPixels.length);
      for (let i = 0; i < actualPixels.length; i++)
        assert.ok(Math.abs(actualPixels[i] - expectedPixels[i]) <= 3, 'bottom strip moved or scaled');
      checked.push({ bounds, imageSize: size, taskbarAligned: true });
      chosen = { overlay, source, view };
    }
    const { overlay, source, view } = chosen;
    const rect = { x: 32, y: view.height - 88, width: 120, height: 48 };
    overlay.webContents.sendInputEvent({ type: 'mouseDown', x: rect.x, y: rect.y, button: 'left', clickCount: 1 });
    overlay.webContents.sendInputEvent({ type: 'mouseMove', x: rect.x + rect.width, y: rect.y + rect.height });
    overlay.webContents.sendInputEvent({
      type: 'mouseUp',
      x: rect.x + rect.width,
      y: rect.y + rect.height,
      button: 'left',
      clickCount: 1
    });
    const until = Date.now() + 4000;
    let saved;
    while (!(saved = collection.list().find(item => !before.has(item.id))) && Date.now() < until)
      await new Promise(resolve => setTimeout(resolve, 20));
    assert.ok(saved, 'snapshot crop not saved');
    const size = source.getSize(),
      x = Math.floor((rect.x * size.width) / view.width),
      y = Math.floor((rect.y * size.height) / view.height);
    const expected = source.crop({
      x,
      y,
      width: Math.ceil(((rect.x + rect.width) * size.width) / view.width) - x,
      height: Math.ceil(((rect.y + rect.height) * size.height) / view.height) - y
    });
    const actual = nativeImage.createFromPath(collection.openTarget(saved.id).target);
    assert.deepEqual(actual.getSize(), expected.getSize());
    assert.deepEqual(actual.toBitmap(), expected.toBitmap(), 'selected pixels differ from the displayed snapshot');
    assert.equal(screenshot.isActive(), false);
    return { displays: checked, bottomCropMatches: true };
  } finally {
    screenshot.cancel();
  }
}
module.exports = { check };
