import {createArchiveSearchClient} from './archive-search-client.mjs?v=4838be3f334e';
import {copyControl} from './copy-control.mjs?v=1b32deb2f89c';
export {archiveResults} from './archive-search-engine.mjs?v=75d58ab8c498';
import index from './archive-search-index.mjs?v=600e1afc6884';
import {dataErrorMessage} from './packed-data.mjs?v=1a75398990a6';
import {markedText,matchExcerpts} from './text-matches.mjs?v=149147752b85';
import {parseScriptureQuery,scriptureReferenceLabel} from './scripture-search.mjs?v=944aed4c0321';
import {workInformationURL} from './work-information.mjs?v=3f8e81d9a371';
import {searchState,searchURL,searchReaderURL,workReference,pageSlice,plainExcerpt,useLabels,originLabels,speakerLabels,compositionLabels,resultCitation,resultCSV} from './archive-search-core.mjs?v=81ebd941d0ad';
import {workShortcuts,relatedTopics,facetCounts,searchKind,appliedConditions} from './search-results.mjs?v=a3d05daa3f04';

const works=new Map(index.works.map(work=>[work.id,work]));
const EXCERPT={ignoreMarks:true,caseSensitive:false,collapseWhitespace:true,before:48,after:96,limit:240};
const SHORTCUTS=8;
const DEFAULTS={mode:'ko',work:'',exact:false,relation:'',numbering:'edition',match:'all',exclude:''};

function referenceEvidence(item,reference) {
  const details=document.createElement('details');details.className='scripture-evidence';
  const summary=document.createElement('summary');summary.textContent=(reference.reading?.reference_label||scriptureReferenceLabel(reference))+' · '+useLabels[reference.use]+' · '+originLabels[reference.origin];details.append(summary);
  if(reference.reading) {
    const attribution=document.createElement('p');attribution.className='scripture-attribution';attribution.textContent=[speakerLabels[reference.reading.speaker],compositionLabels[reference.reading.composition]].filter(Boolean).join(' · ');if(attribution.textContent)details.append(attribution);
    const source=document.createElement('p');source.className='evidence-original';source.lang=item.row.languages[0]==='lat'?'la':item.row.languages[0];source.textContent=reference.reading.source_excerpt;
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

function catalogueData() {
  try{return JSON.parse(document.getElementById('search-catalogue')?.textContent||'{}');}catch{return {};}
}

export function installArchiveSearch() {
  const form=document.getElementById('search-form');if(!form)return;
  const catalogue=catalogueData(),shortcutWorks=catalogue.works||[],topics=catalogue.topics||[];
  const status=document.getElementById('search-status'),results=document.getElementById('search-results');
  const worksBlock=document.getElementById('search-works'),topicsBlock=document.getElementById('search-topics'),passages=document.getElementById('search-passages');
  const kind=document.getElementById('search-kind'),countLine=document.getElementById('search-count'),facets=document.getElementById('search-facets'),facetSelect=document.getElementById('search-facet-select');
  const paginations=[...document.querySelectorAll('[data-search-pagination]')];
  const applied=document.getElementById('search-applied'),reset=document.querySelector('[data-search-reset]'),badge=document.querySelector('[data-condition-count]');
  const cancel=document.getElementById('search-cancel'),exportButton=document.getElementById('search-export'),exportFile=document.getElementById('search-export-file');
  const client=createArchiveSearchClient();
  let state=searchState(location.href),submission=0,lastFound=null,lastState=null,exportURL=null,cache=null;
  if(state.work&&!works.has(state.work))state.work='';
  const names={query:'query',work:'work',mode:'mode',exact:'exact',relation:'relation',numbering:'numbering',match:'match',exclude:'exclude'};
  const field=name=>form.elements.namedItem(name);
  const queryKind=(query,mode,exact,work,numbering)=>{
    const scripture=mode==='scripture'||mode==='ko'&&!exact?parseScriptureQuery(query):null;
    const reference=!scripture&&mode==='ko'&&!exact?workReference(index.works,query,work,numbering):null;
    return {scripture,reference};
  };
  const controls=()=>{
    const mode=field('mode').value,exact=field('exact').checked;
    const {scripture,reference}=queryKind(field('query').value,mode,exact,field('work').value,field('numbering').value);
    form.querySelector('.search-exact').hidden=mode==='scripture';
    document.getElementById('scripture-relation-control').hidden=!scripture;
    document.getElementById('reference-numbering-control').hidden=!reference;
    field('match').disabled=exact;
  };
  const showApplied=()=>{
    const labels=appliedConditions(state,works);
    applied.hidden=reset.hidden=!labels.length;applied.textContent=labels.length?'적용한 조건: '+labels.join(' · '):'';
    badge.hidden=!labels.length;badge.textContent=labels.length?String(labels.length):'';
  };
  const fill=()=>{
    for(const [key,name] of Object.entries(names)){const element=field(name);if(key==='exact')element.checked=state.exact;else element.value=state[key]||'';}
    if(!field('work').value)field('work').value='';
    controls();showApplied();
  };
  const collect=()=>{
    const value={query:field('query').value.trim(),work:field('work').value,mode:field('mode').value||'ko',exact:field('exact').checked,
      relation:field('relation').value||'',numbering:field('numbering').value||'edition',page:1,
      match:field('match').value||'all',exclude:field('exclude').value.trim()};
    const {reference}=queryKind(value.query,value.mode,value.exact,value.work,value.numbering);
    if(reference){value.numbering=reference.scheme;field('numbering').value=value.numbering;}
    return value;
  };
  const persist=replace=>{history[replace?'replaceState':'pushState'](replace?history.state:null,'',searchURL(location.href,state));};
  const button=(label,action)=>{const node=document.createElement('button');node.type='button';node.textContent=label;node.addEventListener('click',action);return node;};
  const go=async(page,anchor)=>{state={...state,page};persist(false);await run(false);anchor.scrollIntoView({block:'start'});status.focus({preventScroll:true});};
  const narrow=work=>{state={...state,work,page:1};fill();persist(false);run(false).then(()=>passages.scrollIntoView({block:'start'}));};
  const clear=()=>{
    results.replaceChildren();passages.hidden=worksBlock.hidden=topicsBlock.hidden=facets.hidden=true;
    for(const nav of paginations)nav.hidden=true;exportButton.hidden=true;kind.textContent=countLine.textContent='';
  };
  const paintShortcuts=(query,scripture,reference)=>{
    const list=worksBlock.querySelector('ul'),found=scripture||reference?{rows:[],total:0}:workShortcuts(shortcutWorks,query,Infinity);
    list.replaceChildren(...found.rows.map(work=>{
      const item=document.createElement('li'),title=document.createElement('a'),meta=document.createElement('p');
      title.href=work.path;title.className='search-work-title';title.textContent=work.title;
      meta.className='search-work-meta';meta.textContent=[work.author,work.extent].filter(Boolean).join(' · ');item.append(title,meta);
      if(work.description){const description=document.createElement('p');description.className='search-work-description';description.textContent=work.description;item.append(description);}
      return item;
    }));
    // The first eight matches show at once; the rest open in place with the same query.
    const items=[...list.children];items.slice(SHORTCUTS).forEach(item=>{item.hidden=true;});
    if(items.length>SHORTCUTS){
      const more=document.createElement('li');more.className='search-more';
      const open=button('일치하는 문헌 '+items.length+'편 모두 보기',()=>{items.forEach(item=>{item.hidden=false;});more.remove();items[SHORTCUTS].querySelector('a')?.focus();});
      open.setAttribute('aria-controls','search-works');more.append(open);list.append(more);
    }
    worksBlock.hidden=!found.rows.length;
    const topicList=topicsBlock.querySelector('ul'),topicFound=state.mode==='ko'&&!scripture&&!reference?relatedTopics(topics,query,3):{rows:[],total:0};
    topicList.replaceChildren(...topicFound.rows.map(topic=>{
      const item=document.createElement('li'),link=document.createElement('a'),meta=document.createElement('p');
      const url=new URL('topics.html',location.href);url.searchParams.set('q',query);url.hash='topic-'+topic.id;
      link.href=url.href;link.textContent=topic.title;meta.className='search-topic-meta';meta.textContent=[topic.group,topic.passages+'개 대목'].filter(Boolean).join(' · ');
      item.append(link,meta);if(topic.summary){const summary=document.createElement('p');summary.className='search-topic-summary';summary.textContent=topic.summary;item.append(summary);}
      return item;
    }));
    const all=topicsBlock.querySelector('.search-topics-all'),url=new URL('topics.html',location.href);url.searchParams.set('q',query);url.hash='topics-all';all.href=url.href;
    all.textContent=topicFound.total>topicFound.rows.length?'주제별 읽기에서 '+topicFound.total+'개 주제 모두 보기':'주제별 읽기에서 더 찾기';
    topicsBlock.hidden=!topicFound.rows.length;
    return {works:found.total,topics:topicFound.total};
  };
  const paintFacets=(counts,total)=>{
    const list=facets.querySelector('ul');list.replaceChildren();facetSelect.replaceChildren();
    const entries=[{id:'',count:total,label:'전체 문헌'},...counts.map(row=>({...row,label:works.get(row.id).title,author:works.get(row.id).author}))];
    for(const entry of entries) {
      const item=document.createElement('li'),link=document.createElement('a'),url=searchURL(location.href,{...state,work:entry.id,page:1});
      link.href=url.href;link.dataset.facet=entry.id;if(entry.id===state.work)link.setAttribute('aria-current','true');
      const label=document.createElement('span');label.className='search-facet-label';label.textContent=entry.label;
      if(entry.author){const author=document.createElement('small');author.textContent=entry.author;label.append(author);}
      const count=document.createElement('span');count.className='count';count.textContent=entry.count.toLocaleString('ko-KR');
      link.append(label,count);item.append(link);list.append(item);
      link.addEventListener('click',event=>{if(event.button||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();narrow(entry.id);});
      const option=document.createElement('option');option.value=entry.id;option.textContent=(entry.author?entry.author+' · ':'')+entry.label+' '+entry.count.toLocaleString('ko-KR');option.selected=entry.id===state.work;facetSelect.append(option);
    }
    facets.hidden=counts.length<2&&!state.work;facetSelect.closest('label').hidden=facets.hidden;
  };
  const paintPagination=slice=>{
    for(const nav of paginations) {
      nav.replaceChildren();nav.hidden=slice.pages<2;if(nav.hidden)continue;
      const anchor=passages;
      const previous=button('이전',()=>go(slice.page-1,anchor)),next=button('다음',()=>go(slice.page+1,anchor));previous.disabled=slice.page===1;next.disabled=slice.page===slice.pages;
      const select=document.createElement('select');select.setAttribute('aria-label','검색 결과 쪽');
      for(let number=1;number<=slice.pages;number++){const option=document.createElement('option');option.value=String(number);option.textContent=number+' / '+slice.pages+'쪽';option.selected=number===slice.page;select.append(option);}
      select.addEventListener('change',()=>go(Number(select.value),anchor));nav.append(previous,select,next);
    }
  };
  const paint=(found,rows,slice)=>{
    const fragment=document.createDocumentFragment(),groups=new Map(),counts=new Map();
    for(const item of rows)counts.set(item.work.id,(counts.get(item.work.id)||0)+1);
    for(const item of slice.rows){if(!groups.has(item.work.id))groups.set(item.work.id,[]);groups.get(item.work.id).push(item);}
    for(const [wid,items] of groups) {
      const work=works.get(wid),group=document.createElement('li');group.className='search-work-group';
      const heading=document.createElement('h3'),title=document.createElement('span'),author=document.createElement('span'),count=document.createElement('span');
      title.className='search-group-title';title.textContent=work.title;author.className='search-group-author';author.textContent=work.author;
      count.className='search-work-count';count.textContent=counts.get(wid).toLocaleString('ko-KR')+'개 대목';heading.append(title,author,count);
      const list=document.createElement('ol');list.className='search-passages-list';group.append(heading,list);
      for(const item of items) {
        const row=item.row,entry=document.createElement('li');entry.dataset.searchResult=row.id;
        const path=item.noteMatches?row.path.split('#')[0]+'#note-'+row.location.replace(/\./g,'-'):row.path;
        const heading=document.createElement('h4'),link=document.createElement('a'),reader=searchReaderURL(path,location.href,state,row.id);
        link.href=reader.href;link.textContent=row.label+(item.noteMatches?' · 번역 주석':'');heading.append(link);entry.append(heading);
        if(item.numberMatches&&found.reference.scheme==='conventional') {
          const mapping=document.createElement('p');mapping.className='reference-numbering';mapping.textContent=[...new Set(item.numberMatches.map(match=>match.label))].join(' · ');entry.append(mapping);
        }
        const body=document.createElement('p');body.className='search-excerpt';
        if(found.kind==='text') {
          body.lang=['ko','notes'].includes(state.mode)?'ko':state.mode==='lat'?'la':state.mode;
          const options={...EXCERPT,exact:state.exact};
          const excerpts=matchExcerpts(item.text,state.query,options).slice(0,2);
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
        const information=document.createElement('a');information.className='search-information-link';information.textContent='자료 정보';information.href=workInformationURL(wid,reader.href,location.href).href;
        const actions=document.createElement('div');actions.className='search-result-actions';
        actions.append(copyControl('인용 복사',()=>resultCitation(item),work.title+' '+row.label+' 고정 인용 복사'),information);
        entry.append(actions);list.append(entry);
      }
      fragment.append(group);
    }
    results.replaceChildren(fragment);paintPagination(slice);
  };
  const countText=(found,slice)=>{
    if(slice.total)return slice.pages===1?`${slice.total.toLocaleString('ko-KR')}개 대목`:`${slice.total.toLocaleString('ko-KR')}개 대목 중 ${slice.start+1}-${slice.end} · ${slice.page}/${slice.pages}쪽`;
    if(found.kind==='reference')return '해당 번호의 대목이 없습니다. 장절 번호나 장절 체계를 확인하세요.';
    if(found.kind==='scripture')return '이 성경 구절을 참조한 대목이 없습니다. 장절이나 참조 유형을 확인하세요.';
    return appliedConditions(state,works).length?'조건에 맞는 대목이 없습니다. 적용한 조건을 확인하세요.':'본문에서 찾지 못했습니다.';
  };
  // One line above every section: what each section holds, with a way down to the passages.
  const summarize=(shown,total)=>{
    const parts=[];
    if(shown.works)parts.push('문헌 '+shown.works+'편');
    if(shown.topics)parts.push('관련 주제 '+shown.topics+'개');
    const passageText=total?'본문 '+total.toLocaleString('ko-KR')+'개 대목':'본문 일치 없음';
    status.replaceChildren(parts.join(' · ')+(parts.length?' · ':''));
    if(total&&parts.length){const jump=button(passageText,()=>{passages.scrollIntoView({block:'start'});passages.querySelector('.search-passages-list h4 a')?.focus({preventScroll:true});});jump.className='search-jump';status.append(jump);}
    else status.append(passageText);
  };
  const run=async (push=true)=>{
    const token=++submission,snapshot={...state};lastFound=null;lastState=null;
    if(exportURL){URL.revokeObjectURL(exportURL);exportURL=null;}exportFile.hidden=true;exportFile.removeAttribute('href');
    cancel.hidden=true;showApplied();
    if(push)persist(false);
    if(!snapshot.query.trim()){client.cancel();clear();status.textContent='검색어를 입력하세요. 문헌 제목·저자, 본문의 낱말, 문헌 장절이나 성경 구절을 찾습니다.';results.removeAttribute('aria-busy');return;}
    const {scripture,reference}=queryKind(snapshot.query,snapshot.mode,snapshot.exact,snapshot.work,snapshot.numbering);
    // Results are counted across all works so the work list can narrow without searching again.
    const scoped=snapshot.work&&!reference,request={...snapshot,page:1,work:scoped?'':snapshot.work},key=JSON.stringify(request);
    let found=cache?.key===key?cache.found:null;
    let shown=found?paintShortcuts(snapshot.query,scripture,reference):null;
    if(!found) {
      clear();
      shown=paintShortcuts(snapshot.query,scripture,reference);
      status.textContent='수록 자료를 찾고 있습니다.';results.setAttribute('aria-busy','true');cancel.hidden=false;
    }
    try {
      if(!found){found=await client.run(request,{onProgress:progress=>{
        if(token===submission)status.textContent='문헌 '+progress.loaded+'/'+progress.total+'편의 자료를 읽었습니다.';
      }});if(token!==submission)return;cache={key,found};}
      results.replaceChildren();passages.hidden=false;countLine.textContent='';
      if(found.kind==='invalid-scripture'){kind.textContent='성경 구절 검색';status.textContent='성경의 책과 장절을 입력하세요. 예: 요한복음 1:1, 고전 15:53-55';facets.hidden=true;for(const nav of paginations)nav.hidden=true;exportButton.hidden=true;return;}
      if(found.kind==='invalid-reference'){kind.textContent='문헌 장절 검색';status.textContent='문헌의 장절 번호를 확인하세요.';facets.hidden=true;for(const nav of paginations)nav.hidden=true;exportButton.hidden=true;return;}
      if(found.kind==='ambiguous-reference') {
        kind.textContent='문헌 장절 검색';status.textContent='여러 문헌에 해당합니다. 읽을 문헌을 고르세요.';facets.hidden=true;exportButton.hidden=true;for(const nav of paginations)nav.hidden=true;
        for(const candidate of found.candidates){const item=document.createElement('li');item.className='search-candidate';item.append(button(candidate.author+' · '+candidate.title,()=>{state={...snapshot,work:candidate.id,page:1};fill();run();}));results.append(item);}return;
      }
      const rows=scoped?found.rows.filter(item=>item.work.id===snapshot.work):found.rows;
      const slice=pageSlice(rows,snapshot.page);state={...snapshot,page:slice.page,numbering:found.reference?.scheme||snapshot.numbering};
      field('numbering').value=state.numbering;
      if(slice.page!==snapshot.page||state.numbering!==snapshot.numbering)persist(true);
      kind.textContent=searchKind(found,state,works);countLine.textContent=countText(found,slice);summarize(shown,rows.length);
      if(found.kind==='reference')facets.hidden=facetSelect.closest('label').hidden=true;
      else paintFacets(facetCounts(found.rows),found.rows.length);
      paint(found,rows,slice);
      lastFound={...found,rows};lastState={...state};exportButton.hidden=!rows.length;
      passages.classList.toggle('is-empty',!rows.length);
    }catch(error){if(token===submission&&error.name!=='AbortError')status.textContent=dataErrorMessage(error,'자료를 불러오지 못했습니다. 연결을 확인한 뒤 다시 검색하세요.');}
    finally{if(token===submission){results.removeAttribute('aria-busy');cancel.hidden=true;}}
  };
  const focusReturn=()=>{
    if(!location.hash.startsWith('#result-'))return false;
    let id;try{id=decodeURIComponent(location.hash.slice(8));}catch{return false;}
    const entry=results.querySelector('[data-search-result="'+CSS.escape(id)+'"]');if(!entry)return false;
    entry.classList.add('is-returned');entry.scrollIntoView({block:'center'});entry.querySelector('h4 a')?.focus({preventScroll:true});return true;
  };
  const restore=()=>{
    let interacted=false;const touch=()=>{interacted=true;};const events=['wheel','touchmove','pointerdown','keydown'];
    for(const event of events)window.addEventListener(event,touch,{passive:true});
    const saved=history.state?.searchScroll;
    return run(false).finally(()=>{
      for(const event of events)window.removeEventListener(event,touch);
      if(interacted)return;
      if(!focusReturn()&&Number.isFinite(saved))requestAnimationFrame(()=>window.scrollTo(0,saved));
    });
  };
  if('scrollRestoration' in history)history.scrollRestoration='manual';
  status.tabIndex=-1;fill();
  if(state.query)restore();else if(!location.hash)field('query').focus();
  form.addEventListener('submit',event=>{event.preventDefault();state=collect();run();if(matchMedia('(pointer: coarse)').matches)field('query').blur();});
  field('query').addEventListener('input',controls);
  for(const name of ['mode','work','exact','relation','numbering','match'])field(name).addEventListener('change',()=>{
    if(name==='numbering')field('query').value=field('query').value.normalize('NFC').replace(/통상|Harvey/gi,'').replace(/\s+/g,' ').trim();
    controls();if(field('query').value.trim()){state=collect();run();}else{state={...collect(),query:''};showApplied();}
  });
  field('exclude').addEventListener('change',()=>{if(field('query').value.trim()){state=collect();run();}else{state={...collect(),query:''};showApplied();}});
  facetSelect.addEventListener('change',()=>narrow(facetSelect.value));
  reset.addEventListener('click',()=>{state={...state,...DEFAULTS,page:1};fill();if(state.query)run();else{persist(false);showApplied();}field('query').focus();});
  cancel.addEventListener('click',()=>{submission++;client.cancel();cancel.hidden=true;results.removeAttribute('aria-busy');status.textContent='검색을 취소했습니다. 조건을 바꾸거나 다시 검색하세요.';field('query').focus();});
  exportButton.addEventListener('click',()=>{
    if(!lastFound||!lastState)return;
    const csv=resultCSV(lastFound,lastState,location.href);if(exportURL)URL.revokeObjectURL(exportURL);exportURL=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
    exportFile.href=exportURL;exportFile.download='patristics-search-'+lastState.mode+'.csv';exportFile.hidden=false;exportFile.click();status.textContent=lastFound.rows.length.toLocaleString('ko-KR')+'개 대목의 CSV를 준비했습니다.';
  });
  window.addEventListener('pagehide',()=>{client.cancel();history.replaceState({...history.state,searchScroll:scrollY},'',location.href);});
  window.addEventListener('popstate',()=>{state=searchState(location.href);if(!works.has(state.work))state.work='';fill();restore();});
}

if(typeof document!=='undefined')installArchiveSearch();
