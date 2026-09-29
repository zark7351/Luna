const defaults = { name: '露娜', nickname: '', memory: '', baseUrl: '', model: '', online: false, top: true };
function validate(input) {
  const s = { ...defaults };
  for (const [k, max] of Object.entries({name:24,nickname:40,memory:1500,baseUrl:500,model:100})) {
    s[k] = String(input[k] ?? defaults[k]).trim().slice(0,max);
  }
  s.name ||= '露娜';
  s.online = input.online === true; s.top = input.top !== false;
  if (s.baseUrl) {
    let u; try { u = new URL(s.baseUrl); } catch { throw Error('请输入完整的服务地址。'); }
    if (u.username || u.password || u.search || u.hash) throw Error('服务地址不能包含账号、参数或片段。');
    const local = ['localhost','127.0.0.1','[::1]'].includes(u.hostname);
    if (u.protocol !== 'https:' && !(local && u.protocol === 'http:')) throw Error('远程服务必须使用 HTTPS；本机服务可使用 HTTP。');
    s.baseUrl = u.href.replace(/\/+$/, '');
  }
  if (s.online && (!s.baseUrl || !s.model)) throw Error('启用 AI 前，请填写服务地址和模型名称。');
  return s;
}
function offline(text, s) {
  const who = s.nickname ? `${s.nickname}，` : '';
  if (/晚安|睡觉|困了/.test(text)) return `${who}晚安呀。把今天先放下，好好休息。`;
  if (/你好|早上|早安|嗨/.test(text)) return `${who}你好，我是${s.name}。今天也在这里陪你。`;
  if (/累|烦|难过/.test(text)) return `${who}先歇一小会儿吧，喝口水、伸个懒腰。`;
  if (/名字|你是谁/.test(text)) return `我是${s.name}，你的桌面伙伴。现在是离线互动模式，只能回复预设台词。`;
  return `${who}我收到啦。现在是离线互动模式，可以点点我，或在设置里连接 AI，开始自由聊天。`;
}
async function askAI(s, key, history, text, fetcher = fetch) {
  const url = s.baseUrl.endsWith('/chat/completions') ? s.baseUrl : `${s.baseUrl}/chat/completions`;
  const messages = [{role:'system',content:`你是桌面虚拟伙伴${s.name}，原创成年动漫女性。温柔、自然、有自己的想法，用简短中文交流，不使用舞台动作格式。不声称能看到屏幕、操作电脑或拥有现实身体。用户称呼：${s.nickname || '未设置'}。用户主动保存的偏好：${s.memory || '无'}。`}, ...history.filter(x=>x.online).slice(-20).map(({role,content})=>({role,content})), {role:'user',content:text}];
  const res = await fetcher(url, {method:'POST',redirect:'error',signal:AbortSignal.timeout(45000),headers:{'Content-Type':'application/json',...(key?{Authorization:`Bearer ${key}`}:{})},body:JSON.stringify({model:s.model,messages,stream:false})});
  if (!res.ok) throw Error(res.status === 401 ? '认证失败，请检查 API Key。' : res.status === 429 ? '服务限流或额度不足，请稍后重试。' : `模型服务返回 HTTP ${res.status}，请检查地址与模型。`);
  const data = await res.json();
  const answer = data?.choices?.[0]?.message?.content;
  if (typeof answer !== 'string' || !answer.trim()) throw Error('服务没有返回可显示的文本，请确认支持 Chat Completions。');
  return answer.trim().slice(0,12000);
}
module.exports = { defaults, validate, offline, askAI };
