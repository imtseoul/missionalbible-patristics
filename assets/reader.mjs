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
    const [{default:navigation},{topicBrowseURL,topicReaderURL}] = await Promise.all([
      import('./topic-navigation.mjs'), import('./topics.mjs'),
    ]);
    const topic = navigation.topics.find(t=>t.id===id);
    if (!topic) return;
    const group = params.get('group') || topic.group;
    const query = params.get('q') || '';
    const context = {topic:id, group, query};
    const matches = p => {
      const u = new URL(p.html_path,new URL('/',location.href));
      return u.pathname===location.pathname && u.hash===location.hash.replace(/^#note-/,'#p-');
    };
    let selected = topic.passages.find(matches) || topic.passages[0];
    const bar=document.createElement('nav');bar.className='reader-topic-context';bar.setAttribute('aria-label','주제 탐색');
    const inner=document.createElement('div');inner.className='reader-topic-inner';
    const back=document.createElement('a');back.className='topic-return';
    const label=document.createElement('span');label.textContent='주제 탐색으로';
    const title=document.createElement('strong');title.textContent=topic.title;back.append(label,title);
    const choose=document.createElement('select');choose.className='topic-context-choice';choose.setAttribute('aria-label','이 주제의 관련 문헌과 대목');
    for(const p of topic.passages){const option=document.createElement('option');option.value=p.work_passage_id;option.textContent=p.author+', '+p.label;choose.append(option);}
    const update=()=>{
      selected=topic.passages.find(matches) || selected;
      choose.value=selected.work_passage_id;
      const returnURL=topicBrowseURL(location.href,{...context,passage:selected.work_passage_id});back.href=returnURL;
      for(const link of document.querySelectorAll('.site-header nav a')) {
        const u=new URL(link.href);
        if(u.pathname.endsWith('/topics.html')){link.href=returnURL;link.setAttribute('aria-current','true');}
        else if(u.pathname.endsWith('/index.html'))link.removeAttribute('aria-current');
      }
    };
    choose.addEventListener('change',()=>{
      const p=topic.passages.find(p=>p.work_passage_id===choose.value);
      if(p)location.assign(topicReaderURL(p.html_path,location.href,context));
    });
    inner.append(back,choose);bar.append(inner);document.querySelector('.site-header').after(bar);
    new ResizeObserver(()=>document.documentElement.style.setProperty('--topic-context-height',bar.getBoundingClientRect().height+'px')).observe(bar);
    for(const link of document.querySelectorAll('.book-index a,.book-pagination a'))link.href=topicReaderURL(link.href,location.href,context);
    window.addEventListener('hashchange',update);update();
  } catch {
    const fallback=document.createElement('a');fallback.className='topic-context-fallback';fallback.textContent='주제별 탐색으로 돌아가기';
    const url=new URL('topics.html',location.origin+'/');url.hash='topic-'+id;if(params.get('q'))url.searchParams.set('q',params.get('q'));if(params.get('group'))url.searchParams.set('group',params.get('group'));fallback.href=url;
    document.querySelector('.work-context')?.prepend(fallback);
  }
}
installTopicContext();
const readerTools=document.querySelector('.reader-tools');
if(readerTools)new ResizeObserver(()=>document.documentElement.style.setProperty('--reader-tools-height',readerTools.getBoundingClientRect().height+'px')).observe(readerTools);
