const STORAGE='patristics.recent-reading.v1';
export function readingEntry(entry, base) {
  if(!entry||typeof entry!=='object'||!entry.title||!entry.label)return null;
  try {
    const url=new URL(entry.url,base),origin=new URL(base).origin;
    if(/^\/works\/[a-z0-9-]+\/$/.test(url.pathname))url.pathname+='index.html';
    if(url.origin!==origin||!/^\/works\/[a-z0-9-]+\/(?:index|book-\d+)\.html$/.test(url.pathname)||!/^#p-[A-Za-z0-9-]+$/.test(url.hash))return null;
    return {work:url.pathname.split('/')[2],title:String(entry.title).slice(0,200),label:String(entry.label).slice(0,100),url:url.href};
  } catch {return null;}
}
export function recentReadings(list,entry,base) {
  const next=readingEntry(entry,base);if(!next)return Array.isArray(list)?list:[];
  return [next,...(Array.isArray(list)?list:[]).map(x=>readingEntry(x,base)).filter(x=>x&&x.work!==next.work)].slice(0,3);
}
export function readRecent(base=location.href) {
  try {const list=JSON.parse(localStorage.getItem(STORAGE)||'[]');return Array.isArray(list)?list.map(x=>readingEntry(x,base)).filter(Boolean).slice(0,3):[];}catch{return [];}
}
export function rememberRecent(entry) {try{localStorage.setItem(STORAGE,JSON.stringify(recentReadings(readRecent(),entry,location.href)));}catch{}}

export function installRecentReading() {
  const search=document.querySelector('.search-section');if(!search)return;
  const works=new Set([...document.querySelectorAll('[data-work-id]')].map(x=>x.dataset.workId));
  const list=readRecent().filter(x=>works.has(x.work));if(!list.length)return;
  const section=document.createElement('section');section.className='recent-reading';section.setAttribute('aria-label','최근 읽은 문헌');
  const heading=document.createElement('h2');heading.textContent='이어서 읽기';
  const clear=document.createElement('button');clear.type='button';clear.textContent='비우기';clear.setAttribute('aria-label','최근 읽기 기록 비우기');
  clear.addEventListener('click',()=>{try{localStorage.removeItem(STORAGE);}catch{}section.remove();});
  const items=document.createElement('ul');
  for(const entry of list){const item=document.createElement('li'),link=document.createElement('a');link.href=entry.url;link.textContent=entry.title+' · '+entry.label;item.append(link);items.append(item);}
  section.append(heading,clear,items);search.before(section);
}
