import {createArchiveSearchClient} from './archive-search-client.mjs?v=d1570746f8a7';
import {copyControl} from './copy-control.mjs?v=1b32deb2f89c';
export {archiveResults} from './archive-search-engine.mjs?v=824d96d5bb7a';
import index from './archive-search-index.mjs?v=9d563b22713c';
import {dataErrorMessage} from './packed-data.mjs?v=1a75398990a6';
import {markedText,matchExcerpts} from './text-matches.mjs?v=c9235b0b8b9b';
import {parseScriptureQuery,scriptureIntersects,scriptureReferenceLabel} from './scripture-search.mjs?v=e127e538461b';
import {workInformationURL} from './work-information.mjs?v=edc958e66257';
import {searchState,searchURL,searchReaderURL,workReference,pageSlice,plainExcerpt,useLabels,originLabels,speakerLabels,compositionLabels,resultCitation,resultCSV} from './archive-search-core.mjs?v=c183809f9954';

const works=new Map(index.works.map(work=>[work.id,work]));

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
  const cancel=document.getElementById('search-cancel'),exportButton=document.getElementById('search-export'),exportFile=document.getElementById('search-export-file');
  const client=createArchiveSearchClient();
  let state=searchState(location.href),submission=0,lastFound=null,lastState=null,exportURL=null;
  if(state.work&&!works.has(state.work))state.work='';
  const names={query:'query',work:'work',mode:'mode',exact:'exact',relation:'relation',numbering:'numbering',match:'match',exclude:'exclude'};
  const field=name=>form.elements.namedItem(name);
  const controls=()=>{
    const mode=field('mode')?.value||'ko';
    const exact=field('exact')?.checked||false;
    const biblical=mode==='scripture'||mode==='ko'&&!exact&&!!parseScriptureQuery(field('query').value);
    const numbering=mode==='ko'&&!exact&&!!workReference(index.works,field('query').value,field('work').value,field('numbering')?.value);
    const exactControl=form.querySelector('.search-exact');if(exactControl)exactControl.hidden=mode==='scripture';
    const relationGroup=document.getElementById('scripture-relation-control'),numberGroup=document.getElementById('reference-numbering-control');
    if(relationGroup)relationGroup.hidden=!biblical;if(numberGroup)numberGroup.hidden=!numbering;
    const advanced=document.getElementById('search-text-conditions');if(advanced)advanced.hidden=biblical||numbering;
    if(field('match'))field('match').disabled=exact;
  };
  const fill=()=>{
    for(const [key,name] of Object.entries(names)){const element=field(name);if(!element)continue;if(key==='exact')element.checked=state.exact;else element.value=state[key]||'';}
    controls();
    const advanced=document.getElementById('search-text-conditions');if(advanced&&(state.match==='any'||state.exclude))advanced.open=true;
  };
  const collect=()=>{
    const value={query:field('query').value.trim(),work:field('work').value,mode:field('mode')?.value||'ko',exact:field('exact')?.checked||false,
      relation:field('relation')?.value||'',numbering:field('numbering')?.value||'edition',page:1,
      match:field('match')?.value||'all',exclude:field('exclude')?.value.trim()||''};
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
        const path=item.noteMatches?row.path.split('#')[0]+'#note-'+row.location.replace(/\./g,'-'):row.path;
        const title=document.createElement('h4'),link=document.createElement('a'),reader=searchReaderURL(path,location.href,state);
        link.href=reader.href;link.textContent=row.label+(item.noteMatches?' · 번역 주석':'');title.append(link);entry.append(title);
        if(item.numberMatches&&found.reference.scheme==='conventional') {
          const mapping=document.createElement('p');mapping.className='reference-numbering';mapping.textContent=[...new Set(item.numberMatches.map(match=>match.label))].join(' · ');entry.append(mapping);
        }
        const body=document.createElement('p');body.className='search-excerpt';
        if(found.kind==='text') {
          body.lang=['ko','notes'].includes(state.mode)?'ko':state.mode;
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
        const actions=document.createElement('div');actions.className='search-result-actions';
        actions.append(information,copyControl('인용 복사',()=>resultCitation(item),work.title+' '+row.label+' 고정 인용 복사'));
        entry.append(actions);list.append(entry);
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
    const token=++submission,snapshot={...state};lastFound=null;lastState=null;
    if(exportURL){URL.revokeObjectURL(exportURL);exportURL=null;}if(exportFile){exportFile.hidden=true;exportFile.removeAttribute('href');}
    results.replaceChildren();if(pagination)pagination.hidden=true;if(exportButton)exportButton.hidden=true;if(cancel)cancel.hidden=true;
    if(push)persist(false);
    if(!snapshot.query.trim()){client.cancel();status.textContent='본문, 문헌의 장절 또는 성경 구절을 입력하세요.';results.removeAttribute('aria-busy');return;}
    details.open=true;status.textContent='수록 자료를 찾고 있습니다.';results.setAttribute('aria-busy','true');
    if(cancel)cancel.hidden=false;
    try {
      const found=await client.run(snapshot,{onProgress:progress=>{
        if(token===submission)status.textContent='문헌 '+progress.loaded+'/'+progress.total+'편의 자료를 읽었습니다.';
      }});if(token!==submission)return;
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
      lastFound=found;lastState={...state};if(exportButton)exportButton.hidden=!found.rows.length;
    }catch(error){if(token===submission&&error.name!=='AbortError')status.textContent=dataErrorMessage(error,'자료를 불러오지 못했습니다. 연결을 확인한 뒤 다시 검색하세요.');}
    finally{if(token===submission){results.removeAttribute('aria-busy');if(cancel)cancel.hidden=true;}}
  };
  const restore=()=>{
    const version=submission+1;let interacted=false;
    const touch=()=>{interacted=true;};const events=['wheel','touchmove','pointerdown','keydown'];
    for(const event of events)window.addEventListener(event,touch,{passive:true});
    run(false).finally(()=>{
      for(const event of events)window.removeEventListener(event,touch);
      if(!interacted&&submission===version&&location.hash==='#body-search')requestAnimationFrame(()=>details.scrollIntoView({block:'start'}));
    });
  };
  status.tabIndex=-1;fill();
  if(state.query||state.mode!=='ko'){details.open=true;restore();}
  form.addEventListener('submit',event=>{event.preventDefault();state=collect();run();});
  field('query').addEventListener('input',controls);
  for(const name of ['mode','work','exact','relation','numbering','match'])field(name)?.addEventListener('change',()=>{
    if(name==='numbering')field('query').value=field('query').value.normalize('NFC').replace(/통상|Harvey/gi,'').replace(/\s+/g,' ').trim();
    controls();if(field('query').value.trim()){state=collect();run();}
  });
  document.querySelector('[data-search-reset]')?.addEventListener('click',()=>{state={query:'',work:'',mode:'ko',exact:false,relation:'',numbering:'edition',page:1,match:'all',exclude:''};fill();run();field('query').focus();});
  cancel?.addEventListener('click',()=>{submission++;client.cancel();cancel.hidden=true;results.removeAttribute('aria-busy');status.textContent='검색을 취소했습니다. 조건을 바꾸거나 다시 검색하세요.';field('query').focus();});
  exportButton?.addEventListener('click',()=>{
    if(!lastFound||!lastState)return;
    const csv=resultCSV(lastFound,lastState,location.href);if(exportURL)URL.revokeObjectURL(exportURL);exportURL=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
    exportFile.href=exportURL;exportFile.download='patristics-search-'+lastState.mode+'.csv';exportFile.hidden=false;exportFile.click();status.textContent=lastFound.rows.length.toLocaleString('ko-KR')+'개 대목의 CSV를 준비했습니다.';
  });
  window.addEventListener('pagehide',()=>client.cancel());
  window.addEventListener('popstate',()=>{state=searchState(location.href);if(!works.has(state.work))state.work='';fill();restore();});
}

if(typeof document!=='undefined')installArchiveSearch();
