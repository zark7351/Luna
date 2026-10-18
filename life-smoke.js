// Companion engine inside the real pet window: paused during smoke, speaks through the real bubble with a fake clock,
// stays quiet while the bubble is busy, round-trips its memory and persists the settings switch.
const fs = require('node:fs');
async function check({ win, stateFile }) {
  const result = await win.webContents.executeJavaScript(`(async()=>{
    const wait=async(test,label)=>{const until=Date.now()+5000;while(!test()){if(Date.now()>until)throw Error('companion wait: '+label);await new Promise(r=>setTimeout(r,30));}};
    await wait(()=>life,'engine');
    if(life.enabled)throw Error('companion should be paused during smoke');
    feedback.show('');
    const fake=window.lunaLife.createLife({now:()=>new Date(2026,9,16,8,0),random:()=>0,say:lifeSay,canSpeak:lifeCanSpeak,translate:t,name:()=>settings.name,load:()=>({firstSeen:'2026-10-01'})});
    fake.start();
    if(!fake.tick())throw Error('greeting not spoken');
    const text=document.querySelector('#bubble-message').textContent;
    if(!text.startsWith('早上好')||!text.includes('周五'))throw Error('greeting text '+text);
    if(document.querySelector('#bubble').hidden)throw Error('greeting bubble hidden');
    const quiet=!fake.tick();
    feedback.show('');
    const saved=await api('life-memory',{firstSeen:'2026-10-01',counts:{capture:2},bogus:1});
    const loaded=await api('life-memory');
    const memory=saved.counts.capture===2&&loaded.firstSeen==='2026-10-01'&&!('bogus' in loaded);
    await openSettings();
    const defaultOn=document.querySelector('#companion').checked;
    document.querySelector('#companion').checked=false;
    document.querySelector('#settings-form').requestSubmit();
    await wait(()=>document.querySelector('#settings').hidden,'settings close');
    const switchedOff=settings.companion===false;
    await openSettings();
    const reopened=document.querySelector('#companion').checked===false;
    document.querySelector('#companion').checked=true;
    document.querySelector('#settings-form').requestSubmit();
    await wait(()=>document.querySelector('#settings').hidden,'settings restore');
    feedback.show('');
    if(!quiet||!memory||!defaultOn||!switchedOff||!reopened||settings.companion!==true||life.enabled)throw Error('companion checks '+JSON.stringify({quiet,memory,defaultOn,switchedOff,reopened}));
    return {pausedInSmoke:true,greeting:true,quietWhenBusy:true,memory:true,settingsSwitch:true};
  })()`);
  const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  if (state.settings.companion !== true || state.life?.counts?.capture !== 2)
    throw Error('companion state not persisted');
  return { ...result, persisted: true };
}
module.exports = { check };
