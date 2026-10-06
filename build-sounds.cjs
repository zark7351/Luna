// Process CC0 Kenney recordings into quiet, short UI feedback. No synthesized tones.
// Sources and licenses: ASSET-AUDIO-CREDITS.md. Runtime never downloads audio.
const fs=require('node:fs'),path=require('node:path');
const rate=44100;
const recipes={
  click:['ui/mouseclick1',.08,.17],tab:['ui/click4',.08,.12],select:['ui/click2',.09,.14],toggle:['ui/switch12',.09,.14],
  open:['ui/click1',.12,.12],close:['ui/click5',.09,.095],save:['rpg/metalLatch',.28,.14],
  collect:['rpg/metalClick',.32,.14],copy:['ui/click3',.10,.14],delete:['ui/switch26',.25,.09],
  refresh:['rpg/bookFlip2',.35,.08],error:['ui/switch28',.22,.09],
  'capture-start':['ui/mouserelease1',.10,.13],'capture-done':['ui/switch15',.28,.16],
  'capture-cancel':['ui/rollover2',.09,.08],complete:['rpg/handleCoins2',.35,.11],snooze:['ui/switch11',.32,.10]
};
function readPCM(file){
  const b=fs.readFileSync(file);let fmt,data;
  if(b.toString('ascii',0,4)!=='RIFF')throw Error('Not WAV: '+file);
  for(let offset=12;offset+8<=b.length;){const id=b.toString('ascii',offset,offset+4),length=b.readUInt32LE(offset+4);if(id==='fmt ')fmt={type:b.readUInt16LE(offset+8),channels:b.readUInt16LE(offset+10),rate:b.readUInt32LE(offset+12),bits:b.readUInt16LE(offset+22)};if(id==='data')data=b.subarray(offset+8,offset+8+length);offset+=8+length+(length%2);}
  if(!fmt||!data||fmt.type!==1||fmt.bits!==16||fmt.rate!==rate)throw Error('Expected 44.1kHz PCM16: '+file);
  const mono=new Float64Array(data.length/(2*fmt.channels));for(let i=0;i<mono.length;i++)for(let c=0;c<fmt.channels;c++)mono[i]+=data.readInt16LE((i*fmt.channels+c)*2)/(32768*fmt.channels);
  return mono;
}
fs.mkdirSync(path.join(__dirname,'assets','sounds'),{recursive:true});
for(const [name,[source,duration,peakTarget]] of Object.entries(recipes)){
  const [pack,file]=source.split('/'),raw=readPCM(path.join(__dirname,'assets','sound-sources','kenney-'+pack,file+'.wav'));
  let peak=0;for(const sample of raw)peak=Math.max(peak,Math.abs(sample));
  let start=raw.findIndex(sample=>Math.abs(sample)>peak*.02);start=Math.max(0,start-Math.ceil(rate*.002));
  const count=Math.ceil(duration*rate),samples=new Float64Array(count);
  // Remove rumble and soften excessive high frequencies, preserving the recorded attack.
  const hp=Math.exp(-2*Math.PI*140/rate),lp=1-Math.exp(-2*Math.PI*9000/rate);let previous=0,high=0,low=0;
  const panel=name==='open'||name==='close';
  // Panel clips use the recorded tail rather than fading only their silent padding.
  const fadeEnd=panel?Math.min(count,raw.length-start):count;
  const attack=panel?.0008:.0003,release=panel?.014:.008;
  peak=0;
  for(let i=0;i<count;i++){const input=raw[start+i]||0;high=hp*(high+input-previous);previous=input;low+=lp*(high-low);const fade=Math.min(1,i/(rate*attack),(fadeEnd-1-i)/(rate*release));samples[i]=low*Math.max(0,fade);peak=Math.max(peak,Math.abs(samples[i]));}
  const pcm=Buffer.alloc(count*2),gain=peak?peakTarget/peak:0;for(let i=0;i<count;i++)pcm.writeInt16LE(Math.round(samples[i]*gain*32767),i*2);
  const h=Buffer.alloc(44);h.write('RIFF');h.writeUInt32LE(36+pcm.length,4);h.write('WAVEfmt ',8);h.writeUInt32LE(16,16);h.writeUInt16LE(1,20);h.writeUInt16LE(1,22);h.writeUInt32LE(rate,24);h.writeUInt32LE(rate*2,28);h.writeUInt16LE(2,32);h.writeUInt16LE(16,34);h.write('data',36);h.writeUInt32LE(pcm.length,40);
  fs.writeFileSync(path.join(__dirname,'assets','sounds',name+'.wav'),Buffer.concat([h,pcm]));
}
console.log('Processed '+Object.keys(recipes).length+' organic UI sounds.');
