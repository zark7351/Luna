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
      loaded = new Map(),
      failed = new Set();
    const appendages = window.claudeAppendages.createRenderer(canvas);
    let expression = 'neutral',
      pose = 'idle',
      poseStart = performance.now(),
      reaction = null,
      reactionStart = 0,
      smilePatch = null,
      happyPatches = [],
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
    function makePatch(image, bounds, feather = {}) {
      const [, , w, h] = bounds;
      const patch = document.createElement('canvas');
      patch.width = w;
      patch.height = h;
      const paint = patch.getContext('2d');
      paint.drawImage(image, ...bounds, 0, 0, w, h);
      paint.globalCompositeOperation = 'destination-in';
      paint.translate(w / 2, h / 2);
      paint.rotate(feather.angle || 0);
      paint.scale(...(feather.radius || [w / 2, h / 2]));
      const mask = paint.createRadialGradient(0, 0, feather.inner ?? 0.64, 0, 0, 1);
      mask.addColorStop(0, '#fff');
      mask.addColorStop(1, 'transparent');
      paint.fillStyle = mask;
      paint.fillRect(-1, -1, 2, 2);
      return patch;
    }
    async function loadHappy() {
      try {
        const image = await loadImage(assets.happy.file);
        if (stopped) return;
        if (image.naturalWidth !== assets.happy.sourceSize[0] || image.naturalHeight !== assets.happy.sourceSize[1])
          throw Error('Happy source size mismatch');
        happyPatches = assets.happy.patches.map(patch => ({
          image: makePatch(image, patch.source, patch.mask),
          target: patch.target
        }));
      } catch (error) {
        console.warn('开心笑素材加载失败', error.message);
      }
    }
    async function loadSmile() {
      try {
        const image = await loadImage(assets.smile.file);
        if (stopped) return;
        const [width, height] = assets.smile.sourceSize;
        if (image.naturalWidth !== width || image.naturalHeight !== height) throw Error('Smile source size mismatch');
        smilePatch = makePatch(image, assets.smile.crop);
      } catch (error) {
        console.warn('微笑素材加载失败', error.message);
      }
    }
    function getImage(name) {
      const definition = assets.poses[name];
      if (!images.has(name)) {
        const loading = Promise.resolve()
          .then(() => loadImage(definition.file))
          .then(image => {
            assets.validateImage(definition, image);
            if (!stopped) loaded.set(name, image);
            return image;
          });
        images.set(name, loading);
        loading.catch(error => {
          failed.add(name);
          console.warn('角色素材加载失败', error.message);
          if (images.get(name) === loading) images.delete(name);
        });
      }
      return images.get(name);
    }
    function currentExpression() {
      if (pet.classList.contains('sleeping')) return 'sleeping';
      // The CSS interaction class also marks arms/chest clicks; it is not a painted happy expression.
      return reaction || 'neutral';
    }
    function draw(time = performance.now()) {
      if (stopped) return;
      expression = currentExpression();
      canvas.dataset.expression = expression;
      const requested = assets.poseFor(expression),
        wanted = failed.has(requested) ? 'idle' : requested;
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
        // If optional sleep art fails, retain a slower visible idle instead of a blank character.
        speed = expression === 'sleeping' && pose === 'idle' ? 0.5 : 1,
        index = reduced.matches ? 0 : assets.frameAt(definition, ((time - poseStart) / 1000) * speed);
      canvas.dataset.frame = index;
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
      if (pose === 'idle') appendages.draw(ctx, time);
      if (expression === 'smile' && smilePatch) {
        ctx.save();
        ctx.globalCompositeOperation = 'source-atop';
        ctx.globalAlpha = assets.smileOpacity(time - reactionStart, reduced.matches);
        ctx.drawImage(smilePatch, ...assets.smile.target);
        ctx.restore();
      }
      if (expression === 'happy') {
        const patches = happyPatches.length
          ? happyPatches
          : smilePatch
            ? [{ image: smilePatch, target: assets.smile.target }]
            : [];
        ctx.save();
        ctx.globalCompositeOperation = 'source-atop';
        ctx.globalAlpha = assets.happyOpacity(time - reactionStart, reduced.matches);
        for (const patch of patches) ctx.drawImage(patch.image, ...patch.target);
        ctx.restore();
      }
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
    function cancel(keepAppendages = false) {
      for (const timer of timers) clearTimeout(timer);
      timers = [];
      reaction = null;
      if (!keepAppendages) appendages.clear();
      canvas.getAnimations().forEach(animation => animation.cancel());
      draw();
    }
    async function load() {
      if (stopped) return false;
      try {
        await Promise.all([getImage('idle'), getImage('sleep').catch(() => {}), loadSmile(), loadHappy()]);
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
        if (stopped || reduced.matches || pose !== 'idle' || pet.classList.contains('sleeping') || !loaded.has('idle'))
          return false;
        const started = appendages.play(name);
        draw();
        return started;
      }
      const types = {
        collect: 'smile',
        capture: 'wink',
        recording: 'wink',
        'reminder-save': 'wink',
        reminder: 'neutral',
        complete: 'happy',
        wink: 'wink',
        smile: 'smile',
        shy: 'shy',
        happy: 'happy',
        pout: 'pout',
        sleepy: 'closed'
      };
      if (!Object.hasOwn(types, name) || stopped) return false;
      if (reaction === 'smile' && types[name] === 'smile') return true;
      if (reaction === 'happy' && ['happy', 'smile'].includes(types[name])) return true;
      cancel(['smile', 'happy'].includes(types[name]));
      if (pet.classList.contains('sleeping')) return true;
      reaction = types[name];
      reactionStart = performance.now();
      draw();
      // Missing painted poses keep idle; never substitute whole-body movement.
      timers.push(
        setTimeout(
          () => {
            reaction = null;
            draw();
          },
          reaction === 'happy'
            ? assets.happy.duration
            : reaction === 'smile'
              ? assets.smile.duration
              : name === 'reminder'
                ? 2400
                : 1800
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
      if (pet.classList.contains('sleeping')) return 'wake';
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
