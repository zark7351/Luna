(function () {
  const schema = window.claudexHotkeys;
  window.createHotkeysUI = function ({ root, call, t }) {
    let draft = { ...schema.defaults },
      status = null;
    const fields = {},
      notes = {};
    const heading = document.createElement('div');
    heading.className = 'hotkeys-heading';
    const title = document.createElement('strong');
    const reset = document.createElement('button');
    reset.type = 'button';
    heading.append(title, reset);
    root.append(heading);
    const hint = document.createElement('p');
    hint.className = 'hotkeys-hint';
    for (const action of schema.actions) {
      const row = document.createElement('div');
      row.className = 'hotkey-row';
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.id = `hotkey-${action}`;
      input.readOnly = true;
      input.autocomplete = 'off';
      input.spellcheck = false;
      label.htmlFor = input.id;
      const clear = document.createElement('button');
      clear.type = 'button';
      clear.textContent = '×';
      const note = document.createElement('small');
      note.className = 'hotkey-note';
      note.setAttribute('role', 'status');
      row.append(label, input, clear, note);
      root.append(row);
      fields[action] = { input, label, clear };
      notes[action] = note;
      let previous = '';
      input.onfocus = async () => {
        previous = draft[action];
        note.textContent = t('按下组合键，Tab 结束录入，Esc 取消。');
        try {
          await call('hotkeys-capture', true);
        } catch (error) {
          note.textContent = error.message;
          input.blur();
        }
      };
      input.onblur = () => {
        note.textContent = '';
        call('hotkeys-capture', false).catch(() => {});
      };
      input.onkeydown = event => {
        if (event.key === 'Tab' && !event.ctrlKey && !event.altKey && !event.metaKey) return;
        event.preventDefault();
        event.stopPropagation();
        if (event.key === 'Escape') {
          draft[action] = previous;
          render();
          input.blur();
          return;
        }
        if (['Control', 'Alt', 'Shift', 'Meta'].includes(event.key)) return;
        try {
          const value =
            ['Backspace', 'Delete'].includes(event.key) &&
            !event.ctrlKey &&
            !event.altKey &&
            !event.metaKey &&
            !event.shiftKey
              ? ''
              : schema.fromEvent(event);
          const candidate = { ...draft, [action]: value };
          schema.validate(candidate);
          draft = candidate;
          input.value = schema.display(value);
          note.textContent = t('保存后生效，留空表示禁用。');
        } catch (error) {
          note.textContent = t(error.message);
        }
      };
      clear.onclick = () => {
        draft[action] = '';
        render();
      };
    }
    root.append(hint);
    function render() {
      title.textContent = t('快捷键');
      reset.textContent = t('恢复默认快捷键');
      hint.textContent = t('点击输入框后按组合键。保存后生效，留空表示禁用。');
      for (const action of schema.actions) {
        const { input, label, clear } = fields[action];
        label.textContent = t(schema.labels[action]);
        input.value = schema.display(draft[action]);
        input.title = schema.display(draft[action]) || t('未绑定');
        input.placeholder = t('未绑定');
        input.setAttribute('aria-label', `${t(schema.labels[action])} ${t('快捷键')}`);
        clear.title = `${t('清除快捷键')} · ${t(schema.labels[action])}`;
        clear.setAttribute('aria-label', clear.title);
        if (document.activeElement !== input)
          notes[action].textContent =
            status &&
            !status.suspended &&
            draft[action] &&
            draft[action] === status.bindings[action].accelerator &&
            !status.bindings[action].available
              ? t('该快捷键未注册，请换一个组合键。')
              : '';
      }
    }
    reset.onclick = () => {
      draft = { ...schema.defaults };
      render();
    };
    window.addEventListener('focus', () => {
      if (Object.values(fields).some(({ input }) => input === document.activeElement))
        call('hotkeys-capture', true).catch(() => {});
    });
    render();
    return {
      fill(value, current) {
        draft = schema.migrate(value);
        status = current;
        render();
      },
      status(value) {
        status = value;
        render();
      },
      async read() {
        if (root.contains(document.activeElement)) document.activeElement.blur();
        await call('hotkeys-capture', false);
        return schema.validate(draft);
      },
      close() {
        if (root.contains(document.activeElement)) document.activeElement.blur();
        call('hotkeys-capture', false).catch(() => {});
      },
      render
    };
  };
})();
