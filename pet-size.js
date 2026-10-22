// Shared size limits: only the portrait changes size; panels and controls keep their normal scale.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.claudePetSize = factory();
})(globalThis, () => {
  const min = 0.6,
    max = 1.8,
    step = 0.1;
  function normalize(value) {
    return typeof value === 'number' && Number.isFinite(value)
      ? Math.round(Math.max(min, Math.min(max, value)) * 100) / 100
      : 1;
  }
  const next = (value, delta) => normalize(normalize(value) + (delta < 0 ? step : delta > 0 ? -step : 0));
  const windowWidth = value => Math.max(280, Math.ceil(256 * normalize(value) + 24));
  return Object.freeze({ min, max, step, normalize, next, windowWidth });
});
