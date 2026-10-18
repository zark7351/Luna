const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createCollection, classifyText } = require('../collection');

test('classify links and plain text without treating unsafe schemes as links', () => {
  assert.equal(classifyText('https://example.com/a').kind, 'link');
  assert.equal(classifyText('一段文字').kind, 'text');
  assert.equal(classifyText('javascript:alert(1)').kind, 'text');
  assert.throws(() => classifyText('  '));
});

test('local references persist without copying and removing them preserves original files', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'luna-collection-test-'));
  try {
    const source = path.join(root, 'photo.png');
    await fs.writeFile(source, Buffer.from('fake-image'));
    const collection = await createCollection(path.join(root, 'user-data'));
    const file = await collection.addFile(source);
    const text = await collection.addText('记住这段文字');
    assert.equal(file.kind, 'file');
    assert.equal(collection.list()[0].id, text.id);
    assert.equal(collection.openTarget(file.id).target, source);
    assert.equal(file.storage, 'reference');
    assert.equal('referencePath' in collection.list().find(item => item.id === file.id), false);
    assert.deepEqual(await fs.readdir(path.join(root, 'user-data', 'collection-files')), []);
    const reopened = await createCollection(path.join(root, 'user-data'));
    assert.equal(reopened.list().length, 2);
    await reopened.remove(file.id);
    assert.equal((await fs.readFile(source)).toString(), 'fake-image');
    assert.equal(reopened.list().length, 1);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('legacy copied files remain usable and deletion only removes their copies', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'luna-legacy-copy-test-'));
  try {
    const collection = await createCollection(root);
    const file = await collection.addBytes('old.png', new Uint8Array([1, 2, 3]));
    const indexPath = path.join(root, 'collection.json');
    const index = JSON.parse(await fs.readFile(indexPath, 'utf8'));
    delete index[0].storage;
    await fs.writeFile(indexPath, JSON.stringify(index));
    const reopened = await createCollection(root);
    assert.equal(reopened.list()[0].storage, 'copy');
    const copy = reopened.openTarget(file.id).target;
    assert.deepEqual([...(await fs.readFile(copy))], [1, 2, 3]);
    await reopened.remove(file.id);
    await assert.rejects(fs.stat(copy), { code: 'ENOENT' });
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('virtual image and video files keep their bytes and extension', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'luna-virtual-test-'));
  try {
    const collection = await createCollection(root);
    for (const name of ['图片.png', '视频.mp4']) {
      const bytes = new Uint8Array([0, 1, 2, 255]);
      const item = await collection.addBytes(name, bytes);
      const copy = collection.openTarget(item.id).target;
      assert.equal(item.kind, 'file');
      assert.equal(item.title, name);
      assert.equal(path.extname(copy), path.extname(name));
      assert.deepEqual(await fs.readFile(copy), Buffer.from(bytes));
    }
    await assert.rejects(collection.addBytes('empty.mp4', new Uint8Array()));
    await assert.rejects(collection.addBytes('too-big.mp4', new Uint8Array(64 * 1024 * 1024 + 1)));
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

async function withRoot(name, run) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), name));
  try {
    await run(root);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

test('saving the same text, link or local file again moves it to the top instead of duplicating', () =>
  withRoot('luna-dedupe-test-', async root => {
    const collection = await createCollection(path.join(root, 'data'));
    const first = await collection.addText('https://example.com/a');
    await collection.addText('另一段文字');
    const again = await collection.addText('  https://example.com/a  ');
    assert.equal(again.id, first.id);
    assert.equal(again.duplicate, true);
    assert.equal(collection.list().length, 2);
    assert.equal(collection.list()[0].id, first.id);
    const source = path.join(root, 'Report.TXT');
    await fs.writeFile(source, 'x');
    const file = await collection.addFile(source);
    await collection.addText('最新');
    const variant = process.platform === 'win32' ? path.join(root, 'report.txt') : source;
    const repeat = await collection.addFile(variant);
    assert.equal(repeat.id, file.id);
    assert.equal(collection.list().length, 4);
    assert.equal(collection.list()[0].id, file.id);
  }));

test('pins persist, can be removed, and invalid pin values are dropped on load', () =>
  withRoot('luna-pin-test-', async root => {
    const collection = await createCollection(root);
    const item = await collection.addText('置顶的内容');
    assert.equal(await collection.setPinned(item.id, true), true);
    let reopened = await createCollection(root);
    assert.equal(reopened.list()[0].pinned, true);
    await reopened.setPinned(item.id, false);
    reopened = await createCollection(root);
    assert.equal('pinned' in reopened.list()[0], false);
    const indexPath = path.join(root, 'collection.json');
    const index = JSON.parse(await fs.readFile(indexPath, 'utf8'));
    index[0].pinned = 'yes';
    await fs.writeFile(indexPath, JSON.stringify(index));
    assert.equal('pinned' in (await createCollection(root)).list()[0], false);
    await assert.rejects(reopened.setPinned('missing-id', true));
  }));

test('missing originals are flagged and a reference can be turned into a kept copy', () =>
  withRoot('luna-keep-test-', async root => {
    const collection = await createCollection(path.join(root, 'data'));
    const source = path.join(root, 'photo.png');
    await fs.writeFile(source, Buffer.from('keep-me'));
    const kept = await collection.addFile(source);
    assert.equal(collection.list()[0].missing, undefined);
    assert.equal(await collection.keepCopy(kept.id), true);
    await fs.rm(source);
    const item = collection.list().find(entry => entry.id === kept.id);
    assert.equal(item.storage, 'copy');
    assert.equal(item.missing, undefined);
    const target = collection.openTarget(kept.id).target;
    assert.equal(path.dirname(target), path.join(root, 'data', 'collection-files'));
    assert.equal(path.extname(target), '.png');
    assert.equal((await fs.readFile(target)).toString(), 'keep-me');
    assert.equal(await collection.keepCopy(kept.id), false);
    const other = path.join(root, 'gone.txt');
    await fs.writeFile(other, 'x');
    const lost = await collection.addFile(other);
    await fs.rm(other);
    assert.equal(collection.list().find(entry => entry.id === lost.id).missing, true);
    await assert.rejects(collection.keepCopy(lost.id), /原文件已移动或删除/);
  }));

test('cleanup removes old unpinned items, deletes only Luna copies and keeps originals', () =>
  withRoot('luna-cleanup-test-', async root => {
    const collection = await createCollection(path.join(root, 'data'));
    const source = path.join(root, 'original.txt');
    await fs.writeFile(source, 'original');
    const reference = await collection.addFile(source);
    const copy = await collection.addBytes('截图.png', new Uint8Array([1, 2]));
    const pinned = await collection.addText('长期保留');
    const fresh = await collection.addText('今天的');
    await collection.setPinned(pinned.id, true);
    const copyPath = collection.openTarget(copy.id).target;
    const indexPath = path.join(root, 'data', 'collection.json');
    const old = new Date(Date.now() - 31 * 86400000).toISOString();
    const index = JSON.parse(await fs.readFile(indexPath, 'utf8')).map(item =>
      item.id === fresh.id ? item : { ...item, createdAt: old }
    );
    await fs.writeFile(indexPath, JSON.stringify(index));
    const reopened = await createCollection(path.join(root, 'data'));
    assert.equal(await reopened.cleanup({ dryRun: true }), 2);
    assert.equal(reopened.list().length, 4);
    assert.equal(await reopened.cleanup(), 2);
    assert.deepEqual(
      reopened
        .list()
        .map(item => item.id)
        .sort(),
      [pinned.id, fresh.id].sort()
    );
    await assert.rejects(fs.stat(copyPath), { code: 'ENOENT' });
    assert.equal(await fs.readFile(source, 'utf8'), 'original');
    assert.equal(reference.storage, 'reference');
    await assert.rejects(reopened.cleanup({ days: 0 }), /清理天数无效/);
  }));
