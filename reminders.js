const fs=require('node:fs/promises');
const path=require('node:path');
const {randomUUID}=require('node:crypto');

async function createReminders(directory,{now=Date.now,onDue=()=>{},onChange=()=>{}}={}){
  const file=path.join(directory,'reminders.json');
  await fs.mkdir(directory,{recursive:true});
  let items=[],queue=Promise.resolve(),stopped=false;
  try{
    items=JSON.parse(await fs.readFile(file,'utf8'));
    if(!Array.isArray(items)||items.some(item=>!item||typeof item.id!=='string'||typeof item.title!=='string'||!Number.isFinite(item.dueAt)||!['pending','fired','done'].includes(item.status)))throw Error('提醒数据格式错误，请保留 reminders.json 并检查备份。');
  }catch(error){if(error.code!=='ENOENT')throw error;}
  const serial=task=>{const pending=queue.then(task);queue=pending.catch(()=>{});return pending;};
  async function persist(next){await fs.writeFile(file+'.tmp',JSON.stringify(next,null,2),'utf8');await fs.rename(file+'.tmp',file);items=next;if(!stopped)onChange();}
  const list=()=>items.map(item=>({...item})).sort((a,b)=>a.dueAt-b.dueAt);
  async function save(input){return serial(async()=>{
    if(!input||typeof input.title!=='string'||!input.title.trim()||input.title.trim().length>120)throw Error('提醒内容需在 1–120 字以内。');
    const mode=input.mode??'scheduled';
    if(!['scheduled','countdown'].includes(mode))throw Error('未知提醒方式。');
    if(mode==='countdown'&&(!Number.isInteger(input.durationSeconds)||input.durationSeconds<1||input.durationSeconds>7*86400))throw Error('倒计时需在 1 秒到 7 天之间。');
    const dueAt=mode==='countdown'?now()+input.durationSeconds*1000:input.dueAt;
    if(!Number.isFinite(dueAt)||dueAt<=now()||dueAt>now()+366*10*86400000)throw Error('请选择未来十年以内的提醒时间。');
    const previous=input.id?items.find(item=>item.id===input.id):null;
    if(input.id&&!previous)throw Error('提醒已不存在。');
    if(!previous&&items.length>=200)throw Error('最多保存 200 条提醒，请删除已完成的记录。');
    const item={id:previous?.id||randomUUID(),title:input.title.trim(),dueAt,mode,...mode==='countdown'?{durationSeconds:input.durationSeconds}:{},status:'pending',createdAt:previous?.createdAt||now()};
    await persist(previous?items.map(entry=>entry.id===item.id?item:entry):[...items,item]);return item;
  });}
  async function action({id,action}={},onlyFired=false){return serial(async()=>{
    const item=items.find(item=>item.id===id);if(!item)throw Error('提醒已不存在。');
    if(onlyFired&&item.status!=='fired')throw Error('这条提醒已处理或尚未到时间。');
    if(!['complete','snooze','delete'].includes(action))throw Error('未知提醒操作。');
    if(action==='snooze'&&item.status!=='fired')throw Error('只有已到点的提醒可延后。');
    await persist(action==='delete'?items.filter(entry=>entry.id!==id):items.map(entry=>entry.id!==id?entry:action==='complete'?{...entry,status:'done'}:{...entry,status:'pending',dueAt:now()+5*60000}));return true;
  });}
  async function check(){return serial(async()=>{
    if(stopped)return [];
    const due=items.filter(item=>item.status==='pending'&&item.dueAt<=now());
    if(!due.length)return [];
    const ids=new Set(due.map(item=>item.id));
    await persist(items.map(item=>ids.has(item.id)?{...item,status:'fired'}:item));
    if(!stopped)await onDue(due.map(item=>({...item,status:'fired'})));
    return due;
  });}
  return {list,save,action,check,stop:()=>{stopped=true;},settled:()=>queue};
}
module.exports={createReminders};
