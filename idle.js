const IDLE_SECONDS = 5 * 60;
// Local wall-clock windows. The night keeps one identity across midnight.
function sleepWindow(date) {
  const minutes = date.getHours() * 60 + date.getMinutes();
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  let kind;
  if (minutes >= 22 * 60 || minutes < 7 * 60) {
    kind = 'night';
    if (minutes < 7 * 60) day.setDate(day.getDate() - 1);
  } else if (minutes >= 12 * 60 + 30 && minutes < 14 * 60) kind = 'noon';
  else return null;
  return `${day.getFullYear()}-${day.getMonth() + 1}-${day.getDate()}/${kind}`;
}
function startIdleMonitor({
  powerMonitor,
  readIdleSeconds = () => powerMonitor.getSystemIdleTime(),
  getWindow,
  now = () => new Date(),
  canSleep = () => true,
  threshold = IDLE_SECONDS,
  interval = 2000,
  schedule = setInterval,
  cancel = clearInterval
}) {
  let sleeping = false,
    windowKey = null,
    wokeAt = null,
    stopped = false;
  function publish(next, force = false) {
    const changed = next !== sleeping;
    sleeping = next;
    if (!changed && !force) return;
    const window = getWindow();
    if (!window || window.isDestroyed() || window.webContents.isDestroyed?.()) return;
    window.webContents.send('idle-changed', sleeping);
  }
  function check(force = false, wake = false) {
    if (stopped) return;
    const date = now(),
      time = date.getTime(),
      key = sleepWindow(date);
    if (!Number.isFinite(time)) return;
    const entered = key !== windowKey;
    windowKey = key;
    if (!key) {
      wokeAt = null;
      publish(false, force);
      return;
    }
    if (wake || !canSleep()) {
      wokeAt = time;
      publish(false, force);
      return;
    }
    // Arrival/startup in a sleep window sleeps immediately, regardless of computer activity.
    if (entered) {
      wokeAt = null;
      publish(true, force);
      return;
    }
    if (sleeping) {
      publish(true, force);
      return;
    }
    let idleSeconds;
    try {
      idleSeconds = readIdleSeconds();
    } catch {}
    // A reminder/click can wake without resetting the operating system's idle clock.
    const sinceWake = wokeAt === null ? 0 : Math.max(0, (time - wokeAt) / 1000);
    const idle = Number.isFinite(idleSeconds) && idleSeconds >= 0 ? Math.min(idleSeconds, sinceWake) : 0;
    publish(idle >= threshold, force);
  }
  // Locking outside the sleep windows does not put her to bed.
  const events = ['lock-screen', 'unlock-screen', 'suspend', 'resume'];
  const onPower = () => check();
  for (const event of events) powerMonitor.on(event, onPower);
  const timer = schedule(() => check(), interval);
  return {
    check,
    wake: () => check(false, true),
    isSleeping: () => sleeping,
    stop: () => {
      if (stopped) return;
      stopped = true;
      cancel(timer);
      for (const event of events) powerMonitor.removeListener(event, onPower);
    }
  };
}
module.exports = { startIdleMonitor, sleepWindow, IDLE_SECONDS };
