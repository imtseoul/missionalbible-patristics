import scriptureIndex from './scripture-index.mjs?v=759ad19d874b';

if (scriptureIndex.schema_version !== 'patristics-topic-scripture-index-1') {
  throw new Error('성경 구절 색인의 자료 형식을 읽을 수 없습니다.');
}

const compact = text => text.normalize('NFKC').toLocaleLowerCase('ko').replace(/\s+/g,'');
const books = new Map(scriptureIndex.books.map(book => [book.id,book]));
const aliases = scriptureIndex.books.flatMap(book => [book.id,book.title,...book.aliases]
  .map(alias => [compact(alias).replace(/\./g,''),book.id])).sort((a,b)=>b[0].length-a[0].length);
const byTopic = new Map(), byPassage = new Map();
for (const ref of scriptureIndex.references) {
  for (const id of ref.topics) {
    if (!byTopic.has(id)) byTopic.set(id,[]);
    byTopic.get(id).push(ref);
  }
  if (!byPassage.has(ref.passage)) byPassage.set(ref.passage,[]);
  byPassage.get(ref.passage).push(ref);
}
const priority = {body_reference:0,editorial_reference:1,translation_note_reference:2};
export const scriptureRelationLabels = {body_reference:'본문 참조',editorial_reference:'편집자 참조',translation_note_reference:'번역 메모 참조'};

export function parseScriptureQuery(value) {
  const text=compact(value).replace(/\u2013|\u2014/g,'-');
  for (const [alias,book] of aliases) {
    if (!text.startsWith(alias)) continue;
    let rest=text.slice(alias.length).replace(/^\./,'');
    rest=rest.replace(/^(\d+)(?:장|편)(\d+)절(?:-(\d+)절?)?$/,(_,c,v,e)=>c+':'+v+(e?'-'+e:''));
    rest=rest.replace(/^(\d+)(?:장|편)$/,'$1');
    const match=rest.match(/^([1-9]\d{0,2})(?:[:.]([1-9]\d{0,3})(?:-(?:([1-9]\d{0,2})[:.])?([1-9]\d{0,3}))?)?$/);
    if (!match) continue;
    const chapter=Number(match[1]),verse=match[2]?Number(match[2]):null;
    const chapter_end=match[3]?Number(match[3]):chapter,verse_end=match[4]?Number(match[4]):verse;
    if (chapter_end<chapter || verse!==null && chapter_end===chapter && verse_end<verse) return null;
    return {book,chapter,verse,chapter_end,verse_end};
  }
  return null;
}

const point = (chapter,verse) => chapter*10000+verse;
export function scriptureIntersects(reference,query) {
  if (!query || reference.book!==query.book) return false;
  if (query.verse===null) return reference.chapter<=query.chapter && reference.chapter_end>=query.chapter;
  if (reference.verse===null) return false;
  return point(reference.chapter,reference.verse)<=point(query.chapter_end,query.verse_end)
    && point(reference.chapter_end,reference.verse_end)>=point(query.chapter,query.verse);
}

export function scriptureReferenceLabel(ref) {
  const book=books.get(ref.book);if(!book)return '';
  if (ref.verse===null) return `${book.title} ${ref.chapter}${ref.book==='Psalms'?'편':'장'}`;
  let label=`${book.title} ${ref.chapter}:${ref.verse}`;
  if (ref.chapter_end!==ref.chapter) label+=`-${ref.chapter_end}:${ref.verse_end}`;
  else if (ref.verse_end!==ref.verse) label+='-'+ref.verse_end;
  return label;
}

export function topicScriptureMatches(topic,query) {
  return (byTopic.get(topic)||[]).filter(ref=>scriptureIntersects(ref,query));
}

export function passageScriptureReferences(passage,query) {
  const matching=(byPassage.get(passage)||[]).filter(ref=>scriptureIntersects(ref,query));
  const best=new Map();
  for (const ref of matching) {
    const key=[ref.book,ref.chapter,ref.verse,ref.chapter_end,ref.verse_end].join(':');
    if (!best.has(key) || priority[ref.relation]<priority[best.get(key).relation]) best.set(key,ref);
  }
  return [...best.values()].filter(ref=>![...best.values()].some(other=>other!==ref && other.book===ref.book
    && priority[other.relation]<priority[ref.relation]
    && point(other.chapter,other.verse)<=point(ref.chapter,ref.verse)
    && point(other.chapter_end,other.verse_end)>=point(ref.chapter_end,ref.verse_end)));
}

export function scriptureReferenceSummary(passage,query) {
  return passageScriptureReferences(passage,query).map(ref=>scriptureReferenceLabel(ref)+' ('+scriptureRelationLabels[ref.relation]+')').join(' · ');
}
