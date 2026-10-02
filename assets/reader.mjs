const chapterMenu = document.querySelector('.chapter-menu');
chapterMenu?.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => { chapterMenu.open = false; });
});

const notes = document.getElementById('translation-notes');
function revealNotes() {
  if (!notes || !location.hash) return;
  let id;
  try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
  const target = document.getElementById(id);
  if (target !== notes && !notes.contains(target)) return;
  notes.open = true;
  target.scrollIntoView({block: 'start'});
  if (target !== notes) target.focus({preventScroll: true});
}
document.querySelectorAll('[data-note-link], a[href="#translation-notes"]').forEach(link => {
  link.addEventListener('click', () => { if (notes) notes.open = true; });
});
function markChapter() {
  let id;
  try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
  const chapter = document.getElementById(id)?.closest('[data-chapter]')?.dataset.chapter;
  document.querySelectorAll('[data-chapter-link]').forEach(link => {
    if (chapter && link.dataset.chapterLink === chapter) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  });
}
window.addEventListener('hashchange', () => { revealNotes(); markChapter(); });
revealNotes();
markChapter();

async function installTopicContext() {
  const params = new URLSearchParams(location.search);
  const id = params.get('topic');
  if (!id) return;
  try {
    const [{default:navigation},{topicBrowseURL,topicReaderURL,topicReadingPosition}] = await Promise.all([
      import('./topic-navigation.mjs'), import('./topics.mjs'),
    ]);
    const topic = navigation.topics.find(t=>t.id===id);
    if (!topic?.passages.length) return;
    const group = params.get('group') || topic.group;
    const query = params.get('q') || '';
    const context = {topic:id, group, query};
    let pair={read:params.get('read'),compare:params.get('compare')};
    const pane=params.get('pane')==='compare'?'compare':'read';
    const paired=pair.read!==pair.compare&&[pair.read,pair.compare].every(key=>topic.passages.some(p=>p.work_passage_id===key));
    const pairFor=key=>{
      if(!paired)return {passage:key};
      if(pane==='compare')return {passage:key===pair.read?pair.compare:pair.read,compare:key,pane};
      return {passage:key,compare:key===pair.compare?pair.read:pair.compare,pane};
    };
    let index = topicReadingPosition(topic.passages,location.href,paired?(pane==='compare'?pair.compare:pair.read):params.get('read'));
    let selected = topic.passages[index];
    const bar=document.createElement('nav');bar.className='reader-topic-context';bar.setAttribute('aria-label','주제 탐색');
    const inner=document.createElement('div');inner.className='reader-topic-inner';
    const back=document.createElement('a');back.className='topic-return';
    const label=document.createElement('span');label.textContent='주제 탐색으로';
    const title=document.createElement('strong');title.textContent=topic.title;back.append(label,title);
    const steps=document.createElement('div');steps.className='topic-context-steps';
    const previous=document.createElement('a');previous.textContent='앞 대목';previous.setAttribute('aria-label','이 주제의 앞 대목');
    const next=document.createElement('a');next.textContent='다음 대목';next.setAttribute('aria-label','이 주제의 다음 대목');
    const count=document.createElement('span');count.className='topic-context-count';
    count.setAttribute('aria-label','주제 안에서 읽는 위치');
    const choose=document.createElement('select');choose.className='topic-context-choice';choose.setAttribute('aria-label','이 주제의 관련 문헌과 대목');
    for(const p of topic.passages){const option=document.createElement('option');option.value=p.work_passage_id;option.textContent=p.location+' · '+p.title+' · '+p.author;choose.append(option);}
    steps.append(previous,choose,next);
    const sidebar=document.querySelector('.reader-sidebar');
    const outline=document.createElement('nav');outline.className='reader-topic-outline';outline.setAttribute('aria-label','이 주제의 관련 문헌');
    const outlineHeading=document.createElement('h2');outlineHeading.textContent='이 주제의 관련 문헌';
    const outlineList=document.createElement('ol');
    for(const p of topic.passages){
      const item=document.createElement('li'),link=document.createElement('a');
      link.href=topicReaderURL(p.html_path,location.href,{...context,...pairFor(p.work_passage_id)});
      link.dataset.topicPassage=p.work_passage_id;
      const work=document.createElement('span');work.textContent=p.label;
      const author=document.createElement('small');author.textContent=p.author;
      link.append(work,author);item.append(link);outlineList.append(item);
    }
    outline.append(outlineHeading,outlineList);
    if(sidebar){
      const contents=document.createElement('details');contents.className='reader-document-navigation';
      const summary=document.createElement('summary');summary.textContent='문헌 목차';contents.append(summary,...sidebar.childNodes);
      sidebar.append(outline,contents);
    }
    const documentLinks=[...document.querySelectorAll('.book-index a,.book-pagination a')];
    const update=(newIndex=index)=>{
      index=newIndex;selected=topic.passages[index];
      const selection=pairFor(selected.work_passage_id);
      if(paired)pair={read:selection.passage,compare:selection.compare};
      choose.value=selected.work_passage_id;
      count.textContent=`${index+1} / ${topic.passages.length}`;
      for(const [link,destination] of [[previous,index-1],[next,index+1]]){
        const p=topic.passages[destination];
        if(p){link.href=topicReaderURL(p.html_path,location.href,{...context,...pairFor(p.work_passage_id)});link.removeAttribute('aria-disabled');link.removeAttribute('tabindex');}
        else{link.removeAttribute('href');link.setAttribute('aria-disabled','true');link.tabIndex=-1;}
      }
      for(const link of outlineList.querySelectorAll('a')){
        const destination=topic.passages.find(p=>p.work_passage_id===link.dataset.topicPassage);
        if(destination)link.href=topicReaderURL(destination.html_path,location.href,{...context,...pairFor(destination.work_passage_id)});
        if(link.dataset.topicPassage===selected.work_passage_id)link.setAttribute('aria-current','location');
        else link.removeAttribute('aria-current');
      }
      const returnURL=topicBrowseURL(location.href,{...context,...selection});back.href=returnURL;
      for(const link of document.querySelectorAll('.site-header nav a')) {
        const u=new URL(link.href);
        if(u.pathname.endsWith('/topics.html')){link.href=returnURL;link.setAttribute('aria-current','true');}
        else if(u.pathname.endsWith('/index.html'))link.removeAttribute('aria-current');
      }
      for(const link of documentLinks)link.href=topicReaderURL(link.href,location.href,{...context,...selection});
      const current=new URL(location.href);current.searchParams.set('read',selected.work_passage_id);
      if(paired){current.searchParams.set('read',pair.read);current.searchParams.set('compare',pair.compare);if(pane==='compare')current.searchParams.set('pane','compare');}
      history.replaceState(history.state,'',current);
      const active=outlineList.querySelector('[aria-current]');
      if(active){
        const row=active.getBoundingClientRect(),list=outlineList.getBoundingClientRect();
        if(row.top<list.top||row.bottom>list.bottom)outlineList.scrollTop+=row.top-list.top-8;
      }
    };
    choose.addEventListener('change',()=>{
      const p=topic.passages.find(p=>p.work_passage_id===choose.value);
      if(p)location.assign(topicReaderURL(p.html_path,location.href,{...context,...pairFor(p.work_passage_id)}));
    });
    inner.append(back,count,steps);bar.append(inner);document.querySelector('.site-header').after(bar);
    document.body.classList.add('has-topic-context');
    new ResizeObserver(()=>document.documentElement.style.setProperty('--topic-context-height',bar.getBoundingClientRect().height+'px')).observe(bar);
    window.addEventListener('hashchange',()=>update(topicReadingPosition(topic.passages,location.href,selected.work_passage_id)));
    const inDocument=topic.passages.map((p,i)=>({i,node:document.querySelector('[data-passage-id="'+CSS.escape(p.work_passage_id)+'"]')})).filter(p=>p.node);
    let scrollIntentUntil=0;
    const readingScroll=()=>{scrollIntentUntil=performance.now()+1500;};
    window.addEventListener('wheel',readingScroll,{passive:true});
    window.addEventListener('touchmove',readingScroll,{passive:true});
    window.addEventListener('keydown',event=>{
      if(['ArrowDown','ArrowUp','PageDown','PageUp','Home','End',' '].includes(event.key)&&!event.target.closest('input,textarea,select,[contenteditable]'))readingScroll();
    });
    window.addEventListener('pointerdown',event=>{if(event.clientX>=innerWidth-24)readingScroll();},{passive:true});
    let pending=false;
    window.addEventListener('scroll',()=>{
      if(performance.now()>scrollIntentUntil)return;
      if(pending)return;pending=true;
      requestAnimationFrame(()=>{
        pending=false;
        const probe=bar.getBoundingClientRect().bottom+(document.querySelector('.reader-tools')?.getBoundingClientRect().height||0)+72;
        const visible=inDocument.find(p=>{const r=p.node.getBoundingClientRect();return r.top<=probe&&r.bottom>probe;});
        if(visible&&visible.i!==index)update(visible.i);
      });
    },{passive:true});
    update();
  } catch {
    const fallback=document.createElement('a');fallback.className='topic-context-fallback';fallback.textContent='주제별 탐색으로 돌아가기';
    const url=new URL('topics.html',location.origin+'/');url.hash='topic-'+id;for(const key of ['group','q','read','compare','pane'])if(params.has(key))url.searchParams.set(key,params.get(key));fallback.href=url;
    document.querySelector('.work-context')?.prepend(fallback);
  }
}
installTopicContext();
const readerTools=document.querySelector('.reader-tools');
if(readerTools){
  const heading=document.querySelector('.work-heading h1');
  if(heading){const title=document.createElement('a');title.className='reader-current-title';title.href='#main';title.textContent=heading.textContent;readerTools.prepend(title);}
  new ResizeObserver(()=>document.documentElement.style.setProperty('--reader-tools-height',readerTools.getBoundingClientRect().height+'px')).observe(readerTools);
}
