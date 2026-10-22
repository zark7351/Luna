/* Local animation artwork preview; no application state or network access. */
(() => {
  'use strict';

  const canvas = document.getElementById('pet');
  const gl = canvas.getContext('webgl', {
    alpha: true,
    premultipliedAlpha: true,
    preserveDrawingBuffer: true,
    antialias: true
  });
  if (!gl) throw new Error('此设备暂时无法创建动画画布。');

  const DURATION = 8;
  const FPS = 24;
  const EYES = [
    { cx: 676, cy: 561, w: 182, h: 100, angle: -0.43, lid: 9 },
    { cx: 878, cy: 475, w: 172, h: 106, angle: -0.36, lid: 7 }
  ];
  const smooth = (a, b, value) => {
    const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };

  const loadImage = src =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`无法读取素材：${src}`));
      image.src = src;
    });

  function patch(image, bounds, width, height, offsetX = 0) {
    const result = document.createElement('canvas');
    result.width = bounds.w;
    result.height = bounds.h;
    const ctx = result.getContext('2d', { willReadFrequently: true });
    ctx.translate(bounds.w / 2, bounds.h / 2);
    ctx.rotate(-bounds.angle);
    ctx.drawImage(
      image,
      0,
      0,
      image.naturalWidth,
      image.naturalHeight,
      -bounds.cx + offsetX,
      -bounds.cy,
      width,
      height
    );
    const pixels = ctx.getImageData(0, 0, bounds.w, bounds.h);
    for (let y = 0; y < bounds.h; y++) {
      for (let x = 0; x < bounds.w; x++) {
        const edge = Math.min(x, y, bounds.w - 1 - x, bounds.h - 1 - y);
        pixels.data[(y * bounds.w + x) * 4 + 3] *= smooth(0, 9, edge);
      }
    }
    ctx.putImageData(pixels, 0, 0);
    return result;
  }

  function shader(type, source) {
    const result = gl.createShader(type);
    gl.shaderSource(result, source);
    gl.compileShader(result);
    if (!gl.getShaderParameter(result, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(result));
    }
    return result;
  }

  const program = gl.createProgram();
  gl.attachShader(
    program,
    shader(
      gl.VERTEX_SHADER,
      `
    attribute vec2 aPosition;
    uniform vec2 uSize;
    uniform float uTime;
    varying vec2 vUV;
    float ss(float a, float b, float v) { return smoothstep(a, b, v); }
    float twitch(float t, float start) {
      float q = clamp((t - start) / 0.95, 0.0, 1.0);
      return sin(q * 6.2831853) * pow(sin(q * 3.14159265), 2.0);
    }
    vec2 rotateAround(vec2 p, vec2 pivot, float angle) {
      vec2 d = p - pivot;
      return pivot + vec2(cos(angle)*d.x - sin(angle)*d.y, sin(angle)*d.x + cos(angle)*d.y);
    }
    void main() {
      vec2 p = aPosition;
      vUV = aPosition / uSize;
      float leftEar = (1.0-ss(310.0, 400.0, p.y)) * ss(280.0, 318.0, p.x) * (1.0-ss(490.0, 565.0, p.x));
      float rightEar = (1.0-ss(165.0, 263.0, p.y)) * ss(795.0, 864.0, p.x) * (1.0-ss(1015.0, 1070.0, p.x));
      float leftAngle = 0.095 * twitch(uTime, 2.25) + 0.055 * twitch(uTime, 6.0);
      float rightAngle = -0.075 * twitch(uTime, 2.42) - 0.10 * twitch(uTime, 5.85);
      p += (rotateAround(aPosition, vec2(470.0, 365.0), leftAngle) - aPosition) * leftEar;
      p += (rotateAround(aPosition, vec2(946.0, 240.0), rightAngle) - aPosition) * rightEar;
      float tail = (1.0-ss(255.0, 365.0, aPosition.x));
      tail *= ss(482.0, 528.0, aPosition.y) * (1.0-ss(899.0, 1000.0, aPosition.y));
      float tip = pow(clamp((1000.0-aPosition.y)/470.0, 0.0, 1.0), 1.1);
      float phase = uTime * 6.28318530718 / 8.0;
      float lag = (940.0-aPosition.y)*0.002;
      float wave = sin(phase+lag)-sin(lag);
      p.x += 36.0 * wave * tail * tip;
      p.y += 11.0 * (sin(phase+0.6)-sin(0.6)) * tail * tip;
      vec2 padded = (p + vec2(52.0, 48.0)) / (uSize + vec2(104.0, 96.0));
      gl_Position = vec4(padded.x*2.0-1.0, 1.0-padded.y*2.0, 0.0, 1.0);
    }
  `
    )
  );
  gl.attachShader(
    program,
    shader(
      gl.FRAGMENT_SHADER,
      `
    precision mediump float;
    uniform sampler2D uSprite;
    varying vec2 vUV;
    void main() { gl_FragColor = texture2D(uSprite, vUV); }
  `
    )
  );
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program));
  }
  gl.useProgram(program);
  const position = gl.getAttribLocation(program, 'aPosition');
  const timeUniform = gl.getUniformLocation(program, 'uTime');
  const sizeUniform = gl.getUniformLocation(program, 'uSize');
  gl.uniform1i(gl.getUniformLocation(program, 'uSprite'), 0);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  gl.disable(gl.BLEND);
  gl.clearColor(0, 0, 0, 0);

  const textures = new Map();
  let original, closed, openPatches, closedPatches, indexCount;
  let playing = !new URLSearchParams(location.search).has('export');
  let elapsed = 0;
  let started = performance.now();

  function texture(level) {
    if (textures.has(level)) return textures.get(level);
    const image = document.createElement('canvas');
    image.width = original.naturalWidth;
    image.height = original.naturalHeight;
    const ctx = image.getContext('2d');
    ctx.drawImage(original, 0, 0);
    if (level > 0) {
      const openness = 1 - level / 12;
      for (let i = 0; i < EYES.length; i++) {
        const eye = EYES[i];
        ctx.save();
        ctx.translate(eye.cx, eye.cy);
        ctx.rotate(eye.angle);
        ctx.drawImage(closedPatches[i], -eye.w / 2, -eye.h / 2);
        if (openness > 0) {
          ctx.drawImage(
            openPatches[i],
            -eye.w / 2,
            eye.lid + (-eye.h / 2 - eye.lid) * openness,
            eye.w,
            eye.h * openness
          );
        }
        ctx.restore();
      }
    }
    const result = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, result);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    textures.set(level, result);
    return result;
  }

  function blink(t) {
    for (const start of [1.65, 5.1, 5.55]) {
      const dt = t - start;
      if (dt >= 0 && dt < 0.09) return smooth(0, 0.09, dt);
      if (dt >= 0.09 && dt < 0.16) return 1;
      if (dt >= 0.16 && dt < 0.32) return 1 - smooth(0.16, 0.32, dt);
    }
    return 0;
  }

  function drawAt(seconds) {
    const t = ((seconds % DURATION) + DURATION) % DURATION;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform1f(timeUniform, t);
    gl.bindTexture(gl.TEXTURE_2D, texture(Math.round(blink(t) * 12)));
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawElements(gl.TRIANGLES, indexCount, gl.UNSIGNED_SHORT, 0);
    gl.finish();
  }

  const ready = (async () => {
    [original, closed] = await Promise.all([loadImage('base-transparent.png'), loadImage('blink-closed-source.png')]);
    const w = original.naturalWidth,
      h = original.naturalHeight;
    openPatches = EYES.map(eye => patch(original, eye, w, h));
    closedPatches = EYES.map(eye => patch(closed, eye, w, h, -18));
    gl.uniform2f(sizeUniform, w, h);
    const columns = 112,
      rows = 84,
      vertices = [],
      indices = [];
    for (let row = 0; row <= rows; row++) {
      for (let col = 0; col <= columns; col++) vertices.push((col / columns) * w, (row / rows) * h);
    }
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < columns; col++) {
        const a = row * (columns + 1) + col,
          b = a + columns + 1;
        indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    const elements = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, elements);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
    indexCount = indices.length;
    drawAt(0);
    function tick(now) {
      if (playing) drawAt(elapsed + (now - started) / 1000);
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  })();

  document.getElementById('toggle').addEventListener('click', event => {
    if (playing) elapsed += (performance.now() - started) / 1000;
    else started = performance.now();
    playing = !playing;
    event.target.textContent = playing ? '暂停' : '播放';
  });
  document.getElementById('background').addEventListener('change', event => {
    const stage = document.getElementById('stage');
    stage.style.background =
      event.target.value === 'light' ? '#f3f1f6' : event.target.value === 'dark' ? '#24212c' : '';
  });

  window.idleAnimator = {
    ready,
    duration: DURATION,
    fps: FPS,
    drawAt,
    renderFrame: frame => {
      drawAt(frame / FPS);
      return canvas.toDataURL('image/png');
    },
    pixelsAt: seconds => {
      drawAt(seconds);
      const pixels = new Uint8Array(canvas.width * canvas.height * 4);
      gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      return Array.from(pixels);
    }
  };
})();
