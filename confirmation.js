// Local asynchronous confirmation, shared by embedded panels and full windows.
// Avoid blocking native JavaScript dialogs and keep focus inside the owning page.
(() => {
  const dialog = document.createElement('dialog');
  dialog.id = 'confirm-action';
  dialog.setAttribute('aria-labelledby', 'confirm-message');
  const form = document.createElement('form');
  form.method = 'dialog';
  const message = document.createElement('p');
  message.id = 'confirm-message';
  const buttons = document.createElement('div');
  buttons.className = 'confirm-buttons';
  const cancel = document.createElement('button');
  cancel.value = 'cancel';
  cancel.autofocus = true;
  const confirm = document.createElement('button');
  confirm.value = 'confirm';
  confirm.className = 'danger';
  buttons.append(cancel, confirm);
  form.append(message, buttons);
  dialog.append(form);
  document.body.append(dialog);
  let pending = null;
  function translate() {
    cancel.textContent = window.lunaI18n.t('取消');
    confirm.textContent = window.lunaI18n.t('确定');
  }
  translate();
  window.addEventListener('luna-language-changed', translate);
  dialog.addEventListener('close', () => {
    const current = pending;
    pending = null;
    if (!current) return;
    const target = current.previous?.isConnected ? current.previous : document.querySelector('input,textarea');
    if (!document.hidden && (!window.frameElement || window.frameElement.getClientRects().length))
      target?.focus({ preventScroll: true });
    current.resolve(dialog.returnValue === 'confirm');
  });
  // Escape cancels this confirmation without closing the panel behind it.
  dialog.addEventListener('keydown', event => {
    if (event.key === 'Escape') event.stopPropagation();
  });
  window.addEventListener('pagehide', () => {
    pending?.resolve(false);
    pending = null;
  });
  window.lunaConfirm = {
    ask(text) {
      if (pending) return Promise.resolve(false);
      message.textContent = text;
      return new Promise(resolve => {
        pending = { resolve, previous: document.activeElement };
        dialog.returnValue = 'cancel';
        dialog.showModal();
      });
    }
  };
})();
