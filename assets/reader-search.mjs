import {searchReturnURL,searchState,textMatches} from './archive-search-core.mjs?v=c183809f9954';
import {matchRanges} from './text-matches.mjs?v=c9235b0b8b9b';

export function selectedTextGroups(nodes,language='') {
  const groups=[];let current=[];
  const flush=()=>{if(current.some(row=>row.text.trim()))groups.push(current);current=[];};
  for(const row of nodes) {
    if(!language||row.language===language||!row.text.trim())current.push(row);
    else flush();
  }
  flush();return groups;
}

export function installReaderSearch() {
  const back=searchReturnURL(location.href),tools=document.querySelector('.reader-tools');
  if(!back||!tools||!/^\/works\//.test(location.pathname)||document.querySelector('.reader-search-controls'))return;
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
  controls.append(label,count,previous,next,toggle);tools.classList.add('has-search-controls');tools.append(controls);
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
