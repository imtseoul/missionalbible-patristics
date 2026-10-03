import versions from './reader-metadata-index.mjs?v=52805ad10444';
import {copyControl} from './copy-control.mjs?v=1b32deb2f89c';
import {workInformationURL} from './work-information.mjs?v=edc958e66257';

const metadata=new Map();
export async function passageMetadata(work,id) {
  if(!Object.hasOwn(versions,work))throw new Error('이 문헌의 출처 정보를 찾지 못했습니다.');
  if(!metadata.has(work))metadata.set(work,import('./reader-metadata/'+work+'.mjs?v='+versions[work]).catch(error=>{metadata.delete(work);throw error;}));
  const data=(await metadata.get(work)).default,passage=data.passages.find(x=>x.id===id);
  if(!passage)throw new Error('이 대목의 출처 정보를 찾지 못했습니다.');
  return {data,passage};
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
      const information=document.createElement('li'),informationLink=document.createElement('a');
      informationLink.textContent='이 문헌의 자료 정보';informationLink.href=workInformationURL(selected.work,selected.path,location.href).href;information.append(informationLink);links.append(information);
      for(const link of [{label:'이 판본의 고정 본문',url:passage.fixed_url},...passage.evidence.map(i=>data.links[i]),...(edition.rights_url?[{label:'원문 이용 조건 · '+edition.license,url:edition.rights_url}]:[])]) {
        let url;try{url=new URL(link.url);}catch{continue;}if(!['https:','http:'].includes(url.protocol))continue;
        const item=document.createElement('li'),anchor=document.createElement('a');anchor.textContent=link.label;anchor.href=url.href;anchor.target='_blank';anchor.rel='noopener';item.append(anchor);links.append(item);
      }
      const citation=document.createElement('p');citation.className='source-citation';citation.textContent=passage.citation;
      content.replaceChildren(name,reference,links,citation,copyControl('인용 복사',()=>passage.citation));shown=selected.id;
      content.style.maxHeight=Math.max(140,Math.min(innerHeight*.55,innerHeight-content.getBoundingClientRect().top-16))+'px';
    }catch(error){status.textContent=error.message;const retry=document.createElement('button');retry.type='button';retry.textContent='다시 불러오기';retry.addEventListener('click',load);content.append(retry);}
  };
  details.addEventListener('toggle',load);details.addEventListener('keydown',event=>{if(event.key==='Escape'){details.open=false;summary.focus({preventScroll:true});}});
  details.refresh=()=>{if(shown!==resolve().id){shown=null;load();}};return details;
}

export function passageTools(resolve) {
  const tools=document.createElement('div');tools.className='passage-reference-tools';
  const source=sourceDetails(resolve);
  const copy=copyControl('인용 복사',async()=>{const selected=resolve();return (await passageMetadata(selected.work,selected.id)).passage.citation;});
  tools.append(copy,source);tools.refresh=()=>source.refresh();return tools;
}
