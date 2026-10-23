const test = require('node:test');
const assert = require('node:assert/strict');
const layout = require('../compact-layout');
const area = { x: -1600, y: 40, width: 1600, height: 900 };
test('compact collisions follow the flower on all four edges, including negative display coordinates', () => {
  const topLeft = layout.compact({ x: -9999, y: -9999 }, area);
  assert.equal(topLeft.x + layout.flowerX - 28, area.x);
  assert.equal(topLeft.y + layout.flowerY - 28, area.y);
  const bottomRight = layout.compact({ x: 9999, y: 9999 }, area);
  assert.equal(bottomRight.x + layout.flowerX + 28, area.x + area.width);
  assert.equal(bottomRight.y + layout.flowerY + 28, area.y + area.height);
});
test('wheel stays at the flower center away from edges and fits fully at edges and corners', () => {
  const anchor = { x: -1000, y: 300 };
  const centered = layout.expand(anchor, area, true);
  assert.equal(centered.bounds.x + centered.center.x, anchor.x + layout.flowerX);
  assert.equal(centered.bounds.y + centered.center.y, anchor.y + layout.flowerY);
  for (const x of [-9999, -800, 9999])
    for (const y of [-9999, 400, 9999]) {
      const flower = layout.compact({ x, y }, area);
      const { bounds, center } = layout.expand(flower, area, true);
      const sx = bounds.x + center.x,
        sy = bounds.y + center.y;
      assert.ok(sx - 132 >= area.x && sx + 132 <= area.x + area.width);
      assert.ok(sy - 132 >= area.y && sy + 132 <= area.y + area.height);
      assert.ok(center.y - 132 >= 0 && center.y + 132 <= bounds.height);
      assert.deepEqual(layout.compact(flower, area), flower, 'temporary expansion must not change the compact anchor');
    }
});
