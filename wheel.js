// Radial quick menu opened by right-clicking Luna. Each sector is a full-size button clipped to a rounded ring
// segment, so hit testing follows the visible shape and hover can pop the sector outward from the wheel centre.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.lunaWheel = factory();
})(globalThis, () => {
  const SIZE = 264,
    CENTER = SIZE / 2,
    OUTER = 124,
    INNER = 58,
    GAP = 5,
    CORNER = 9;
  const round = n => Math.round(n * 100) / 100;
  // Angle 0 points up and grows clockwise. Edges are offset sideways by half the gap so the gap width stays constant.
  function point(radius, angle, side) {
    const shifted = angle + side * Math.asin(Math.min(1, GAP / 2 / radius));
    return [round(CENTER + radius * Math.sin(shifted)), round(CENTER - radius * Math.cos(shifted))];
  }
  function sectorPath(index, count) {
    const step = (Math.PI * 2) / count,
      start = index * step - step / 2,
      end = start + step;
    const outerTurn = CORNER / OUTER,
      innerTurn = CORNER / INNER;
    const p = (radius, angle, side) => point(radius, angle, side).join(' ');
    const large = step > Math.PI ? 1 : 0;
    return [
      'M',
      p(OUTER - CORNER, start, 1),
      'Q',
      p(OUTER, start, 1),
      p(OUTER, start + outerTurn, 1),
      'A',
      OUTER,
      OUTER,
      0,
      large,
      1,
      p(OUTER, end - outerTurn, -1),
      'Q',
      p(OUTER, end, -1),
      p(OUTER - CORNER, end, -1),
      'L',
      p(INNER + CORNER, end, -1),
      'Q',
      p(INNER, end, -1),
      p(INNER, end - innerTurn, -1),
      'A',
      INNER,
      INNER,
      0,
      large,
      0,
      p(INNER, start + innerTurn, 1),
      'Q',
      p(INNER, start, 1),
      p(INNER + CORNER, start, 1),
      'Z'
    ].join(' ');
  }
  function iconPosition(index, count) {
    const angle = (index * Math.PI * 2) / count,
      radius = (OUTER + INNER) / 2;
    return [round(CENTER + radius * Math.sin(angle)), round(CENTER - radius * Math.cos(angle))];
  }

  function createWheel({ host, items, translate = text => text, onToggle = () => {}, sound = () => {} }) {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const wheel = document.createElement('div');
    wheel.id = 'wheel';
    wheel.className = 'interactive';
    wheel.setAttribute('role', 'menu');
    wheel.hidden = true;
    const center = document.createElement('div');
    center.className = 'wheel-center';
    center.setAttribute('aria-hidden', 'true');
    const centerIcon = window.lunaIcons.create(items[0].icon);
    centerIcon.classList.add('wheel-center-icon');
    const centerLabel = document.createElement('span');
    centerLabel.className = 'wheel-center-label';
    const centerState = document.createElement('span');
    centerState.className = 'wheel-center-state';
    center.append(centerIcon, centerLabel, centerState);
    const buttons = items.map((item, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'wheel-item';
      button.dataset.wheel = item.id;
      button.dataset.uiSound = 'select';
      button.setAttribute('role', 'menuitem');
      button.style.setProperty('--i', index);
      button.style.setProperty('--color', item.color);
      button.style.clipPath = `path('${sectorPath(index, items.length)}')`;
      const icon = window.lunaIcons.create(item.icon);
      icon.classList.add('wheel-icon');
      const [x, y] = iconPosition(index, items.length);
      icon.style.left = x + 'px';
      icon.style.top = y + 'px';
      button.append(icon);
      button.addEventListener('pointerenter', () => setActive(index));
      button.addEventListener('focus', () => setActive(index));
      button.addEventListener('click', () => choose(index));
      return button;
    });
    wheel.append(...buttons, center);
    host.append(wheel);

    let active = -1,
      open = false,
      closeTimer = null,
      settleTimer = null,
      runTimer = null,
      returnFocus = null;
    function refresh() {
      wheel.setAttribute('aria-label', translate('克劳德功能'));
      items.forEach((item, index) => {
        const off = item.off?.() === true;
        buttons[index].classList.toggle('off', off);
        const label = translate(item.label) + (item.off ? ' · ' + translate(off ? '已关闭' : '已开启') : '');
        buttons[index].setAttribute('aria-label', label);
        buttons[index].title = label;
      });
      if (active >= 0) paintCenter(items[active], false);
    }
    function paintCenter(item, animate = true) {
      window.lunaIcons.draw(centerIcon, item.icon);
      center.style.setProperty('--color', item.color);
      centerLabel.textContent = translate(item.label);
      centerState.textContent = item.off ? translate(item.off() ? '已关闭' : '已开启') : '';
      if (animate && !reduced.matches) {
        center.classList.remove('swap');
        void center.offsetWidth;
        center.classList.add('swap');
      }
    }
    function setActive(index) {
      if (!open || index === active) return;
      buttons[active]?.classList.remove('active');
      active = index;
      buttons[index].classList.add('active');
      paintCenter(items[index]);
    }
    function show(clientX, clientY) {
      clearTimeout(closeTimer);
      clearTimeout(settleTimer);
      refresh();
      const bounds = host.getBoundingClientRect();
      wheel.style.left = Math.round((bounds.width - SIZE) / 2) + 'px';
      wheel.style.top = Math.round(Math.max(4, Math.min(bounds.height - SIZE - 4, clientY - SIZE / 2))) + 'px';
      wheel.style.setProperty('--origin-x', Math.round(clientX - (bounds.width - SIZE) / 2) + 'px');
      returnFocus = document.activeElement;
      wheel.hidden = false;
      wheel.classList.remove('closing', 'opening');
      void wheel.offsetWidth;
      wheel.classList.add('opening');
      settleTimer = setTimeout(() => wheel.classList.remove('opening'), 520);
      open = true;
      active = -1;
      for (const button of buttons) button.classList.remove('active');
      setActive(0);
      buttons[0].focus({ preventScroll: true });
      sound('open');
      onToggle(true);
    }
    function close({ silent = false } = {}) {
      if (!open) return;
      open = false;
      clearTimeout(settleTimer);
      wheel.classList.remove('opening');
      wheel.classList.add('closing');
      if (!silent) sound('close');
      closeTimer = setTimeout(
        () => {
          wheel.hidden = true;
          wheel.classList.remove('closing');
        },
        reduced.matches ? 0 : 200
      );
      if (wheel.contains(document.activeElement)) returnFocus?.focus?.({ preventScroll: true });
      onToggle(false);
    }
    function choose(index) {
      if (!open) return;
      close({ silent: true });
      clearTimeout(runTimer);
      // Let the closing animation clear the screen first; screenshots must not capture the menu.
      runTimer = setTimeout(() => items[index].run(), reduced.matches ? 0 : 180);
    }
    wheel.addEventListener('keydown', event => {
      const moves = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
      } else if (moves[event.key] || event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        const next =
          event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? items.length - 1
              : (Math.max(active, 0) + moves[event.key] + items.length) % items.length;
        buttons[next].focus({ preventScroll: true });
      }
    });
    // Any press outside a sector (including the transparent centre and corners) dismisses the menu.
    document.addEventListener(
      'pointerdown',
      event => {
        if (!open || event.target.closest('.wheel-item')) return;
        close();
        if (event.button !== 0) return;
        // The dismissing press must not also click Luna or a toolbar button underneath.
        event.stopPropagation();
        const swallow = click => {
          click.stopPropagation();
          click.preventDefault();
        };
        document.addEventListener('click', swallow, { capture: true, once: true });
        setTimeout(() => document.removeEventListener('click', swallow, true), 400);
      },
      true
    );
    window.addEventListener('blur', () => close({ silent: true }));
    return {
      show,
      close,
      refresh,
      get isOpen() {
        return open;
      },
      element: wheel
    };
  }

  return { createWheel, sectorPath, iconPosition, SIZE, OUTER, INNER };
});
