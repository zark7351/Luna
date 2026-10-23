// Only these packaged local pages are embedded; no remote documents or scripts are loaded.
if (window.parent !== window) {
  window.pet = window.parent.pet;
  window.recorder = window.parent.recorder;
  window.reminder = window.parent.reminder;
  document.documentElement.classList.add('embedded');
}

// Dropped files must be collected, never navigate the packaged panel to a file.
document.addEventListener('dragover', event => event.preventDefault());
document.addEventListener('drop', event => event.preventDefault());

if (window.parent !== window) document.addEventListener('mousemove', () => window.parent.lunaPanels?.hoverSheet());
let inputFocusRequest = 0;
document.addEventListener(
  'pointerdown',
  event => {
    const request = ++inputFocusRequest;
    if (event.button !== 0) return;
    const field = event.target.closest('input,textarea,select,[contenteditable="true"]');
    if (!field || field.disabled) return;
    const previous = document.activeElement;
    const panels = window.parent !== window ? window.parent.lunaPanels : window.lunaPanels;
    const focused = panels
      ? panels.focusSheet()
      : window.pet.call('panel-focus').then(result => result.ok && result.value);
    focused
      .then(focused => {
        if (
          focused &&
          request === inputFocusRequest &&
          field.isConnected &&
          !document.hidden &&
          field.getClientRects().length &&
          (!window.frameElement || window.frameElement.getClientRects().length) &&
          (document.activeElement === previous || document.activeElement === field)
        ) {
          window.focus();
          field.focus({ preventScroll: true });
        }
      })
      .catch(() => {});
  },
  true
);
