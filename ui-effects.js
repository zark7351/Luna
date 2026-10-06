// UI fades stay in place; successful operations invoke Luna's painted expressions.
(()=>{
 const reduced=matchMedia('(prefers-reduced-motion: reduce)'),running=new Set(),pulses=new WeakMap();
 const names=new Set(['collect','capture','recording','wardrobe','reminder-save','reminder','complete']);
 function pulse(node,kind='tap'){
  if(!node||reduced.matches||!['reveal','enter'].includes(kind))return;pulses.get(node)?.cancel();
  const animation=node.animate([{opacity:.4},{opacity:1}],{duration:220,easing:'ease-out'});pulses.set(node,animation);running.add(animation);animation.finished.then(()=>running.delete(animation),()=>running.delete(animation));
 }
 function burst(name){if(!names.has(name))return false;return window.lunaCharacter?.react(name)??true;}
 function clear(){for(const animation of running)animation.cancel();running.clear();window.lunaCharacter?.cancel();}
 reduced.addEventListener('change',clear);window.addEventListener('pagehide',clear);window.lunaEffects={burst,pulse,clear};
})();
