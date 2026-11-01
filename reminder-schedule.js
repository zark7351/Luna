(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.claudieSchedule = factory();
})(typeof window === 'object' ? window : globalThis, () => {
  function normalize(rule) {
    if (rule == null) return null;

    if (
      !rule ||
      !['daily', 'weekly'].includes(rule.kind) ||
      typeof rule.time !== 'string' ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(rule.time)
    )
      throw Error('重复提醒规则无效。');

    const result = { kind: rule.kind, time: rule.time };

    if (rule.kind === 'weekly') {
      if (
        !Array.isArray(rule.days) ||
        !rule.days.length ||
        rule.days.length > 7 ||
        rule.days.some(day => !Number.isInteger(day) || day < 0 || day > 6)
      )
        throw Error('请至少选择一个星期。');

      result.days = [...new Set(rule.days)].sort();
    }

    return result;
  }

  function nextOccurrence(rule, after) {
    const normalized = normalize(rule);

    if (!normalized || !Number.isFinite(after)) throw Error('重复提醒规则无效。');

    const [hour, minute] = normalized.time.split(':').map(Number);

    const date = new Date(after);

    date.setHours(12, 0, 0, 0);

    for (let i = 0; i < 370; i++, date.setDate(date.getDate() + 1)) {
      const candidate = new Date(date);

      candidate.setHours(hour, minute, 0, 0);

      if (candidate.getTime() <= after) continue;

      // A nonexistent local wall time (DST) is skipped rather than silently shifted.

      if (candidate.getHours() !== hour || candidate.getMinutes() !== minute) continue;

      const matches =
        normalized.kind === 'daily' || (normalized.kind === 'weekly' && normalized.days.includes(candidate.getDay()));

      if (matches) return candidate.getTime();
    }

    throw Error('重复提醒规则无效。');
  }

  return Object.freeze({ normalize, nextOccurrence });
});
