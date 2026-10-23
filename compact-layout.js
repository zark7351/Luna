// Shared DIP geometry. The transparent margins must not act as the flower's collision box.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.claudexCompact = factory();
})(globalThis, () => {
  const width = 280,
    height = 128,
    flowerSize = 56,
    flowerX = 140,
    flowerY = 79;
  const inset = (width - flowerSize) / 2;
  const verticalInsets = { top: flowerY - flowerSize / 2, bottom: height - flowerY - flowerSize / 2 };
  const clamp = (value, min, max) => Math.max(min, Math.min(value, Math.max(min, max)));
  function compact(anchor, area) {
    return {
      x: Math.round(clamp(anchor.x, area.x - inset, area.x + area.width - width + inset)),
      y: Math.round(
        clamp(anchor.y, area.y - verticalInsets.top, area.y + area.height - height + verticalInsets.bottom)
      ),
      width,
      height
    };
  }
  function expand(anchor, area, wheel = false) {
    const center = { x: anchor.x + flowerX, y: anchor.y + flowerY };
    if (wheel) {
      center.x = clamp(center.x, area.x + 140, area.x + area.width - 140);
      center.y = clamp(center.y, area.y + 140, area.y + area.height - 140);
    }
    const bounds = {
      x: Math.round(clamp(center.x - width / 2, area.x, area.x + area.width - width)),
      y: Math.round(clamp(wheel ? center.y - 320 : anchor.y + height - 640, area.y, area.y + area.height - 640)),
      width,
      height: 640
    };
    return { bounds, center: { x: center.x - bounds.x, y: center.y - bounds.y } };
  }
  return { width, height, flowerSize, flowerX, flowerY, inset, verticalInsets, compact, expand };
});
