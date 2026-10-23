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
  onReturn = () => {},
  threshold = IDLE_SECONDS,
  interval = 2000,
  schedule = setInterval,
  cancel = clearInterval
}) {
  let sleeping = false,
    windowKey = null,
    wokeAt = null,
    awaySeconds = 0,
    stopped = false;
  const powerAway = new Set();
  let powerAwayAt = null;
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
    let idleSeconds;
    try {
      idleSeconds = readIdleSeconds();
    } catch {}
    if (Number.isFinite(idleSeconds) && idleSeconds >= 0) {
      if (!powerAway.size && awaySeconds >= threshold && idleSeconds < threshold) {
        const elapsed = awaySeconds;
        awaySeconds = 0;
        onReturn(elapsed);
      }
      awaySeconds = Math.max(awaySeconds, idleSeconds);
    }
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
    // A reminder/click can wake without resetting the operating system's idle clock.
    const sinceWake = wokeAt === null ? 0 : Math.max(0, (time - wokeAt) / 1000);
    const idle = Number.isFinite(idleSeconds) && idleSeconds >= 0 ? Math.min(idleSeconds, sinceWake) : 0;
    publish(idle >= threshold, force);
  }
  // Locking outside the sleep windows does not put her to bed.
  const powerChange = (kind, active) => () => {
    if (active) {
      if (!powerAway.size) powerAwayAt = now().getTime();
      powerAway.add(kind);
    } else {
      powerAway.delete(kind);
      if (!powerAway.size && powerAwayAt !== null) {
        awaySeconds = Math.max(awaySeconds, Math.max(0, (now().getTime() - powerAwayAt) / 1000));
        powerAwayAt = null;
      }
    }
    check();
  };
  const handlers = {
    'lock-screen': powerChange('lock', true),
    'unlock-screen': powerChange('lock', false),
    suspend: powerChange('suspend', true),
    resume: powerChange('suspend', false)
  };
  for (const [event, handler] of Object.entries(handlers)) powerMonitor.on(event, handler);
  const timer = schedule(() => check(), interval);
  return {
    check,
    wake: () => check(false, true),
    isSleeping: () => sleeping,
    stop: () => {
      if (stopped) return;
      stopped = true;
      cancel(timer);
      for (const [event, handler] of Object.entries(handlers)) powerMonitor.removeListener(event, handler);
    }
  };
}
module.exports = { startIdleMonitor, sleepWindow, IDLE_SECONDS };
