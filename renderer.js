const t = window.lunaI18n.t;
const $ = id => document.getElementById(id);
window.lunaCharacter = createLunaCharacter($('pet'));
let wheel = null,
  angerInteraction = null,
  heldReminder = null,
  returnSpeechUntil = 0;
let settings,
  sleeping = false,
  happyTimer,
  dragStart,
  dragging = false,
  ignore = false,
  edgeState = { side: null, collapsed: false },
  viewStopped = false,
  lastDockHold,
  lastDockPanels,
  lastPureLayout;
const api = async (name, payload) => {
  const r = await window.pet.call(name, payload);
  if (!r.ok) throw Error(t(r.error));
  return r.value;
};
function applySettings(value) {
  settings = value;
  document.body.classList.toggle('pure-mode', value.pureMode);
  lastPureLayout = undefined;
  if (value.pureMode) showControls();
  syncDockHold();
  $('pet').removeAttribute('title');
  window.lunaI18n.setLanguage(value.language);
  life?.setEnabled(value.companion !== false && !lifePaused);
}
function syncDockHold() {
  if (viewStopped) return;
  const expanded =
    $('help').open ||
    ['settings', 'wardrobe', 'library-sheet', 'recording-sheet', 'reminder-sheet'].some(id => !$(id).hidden);
  if (settings?.pureMode && expanded !== lastPureLayout) {
    lastPureLayout = expanded;
    api('pure-layout', expanded).catch(() => {});
  }
  const held = !!dragStart || expanded || wheel?.isOpen || $('bubble').classList.contains('reminder-alert');
  if (held !== lastDockHold || expanded !== lastDockPanels) {
    lastDockHold = held;
    lastDockPanels = expanded;
    window.pet.edgeHold(held, expanded);
  }
}
function applyEdgeDock(value) {
  if (viewStopped) return;
  edgeState = value;
  document.body.dataset.edgeCollapsed = value.collapsed ? value.side : '';
  const button = $('edge-expand');
  button.title = t('展开露娜');
  button.setAttribute('aria-label', button.title);
  button.querySelector('path').setAttribute('d', value.side === 'right' ? 'm15 6-6 6 6 6' : 'm9 6 6 6-6 6');
  if (value.collapsed) {
    ignore = false;
    window.pet.passthrough(false);
    showControls();
  }
  syncDockHold();
}
window.pet.onSettingsChanged(value => {
  if (!viewStopped) applySettings(value);
});
window.pet.onEdgeDockChanged(applyEdgeDock);
function appearance(node, hair, outfit) {
  const look = window.lunaCharacterAssets.getLook(hair, outfit);
  node.dataset.hair = hair;
  node.dataset.outfit = outfit;
  if (node.id === 'pet') return window.lunaCharacter.setLook(hair, outfit);
  window.lunaCharacterAssets.applyBody(node, look);
}
function wardrobeTab(name, focus = false) {
  if (focus && $('wardrobe-tab-' + name).getAttribute('aria-selected') !== 'true') window.uiSound('tab');
  for (const group of ['hair', 'outfit']) {
    const tab = $('wardrobe-tab-' + group),
      active = group === name;
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
    $(group + '-items').hidden = !active;
  }
  if (focus) $('wardrobe-tab-' + name).focus();
}
for (const group of ['hair', 'outfit']) {
  const tab = $('wardrobe-tab-' + group);
  tab.onclick = () => wardrobeTab(group, true);
  tab.onkeydown = event => {
    if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      wardrobeTab(
        event.key === 'Home' ? 'hair' : event.key === 'End' ? 'outfit' : group === 'hair' ? 'outfit' : 'hair',
        true
      );
    }
  };
}
function previewLook() {
  const hair = $('hair').value,
    outfit = $('outfit').value;
  appearance($('look-preview'), hair, outfit);
  window.lunaEffects.pulse($('look-preview'), 'reveal');
  for (const card of document.querySelectorAll('.look-card')) {
    const group = card.dataset.group,
      value = card.dataset.choice;
    card.setAttribute('aria-pressed', String($(group).value === value));
  }
}
for (const card of document.querySelectorAll('.look-card'))
  card.onclick = () => {
    $(card.dataset.group).value = card.dataset.choice;
    previewLook();
  };
$('hair').onchange = previewLook;
$('outfit').onchange = previewLook;
let completingReminder = false;
let lastFeedback = '';
const feedback = createPetFeedback({
  translate: t,
  render: value => {
    const bubble = $('bubble'),
      body = $('bubble-body'),
      complete = $('bubble-complete'),
      wasHidden = bubble.hidden;
    $('bubble-message').textContent = value.message;
    bubble.hidden = !value.message;
    bubble.classList.toggle('reminder-alert', !!value.reminder);
    complete.hidden = !value.reminder;
    complete.disabled = completingReminder || !value.reminder;
    const feedbackKey = (value.reminder?.id || '') + value.message;
    if (value.message && wasHidden && feedbackKey !== lastFeedback) window.lunaEffects.pulse(bubble, 'reveal');
    lastFeedback = feedbackKey;
    body.title = value.reminder ? t('打开提醒') : value.hasNext ? t('点击查看下一条') : t('点击关闭');
    body.setAttribute(
      'aria-label',
      value.reminder
        ? t('打开提醒：') + value.reminder.title
        : (value.hasNext ? t('下一条消息：') : t('关闭消息：')) + value.message
    );
    complete.title = value.reminder ? t('完成提醒：') + value.reminder.title : t('完成提醒');
    complete.setAttribute('aria-label', complete.title);
    syncDockHold();
  }
});
const infoBubbles = createShortcutBubbles({
  language: () => window.lunaI18n.language,
  translate: t,
  show: (text, delay) => feedback.show(text, delay),
  update: text => feedback.update(text),
  requestStats: () => api('system-stats'),
  requestWeather: () => api('weather-current')
});
const showMessage = (text, delay) => {
  if (angerInteraction?.protected) return false;
  infoBubbles.cancel();
  return feedback.show(text, delay);
};
let life = null,
  lifeTimer = null,
  lifeSaveTimer = null,
  lifePaused = false;
function panelsOpen() {
  return (
    $('help').open ||
    ['settings', 'wardrobe', 'library-sheet', 'recording-sheet', 'reminder-sheet'].some(id => !$(id).hidden)
  );
}
// Proactive lines wait for a quiet moment: no bubble, panel, reminder, drag or protected anger sequence.
function lifeCanSpeak() {
  return (
    !viewStopped &&
    !sleeping &&
    !wheel?.isOpen &&
    document.visibilityState === 'visible' &&
    !edgeState.collapsed &&
    !settings?.pureMode &&
    !dragStart &&
    !dropDepth &&
    !document.body.inert &&
    !angerInteraction?.protected &&
    !feedback.getReminder() &&
    !feedback.getMessage() &&
    !infoBubbles.active &&
    !panelsOpen()
  );
}
function lifeSay(text, expression) {
  if (viewStopped || settings?.pureMode || !showMessage(text, 5200)) return false;
  window.lunaCharacter.react(expression);
  return true;
}
function startLife(memory) {
  life = window.lunaLife.createLife({
    say: lifeSay,
    canSpeak: lifeCanSpeak,
    translate: t,
    name: () => settings?.name || '露娜',
    nickname: () => settings?.nickname || '',
    separator: () => (window.lunaI18n.language === 'en' ? ', ' : '，'),
    load: () => memory,
    save: value => {
      clearTimeout(lifeSaveTimer);
      lifeSaveTimer = setTimeout(() => {
        lifeSaveTimer = null;
        api('life-memory', value).catch(() => {});
      }, 1000);
    }
  });
  if (sleeping) life.sleep();
  life.setEnabled(settings?.companion !== false && !lifePaused);
  lifeTimer = setInterval(() => life.tick(), 30000);
  setTimeout(() => !viewStopped && life.tick(), 3000);
}
$('bubble').onclick = () => {
  if (feedback.getReminder())
    api('reminder-show').catch(error => {
      $('bubble-body').title = error.message;
    });
  else {
    infoBubbles.cancel();
    feedback.advance();
  }
};
$('bubble-complete').onclick = async event => {
  event.stopPropagation();
  const reminder = feedback.getReminder();
  if (!reminder || completingReminder) return;
  completingReminder = true;
  $('bubble-complete').disabled = true;
  try {
    await api('reminder-complete', reminder.id);
    showMessage(t('提醒完成啦。'));
  } catch (error) {
    $('bubble-complete').title = error.message;
  } finally {
    completingReminder = false;
    $('bubble-complete').disabled = !feedback.getReminder();
  }
};
let controlsTimer = null;
function overControls(x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  const pet = $('pet').getBoundingClientRect(),
    bar = document.querySelector('.petbar').getBoundingClientRect();
  const inside = box => x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
  // Hidden controls still have a layout box. Include the gap so crossing it never enables click-through.
  if (settings?.pureMode) return inside(bar);
  return (
    inside(pet) ||
    inside({
      left: Math.min(pet.left, bar.left) - 6,
      right: Math.max(pet.right, bar.right) + 6,
      top: Math.min(pet.bottom, bar.top) - 8,
      bottom: bar.bottom + 8
    })
  );
}
function showControls() {
  clearTimeout(controlsTimer);
  controlsTimer = null;
  $('companion').classList.add('controls-visible');
  document.querySelector('.petbar').setAttribute('aria-hidden', 'false');
}
function hideControls() {
  clearTimeout(controlsTimer);
  controlsTimer = null;
  if (edgeState.collapsed || settings?.pureMode) return;
  $('companion').classList.remove('controls-visible');
  document.querySelector('.petbar').setAttribute('aria-hidden', 'true');
}
function leaveControls() {
  if (controlsTimer === null) controlsTimer = setTimeout(hideControls, 350);
}
const dockObserver = new MutationObserver(syncDockHold);
for (const id of ['help', 'settings', 'wardrobe', 'library-sheet', 'recording-sheet', 'reminder-sheet'])
  dockObserver.observe($(id), { attributes: true, attributeFilter: ['hidden', 'open'] });
window.addEventListener('pagehide', () => {
  viewStopped = true;
  angerInteraction.stop();
  dockObserver.disconnect();
  infoBubbles.stop();
  feedback.stop();
  clearTimeout(controlsTimer);
  clearInterval(lifeTimer);
  if (lifeSaveTimer !== null) {
    clearTimeout(lifeSaveTimer);
    api('life-memory', life.memory()).catch(() => {});
  }
});
function happy(text) {
  if (sleeping) return;
  window.lunaCharacter.react(['wink', 'smile', 'shy'][Math.floor(Math.random() * 3)]);
  showMessage(text);
  clearTimeout(happyTimer);
  $('pet').classList.remove('blink');
  $('pet').classList.add('happy');
  happyTimer = setTimeout(() => $('pet').classList.remove('happy'), 1900);
}
function droppedText(data) {
  const uri = data
    .getData('text/uri-list')
    .split(/\r?\n/)
    .find(line => line && !line.startsWith('#'));
  return (uri || data.getData('text/plain') || '').trim();
}

$('recording-button').onclick = () => api('recording-show').catch(error => showMessage(error.message));
$('storage-choose').onclick = async () => {
  try {
    const directory = await api('storage-choose');
    if (directory) $('save-directory').value = directory;
  } catch (error) {
    $('settings-status').textContent = error.message;
  }
};
$('storage-reset').onclick = () => {
  $('save-directory').value = '';
};
$('screenshot-button').onclick = async () => {
  try {
    await api('screenshot-start');
  } catch (e) {
    showMessage(e.message);
  }
};
window.pet.onScreenshotMessage(value => {
  showMessage(value.message);
});
function shortcutHint(status) {
  $('screenshot-button').title = status.enabled
    ? status.available
      ? t('截图收藏 · Ctrl+Alt+A')
      : t('截图收藏 · 快捷键被占用，请点击图标')
    : t('截图收藏 · 快捷键已关闭');
}
window.pet.onScreenshotShortcutChanged(shortcutHint);
api('screenshot-shortcut')
  .then(shortcutHint)
  .catch(() => {});
$('reminder-button').onclick = async () => {
  try {
    await api('reminder-show');
  } catch (error) {
    showMessage(error.message);
  }
};
function reminderCount(count) {
  $('reminder-button').classList.toggle('has-reminders', count > 0);
  $('reminder-button').title = count ? t('提醒 · ') + count + t(' 条待处理') : t('提醒');
}
window.pet.onReminderCount(reminderCount);
const sounds = { reminder: new Audio('assets/reminder.wav') };
sounds.reminder.volume = 0.65;
for (const name of [
  'click',
  'tab',
  'select',
  'toggle',
  'open',
  'close',
  'save',
  'collect',
  'copy',
  'delete',
  'refresh',
  'error',
  'capture-start',
  'capture-done',
  'capture-cancel',
  'complete',
  'snooze'
]) {
  sounds[name] = new Audio('assets/sounds/' + name + '.wav');
  sounds[name].volume = 0.65;
}
window.pet.onSound(name => {
  const sound = sounds[name];
  if (!sound) return;
  sound.currentTime = 0;
  sound.play().catch(error => console.warn(t('提示音播放失败'), error.message));
});
window.pet.onEffect(name => {
  life?.note(name);
  window.lunaEffects.burst(name);
  const buttons = {
    collect: 'library-button',
    capture: 'screenshot-button',
    recording: 'recording-button',
    wardrobe: 'wardrobe-button',
    'reminder-save': 'reminder-button',
    complete: 'reminder-button'
  };
  if (buttons[name]) window.lunaEffects.pulse($(buttons[name]), 'select');
});
window.pet.onReminderDue(value => {
  if (angerInteraction?.protected || Date.now() < returnSpeechUntil) {
    heldReminder = value;
    return;
  }
  infoBubbles.cancel();
  if (value) {
    rest(false);
    if (feedback.getReminder()?.id !== value.id) window.lunaEffects.burst('reminder');
  } else {
    sounds.reminder.pause();
    sounds.reminder.currentTime = 0;
  }
  feedback.updateReminder(value);
});
api('reminder-list')
  .then(items => {
    reminderCount(items.filter(item => item.status !== 'done').length);
    const due = items.filter(item => item.status === 'fired');
    if (due.length) {
      window.lunaEffects.burst('reminder');
      feedback.updateReminder({ id: due[0].id, title: due[0].title, remaining: due.length });
    }
  })
  .catch(() => {});
$('edge-expand').onclick = () => api('edge-expand').catch(error => showMessage(error.message));
$('hide').onclick = () => api('hide').catch(error => showMessage(error.message));
$('library-button').onclick = () => openSheet('library');
function rest(value) {
  if (angerInteraction?.protected) return;
  if (sleeping === value) return;
  sleeping = value;
  clearTimeout(happyTimer);
  window.lunaCharacter.cancel();
  $('pet').classList.toggle('sleeping', sleeping);
  $('pet').classList.remove('happy', 'blink');
  // The companion engine varies these lines (greeting, time away); without it keep the original two.
  const line = life ? (sleeping ? life.sleep() : life.wake()) : null;
  if (dropDepth) return;
  if (!line) showMessage(sleeping ? t('你先忙，我小憩一下。') : t('你回来啦。'));
  else if (showMessage(line.text, 5200) && !sleeping) window.lunaCharacter.react(line.expression);
}
window.pet.onIdleChanged(rest);
function openHelp() {
  closeSheets();
  $('settings').hidden = true;
  $('wardrobe').hidden = true;
  if (!$('help').open) {
    $('help').showModal();
    window.uiSound('open');
    ignore = false;
    window.pet.passthrough(false);
  }
}
$('help-close').onclick = () => {
  $('help').close();
  window.uiSound('close');
};
$('help').addEventListener('cancel', () => window.uiSound('close'));
$('settings-help').onclick = openHelp;
async function openSettings() {
  cancelInfo();
  closeSheets();
  $('wardrobe').hidden = true;
  if ($('help').open) $('help').close();
  ignore = false;
  window.pet.passthrough(false);
  try {
    const state = await api('state');
    applySettings(state.settings);
    for (const k of ['name', 'nickname']) $(k).value = settings[k];
    $('language').value = settings.language;
    $('top').checked = settings.top;
    $('pure-mode').checked = settings.pureMode;
    $('companion-enabled').checked = settings.companion !== false;
    $('screenshot-shortcut').checked = settings.screenshotShortcut;
    $('sound-enabled').checked = settings.soundEnabled;
    bodyDraft = window.lunaBodyShortcuts.validate(settings.bodyShortcuts);
    renderBodySettings();
    window.lunaWeather.fill(settings.weatherLocation);
    $('record-frame-rate').value = String(settings.recordFrameRate);
    $('save-directory').value = settings.saveDirectory;
    $('save-directory').placeholder = state.fileDirectory;
    $('save-directory').title = state.fileDirectory;
    $('settings-status').textContent = '';
    $('settings').hidden = false;
    window.uiSound('open');
  } catch (e) {
    showMessage(e.message);
  }
}
function closeSheets() {
  for (const name of ['library', 'recording', 'reminder']) $(name + '-sheet').hidden = true;
}
function openSheet(name) {
  cancelInfo();
  if ($('help').open) $('help').close();
  $('settings').hidden = true;
  $('wardrobe').hidden = true;
  closeSheets();
  ignore = false;
  window.pet.passthrough(false);
  $(name + '-sheet').hidden = false;
  showControls();
  window.uiSound('open');
  if (['library', 'reminder'].includes(name)) $(name + '-frame').contentWindow.refresh?.();
}
function closeSheet(name) {
  $(name + '-sheet').hidden = true;
  window.uiSound('close');
}
function hoverSheet() {
  if (ignore) {
    ignore = false;
    window.pet.passthrough(false);
  }
  showControls();
}
async function focusSheet() {
  hoverSheet();
  return api('panel-focus');
}
window.lunaPanels = { openSettings, openHelp, openSheet, closeSheet, hoverSheet, focusSheet };
window.pet.onPanel(name => {
  if (name === 'settings') openSettings();
  else if (name === 'help') openHelp();
  else if (['library', 'recording', 'reminder'].includes(name)) openSheet(name);
});
$('toolbar-settings').onclick = openSettings;
$('settings-close').onclick = () => {
  $('settings').hidden = true;
  window.uiSound('close');
};
async function openWardrobe() {
  closeSheets();
  if ($('help').open) $('help').close();
  $('settings').hidden = true;
  ignore = false;
  window.pet.passthrough(false);
  try {
    const state = await api('state');
    $('hair').value = state.settings.hair;
    $('outfit').value = state.settings.outfit;
    previewLook();
    wardrobeTab('hair');
    $('wardrobe-status').textContent = '';
    $('wardrobe').hidden = false;
    window.uiSound('open');
  } catch (error) {
    showMessage(error.message);
  }
}
$('wardrobe-button').onclick = openWardrobe;
$('wardrobe-close').onclick = () => {
  $('wardrobe').hidden = true;
  window.uiSound('close');
};
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !$('wardrobe').hidden) {
    $('wardrobe').hidden = true;
    window.uiSound('close');
  }
});
$('wardrobe-form').onsubmit = async event => {
  event.preventDefault();
  const save = $('wardrobe-form').querySelector('button[type=submit]');
  save.disabled = true;
  try {
    const state = await api('appearance', { hair: $('hair').value, outfit: $('outfit').value });
    settings = state.settings;
    await appearance($('pet'), settings.hair, settings.outfit);
    window.lunaCharacter.react('wardrobe');
    $('wardrobe').hidden = true;
    showMessage(t('换好啦。'));
  } catch (error) {
    $('wardrobe-status').textContent = error.message;
  } finally {
    save.disabled = false;
  }
};
$('settings-form').onsubmit = async e => {
  e.preventDefault();
  const input = {
    language: $('language').value,
    name: $('name').value,
    nickname: $('nickname').value,
    top: $('top').checked,
    pureMode: $('pure-mode').checked,
    companion: $('companion-enabled').checked,
    screenshotShortcut: $('screenshot-shortcut').checked,
    soundEnabled: $('sound-enabled').checked,
    bodyShortcuts: bodyDraft,
    weatherLocation: window.lunaWeather.getLocation(),
    saveDirectory: $('save-directory').value,
    recordFrameRate: Number($('record-frame-rate').value)
  };
  try {
    const state = await api('settings', input);
    applySettings(state.settings);
    appearance($('pet'), settings.hair, settings.outfit);
    document.title = settings.name + t(' · 桌面宠物');
    $('settings').hidden = true;
    showMessage(t('好，我记住你的设置啦。'));
  } catch (err) {
    $('settings-status').textContent = err.message;
  }
};
let bodyDraft = window.lunaBodyShortcuts.validate(),
  selectedRegion = 'head';
const bodyReactions = window.lunaBodyShortcuts.createReactions();
function renderBodySettings() {
  for (const button of $('body-region-tabs').children) {
    button.setAttribute('aria-pressed', String(button.dataset.region === selectedRegion));
    button.textContent = t(window.lunaBodyShortcuts.regions[button.dataset.region]);
    button.title = t(window.lunaBodyShortcuts.actions[bodyDraft[button.dataset.region]]?.label || '仅表情');
  }
  for (const button of $('body-action-grid').children) {
    const text = t(window.lunaBodyShortcuts.actions[button.dataset.action].label);
    button.title = text + (bodyDraft[selectedRegion] === button.dataset.action ? t('（再次点击取消）') : '');
    button.querySelector('span').textContent = text;
    button.setAttribute('aria-pressed', String(bodyDraft[selectedRegion] === button.dataset.action));
  }
}
for (const [region, label] of Object.entries(window.lunaBodyShortcuts.regions)) {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.region = region;
  button.dataset.uiSound = 'none';
  button.textContent = t(label);
  button.onclick = () => {
    selectedRegion = region;
    renderBodySettings();
    window.uiSound('tab');
  };
  $('body-region-tabs').append(button);
}
for (const [action, value] of Object.entries(window.lunaBodyShortcuts.actions)) {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.action = action;
  button.dataset.uiSound = 'none';
  button.title = t(value.label);
  button.append(window.lunaIcons.create(value.icon));
  const label = document.createElement('span');
  label.textContent = t(value.label);
  button.append(label);
  button.onclick = () => {
    bodyDraft[selectedRegion] = bodyDraft[selectedRegion] === action ? '' : action;
    renderBodySettings();
    window.uiSound('select');
  };
  $('body-action-grid').append(button);
}
renderBodySettings();
angerInteraction = window.createAngerInteraction({
  onStage: stage => {
    if (viewStopped) return;
    if (stage === 'angry' || stage === 'furious') {
      cancelInfo();
      heldReminder = feedback.getReminder() || heldReminder;
      feedback.updateReminder(null);
      sounds.reminder.pause();
      window.lunaCharacter.react(stage);
      clearTimeout(happyTimer);
      $('pet').classList.remove('happy');
      feedback.show(t(stage === 'angry' ? '哼，别一直戳这里啦。' : '你个变态！不理你了！'), 3100);
      document.body.inert = stage === 'furious';
      api('anger-mode', stage).catch(() => {});
    } else if (stage === 'absent') {
      document.body.inert = true;
      api('anger-hide').catch(() => angerInteraction.returned());
    } else if (stage === 'returned') {
      document.body.inert = false;
      bodyReactions.reset();
      window.lunaCharacter.cancel();
      window.lunaCharacter.react('happy');
      returnSpeechUntil = Date.now() + 4500;
      feedback.show(t('嘿嘿，我回来啦～'), 4500);
      setTimeout(() => {
        if (!viewStopped && !angerInteraction.protected && heldReminder) {
          feedback.updateReminder(heldReminder);
          heldReminder = null;
        }
      }, 4500);
    } else {
      document.body.inert = false;
      if (heldReminder) {
        feedback.updateReminder(heldReminder);
        heldReminder = null;
      }
      api('anger-mode', 'normal').catch(() => {});
    }
  }
});
window.pet.onAbsence(value => {
  if (!value) angerInteraction.returned();
});
// Keep the protected dialogue visible; only body clicks can add to the escalation counter.
document.addEventListener(
  'click',
  event => {
    if (angerInteraction.protected && !event.target.closest('#pet')) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  },
  true
);
function cancelInfo() {
  if (infoBubbles.active) {
    infoBubbles.cancel();
    feedback.show('');
  }
}
async function performBodyShortcut(region) {
  // Let the short angry reaction finish instead of replacing it on the next click.
  if (angerInteraction.click(region)) return;
  if (viewStopped || !region) return;
  rest(false);
  cancelInfo();
  const reaction = bodyReactions.click(region);
  window.lunaCharacter.react(reaction.expression);
  clearTimeout(happyTimer);
  $('pet').classList.add('happy');
  happyTimer = setTimeout(() => $('pet').classList.remove('happy'), 1900);
  if (reaction.annoyed) {
    angerInteraction.trigger();
    return;
  }
  const action = settings?.bodyShortcuts?.[region] ?? window.lunaBodyShortcuts.defaults[region];
  if (action === '') return;
  try {
    if (['datetime', 'stats', 'weather'].includes(action)) {
      if (!feedback.getReminder()) infoBubbles.start(action);
    } else if (action === 'library') openSheet('library');
    else if (action === 'wardrobe') await openWardrobe();
    else if (action === 'screenshot') await api('screenshot-start');
    else if (action === 'recording') await api('recording-show');
    else if (action === 'reminder') await api('reminder-show');
    else if (action === 'settings') await openSettings();
  } catch (error) {
    showMessage(error.message);
  }
}
$('pet').onclick = event => {
  if (dragging) {
    dragging = false;
    return;
  }
  const region = event.detail === 0 ? 'head' : window.lunaCharacter.hitRegion(event.clientX, event.clientY);
  performBodyShortcut(region);
};
$('pet').onpointerdown = e => {
  if (e.button !== 0 || angerInteraction.protected) return;
  dragStart = { x: e.screenX, y: e.screenY, clientX: e.clientX, clientY: e.clientY };
  syncDockHold();
  dragging = false;
  shake = { x: e.screenX, direction: 0, turns: [] };
  $('pet').setPointerCapture(e.pointerId);
};
let shake = null;
// Four quick left/right reversals within 1.2 s while carrying her counts as shaking.
function trackShake(event) {
  if (!shake) return;
  const dx = event.screenX - shake.x;
  if (Math.abs(dx) < 12) return;
  const direction = Math.sign(dx),
    time = performance.now();
  if (shake.direction && direction !== shake.direction) shake.turns.push(time);
  shake.direction = direction;
  shake.x = event.screenX;
  shake.turns = shake.turns.filter(turn => time - turn < 1200);
  if (shake.turns.length >= 4) {
    shake.turns = [];
    life?.shaken();
  }
}
function movedPointer(event) {
  return (
    dragStart &&
    (Math.hypot(event.screenX - dragStart.x, event.screenY - dragStart.y) > 5 ||
      Math.hypot(event.clientX - dragStart.clientX, event.clientY - dragStart.clientY) > 5)
  );
}
$('pet').onpointermove = e => {
  if (dragStart && !dragging && movedPointer(e)) {
    dragging = true;
    window.pet.drag(true);
    life?.dragStarted();
  }
  if (dragStart && dragging) trackShake(e);
  if (!dragStart) {
    const region = window.lunaCharacter.hitRegion(e.clientX, e.clientY);
    const action = region ? (settings?.bodyShortcuts?.[region] ?? window.lunaBodyShortcuts.defaults[region]) : '';
    const hint = window.lunaBodyShortcuts.actions[action]?.hint;
    if (hint) $('pet').title = t(hint);
    else $('pet').removeAttribute('title');
  }
};
function endDrag() {
  const moved = dragStart && dragging,
    toolbar = dragStart?.toolbar;
  dragStart = null;
  if (toolbar) dragging = false;
  syncDockHold();
  if (moved) window.pet.drag(false);
}
$('pet').onpointerup = event => {
  if (dragStart && !dragging && movedPointer(event)) {
    dragging = true;
    window.pet.drag(true);
  }
  endDrag();
};
$('pet').onpointercancel = endDrag;
window.addEventListener('blur', endDrag);
const grip = $('toolbar-drag');
grip.onpointerdown = e => {
  if (e.button !== 0 || angerInteraction.protected) return;
  dragStart = { x: e.screenX, y: e.screenY, clientX: e.clientX, clientY: e.clientY };
  dragging = false;
  syncDockHold();
  dragStart.toolbar = true;
  grip.setPointerCapture(e.pointerId);
};
grip.onpointermove = e => {
  if (dragStart && !dragging && movedPointer(e)) {
    dragging = true;
    window.pet.drag(true);
  }
};
grip.onpointerup = () => {
  endDrag();
  dragging = false;
};
grip.onpointercancel = endDrag;
grip.addEventListener('lostpointercapture', endDrag);
document.addEventListener(
  'pointerup',
  () => {
    if (dragStart?.toolbar) endDrag();
  },
  true
);
let dropDepth = 0;
let beforeDropText = '';
document.addEventListener('mousemove', e => {
  const controls = overControls(e.clientX, e.clientY);
  if (controls || e.target.closest('#pet,.petbar,.bottom-sheet') || dragStart) showControls();
  else leaveControls();
  const value = !controls && !$('help').open && !dropDepth && !e.target.closest('.interactive') && !dragStart;
  if (value !== ignore) {
    ignore = value;
    window.pet.passthrough(value);
  }
});
document.addEventListener('mouseleave', e => {
  if (overControls(e.clientX, e.clientY) || dragStart) {
    showControls();
    if (ignore) {
      ignore = false;
      window.pet.passthrough(false);
    }
    return;
  }
  leaveControls();
  if (
    !$('library-sheet').hidden ||
    !$('recording-sheet').hidden ||
    !$('reminder-sheet').hidden ||
    !$('wardrobe').hidden
  )
    return;
  if (!$('help').open && !dragStart && !dropDepth) {
    ignore = true;
    window.pet.passthrough(true);
  }
});
document.addEventListener('dragenter', e => {
  e.preventDefault();
  if (!dropDepth) beforeDropText = $('bubble').textContent;
  dropDepth++;
  $('companion').classList.add('drop-ready');
  showMessage(t('放到这里，我会帮你收藏。'), 0);
  ignore = false;
  window.pet.passthrough(false);
});
document.addEventListener('dragover', e => {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
});
document.addEventListener('dragleave', () => {
  dropDepth = Math.max(0, dropDepth - 1);
  if (!dropDepth) {
    $('companion').classList.remove('drop-ready');
    showMessage(beforeDropText);
    ignore = true;
    window.pet.passthrough(true);
  }
});
document.addEventListener('drop', async e => {
  e.preventDefault();
  dropDepth = 0;
  $('companion').classList.remove('drop-ready');
  rest(false);
  showMessage(t('正在收藏…'), 0);
  try {
    // FileList itself cannot be passed through Electron's context bridge.
    const files = Array.from(e.dataTransfer.files);
    if (files.length) {
      const result = await window.pet.saveDroppedFiles(files);
      if (!result.ok) throw Error(t(result.error));
      const { saved, failed, unavailable } = result.value;
      if (unavailable) {
        const content = droppedText(e.dataTransfer);
        if (!content) throw Error(t('这个拖入内容没有本机文件或可用链接。'));
        const item = await api('collection-add-text', content);
        happy(item.kind === 'link' ? t('链接收好啦。') : t('文字收好啦。'));
      } else {
        if (saved) happy(t('收好啦，收藏了 {count} 个文件。', { count: saved }));
        else if (failed.length) throw Error(failed[0]);
        if (failed.length && saved)
          showMessage(feedback.getMessage() + t('另有 {count} 个未成功。', { count: failed.length }));
      }
    } else {
      const content = droppedText(e.dataTransfer);
      if (!content) throw Error(t('没有识别到文件、文字或链接。'));
      const item = await api('collection-add-text', content);
      happy(item.kind === 'link' ? t('链接收好啦。') : t('文字收好啦。'));
    }
  } catch (error) {
    showMessage(error.message);
  }
});
function closeEyes(duration) {
  if (sleeping || $('pet').classList.contains('happy')) return;
  $('pet').classList.add('blink');
  setTimeout(() => $('pet').classList.remove('blink'), duration);
}
// With companion on, blinking follows her energy: slower and longer when sleepy, sometimes a double blink.
function blink() {
  const plan = life?.enabled ? life.blinkPlan() : { delay: 3200 + Math.random() * 2400, duration: 140, double: false };
  closeEyes(plan.duration);
  if (plan.double) setTimeout(() => closeEyes(120), plan.duration + 160);
  setTimeout(blink, plan.delay);
}
setTimeout(blink, 3000);
async function saveQuickSetting(change) {
  const state = await api('settings', { ...settings, ...change });
  applySettings(state.settings);
  return state.settings;
}
wheel = window.lunaWheel.createWheel({
  host: document.body,
  translate: t,
  sound: name => window.uiSound(name),
  onToggle: syncDockHold,
  items: [
    { id: 'library', label: '收藏夹', icon: 'folder', color: '#8b6cf0', run: () => openSheet('library') },
    { id: 'screenshot', label: '截图', icon: 'capture', color: '#3b9cf0', run: () => api('screenshot-start') },
    { id: 'recording', label: '录屏', icon: 'record', color: '#f0648a', run: () => api('recording-show') },
    { id: 'reminder', label: '提醒', icon: 'bell', color: '#f2a223', run: () => api('reminder-show') },
    { id: 'wardrobe', label: '换装', icon: 'hanger', color: '#d96fd0', run: () => openWardrobe() },
    { id: 'settings', label: '设置', icon: 'settings', color: '#6a78f5', run: () => openSettings() },
    {
      id: 'pure',
      label: '纯净模式',
      icon: 'sparkle',
      color: '#2fb991',
      run: () => saveQuickSetting({ pureMode: true })
    },
    {
      id: 'companion',
      label: '陪伴互动',
      icon: 'heart',
      color: '#ff5f87',
      off: () => settings?.companion === false,
      run: async () => {
        const next = await saveQuickSetting({ companion: settings?.companion === false });
        showMessage(t(next.companion ? '好呀，我会多陪你说说话。' : '好，那我安静陪着你。'));
      }
    },
    { id: 'hide', label: '隐藏到托盘', icon: 'hide', color: '#7a88a6', run: () => api('hide') },
    { id: 'quit', label: '退出', icon: 'exit', color: '#ef4b4b', run: () => api('quit') }
  ].map(item => ({
    ...item,
    run: () => Promise.resolve(item.run()).catch(error => showMessage(error.message))
  }))
});
$('pet').addEventListener('contextmenu', event => {
  event.preventDefault();
  if (viewStopped || angerInteraction.protected || document.body.inert || settings?.pureMode || panelsOpen()) return;
  endDrag();
  cancelInfo();
  wheel.show(event.clientX, event.clientY);
});
(async () => {
  try {
    const s = await api('state');
    document.documentElement.style.setProperty('--toolbar-width', s.toolbarWidth + 'px');
    applySettings(s.settings);
    applyEdgeDock(s.edgeDock);
    appearance($('pet'), settings.hair, settings.outfit);
    rest(s.sleeping === true);
    document.title = settings.name + t(' · 桌面宠物');
    lifePaused = s.lifePaused === true;
    api('life-memory')
      .then(memory => {
        if (!viewStopped) startLife(memory);
      })
      .catch(() => {});
    // The bottom toolbar is gone, so tell existing users once where its buttons went.
    let wheelHinted = lifePaused;
    try {
      wheelHinted ||= localStorage.getItem('luna-wheel-hint') === '1';
    } catch {}
    if (!wheelHinted)
      setTimeout(() => {
        if (viewStopped || settings?.pureMode || !showMessage(t('右键点我，就能打开功能转盘哦。'), 6000)) return;
        try {
          localStorage.setItem('luna-wheel-hint', '1');
        } catch {}
      }, 1500);
  } catch (e) {
    showMessage(t('初始化失败：') + e.message);
  }
})();

window.addEventListener('luna-language-changed', () => {
  wheel.refresh();
  renderBodySettings();
  cancelInfo();
  feedback.show('');
  const due = feedback.getReminder();
  if (due) feedback.updateReminder(due);
  applyEdgeDock(edgeState);
  api('screenshot-shortcut')
    .then(shortcutHint)
    .catch(() => {});
  api('reminder-list')
    .then(items => reminderCount(items.filter(item => item.status !== 'done').length))
    .catch(() => {});
  if (settings) document.title = settings.name + t(' · 桌面宠物');
});
