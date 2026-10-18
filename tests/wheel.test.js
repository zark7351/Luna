const test = require('node:test');
const assert = require('node:assert/strict');
const { sectorPath, iconPosition, SIZE, OUTER, INNER } = require('../wheel');

test('sector paths are closed rounded ring segments inside the wheel', () => {
  for (let index = 0; index < 10; index++) {
    const d = sectorPath(index, 10);
    assert.match(d, /^M .* Z$/);
    assert.equal((d.match(/ A /g) || []).length, 2);
    assert.equal((d.match(/ Q /g) || []).length, 4);
    const numbers = d
      .replace(/[MQALZ]/g, ' ')
      .trim()
      .split(/\s+/)
      .map(Number);
    assert.ok(numbers.every(n => Number.isFinite(n) && n >= 0 && n <= SIZE));
  }
});

test('icons sit midway in the ring, starting at the top and going clockwise', () => {
  const middle = (OUTER + INNER) / 2;
  assert.deepEqual(iconPosition(0, 10), [SIZE / 2, SIZE / 2 - middle]);
  const [x, y] = iconPosition(1, 10);
  assert.ok(x > SIZE / 2 && y < SIZE / 2);
  assert.deepEqual(iconPosition(5, 10), [SIZE / 2, SIZE / 2 + middle]);
});
