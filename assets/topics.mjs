import {markedText} from './text-matches.mjs';
import {installPhraseHover} from './phrase-hover.mjs';
import {installTopicComparison,comparisonPair} from './topic-comparison.mjs';
import {parseScriptureQuery,topicScriptureMatches,scriptureReferenceLabel,scriptureReferenceSummary} from './scripture-search.mjs?v=140fe6998252';

export function topicBrowseURL(base, state) {
  const url = new URL('topics.html', new URL('/', base));
  if (state.group) url.searchParams.set('group', state.group);
  if (state.query) url.searchParams.set('q', state.query);
  if (state.passage) url.searchParams.set('read', state.passage);
  if (state.compare && state.compare!==state.passage) {url.searchParams.set('compare',state.compare);if(state.pane==='compare')url.searchParams.set('pane','compare');}
  url.hash = state.topic ? 'topic-' + state.topic : 'topics-all';
  return url;
}

export function topicReaderURL(path, base, state) {
  const url = new URL(path, new URL('/', base));
  if (url.origin !== new URL(base).origin) throw new Error('Unexpected reading destination');
  url.searchParams.set('topic', state.topic);
  url.searchParams.delete('group'); url.searchParams.delete('q');
  if (state.group) url.searchParams.set('group', state.group);
  if (state.query) url.searchParams.set('q', state.query);
  url.searchParams.delete('read');
  if (state.passage) url.searchParams.set('read', state.passage);
  url.searchParams.delete('compare');url.searchParams.delete('pane');
  if(state.compare && state.compare!==state.passage){url.searchParams.set('compare',state.compare);if(state.pane==='compare')url.searchParams.set('pane','compare');}
  return url;
}

export function topicReadingPosition(passages, base, savedPassage) {
  const current = new URL(base);
  const anchor = current.hash.replace(/^#note-/, '#p-');
  const exact = passages.findIndex(p => {
    const url = new URL(p.html_path, new URL('/', base));
    return url.pathname === current.pathname && url.hash === anchor;
  });
  if (exact >= 0) return exact;
  const saved = passages.findIndex(p => p.work_passage_id === savedPassage);
  if (saved >= 0) return saved;
  const inDocument = passages.findIndex(p => new URL(p.html_path, new URL('/', base)).pathname === current.pathname);
  return Math.max(0, inDocument);
}

function alignedText(text, groups, side, language) {
  const p = document.createElement('p');
  p.className = side === 'ko' ? 'translation' : 'original'; p.lang = language;
  const tokens = [...text.matchAll(/\S+/g)];
  const keys = new Map();
  for (const group of groups) for (const i of group[side + '_token_indexes']) keys.set(i, group.id);
  let cursor = 0;
  for (let i = 0; i < tokens.length;) {
    let end = i + 1;
    while (end < tokens.length && keys.get(end) === keys.get(i)) end++;
    const start = tokens[i].index, finish = tokens[end - 1].index + tokens[end - 1][0].length;
    p.append(document.createTextNode(text.slice(cursor, start)));
    const span = document.createElement('span');
    span.className = 'align-unit'; span.dataset.align = keys.get(i); span.dataset.alignSide = side;
    span.tabIndex = i === 0 ? 0 : -1; span.textContent = text.slice(start, finish); p.append(span);
    cursor = finish; i = end;
  }
  p.append(document.createTextNode(text.slice(cursor))); return p;
}

function initTopics() {
  const input = document.querySelector('#topic-query');
  const form = document.querySelector('.topic-search');
  if (!input || !form) return;
  const clear = document.querySelector('#topic-clear');
  const empty = document.querySelector('.topic-empty');
  const mobile = document.querySelector('.topic-mobile-categories');
  const links = [...document.querySelectorAll('[data-topic-group]')];
  const sections = [...document.querySelectorAll('.topic-section')];
  const normalize = text => text.normalize('NFKC').toLocaleLowerCase('ko').replace(/\s+/g, ' ').trim();
  const entries = [...document.querySelectorAll('.topic-entry')].map(element => ({
    element, id: element.id.slice(6), group: element.dataset.group, words: normalize(element.textContent),
    disclosure: element.querySelector('.topic-disclosure'), viewer: element.querySelector('.topic-reading'),
    visibleWords: normalize(element.querySelector('summary').textContent),
    targets: [...element.querySelectorAll('h3, .topic-description, .topic-size, .topic-attribution, .source-work-title, .source-author, .source-relation, .source-locations a')].map(node => ({node, text: node.textContent})),
    sources: [...element.querySelectorAll('.topic-source')].map(row => ({row,
      title:row.querySelector('.source-work-title'),
      firstKey:row.querySelector('.source-work-title').dataset.topicPassage,
      firstPath:row.querySelector('.source-work-title').getAttribute('href'),
      locations:[...row.querySelectorAll('.source-locations a')].map(node=>({node,path:node.getAttribute('href'),aria:node.getAttribute('aria-label')})),
      caption:null})),
    markedQuery: '', autoOpened: false, selected: null, comparison:null, activePane:'read',
  }));
  const names = new Map([['all', '전체 주제'], ...sections.map(s => [s.dataset.section, s.querySelector('h2').textContent])]);
  const payloads = new Map();
  let bookmarks = {};
  try { bookmarks = JSON.parse(sessionStorage.getItem('patristics.topic-readings') || '{}'); } catch {}
  if (!bookmarks || typeof bookmarks !== 'object' || Array.isArray(bookmarks)) bookmarks = {};
  const writeBookmarks = () => {
    try { sessionStorage.setItem('patristics.topic-readings', JSON.stringify(bookmarks)); } catch {}
  };
  const rememberReading = (entry, write = true) => {
    if (!entry.selected || entry.viewer.hidden) return;
    const previous = bookmarks[entry.id] || {};
    const bounds = entry.viewer.getBoundingClientRect();
    const headerHeight = document.querySelector('.site-header').getBoundingClientRect().height;
    const inReading = bounds.top <= headerHeight + 48 && bounds.bottom > headerHeight;
    const readingTop = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop)
      + parseFloat(getComputedStyle(entry.viewer).scrollMarginTop);
    const list = entry.element.querySelector('.topic-reading-list');
    bookmarks[entry.id] = {
      ...previous, passage:entry.selected, compare:entry.comparison, pane:entry.activePane, group, query:input.value,
      offset:inReading ? Math.max(0, readingTop - bounds.top) : previous.offset || 0,
      listOpen:list?.open, listY:list?.scrollTop || 0,
      notesOpen:entry.viewer.querySelector('[data-reading-passage="'+CSS.escape(entry.selected)+'"] .topic-reading-notes')?.open || false,
      compareNotesOpen:entry.comparison?entry.viewer.querySelector('[data-reading-passage="'+CSS.escape(entry.comparison)+'"] .topic-reading-notes')?.open||false:false,
    };
    if (write) writeBookmarks();
  };
  let savedPosition = null;
  const snapshot = () => ({url:location.href,y:scrollY,open:entries.filter(e=>e.disclosure.open).map(e=>e.id)});
  const savePosition = () => {
    for (const entry of entries) rememberReading(entry);
    const saved=snapshot();
    history.replaceState({...history.state,topicBrowse:saved},'',location.href);
    try{sessionStorage.setItem('patristics.topic-browse',JSON.stringify(saved));}catch{}
  };
  const storedPosition = () => {
    const saved=history.state?.topicBrowse;
    if(saved?.url===location.href)return saved;
    try{
      const stored=JSON.parse(sessionStorage.getItem('patristics.topic-browse') || 'null');
      if(stored?.url===location.href)return stored;
      if(stored?.url){
        const previous=new URL(stored.url),current=new URL(location.href);
        if(previous.origin===current.origin&&previous.pathname===current.pathname&&['group','q'].every(key=>previous.searchParams.get(key)===current.searchParams.get(key)))return {...stored,y:null};
      }
    }catch{}
    return null;
  };
  savedPosition=storedPosition();
  let group = 'all', generation = 0;
  const state = (entry = null, passage = null) => ({group, query:input.value, topic:entry?.id, passage, compare:passage?entry?.comparison:null, pane:entry?.activePane || 'read'});
  const persist = (entry = null, passage = null, push = false) => {
    const url = topicBrowseURL(location.href, state(entry, passage));
    if (!entry && location.hash.startsWith('#section-')) url.hash = location.hash;
    history[push ? 'pushState' : 'replaceState'](push ? null : history.state, '', url);
    for(const a of document.querySelectorAll('.site-header nav a,.browse-switch a'))if(new URL(a.href).pathname.endsWith('/topics.html'))a.href=url;
  };
  const showResume = entry => {
    const bookmark = bookmarks[entry.id];
    const valid = bookmark && entry.element.querySelector('[data-topic-passage="'+CSS.escape(bookmark.passage || '')+'"]');
    if (!valid) return;
    if (!entry.resume) {
      const button = document.createElement('button'); button.type='button'; button.className='topic-resume';
      button.addEventListener('click',()=>readPassage(entry,bookmarks[entry.id].passage,{resume:true}));
      entry.element.querySelector('.topic-attribution').after(button); entry.resume=button;
    }
    const work = valid.closest('.topic-source').querySelector('.source-work-title').textContent;
    entry.resume.textContent=bookmark.compare?'비교하던 두 대목 이어 읽기':'읽던 대목 이어 읽기 · '+(bookmark.label || work+' '+valid.textContent);
    entry.resume.hidden=!!entry.selected;
  };
  const stopReading = entry => {
    rememberReading(entry);
    entry.viewer.hidden=true;entry.selected=null;entry.comparison=null;entry.activePane='read';entry.element.classList.remove('is-reading','is-comparing','is-comparing-list-open');
    const list=entry.element.querySelector('.topic-reading-list');if(list)list.open=true;
    for (const link of entry.element.querySelectorAll('[data-topic-passage]')) link.removeAttribute('aria-current');
    showResume(entry);
  };
  const updateReadingContext = (entry,scripture) => {
    for(const link of entry.viewer.querySelectorAll('[data-topic-full-path]')) {
      const pane=link.dataset.topicPane || entry.activePane || 'read';
      link.href=topicReaderURL(link.dataset.topicFullPath,location.href,{...state(entry,entry.selected),pane});
    }
    const scopes=entry.comparison?[...entry.viewer.querySelectorAll('.topic-comparison-pane')]:[entry.viewer];
    for(const scope of scopes) {
      const key=scope.querySelector('[data-reading-passage]')?.dataset.readingPassage || entry.selected;
      let line=scope.querySelector('.reading-scripture-context');const author=scope.querySelector('.reading-source-author');
      if(scripture&&author&&!line){line=document.createElement('p');line.className='reading-scripture-context';author.after(line);}
      if(line){line.hidden=!scripture;line.textContent=scripture?scriptureReferenceSummary(key,scripture)||scriptureReferenceLabel(scripture)+'에서 시작한 관련 대목':'';}
    }
  };

  function render() {
    const scripture=parseScriptureQuery(input.value);
    const terms = normalize(input.value).split(' ').filter(Boolean);
    const scripturePassages=new Set();
    let count = 0;
    for (const entry of entries) {
      const references=scripture ? topicScriptureMatches(entry.id,scripture) : [];
      const matches = (group === 'all' || entry.group === group) && (scripture ? references.length>0 : terms.every(term => entry.words.includes(term)));
      const matchedKeys=new Set(references.map(ref=>ref.passage));
      entry.element.hidden = !matches;
      if (matches) {count++;for(const key of matchedKeys)scripturePassages.add(key);}
      const query = matches && !scripture ? input.value : '';
      if (entry.markedQuery !== query) {
        for (const {node,text} of entry.targets) node.replaceChildren(markedText(document, text, query, {normalization:'NFKC',caseSensitive:false}));
        entry.markedQuery = query;
      }
      const reveal = matches && (scripture || terms.length > 0 && !terms.every(term => entry.visibleWords.includes(term)));
      if (reveal && !entry.disclosure.open) {entry.autoOpened = true; entry.disclosure.open = true;}
      else if (!reveal && entry.autoOpened && !entry.selected) {entry.autoOpened = false; entry.disclosure.open = false;}
      for (const source of entry.sources) {
        const matched=matches && scripture ? source.locations.filter(({node})=>matchedKeys.has(node.dataset.topicPassage)) : [];
        source.title.dataset.topicPassage=matched[0]?.node.dataset.topicPassage || source.firstKey;
        source.title.href=topicReaderURL(matched[0]?.path || source.firstPath,location.href,state(entry,source.title.dataset.topicPassage));
        for (const {node,path,aria} of source.locations) {
          const hit=matched.some(item=>item.node===node);
          node.classList.toggle('is-scripture-match',hit);
          node.setAttribute('aria-label',aria+(hit?', '+scriptureReferenceSummary(node.dataset.topicPassage,scripture):''));
          node.href=topicReaderURL(path,location.href,state(entry,node.dataset.topicPassage));
        }
        if (matched.length && !source.caption) {
          source.caption=document.createElement('p');source.caption.className='scripture-source-match';source.row.append(source.caption);
        }
        if(source.caption) {
          source.caption.hidden=!matched.length;
          source.caption.textContent=matched.map(({node})=>node.textContent+': '+scriptureReferenceSummary(node.dataset.topicPassage,scripture)).join('; ');
        }
      }
      if(entry.selected)updateReadingContext(entry,scripture);
    }
    for (const section of sections) section.hidden = !section.querySelector('.topic-entry:not([hidden])');
    for (const link of links) {
      if (link.dataset.topicGroup === group) link.setAttribute('aria-current','true');
      else link.removeAttribute('aria-current');
    }
    document.querySelector('[data-current-category]').textContent = names.get(group);
    document.querySelector('[data-result-category]').textContent = names.get(group);
    document.querySelector('[data-result-count]').textContent = scripture
      ? `${scriptureReferenceLabel(scripture)} · 본문 ${scripturePassages.size}곳 · 주제 ${count}개`
      : `${count}개 주제${terms.length ? ' 검색됨' : ''}`;
    empty.querySelector('h2').textContent=scripture?'이 구절과 연결된 주제가 없습니다':'찾는 주제가 없습니다';
    empty.querySelector('p').textContent=scripture?'주제에 연결된 본문의 성경 참조를 찾습니다. 다른 구절을 입력하거나 분류를 바꿔 보세요.':'다른 검색어를 입력하거나 분류를 바꿔 보세요.';
    document.querySelector('#topic-reset').textContent=scripture && group!=='all'?'전체 주제에서 같은 구절 찾기':'전체 주제 보기';
    empty.hidden = count > 0; clear.hidden = !input.value;
    for(const a of document.querySelectorAll('.site-header nav a,.browse-switch a'))if(new URL(a.href).pathname.endsWith('/topics.html'))a.href=location.href;
  }

  async function readPassage(entry, key, {scroll = true, push = true, focus = true, resume = false} = {}) {
    if(push)savePosition();
    if (!entry.selected) entry.browsePosition = push ? snapshot() : {y:bookmarks[entry.id]?.browseY};
    const bookmark = resume ? {...bookmarks[entry.id]} : null;
    const request = ++generation;
    if(bookmark){entry.comparison=bookmark.compare||null;entry.activePane=bookmark.pane||'read';}
    if(entry.comparison===key)entry.comparison=entry.selected&&entry.selected!==key?entry.selected:null;
    entry.element.classList.remove('is-comparing','is-comparing-list-open');
    entry.selected = key; entry.disclosure.open = true; entry.viewer.hidden = false;
    const loading = document.createElement('p'); loading.setAttribute('role','status'); loading.textContent = '본문을 불러오는 중입니다.';
    entry.viewer.replaceChildren(loading);
    try {
      if (!payloads.has(entry.id)) payloads.set(entry.id, import('./topic-readings/' + entry.id + '.mjs'));
      const data = (await payloads.get(entry.id)).default;
      if (request !== generation) return;
      const index = data.passages.findIndex(p => p.work_passage_id === key);
      if (index < 0) throw new Error('Missing related passage');
      const p = data.passages[index]; entry.selected = key;
      if(!data.passages.some(p=>p.work_passage_id===entry.comparison))entry.comparison=null;
      for (const item of entries) if (item !== entry) stopReading(item);
      bookmarks[entry.id]={...(bookmarks[entry.id] || {}),passage:key,compare:entry.comparison,pane:entry.activePane,label:p.label,group,query:input.value,
        offset:bookmark?.offset || 0,browseY:entry.browsePosition?.y};
      writeBookmarks(); showResume(entry);
      entry.element.classList.add('is-reading');
      let readingList=entry.element.querySelector('.topic-reading-list');
      if(!readingList){
        const layout=document.createElement('div');layout.className='topic-reading-layout';
        readingList=document.createElement('details');readingList.className='topic-reading-list';
        const summary=document.createElement('summary');summary.textContent=`관련 문헌 · 본문 ${data.passages.length}곳`;
        readingList.append(summary,entry.element.querySelector('.topic-sources'));
        entry.viewer.before(layout);layout.append(readingList,entry.viewer);
        readingList.open=matchMedia('(min-width: 1001px)').matches;
      }
      for (const a of entry.element.querySelectorAll('[data-topic-passage]')) {
        if (a.dataset.topicPassage === key) a.setAttribute('aria-current','location'); else a.removeAttribute('aria-current');
      }
      const toolbar = document.createElement('div'); toolbar.className = 'topic-reading-toolbar';
      const context = document.createElement('div');
      const title = document.createElement('a'); title.className = 'reading-topic-title'; title.textContent = data.title; title.href='#'+entry.element.id;
      const heading = document.createElement('h4'); heading.textContent = p.label;heading.tabIndex=-1;
      const author = document.createElement('p'); author.className = 'reading-source-author'; author.textContent = p.author;
      context.append(title, heading, author);
      const controls = document.createElement('nav'); controls.className = 'topic-reading-controls'; controls.setAttribute('aria-label','이 주제의 관련 대목');
      const browse = document.createElement('button'); browse.type='button'; browse.textContent='주제 목록으로';
      browse.addEventListener('click',()=>{
        savePosition(); generation++; stopReading(entry); persist(entry,null,true);
        const y = entry.browsePosition?.y;
        if (Number.isFinite(y)) window.scrollTo({top:y,behavior:'auto'});
        else entry.element.scrollIntoView({block:'start'});
        entry.disclosure.querySelector('summary').focus({preventScroll:true}); savePosition();
      });
      controls.append(browse);
      const showList = () => {
        readingList.open=true;entry.element.classList.add('is-comparing-list-open');
        const selected=readingList.querySelector('.source-locations [data-topic-passage="'+(entry.activePane==='compare'?entry.comparison:key)+'"]');
        selected?.focus({preventScroll:true});
        readingList.scrollIntoView({block:'start'});
        selected?.scrollIntoView({block:'nearest'});
      };
      const list = document.createElement('button'); list.type='button'; list.textContent='관련 문헌 목록';
      list.addEventListener('click',showList); controls.append(list);
      const count = document.createElement('span'); count.textContent = `${index + 1} / ${data.passages.length}`;
      for (const [label,next] of [['앞 대목',index-1],['다음 대목',index+1]]) {
        const button = document.createElement('button'); button.type='button'; button.textContent=label; button.disabled=next<0 || next>=data.passages.length;
        button.addEventListener('click',()=>readPassage(entry,data.passages[next].work_passage_id)); controls.append(button);
      }
      const continueReading = document.createElement('a'); continueReading.textContent='문헌 전체에서 이어 읽기';
      continueReading.dataset.topicFullPath=p.html_path;
      continueReading.href=topicReaderURL(p.html_path,location.href,state(entry,key));
      controls.append(count,continueReading); toolbar.append(context,controls);
      const body = document.createElement('div'); body.className='topic-reading-body';body.dataset.readingPassage=key;
      body.append(alignedText(p.translation.text,p.groups,'ko','ko'), alignedText(p.source.text,p.groups,'source',p.source.language));
      if (p.translation.notes.length) {
        const notes=document.createElement('details'); notes.className='topic-reading-notes';
        const summary=document.createElement('summary'); summary.textContent='번역 메모'; notes.append(summary); notes.open=bookmark?.notesOpen || false;
        for (const note of p.translation.notes) {const line=document.createElement('p');line.textContent=note;notes.append(line);} body.append(notes);
      }
      const actions=document.createElement('div'); actions.className='topic-reading-actions';
      const full=document.createElement('a'); full.textContent='문헌 전체에서 이어 읽기'; full.href=topicReaderURL(p.html_path,location.href,state(entry,key));
      full.dataset.topicFullPath=p.html_path;
      const close=document.createElement('button');close.type='button';close.textContent='관련 문헌 목록으로';
      close.addEventListener('click',showList);
      actions.append(full,close);body.append(actions);
      entry.viewer.replaceChildren(toolbar,body);installPhraseHover(body);
      installTopicComparison({entry,data,primary:p,body,toolbar,controls,heading,author,bookmark,alignedText,
        refresh:()=>updateReadingContext(entry,parseScriptureQuery(input.value)),
        activate:()=>{persist(entry,entry.selected,false);rememberReading(entry);},
        change:pair=>{savePosition();entry.comparison=pair.compare;entry.activePane=pair.pane||'read';readPassage(entry,pair.read,{push:true});}});
      updateReadingContext(entry,parseScriptureQuery(input.value));persist(entry,key,push);
      if (bookmark) { readingList.open=bookmark.listOpen ?? readingList.open; readingList.scrollTop=bookmark.listY || 0; }
      const active=readingList.querySelector('.source-locations [aria-current]');
      if(active&&readingList.open){
        const row=active.getBoundingClientRect(),list=readingList.getBoundingClientRect();
        if(row.top<list.top||row.bottom>list.bottom)readingList.scrollTop+=row.top-list.top-44;
      }
      if (Number.isFinite(savedPosition?.y) && !push) {
        const saved=savedPosition;savedPosition=null;
        requestAnimationFrame(()=>window.scrollTo({top:saved.y,behavior:'auto'}));
      } else {
        savedPosition=null;
        if(scroll) {
          entry.viewer.scrollIntoView({block:'start'});
          if (bookmark?.offset) window.scrollBy({top:bookmark.offset,behavior:'auto'});
        }
      }
      if(focus)heading.focus({preventScroll:true});
    } catch {
      payloads.delete(entry.id);const message=document.createElement('p');message.setAttribute('role','status');message.textContent='본문을 불러오지 못했습니다.';
      const fallback=[...entry.element.querySelectorAll('[data-topic-passage]')].find(a=>a.dataset.topicPassage===key) || entry.element.querySelector('[data-topic-passage]');
      const link=document.createElement('a');link.textContent='문헌에서 읽기';link.href=fallback.href;entry.viewer.replaceChildren(message,link);
    }
  }

  function restore(scroll = false) {
    generation++;
    savedPosition=storedPosition();
    if(savedPosition)for(const entry of entries)entry.disclosure.open=savedPosition.open?.includes(entry.id) || false;
    const url=new URL(location.href);let id='';try{id=decodeURIComponent(url.hash.slice(1));}catch{}
    const entry=entries.find(e=>e.element.id===id);
    const section=sections.find(s=>s.querySelector('h2').id===id);
    group=names.has(url.searchParams.get('group')) ? url.searchParams.get('group') : section?.dataset.section || entry?.group || 'all';
    input.value=url.searchParams.get('q') || '';
    render();
    if (entry) entry.disclosure.open=true;
    const key=url.searchParams.get('read');
    if (entry && key && [...entry.element.querySelectorAll('[data-topic-passage]')].some(a=>a.dataset.topicPassage===key)) {
      entry.comparison=url.searchParams.get('compare');entry.activePane=url.searchParams.get('pane')==='compare'?'compare':'read';
      const saved=bookmarks[entry.id];if(saved&&saved.passage===key){saved.compare=entry.comparison;saved.pane=entry.activePane;}
      readPassage(entry,key,{scroll,push:false,focus:false,resume:saved?.passage===key});
    }
    else {
      for(const item of entries)stopReading(item);
      if(Number.isFinite(savedPosition?.y)){const saved=savedPosition;savedPosition=null;requestAnimationFrame(()=>window.scrollTo({top:saved.y,behavior:'auto'}));}
      else if(scroll&&entry)entry.element.scrollIntoView({block:'start'});
    }
  }
  form.hidden=false;const help=document.querySelector('#topic-search-help');if(help)help.hidden=false;
  form.addEventListener('submit',event=>event.preventDefault());
  const search=()=>{
    for(const entry of entries)rememberReading(entry);
    render();
    for(const entry of entries)if(entry.selected&&entry.element.hidden){generation++;stopReading(entry);}
    const active=entries.find(e=>e.selected&&!e.element.hidden);persist(active,active?.selected);
  };
  input.addEventListener('input',event=>{if(!event.isComposing)search();});input.addEventListener('compositionend',search);
  input.addEventListener('keydown',event=>{if(event.key==='Escape'){input.value='';search();}});
  clear.addEventListener('click',()=>{input.value='';search();input.focus();});
  document.querySelector('#topic-reset').addEventListener('click',()=>{savePosition();const keep=parseScriptureQuery(input.value)&&group!=='all';group='all';if(!keep)input.value='';for(const e of entries)stopReading(e);persist(null,null,true);render();input.focus();});
  for(const link of links)link.addEventListener('click',event=>{
    if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    event.preventDefault();group=link.dataset.topicGroup;mobile.open=false;
    const active=entries.find(e=>e.selected&&(group==='all'||e.group===group));
    if(!active)for(const e of entries)stopReading(e);
    const url=topicBrowseURL(location.href,state(active,active?.selected));if(!active)url.hash=link.getAttribute('href');history.pushState(null,'',url);render();
    document.querySelector('.topics-main').scrollIntoView({block:'start'});
  });
  for(const entry of entries){
    showResume(entry);
    for(const link of entry.element.querySelectorAll('[data-topic-passage]'))link.addEventListener('click',event=>{
      if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
      event.preventDefault();
      const pair=comparisonPair(entry.selected,entry.comparison,link.dataset.topicPassage,entry.activePane);
      entry.comparison=pair.compare;readPassage(entry,pair.read);
    });
    entry.disclosure.querySelector('summary').addEventListener('click',()=>requestAnimationFrame(()=>{
      if(!entry.disclosure.open&&entry.selected){stopReading(entry);persist(entry);}
      else if(entry.disclosure.open&&!entry.element.hidden&&!entry.selected){
        const active=entries.find(e=>e.selected&&e.disclosure.open&&!e.element.hidden);
        persist(active || entry,active?.selected);
      }
      savePosition();
    }));
  }
  window.addEventListener('hashchange',()=>restore(true));window.addEventListener('popstate',()=>restore(true));
  document.addEventListener('click',event=>{if(event.target.closest('a[href]'))savePosition();},{capture:true});
  let remembering = false;
  window.addEventListener('scroll',()=>{
    if (remembering) return;
    remembering=true;
    requestAnimationFrame(()=>{
      remembering=false;
      for (const entry of entries) rememberReading(entry,false);
    });
  },{passive:true});
  window.addEventListener('pagehide',savePosition);
  if(savedPosition)for(const entry of entries)entry.disclosure.open=savedPosition.open?.includes(entry.id) || false;
  restore(true);
}
if (typeof document !== 'undefined') initTopics();
