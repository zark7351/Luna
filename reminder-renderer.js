const $=id=>document.getElementById(id);
const api=async(channel,payload)=>{const result=await window.reminder.call(channel,payload);if(!result.ok)throw Error(result.error);return result.value;};
const knownReminders=new Map();
let items=[],tab='active',editing=null,revision=0,mode='scheduled';
const localTime=value=>{const date=new Date(value),pad=n=>String(n).padStart(2,'0');return date.getFullYear()+'-'+pad(date.getMonth()+1)+'-'+pad(date.getDate())+'T'+pad(date.getHours())+':'+pad(date.getMinutes());};
function setMode(value){mode=value;const countdown=mode==='countdown';$('scheduled-fields').hidden=countdown;$('time').disabled=countdown;$('countdown-fields').hidden=!countdown;for(const id of ['hours','minutes','seconds'])$(id).disabled=!countdown;for(const name of ['scheduled','countdown']){const button=$('mode-'+name);button.setAttribute('aria-selected',String(mode===name));button.tabIndex=mode===name?0:-1;}const label=countdown?(editing?'重新开始倒计时':'开始倒计时'):'保存提醒';$('save').title=label;$('save').setAttribute('aria-label',label);}
function durationFields(seconds){$('hours').value=Math.floor(seconds/3600);$('minutes').value=Math.floor(seconds%3600/60);$('seconds').value=seconds%60;}
function updateCountdowns(){for(const node of document.querySelectorAll('[data-countdown]')){const seconds=Math.max(0,Math.ceil((Number(node.dataset.countdown)-Date.now())/1000));const pad=n=>String(n).padStart(2,'0');node.textContent=seconds?'剩余 '+pad(Math.floor(seconds/3600))+':'+pad(Math.floor(seconds%3600/60))+':'+pad(seconds%60):'即将提醒…';}}
function reset(){editing=null;$('form').reset();$('time').value=localTime(Date.now()+10*60000);$('cancel-edit').hidden=true;setMode(mode);}
function iconButton(label,icon,action){const button=document.createElement('button');button.type='button';button.dataset.uiSound=label==='编辑'?'click':'none';button.title=label;button.setAttribute('aria-label',label);const svg=window.lunaIcons.create(icon);button.append(svg);button.onclick=async()=>{button.disabled=true;try{await action();}catch(error){$('status').textContent=error.message;}finally{if(button.isConnected)button.disabled=false;}};return button;}
async function operate(item,action){await api('reminder-action',{id:item.id,action});if(editing===item.id)reset();await refresh();}
function render(){
  $('count').textContent=items.filter(item=>item.status!=='done').length+' 条';
  for(const name of ['active','done']){$(name).classList.toggle('selected',name===tab);$(name).setAttribute('aria-selected',String(name===tab));$(name).tabIndex=name===tab?0:-1;}
  $('items').replaceChildren();
  const shown=items.filter(item=>tab==='done'?item.status==='done':item.status!=='done').sort((a,b)=>(b.status==='fired')-(a.status==='fired')||a.dueAt-b.dueAt);
  if(!shown.length){const empty=document.createElement('div');empty.className='empty';empty.textContent=tab==='done'?'还没有已完成的提醒':'想起什么，就记在这里吧';$('items').append(empty);}
  for(const item of shown){const card=document.createElement('article');card.className='item '+item.status+(item.mode==='countdown'?' countdown':'');card.dataset.id=item.id;const title=document.createElement('h2');title.textContent=item.title;title.title=item.title;const time=document.createElement('time');time.dateTime=new Date(item.dueAt).toISOString();time.textContent=(item.status==='fired'?'到时间啦 · ':'')+new Date(item.dueAt).toLocaleString('zh-CN',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',year:'numeric'});time.title=new Date(item.dueAt).toLocaleString('zh-CN');if(item.mode==='countdown'&&item.status==='pending')time.dataset.countdown=item.dueAt;const actions=document.createElement('div');actions.className='actions';
    if(item.status!=='done')actions.append(iconButton('完成','check',()=>operate(item,'complete')));
    if(item.status==='fired')actions.append(iconButton('稍后 5 分钟','snooze',()=>operate(item,'snooze')));
    actions.append(iconButton('编辑','edit',async()=>{editing=item.id;$('title').value=item.title;setMode(item.mode==='countdown'?'countdown':'scheduled');if(mode==='countdown')durationFields(item.status==='pending'?Math.max(1,Math.min(604800,Math.ceil((item.dueAt-Date.now())/1000))):item.durationSeconds||900);else $('time').value=localTime(item.dueAt>Date.now()?item.dueAt:Date.now()+10*60000);$('cancel-edit').hidden=false;$('title').focus();$('form').scrollIntoView({block:'start'});}));
    const remove=iconButton('删除','trash',async()=>{if(confirm('删除这条提醒？'))await operate(item,'delete');});remove.className='danger';actions.append(remove);card.append(title,time,actions);$('items').append(card);if(knownReminders.has(item.id)&&knownReminders.get(item.id)!==item.status)window.lunaEffects.pulse(card,'enter');knownReminders.set(item.id,item.status);
  }
  updateCountdowns();
}
async function refresh(){const current=++revision;try{const result=await api('reminder-list');if(current===revision){items=result;render();}}catch(error){$('status').textContent=error.message;}}
$('form').onsubmit=async event=>{event.preventDefault();$('save').disabled=true;try{await api('reminder-save',{id:editing,title:$('title').value,mode,...mode==='countdown'?{durationSeconds:Number($('hours').value)*3600+Number($('minutes').value)*60+Number($('seconds').value)}:{dueAt:new Date($('time').value).getTime()}});reset();tab='active';$('status').textContent=mode==='countdown'?'倒计时开始啦。':'记好啦。';await refresh();}catch(error){$('status').textContent=error.message;}finally{$('save').disabled=false;}};
$('cancel-edit').onclick=reset;
for(const name of ['active','done'])$(name).onclick=()=>{tab=name;render();};
for(const name of ['scheduled','countdown'])$('mode-'+name).onclick=()=>setMode(name);
for(const button of document.querySelectorAll('[data-minutes]'))button.onclick=()=>durationFields(Number(button.dataset.minutes)*60);
setInterval(updateCountdowns,1000);window.addEventListener('focus',updateCountdowns);
window.reminder.onUpdated(refresh);reset();refresh();

$('close-reminder').onclick=()=>window.parent.lunaPanels.closeSheet('reminder');
document.addEventListener('keydown',event=>{if(event.key==='Escape')window.parent.lunaPanels.closeSheet('reminder');});
for(const group of [['mode-scheduled','mode-countdown'],['active','done']])for(const id of group)$(id).addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const next=event.key==='Home'?group[0]:event.key==='End'?group[1]:group.find(other=>other!==id);$(next).click();$(next).focus();});
let statusTimer;new MutationObserver(()=>{clearTimeout(statusTimer);if($('status').textContent)statusTimer=setTimeout(()=>$('status').textContent='',4500);}).observe($('status'),{childList:true,characterData:true,subtree:true});
