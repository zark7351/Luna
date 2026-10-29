// Deterministic local motion from the approved portrait; no new painting or network.
(() => {
  const canvas = document.getElementById('pet');
  const gl = canvas.getContext('webgl', {
    alpha: true,
    premultipliedAlpha: true,
    preserveDrawingBuffer: true,
    antialias: true
  });
  if (!gl) throw Error('无法创建睡姿动画画布');
  function shader(type, source) {
    const result = gl.createShader(type);
    gl.shaderSource(result, source);
    gl.compileShader(result);
    if (!gl.getShaderParameter(result, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(result));
    return result;
  }
  const program = gl.createProgram();
  gl.attachShader(
    program,
    shader(
      gl.VERTEX_SHADER,
      `
    attribute vec2 aPosition;
    uniform float uTime;
    uniform mediump float uTailPass;
    varying vec2 vUV;
    void main() {
      vec2 p = aPosition;
      vUV = p / vec2(1448.0,1086.0);
      float breath = 0.5 - 0.5 * cos(uTime * 6.28318530718 / 6.0);
      // Only the back/hair silhouette and crown breathe; face, cheek contact and arms stay fixed.
      float back = smoothstep(940.0,1080.0,p.x) * smoothstep(380.0,500.0,p.y)
        * (1.0-smoothstep(720.0,805.0,p.y));
      float crown = smoothstep(300.0,440.0,p.x) * (1.0-smoothstep(800.0,940.0,p.x))
        * smoothstep(230.0,320.0,p.y) * (1.0-smoothstep(410.0,500.0,p.y));
      p += vec2(4.0,-12.0) * back * breath + vec2(0.0,-5.0) * crown * breath;
      // One quiet ear flick per six seconds, rooted above the face.
      float q = clamp((uTime-4.35)/0.42,0.0,1.0);
      float angle = 0.04 * sin(q*6.28318530718) * pow(sin(q*3.14159265),2.0);
      float ear = smoothstep(650.0,710.0,aPosition.x) * (1.0-smoothstep(870.0,920.0,aPosition.x))
        * (1.0-smoothstep(300.0,410.0,aPosition.y));
      vec2 d = aPosition-vec2(805.0,410.0);
      p += (vec2(cos(angle)*d.x-sin(angle)*d.y,sin(angle)*d.x+cos(angle)*d.y)-d)*ear;
      // The tail is a separate pass: rotate its whole hook without pulling the foreground hair.
      if (uTailPass > 0.5) {
        float a = 0.032 * sin(uTime * 6.28318530718 / 6.0)
          * (1.0-smoothstep(700.0,775.0,aPosition.y));
        vec2 tail = aPosition-vec2(135.0,905.0);
        p = vec2(135.0,905.0)+vec2(cos(a)*tail.x-sin(a)*tail.y,sin(a)*tail.x+cos(a)*tail.y);
      }
      // Same scale as idle; lowered source baseline is compensated by +32 pixels of top padding.
      vec2 uv = (p+vec2(52.0,80.0))/vec2(1552.0,1182.0);
      gl_Position = vec4(uv.x*2.0-1.0,1.0-uv.y*2.0,0.0,1.0);
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
    uniform sampler2D uImage;
    uniform sampler2D uTailMask;
    uniform mediump float uTailPass;
    varying vec2 vUV;
    void main() {
      float mask = texture2D(uTailMask,vUV).a;
      gl_FragColor = texture2D(uImage,vUV) * (uTailPass > 0.5 ? mask : 1.0-mask);
    }
  `
    )
  );
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(program));
  gl.useProgram(program);
  const clock = gl.getUniformLocation(program, 'uTime');
  const tailPass = gl.getUniformLocation(program, 'uTailPass');
  gl.uniform1i(gl.getUniformLocation(program, 'uImage'), 0);
  gl.uniform1i(gl.getUniformLocation(program, 'uTailMask'), 1);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  let count = 0;
  function drawAt(seconds) {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform1f(clock, ((seconds % 6) + 6) % 6);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(tailPass, 1);
    gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_SHORT, 0);
    gl.uniform1f(tailPass, 0);
    gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_SHORT, 0);
    gl.finish();
  }
  const ready = (async () => {
    const image = new Image();
    image.src = 'sleep-approved.png';
    await image.decode();
    if (image.naturalWidth !== 1448 || image.naturalHeight !== 1086) throw Error('睡姿原图尺寸不符');
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    const mask = document.createElement('canvas');
    mask.width = 1448;
    mask.height = 1086;
    const context = mask.getContext('2d');
    // Follow the transparent corridor outside the complete tail silhouette.
    // Motion reaches zero before the tail joins the painted foreground hair.
    const cut = [
      [0, 490],
      [219, 490],
      [230, 520],
      [253, 540],
      [272, 560],
      [289, 580],
      [303, 600],
      [300, 620],
      [296, 640],
      [291, 660],
      [288, 680],
      [284, 700],
      [280, 720],
      [278, 740],
      [268, 760],
      [250, 790],
      [0, 790]
    ];
    context.beginPath();
    cut.forEach(([x, y], i) => (i ? context.lineTo(x, y) : context.moveTo(x, y)));
    context.closePath();
    context.fill();
    const pixels = context.getImageData(0, 0, 1448, 1086);
    for (let i = 3; i < pixels.data.length; i += 4) pixels.data[i] = pixels.data[i] >= 128 ? 255 : 0;
    context.putImageData(pixels, 0, 0);
    gl.activeTexture(gl.TEXTURE1);
    const tailMask = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tailMask);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    // Complementary binary passes must not create two partially opaque edges.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, mask);
    const vertices = [],
      indices = [],
      columns = 96,
      rows = 72;
    for (let y = 0; y <= rows; y++)
      for (let x = 0; x <= columns; x++) vertices.push((x / columns) * 1448, (y / rows) * 1086);
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < columns; x++) {
        const a = y * (columns + 1) + x,
          b = a + columns + 1;
        indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'aPosition');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    const elements = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, elements);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
    count = indices.length;
    drawAt(0);
    if (!new URLSearchParams(location.search).has('export')) {
      const start = performance.now();
      const tick = time => {
        drawAt((time - start) / 1000);
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
  })();
  window.sleepAnimator = {
    ready,
    drawAt,
    renderFrame: index => {
      drawAt(index / 24);
      return canvas.toDataURL('image/png');
    }
  };
})();
