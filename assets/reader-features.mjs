import {copyControl} from './copy-control.mjs?v=1b32deb2f89c';
import {rememberRecent} from './reading-progress.mjs?v=56a23c1dd8f1';
import {passageMetadata,sourceDetails} from './archive-tools.mjs?v=34434736ec6a';
import {workInformationURL} from './work-information.mjs?v=edc958e66257';
import {searchReturnURL} from './archive-search-core.mjs?v=e4859555cee8';

export function installReaderFeatures() {
  if(!/^\/works\/[a-z0-9-]+\/(?:(?:index|book-\d+)\.html)?$/.test(location.pathname))return;
  const articles=[...document.querySelectorAll('article.passage[data-passage-id]')];
  const tools=document.querySelector('.reader-tools'),title=document.querySelector('.work-heading h1');
  if(!articles.length||!tools||!title)return;
  let current=articles[0],focusUnit=null,intentUntil=0,pending=false,lastRead=null;
  const work=location.pathname.split('/')[2],name=title.textContent;
  const searchBack=searchReturnURL(location.href);
  if(searchBack&&!document.querySelector('.reader-search-context')) {
    const back=document.createElement('a');back.className='reader-search-context';back.textContent='검색 결과로 돌아가기';back.href=searchBack.href;
    title.closest('.work-heading').prepend(back);
  }
  let information=document.querySelector('.work-information-link');
  if(!information){information=document.createElement('a');information.className='work-information-link';information.textContent='이 문헌의 자료 정보';document.querySelector('.reader-footer')?.prepend(information);}
  const locationLink=document.createElement('a');locationLink.className='reader-current-location';locationLink.setAttribute('aria-label','현재 읽는 장');
  const citation=copyControl('인용',async()=>{
    const id=current.dataset.passageId;
    return (await passageMetadata(work,id)).passage.citation;
  },'현재 대목 인용 정보 복사');
  citation.classList.add('reader-copy-citation');
  const selection=()=>{const url=new URL(location.href);url.hash=current.id;return {work,id:current.dataset.passageId,path:url.href};};
  const source=sourceDetails(selection);
  const titleLink=tools.querySelector('.reader-current-title');
  if(titleLink){const meta=document.createElement('div');meta.className='reader-meta';tools.prepend(meta);meta.append(titleLink,locationLink,citation,source);}
  const mark=node=>{
    current=node||current;
    const chapter=current.dataset.chapter;
    const chapterLinks=[...document.querySelectorAll('[data-chapter-link]')];
    for(const link of chapterLinks){if(link.dataset.chapterLink===chapter)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current');}
    locationLink.textContent=chapterLinks.find(x=>x.dataset.chapterLink===chapter)?.textContent || current.querySelector('h2')?.textContent || '';
    locationLink.href='#'+current.id;
    const url=new URL(location.href);url.hash=current.id;
    information.href=workInformationURL(work,url.href,location.href).href;
    rememberRecent({title:name,label:locationLink.textContent,url:url.href});
    source.refresh();
  };
  const hashPosition=()=>{
    let id;try{id=decodeURIComponent(location.hash.slice(1)).replace(/^note-/,'p-');}catch{return;}
    const target=document.getElementById(id)?.closest('article.passage');if(target)mark(target);
  };
  const visible=()=>{
    const top=tools.getBoundingClientRect().bottom+48;
    return articles.find(node=>{const r=node.getBoundingClientRect();return r.top<=top&&r.bottom>top;});
  };
  for(const event of ['wheel','touchmove'])window.addEventListener(event,()=>{intentUntil=performance.now()+1500;},{passive:true});
  window.addEventListener('keydown',event=>{if(['ArrowDown','ArrowUp','PageDown','PageUp','Home','End',' '].includes(event.key)&&!event.target.closest('input,textarea,select,[contenteditable]'))intentUntil=performance.now()+1500;});
  window.addEventListener('pointerdown',event=>{if(event.clientX>=innerWidth-24)intentUntil=performance.now()+1500;},{passive:true});
  window.addEventListener('scroll',()=>{
    if(pending||performance.now()>intentUntil)return;pending=true;
    requestAnimationFrame(()=>{pending=false;if(performance.now()>intentUntil)return;const node=visible();if(node){if(node!==current)mark(node);lastRead={node,y:scrollY,url:new URL(location.href)};lastRead.url.hash=node.id;}});
  },{passive:true});
  for(const event of ['focusin','pointerdown'])document.addEventListener(event,e=>{
    const unit=e.target.closest('[data-align]'),node=unit?.closest('article.passage');
    if(node){focusUnit=unit;if(event==='pointerdown'){mark(node);lastRead=null;}}
    else if(e.target.closest('a,button,input,textarea,select,summary'))intentUntil=-1;
  });
  window.addEventListener('hashchange',()=>{hashPosition();if(location.hash.startsWith('#p-'))lastRead=null;});
  window.addEventListener('pagehide',()=>{
    if(lastRead){mark(lastRead.node);rememberRecent({title:name,label:locationLink.textContent,url:lastRead.url.href});}
    else {const node=visible();if(node)mark(node);}
  });
  const returns=new Map();
  document.addEventListener('click',event=>{
    const link=event.target.closest('a[href]');if(!link||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    const href=link.getAttribute('href');
    intentUntil=-1;
    if(href?.startsWith('#note-')||href==='#translation-notes') {
      const passage=link.closest('article.passage')||current;
      returns.set(href,{id:passage.id,y:scrollY,focus:focusUnit?.closest('article.passage')===passage?focusUnit:null});
    } else if(link.closest('.reader-notes')&&href?.startsWith('#p-')) {
      const note=link.closest('li[id]'),saved=returns.get('#'+note?.id)||returns.get('#translation-notes');
      if(saved&&href==='#'+saved.id) {
        event.preventDefault();const oldURL=location.href;history.pushState(history.state,'',href);
        window.dispatchEvent(new HashChangeEvent('hashchange',{oldURL,newURL:location.href}));
        requestAnimationFrame(()=>{saved.focus?.focus({preventScroll:true});window.scrollTo({top:saved.y,behavior:'auto'});});
      }
    }
  });
  mark();hashPosition();
}
