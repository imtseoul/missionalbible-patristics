import index from './archive-search-index.mjs?v=6fa64cec064c';
import {dataErrorMessage} from './packed-data.mjs?v=1a75398990a6';
import {markedText,matchExcerpts} from './text-matches.mjs?v=c9235b0b8b9b';
import {parseScriptureQuery,scriptureIntersects,scriptureReferenceLabel} from './scripture-search.mjs?v=0c303f3c35a1';
import {workInformationURL} from './work-information.mjs?v=edc958e66257';
import {searchState,searchURL,searchReaderURL,passageSearchText,textMatches,workReference,referenceMatches,pageSlice,plainExcerpt,useLabels,originLabels,speakerLabels,compositionLabels} from './archive-search-core.mjs?v=e4859555cee8';

const works=new Map(index.works.map(work=>[work.id,work]));
const loaded=new Map(),attempts=new Map();
let scripture,scriptureAttempts=0;
const scriptureModule='./archive-scripture.mjs?v=c0261ee3748f';
async function loadWork(work) {
  if(!loaded.has(work.id)) {
    const attempt=attempts.get(work.id)||0;
    loaded.set(work.id,import('./archive-readings/'+work.id+'.mjs?v='+work.version+(attempt?'&retry='+attempt:'')).then(module=>{
      const data=module.default;
      if(data.work!==work.id||data.source_sha256!==work.source_sha256||data.passages.length!==work.passages)throw new Error('문헌의 자료 판본이 맞지 않습니다. 새로고침 후 다시 검색하세요.');
      return data.passages;
    }).catch(error=>{loaded.delete(work.id);attempts.set(work.id,attempt+1);throw error;}));
  }
  return loaded.get(work.id);
}
async function loadWorks(selected) {
  const result=new Array(selected.length);let cursor=0;
  await Promise.all(Array.from({length:Math.min(6,selected.length)},async()=>{
    while(cursor<selected.length){const i=cursor++;result[i]={work:selected[i],rows:await loadWork(selected[i])};}
  }));
  return result;
}
async function scriptureData() {
  if(!scripture)scripture=import(scriptureModule+(scriptureAttempts?(scriptureModule.includes('?')?'&':'?')+'retry='+scriptureAttempts:'')).then(module=>{
    const data=module.default;
    if(data.schema_version!=='patristics-archive-scripture-1'||index.works.some(work=>data.source_bindings[work.id]!==work.source_sha256))throw new Error('성경 색인과 문헌 판본이 맞지 않습니다. 새로고침 후 다시 검색하세요.');
    return data;
  }).catch(error=>{scripture=null;scriptureAttempts++;throw error;});
  return scripture;
}

export async function archiveResults(state) {
  const selected=index.works.filter(work=>!state.work||work.id===state.work);
  const biblical=state.mode==='scripture'||state.mode==='ko'&&!state.exact?parseScriptureQuery(state.query):null;
  if(state.mode==='scripture'&&!biblical)return {kind:'invalid-scripture',rows:[]};
  if(biblical) {
    const data=await scriptureData();
    const references=data.references.filter(reference=>(!state.work||reference.work===state.work)&&(!state.relation||reference.use===state.relation)&&scriptureIntersects(reference,biblical));
    const byPassage=new Map();
    for(const reference of references){if(!byPassage.has(reference.passage))byPassage.set(reference.passage,[]);byPassage.get(reference.passage).push(reference);}
    const wanted=new Set(references.map(reference=>reference.work));
    const corpus=await loadWorks(selected.filter(work=>wanted.has(work.id)));
    return {kind:'scripture',query:biblical,rows:corpus.flatMap(({work,rows})=>rows.filter(row=>byPassage.has(row.id)).map(row=>({work,row,references:byPassage.get(row.id)})))};
  }
  const reference=state.mode==='ko'&&!state.exact?workReference(index.works,state.query,state.work,state.numbering):null;
  if(reference?.invalid)return {kind:'invalid-reference',rows:[]};
  if(reference?.works.length>1)return {kind:'ambiguous-reference',rows:[],candidates:reference.works.map(id=>works.get(id))};
  const wanted=reference?selected.filter(work=>reference.works.includes(work.id)):selected;
  const corpus=await loadWorks(wanted);
  if(reference) {
    return {kind:'reference',reference,rows:corpus.flatMap(({work,rows})=>rows.flatMap(row=>{
      const matches=referenceMatches(row,reference);return matches.length?[{work,row,numberMatches:matches}]:[];
    }))};
  }
  return {kind:'text',rows:corpus.flatMap(({work,rows})=>rows.flatMap(row=>{
    const text=passageSearchText(row,state.mode);return text&&textMatches(text,state.query,state.exact)?[{work,row,text}]:[];
  }))};
}

function referenceEvidence(item,reference) {
  const details=document.createElement('details');details.className='scripture-evidence';
  const summary=document.createElement('summary');summary.textContent=(reference.reading?.reference_label||scriptureReferenceLabel(reference))+' · '+useLabels[reference.use]+' · '+originLabels[reference.origin];details.append(summary);
  if(reference.reading) {
    const attribution=document.createElement('p');attribution.className='scripture-attribution';attribution.textContent=[speakerLabels[reference.reading.speaker],compositionLabels[reference.reading.composition]].filter(Boolean).join(' · ');if(attribution.textContent)details.append(attribution);
    const source=document.createElement('p');source.className='evidence-original';source.lang=item.row.languages[0];source.textContent=reference.reading.source_excerpt;
    const translation=document.createElement('p');translation.textContent=reference.reading.korean_excerpt;
    const reason=document.createElement('p');reason.textContent=reference.reading.reason;details.append(source,translation,reason);
  }
  const proof=document.createElement('p'),evidence=reference.evidence;
  if(Number.isInteger(evidence.note_index))proof.textContent=item.row.notes[evidence.note_index]||'이 대목의 번역 주석을 확인하세요.';
  else proof.textContent=evidence.label||evidence.korean_excerpt||'본문의 인용 대목을 확인하세요.';
  if(!reference.reading||Number.isInteger(evidence.note_index))details.append(proof);
  if(evidence.url) {
    let url;try{url=new URL(evidence.url);}catch{}
    if(url&&['http:','https:'].includes(url.protocol)){const link=document.createElement('a');link.href=url.href;link.target='_blank';link.rel='noopener';link.textContent='기록된 원문 근거';details.append(link);}
  }
  return details;
}

export function installArchiveSearch() {
  const form=document.getElementById('search-form');if(!form)return;
  const results=document.getElementById('search-results'),status=document.getElementById('search-status'),details=document.getElementById('body-search');
  const pagination=document.getElementById('search-pagination');
  let state=searchState(location.href),submission=0;
  if(state.work&&!works.has(state.work))state.work='';
  const names={query:'query',work:'work',mode:'mode',exact:'exact',relation:'relation',numbering:'numbering'};
  const field=name=>form.elements.namedItem(name);
  const controls=()=>{
    const mode=field('mode')?.value||'ko';
    const exact=field('exact')?.checked||false;
    const biblical=mode==='scripture'||mode==='ko'&&!exact&&!!parseScriptureQuery(field('query').value);
    const numbering=mode==='ko'&&!exact&&!!workReference(index.works,field('query').value,field('work').value,field('numbering')?.value);
    const exactControl=form.querySelector('.search-exact');if(exactControl)exactControl.hidden=mode==='scripture';
    const relationGroup=document.getElementById('scripture-relation-control'),numberGroup=document.getElementById('reference-numbering-control');
    if(relationGroup)relationGroup.hidden=!biblical;if(numberGroup)numberGroup.hidden=!numbering;
  };
  const fill=()=>{
    for(const [key,name] of Object.entries(names)){const element=field(name);if(!element)continue;if(key==='exact')element.checked=state.exact;else element.value=state[key]||'';}
    controls();
  };
  const collect=()=>{
    const value={query:field('query').value.trim(),work:field('work').value,mode:field('mode')?.value||'ko',exact:field('exact')?.checked||false,
      relation:field('relation')?.value||'',numbering:field('numbering')?.value||'edition',page:1};
    const reference=value.mode==='ko'&&!value.exact?workReference(index.works,value.query,value.work,value.numbering):null;
    if(reference){value.numbering=reference.scheme;if(field('numbering'))field('numbering').value=value.numbering;}
    return value;
  };
  const persist=replace=>{const url=searchURL(location.href,state);history[replace?'replaceState':'pushState'](history.state,'',url);};
  const button=(label,action)=>{const node=document.createElement('button');node.type='button';node.textContent=label;node.addEventListener('click',action);return node;};
  const go=async page=>{state={...state,page};persist(false);await run(false);status.focus({preventScroll:true});status.scrollIntoView({block:'start'});};
  const paint=(found,slice)=>{
    const fragment=document.createDocumentFragment();const groups=new Map(),counts=new Map();
    for(const item of found.rows)counts.set(item.work.id,(counts.get(item.work.id)||0)+1);
    for(const item of slice.rows){if(!groups.has(item.work.id))groups.set(item.work.id,[]);groups.get(item.work.id).push(item);}
    for(const [wid,items] of groups) {
      const work=works.get(wid),group=document.createElement('li');group.className='search-work-group';
      const heading=document.createElement('h3');heading.textContent=work.author+' · '+work.title;
      const count=document.createElement('span');count.className='search-work-count';count.textContent=counts.get(wid)+'개 대목';heading.append(count);
      const list=document.createElement('ol');list.className='search-passages';group.append(heading,list);
      for(const item of items) {
        const row=item.row,entry=document.createElement('li');entry.dataset.searchResult=row.id;
        const title=document.createElement('h4'),link=document.createElement('a'),reader=searchReaderURL(row.path,location.href,state);
        link.href=reader.href;link.textContent=row.label;title.append(link);entry.append(title);
        if(item.numberMatches&&found.reference.scheme==='conventional') {
          const mapping=document.createElement('p');mapping.className='reference-numbering';mapping.textContent=[...new Set(item.numberMatches.map(match=>match.label))].join(' · ');entry.append(mapping);
        }
        const body=document.createElement('p');body.className='search-excerpt';
        if(found.kind==='text') {
          body.lang=state.mode==='ko'?'ko':state.mode;
          const options={ignoreMarks:true,caseSensitive:false,collapseWhitespace:true,exact:state.exact};
          const excerpts=matchExcerpts(item.text,state.query,options);
          if(excerpts[0].start>0)body.append('… ');
          excerpts.forEach((excerpt,i)=>{if(i)body.append(' … ');body.append(markedText(document,excerpt.text,state.query,options));});
          if(excerpts.at(-1).end<item.text.length)body.append(' …');
        }else body.textContent=plainExcerpt(row.ko,item.references?.find(ref=>ref.reading)?.reading.korean_excerpt||'');
        entry.append(body);
        if(item.references) {
          const evidence=document.createElement('div');evidence.className='search-scripture-links';
          const seen=new Set();
          for(const reference of item.references) {
            const key=[reference.reading?.reference_label||scriptureReferenceLabel(reference),reference.origin,reference.use,reference.reading?.speaker].join('|');
            if(!seen.has(key)){evidence.append(referenceEvidence(item,reference));seen.add(key);}
          }
          entry.append(evidence);
        }
        const information=document.createElement('a');information.className='search-information-link';information.textContent='문헌 자료 정보';information.href=workInformationURL(wid,reader.href,location.href).href;
        entry.append(information);list.append(entry);
      }
      fragment.append(group);
    }
    results.replaceChildren(fragment);
    if(pagination){
      pagination.replaceChildren();pagination.hidden=slice.pages<2;
      const previous=button('이전',()=>go(slice.page-1)),next=button('다음',()=>go(slice.page+1));previous.disabled=slice.page===1;next.disabled=slice.page===slice.pages;
      const select=document.createElement('select');select.setAttribute('aria-label','검색 결과 페이지');
      for(let number=1;number<=slice.pages;number++){const option=document.createElement('option');option.value=String(number);option.textContent=number+' / '+slice.pages+'쪽';option.selected=number===slice.page;select.append(option);}
      select.addEventListener('change',()=>go(Number(select.value)));pagination.append(previous,select,next);
    }
  };
  const run=async (push=true)=>{
    const token=++submission,snapshot={...state};results.replaceChildren();if(pagination)pagination.hidden=true;
    if(push)persist(false);
    if(!snapshot.query.trim()){status.textContent='본문, 문헌의 장절 또는 성경 구절을 입력하세요.';results.removeAttribute('aria-busy');return;}
    details.open=true;status.textContent='수록 자료를 찾고 있습니다.';results.setAttribute('aria-busy','true');
    try {
      const found=await archiveResults(snapshot);if(token!==submission)return;
      if(found.kind==='invalid-scripture'){status.textContent='성경의 책과 장절을 입력하세요. 예: 요한복음 1:1, 고전 15:53-55';return;}
      if(found.kind==='invalid-reference'){status.textContent='문헌의 장절 번호를 확인하세요.';return;}
      if(found.kind==='ambiguous-reference') {
        status.textContent='여러 문헌에 해당합니다. 읽을 문헌을 선택하세요.';
        for(const candidate of found.candidates){const item=document.createElement('li');item.append(button(candidate.author+' · '+candidate.title,()=>{state={...snapshot,work:candidate.id,page:1};fill();run();}));results.append(item);}return;
      }
      const slice=pageSlice(found.rows,snapshot.page);state={...snapshot,page:slice.page,numbering:found.reference?.scheme||snapshot.numbering};
      if(field('numbering'))field('numbering').value=state.numbering;
      if(slice.page!==snapshot.page||state.numbering!==snapshot.numbering)persist(true);
      const prefix=found.kind==='scripture'?'성경 구절 관련 ':'';
      status.textContent=slice.total?(slice.pages===1?`${prefix}${slice.total.toLocaleString('ko-KR')}개 대목`:`${prefix}${slice.total.toLocaleString('ko-KR')}개 대목 중 ${slice.start+1}-${slice.end}개 · ${slice.page}/${slice.pages}쪽`):
        found.kind==='reference'?'해당 번호에 대응하는 대목이 없습니다. 장절 체계와 문헌을 확인하세요.':
        found.kind==='scripture'?'기록된 성경 참조 중 조건에 맞는 대목이 없습니다. 책·장절과 참조 유형을 확인하세요.':'수록된 본문에서 검색어를 찾지 못했습니다. 검색 대상과 문헌을 확인하세요.';
      paint(found,slice);
    }catch(error){if(token===submission)status.textContent=dataErrorMessage(error,'자료를 불러오지 못했습니다. 연결을 확인한 뒤 다시 검색하세요.');}
    finally{if(token===submission)results.removeAttribute('aria-busy');}
  };
  status.tabIndex=-1;fill();
  if(state.query||state.mode!=='ko'){details.open=true;run(false);}
  form.addEventListener('submit',event=>{event.preventDefault();state=collect();run();});
  field('query').addEventListener('input',controls);
  for(const name of ['mode','work','exact','relation','numbering'])field(name)?.addEventListener('change',()=>{
    if(name==='numbering')field('query').value=field('query').value.normalize('NFC').replace(/통상|Harvey/gi,'').replace(/\s+/g,' ').trim();
    controls();if(field('query').value.trim()){state=collect();run();}
  });
  document.querySelector('[data-search-reset]')?.addEventListener('click',()=>{state={query:'',work:'',mode:'ko',exact:false,relation:'',numbering:'edition',page:1};fill();run();field('query').focus();});
  window.addEventListener('popstate',()=>{state=searchState(location.href);if(!works.has(state.work))state.work='';fill();run(false);});
}

if(typeof document!=='undefined')installArchiveSearch();
