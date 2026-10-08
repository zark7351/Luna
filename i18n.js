// One local dictionary shared by the main process and packaged renderers.
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./translations'));
  else root.lunaI18n=factory(root.lunaTranslations);
})(globalThis,dict=>{
  const languages=['zh-CN','en'];
  const normalize=value=>languages.includes(value)?value:'zh-CN';
  function translate(text,language='zh-CN',values){const result=normalize(language)==='en'&&Object.hasOwn(dict,text)?dict[text]:text;return values?result.replace(/\{(\w+)\}/g,(match,key)=>Object.hasOwn(values,key)?String(values[key]):match):result;}
  let language='zh-CN';
  function apply(){
    document.documentElement.lang=language;
    for(const node of document.querySelectorAll('[data-i18n]'))node.textContent=translate(node.dataset.i18n,language);
    for(const attr of ['title','aria-label','placeholder'])for(const node of document.querySelectorAll('[data-i18n-'+attr+']'))node.setAttribute(attr,translate(node.getAttribute('data-i18n-'+attr),language));
  }
  function setLanguage(value){const next=normalize(value),changed=next!==language;language=next;if(typeof document!=='undefined'&&changed){apply();window.dispatchEvent(new Event('luna-language-changed'));}return language;}
  if(typeof document!=='undefined')document.addEventListener('DOMContentLoaded',()=>{
    const bridge=window.pet;
    if(window.parent!==window&&window.parent.lunaI18n)setLanguage(window.parent.lunaI18n.language);
    bridge?.onSettingsChanged(value=>setLanguage(value.language));
    bridge?.call('state').then(result=>{if(result.ok)setLanguage(result.value.settings.language);}).catch(()=>{});
    apply();
  });
  return {languages,normalize,translate,t:(text,values)=>translate(text,language,values),setLanguage,get language(){return language;}};
});
