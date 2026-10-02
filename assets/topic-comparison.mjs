import {installPhraseHover} from './phrase-hover.mjs';

export function comparisonPair(read, compare, next, pane='read') {
  if (!compare || compare===read) return {read:next,compare:null};
  if (pane==='compare') return {read:next===read?compare:read,compare:next};
  return {read:next,compare:next===compare?read:compare};
}

export function comparisonDefault(passages, primary) {
  return passages.find(p=>p.author!==primary.author)
    || passages.find(p=>p.work_id!==primary.work_id)
    || passages.find(p=>p.work_passage_id!==primary.work_passage_id);
}

export function installTopicComparison({entry,data,primary,body,toolbar,controls,heading,author,bookmark,
  alignedText,refresh,change,activate}) {
  const toggle=document.createElement('button');toggle.type='button';toggle.className='topic-compare-toggle';
  toggle.textContent=entry.comparison?'한 대목만 읽기':'두 대목 비교';toggle.disabled=data.passages.length<2;
  toggle.addEventListener('click',()=>{
    const next=entry.comparison?null:comparisonDefault(data.passages,primary)?.work_passage_id;
    change({read:entry.selected,compare:next,pane:'read'});
  });controls.append(toggle);
  if(!entry.comparison)return;
  const secondary=data.passages.find(p=>p.work_passage_id===entry.comparison);
  if(!secondary||secondary.work_passage_id===primary.work_passage_id)return;
  entry.element.classList.add('is-comparing');
  heading.textContent='두 대목 비교';author.hidden=true;
  for(const node of controls.querySelectorAll('button')) {
    if(['앞 대목','다음 대목'].includes(node.textContent))node.hidden=true;
  }
  controls.querySelector('span')?.setAttribute('hidden','');
  const choices=document.createElement('div');choices.className='topic-comparison-choices';
  for(const [pane,p,label] of [['read',primary,'첫 대목'],['compare',secondary,'둘째 대목']]) {
    const field=document.createElement('label'),name=document.createElement('span');name.textContent=label;
    const select=document.createElement('select');select.setAttribute('aria-label',label+' 선택');
    for(const candidate of data.passages) {
      const option=document.createElement('option');option.value=candidate.work_passage_id;
      option.textContent=candidate.label+' · '+candidate.author;
      option.disabled=candidate.work_passage_id===(pane==='read'?secondary:primary).work_passage_id;
      select.append(option);
    }
    select.value=p.work_passage_id;
    select.addEventListener('change',()=>change({...comparisonPair(entry.selected,entry.comparison,select.value,pane),pane}));
    field.append(name,select);choices.append(field);
  }
  const choicesWrapper=document.createElement('details');choicesWrapper.className='topic-comparison-choices-wrapper';
  const choicesSummary=document.createElement('summary');choicesSummary.textContent='비교 대목 바꾸기';
  const desktop=matchMedia('(min-width: 721px)');choicesWrapper.open=desktop.matches;
  desktop.addEventListener('change',event=>{choicesWrapper.open=event.matches;});
  choicesWrapper.append(choicesSummary,choices);toolbar.append(choicesWrapper);
  const tabs=document.createElement('div');tabs.className='topic-comparison-tabs';tabs.setAttribute('role','tablist');
  tabs.setAttribute('aria-label','비교하는 두 대목');
  const grid=document.createElement('div');grid.className='topic-comparison-grid';
  const paneNodes=new Map(),tabNodes=new Map();
  for(const [pane,p] of [['read',primary],['compare',secondary]]) {
    const panel=document.createElement('section');panel.className='topic-comparison-pane';panel.dataset.comparisonPane=pane;
    panel.id='comparison-'+entry.id+'-'+pane;panel.setAttribute('role','tabpanel');
    const tab=document.createElement('button');tab.type='button';tab.textContent=p.label;tab.setAttribute('role','tab');
    tab.id=panel.id+'-tab';tab.setAttribute('aria-controls',panel.id);panel.setAttribute('aria-labelledby',tab.id);
    tab.addEventListener('click',()=>choosePane(pane));
    tab.addEventListener('keydown',event=>{
      if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
      event.preventDefault();const next=event.key==='Home'?'read':event.key==='End'?'compare':pane==='read'?'compare':'read';
      choosePane(next);tabNodes.get(next).focus();
    });
    tabs.append(tab);tabNodes.set(pane,tab);
    const title=document.createElement('h4');title.textContent=p.label;title.className='comparison-source-title';
    const by=document.createElement('p');by.className='reading-source-author';by.textContent=p.author;
    let content;
    if(pane==='read')content=body;
    else {
      content=document.createElement('div');content.className='topic-reading-body';
      content.append(alignedText(p.translation.text,p.groups,'ko','ko'),alignedText(p.source.text,p.groups,'source',p.source.language));
      if(p.translation.notes.length) {
        const notes=document.createElement('details');notes.className='topic-reading-notes';notes.open=bookmark?.compareNotesOpen||false;
        const summary=document.createElement('summary');summary.textContent='번역 메모';notes.append(summary);
        for(const text of p.translation.notes){const line=document.createElement('p');line.textContent=text;notes.append(line);}content.append(notes);
      }
      const actions=document.createElement('div');actions.className='topic-reading-actions';
      const full=document.createElement('a');full.textContent='문헌 전체에서 이어 읽기';full.dataset.topicFullPath=p.html_path;
      full.dataset.topicPane=pane;actions.append(full);content.append(actions);
      installPhraseHover(content);
    }
    content.dataset.readingPassage=p.work_passage_id;
    for(const full of content.querySelectorAll('[data-topic-full-path]'))full.dataset.topicPane=pane;
    panel.append(title,by,content);grid.append(panel);paneNodes.set(pane,panel);
  }
  toolbar.append(tabs);entry.viewer.replaceChildren(toolbar,grid);
  function choosePane(pane,notify=true) {
    entry.activePane=pane;
    for(const [key,tab] of tabNodes){tab.setAttribute('aria-selected',String(key===pane));tab.tabIndex=key===pane?0:-1;}
    for(const [key,panel] of paneNodes)panel.classList.toggle('is-active-comparison',key===pane);
    grid.dataset.activePane=pane;
    const full=controls.querySelector('[data-topic-full-path]');
    if(full){full.dataset.topicFullPath=(pane==='compare'?secondary:primary).html_path;full.dataset.topicPane=pane;}
    if(notify)activate();refresh();
  }
  choosePane(entry.activePane||'read',false);
}
