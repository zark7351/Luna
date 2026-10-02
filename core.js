const {location}=require('./weather');
const defaults = { name: '露娜', nickname: '', top: true, screenshotShortcut:true, soundEnabled:true, weatherLocation:null };
const WINDOW_WIDTH = 280;
const WINDOW_HEIGHT = 640;
const OLD_PET_OFFSET = 387;
const PET_OFFSET = 40;

function validate(input = {}) {
  const s = { ...defaults };
  for (const [key, max] of Object.entries({ name: 24, nickname: 40 })) {
    s[key] = String(input[key] ?? defaults[key]).trim().slice(0, max);
  }
  s.name ||= defaults.name;
  s.top = input.top !== false;
  s.screenshotShortcut = input.screenshotShortcut !== false;
  s.soundEnabled = input.soundEnabled !== false;
  s.weatherLocation=location(input.weatherLocation);
  return s;
}

function migrateState(saved = {}) {
  if (!saved || typeof saved !== 'object') saved = {};
  const state = { settings: validate(saved.settings || {}), layoutVersion: 3 };
  if (Array.isArray(saved.position) && saved.position.length === 2 && saved.position.every(Number.isFinite)) {
    state.position = [saved.position[0] + ([2,3].includes(saved.layoutVersion) ? 0 : OLD_PET_OFFSET - PET_OFFSET), saved.position[1] - (saved.layoutVersion===3?0:90)];
  }
  return state;
}

module.exports = { defaults, validate, migrateState, WINDOW_WIDTH, WINDOW_HEIGHT };
