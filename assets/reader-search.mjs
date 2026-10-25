import {searchReturnURL,searchState,textMatches} from './archive-search-core.mjs?v=81ebd941d0ad';
import {matchRanges} from './text-matches.mjs?v=149147752b85';

export function selectedTextGroups(nodes,language='') {
  const groups=[];let current=[];
  const normalized=value=>value==='la'?'lat':value;
  const flush=()=>{if(current.some(row=>row.text.trim()))groups.push(current);current=[];};
  for(const row of nodes) {
    if(!language||normalized(row.language)===normalized(language)||!row.text.trim())current.push(row);
    else flush();
  }
  flush();return groups;
}

// Search results return to the result that was opened, on the results page it came from.
// Addresses written before the result id was recorded fall back to the passage the reader first landed on.
export function searchBackURL(current,landing='') {
  const back=searchReturnURL(current);if(!back)return null;
  if(!back.hash&&landing)back.hash='result-'+landing;
  return back;
}

function landingPassage() {
  let id='';try{id=decodeURIComponent(location.hash.slice(1));}catch{}
  const node=id?document.getElementById(id):null;
  const passage=node?.closest('article.passage')||(id.startsWith('note-')?document.getElementById(id.replace(/^note-/,'p-'))?.closest('article.passage'):null);
  return passage?.dataset.passageId||'';
}

function installSearchReturn(tools) {
  const back=searchBackURL(location.href,landingPassage());
  if(!back||tools.querySelector('.reader-search-return'))return null;
  const link=document.createElement('a');link.className='reader-search-return';link.href=back.href;link.textContent='검색 결과';
  const query=searchState(back.href).query.trim();
  link.setAttribute('aria-label',query?'‘'+query+'’ 검색 결과로 돌아가기':'검색 결과로 돌아가기');
  const media=matchMedia('(max-width: 720px)');
  const place=()=>{
    const panel=tools.querySelector('.reader-controls');
    if(media.matches&&panel)tools.insertBefore(link,panel);else (tools.querySelector('.reader-tools-panel')||tools).prepend(link);
    tools.classList.toggle('has-search-return',true);
  };
  media.addEventListener('change',()=>requestAnimationFrame(place));
  place();
  return link;
}

export function installReaderSearch() {
  const tools=document.querySelector('.reader-tools');
  if(!tools||!/^\/works\//.test(location.pathname)||document.querySelector('.reader-search-controls'))return;
  const back=searchReturnURL(location.href);if(!back)return;
  installSearchReturn(tools);
  const state=searchState(back.href);if(state.mode==='scripture'||!state.query.trim())return;
  const selector=state.mode==='notes'?'.reader-notes li[id] > p':state.mode==='ko'?'article.passage .translation':'article.passage .original';
  const matches=[];
  for(const block of document.querySelectorAll(selector)) {
    const walker=document.createTreeWalker(block,NodeFilter.SHOW_TEXT),nodes=[];let node;
    while(node=walker.nextNode())nodes.push({node,text:node.textContent,language:node.parentElement.closest('[lang]')?.lang||''});
    const groups=selectedTextGroups(nodes,['grc','lat'].includes(state.mode)?state.mode:'');
    const full=groups.map(group=>group.map(row=>row.text).join('')).join(' … ');
    if(!textMatches(full,state.query,state.exact,state.match,state.exclude))continue;
    for(const group of groups) {
      let offset=0;
      const indexed=group.map(row=>{const result={...row,start:offset,end:offset+row.text.length};offset=result.end;return result;});
      const text=group.map(row=>row.text).join('');
      for(const [start,end] of matchRanges(text,state.query,{ignoreMarks:true,caseSensitive:false,collapseWhitespace:true,exact:state.exact})) {
        const first=indexed.find(row=>row.end>start),last=indexed.find(row=>row.end>=end);
        if(!first||!last)continue;
        const range=document.createRange();range.setStart(first.node,start-first.start);range.setEnd(last.node,end-last.start);
        matches.push({range,block,unit:block.closest('article.passage,.reader-notes li[id]')});
      }
    }
  }
  if(!matches.length)return;
  const controls=document.createElement('div');controls.className='reader-search-controls';controls.setAttribute('role','group');controls.setAttribute('aria-label','본문 검색어 이동');
  const label=document.createElement('span');label.className='reader-search-label';label.textContent=state.query;label.title=state.query;
  const count=document.createElement('span');count.setAttribute('role','status');count.className='reader-search-count';
  const previous=document.createElement('button'),next=document.createElement('button');
  previous.type=next.type='button';previous.textContent='이전 일치';next.textContent='다음 일치';
  const toggle=document.createElement('label');toggle.className='reader-search-toggle';const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.checked=true;toggle.append(checkbox,'검색어 표시');
  controls.append(label,count,previous,next,toggle);tools.classList.add('has-search-controls');(tools.querySelector('.reader-tools-panel')||tools).append(controls);
  const highlights=typeof Highlight!=='undefined'&&CSS.highlights;
  let selected=Math.max(0,matches.findIndex(row=>'#'+row.unit?.id===location.hash));
  const paint=()=>{
    count.textContent='이 화면 '+(selected+1)+'/'+matches.length;
    previous.disabled=next.disabled=!checkbox.checked||matches.length<2;
    if(highlights) {
      CSS.highlights.delete('archive-search-match');CSS.highlights.delete('archive-search-current');
      if(checkbox.checked){CSS.highlights.set('archive-search-match',new Highlight(...matches.map(row=>row.range)));CSS.highlights.set('archive-search-current',new Highlight(matches[selected].range));}
    } else {
      for(const row of matches)row.block.classList.toggle('reader-matched-paragraph',checkbox.checked);
      for(const row of matches)row.block.classList.toggle('reader-current-match',checkbox.checked&&row===matches[selected]);
    }
  };
  const move=step=>{
    selected=(selected+step+matches.length)%matches.length;paint();const item=matches[selected];
    const disclosure=item.block.closest('details');if(disclosure)disclosure.open=true;
    if(item.unit?.id){const oldURL=location.href;const url=new URL(location.href);url.hash=item.unit.id;history.replaceState(history.state,'',url);window.dispatchEvent(new HashChangeEvent('hashchange',{oldURL,newURL:url.href}));}
    const rectangle=item.range.getBoundingClientRect();window.scrollTo({top:Math.max(0,scrollY+rectangle.top-tools.getBoundingClientRect().bottom-24),behavior:'auto'});
  };
  previous.addEventListener('click',()=>move(-1));next.addEventListener('click',()=>move(1));checkbox.addEventListener('change',paint);paint();
}
