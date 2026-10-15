(() => {
 const key='civic-commons:appearance';
 const modes=['system','light','dark'];
 const system=window.matchMedia('(prefers-color-scheme: dark)');
 const read=()=>{try{const v=localStorage.getItem(key);return modes.includes(v)?v:'system'}catch{return 'system'}};
 let mode=read();
 function apply(){
  const dark=mode==='dark'||(mode==='system'&&system.matches);
  document.documentElement.dataset.theme=dark?'dark':'light';
  document.documentElement.style.colorScheme=dark?'dark':'light';
  const meta=document.querySelector('meta[name="theme-color"]');
  if(meta)meta.content=dark?'#172321':'#0f4a37';
 }
 apply();
 system.addEventListener?.('change',()=>{if(mode==='system')apply()});
 function mount(){
  const header=document.querySelector('.site-header .header-inner');
  if(!header||header.querySelector('.appearance-control'))return;
  const holder=document.createElement('div');holder.className='appearance-control';
  const label=document.createElement('label');label.textContent='Appearance';label.htmlFor='commons-appearance';
  const select=document.createElement('select');select.id='commons-appearance';select.setAttribute('aria-label','Appearance');
  for(const value of modes){const option=document.createElement('option');option.value=value;option.textContent=value[0].toUpperCase()+value.slice(1);select.append(option)}
  select.value=mode;
  select.addEventListener('change',()=>{mode=select.value;try{localStorage.setItem(key,mode)}catch{}apply()});
  holder.append(label,select);header.append(holder);
 }
 // site-shell replaces the header synchronously; mount after it runs.
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
