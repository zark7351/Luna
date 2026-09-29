const defaults = { name: '露娜', nickname: '', top: true };
const WINDOW_WIDTH = 280;
const WINDOW_HEIGHT = 550;
const OLD_PET_OFFSET = 387;
const PET_OFFSET = 40;

function validate(input = {}) {
  const s = { ...defaults };
  for (const [key, max] of Object.entries({ name: 24, nickname: 40 })) {
    s[key] = String(input[key] ?? defaults[key]).trim().slice(0, max);
  }
  s.name ||= defaults.name;
  s.top = input.top !== false;
  return s;
}

function migrateState(saved = {}) {
  if (!saved || typeof saved !== 'object') saved = {};
  const state = { settings: validate(saved.settings || {}), layoutVersion: 2 };
  if (Array.isArray(saved.position) && saved.position.length === 2 && saved.position.every(Number.isFinite)) {
    state.position = [saved.position[0] + (saved.layoutVersion === 2 ? 0 : OLD_PET_OFFSET - PET_OFFSET), saved.position[1]];
  }
  return state;
}

module.exports = { defaults, validate, migrateState, WINDOW_WIDTH, WINDOW_HEIGHT };
