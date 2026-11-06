// Actual application screenshots, arranged as an annotated step-by-step tutorial.
// The screenshot source is an isolated fixture; no personal desktop is captured.
const scenes = [
  {
    length: 6,
    image: 'menu',
    chapter: '功能入口',
    title: ['右键，打开菜单'],
    lines: ['在角色上单击鼠标右键', '点击图标，打开对应工具', '按 Esc 关闭菜单'],
    caption: '收藏、截图、录屏、提醒，都从这里进入。',
    mark: [0.5, 0.17]
  },
  {
    length: 6,
    image: 'pet',
    chapter: '收藏',
    title: ['直接拖入收藏'],
    lines: ['选中文字、链接或本地文件', '拖到角色上，松开鼠标', '保存后会出现操作反馈'],
    caption: '文字、链接和文件，都可以拖进来。',
    drag: true
  },
  {
    length: 7,
    image: 'library',
    chapter: '收藏',
    title: ['查看与管理收藏'],
    lines: ['Ctrl + Alt + C 打开小收藏夹', '点击放大按钮，打开大收藏夹', '分类查看、预览和打开内容'],
    caption: '本地文件默认记录路径；需要独立保存时，选择“保存副本”。',
    mark: [0.035, 0.035]
  },
  {
    length: 5,
    image: 'library-search',
    chapter: '收藏',
    title: ['输入关键词搜索'],
    lines: ['点击顶部搜索框', '输入关键词', '在全部收藏中查找'],
    caption: '搜索框会在全部收藏里搜索。',
    mark: [0.52, 0.035]
  },
  {
    length: 7,
    image: 'screenshot-selection',
    chapter: '截图',
    title: ['框选截图'],
    lines: ['按 Ctrl + Alt + A', '按住左键，拖出截图范围', '松开鼠标，保存为 PNG'],
    caption: '按 Esc 或鼠标右键，可以取消截图。'
  },
  {
    length: 5,
    image: 'screenshot-saved',
    chapter: '截图',
    title: ['截图自动归档'],
    lines: ['截图自动加入“图片与视频”', '点击图片预览', '卡片可复制或定位文件'],
    caption: '无需手动导入，截图保存后就能在收藏夹找到。',
    mark: [0.08, 0.035]
  },
  {
    length: 6,
    image: 'recording',
    chapter: '录屏',
    title: ['打开区域录屏'],
    lines: ['右键菜单选择“录屏”', '点击面板中的框选按钮', '也可按 Ctrl + Alt + R 直接框选'],
    caption: '快捷键默认打开框选；选择范围后还需点击开始。',
    mark: [0.27, 0.53]
  },
  {
    length: 7,
    image: 'recording-adjust',
    chapter: '录屏',
    title: ['调整后再开始'],
    lines: ['拖动四边或四角调整范围', '点击圆点开始，方块停止', '停止后自动收藏 MP4'],
    caption: '当前只录画面，不录麦克风或系统声音。',
    crop: [145, 98, 670, 425],
    mark: [0.91, 0.07]
  },
  {
    length: 7,
    image: 'reminder-weekly',
    chapter: '提醒',
    title: ['设置重复提醒'],
    lines: ['打开“提醒”，填写内容', '选择每天，或每周指定日期', '设置时刻，点击勾号保存'],
    caption: '示例：每周一、三、五 16:00 整理项目资料。',
    mark: [0.9, 0.52]
  },
  {
    length: 5,
    image: 'reminder-saved',
    chapter: '提醒',
    title: ['完成本次，排下次'],
    lines: ['保存后显示在待提醒列表', '点击卡片勾号，完成本次', '周期提醒自动排到下一次'],
    caption: '到点会显示持续气泡，也可点击气泡右侧勾号完成。'
  },
  {
    length: 5,
    image: 'reminder-countdown',
    chapter: '提醒',
    title: ['也支持倒计时'],
    lines: ['切换到沙漏页签', '填写时、分、秒', '点击勾号保存'],
    caption: '应用需要保持运行，退出后不会在后台提醒。',
    mark: [0.73, 0.245]
  },
  {
    length: 6,
    image: 'hotkeys',
    chapter: '设置',
    title: ['修改快捷键'],
    lines: ['打开“设置”，找到快捷键', '点击输入框，按下组合键', '点击底部勾号，保存设置'],
    caption: '支持截图、录屏、收藏夹、提醒和精简模式五项。',
    mark: [0.56, 0.22]
  },
  {
    length: 5,
    image: 'compact',
    chapter: '精简模式',
    title: ['只保留功能入口'],
    lines: ['在右键菜单开启“精简模式”', '点击小花，打开功能菜单', '按住小花可拖动位置'],
    caption: '重新关闭“精简模式”，恢复角色显示。'
  },
  {
    length: 3,
    image: 'menu',
    chapter: 'Claudy',
    title: ['功能演示到这里'],
    lines: ['收藏 / 截图 / 区域录屏', '定时与周期提醒 / 快捷键'],
    caption: '关注，等待 Claudy 发布。'
  }
];
const canvas = document.getElementById('film');
const ctx = canvas.getContext('2d');
const images = new Map();
const ink = '#302c29',
  orange = '#c25c35';
const ease = value => {
  const x = Math.max(0, Math.min(1, value));
  return x * x * (3 - 2 * x);
};
function write(text, x, y, size, color = ink, weight = 400) {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px "Microsoft YaHei", sans-serif`;
  ctx.fillText(text, x, y);
}
function box(x, y, w, h, radius, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.fill();
}
window.initializeFunctional = async base => {
  let time = 0;
  for (const scene of scenes) {
    scene.start = time;
    time += scene.length;
  }
  await Promise.all(
    [...new Set(scenes.map(scene => scene.image))].map(async name => {
      const image = new Image();
      image.src = base + name + '.png';
      await image.decode();
      images.set(name, image);
    })
  );
  await document.fonts.ready;
  return { seconds: time, scenes };
};
window.renderFunctionalFrame = index => {
  const t = index / 24;
  const scene = scenes.find(scene => t < scene.start + scene.length) || scenes.at(-1);
  const local = t - scene.start;
  ctx.fillStyle = '#f7f7f5';
  ctx.fillRect(0, 0, 1920, 1080);
  write('Claudy', 80, 92, 38, ink, 700);
  write('功能与操作演示', 260, 91, 28, '#6f6c68');
  write(String(scenes.indexOf(scene) + 1).padStart(2, '0') + ' / ' + scenes.length, 1720, 90, 25, '#77746e');
  ctx.fillStyle = '#e1e1db';
  ctx.fillRect(80, 121, 1760, 1);
  write(scene.chapter, 80, 210, 27, orange, 600);
  scene.title.forEach((line, i) => write(line, 77, 298 + i * 64, 47, ink, 700));
  scene.lines.forEach((line, i) => {
    const active = Math.min(scene.lines.length - 1, Math.floor(local / (scene.length / scene.lines.length))) === i;
    box(80, 365 + i * 105, 38, 38, 19, active ? orange : '#dfdfd7');
    write(String(i + 1), 92, 392 + i * 105, 22, active ? '#fff' : '#77746e', 600);
    // Deliberate wrap for tutorial text, rather than shrinking it.
    const letters = [...line];
    let first = '',
      second = '';
    ctx.font = '400 28px "Microsoft YaHei", sans-serif';
    for (const ch of letters) {
      if (!second && ctx.measureText(first + ch).width <= 420) first += ch;
      else second += ch;
    }
    write(first, 137, 393 + i * 105, 28);
    if (second) write(second, 137, 433 + i * 105, 28);
  });
  box(630, 165, 1210, 735, 20, '#eeeee9');
  const image = images.get(scene.image);
  const source = scene.crop || [0, 0, image.naturalWidth, image.naturalHeight];
  const maxScale = scene.image === 'compact' ? 3 : scene.image === 'pet' ? 1.9 : 2.3;
  const scale = Math.min(1160 / source[2], 690 / source[3], maxScale);
  const w = source[2] * scale,
    h = source[3] * scale;
  const x = 1235 - w / 2,
    y = 532 - h / 2;
  ctx.save();
  ctx.imageSmoothingQuality = 'high';
  ctx.shadowColor = '#2f29241c';
  ctx.shadowBlur = 22;
  ctx.shadowOffsetY = 7;
  ctx.drawImage(image, ...source, x, y, w, h);
  ctx.restore();
  if (scene.mark) {
    const mx = x + scene.mark[0] * w,
      my = y + scene.mark[1] * h;
    const pulse = 1 + Math.sin(local * 2.5) * 0.1;
    ctx.beginPath();
    ctx.arc(mx, my, 28 * pulse, 0, Math.PI * 2);
    ctx.strokeStyle = '#d35a31';
    ctx.lineWidth = 4;
    ctx.stroke();
  }
  if (scene.drag) {
    const progress = ease((local % 3) / 2);
    const dx = 780 + progress * 410,
      dy = 370 + progress * 140;
    box(dx, dy, 210, 58, 9, '#fff');
    write('文字 / 链接 / 文件', dx + 15, dy + 37, 21);
    ctx.beginPath();
    ctx.moveTo(dx + 210, dy + 44);
    ctx.lineTo(dx + 215, dy + 71);
    ctx.lineTo(dx + 237, dy + 59);
    ctx.closePath();
    ctx.fillStyle = '#403b34';
    ctx.fill();
  }
  box(80, 961, 1760, 72, 12, '#2f2b28');
  const captionSize = scene.caption.length > 40 ? 28 : 31;
  ctx.font = `400 ${captionSize}px "Microsoft YaHei", sans-serif`;
  write(scene.caption, (1920 - ctx.measureText(scene.caption).width) / 2, 1007, captionSize, '#fff');
  ctx.fillStyle = orange;
  ctx.fillRect(0, 1074, (1920 * t) / 80, 6);
  return canvas.toDataURL('image/png');
};
