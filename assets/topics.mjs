import {markedText} from './text-matches.mjs';
import {installPhraseHover} from './phrase-hover.mjs';

export function topicBrowseURL(base, state) {
  const url = new URL('topics.html', new URL('/', base));
  if (state.group) url.searchParams.set('group', state.group);
  if (state.query) url.searchParams.set('q', state.query);
  if (state.passage) url.searchParams.set('read', state.passage);
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
  return url;
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
    markedQuery: '', autoOpened: false, selected: null,
  }));
  const names = new Map([['all', '전체 주제'], ...sections.map(s => [s.dataset.section, s.querySelector('h2').textContent])]);
  const payloads = new Map();
  let savedPosition = null;
  try {const saved=JSON.parse(sessionStorage.getItem('patristics.topic-browse') || 'null');if(saved?.url===location.href)savedPosition=saved;}catch{}
  let group = 'all', generation = 0;
  const state = (entry = null, passage = null) => ({group, query:input.value, topic:entry?.id, passage});
  const persist = (entry = null, passage = null, push = false) => {
    const url = topicBrowseURL(location.href, state(entry, passage));
    if (!entry && location.hash.startsWith('#section-')) url.hash = location.hash;
    history[push ? 'pushState' : 'replaceState'](null, '', url);
    for(const a of document.querySelectorAll('.site-header nav a,.browse-switch a'))if(new URL(a.href).pathname.endsWith('/topics.html'))a.href=url;
  };

  function render() {
    const terms = normalize(input.value).split(' ').filter(Boolean);
    let count = 0;
    for (const entry of entries) {
      const matches = (group === 'all' || entry.group === group) && terms.every(term => entry.words.includes(term));
      entry.element.hidden = !matches;
      if (matches) count++;
      const query = matches ? input.value : '';
      if (entry.markedQuery !== query) {
        for (const {node,text} of entry.targets) node.replaceChildren(markedText(document, text, query, {normalization:'NFKC',caseSensitive:false}));
        entry.markedQuery = query;
      }
      const reveal = matches && terms.length > 0 && !terms.every(term => entry.visibleWords.includes(term));
      if (reveal && !entry.disclosure.open) {entry.autoOpened = true; entry.disclosure.open = true;}
      else if (!reveal && entry.autoOpened && !entry.selected) {entry.autoOpened = false; entry.disclosure.open = false;}
      for (const a of entry.element.querySelectorAll('[data-topic-passage]')) {
        a.setAttribute('href', topicReaderURL(a.getAttribute('href'), location.href, state(entry)));
      }
    }
    for (const section of sections) section.hidden = !section.querySelector('.topic-entry:not([hidden])');
    for (const link of links) {
      if (link.dataset.topicGroup === group) link.setAttribute('aria-current','true');
      else link.removeAttribute('aria-current');
    }
    document.querySelector('[data-current-category]').textContent = names.get(group);
    document.querySelector('[data-result-category]').textContent = names.get(group);
    document.querySelector('[data-result-count]').textContent = `${count}개 주제${terms.length ? ' 검색됨' : ''}`;
    empty.hidden = count > 0; clear.hidden = !input.value;
    for(const a of document.querySelectorAll('.site-header nav a,.browse-switch a'))if(new URL(a.href).pathname.endsWith('/topics.html'))a.href=location.href;
  }

  async function readPassage(entry, key, {scroll = true, push = true} = {}) {
    const request = ++generation;
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
      for (const item of entries) if (item !== entry) {item.viewer.hidden = true; item.selected = null;}
      for (const a of entry.element.querySelectorAll('[data-topic-passage]')) {
        if (a.dataset.topicPassage === key) a.setAttribute('aria-current','location'); else a.removeAttribute('aria-current');
      }
      const toolbar = document.createElement('div'); toolbar.className = 'topic-reading-toolbar';
      const context = document.createElement('div');
      const title = document.createElement('a'); title.className = 'reading-topic-title'; title.textContent = data.title; title.href='#'+entry.element.id;
      const heading = document.createElement('h4'); heading.textContent = p.label;
      const author = document.createElement('p'); author.className = 'reading-source-author'; author.textContent = p.author;
      context.append(title, heading, author);
      const controls = document.createElement('nav'); controls.className = 'topic-reading-controls'; controls.setAttribute('aria-label','이 주제의 관련 대목');
      const count = document.createElement('span'); count.textContent = `${index + 1} / ${data.passages.length}`;
      for (const [label,next] of [['앞 대목',index-1],['다음 대목',index+1]]) {
        const button = document.createElement('button'); button.type='button'; button.textContent=label; button.disabled=next<0 || next>=data.passages.length;
        button.addEventListener('click',()=>readPassage(entry,data.passages[next].work_passage_id)); controls.append(button);
      }
      controls.append(count); toolbar.append(context,controls);
      const body = document.createElement('div'); body.className='topic-reading-body';
      body.append(alignedText(p.translation.text,p.groups,'ko','ko'), alignedText(p.source.text,p.groups,'source',p.source.language));
      if (p.translation.notes.length) {
        const notes=document.createElement('details'); notes.className='topic-reading-notes';
        const summary=document.createElement('summary'); summary.textContent='번역 메모'; notes.append(summary);
        for (const note of p.translation.notes) {const line=document.createElement('p');line.textContent=note;notes.append(line);} body.append(notes);
      }
      const actions=document.createElement('div'); actions.className='topic-reading-actions';
      const full=document.createElement('a'); full.textContent='문헌 전체에서 이어 읽기'; full.href=topicReaderURL(p.html_path,location.href,state(entry,key));
      const close=document.createElement('button');close.type='button';close.textContent='관련 문헌 목록으로';
      close.addEventListener('click',()=>{entry.viewer.hidden=true;entry.selected=null;persist(entry);entry.element.querySelector('[data-topic-passage="'+key+'"]').focus();entry.element.scrollIntoView({block:'start'});});
      actions.append(full,close);body.append(actions);
      entry.viewer.replaceChildren(toolbar,body);installPhraseHover(body);persist(entry,key,push);
      if (savedPosition && !push) {
        const saved=savedPosition;savedPosition=null;
        requestAnimationFrame(()=>window.scrollTo({top:saved.y,behavior:'auto'}));
      } else if (scroll) entry.viewer.scrollIntoView({block:'start'});
    } catch {
      payloads.delete(entry.id);const message=document.createElement('p');message.setAttribute('role','status');message.textContent='본문을 불러오지 못했습니다.';
      const fallback=[...entry.element.querySelectorAll('[data-topic-passage]')].find(a=>a.dataset.topicPassage===key) || entry.element.querySelector('[data-topic-passage]');
      const link=document.createElement('a');link.textContent='문헌에서 읽기';link.href=fallback.href;entry.viewer.replaceChildren(message,link);
    }
  }

  function restore(scroll = false) {
    generation++;
    const url=new URL(location.href);let id='';try{id=decodeURIComponent(url.hash.slice(1));}catch{}
    const entry=entries.find(e=>e.element.id===id);
    const section=sections.find(s=>s.querySelector('h2').id===id);
    group=names.has(url.searchParams.get('group')) ? url.searchParams.get('group') : section?.dataset.section || entry?.group || 'all';
    input.value=url.searchParams.get('q') || '';
    render();
    if (entry) entry.disclosure.open=true;
    const key=url.searchParams.get('read');
    if (entry && key && [...entry.element.querySelectorAll('[data-topic-passage]')].some(a=>a.dataset.topicPassage===key)) readPassage(entry,key,{scroll,push:false});
    else {
      for(const item of entries){item.viewer.hidden=true;item.selected=null;}
      if(scroll&&entry)entry.element.scrollIntoView({block:'start'});
    }
  }
  form.hidden=false;form.addEventListener('submit',event=>event.preventDefault());
  const search=()=>{render();const active=entries.find(e=>e.selected&&!e.element.hidden);persist(active,active?.selected);};
  input.addEventListener('input',event=>{if(!event.isComposing)search();});input.addEventListener('compositionend',search);
  input.addEventListener('keydown',event=>{if(event.key==='Escape'){input.value='';search();}});
  clear.addEventListener('click',()=>{input.value='';search();input.focus();});
  document.querySelector('#topic-reset').addEventListener('click',()=>{group='all';input.value='';for(const e of entries){e.viewer.hidden=true;e.selected=null;}persist(null,null,true);render();input.focus();});
  for(const link of links)link.addEventListener('click',event=>{
    if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    event.preventDefault();group=link.dataset.topicGroup;mobile.open=false;
    const active=entries.find(e=>e.selected&&(group==='all'||e.group===group));
    if(!active)for(const e of entries){e.viewer.hidden=true;e.selected=null;}
    const url=topicBrowseURL(location.href,state(active,active?.selected));if(!active)url.hash=link.getAttribute('href');history.pushState(null,'',url);render();
    document.querySelector('.topics-main').scrollIntoView({block:'start'});
  });
  for(const entry of entries){
    for(const link of entry.element.querySelectorAll('[data-topic-passage]'))link.addEventListener('click',event=>{
      if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
      event.preventDefault();readPassage(entry,link.dataset.topicPassage);
    });
    entry.disclosure.addEventListener('toggle',()=>{if(entry.disclosure.open&&!entry.element.hidden&&!entry.selected)persist(entry);});
  }
  window.addEventListener('hashchange',()=>restore(true));window.addEventListener('popstate',()=>restore(true));
  window.addEventListener('pagehide',()=>{try{sessionStorage.setItem('patristics.topic-browse',JSON.stringify({url:location.href,y:scrollY,open:entries.filter(e=>e.disclosure.open).map(e=>e.id)}));}catch{}});
  if(savedPosition)for(const entry of entries)entry.disclosure.open=savedPosition.open?.includes(entry.id) || false;
  restore(true);
}
if (typeof document !== 'undefined') initTopics();
