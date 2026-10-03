import versions from './reader-metadata-index.mjs?v=52805ad10444';
import {copyControl} from './copy-control.mjs?v=1b32deb2f89c';
import {readSaved,saveReadings,mergeSaved,removeSaved,readRemoved,storageProblem} from './saved-readings.mjs?v=cc89cfac9055';

const metadata=new Map();
export async function passageMetadata(work,id) {
  if(!Object.hasOwn(versions,work))throw new Error('이 문헌의 출처 정보를 찾지 못했습니다.');
  if(!metadata.has(work))metadata.set(work,import('./reader-metadata/'+work+'.mjs?v='+versions[work]).catch(error=>{metadata.delete(work);throw error;}));
  const data=(await metadata.get(work)).default,passage=data.passages.find(x=>x.id===id);
  if(!passage)throw new Error('이 대목의 출처 정보를 찾지 못했습니다.');
  return {data,passage};
}

export async function canonicalSaved({work,id,path,note=''}) {
  const {data,passage}=await passageMetadata(work,id);
  const url=new URL(path,location.href),canonical=new URL('/works/'+work+'/'+passage.path,location.href);
  if(/^\/works\/[a-z0-9-]+\/$/.test(url.pathname))url.pathname+='index.html';
  if(url.origin!==location.origin||url.pathname!==canonical.pathname||url.hash!==canonical.hash)throw new Error('저장된 대목의 주소가 현재 문헌과 일치하지 않습니다.');
  return {work,id,path:url.pathname+url.search+url.hash,title:data.title,author:data.author,label:passage.location,citation:passage.citation,note};
}

export function savePassageControl(resolve,accessibleLabel='현재 대목 모아 읽기에 저장') {
  const wrap=document.createElement('span');wrap.className='save-passage-control';
  const button=document.createElement('button');button.type='button';button.className='save-passage';button.setAttribute('aria-label',accessibleLabel);
  const status=document.createElement('span');status.className='passage-tool-status';status.setAttribute('role','status');
  const update=()=>{
    const selected=resolve(),saved=readSaved().some(x=>x.id===selected.id);button.textContent=saved?'저장됨':'저장';button.setAttribute('aria-pressed',String(saved));
    const problem=storageProblem();if(problem){status.classList.add('is-error');status.textContent=problem;}
  };
  button.addEventListener('click',async()=>{
    const selected=resolve();button.disabled=true;status.textContent='';status.classList.remove('is-error','is-notice');
    try {
      let entries=readSaved();
      if(entries.some(x=>x.id===selected.id)){
        const removed=removeSaved(selected.id);if(!removed){status.textContent='이미 목록에서 빠졌습니다.';return;}status.classList.add('is-notice');status.textContent='목록에서 뺐습니다. ';
        const undo=document.createElement('button');undo.type='button';undo.textContent='되돌리기';
        undo.addEventListener('click',()=>{try{saveReadings(mergeSaved(readSaved(),[removed]));status.textContent='대목과 메모를 복원했습니다.';status.classList.remove('is-notice');update();button.focus();}catch(error){status.classList.add('is-error');status.textContent=error.message;}});status.append(undo);
      }
      else {const previous=readRemoved().find(x=>x.id===selected.id);const entry=await canonicalSaved({...selected,note:previous?.note||''});entries=readSaved();saveReadings(mergeSaved(entries,[entry]));status.textContent=previous?.note?'대목과 메모를 다시 저장했습니다.':'모아 읽기에 저장했습니다.';}
    }catch(error){status.classList.add('is-error');status.textContent=error.message;}
    finally{button.disabled=false;update();}
  });
  wrap.append(button,status);wrap.refresh=update;update();return wrap;
}

export function sourceDetails(resolve) {
  const details=document.createElement('details');details.className='passage-source';
  const summary=document.createElement('summary');summary.textContent='출처';
  const content=document.createElement('div');content.className='passage-source-content';details.append(summary,content);
  let shown=null,request=0;
  const load=async()=>{
    if(!details.open)return;const selected=resolve();if(shown===selected.id)return;
    const token=++request;content.replaceChildren();const status=document.createElement('p');status.setAttribute('role','status');status.textContent='출처를 불러오는 중입니다.';content.append(status);
    try {
      const {data,passage}=await passageMetadata(selected.work,selected.id);if(token!==request)return;
      const edition=data.editions[passage.edition],name=document.createElement('p');name.className='source-edition';name.textContent=edition.label;
      const reference=document.createElement('p');reference.textContent=data.author+' · '+data.title+' '+passage.location+' · '+data.release_id;
      const links=document.createElement('ul');
      for(const link of [{label:'이 판본의 고정 본문',url:passage.fixed_url},...passage.evidence.map(i=>data.links[i]),...(edition.rights_url?[{label:'원문 이용 조건 · '+edition.license,url:edition.rights_url}]:[])]) {
        let url;try{url=new URL(link.url);}catch{continue;}if(!['https:','http:'].includes(url.protocol))continue;
        const item=document.createElement('li'),anchor=document.createElement('a');anchor.textContent=link.label;anchor.href=url.href;anchor.target='_blank';anchor.rel='noopener';item.append(anchor);links.append(item);
      }
      const citation=document.createElement('p');citation.className='source-citation';citation.textContent=passage.citation;
      const collection=document.createElement('a');collection.href='/index.html#saved-readings';collection.textContent='모아 읽기 목록';
      content.replaceChildren(name,reference,links,citation,copyControl('인용 복사',()=>passage.citation),collection);shown=selected.id;
      content.style.maxHeight=Math.max(140,Math.min(innerHeight*.55,innerHeight-content.getBoundingClientRect().top-16))+'px';
    }catch(error){status.textContent=error.message;const retry=document.createElement('button');retry.type='button';retry.textContent='다시 불러오기';retry.addEventListener('click',load);content.append(retry);}
  };
  details.addEventListener('toggle',load);details.addEventListener('keydown',event=>{if(event.key==='Escape'){details.open=false;summary.focus({preventScroll:true});}});
  details.refresh=()=>{if(shown!==resolve().id){shown=null;load();}};return details;
}

export function passageTools(resolve) {
  const tools=document.createElement('div');tools.className='passage-research-tools';
  const save=savePassageControl(resolve),source=sourceDetails(resolve),collection=document.createElement('a');collection.href=new URL('/index.html#saved-readings',location.href);collection.textContent='모아 읽기';
  tools.append(save,source,collection);tools.refresh=()=>{save.refresh();source.refresh();};return tools;
}

if(typeof document!=='undefined') {
  const refresh=()=>{for(const control of document.querySelectorAll('.save-passage-control'))control.refresh?.();};
  for(const name of ['saved-readings-change','storage','pageshow'])window.addEventListener(name,refresh);
}
