// Local deformations of the currently drawn frame, so idle timing and the face never jump on a click.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.claudeAppendages = factory();
})(globalThis, () => {
  const durations = Object.freeze({ 'ear-left': 0.52, 'ear-right': 0.52, tail: 1.32 });
  const patches = Object.freeze({
    'ear-left': [64, 24, 111, 96],
    'ear-right': [195, 0, 107, 106],
    tail: [0, 115, 126, 165]
  });
  // The cut follows the transparent gap beside the tail, then the hair overlap.
  // Everything on the hair side remains an untransformed foreground layer.
  const tailCut = Object.freeze([
    [0, 118],
    [94, 118],
    [96, 155],
    [102, 171],
    [110, 178],
    [102, 185],
    [97, 190],
    [98, 202],
    [84, 210],
    [76, 218],
    [68, 227],
    [0, 227]
  ]);
  const areas = [
    [
      'ear-left',
      [
        [83, 55],
        [142, 53],
        [146, 77],
        [132, 104],
        [109, 106],
        [91, 84]
      ]
    ],
    [
      'ear-right',
      [
        [215, 33],
        [248, 8],
        [262, 27],
        [276, 77],
        [245, 84],
        [223, 64]
      ]
    ],
    [
      'tail',
      [
        [16, 137],
        [62, 131],
        [93, 144],
        [107, 169],
        [103, 191],
        [89, 215],
        [69, 248],
        [55, 267],
        [25, 267],
        [32, 238],
        [43, 211],
        [53, 185],
        [45, 172],
        [16, 172]
      ]
    ]
  ];
  function contains(points, x, y) {
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const [xi, yi] = points[i],
        [xj, yj] = points[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  const regionAt = (x, y) => areas.find(([, points]) => contains(points, x, y))?.[0] || null;
  const clamp = value => Math.max(0, Math.min(1, value));
  function smooth(a, b, value) {
    const q = clamp((value - a) / (b - a));
    return q * q * (3 - 2 * q);
  }
  function pulse(t, start, duration) {
    const q = (t - start) / duration;
    return q > 0 && q < 1 ? Math.sin(Math.PI * q) ** 2 : 0;
  }
  function earAngle(t) {
    if (!Number.isFinite(t)) return 0;
    // A fast muscular flick, recoil, then a smaller second flick; no metronomic oscillation.
    return (
      -0.22 * pulse(t, 0, 0.14) +
      0.075 * pulse(t, 0.12, 0.12) -
      0.13 * pulse(t, 0.25, 0.14) +
      0.035 * pulse(t, 0.37, 0.14)
    );
  }
  function angleTrack(t, keys) {
    if (!Number.isFinite(t) || t <= 0 || t >= durations.tail) return 0;
    for (let i = 1; i < keys.length; i++) {
      const [end, angle] = keys[i];
      if (t > end) continue;
      const [start, previous] = keys[i - 1];
      const q = (t - start) / (end - start);
      const ease = q * q * q * (q * (q * 6 - 15) + 10);
      return previous + (angle - previous) * ease;
    }
    return 0;
  }
  const tailRootKeys = [
    [0, 0],
    [0.28, -0.095],
    [0.76, 0.022],
    [1.32, 0]
  ];
  const tailTipKeys = [
    [0, 0],
    [0.1, 0],
    [0.38, 0.028],
    [0.86, -0.012],
    [1.32, 0]
  ];
  function tailAngles(t) {
    return [angleTrack(t, tailRootKeys), angleTrack(t, tailTipKeys)];
  }
  const tailSample = (x, y) => contains(tailCut, x, y);
  function tailPoint(x, y, time) {
    const [root, follow] = tailAngles(time);
    // Keep the whole hook rigid. Only the hidden lower stem bends into its root.
    const angle = (root + follow * 0.35) * (1 - smooth(202, 226, y));
    if (!angle) return [x, y];
    const vx = x - 58,
      vy = y - 225;
    return [58 + Math.cos(angle) * vx - Math.sin(angle) * vy, 225 + Math.sin(angle) * vx + Math.cos(angle) * vy];
  }
  function deform(x, y, times = {}) {
    const ox = (x / 384) * 1552 - 52,
      oy = (y / 292) * 1182 - 48;
    let dx = 0,
      dy = 0;
    for (const [name, px, py, weight, sign] of [
      ['ear-left', 470, 365, (1 - smooth(310, 400, oy)) * smooth(280, 318, ox) * (1 - smooth(490, 565, ox)), 1],
      ['ear-right', 946, 240, (1 - smooth(165, 263, oy)) * smooth(795, 864, ox) * (1 - smooth(1015, 1070, ox)), -1]
    ]) {
      const angle = sign * earAngle(times[name]);
      if (!angle || !weight) continue;
      const vx = ox - px,
        vy = oy - py;
      dx += (Math.cos(angle) * vx - Math.sin(angle) * vy - vx) * weight;
      dy += (Math.sin(angle) * vx + Math.cos(angle) * vy - vy) * weight;
    }
    const point = [x + (dx * 384) / 1552, y + (dy * 292) / 1182];
    return Number.isFinite(times.tail) && tailSample(x, y) ? tailPoint(...point, times.tail) : point;
  }
  function createController({ now = () => performance.now() } = {}) {
    const active = new Map();
    function times(at = now()) {
      const result = {};
      for (const [name, start] of active) {
        const elapsed = Math.max(0, (at - start) / 1000);
        if (elapsed >= durations[name]) active.delete(name);
        else result[name] = elapsed;
      }
      return result;
    }
    return {
      times,
      play(name) {
        if (!Object.hasOwn(durations, name)) return false;
        times();
        if (active.has(name)) return false; // Ignore repeated pokes instead of stacking or restarting a snap.
        active.set(name, now());
        return true;
      },
      clear: () => active.clear(),
      get active() {
        return Object.keys(times());
      }
    };
  }
  function createRenderer(canvas, options = {}) {
    const controller = createController(options);
    let output,
      gl,
      program,
      vertices,
      buffer,
      indices,
      texture,
      tailLayer,
      foreground,
      tailMask,
      lost = false;
    function init() {
      output = document.createElement('canvas');
      output.width = 384;
      output.height = 292;
      gl = output.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false });
      if (!gl) throw Error('Local character motion is unavailable');
      output.addEventListener('webglcontextlost', event => {
        event.preventDefault();
        lost = true;
        controller.clear();
      });
      const shader = (type, text) => {
        const value = gl.createShader(type);
        gl.shaderSource(value, text);
        gl.compileShader(value);
        if (!gl.getShaderParameter(value, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(value));
        return value;
      };
      program = gl.createProgram();
      gl.attachShader(
        program,
        shader(
          gl.VERTEX_SHADER,
          'attribute vec2 p;attribute vec2 uv;varying vec2 v;void main(){v=uv;gl_Position=vec4(p.x/192.0-1.0,1.0-p.y/146.0,0.0,1.0);}'
        )
      );
      gl.attachShader(
        program,
        shader(
          gl.FRAGMENT_SHADER,
          'precision mediump float;uniform sampler2D sprite;varying vec2 v;void main(){gl_FragColor=texture2D(sprite,v);}'
        )
      );
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(program));
      gl.useProgram(program);
      const columns = 64,
        rows = 48,
        elements = [];
      vertices = new Float32Array((columns + 1) * (rows + 1) * 4);
      for (let row = 0; row <= rows; row++)
        for (let col = 0; col <= columns; col++) {
          const offset = (row * (columns + 1) + col) * 4;
          vertices[offset + 2] = col / columns;
          vertices[offset + 3] = row / rows;
          if (row < rows && col < columns) {
            const a = row * (columns + 1) + col,
              b = a + columns + 1;
            elements.push(a, b, a + 1, a + 1, b, b + 1);
          }
        }
      buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      for (const [name, offset] of [
        ['p', 0],
        ['uv', 8]
      ]) {
        const location = gl.getAttribLocation(program, name);
        gl.enableVertexAttribArray(location);
        gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 16, offset);
      }
      indices = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indices);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(elements), gl.STATIC_DRAW);
      texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.uniform1i(gl.getUniformLocation(program, 'sprite'), 0);
      gl.viewport(0, 0, 384, 292);
      gl.clearColor(0, 0, 0, 0);
      const surface = () => {
        const value = document.createElement('canvas');
        value.width = 384;
        value.height = 292;
        return value;
      };
      tailLayer = surface();
      foreground = surface();
      tailMask = surface();
      const mask = tailMask.getContext('2d');
      mask.beginPath();
      tailCut.forEach(([x, y], i) => (i ? mask.lineTo(x, y) : mask.moveTo(x, y)));
      mask.closePath();
      mask.fill();
      const cutPixels = mask.getImageData(0, 0, 384, 292);
      for (let i = 3; i < cutPixels.data.length; i += 4) cutPixels.data[i] = cutPixels.data[i] >= 128 ? 255 : 0;
      mask.putImageData(cutPixels, 0, 0);
    }
    function renderMesh(source, transform) {
      for (let i = 0; i < vertices.length; i += 4) {
        const point = transform(vertices[i + 2] * 384, vertices[i + 3] * 292);
        vertices[i] = point[0];
        vertices[i + 1] = point[1];
      }
      gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawElements(gl.TRIANGLES, 64 * 48 * 6, gl.UNSIGNED_SHORT, 0);
    }
    return {
      play(name) {
        if (lost) return false;
        try {
          if (!gl) init();
          return controller.play(name);
        } catch (error) {
          lost = true;
          console.warn(error.message);
          return false;
        }
      },
      draw(ctx, at) {
        const times = controller.times(at),
          names = Object.keys(times);
        if (!names.length || lost || !gl) return;
        const ears = names.filter(name => name !== 'tail');
        const earTimes = { ...times, tail: undefined };
        if (ears.length) renderMesh(canvas, (x, y) => deform(x, y, earTimes));
        for (const name of ears) {
          const [x, y, w, h] = patches[name];
          ctx.clearRect(x, y, w, h);
          ctx.drawImage(output, x, y, w, h, x, y, w, h);
        }
        if (names.includes('tail') && tailAngles(times.tail).some(angle => angle !== 0)) {
          const layer = tailLayer.getContext('2d'),
            front = foreground.getContext('2d');
          for (const target of [layer, front]) {
            target.clearRect(0, 0, 384, 292);
            target.drawImage(canvas, 0, 0);
            target.save();
            target.globalCompositeOperation = target === layer ? 'destination-in' : 'destination-out';
            target.drawImage(tailMask, 0, 0);
            target.restore();
          }
          renderMesh(tailLayer, (x, y) => tailPoint(x, y, times.tail));
          const [x, y, w, h] = patches.tail;
          ctx.clearRect(x, y, w, h);
          ctx.drawImage(output, x, y, w, h, x, y, w, h);
          ctx.drawImage(foreground, x, y, w, h, x, y, w, h);
        }
      },
      sourcePoint(x, y) {
        const times = controller.times();
        let px = x,
          py = y;
        for (let i = 0; i < 4; i++) {
          const [dx, dy] = deform(px, py, times);
          px += x - dx;
          py += y - dy;
        }
        return [px, py];
      },
      clear: controller.clear,
      get active() {
        return controller.active;
      },
      stop() {
        controller.clear();
        lost = true;
        if (!gl) return;
        gl.deleteTexture(texture);
        gl.deleteBuffer(buffer);
        gl.deleteBuffer(indices);
        gl.deleteProgram(program);
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        for (const surface of [tailLayer, foreground, tailMask]) if (surface) surface.width = surface.height = 0;
      }
    };
  }
  return Object.freeze({
    durations,
    patches,
    regionAt,
    deform,
    earAngle,
    tailAngles,
    tailPoint,
    tailSample,
    tailCut,
    createController,
    createRenderer
  });
});
