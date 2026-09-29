const defaults = { name: '露娜', nickname: '', top: true };

function validate(input = {}) {
  const s = { ...defaults };
  for (const [key, max] of Object.entries({ name: 24, nickname: 40 })) {
    s[key] = String(input[key] ?? defaults[key]).trim().slice(0, max);
  }
  s.name ||= defaults.name;
  s.top = input.top !== false;
  return s;
}

function offline(text, s) {
  const who = s.nickname ? `${s.nickname}，` : '';
  if (/晚安|睡觉|困了/.test(text)) return `${who}晚安呀。把今天先放下，好好休息。`;
  if (/你好|早上|早安|嗨/.test(text)) return `${who}你好，我是${s.name}。今天也在这里陪你。`;
  if (/累|烦|难过/.test(text)) return `${who}先歇一小会儿吧，喝口水、伸个懒腰。`;
  if (/名字|你是谁/.test(text)) return `我是${s.name}，你的桌面伙伴。现在只会回复一些预设台词。`;
  return `${who}我收到啦。现在还只会说些固定台词，你也可以点点我，看看我的反应。`;
}

module.exports = { defaults, validate, offline };
