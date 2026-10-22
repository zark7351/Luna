// Play the current pose atlas on a canvas; reactions switch poses and return to idle.
(() => {
  window.createLunaCharacter = (pet, options = {}) => {
    const assets = window.lunaCharacterAssets,
      { stage } = assets;
    pet.classList.add('character-body');
    const canvas = document.createElement('canvas');
    canvas.width = stage.width;
    canvas.height = stage.height;
    canvas.className = 'character-face';
    canvas.setAttribute('aria-hidden', 'true');
    pet.append(canvas);
    const ctx = canvas.getContext('2d', { willReadFrequently: true }),
      images = new Map(),
      loaded = new Map();
    const appendages = window.claudeAppendages.createRenderer(canvas);
    let expression = 'neutral',
      pose = 'idle',
      poseStart = performance.now(),
      reaction = null,
      timers = [],
      frame = null,
      stopped = false;
    ctx.imageSmoothingQuality = 'high';
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const loadImage =
      options.loadImage ||
      (async file => {
        const asset = new Image();
        asset.src = 'assets/' + file;
        await asset.decode();
        return asset;
      });
    function getImage(name) {
      const definition = assets.poses[name];
      if (!images.has(name)) {
        const loading = Promise.resolve()
          .then(() => loadImage(definition.file))
          .then(image => {
            assets.validateImage(definition, image);
            loaded.set(name, image);
            return image;
          });
        images.set(name, loading);
        loading.catch(error => {
          console.warn('角色素材加载失败', error.message);
          if (images.get(name) === loading) images.delete(name);
        });
      }
      return images.get(name);
    }
    function currentExpression() {
      if (pet.classList.contains('sleeping')) return 'sleeping';
      return reaction || (pet.classList.contains('happy') ? 'happy' : 'neutral');
    }
    function draw(time = performance.now()) {
      expression = currentExpression();
      canvas.dataset.expression = expression;
      const wanted = assets.poseFor(expression);
      if (wanted !== pose) {
        pose = wanted;
        poseStart = time;
        if (!reduced.matches)
          canvas.animate([{ opacity: 0.55 }, { opacity: 1 }], { duration: 160, easing: 'ease-out' });
      }
      canvas.dataset.pose = pose;
      const image = loaded.get(pose);
      if (!image) {
        getImage(pose).then(
          () => !stopped && draw(),
          () => {}
        );
        return;
      }
      const definition = assets.poses[pose],
        // Sleeping reuses idle at half speed until a sleep pose exists.
        speed = expression === 'sleeping' && pose === 'idle' ? 0.5 : 1,
        index = reduced.matches ? 0 : assets.frameAt(definition, ((time - poseStart) / 1000) * speed);
      ctx.clearRect(0, 0, stage.width, stage.height);
      ctx.drawImage(
        image,
        (index % definition.columns) * stage.width,
        Math.floor(index / definition.columns) * stage.height,
        stage.width,
        stage.height,
        0,
        0,
        stage.width,
        stage.height
      );
      appendages.draw(ctx, time);
      canvas.dataset.motion = appendages.active.join(' ');
    }
    function loop(time) {
      frame = null;
      if (stopped) return;
      draw(time);
      if (!reduced.matches) frame = requestAnimationFrame(loop);
    }
    function start() {
      if (!stopped && frame === null) frame = requestAnimationFrame(loop);
    }
    function cancel() {
      for (const timer of timers) clearTimeout(timer);
      timers = [];
      reaction = null;
      appendages.clear();
      draw();
    }
    async function load() {
      if (stopped) return false;
      try {
        await getImage('idle');
        if (stopped) return false;
        draw();
        start();
        return true;
      } catch {
        return false;
      }
    }
    function react(name) {
      if (Object.hasOwn(window.claudeAppendages.durations, name)) {
        if (stopped || reduced.matches || !loaded.has('idle')) return false;
        const started = appendages.play(name);
        draw();
        return started;
      }
      const types = {
        collect: 'wink',
        capture: 'wink',
        recording: 'smile',
        'reminder-save': 'smile',
        reminder: 'smile',
        complete: 'happy',
        wink: 'wink',
        smile: 'smile',
        shy: 'shy',
        happy: 'happy',
        pout: 'pout',
        sleepy: 'closed'
      };
      if (!Object.hasOwn(types, name) || stopped) return false;
      cancel();
      if (pet.classList.contains('sleeping')) return true;
      reaction = types[name];
      draw();
      // Without a matching pose she still answers with a small hop.
      if (!reduced.matches && assets.poseFor(reaction) === 'idle' && reaction !== 'closed')
        canvas.animate(
          [
            { transform: 'translateY(0)' },
            { transform: 'translateY(-6%)', offset: 0.35 },
            { transform: 'translateY(0)', offset: 0.7 },
            { transform: 'translateY(-1.5%)', offset: 0.85 },
            { transform: 'translateY(0)' }
          ],
          { duration: reaction === 'pout' ? 260 : 520, easing: 'ease-out' }
        );
      timers.push(
        setTimeout(
          () => {
            reaction = null;
            draw();
          },
          name === 'reminder' ? 2400 : 1800
        )
      );
      return true;
    }
    const observer = new MutationObserver(() => draw());
    observer.observe(pet, { attributes: true, attributeFilter: ['class'] });
    function motionChanged() {
      cancel();
      start();
    }
    function stop() {
      if (stopped) return;
      stopped = true;
      cancel();
      if (frame !== null) cancelAnimationFrame(frame);
      observer.disconnect();
      appendages.stop();
      reduced.removeEventListener('change', motionChanged);
      window.removeEventListener('pagehide', stop);
    }
    reduced.addEventListener('change', motionChanged);
    window.addEventListener('pagehide', stop);
    // Clicks use the drawn frame's alpha, so the gaps between hair, tail and body pass through.
    function hitPoint(clientX, clientY) {
      if (stopped || !loaded.has(pose)) return null;
      const box = canvas.getBoundingClientRect(),
        x = Math.floor(((clientX - box.left) / box.width) * stage.width),
        y = Math.floor(((clientY - box.top) / box.height) * stage.height);
      if (x < 0 || x >= stage.width || y < 0 || y >= stage.height || ctx.getImageData(x, y, 1, 1).data[3] < 32)
        return null;
      return { x, y };
    }
    function hitRegion(clientX, clientY) {
      const point = hitPoint(clientX, clientY);
      if (!point) return null;
      const [x, y] = appendages.sourcePoint(point.x, point.y);
      return window.lunaBodyShortcuts.regionAt(x, y, stage.center);
    }
    return {
      load,
      react,
      cancel,
      draw,
      stop,
      hitRegion,
      hitTest: (x, y) => !!hitPoint(x, y),
      get motions() {
        return appendages.active;
      },
      get expression() {
        return expression;
      },
      get pose() {
        return pose;
      }
    };
  };
})();
