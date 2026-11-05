// Deterministic clock for this authoring page only. The shipped app is untouched.
window.promoTime = 0;
const promoTimers = new Map();
let nextPromoTimer = 1;
Object.defineProperty(performance, 'now', { value: () => window.promoTime });
window.requestAnimationFrame = () => 1;
window.cancelAnimationFrame = () => {};
window.setTimeout = (callback, delay = 0) => {
  const id = nextPromoTimer++;
  promoTimers.set(id, { callback, at: window.promoTime + delay });
  return id;
};
window.clearTimeout = id => promoTimers.delete(id);
window.advancePromoClock = milliseconds => {
  window.promoTime = milliseconds;
  for (const [id, timer] of promoTimers) {
    if (timer.at <= milliseconds) {
      promoTimers.delete(id);
      timer.callback();
    }
  }
};
