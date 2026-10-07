(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.lunaBodyShortcuts=factory();})(globalThis,()=>{
  const regions=Object.freeze({head:'脑袋',chest:'胸部',arms:'手臂',legs:'腿',feet:'脚'});
  const actions=Object.freeze({library:{label:'收藏',icon:'folder'},screenshot:{label:'截图',icon:'capture'},recording:{label:'录屏',icon:'record'},reminder:{label:'提醒',icon:'bell'},wardrobe:{label:'换装',icon:'shirt'},datetime:{label:'日期时间',icon:'clock'},stats:{label:'系统占用',icon:'stats'},weather:{label:'天气',icon:'sun'},settings:{label:'设置',icon:'settings'}});
  const defaults=Object.freeze({head:'datetime',chest:'weather',arms:'library',legs:'stats',feet:'wardrobe'});
  function validate(value){return Object.fromEntries(Object.keys(regions).map(region=>[region,Object.hasOwn(actions,value?.[region])?value[region]:defaults[region]]));}
  // Points are in the unshifted 512 x 1024 source drawing; sleeves and crossed hands belong to arms.
  function regionAt(x,y,center=256){
    if(![x,y,center].every(Number.isFinite)||x<0||x>=512||y<0||y>=1024)return null;
    if(y<200)return 'head';if(y<355&&Math.abs(x-center)<68)return 'chest';if(y<545)return 'arms';if(y<885)return 'legs';return 'feet';
  }
  function createReactions({now=Date.now,random=Math.random}={}){
    let chestClicks=[];
    return {click(region){if(!Object.hasOwn(regions,region))return null;const time=now();chestClicks=chestClicks.filter(value=>time-value>=0&&time-value<5000).slice(-3);if(region==='chest')chestClicks.push(time);const annoyed=region==='chest'&&chestClicks.length>=3&&random()<.01;return {expression:annoyed?'angry':{head:'happy',chest:'shy',arms:'wink',legs:'smile',feet:'pout'}[region],annoyed};},reset(){chestClicks=[];}};
  }
  return Object.freeze({regions,actions,defaults,validate,regionAt,createReactions});
});
