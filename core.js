const path=require('node:path');
const {normalize}=require('./i18n');
const bodyShortcuts=require('./body-shortcuts');
const {location}=require('./weather');
const defaults = { name: '露娜', language:'zh-CN', nickname: '', top: true, pureMode:false, screenshotShortcut:true, soundEnabled:true, bodyShortcuts:bodyShortcuts.defaults,weatherLocation:null, hair:'original', outfit:'original', saveDirectory:'', recordFrameRate:60, recordFormat:'mp4' };
const WINDOW_WIDTH = 280;
const WINDOW_HEIGHT = 640;
const TOOLBAR_WIDTH = 236;
const TOOLBAR_INSET = (WINDOW_WIDTH-TOOLBAR_WIDTH)/2;
const OLD_PET_OFFSET = 387;
const PET_OFFSET = 40;

function validate(input = {}) {
  const s = { ...defaults };
  for (const [key, max] of Object.entries({ name: 24, nickname: 40 })) {
    s[key] = String(input[key] ?? defaults[key]).trim().slice(0, max);
  }
  s.name ||= defaults.name;
  s.language=normalize(input.language);
  s.top = input.top !== false;
  s.pureMode=input.pureMode===true;
  s.screenshotShortcut = input.screenshotShortcut !== false;
  s.soundEnabled = input.soundEnabled !== false;
  s.bodyShortcuts=bodyShortcuts.validate(input.bodyShortcuts);
  s.weatherLocation=location(input.weatherLocation);
  s.hair=['original','straight','bob','twintails'].includes(input.hair)?input.hair:'original';
  s.outfit=['original','jk','secretary','nurse'].includes(input.outfit)?input.outfit:'original';
  s.saveDirectory=typeof input.saveDirectory==='string'&&input.saveDirectory.length<=4096&&path.isAbsolute(input.saveDirectory)?path.resolve(input.saveDirectory):'';
  s.recordFrameRate=[15,24,30,60].includes(input.recordFrameRate)?input.recordFrameRate:60;
  s.recordFormat='mp4';
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

module.exports = { defaults, validate, migrateState, WINDOW_WIDTH, WINDOW_HEIGHT, TOOLBAR_WIDTH, TOOLBAR_INSET };
