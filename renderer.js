const $=id=>document.getElementById(id);
let settings, pending=false, sleeping=false, happyTimer, dragStart, dragging=false, ignore=false;
const api=async(name,payload)=>{const r=await window.pet.call(name,payload);if(!r.ok)throw Error(r.error);return r.value;};
function mode(){ $('title').textContent=settings.name;document.title=settings.name+' · 桌面伙伴';$('mode').textContent='本地互动 · 预设台词'; }
function message(role,text,online){const el=document.createElement('div');el.className='message '+role;if(role==='assistant'){const label=document.createElement('div');label.className='meta';label.textContent=online?'旧版 AI 回复':'本地预设';el.append(label);}el.append(document.createTextNode(text));$('messages').append(el);$('messages').scrollTop=$('messages').scrollHeight;}
function happy(text){if(sleeping)return;$('bubble').textContent=text;clearTimeout(happyTimer);$('pet').classList.remove('blink');$('pet').classList.add('happy');happyTimer=setTimeout(()=>$('pet').classList.remove('happy'),1900);}
async function submit(text){if(pending||!text.trim())return;pending=true;$('send').disabled=true;const input=text.trim();$('message').value='';message('user',input);$('status').textContent='互动中…';
 try{const r=await api('chat',input);message('assistant',r.answer,r.online);happy('嗯，我在听。');$('status').textContent='Enter 发送 · Shift + Enter 换行';}
 catch(e){$('status').textContent=e.message;$('message').value=input;const last=$('messages').lastElementChild;if(last?.classList.contains('user'))last.remove();}
 finally{pending=false;$('send').disabled=false;}
}
$('chat-form').onsubmit=e=>{e.preventDefault();submit($('message').value);};
$('message').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();submit($('message').value);}};
document.querySelectorAll('[data-say]').forEach(b=>b.onclick=()=>submit(b.dataset.say));
$('collapse').onclick=()=>{$('panel').hidden=true;};
$('chat-toggle').onclick=()=>{$('panel').hidden=!$('panel').hidden;if(!$('panel').hidden)$('message').focus();};
$('hide').onclick=()=>api('hide');
$('clear').onclick=async()=>{try{await api('clear');$('messages').replaceChildren();$('status').textContent='聊天记录已清空。';}catch(e){$('status').textContent=e.message;}};
$('sleep').onclick=()=>{sleeping=!sleeping;$('pet').classList.toggle('sleeping',sleeping);$('pet').classList.remove('happy','blink');$('sleep').textContent=sleeping?'☀ 唤醒':'☾ 休息';$('bubble').textContent=sleeping?'小憩一下，叫我就好。':'醒来就能见到你，真好。';};
$('settings-button').onclick=async()=>{
 try{const state=await api('state');settings=state.settings;for(const k of ['name','nickname'])$(k).value=settings[k];$('top').checked=settings.top;$('settings-status').textContent='';$('settings').hidden=false;}catch(e){$('status').textContent=e.message;}
};
$('settings-close').onclick=()=>{$('settings').hidden=true;};
$('settings-form').onsubmit=async e=>{e.preventDefault();const input={name:$('name').value,nickname:$('nickname').value,top:$('top').checked};
 try{const state=await api('settings',input);settings=state.settings;mode();$('settings').hidden=true;$('bubble').textContent='好，我记住你的设置啦。';}catch(err){$('settings-status').textContent=err.message;}
};
$('pet').onclick=()=>{if(dragging){dragging=false;return;}if(sleeping){$('sleep').click();return;}happy(['今天也一起慢慢来吧。','被你发现我在发呆了。','见到你，心情就变好啦。'][Math.floor(Math.random()*3)]);};
$('pet').onpointerdown=e=>{if(e.button!==0)return;dragStart={x:e.screenX,y:e.screenY};dragging=false;$('pet').setPointerCapture(e.pointerId);};
$('pet').onpointermove=e=>{if(dragStart&&!dragging&&Math.hypot(e.screenX-dragStart.x,e.screenY-dragStart.y)>5){dragging=true;window.pet.drag(true);}};
function endDrag(){if(dragStart&&dragging)window.pet.drag(false);dragStart=null;}
$('pet').onpointerup=endDrag;$('pet').onpointercancel=endDrag;window.addEventListener('blur',endDrag);
document.addEventListener('mousemove',e=>{const value=!e.target.closest('.interactive')&&!dragStart;if(value!==ignore){ignore=value;window.pet.passthrough(value);}});
document.addEventListener('mouseleave',()=>{if(!dragStart){ignore=true;window.pet.passthrough(true);}});
function blink(){if(!sleeping&&!$('pet').classList.contains('happy')){$('pet').classList.add('blink');setTimeout(()=>$('pet').classList.remove('blink'),140);}setTimeout(blink,3200+Math.random()*2400);}setTimeout(blink,3000);
(async()=>{try{const s=await api('state');settings=s.settings;mode();if(s.history.length){$('messages').replaceChildren();for(const m of s.history)message(m.role,m.content,m.online);}else $('messages').firstElementChild.textContent=`你好呀，我是${settings.name}。点点我，或者和我说声你好吧。`;}catch(e){$('status').textContent='初始化失败：'+e.message;}})();
