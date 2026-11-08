const canvas = document.getElementById('film');
const ctx = canvas.getContext('2d');
const host = document.getElementById('actor');
const actor = window.createLunaCharacter(host, {
  loadImage: async file => {
    const image = new Image();
    image.src = '../../assets/' + file;
    await image.decode();
    return image;
  }
});
const pet = host.querySelector('canvas');
const images = new Map();
let scenes;
const fired = new Set();
const ink = '#372923';
const orange = '#b9542d';
const ease = x => {
  const v = Math.min(1, Math.max(0, x));
  return v * v * (3 - 2 * v);
};
function box(x, y, w, h, radius, color) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.fillStyle = color;
  ctx.fill();
}
function text(s, x, y, size, color = ink, weight = 400) {
  ctx.font = weight + ' ' + size + 'px "Microsoft YaHei", sans-serif';
  ctx.fillStyle = color;
  ctx.fillText(s, x, y);
}
function paintPet(x, y, w) {
  ctx.drawImage(pet, x, y, w, (w * 292) / 384);
}
function clickAt(x, y, t) {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(4, 37);
  ctx.lineTo(13, 27);
  ctx.lineTo(20, 42);
  ctx.lineTo(26, 39);
  ctx.lineTo(19, 24);
  ctx.lineTo(34, 21);
  ctx.closePath();
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.strokeStyle = ink;
  ctx.lineWidth = 2;
  ctx.stroke();
  if (t >= 0 && t < 0.52) {
    ctx.globalAlpha = 1 - t / 0.52;
    ctx.beginPath();
    ctx.arc(0, 0, 12 + t * 65, 0, Math.PI * 2);
    ctx.strokeStyle = orange;
    ctx.lineWidth = 4;
    ctx.stroke();
  }
  ctx.restore();
}
function subtitle(s) {
  ctx.font = '500 39px "Microsoft YaHei", sans-serif';
  const lines = [''];
  for (const char of s) {
    const last = lines.length - 1;
    if (ctx.measureText(lines[last] + char).width > 1570 && !'，。！、～'.includes(char)) lines.push(char);
    else lines[last] += char;
  }
  if (lines.length === 2) {
    const breaks = [...s.matchAll(/[，。！、]/g)]
      .map(match => match.index + 1)
      .filter(i => i > s.length * 0.35 && i < s.length * 0.65);
    const middle = s.length / 2;
    breaks.sort((a, b) => Math.abs(a - middle) - Math.abs(b - middle));
    const split = breaks[0];
    if (split && Math.max(ctx.measureText(s.slice(0, split)).width, ctx.measureText(s.slice(split)).width) <= 1570) {
      lines[0] = s.slice(0, split);
      lines[1] = s.slice(split);
    }
  }
  const widths = lines.map(line => ctx.measureText(line).width);
  const width = Math.max(...widths);
  const offset = (lines.length - 1) * 51;
  box((1920 - width) / 2 - 28, 948 - offset, width + 56, 70 + offset, 15, '#2b211deF');
  lines.forEach((line, i) => text(line, (1920 - widths[i]) / 2, 995 - offset + i * 51, 39, '#fff7ef', 500));
}
const custom = new Set(['intro', 'interact', 'drag', 'end']);
window.prepareShort = async (plan, base) => {
  scenes = plan;
  const names = [...new Set(plan.flatMap(scene => scene.shots))].filter(name => !custom.has(name));
  await Promise.all(
    names.map(async name => {
      const image = new Image();
      image.src = base + name + '.png';
      await image.decode();
      images.set(name, image);
    })
  );
  if (!(await actor.load())) throw Error('角色素材加载失败');
};
const crops = {
  library: [0, 0, 740, 335],
  'screenshot-saved': [0, 0, 600, 326],
  'recording-adjust': [138, 91, 680, 442],
  'reminder-weekly': [0, 0, 256, 228],
  'reminder-countdown': [0, 0, 256, 226]
};
const labels = {
  library: '拖入收藏',
  'library-search': '搜索收藏',
  'screenshot-selection': '框选截图',
  'screenshot-saved': '自动保存到收藏夹',
  'recording-adjust': '区域录屏',
  'reminder-weekly': '每天 / 每周提醒',
  'reminder-countdown': '倒计时',
  menu: '右键功能菜单',
  compact: '精简模式'
};
window.shortFrame = frame => {
  window.advancePromoClock((frame * 1000) / 24);
  const index = scenes.findIndex(s => frame < s.start + s.frames);
  const scene = scenes[index];
  const local = (frame - scene.start) / 24;
  const progress = (frame - scene.start) / scene.frames;
  const shot = scene.shots[Math.min(scene.shots.length - 1, Math.floor(progress * scene.shots.length))];
  const gradient = ctx.createLinearGradient(0, 0, 1920, 1080);
  gradient.addColorStop(0, '#fff8ed');
  gradient.addColorStop(1, '#efd9c7');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1920, 1080);
  if (shot === 'intro' || shot === 'end') {
    text('Claudy', 147, 481, 131, ink, 700);
    const tag = scene.v4 ? '关注＋充电，即可私信获取软件' : '关注，等发布';
    text(shot === 'intro' ? '一款多功能 Windows 桌宠' : tag, 154, 562, 38, orange, 500);
    actor.draw(window.promoTime);
    paintPet(870 - progress * 20, 137, 892 + progress * 28);
  } else if (shot === 'interact' || shot === 'drag') {
    const [x, y, w] = [540, 105, 840];
    const taps = [
      { at: 0.95, kind: 'ear-right', px: 0.65, py: 0.17 },
      { at: 2.62, kind: 'tail', px: 0.16, py: 0.56 }
    ];
    if (shot === 'interact') {
      for (const tap of taps) {
        if (local >= tap.at && !fired.has(tap.kind)) {
          fired.add(tap.kind);
          actor.react(tap.kind);
        }
      }
    }
    actor.draw(window.promoTime);
    paintPet(x, y, w);
    if (shot === 'interact') {
      for (const tap of taps) {
        if (local >= tap.at - 0.35 && local < tap.at + 0.7)
          clickAt(x + w * tap.px, y + ((w * 292) / 384) * tap.py, local - tap.at);
      }
    } else {
      const p = ease((local - 0.25) / 1.65);
      const cardX = 245 + p * 700,
        cardY = 326 + p * 168;
      if (scene.v4 && local < 2.1) {
        const library = images.get('library');
        box(cardX, cardY - 50, 230, 126, 14, '#fffdf8');
        ctx.drawImage(library, 24, 139, 176, 98, cardX + 12, cardY - 40, 206, 104);
        clickAt(cardX + 198, cardY + 46, -1);
      } else if (scene.v4) {
        box(880, 123, 160, 54, 15, '#fffdf8');
        text('已收藏', 913, 159, 29, orange, 600);
      } else if (local < 2.1) {
        box(cardX, cardY, 265, 73, 14, '#fffdf8');
        text('文字 / 链接 / 文件', cardX + 20, cardY + 46, 26);
        clickAt(cardX + 238, cardY + 46, -1);
      }
    }
  } else {
    const img = images.get(shot);
    const crop = crops[shot] || [0, 0, img.width, img.height];
    const scale = Math.min(1550 / crop[2], 750 / crop[3], shot === 'compact' ? 4 : 2.8);
    const zoom = 0.985 + ease((progress * scene.shots.length) % 1) * 0.025;
    const w = crop[2] * scale * zoom,
      h = crop[3] * scale * zoom;
    const x = (1920 - w) / 2,
      y = 509 - h / 2;
    ctx.save();
    ctx.shadowColor = '#3b21182c';
    ctx.shadowBlur = 36;
    ctx.shadowOffsetY = 10;
    ctx.drawImage(img, ...crop, x, y, w, h);
    ctx.restore();
    const label = labels[shot];
    if (label) text(label, 95, 103, 38, orange, 650);
  }
  subtitle(scene.say);
  return canvas.toDataURL('image/png');
};
