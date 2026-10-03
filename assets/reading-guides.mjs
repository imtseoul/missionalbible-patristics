import data from './reading-guides-data.mjs?v=d93089faedf2';

export function activeGuide(base) {
  const id=new URL(base).searchParams.get('guide');return data.guides.find(g=>g.id===id)||null;
}
export function preserveGuide(url,base) {
  const guide=activeGuide(base);if(guide)url.searchParams.set('guide',guide.id);return url;
}
export function guideStepURL(base,guide,index) {
  const step=guide.steps[index];if(!step)return null;
  const url=new URL('/topics.html',base);url.searchParams.set('guide',guide.id);url.searchParams.set('group','all');url.searchParams.set('read',step.passage);url.hash='topic-'+step.topic;return url;
}

export function guideReadingControls(base,topic) {
  const guide=activeGuide(base);if(!guide)return null;
  const index=guide.steps.findIndex(step=>step.topic===topic);if(index<0)return null;
  const nav=document.createElement('nav');nav.className='guide-reading-controls';nav.setAttribute('aria-label','이 길잡이의 주제 순서');
  const name=document.createElement('a');name.href='/topics.html?guide='+guide.id+'#guide-context';name.textContent=`길잡이 ${index+1} / ${guide.steps.length}`;name.setAttribute('aria-label',guide.title+' 길잡이 차례');nav.append(name);
  for(const [label,next] of [['이전 주제',index-1],['다음 주제',index+1]]) {
    const url=guideStepURL(base,guide,next);if(!url)continue;
    const link=document.createElement('a');link.href=url;link.textContent=label;link.setAttribute('aria-label',label+': '+guide.steps[next].title);nav.append(link);
  }
  if(index===guide.steps.length-1){const link=document.createElement('a');link.href='/topics.html#reading-guides';link.textContent='다른 길잡이';nav.append(link);}
  return nav;
}

export function installGuideContext() {
  const panel=document.querySelector('#guide-context');if(!panel)return ()=>{};
  const refresh=()=>{
    if(location.hash==='#reading-guides')document.querySelector('#reading-guides').open=true;
    const guide=activeGuide(location.href);panel.hidden=!guide;if(!guide)return;
    const topic=location.hash.replace(/^#topic-/,''),index=guide.steps.findIndex(s=>s.topic===topic);
    const title=document.createElement('p');title.className='guide-context-title';title.textContent=guide.title;
    const position=document.createElement('p');position.textContent=index>=0?`${index+1} / ${guide.steps.length} · ${guide.steps[index].title}`:'다른 주제를 살펴보고 있습니다.';
    const nav=document.createElement('nav');nav.setAttribute('aria-label','길잡이 순서');
    for(const [label,next] of [['이전 주제',index-1],['다음 주제',index+1]]) {
      if(index<0)continue;const url=guideStepURL(location.href,guide,next);if(!url)continue;
      const link=document.createElement('a');link.href=url;link.textContent=label;nav.append(link);
    }
    const outline=document.createElement('details'),summary=document.createElement('summary');summary.textContent='길잡이 차례';outline.append(summary);
    const list=document.createElement('ol');for(const [i,step] of guide.steps.entries()) {
      const li=document.createElement('li'),a=document.createElement('a');a.href=guideStepURL(location.href,guide,i);a.textContent=step.title;if(i===index)a.setAttribute('aria-current','step');li.append(a);list.append(li);
    }outline.append(list);
    const exit=document.createElement('a');exit.href='/topics.html#reading-guides';exit.textContent='길잡이 목록';nav.append(exit);panel.replaceChildren(title,position,nav,outline);
  };
  refresh();return refresh;
}
