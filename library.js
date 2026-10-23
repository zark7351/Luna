const t = window.lunaI18n.t;
const $ = id => document.getElementById(id);
const api = async (name, payload) => {
  const r = await window.pet.call(name, payload);
  if (!r.ok) throw Error(t(r.error));
  return r.value;
};
let items = [],
  activeTab = 'all',
  staleCount = 0;
const category = item =>
  item.kind === 'file' ? (item.mediaType ? 'media' : 'files') : item.kind === 'link' ? 'links' : 'text';
const inTab = (item, tab) => tab === 'all' || category(item) === tab;
// The "all" view groups pinned items first, then by the local day the item was (last) saved.
function dayGroup(item) {
  if (item.pinned) return '已置顶';
  const day = new Date(item.createdAt),
    today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((today - new Date(day.getFullYear(), day.getMonth(), day.getDate())) / 86400000);
  return diff <= 0 ? '今天' : diff === 1 ? '昨天' : '更早';
}
function button(label, fn, extra = '') {
  const b = document.createElement('button');
  b.textContent = label;
  if (extra) b.className = extra;
  b.onclick = fn;
  return b;
}
function makeIcon(icon) {
  return window.lunaIcons.create(icon);
}
function iconButton(icon, label, fn, extra = '') {
  const b = button('', fn, extra);
  b.title = label;
  b.setAttribute('aria-label', label);
  b.append(makeIcon(icon));
  b.dataset.uiSound = 'none';
  return b;
}
async function operate(name, item, message) {
  try {
    await api(name, item.id);
    if (message) $('status').textContent = message;
  } catch (e) {
    $('status').textContent = e.message;
  }
}
let knownItems = null;
function render(newIds = new Set(), enter = false) {
  window.lunaVideo.closeMenu();
  const query = $('search').value.trim().toLocaleLowerCase();
  const shown = items.filter(
    item =>
      inTab(item, activeTab) &&
      (
        item.title +
        ' ' +
        (item.content || '') +
        ' ' +
        (item.linkPreview?.title || '') +
        ' ' +
        (item.linkPreview?.description || '')
      )
        .toLocaleLowerCase()
        .includes(query)
  );
  // Stable sort: pinned entries rise to the top while everything else stays newest-first.
  shown.sort((a, b) => (b.pinned === true) - (a.pinned === true));
  for (const tab of $('tabs').querySelectorAll('[role=tab]')) {
    const selected = tab.dataset.tab === activeTab;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
    tab.querySelector('span').textContent = items.filter(item => inTab(item, tab.dataset.tab)).length;
  }
  $('items').setAttribute('aria-labelledby', 'tab-' + activeTab);
  for (const video of $('items').querySelectorAll('video')) {
    video.pause();
    video.removeAttribute('src');
    video.load();
  }
  $('items').replaceChildren();
  if (!shown.length) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = query ? t('没有匹配的收藏') : t('暂无收藏');
    $('items').append(empty);
    return;
  }
  let group = null;
  for (const item of shown) {
    if (activeTab === 'all' && dayGroup(item) !== group) {
      group = dayGroup(item);
      const heading = document.createElement('h2');
      heading.className = 'group-title';
      heading.textContent = t(group);
      $('items').append(heading);
    }
    const card = document.createElement('article');
    card.className =
      'item' +
      (item.kind === 'file' && !item.mediaType ? ' file-item' : '') +
      (item.pinned ? ' pinned' : '') +
      (item.missing ? ' missing' : '');
    card.dataset.id = item.id;
    card.setAttribute('aria-label', item.title);
    card.title = item.title;
    if (item.kind === 'file') {
      const stage = document.createElement('div');
      stage.className = 'preview-stage';
      const fallback = document.createElement('div');
      fallback.className = 'media-fallback';
      fallback.hidden = true;
      fallback.textContent = t('无法预览');
      if (item.previewUrl) {
        const isVideo = item.mediaType.startsWith('video/');
        const media = document.createElement(isVideo ? 'video' : 'img');
        media.className = 'media-preview';
        media.onerror = () => {
          media.hidden = true;
          fallback.hidden = false;
        };
        if (isVideo) {
          media.controls = true;
          media.preload = 'metadata';
          media.playsInline = true;
          media.setAttribute('aria-label', item.title + t(' 视频预览'));
          media.onloadedmetadata = () => {
            if (Number.isFinite(media.duration) && media.duration > 0)
              media.currentTime = Math.min(0.1, media.duration / 2);
          };
          media.onplay = () => {
            for (const other of $('items').querySelectorAll('video')) if (other !== media) other.pause();
          };
        } else {
          media.alt = t('图片预览');
          media.loading = 'lazy';
          media.tabIndex = 0;
          media.title = t('打开图片');
          media.onclick = () => operate('collection-open', item);
          media.onkeydown = e => {
            if (e.key === 'Enter') media.click();
          };
        }
        media.src = item.previewUrl;
        stage.append(media);
        if (isVideo && window.parent !== window) window.lunaVideo.attach(stage, media);
      } else {
        const icon = document.createElement('img');
        icon.className = 'file-icon';
        icon.alt = t('文件图标');
        api('collection-file-icon', item.id)
          .then(url => {
            if (icon.isConnected) icon.src = url;
          })
          .catch(() => {
            icon.hidden = true;
            fallback.hidden = false;
            fallback.textContent = t('文件不可用');
          });
        stage.append(icon);
      }
      if (item.missing) {
        fallback.hidden = false;
        fallback.textContent = t('原文件已移动或删除');
        for (const node of stage.querySelectorAll('img,video')) node.hidden = true;
      }
      stage.append(fallback);
      if (item.storage === 'reference') {
        const badge = document.createElement('span');
        badge.className = 'storage-badge' + (item.missing ? ' lost' : '');
        badge.textContent = item.missing ? t('已失效') : t('引用');
        badge.title = item.missing
          ? t('原文件已移动或删除，这条收藏无法再打开。')
          : t('只记录了原文件的位置；移动或删除原文件后将无法打开，可点“保存副本”。');
        stage.append(badge);
      }
      card.append(stage);
      if (!item.mediaType) {
        const filename = document.createElement('div');
        filename.className = 'file-name';
        filename.textContent = item.title;
        card.append(filename);
      }
    } else if (item.kind === 'link') {
      const preview = item.linkPreview || {};
      const link = document.createElement('div');
      link.className = 'web-card';
      link.tabIndex = 0;
      link.setAttribute('role', 'link');
      link.title = t('打开网页');
      link.onclick = () => operate('collection-open', item);
      link.onkeydown = e => {
        if (e.key === 'Enter') link.click();
      };
      const cover = document.createElement('div');
      cover.className = 'web-cover';
      if (typeof preview.image === 'string' && preview.image.startsWith('data:image/jpeg;base64,')) {
        const img = document.createElement('img');
        img.src = preview.image;
        img.alt = t('网页封面');
        img.loading = 'lazy';
        img.onerror = () => {
          img.remove();
          cover.append(makeIcon('web'));
        };
        cover.append(img);
      } else cover.append(makeIcon('web'));
      const details = document.createElement('div');
      details.className = 'web-details';
      const title = document.createElement('div');
      title.className = 'web-title';
      title.textContent = preview.title || new URL(item.content).hostname;
      const description = document.createElement('div');
      description.className = 'web-description';
      description.textContent = preview.description || (preview.status === 'ready' ? '' : t('获取预览中…'));
      const address = document.createElement('div');
      address.className = 'web-address';
      address.textContent = item.content;
      details.append(title, description, address);
      link.append(cover, details);
      card.append(link);
    } else {
      const preview = document.createElement('div');
      preview.className = 'item-preview';
      preview.textContent = item.content;
      card.append(preview);
      if (item.kind === 'link') {
        preview.classList.add('link-preview');
        preview.tabIndex = 0;
        preview.setAttribute('role', 'link');
        preview.title = t('打开链接');
        preview.onclick = () => operate('collection-open', item);
        preview.onkeydown = e => {
          if (e.key === 'Enter') preview.click();
        };
      }
      if (item.content.length > 160)
        card.append(
          iconButton(
            'expand',
            t('展开内容'),
            e => {
              preview.classList.toggle('expanded');
              const expanded = preview.classList.contains('expanded');
              window.uiSound(expanded ? 'open' : 'close');
              e.currentTarget.classList.toggle('is-expanded', expanded);
              e.currentTarget.title = expanded ? t('收起内容') : t('展开内容');
              e.currentTarget.setAttribute('aria-label', e.currentTarget.title);
            },
            'expand'
          )
        );
    }
    if (item.pinned) {
      const pin = makeIcon('pin');
      pin.classList.add('pin-badge');
      card.append(pin);
    }
    const actions = document.createElement('div');
    actions.className = 'actions';
    actions.append(
      iconButton(
        'pin',
        item.pinned ? t('取消置顶') : t('置顶收藏'),
        () =>
          api('collection-pin', { id: item.id, pinned: !item.pinned })
            .then(refresh)
            .catch(e => ($('status').textContent = e.message)),
        item.pinned ? 'is-pinned' : ''
      )
    );
    if (item.storage === 'reference' && !item.missing)
      actions.append(
        iconButton('keep', t('保存副本'), async e => {
          const target = e.currentTarget;
          target.disabled = true;
          try {
            await api('collection-keep-copy', item.id);
            $('status').textContent = t('已保存副本，原文件移动也不影响了。');
            await refresh();
          } catch (error) {
            $('status').textContent = error.message;
            target.disabled = false;
          }
        })
      );
    actions.append(
      iconButton('copy', item.kind === 'file' ? t('复制文件') : t('复制内容'), () =>
        operate('collection-copy', item, t('已复制'))
      )
    );
    if (item.kind === 'file')
      actions.append(iconButton('folder', t('打开所在文件夹'), () => operate('collection-reveal', item)));
    if (item.kind === 'link')
      actions.append(
        iconButton('refresh', t('重新获取网页预览'), async e => {
          const b = e.currentTarget;
          b.disabled = true;
          try {
            await api('collection-link-preview', item.id);
            await refresh();
          } catch (error) {
            $('status').textContent = error.message;
          } finally {
            b.disabled = false;
          }
        })
      );
    actions.append(
      iconButton(
        'trash',
        t('删除收藏'),
        async () => {
          const message =
            item.kind === 'file'
              ? item.storage === 'reference'
                ? t('移除这条收藏？不会删除原文件。')
                : t('删除这条收藏？克劳德保存的副本也会删除。')
              : t('删除这条收藏？');
          if (!(await window.lunaConfirm.ask(message))) return;
          try {
            await api('collection-delete', item.id);
            await refresh();
            $('status').textContent = t('已删除。');
          } catch (e) {
            $('status').textContent = e.message;
          }
        },
        'danger'
      )
    );
    card.append(actions);
    $('items').append(card);
    if (newIds.has(item.id) || (enter && $('items').children.length <= 6)) window.lunaEffects.pulse(card, 'enter');
  }
  if (activeTab === 'all' && !query && staleCount > 0) {
    const footer = button(t('清理 30 天前的 {count} 条收藏', { count: staleCount }), cleanupOld, 'cleanup');
    footer.dataset.uiSound = 'none';
    $('items').append(footer);
  }
}
async function cleanupOld() {
  const message = t(
    '清理 30 天前、未置顶的 {count} 条收藏？\n克劳德保存的截图、录屏等副本会一起删除；拖进来的原文件不受影响。',
    { count: staleCount }
  );
  if (!(await window.lunaConfirm.ask(message))) return;
  try {
    const removed = await api('collection-cleanup', { dryRun: false });
    $('status').textContent = t('已清理 {count} 条收藏。', { count: removed });
    await refresh();
  } catch (e) {
    $('status').textContent = e.message;
  }
}
for (const tab of $('tabs').querySelectorAll('[role=tab]')) {
  tab.onclick = () => {
    activeTab = tab.dataset.tab;
    $('status').textContent = '';
    render(new Set(), true);
  };
  tab.onkeydown = e => {
    const all = Array.from($('tabs').children);
    let index = all.indexOf(tab);
    if (e.key === 'ArrowRight') index = (index + 1) % all.length;
    else if (e.key === 'ArrowLeft') index = (index + all.length - 1) % all.length;
    else if (e.key === 'Home') index = 0;
    else if (e.key === 'End') index = all.length - 1;
    else return;
    e.preventDefault();
    all[index].click();
    all[index].focus();
  };
}
async function refresh() {
  try {
    items = await api('collection-list');
    staleCount = await api('collection-cleanup', { dryRun: true }).catch(() => 0);
    const added = new Set(knownItems ? items.filter(item => !knownItems.has(item.id)).map(item => item.id) : []);
    knownItems = new Set(items.map(item => item.id));
    render(added);
  } catch (e) {
    $('status').textContent = e.message;
  }
}
$('search').oninput = () => {
  // Searching always covers every category.
  if ($('search').value.trim() && activeTab !== 'all') activeTab = 'all';
  render();
};
$('refresh').onclick = refresh;
$('add-file').onclick = async () => {
  try {
    const result = await api('library-add-files');
    if (result.saved) {
      $('status').textContent = t('已收藏 {count} 个文件。', { count: result.saved });
      await refresh();
    } else if (result.failed.length) $('status').textContent = result.failed[0];
  } catch (e) {
    $('status').textContent = e.message;
  }
};
let pasting = false;
async function pasteClipboard() {
  if (pasting) return;
  pasting = true;
  $('paste').disabled = true;
  try {
    const result = await api('collection-add-clipboard');
    if (result.kind === 'files') {
      if (result.saved) {
        activeTab = 'all';
        $('search').value = '';
        await refresh();
      }
      $('status').textContent =
        (result.saved ? t('已收藏 {count} 个文件。', { count: result.saved }) : '') +
        (result.failed.length
          ? t(' {count} 个失败：{error}', { count: result.failed.length, error: t(result.failed[0]) })
          : '');
    } else {
      activeTab = 'all';
      $('search').value = '';
      await refresh();
      $('status').textContent = result.duplicate
        ? t('已经收藏过了，移到最前面啦。')
        : result.kind === 'link'
          ? t('剪贴板链接已收藏。')
          : t('剪贴板文字已收藏。');
    }
  } catch (e) {
    $('status').textContent = e.message;
  } finally {
    pasting = false;
    $('paste').disabled = false;
  }
}
$('paste').onclick = pasteClipboard;
document.addEventListener('paste', event => {
  if (event.target.closest('input,textarea,[contenteditable="true"]')) return;
  event.preventDefault();
  pasteClipboard();
});
window.pet.onCollectionUpdated(refresh);
window.pet.onEffect(name => {
  if (window.parent === window && ['collect', 'capture', 'recording'].includes(name)) window.lunaEffects.burst(name);
});
refresh();

$('screenshot-button').onclick = async () => {
  try {
    await api('screenshot-start');
  } catch (e) {
    $('status').textContent = e.message;
  }
};
window.pet.onScreenshotMessage(value => {
  if (value.saved) {
    activeTab = 'all';
    $('search').value = '';
    refresh();
  }
  $('status').textContent = value.message;
});
function shortcutHint(status) {
  $('screenshot-button').title = window.claudexHotkeys.screenshotHint(status, t);
}
window.pet.onScreenshotShortcutChanged(shortcutHint);
api('screenshot-shortcut')
  .then(shortcutHint)
  .catch(() => {});

$('expand-library').onclick = async () => {
  try {
    await api('library-expand', { tab: activeTab, query: $('search').value });
    window.parent.lunaPanels.closeSheet('library');
  } catch (e) {
    $('status').textContent = e.message;
  }
};
$('close-library').onclick = () =>
  window.parent !== window ? window.parent.lunaPanels.closeSheet('library') : api('library-window', 'close');
$('maximize-library').onclick = () => api('library-window', 'maximize');
function openNote() {
  $('note-editor').hidden = false;
  $('note-text').focus();
}
function closeNote() {
  $('note-editor').hidden = true;
  $('note-text').value = '';
}
$('new-note').onclick = () => ($('note-editor').hidden ? openNote() : closeNote());
$('note-cancel').onclick = closeNote;
$('note-text').onkeydown = event => {
  if (event.key === 'Enter' && event.ctrlKey) {
    event.preventDefault();
    $('note-editor').requestSubmit();
  } else if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    closeNote();
  }
};
$('note-editor').onsubmit = async event => {
  event.preventDefault();
  const text = $('note-text').value.trim();
  if (!text) return closeNote();
  try {
    const item = await api('collection-add-text', text);
    closeNote();
    activeTab = 'all';
    $('search').value = '';
    await refresh();
    $('status').textContent = item.duplicate ? t('已经收藏过了，移到最前面啦。') : t('便签已保存。');
  } catch (e) {
    $('status').textContent = e.message;
  }
};
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !document.fullscreenElement) {
    if (window.parent !== window) window.parent.lunaPanels.closeSheet('library');
    else api('library-window', 'close');
  }
});

let statusTimer;
new MutationObserver(() => {
  clearTimeout(statusTimer);
  if ($('status').textContent) statusTimer = setTimeout(() => ($('status').textContent = ''), 4500);
}).observe($('status'), { childList: true, characterData: true, subtree: true });

window.pet.onLibraryView(value => {
  if (!['all', 'media', 'files', 'text', 'links'].includes(value.tab)) return;
  activeTab = value.tab;
  $('search').value = value.query;
  render();
});

document.addEventListener('drop', async event => {
  event.preventDefault();
  try {
    const files = Array.from(event.dataTransfer.files);
    if (files.length) {
      const result = await window.pet.saveDroppedFiles(files);
      if (!result.ok) throw Error(t(result.error));
      if (!result.value.saved) throw Error(result.value.failed[0] || t('未收到文件'));
      await refresh();
      activeTab = category(items[0]);
      $('search').value = '';
      render();
      $('status').textContent = t('已收藏') + (result.value.failed.length ? t('，部分文件未成功') : '');
    } else {
      const content =
        event.dataTransfer
          .getData('text/uri-list')
          .split(/\r?\n/)
          .find(line => line && !line.startsWith('#')) || event.dataTransfer.getData('text/plain');
      const item = await api('collection-add-text', content);
      activeTab = category(item);
      $('search').value = '';
      await refresh();
      $('status').textContent = t('已收藏');
    }
  } catch (error) {
    $('status').textContent = error.message;
  }
});

window.addEventListener('luna-language-changed', () => {
  render();
  api('screenshot-shortcut')
    .then(shortcutHint)
    .catch(() => {});
});
