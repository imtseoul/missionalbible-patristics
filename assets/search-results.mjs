// Pure helpers for the search screen: work shortcuts, related topics, facets and condition labels.
import {catalogueMatch,normalizedCatalogueText} from './catalogue-search.mjs?v=71d83a0edc6e';
import {scriptureReferenceLabel} from './scripture-search.mjs?v=944aed4c0321';

export const modeLabels={ko:'한국어 본문',grc:'그리스어 원문',lat:'라틴어 원문',notes:'번역 주석',scripture:'성경 구절'};
const relationLabels={quotation:'직접 인용',paraphrase:'의역',exposition:'해설',possible_allusion:'가능한 암시',reference:'참조'};
const compact=text=>normalizedCatalogueText(text).replace(/\s/g,'');

// Matches anywhere in the names; exact and leading matches of the primary names come first.
function ranked(rows,query,names,primary,limit) {
  const wanted=compact(query);
  // Count syllables, not the decomposed jamo used for matching.
  if(Array.from(String(query).normalize('NFC').replace(/\s/g,'')).length<2)return {rows:[],total:0};
  const scored=[];
  rows.forEach((row,order)=>{
    if(!catalogueMatch(names(row).join(' '),[],query))return;
    const main=primary(row).map(compact);
    const score=main.some(label=>label===wanted)?0:main.some(label=>label.startsWith(wanted))?1:main.some(label=>label.includes(wanted))?2:3;
    scored.push({row,order,score});
  });
  scored.sort((a,b)=>a.score-b.score||a.order-b.order);
  return {rows:scored.slice(0,limit).map(item=>item.row),total:scored.length};
}

// Titles, aliases and author names; descriptions are excluded so a common word does not list every work.
export function workShortcuts(works,query,limit=8) {
  const names=work=>[work.title,...(work.aliases||[]),work.author,...(work.author_aliases||[])];
  return ranked(works,query,names,names,limit);
}

export function relatedTopics(topics,query,limit=5) {
  return ranked(topics,query,topic=>[topic.title,topic.summary,topic.attribution,topic.group].filter(Boolean),topic=>[topic.title],limit);
}

// Count every result by work, most results first, keeping corpus order for ties.
export function facetCounts(rows) {
  const counts=new Map();
  for(const item of rows)counts.set(item.work.id,(counts.get(item.work.id)||0)+1);
  return [...counts].map(([id,count],order)=>({id,count,order})).sort((a,b)=>b.count-a.count||a.order-b.order).map(({id,count})=>({id,count}));
}

export function searchKind(found,state,works) {
  if(found.kind==='scripture')return '성경 구절 검색 · '+scriptureReferenceLabel(found.query);
  if(found.kind==='reference') {
    const titles=found.reference.works.map(id=>works.get(id)?.title).filter(Boolean).join(', ');
    return '문헌 장절 검색 · '+titles+' '+found.reference.parts.join('.')+(found.reference.preface?' 서두':'')+(found.reference.scheme==='conventional'?' · 통상 인용 번호':'');
  }
  return modeLabels[state.mode]+' 검색'+(state.exact?' · 입력한 문구 그대로':state.match==='any'&&state.query.trim().includes(' ')?' · 하나라도 포함':'');
}

export function appliedConditions(state,works) {
  const labels=[];
  if(state.mode!=='ko')labels.push(modeLabels[state.mode]);
  if(state.work&&works.get(state.work))labels.push('문헌: '+works.get(state.work).title);
  if(state.exact&&state.mode!=='scripture')labels.push('입력한 문구 그대로');
  else if(state.match==='any')labels.push('하나라도 포함');
  if(state.exclude)labels.push('제외: '+state.exclude);
  if(state.relation)labels.push('참조 유형: '+relationLabels[state.relation]);
  if(state.numbering==='conventional')labels.push('통상 인용 번호');
  return labels;
}
