/* A visual treatment, composited from the production character renderer.
   The document window is set dressing, not a Claudy feature or live desktop capture. */
const film = document.getElementById('film');
const paint = film.getContext('2d');
const pet = document.getElementById('actor');
const actor = window.createLunaCharacter(pet, {
  loadImage: async file => {
    const image = new Image();
    image.src = '../../assets/' + file;
    await image.decode();
    return image;
  }
});
const face = pet.querySelector('canvas');
const ink = '#4b342b';
const rust = '#ad542f';
const ease = x => {
  const y = Math.max(0, Math.min(1, x));
  return y * y * (3 - 2 * y);
};
const seen = new Set();
function text(value, x, y, size = 32, color = ink, weight = 400) {
  paint.fillStyle = color;
  paint.font = `${weight} ${size}px "Microsoft YaHei", sans-serif`;
  paint.fillText(value, x, y);
}
function round(x, y, w, h, radius, color) {
  paint.fillStyle = color;
  paint.beginPath();
  paint.roundRect(x, y, w, h, radius);
  paint.fill();
}
function flower(x, y, r, color) {
  paint.fillStyle = color;
  for (let i = 0; i < 14; i++) {
    const a = (i * Math.PI) / 7;
    paint.beginPath();
    paint.ellipse(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.48, r * 0.15, a, 0, Math.PI * 2);
    paint.fill();
  }
}
function background(t) {
  const fill = paint.createLinearGradient(0, 0, 1920, 1080);
  fill.addColorStop(0, '#fbf7ef');
  fill.addColorStop(1, '#ede1d0');
  paint.fillStyle = fill;
  paint.fillRect(0, 0, 1920, 1080);
  paint.fillStyle = '#e6b99022';
  paint.beginPath();
  paint.ellipse(1580 + Math.sin(t / 8) * 12, 370, 530, 610, -0.4, 0, Math.PI * 2);
  paint.fill();
  flower(115, 94, 25, rust);
  text('Claudy', 158, 107, 36, ink, 600);
  text('WINDOWS 桌面陪伴', 1398, 102, 23, '#8a7768', 400);
}
function subtitle(line, opacity = 1) {
  paint.save();
  paint.globalAlpha = opacity;
  paint.font = '400 35px "Microsoft YaHei", sans-serif';
  const width = paint.measureText(line).width;
  round((1920 - width) / 2 - 32, 942, width + 64, 74, 37, '#fffaf2ef');
  text(line, (1920 - width) / 2, 991, 35);
  paint.restore();
}
function actorAt(x, y, width) {
  paint.imageSmoothingEnabled = true;
  paint.imageSmoothingQuality = 'high';
  paint.drawImage(face, x, y, width, (width * 292) / 384);
}
function intro(t) {
  background(t);
  const reveal = ease(t / 0.8);
  paint.save();
  paint.globalAlpha = reveal;
  text('桌面上，', 156, 358 + (1 - reveal) * 18, 83, ink, 600);
  text('多了一点陪伴。', 156, 477 + (1 - reveal) * 18, 83, ink, 600);
  text('一只慵懒的小桌宠', 160, 570, 33, '#8a7768');
  round(160, 635, 57, 4, 2, rust);
  text('托着下巴，陪你慢慢忙。', 160, 705, 31, '#8a7768');
  paint.restore();
  actorAt(950 - 10 * ease(t / 6), 210 - 6 * ease(t / 6), 790 + 15 * ease(t / 6));
  if (t < 4.8) subtitle('……嗯？你来啦。', ease(t / 0.6) * (1 - ease((t - 4.2) / 0.6)));
}
function desktop(t) {
  background(t);
  // Purpose-built, local demonstration desktop: no personal windows or user data.
  round(128, 192, 1664, 686, 30, '#d9c5ac44');
  round(122, 182, 1676, 686, 30, '#e9e2d5');
  round(180, 226, 1050, 580, 20, '#fffdf8');
  round(180, 226, 1050, 56, 20, '#f4efe5');
  paint.fillStyle = '#f4efe5';
  paint.fillRect(180, 254, 1050, 28);
  text('随手记 · 演示文档', 206, 262, 18, '#968473');
  text('−    □    ×', 1105, 262, 20, '#968473');
  text('今天，慢慢来也可以。', 239, 365, 44, ink, 600);
  text('把手边的事，一件件做好。', 242, 422, 26, '#938577');
  const rows = ['整理今天的灵感', '写下一个小计划', '忙完记得喝口水'];
  rows.forEach((line, i) => {
    round(243, 473 + i * 67, 23, 23, 6, '#eee5d7');
    text(line, 287, 493 + i * 67, 25, '#89796a');
  });
  text('演示桌面', 1656, 217, 16, '#9c8b78');
  actorAt(1233, 455, 535);
  const absolute = t + 6.8;
  for (const touch of [9.4, 13.4]) {
    const distance = absolute - touch;
    if (distance > -0.75 && distance < 0.8) {
      const enter = ease((distance + 0.75) / 0.65);
      const x = 1640 - 114 * enter,
        y = 810 - 209 * enter;
      paint.save();
      paint.globalAlpha = ease((distance + 0.75) / 0.2) * (1 - ease((distance - 0.4) / 0.4));
      paint.translate(x, y);
      paint.beginPath();
      paint.moveTo(0, 0);
      paint.lineTo(3, 32);
      paint.lineTo(12, 23);
      paint.lineTo(20, 38);
      paint.lineTo(27, 34);
      paint.lineTo(19, 20);
      paint.lineTo(32, 18);
      paint.closePath();
      paint.fillStyle = '#fffdf6';
      paint.fill();
      paint.lineWidth = 2;
      paint.strokeStyle = ink;
      paint.stroke();
      if (distance >= 0 && distance < 0.4) {
        paint.beginPath();
        paint.arc(0, 0, 8 + distance * 70, 0, Math.PI * 2);
        paint.strokeStyle = `rgba(173,84,47,${1 - distance / 0.4})`;
        paint.stroke();
      }
      paint.restore();
    }
  }
  text('你忙你的，', 135, 930, 38, ink, 600);
  // This is editorial narration outside the app, never a fabricated in-app bubble.
  if (t < 5) subtitle('我就在这儿，陪你一会儿。', ease(t / 0.5));
  else subtitle('偶尔摸摸头，也会收到一个微笑。', ease((t - 5) / 0.5));
}
function end(t) {
  background(t);
  actorAt(1050, 228, 720);
  text('忙碌的间隙，', 156, 365, 73, ink, 600);
  text('也有她在。', 156, 474, 73, ink, 600);
  text('Claudy · 制作中', 160, 578, 33, '#8a7768');
  round(159, 652, 479, 80, 40, rust);
  text('关注，等她来你的桌面', 195, 704, 29, '#fff8ed', 500);
  text('角色陪伴 / 收藏 / 截图录屏 / 提醒', 160, 797, 26, '#8a7768');
}
window.promoReady = Promise.all([actor.load(), document.fonts.ready]).then(([loaded]) => {
  if (!loaded) throw Error('角色素材未加载');
  return true;
});
window.renderPromoFrame = index => {
  const t = index / 24;
  window.advancePromoClock(t * 1000);
  for (const [at, name] of [
    [2.2, 'ear-right'],
    [9.4, 'smile'],
    [13.4, 'happy']
  ]) {
    if (t >= at && !seen.has(at)) {
      seen.add(at);
      actor.react(name);
    }
  }
  actor.draw(t * 1000);
  if (t < 6.8) intro(t);
  else if (t < 15.8) desktop(t - 6.8);
  else end(t - 15.8);
  // Short cream dip on scene changes; no abrupt full-scene motion.
  for (const cut of [6.8, 15.8]) {
    const opacity = Math.max(0, 1 - Math.abs(t - cut) / 0.23);
    if (opacity) {
      paint.fillStyle = `rgba(249,244,235,${opacity})`;
      paint.fillRect(0, 0, 1920, 1080);
    }
  }
  const fade = 1 - ease(t / 0.4) + ease((t - 19.5) / 0.5);
  if (fade > 0) {
    paint.fillStyle = `rgba(249,244,235,${Math.min(1, fade)})`;
    paint.fillRect(0, 0, 1920, 1080);
  }
  return film.toDataURL('image/png');
};
