import {matchesIndex,correctionRecords,correctionState,correctionURL,filterCorrections} from './archive-index-core.mjs?v=4cd857c27807';
import {pageSlice} from './archive-search-core.mjs?v=c183809f9954';
import {unpackBytes,dataErrorMessage} from './packed-data.mjs?v=1a75398990a6';

function installIndexFilter(page) {
  const input=page.querySelector('[data-index-query]');if(!input)return;
  const rows=[...page.querySelectorAll('[data-index-search]')],status=page.querySelector('[data-index-status]');
  const apply=(persist=true)=>{
    let count=0;
    for(const row of rows){row.hidden=!matchesIndex(row.dataset.indexSearch,input.value);if(!row.hidden)count++;}
    status.textContent=count?(count+'개 '+(page.dataset.indexPage==='scripture'?'성경 책':'판본 묶음')):page.dataset.indexPage==='scripture'?'수록 자료에서 이 성경 책의 참조를 찾지 못했습니다. 책 이름이나 약칭으로 찾아보세요.':'조건에 맞는 자료가 없습니다. 다른 이름이나 연도로 찾아보세요.';
    if(persist){const url=new URL(location.href);if(input.value.trim())url.searchParams.set('q',input.value.trim());else url.searchParams.delete('q');history.replaceState(history.state,'',url);}
  };
  input.value=Array.from(new URL(location.href).searchParams.get('q')||'').slice(0,200).join('');apply(false);
  input.addEventListener('input',()=>apply());
  window.addEventListener('popstate',()=>{input.value=Array.from(new URL(location.href).searchParams.get('q')||'').slice(0,200).join('');apply(false);});
}

function installCorrections(page) {
  const form=page.querySelector('#correction-search');if(!form)return;
  const status=page.querySelector('#correction-status'),list=page.querySelector('#correction-results'),pager=page.querySelector('#correction-pagination'),retry=page.querySelector('#correction-retry');
  const query=form.elements.namedItem('query'),work=form.elements.namedItem('work');
  let state=correctionState(location.href),loading=null,rows=null,request=0;
  const fill=()=>{query.value=state.query;work.value=state.work;if(!work.value)state.work='';};fill();
  const records=async()=>{
    if(rows)return rows;
    if(!loading)loading=(async()=>{
      const index=(await import('./archive-correction-index.mjs?v=2090c74ca3d3')).default;
      const url=new URL('data/corrections.json',location.href);url.searchParams.set('v',index.data_sha256);
      const response=await fetch(url,{cache:'no-cache'});if(!response.ok)throw new Error('교정 기록을 불러오지 못했습니다. 연결을 확인한 뒤 다시 시도하세요.');
      const raw=await unpackBytes(await response.arrayBuffer(),index.data_sha256);
      rows=correctionRecords(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw)),index);return rows;
    })().catch(error=>{loading=null;throw error;});
    return loading;
  };
  const link=(url,label)=>{const anchor=document.createElement('a');anchor.href=url;anchor.textContent=label;return anchor;};
  const go=async pageNumber=>{state.page=pageNumber;await run();status.tabIndex=-1;status.focus({preventScroll:true});status.scrollIntoView({block:'start'});};
  const run=async(persist=true)=>{
    const id=++request;retry.hidden=true;pager.hidden=true;list.replaceChildren();list.setAttribute('aria-busy','true');status.textContent='교정 기록을 불러오고 있습니다.';
    if(persist)history.pushState(history.state,'',correctionURL(location.href,state));
    try {
      const data=await records();if(id!==request)return;
      const filtered=filterCorrections(data,state),slice=pageSlice(filtered,state.page);state.page=slice.page;
      history.replaceState(history.state,'',correctionURL(location.href,state));
      status.textContent=slice.total?(slice.pages>1?slice.total.toLocaleString('ko-KR')+'개 교정 중 '+(slice.start+1===slice.end?slice.end+'번째':(slice.start+1)+'-'+slice.end+'개')+' · '+slice.page+'/'+slice.pages+'쪽':slice.total+'개 교정'):'조건에 맞는 교정 기록이 없습니다. 문헌과 검색어를 확인하세요.';
      list.start=slice.start+1;
      for(const record of slice.rows) {
        const item=document.createElement('li'),heading=document.createElement('h2');heading.textContent=record.work.author+' · '+record.work.title+' '+record.label;item.append(heading);
        for(const [key,label] of [['reason',''],['before','이전 표기: '],['after','교정 표기: ']])if(typeof record[key]==='string') {
          const paragraph=document.createElement('p');paragraph.textContent=label+record[key];if(key!=='reason')paragraph.className='correction-wording';item.append(paragraph);
        }
        const actions=document.createElement('nav');actions.setAttribute('aria-label','교정 근거와 본문');
        if(record.path)actions.append(link(record.path,'해당 본문'));
        actions.append(link('works/'+record.work_id+'/information.html#history','판본·교정 이력'));
        if(record.evidence_url){let url;try{url=new URL(record.evidence_url);}catch{}if(url&&['http:','https:'].includes(url.protocol)){const anchor=link(url.href,'원문 근거');anchor.target='_blank';anchor.rel='noopener';actions.append(anchor);}}
        item.append(actions);list.append(item);
      }
      pager.replaceChildren();pager.hidden=slice.pages<2;
      for(const [label,number] of [['이전',slice.page-1],['다음',slice.page+1]]){const button=document.createElement('button');button.type='button';button.textContent=label;button.disabled=number<1||number>slice.pages;button.addEventListener('click',()=>go(number));pager.append(button);}
      const select=document.createElement('select');select.setAttribute('aria-label','교정 검색 결과 페이지');
      for(let number=1;number<=slice.pages;number++){const option=document.createElement('option');option.value=String(number);option.textContent=number+' / '+slice.pages+'쪽';option.selected=number===slice.page;select.append(option);}
      select.addEventListener('change',()=>go(Number(select.value)));pager.insertBefore(select,pager.lastChild);
    } catch(error){if(id===request){status.textContent=dataErrorMessage(error);retry.hidden=false;}}
    finally{if(id===request)list.removeAttribute('aria-busy');}
  };
  form.addEventListener('submit',event=>{event.preventDefault();state={query:query.value.trim(),work:work.value,page:1};run();});
  work.addEventListener('change',()=>{state={query:query.value.trim(),work:work.value,page:1};run();});
  retry.addEventListener('click',()=>run(false));window.addEventListener('popstate',()=>{state=correctionState(location.href);fill();run(false);});run(false);
}

const page=document.querySelector('.archive-index-page');if(page){installIndexFilter(page);installCorrections(page);}
